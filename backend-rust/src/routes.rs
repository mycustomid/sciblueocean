use axum::{extract::{Path,Query,State},http::{HeaderMap,StatusCode},Json};
use serde::{Deserialize,Serialize};
use serde_json::{Value,json};
use sha2::{Sha256,Digest};
use sqlx::Row;
use uuid::Uuid;
use crate::{AppState,MODULE_KEYS,is_module,auth::{self},policy,error::ApiError,journal::{self,JournalInput},workflow::{self,TransitionRequest}};

#[derive(Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct RecordInput {pub module_key:String,pub counterparty:String,pub description:String,pub amount_xaf:i64,pub external_ref:Option<String>}

#[derive(Deserialize)]
pub struct RecordQuery {pub module_key:Option<String>}

pub async fn health(State(state):State<AppState>)->Result<Json<Value>,ApiError>{
    sqlx::query_scalar::<_,i32>("SELECT 1").fetch_one(&state.pool).await.map_err(ApiError::db)?;
    Ok(Json(json!({"status":"ok","service":"blue-line-rust-api","version":"0.20.0-rc20","database":"reachable","production_ready":false})))
}

pub async fn modules(State(state):State<AppState>,headers:HeaderMap)->Result<Json<Value>,ApiError> {
    let a=auth::require_auth(&headers,&state.pool).await?;
    let rows=sqlx::query("SELECT module_key,name,domain_category,rollout_status FROM erp_modules ORDER BY module_key")
        .fetch_all(&state.pool).await.map_err(ApiError::db)?;
    let visible=policy::visible_modules(&a);
    let items:Vec<Value>=rows.iter().filter(|r|visible.contains(&r.get::<String,_>("module_key"))).map(|r|json!({"module_key":r.get::<String,_>("module_key"),"name":r.get::<String,_>("name"),"domain_category":r.get::<String,_>("domain_category"),"rollout_status":r.get::<String,_>("rollout_status")})).collect();
    Ok(Json(json!({"modules":items,"entity_id":a.entity_id,"count":items.len()})))
}

pub async fn login(State(state):State<AppState>,Json(req):Json<auth::LoginRequest>)->Result<Json<auth::LoginResponse>,ApiError>{auth::login(&state.pool,req).await}
pub async fn me(State(state):State<AppState>,headers:HeaderMap)->Result<Json<Value>,ApiError>{auth::me(&state.pool,&headers).await}
pub async fn logout(State(state):State<AppState>,headers:HeaderMap)->Result<Json<Value>,ApiError>{auth::logout(&state.pool,&headers).await}

pub async fn entities(State(state):State<AppState>,headers:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    let row=sqlx::query("SELECT legal_name,country_code FROM legal_entities WHERE id=$1").bind(a.entity_id)
        .fetch_optional(&state.pool).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
    Ok(Json(json!({"id":a.entity_id,"legal_name":row.get::<String,_>("legal_name"),"country_code":row.get::<String,_>("country_code"),"role":a.role})))
}

