//! RC15 bounded construction, manufacturing QC and import documentary workflows.
//! These are controlled pilots; they do NOT certify customs clearance, inventory,
//! cost accounting, construction completion or regulatory releases.
use axum::{extract::{Path,State},http::{HeaderMap,StatusCode},Json};
use serde::Deserialize;use serde_json::{json,Value};use sqlx::{Row,Transaction,Postgres};use uuid::Uuid;
use chrono::NaiveDate;
use crate::{AppState,auth::{self,Auth},error::ApiError};
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct ProjectInput{pub project_code:String,pub name:String,pub budget_xaf:i64}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct ProgressInput{pub project_id:Uuid,pub completion_percent:i32,pub spent_xaf:i64,pub note:String}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct BatchInput{pub batch_code:String,pub item_id:Uuid,pub planned_quantity:i64}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct CompleteBatchInput{pub produced_quantity:i64,pub brix_x100:i32}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct QcInput{pub pass:bool,pub note:String}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct ImportInput{pub bl_reference:String,pub container_reference:String,pub description:String,pub eta:NaiveDate}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct VerifyImportInput{pub evidence_reference:String}
fn only(a:&Auth,role:&str)->Result<(),ApiError>{if a.role==role{Ok(())}else{Err(ApiError::forbidden())}}
fn valid(s:&str,min:usize,max:usize)->bool{s.trim().len()>=min&&s.len()<=max}
async fn log(tx:&mut Transaction<'_,Postgres>,a:&Auth,kind:&str,resource:&str,id:Uuid,meta:Value)->Result<(),ApiError>{
 sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,$3,$4,$5,$6)")
 .bind(a.entity_id).bind(a.user_id).bind(kind).bind(resource).bind(id).bind(meta).execute(&mut **tx).await.map_err(ApiError::db)?;Ok(())
}
pub async fn projects(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,project_code,name,budget_xaf FROM rc15_projects WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"code":r.get::<String,_>("project_code"),"name":r.get::<String,_>("name"),"budget_xaf":r.get::<i64,_>("budget_xaf")})).collect::<Vec<_>>()})))
}
pub async fn create_project(State(s):State<AppState>,h:HeaderMap,Json(p):Json<ProjectInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"manager")?;
 if !valid(&p.project_code,3,64)||!valid(&p.name,3,240)||p.budget_xaf<=0{return Err(ApiError::bad("Invalid project"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc15_projects(entity_id,project_code,name,budget_xaf,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id")
 .bind(a.entity_id).bind(p.project_code).bind(p.name).bind(p.budget_xaf).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"construction_project_created","rc15_project",id,json!({})).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"registered"}))))
}
pub async fn progress(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,project_id,completion_percent,spent_xaf,status FROM rc15_progress WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"project_id":r.get::<Uuid,_>("project_id"),"completion_percent":r.get::<i32,_>("completion_percent"),"spent_xaf":r.get::<i64,_>("spent_xaf"),"status":r.get::<String,_>("status")})).collect::<Vec<_>>()})))
}
pub async fn submit_progress(State(s):State<AppState>,h:HeaderMap,Json(p):Json<ProgressInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"operator")?;
 if !(1..=100).contains(&p.completion_percent)||p.spent_xaf<0||!valid(&p.note,8,1000){return Err(ApiError::bad("Invalid progress"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let proj=sqlx::query("SELECT budget_xaf FROM rc15_projects WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(p.project_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if p.spent_xaf>proj.get::<i64,_>("budget_xaf"){return Err(ApiError::conflict("Budget exceeded; requires separate change control"))}
 let active:i64=sqlx::query_scalar("SELECT count(*) FROM rc15_progress WHERE entity_id=$1 AND project_id=$2 AND status='submitted'")
 .bind(a.entity_id).bind(p.project_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 if active>0{return Err(ApiError::conflict("Pending progress already exists"))}
 let old:Option<i32>=sqlx::query_scalar("SELECT max(completion_percent) FROM rc15_progress WHERE entity_id=$1 AND project_id=$2 AND status='accepted'")
 .bind(a.entity_id).bind(p.project_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 if p.completion_percent<=old.unwrap_or(0){return Err(ApiError::conflict("Progress must exceed accepted progress"))}
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc15_progress(entity_id,project_id,completion_percent,spent_xaf,note,submitted_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id")
 .bind(a.entity_id).bind(p.project_id).bind(p.completion_percent).bind(p.spent_xaf).bind(p.note).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"construction_progress_submitted","rc15_progress",id,json!({"project_id":p.project_id})).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"submitted"}))))
}
pub async fn approve_progress(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"manager")?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let p=sqlx::query("SELECT submitted_by,project_id,status FROM rc15_progress WHERE id=$1 AND entity_id=$2 FOR UPDATE")
 .bind(id).bind(a.entity_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if p.get::<String,_>("status")!="submitted"{return Err(ApiError::conflict("Already processed"))}
 if p.get::<Uuid,_>("submitted_by")==a.user_id{return Err(ApiError::forbidden())}
 sqlx::query("UPDATE rc15_progress SET status='accepted',accepted_by=$1,accepted_at=now() WHERE id=$2 AND entity_id=$3")
 .bind(a.user_id).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"construction_progress_accepted","rc15_progress",id,json!({"project_id":p.get::<Uuid,_>("project_id")})).await?;
 tx.commit().await.map_err(ApiError::db)?;Ok(Json(json!({"id":id,"status":"accepted","client_billing_created":false})))
}
pub async fn batches(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,batch_code,item_id,planned_quantity,produced_quantity,brix_x100,status FROM rc15_batches WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"batch_code":r.get::<String,_>("batch_code"),"item_id":r.get::<Uuid,_>("item_id"),"planned_quantity":r.get::<i64,_>("planned_quantity"),"produced_quantity":r.get::<Option<i64>,_>("produced_quantity"),"brix_x100":r.get::<Option<i32>,_>("brix_x100"),"status":r.get::<String,_>("status")})).collect::<Vec<_>>()})))
}
pub async fn create_batch(State(s):State<AppState>,h:HeaderMap,Json(p):Json<BatchInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"operator")?;
 if !valid(&p.batch_code,3,64)||!(1..=1_000_000_000).contains(&p.planned_quantity){return Err(ApiError::bad("Invalid batch"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc15_batches(entity_id,batch_code,item_id,planned_quantity,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id")
 .bind(a.entity_id).bind(p.batch_code).bind(p.item_id).bind(p.planned_quantity).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"batch_planned","rc15_batch",id,json!({})).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"planned"}))))
}
pub async fn complete_batch(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<CompleteBatchInput>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"operator")?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let row=sqlx::query("SELECT planned_quantity,status FROM rc15_batches WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if row.get::<String,_>("status")!="planned"||p.produced_quantity<1||p.produced_quantity>row.get::<i64,_>("planned_quantity")||!(0..=10000).contains(&p.brix_x100){return Err(ApiError::conflict("Invalid production run"))}
 sqlx::query("UPDATE rc15_batches SET produced_quantity=$1,brix_x100=$2,status='awaiting_qc',completed_by=$3 WHERE entity_id=$4 AND id=$5")
 .bind(p.produced_quantity).bind(p.brix_x100).bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"batch_produced_pending_qc","rc15_batch",id,json!({"quantity":p.produced_quantity,"brix_x100":p.brix_x100})).await?;
 tx.commit().await.map_err(ApiError::db)?;Ok(Json(json!({"id":id,"status":"awaiting_qc","inventory_posted":false})))
}
pub async fn qc_batch(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<QcInput>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"auditor")?;
 if !valid(&p.note,8,500){return Err(ApiError::bad("QC evidence note required"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let row=sqlx::query("SELECT created_by,completed_by,status FROM rc15_batches WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if row.get::<String,_>("status")!="awaiting_qc"{return Err(ApiError::conflict("Not awaiting QC"))}
 if row.get::<Uuid,_>("created_by")==a.user_id || row.get::<Option<Uuid>,_>("completed_by")==Some(a.user_id){return Err(ApiError::forbidden())}
 let status=if p.pass{"qc_passed"}else{"qc_rejected"};
 sqlx::query("UPDATE rc15_batches SET status=$1,qc_by=$2 WHERE entity_id=$3 AND id=$4")
 .bind(status).bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"manufacturing_qc_review","rc15_batch",id,json!({"passed":p.pass,"note":p.note})).await?;
 tx.commit().await.map_err(ApiError::db)?;Ok(Json(json!({"id":id,"status":status})))
}
pub async fn release_batch(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"manager")?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let row=sqlx::query("SELECT created_by,completed_by,qc_by,status FROM rc15_batches WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if row.get::<String,_>("status")!="qc_passed"{return Err(ApiError::conflict("QC pass required"))}
 if row.get::<Uuid,_>("created_by")==a.user_id||row.get::<Option<Uuid>,_>("completed_by")==Some(a.user_id)||row.get::<Option<Uuid>,_>("qc_by")==Some(a.user_id){return Err(ApiError::forbidden())}
 sqlx::query("UPDATE rc15_batches SET status='released',released_by=$1 WHERE entity_id=$2 AND id=$3")
 .bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"manufacturing_batch_internal_release","rc15_batch",id,json!({"inventory_posted":false})).await?;
 tx.commit().await.map_err(ApiError::db)?;Ok(Json(json!({"id":id,"status":"released","inventory_posted":false,"statutory_certified":false})))
}
pub async fn imports(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,bl_reference,container_reference,description,eta,evidence_reference,status FROM rc15_import_dossiers WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"bl_reference":r.get::<String,_>("bl_reference"),"container_reference":r.get::<String,_>("container_reference"),"description":r.get::<String,_>("description"),"eta":r.get::<NaiveDate,_>("eta"),"evidence_reference":r.get::<Option<String>,_>("evidence_reference"),"status":r.get::<String,_>("status")})).collect::<Vec<_>>()})))
}
pub async fn create_import(State(s):State<AppState>,h:HeaderMap,Json(p):Json<ImportInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"operator")?;
 if !valid(&p.bl_reference,4,120)||!valid(&p.container_reference,4,120)||!valid(&p.description,8,1000){return Err(ApiError::bad("Invalid document references"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc15_import_dossiers(entity_id,bl_reference,container_reference,description,eta,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id")
 .bind(a.entity_id).bind(&p.bl_reference).bind(&p.container_reference).bind(&p.description).bind(p.eta).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"import_dossier_created","rc15_import",id,json!({"bl":p.bl_reference})).await?;
 tx.commit().await.map_err(ApiError::db)?;Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"draft","customs_release_verified":false}))))
}
pub async fn verify_import(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<VerifyImportInput>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"manager")?;
 if !valid(&p.evidence_reference,8,240){return Err(ApiError::bad("Document evidence reference required"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let r=sqlx::query("SELECT status,created_by FROM rc15_import_dossiers WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if r.get::<String,_>("status")!="draft"{return Err(ApiError::conflict("Document already reviewed"))}
 if r.get::<Uuid,_>("created_by")==a.user_id{return Err(ApiError::forbidden())}
 sqlx::query("UPDATE rc15_import_dossiers SET status='documents_checked',evidence_reference=$1,checked_by=$2 WHERE entity_id=$3 AND id=$4")
 .bind(&p.evidence_reference).bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"import_documents_reviewed","rc15_import",id,json!({"evidence_reference":p.evidence_reference,"customs_release":false})).await?;
 tx.commit().await.map_err(ApiError::db)?;Ok(Json(json!({"id":id,"status":"documents_checked","customs_release_confirmed":false})))
}
