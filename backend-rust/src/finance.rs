//! RC13 bounded XAF invoicing and bank evidence. Draft GL only: no tax/fiscal certificate.
use axum::{extract::{Path,State},http::{HeaderMap,StatusCode},Json};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use sqlx::{PgPool,Postgres,Transaction,Row};
use uuid::Uuid;
use crate::{AppState,auth::{self,Auth},error::ApiError,trade};

#[derive(Deserialize,Serialize)] #[serde(deny_unknown_fields)]
pub struct InvoiceInput {pub customer:String,pub description:String,pub external_ref:String,pub total_xaf:i64,pub period_key:String}
#[derive(Deserialize)] #[serde(deny_unknown_fields)]
pub struct MappingInput {pub role:String,pub account_code:String}
#[derive(Deserialize)] #[serde(deny_unknown_fields)]
pub struct ReceiptInput {pub invoice_id:Uuid,pub amount_xaf:i64,pub payment_ref:String}
#[derive(Deserialize)] #[serde(deny_unknown_fields)]
pub struct BankLineInput {pub bank_reference:String,pub amount_xaf:i64}
#[derive(Deserialize)] #[serde(deny_unknown_fields)]
pub struct MatchInput {pub bank_line_id:Uuid}
fn only(a:&Auth,role:&str)->Result<(),ApiError>{if a.role==role {Ok(())}else{Err(ApiError::forbidden())}}
fn valid_ref(s:&str,max:usize)->bool{(4..=max).contains(&s.len()) && !s.trim().is_empty()}
fn valid_amount(n:i64)->bool{(1..=9_000_000_000_000_000).contains(&n)}
async fn log(tx:&mut Transaction<'_,Postgres>,a:&Auth,event:&str,kind:&str,id:Uuid)->Result<(),ApiError>{
 sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id) VALUES($1,$2,$3,$4,$5)")
 .bind(a.entity_id).bind(a.user_id).bind(event).bind(kind).bind(id).execute(&mut **tx).await.map_err(ApiError::db)?;Ok(())
}
async fn account(tx:&mut Transaction<'_,Postgres>,entity:Uuid,role:&str)->Result<Uuid,ApiError>{
 sqlx::query_scalar("SELECT account_id FROM rc13_accounts WHERE entity_id=$1 AND role=$2")
 .bind(entity).bind(role).fetch_optional(&mut **tx).await.map_err(ApiError::db)?
 .ok_or_else(||ApiError::conflict(format!("Missing explicit GL mapping: {role}")))
}
async fn open_period(tx:&mut Transaction<'_,Postgres>,entity:Uuid,key:&str)->Result<(),ApiError>{
 trade::validate_period(key)?;
 sqlx::query("INSERT INTO gl_periods(entity_id,period_key) VALUES($1,$2) ON CONFLICT DO NOTHING")
  .bind(entity).bind(key).execute(&mut **tx).await.map_err(ApiError::db)?;
 let locked:bool=sqlx::query_scalar("SELECT is_locked FROM gl_periods WHERE entity_id=$1 AND period_key=$2 FOR UPDATE")
 .bind(entity).bind(key).fetch_one(&mut **tx).await.map_err(ApiError::db)?;
 if locked {return Err(ApiError::conflict("Accounting period locked"))}Ok(())
}
async fn draft_two_line(tx:&mut Transaction<'_,Postgres>,a:&Auth,period:&str,memo:&str,
 debit:Uuid,credit:Uuid,amount:i64)->Result<Uuid,ApiError>{
 let id:Uuid=sqlx::query_scalar("INSERT INTO gl_journals(entity_id,period_key,memo,created_by) VALUES($1,$2,$3,$4) RETURNING id")
 .bind(a.entity_id).bind(period).bind(memo).bind(a.user_id).fetch_one(&mut **tx).await.map_err(ApiError::db)?;
 for (acc,dr,cr) in [(debit,amount,0_i64),(credit,0_i64,amount)] {
 sqlx::query("INSERT INTO gl_lines(entity_id,journal_id,account_id,debit_xaf,credit_xaf) VALUES($1,$2,$3,$4,$5)")
 .bind(a.entity_id).bind(id).bind(acc).bind(dr).bind(cr).execute(&mut **tx).await.map_err(ApiError::db)?;
 }Ok(id)
}
pub async fn map_account(State(s):State<AppState>,h:HeaderMap,Json(p):Json<MappingInput>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"finance")?;
 if !["ar","revenue","bank"].contains(&p.role.as_str()){return Err(ApiError::bad("Invalid finance account role"))}
 let id:Uuid=sqlx::query_scalar("SELECT id FROM gl_accounts WHERE entity_id=$1 AND code=$2 AND active=true")
 .bind(a.entity_id).bind(&p.account_code).fetch_optional(&s.pool).await.map_err(ApiError::db)?
 .ok_or_else(||ApiError::bad("Account code is not in the selected entity"))?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 sqlx::query("INSERT INTO rc13_accounts(entity_id,role,account_id) VALUES($1,$2,$3) ON CONFLICT(entity_id,role) DO UPDATE SET account_id=EXCLUDED.account_id")
 .bind(a.entity_id).bind(&p.role).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"finance_account_mapping","gl_account",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"role":p.role,"account_code":p.account_code,"scope":"entity"})))
}
pub async fn invoices(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,customer,description,external_ref,total_xaf,paid_xaf,period_key,status,journal_id FROM rc13_invoices WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"scope":"current_legal_entity","items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"customer":r.get::<String,_>("customer"),"description":r.get::<String,_>("description"),"external_ref":r.get::<String,_>("external_ref"),"total_xaf":r.get::<i64,_>("total_xaf"),"paid_xaf":r.get::<i64,_>("paid_xaf"),"period_key":r.get::<String,_>("period_key"),"status":r.get::<String,_>("status"),"journal_draft_id":r.get::<Option<Uuid>,_>("journal_id")})).collect::<Vec<_>>()})))
}
pub async fn create_invoice(State(s):State<AppState>,h:HeaderMap,Json(p):Json<InvoiceInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"operator")?;
 if p.customer.trim().len()<2||p.customer.len()>240||!valid_ref(&p.description,1000)||!valid_ref(&p.external_ref,100)||!valid_amount(p.total_xaf){return Err(ApiError::bad("Invoice fields invalid"))}
 trade::validate_period(&p.period_key)?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc13_invoices(entity_id,customer,description,external_ref,total_xaf,period_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id")
 .bind(a.entity_id).bind(&p.customer).bind(&p.description).bind(&p.external_ref).bind(p.total_xaf).bind(&p.period_key).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"invoice_created","rc13_invoice",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"draft","entity_id":a.entity_id}))))
}
pub async fn issue_invoice(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"finance")?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let r=sqlx::query("SELECT created_by,status,total_xaf,period_key FROM rc13_invoices WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if r.get::<String,_>("status")!="draft"{return Err(ApiError::conflict("Invoice not draft"))}
 if r.get::<Uuid,_>("created_by")==a.user_id{return Err(ApiError::forbidden())}
 let period:String=r.get("period_key");let total:i64=r.get("total_xaf");
 open_period(&mut tx,a.entity_id,&period).await?;
 let debit=account(&mut tx,a.entity_id,"ar").await?;let credit=account(&mut tx,a.entity_id,"revenue").await?;
 let journal=draft_two_line(&mut tx,&a,&period,&format!("RC13 invoice {id} - unposted demo GL"),debit,credit,total).await?;
 sqlx::query("UPDATE rc13_invoices SET status='issued',issued_by=$1,issued_at=now(),journal_id=$2 WHERE id=$3 AND entity_id=$4")
 .bind(a.user_id).bind(journal).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"invoice_issued","rc13_invoice",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"id":id,"status":"issued","journal_draft_id":journal,"posted":false})))
}
pub async fn receipts(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,invoice_id,amount_xaf,payment_ref,status,bank_line_id,journal_id FROM rc13_receipts WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"invoice_id":r.get::<Uuid,_>("invoice_id"),"amount_xaf":r.get::<i64,_>("amount_xaf"),"payment_ref":r.get::<String,_>("payment_ref"),"status":r.get::<String,_>("status"),"bank_line_id":r.get::<Option<Uuid>,_>("bank_line_id"),"journal_draft_id":r.get::<Option<Uuid>,_>("journal_id")})).collect::<Vec<_>>()})))
}
pub async fn create_receipt(State(s):State<AppState>,h:HeaderMap,Json(p):Json<ReceiptInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"operator")?;
 if !valid_amount(p.amount_xaf)||!valid_ref(&p.payment_ref,120){return Err(ApiError::bad("Invalid receipt"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let r=sqlx::query("SELECT status,total_xaf,paid_xaf FROM rc13_invoices WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(p.invoice_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if r.get::<String,_>("status")=="draft"||r.get::<String,_>("status")=="paid"{return Err(ApiError::conflict("Invoice cannot receive payment"))}
 let due=r.get::<i64,_>("total_xaf")-r.get::<i64,_>("paid_xaf");
 let pending:i64=sqlx::query_scalar("SELECT COALESCE(SUM(amount_xaf),0)::bigint FROM rc13_receipts WHERE entity_id=$1 AND invoice_id=$2 AND status='pending'")
 .bind(a.entity_id).bind(p.invoice_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 if p.amount_xaf>due-pending{return Err(ApiError::conflict("Receipt exceeds unpaid and pending amount"))}
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc13_receipts(entity_id,invoice_id,amount_xaf,payment_ref,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id")
 .bind(a.entity_id).bind(p.invoice_id).bind(p.amount_xaf).bind(&p.payment_ref).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"receipt_claim_recorded","rc13_receipt",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"pending_bank_match","reduces_ar":false}))))
}
pub async fn create_bank_line(State(s):State<AppState>,h:HeaderMap,Json(p):Json<BankLineInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"finance")?;
 if !valid_amount(p.amount_xaf)||!valid_ref(&p.bank_reference,120){return Err(ApiError::bad("Invalid bank line"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc13_bank_lines(entity_id,bank_reference,amount_xaf,created_by) VALUES($1,$2,$3,$4) RETURNING id")
 .bind(a.entity_id).bind(&p.bank_reference).bind(p.amount_xaf).bind(a.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"bank_line_imported","rc13_bank_line",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"unmatched","note":"manual bank evidence; not bank API verification"}))))
}
pub async fn bank_lines(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,bank_reference,amount_xaf,matched_receipt_id FROM rc13_bank_lines WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"reference":r.get::<String,_>("bank_reference"),"amount_xaf":r.get::<i64,_>("amount_xaf"),"matched_receipt_id":r.get::<Option<Uuid>,_>("matched_receipt_id")})).collect::<Vec<_>>()})))
}
pub async fn match_receipt(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<MatchInput>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,"finance")?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 // lock an entity-wide reconciliation lane to avoid invoice/receipt races
 sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))").bind(format!("rc13-bank:{}",a.entity_id)).execute(&mut *tx).await.map_err(ApiError::db)?;
 let rec=sqlx::query("SELECT invoice_id,amount_xaf,created_by,status FROM rc13_receipts WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if rec.get::<String,_>("status")!="pending" {return Err(ApiError::conflict("Receipt not pending"))}
 if rec.get::<Uuid,_>("created_by")==a.user_id{return Err(ApiError::forbidden())}
 let bank=sqlx::query("SELECT amount_xaf,matched_receipt_id FROM rc13_bank_lines WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(p.bank_line_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 let amount:i64=rec.get("amount_xaf");let invoice:Uuid=rec.get("invoice_id");
 if bank.get::<i64,_>("amount_xaf")!=amount || bank.get::<Option<Uuid>,_>("matched_receipt_id").is_some(){return Err(ApiError::conflict("Bank line unmatched amount or already used"))}
 let inv=sqlx::query("SELECT total_xaf,paid_xaf,period_key,status FROM rc13_invoices WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(invoice).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 if inv.get::<String,_>("status")=="draft"||inv.get::<i64,_>("paid_xaf")+amount>inv.get::<i64,_>("total_xaf"){return Err(ApiError::conflict("Invoice payment exceeds balance"))}
 let period:String=inv.get("period_key");open_period(&mut tx,a.entity_id,&period).await?;
 let dr=account(&mut tx,a.entity_id,"bank").await?;let cr=account(&mut tx,a.entity_id,"ar").await?;
 let journal=draft_two_line(&mut tx,&a,&period,&format!("RC13 bank receipt {id} - unposted demo GL"),dr,cr,amount).await?;
 sqlx::query("UPDATE rc13_receipts SET status='matched',matched_by=$1,bank_line_id=$2,journal_id=$3,matched_at=now() WHERE id=$4 AND entity_id=$5")
 .bind(a.user_id).bind(p.bank_line_id).bind(journal).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 sqlx::query("UPDATE rc13_bank_lines SET matched_receipt_id=$1 WHERE id=$2 AND entity_id=$3")
 .bind(id).bind(p.bank_line_id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 let new_paid=inv.get::<i64,_>("paid_xaf")+amount;
 sqlx::query("UPDATE rc13_invoices SET paid_xaf=$1,status=$2 WHERE entity_id=$3 AND id=$4")
 .bind(new_paid).bind(if new_paid==inv.get::<i64,_>("total_xaf"){"paid"}else{"partial"}).bind(a.entity_id).bind(invoice)
 .execute(&mut *tx).await.map_err(ApiError::db)?;
 log(&mut tx,&a,"bank_receipt_matched","rc13_receipt",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"id":id,"invoice_id":invoice,"matched":true,"received_xaf":amount,"invoice_paid_xaf":new_paid,"journal_draft_id":journal,"posted":false})))
}
