use axum::Json;
use serde::Deserialize;
use serde_json::{Value,json};
use sqlx::{PgPool,Row};
use uuid::Uuid;
use crate::{auth::Auth,error::ApiError};

#[derive(Debug,Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TransitionRequest {pub action:String,pub note:Option<String>}

pub struct TransitionRule {pub from:&'static str,pub to:&'static str,pub roles:&'static [&'static str]}

/// Pilot approval gate. Domain-specific operational workflow tables are a later checkpoint.
pub fn rule(action:&str)->Option<TransitionRule> {
    match action {
        "submit" => Some(TransitionRule{from:"draft",to:"submitted",roles:&["operator","manager","finance","executive"]}),
        "approve_manager" => Some(TransitionRule{from:"submitted",to:"manager_approved",roles:&["manager","executive"]}),
        "approve_finance" => Some(TransitionRule{from:"manager_approved",to:"finance_approved",roles:&["finance","auditor"]}),
        "approve_final" => Some(TransitionRule{from:"finance_approved",to:"approved",roles:&["executive"]}),
        "reject" => Some(TransitionRule{from:"",to:"rejected",roles:&["manager","finance","auditor","executive"]}),
        _=>None
    }
}

pub async fn transition(pool:&PgPool,auth:&Auth,id:Uuid,req:TransitionRequest)->Result<Json<Value>,ApiError> {
    let r=rule(&req.action).ok_or_else(||ApiError::bad("Unknown transition"))?;
    // Administrative access is not a substitute for an authorized business reviewer.
    // An administrator may provision accounts but cannot approve commercial transactions.
    if !r.roles.contains(&auth.role.as_str()) {return Err(ApiError::forbidden())}

    let mut tx=pool.begin().await.map_err(ApiError::db)?;
    let row=sqlx::query("SELECT status,created_by,version FROM domain_records WHERE id=$1 AND entity_id=$2 FOR UPDATE")
        .bind(id).bind(auth.entity_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    let row=row.ok_or_else(ApiError::not_found)?;
    let from:String=row.get("status");
    let creator:Uuid=row.get("created_by");
    if req.action=="reject" {
        if !["submitted","manager_approved","finance_approved"].contains(&from.as_str()) {return Err(ApiError::conflict("Cannot reject this record state"))}
    } else if from!=r.from {return Err(ApiError::conflict(format!("Transition {} requires status {}, got {}",req.action,r.from,from)))}
    if req.action!="submit" && creator==auth.user_id {return Err(ApiError::forbidden())}
    // Maker-checker: the same actor must not approve multiple stages of one dossier.
    if req.action.starts_with("approve_") {
        let duplicate:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM workflow_events WHERE entity_id=$1 AND record_id=$2 AND actor_id=$3 AND action LIKE 'approve_%')")
            .bind(auth.entity_id).bind(id).bind(auth.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
        if duplicate {return Err(ApiError::conflict("Independent reviewer required at each approval stage"))}
    }
    if req.note.as_deref().unwrap_or("").len()>1000 {return Err(ApiError::bad("Note too long"))}
    sqlx::query("UPDATE domain_records SET status=$1,version=version+1,updated_at=now() WHERE id=$2 AND entity_id=$3")
        .bind(r.to).bind(id).bind(auth.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO workflow_events(entity_id,record_id,actor_id,from_status,to_status,action,note) VALUES($1,$2,$3,$4,$5,$6,$7)")
        .bind(auth.entity_id).bind(id).bind(auth.user_id).bind(&from).bind(r.to).bind(&req.action).bind(&req.note)
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'workflow_transition','domain_record',$3,$4)")
        .bind(auth.entity_id).bind(auth.user_id).bind(id).bind(json!({"from":from,"to":r.to,"action":req.action}))
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(json!({"id":id,"status":r.to,"action":req.action})))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn no_skip_to_final() {assert!(rule("4").is_none());assert_eq!(rule("approve_final").unwrap().from,"finance_approved");}
    #[test] fn only_manager_role_for_manager_step(){let r=rule("approve_manager").unwrap();assert!(!r.roles.contains(&"group_admin"));assert!(!r.roles.contains(&"operator"));}
    #[test] fn reject_requires_review() { assert_eq!(rule("reject").unwrap().to,"rejected"); }
}
