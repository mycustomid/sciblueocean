use axum::{extract::{Path,State},http::HeaderMap,Json};
use serde_json::{json,Value};
use sqlx::Row;
use uuid::Uuid;
use crate::{AppState,auth::{self,allow},error::ApiError,policy};

/// Evidence routes are server-side scoped to exactly one legal entity.
/// A record status is not proof of a ledger posting or external regulatory filing.
pub async fn overview(State(state):State<AppState>,headers:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    let rows=sqlx::query("SELECT module_key,status,count(*) AS count FROM domain_records WHERE entity_id=$1 GROUP BY module_key,status ORDER BY module_key,status")
        .bind(a.entity_id).fetch_all(&state.pool).await.map_err(ApiError::db)?;
    let groups:Vec<Value>=rows.iter().map(|r|json!({"module_key":r.get::<String,_>("module_key"),"status":r.get::<String,_>("status"),"count":r.get::<i64,_>("count")})).collect();
    let posted_count:i64=sqlx::query_scalar("SELECT count(*) FROM gl_journals WHERE entity_id=$1 AND status='posted'")
        .bind(a.entity_id).fetch_one(&state.pool).await.map_err(ApiError::db)?;
    let journal_drafts:i64=sqlx::query_scalar("SELECT count(*) FROM gl_journals WHERE entity_id=$1 AND status='draft'")
        .bind(a.entity_id).fetch_one(&state.pool).await.map_err(ApiError::db)?;
    Ok(Json(json!({"scope":"current_legal_entity","entity_id":a.entity_id,"domain_status_counts":groups,"journals":{"posted":posted_count,"draft":journal_drafts},"financial_consolidation_performed":false,"demo_only":true})))
}

pub async fn record_detail(State(state):State<AppState>,headers:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    let row=sqlx::query("SELECT id,module_key,counterparty,description,amount_xaf,status,created_by,created_at,version FROM domain_records WHERE id=$1 AND entity_id=$2")
        .bind(id).bind(a.entity_id).fetch_optional(&state.pool).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
    policy::ensure_module(&a,&row.get::<String,_>("module_key"),false)?;
    let events=sqlx::query("SELECT action,from_status,to_status,actor_id,note,created_at FROM workflow_events WHERE record_id=$1 AND entity_id=$2 ORDER BY created_at,id")
        .bind(id).bind(a.entity_id).fetch_all(&state.pool).await.map_err(ApiError::db)?;
    let history:Vec<Value>=events.iter().map(|e|json!({"action":e.get::<String,_>("action"),"from":e.get::<String,_>("from_status"),"to":e.get::<String,_>("to_status"),"actor_id":e.get::<Uuid,_>("actor_id"),"note":e.get::<Option<String>,_>("note"),"created_at":e.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect();
    Ok(Json(json!({"id":row.get::<Uuid,_>("id"),"module_key":row.get::<String,_>("module_key"),"counterparty":row.get::<String,_>("counterparty"),"description":row.get::<String,_>("description"),"amount_xaf":row.get::<i64,_>("amount_xaf"),"status":row.get::<String,_>("status"),"created_by":row.get::<Uuid,_>("created_by"),"created_at":row.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"version":row.get::<i32,_>("version"),"workflow_history":history,"entity_id":a.entity_id})))
}

pub async fn journal_detail(State(state):State<AppState>,headers:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    allow(&a,&["finance","auditor","executive","manager"])?;
    let row=sqlx::query("SELECT id,period_key,memo,status,created_by,posted_by,posted_at FROM gl_journals WHERE id=$1 AND entity_id=$2")
        .bind(id).bind(a.entity_id).fetch_optional(&state.pool).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
    let lines=sqlx::query("SELECT a.code,a.label,l.debit_xaf,l.credit_xaf FROM gl_lines l JOIN gl_accounts a ON a.id=l.account_id AND a.entity_id=l.entity_id WHERE l.journal_id=$1 AND l.entity_id=$2 ORDER BY a.code,l.id")
        .bind(id).bind(a.entity_id).fetch_all(&state.pool).await.map_err(ApiError::db)?;
    let items:Vec<Value>=lines.iter().map(|l|json!({"account_code":l.get::<String,_>("code"),"account_label":l.get::<String,_>("label"),"debit_xaf":l.get::<i64,_>("debit_xaf"),"credit_xaf":l.get::<i64,_>("credit_xaf")})).collect();
    let debit:i128=lines.iter().map(|l|i128::from(l.get::<i64,_>("debit_xaf"))).sum();
    let credit:i128=lines.iter().map(|l|i128::from(l.get::<i64,_>("credit_xaf"))).sum();
    Ok(Json(json!({"id":row.get::<Uuid,_>("id"),"entity_id":a.entity_id,"period_key":row.get::<String,_>("period_key"),"memo":row.get::<String,_>("memo"),"status":row.get::<String,_>("status"),"created_by":row.get::<Uuid,_>("created_by"),"posted_by":row.get::<Option<Uuid>,_>("posted_by"),"posted_at":row.get::<Option<chrono::DateTime<chrono::Utc>>,_>("posted_at"),"lines":items,"totals":{"debit_xaf":debit.to_string(),"credit_xaf":credit.to_string(),"balanced":debit==credit&&debit>0},"localization_certified":false})))
}

pub async fn audit_feed(State(state):State<AppState>,headers:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&state.pool).await?;
    allow(&a,&["finance","auditor","executive"])?;
    let rows=sqlx::query("SELECT event_type,resource_type,resource_id,actor_id,created_at FROM audit_events WHERE entity_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50")
        .bind(a.entity_id).fetch_all(&state.pool).await.map_err(ApiError::db)?;
    let events:Vec<Value>=rows.iter().map(|r|json!({"event_type":r.get::<String,_>("event_type"),"resource_type":r.get::<String,_>("resource_type"),"resource_id":r.get::<Uuid,_>("resource_id"),"actor_id":r.get::<Option<Uuid>,_>("actor_id"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect();
    Ok(Json(json!({"events":events,"count":events.len(),"scope":"current_legal_entity","read_only":true})))
}
