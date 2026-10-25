use axum::Json;
use serde::{Deserialize,Serialize};
use serde_json::{Value,json};
use sqlx::{PgPool,Row};
use uuid::Uuid;
use crate::{auth::{Auth,allow},error::ApiError};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JournalInput {
    pub period_key:String,
    pub memo:String,
    pub source_record_id:Option<Uuid>,
    pub lines:Vec<JournalLineInput>
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct JournalLineInput {pub account_code:String,pub debit_xaf:i64,pub credit_xaf:i64}
#[derive(Serialize)]
pub struct JournalResponse {pub id:Uuid,pub status:&'static str,pub debits_xaf:i128,pub credits_xaf:i128}

pub fn validate(input:&JournalInput)->Result<(i128,i128),ApiError> {
    if input.memo.len()<4||input.memo.len()>1000 {return Err(ApiError::bad("Journal memo length must be 4..1000"))}
    let period=input.period_key.as_bytes();
    if period.len()!=7 || period[4]!=b'-' || !period.iter().enumerate().all(|(i,c)|i==4||c.is_ascii_digit()) || !matches!(&input.period_key[5..],"01"|"02"|"03"|"04"|"05"|"06"|"07"|"08"|"09"|"10"|"11"|"12") {return Err(ApiError::bad("Period must be YYYY-MM"))}
    if input.lines.len()<2 || input.lines.len()>200 {return Err(ApiError::bad("Provide 2..200 journal lines"))}
    let mut dr=0i128;let mut cr=0i128;
    for line in &input.lines {
        if line.account_code.len()>32||line.account_code.trim().is_empty() {return Err(ApiError::bad("Invalid GL account code"))}
        if line.debit_xaf<0||line.credit_xaf<0||(line.debit_xaf==0&&line.credit_xaf==0)||(line.debit_xaf>0&&line.credit_xaf>0) {return Err(ApiError::bad("Each line must have exactly one positive debit or credit"))}
        if line.debit_xaf>9_000_000_000_000_000 || line.credit_xaf>9_000_000_000_000_000 {
            return Err(ApiError::bad("Journal line exceeds supported XAF limit"));
        }
        dr+=i128::from(line.debit_xaf);cr+=i128::from(line.credit_xaf);
    }
    if dr!=cr||dr==0||dr>9_000_000_000_000_000 {return Err(ApiError::bad("Journal must balance and remain within the supported XAF limit"))}
    Ok((dr,cr))
}

pub async fn create(pool:&PgPool,auth:&Auth,input:JournalInput)->Result<Json<JournalResponse>,ApiError> {
    allow(auth,&["finance"])?;
    let (debits,credits)=validate(&input)?;
    let mut tx=pool.begin().await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO gl_periods(entity_id,period_key) VALUES($1,$2) ON CONFLICT(entity_id,period_key) DO NOTHING")
        .bind(auth.entity_id).bind(&input.period_key).execute(&mut *tx).await.map_err(ApiError::db)?;
    let period_locked:bool=sqlx::query_scalar("SELECT is_locked FROM gl_periods WHERE entity_id=$1 AND period_key=$2 FOR UPDATE")
        .bind(auth.entity_id).bind(&input.period_key).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    if period_locked {return Err(ApiError::conflict("Accounting period is locked"))}
    if let Some(source)=input.source_record_id {
        let source_exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM domain_records WHERE id=$1 AND entity_id=$2 AND status='approved')")
            .bind(source).bind(auth.entity_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
        if !source_exists {return Err(ApiError::conflict("Source record is missing or not yet approved for this entity"))}
    }
    let id:Uuid=sqlx::query_scalar("INSERT INTO gl_journals(entity_id,period_key,memo,source_record_id,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id")
        .bind(auth.entity_id).bind(&input.period_key).bind(&input.memo).bind(input.source_record_id).bind(auth.user_id)
        .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    for line in &input.lines {
        let account_id:Option<Uuid>=sqlx::query_scalar("SELECT id FROM gl_accounts WHERE entity_id=$1 AND code=$2 AND active=true")
            .bind(auth.entity_id).bind(&line.account_code).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
        let account_id=account_id.ok_or_else(||ApiError::bad(format!("Unknown account {} for selected entity",line.account_code)))?;
        sqlx::query("INSERT INTO gl_lines(entity_id,journal_id,account_id,debit_xaf,credit_xaf) VALUES($1,$2,$3,$4,$5)")
            .bind(auth.entity_id).bind(id).bind(account_id).bind(line.debit_xaf).bind(line.credit_xaf)
            .execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'journal_created','journal',$3,$4)")
        .bind(auth.entity_id).bind(auth.user_id).bind(id).bind(json!({"period":input.period_key,"debits":debits.to_string(),"credits":credits.to_string()}))
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(JournalResponse{id,status:"draft",debits_xaf:debits,credits_xaf:credits}))
}

pub async fn post(pool:&PgPool,auth:&Auth,id:Uuid)->Result<Json<Value>,ApiError> {
    // Accounting release requires designated business authority, not IT administrator.
    if !["finance","executive"].contains(&auth.role.as_str()) {return Err(ApiError::forbidden())}
    let mut tx=pool.begin().await.map_err(ApiError::db)?;
    let row=sqlx::query("SELECT status,created_by,period_key FROM gl_journals WHERE id=$1 AND entity_id=$2 FOR UPDATE")
        .bind(id).bind(auth.entity_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    let row=row.ok_or_else(ApiError::not_found)?;
    let status:String=row.get("status");
    if status!="draft" {return Err(ApiError::conflict("Journal was already posted"))}
    if row.get::<Uuid,_>("created_by")==auth.user_id {return Err(ApiError::forbidden())}
    // SQL trigger independently rechecks double-entry and locked periods.
    sqlx::query("UPDATE gl_journals SET status='posted',posted_by=$1,posted_at=now() WHERE id=$2 AND entity_id=$3")
        .bind(auth.user_id).bind(id).bind(auth.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'journal_posted','journal',$3,$4)")
        .bind(auth.entity_id).bind(auth.user_id).bind(id).bind(json!({"posted":true})).execute(&mut *tx).await.map_err(ApiError::db)?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(json!({"id":id,"status":"posted"})))
}

pub async fn list(pool:&PgPool,auth:&Auth)->Result<Json<Value>,ApiError> {
    allow(auth,&["finance","auditor","executive","manager"])?;
    let rows=sqlx::query("SELECT id,period_key,memo,status,created_at FROM gl_journals WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
        .bind(auth.entity_id).fetch_all(pool).await.map_err(ApiError::db)?;
    let items:Vec<Value>=rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"period_key":r.get::<String,_>("period_key"),"memo":r.get::<String,_>("memo"),"status":r.get::<String,_>("status"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect();
    Ok(Json(json!({"items":items,"total_in_page":items.len(),"scope":"current_legal_entity"})))
}

#[cfg(test)]
mod tests {
 use super::*;
 fn line(code:&str,d:i64,c:i64)->JournalLineInput {JournalLineInput{account_code:code.into(),debit_xaf:d,credit_xaf:c}}
 fn journal(lines:Vec<JournalLineInput>)->JournalInput{JournalInput{memo:"Test journal".into(),period_key:"2026-10".into(),source_record_id:None,lines}}
 #[test] fn balanced_is_accepted(){ assert!(validate(&journal(vec![line("411",1000,0),line("701",0,1000)])).is_ok()); }
 #[test] fn unbalanced_is_rejected(){ assert!(validate(&journal(vec![line("411",1000,0),line("701",0,999)])).is_err()); }
 #[test] fn double_sided_line_rejected(){ assert!(validate(&journal(vec![line("411",1000,1000),line("701",0,1000)])).is_err()); }
 #[test] fn overlimit_journal_rejected(){assert!(validate(&journal(vec![line("411",9_000_000_000_000_001,0),line("701",0,9_000_000_000_000_001)])).is_err());}
 #[test] fn invalid_period_rejected(){ let mut j=journal(vec![line("411",1000,0),line("701",0,1000)]);j.period_key="2026-99".into(); assert!(validate(&j).is_err()); }
}