pub async fn list_records(State(state):State<AppState>,headers:HeaderMap,Query(q):Query<RecordQuery>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    if let Some(m)=q.module_key.as_deref(){if !is_module(m){return Err(ApiError::bad("Unknown module"))} policy::ensure_module(&a,m,false)?;}
    let allowed=policy::visible_modules(&a);
    let rows=sqlx::query("SELECT id,module_key,counterparty,description,amount_xaf,status,created_at,version FROM domain_records WHERE entity_id=$1 AND module_key=ANY($3::text[]) AND ($2::text IS NULL OR module_key=$2) ORDER BY created_at DESC LIMIT 100")
        .bind(a.entity_id).bind(q.module_key).bind(allowed).fetch_all(&state.pool).await.map_err(ApiError::db)?;
    let items:Vec<Value>=rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"module_key":r.get::<String,_>("module_key"),"counterparty":r.get::<String,_>("counterparty"),"description":r.get::<String,_>("description"),"amount_xaf":r.get::<i64,_>("amount_xaf"),"status":r.get::<String,_>("status"),"version":r.get::<i32,_>("version"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect();
    Ok(Json(json!({"items":items,"count":items.len(),"scope":"current_legal_entity"})))
}

pub fn validate_record(req:&RecordInput)->Result<(),ApiError>{
    if !is_module(&req.module_key) {return Err(ApiError::bad("Unknown module"))}
    if req.counterparty.trim().len()<2||req.counterparty.len()>240 {return Err(ApiError::bad("Invalid counterparty"))}
    if req.description.trim().len()<3||req.description.len()>2000 {return Err(ApiError::bad("Invalid description"))}
    if req.amount_xaf<0||req.amount_xaf>9_000_000_000_000_000 {return Err(ApiError::bad("Amount out of bounds"))}
    if req.external_ref.as_ref().is_some_and(|s|s.len()>120){return Err(ApiError::bad("External reference too long"))}
    Ok(())
}

pub async fn create_record(State(state):State<AppState>,headers:HeaderMap,Json(req):Json<RecordInput>)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    policy::ensure_module(&a,&req.module_key,true)?;
    validate_record(&req)?;
    let key=headers.get("Idempotency-Key").and_then(|v|v.to_str().ok()).ok_or_else(||ApiError::bad("Idempotency-Key header is required"))?;
    if key.len()<8 || key.len()>120 || !key.bytes().all(|b|b.is_ascii_alphanumeric() || b"-_".contains(&b)){return Err(ApiError::bad("Invalid Idempotency-Key"))}
    let hash=hex::encode(Sha256::digest(serde_json::to_vec(&req).map_err(|_|ApiError::bad("Invalid record"))?));
    let mut tx=state.pool.begin().await.map_err(ApiError::db)?;
    // Serialize same-entity writes with transaction advisory lock for deterministic idempotency.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("{}:record:{}",a.entity_id,key)).execute(&mut *tx).await.map_err(ApiError::db)?;
    let existing=sqlx::query("SELECT request_hash,resource_id FROM api_idempotency WHERE entity_id=$1 AND operation='create_record' AND request_key=$2")
        .bind(a.entity_id).bind(key).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    if let Some(ex)=existing {
        if ex.get::<String,_>("request_hash")!=hash {return Err(ApiError::conflict("Idempotency key reused for different payload"))}
        return Ok((StatusCode::OK,Json(json!({"id":ex.get::<Uuid,_>("resource_id"),"status":"existing","idempotent":true}))))
    }
    let id:Uuid=sqlx::query_scalar("INSERT INTO domain_records(entity_id,module_key,counterparty,description,amount_xaf,external_ref,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id")
        .bind(a.entity_id).bind(&req.module_key).bind(&req.counterparty).bind(&req.description).bind(req.amount_xaf).bind(&req.external_ref).bind(a.user_id)
        .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO api_idempotency(entity_id,operation,request_key,request_hash,resource_id) VALUES($1,'create_record',$2,$3,$4)")
        .bind(a.entity_id).bind(key).bind(hash).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'record_created','domain_record',$3,$4)")
        .bind(a.entity_id).bind(a.user_id).bind(id).bind(json!({"module":req.module_key,"status":"draft"}))
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"draft","entity_id":a.entity_id,"persisted":true}))))
}

pub async fn transition(State(state):State<AppState>,headers:HeaderMap,Path(id):Path<Uuid>,Json(req):Json<TransitionRequest>)->Result<Json<Value>,ApiError> {
    let a=auth::require_auth(&headers,&state.pool).await?;
    workflow::transition(&state.pool,&a,id,req).await
}
pub async fn create_journal(State(state):State<AppState>,headers:HeaderMap,Json(req):Json<JournalInput>)->Result<Json<journal::JournalResponse>,ApiError> {
    let a=auth::require_auth(&headers,&state.pool).await?;
    journal::create(&state.pool,&a,req).await
}
pub async fn post_journal(State(state):State<AppState>,headers:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    journal::post(&state.pool,&a,id).await
}
pub async fn list_journals(State(state):State<AppState>,headers:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    journal::list(&state.pool,&a).await
}

#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn rejects_unknown_module(){ assert!(validate_record(&RecordInput{module_key:"unknown".into(),counterparty:"Example".into(),description:"invoice".into(),amount_xaf:1000,external_ref:None}).is_err());}
 #[test]fn rejects_negative_amount(){assert!(validate_record(&RecordInput{module_key:"property".into(),counterparty:"Example".into(),description:"invoice".into(),amount_xaf:-1,external_ref:None}).is_err());}
}
