//! RC15 operational workflows on dedicated disposable Postgres only.
use blue_line_erp_api::{AppState,auth,industry::{self,ProjectInput,ProgressInput,BatchInput,CompleteBatchInput,QcInput,ImportInput,VerifyImportInput}};
use axum::{extract::{State,Path},http::HeaderMap,Json};
use chrono::NaiveDate;use sqlx::PgPool;use uuid::Uuid;
async fn actor(p:&PgPool,e:Uuid,role:&str)->HeaderMap{
 let uid:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC15 QA','fixture-only') RETURNING id")
 .bind(format!("rc15-{}@test.invalid",Uuid::new_v4())).fetch_one(p).await.unwrap();
 sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)").bind(uid).bind(e).bind(role).execute(p).await.unwrap();
 let raw=format!("{}{}",Uuid::new_v4().simple(),Uuid::new_v4().simple());
 sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '2 hours')")
 .bind(auth::hash_token(&raw)).bind(uid).bind(e).execute(p).await.unwrap();
 let mut h=HeaderMap::new();h.insert("authorization",format!("Bearer {raw}").parse().unwrap());h
}
#[tokio::test] async fn rc15_entity_scoped_maker_checker_and_manufacturing_qc(){
 let url=std::env::var("TEST_DATABASE_URL").expect("RC15 PG test needs TEST_DATABASE_URL; never use company database");
 assert!(!url.to_lowercase().contains("prod"),"Never run against production");
 let p=PgPool::connect(&url).await.unwrap();
 let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
 sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&p).await.unwrap();
 let version:i64=sqlx::query_scalar("SELECT max(version) FROM _sqlx_migrations WHERE success")
 .fetch_one(&p).await.unwrap();assert_eq!(version,12);
 let entity:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
 .bind(format!("RC15 Works {}",Uuid::new_v4())).fetch_one(&p).await.unwrap();
 let other:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
 .bind(format!("RC15 Foreign {}",Uuid::new_v4())).fetch_one(&p).await.unwrap();
 let op=actor(&p,entity,"operator").await;let manager=actor(&p,entity,"manager").await;
 let auditor=actor(&p,entity,"auditor").await;let foreign=actor(&p,other,"manager").await;
 let st=AppState{pool:p.clone()};
 let (_,Json(project))=industry::create_project(State(st.clone()),manager.clone(),Json(ProjectInput{
 project_code:format!("BLC-{}",Uuid::new_v4().simple()),name:"RC15 Pipeline Warehouse".into(),budget_xaf:3000000
 })).await.unwrap();let pid=Uuid::parse_str(project["id"].as_str().unwrap()).unwrap();
 let (_,Json(progress))=industry::submit_progress(State(st.clone()),op.clone(),Json(ProgressInput{
 project_id:pid,completion_percent:40,spent_xaf:800000,note:"Signed stage 1 physical verification".into()
 })).await.unwrap();let progress_id=Uuid::parse_str(progress["id"].as_str().unwrap()).unwrap();
 assert!(industry::approve_progress(State(st.clone()),foreign.clone(),Path(progress_id)).await.is_err());
 assert!(industry::approve_progress(State(st.clone()),op.clone(),Path(progress_id)).await.is_err());
 industry::approve_progress(State(st.clone()),manager.clone(),Path(progress_id)).await.unwrap();
 assert!(industry::approve_progress(State(st.clone()),manager.clone(),Path(progress_id)).await.is_err());
 assert!(industry::submit_progress(State(st.clone()),op.clone(),Json(ProgressInput{
 project_id:pid,completion_percent:20,spent_xaf:1000000,note:"Regressive progress should fail".into()
 })).await.is_err());
 let item:Uuid=sqlx::query_scalar("INSERT INTO inventory_items(entity_id,sku,label,unit) VALUES($1,$2,'RC15 sugar','kg') RETURNING id")
 .bind(entity).bind(format!("RC15-{}",Uuid::new_v4().simple())).fetch_one(&p).await.unwrap();
 let (_,Json(batch))=industry::create_batch(State(st.clone()),op.clone(),Json(BatchInput{
 batch_code:format!("LOT-{}",Uuid::new_v4().simple()),item_id:item,planned_quantity:300
 })).await.unwrap();let batch_id=Uuid::parse_str(batch["id"].as_str().unwrap()).unwrap();
 assert!(industry::qc_batch(State(st.clone()),auditor.clone(),Path(batch_id),Json(QcInput{pass:true,note:"Too early to release".into()})).await.is_err());
 industry::complete_batch(State(st.clone()),op.clone(),Path(batch_id),Json(CompleteBatchInput{produced_quantity:280,brix_x100:1880})).await.unwrap();
 assert!(industry::release_batch(State(st.clone()),manager.clone(),Path(batch_id)).await.is_err());
 industry::qc_batch(State(st.clone()),auditor.clone(),Path(batch_id),Json(QcInput{pass:true,note:"Checked Brix and batch weight".into()})).await.unwrap();
 let Json(release)=industry::release_batch(State(st.clone()),manager.clone(),Path(batch_id)).await.unwrap();
 assert_eq!(release["statutory_certified"],false);assert_eq!(release["inventory_posted"],false);
 assert!(industry::release_batch(State(st.clone()),manager.clone(),Path(batch_id)).await.is_err());
 let (_,Json(import))=industry::create_import(State(st.clone()),op.clone(),Json(ImportInput{
 bl_reference:format!("BOL-{}",Uuid::new_v4().simple()),container_reference:"MSCU1111110".into(),description:"Imported test spare part shipment".into(),eta:NaiveDate::from_ymd_opt(2026,11,15).unwrap()
 })).await.unwrap();let imp_id=Uuid::parse_str(import["id"].as_str().unwrap()).unwrap();
 assert!(industry::verify_import(State(st.clone()),foreign.clone(),Path(imp_id),Json(VerifyImportInput{evidence_reference:"EX-REVIEW-332".into()})).await.is_err());
 let Json(verified)=industry::verify_import(State(st.clone()),manager.clone(),Path(imp_id),Json(VerifyImportInput{
 evidence_reference:"CUSTOMS-DOCUMENT-REVIEW-332".into()
 })).await.unwrap();assert_eq!(verified["customs_release_confirmed"],false);
}
