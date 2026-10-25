//! RC16 bounded HR operations. Payroll is a salary-budget preview, NOT Cameroon statutory payroll.
use axum::{extract::{Path,State},http::{HeaderMap,StatusCode},Json};
use chrono::NaiveDate;
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use sqlx::{PgPool,Postgres,Transaction,Row};
use uuid::Uuid;
use crate::{AppState,auth::{self,Auth},error::ApiError,trade};

#[derive(Deserialize,Serialize)] #[serde(deny_unknown_fields)]
pub struct EmployeeInput {pub staff_code:String,pub display_name:String,pub monthly_base_xaf:i64}
#[derive(Deserialize)] #[serde(deny_unknown_fields)]
pub struct AttendanceInput {pub employee_id:Uuid,pub work_day:NaiveDate,pub minutes_worked:i32}
#[derive(Deserialize)] #[serde(deny_unknown_fields)]
pub struct LeaveInput {pub employee_id:Uuid,pub starts_on:NaiveDate,pub ends_on:NaiveDate,pub reason:String}
#[derive(Deserialize)] #[serde(deny_unknown_fields)]
pub struct LeaveReview {pub action:String}
#[derive(Deserialize)] #[serde(deny_unknown_fields)]
pub struct PayrollInput {pub period_key:String}
fn only(a:&Auth,roles:&[&str])->Result<(),ApiError>{if roles.contains(&a.role.as_str()){Ok(())}else{Err(ApiError::forbidden())}}
async fn audit(tx:&mut Transaction<'_,Postgres>,a:&Auth,event:&str,kind:&str,id:Uuid)->Result<(),ApiError>{
 sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id) VALUES($1,$2,$3,$4,$5)")
 .bind(a.entity_id).bind(a.user_id).bind(event).bind(kind).bind(id).execute(&mut **tx).await.map_err(ApiError::db)?;Ok(())
}
fn validate_staff(c:&str,n:&str,s:i64)->Result<(),ApiError>{
 if c.len()<3||c.len()>40||!c.bytes().all(|x|x.is_ascii_alphanumeric()||x==b'-'||x==b'_')||
 n.trim().len()<2||n.len()>160||!(1..=100_000_000_000).contains(&s){return Err(ApiError::bad("Invalid employee input"))}Ok(())
}
pub async fn employees(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr","hr_manager","finance","auditor"])?;
 let rows=sqlx::query("SELECT id,staff_code,display_name,monthly_base_xaf,active FROM rc16_employees WHERE entity_id=$1 ORDER BY staff_code LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 let financial=matches!(a.role.as_str(),"hr"|"hr_manager"|"finance");
 Ok(Json(json!({"scope":"current_legal_entity","items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"staff_code":r.get::<String,_>("staff_code"),"display_name":r.get::<String,_>("display_name"),"monthly_base_xaf":if financial{Some(r.get::<i64,_>("monthly_base_xaf"))}else{None},"active":r.get::<bool,_>("active")})).collect::<Vec<_>>(),"compensation_visible":financial})))
}
pub async fn add_employee(State(s):State<AppState>,h:HeaderMap,Json(p):Json<EmployeeInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr"])?;validate_staff(&p.staff_code,&p.display_name,p.monthly_base_xaf)?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc16_employees(entity_id,staff_code,display_name,monthly_base_xaf,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id")
 .bind(a.entity_id).bind(&p.staff_code).bind(&p.display_name).bind(p.monthly_base_xaf).bind(a.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"hr_employee_created","rc16_employee",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"created","payroll_certified":false}))))
}
pub async fn attendance(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr","hr_manager","auditor"])?;
 let rows=sqlx::query("SELECT id,employee_id,work_day,minutes_worked,status FROM rc16_attendance WHERE entity_id=$1 ORDER BY work_day DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"employee_id":r.get::<Uuid,_>("employee_id"),"work_day":r.get::<NaiveDate,_>("work_day"),"minutes_worked":r.get::<i32,_>("minutes_worked"),"status":r.get::<String,_>("status")})).collect::<Vec<_>>()})))
}
pub async fn log_attendance(State(s):State<AppState>,h:HeaderMap,Json(p):Json<AttendanceInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr"])?;
 if !(0..=1440).contains(&p.minutes_worked){return Err(ApiError::bad("Invalid minutes"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc16_attendance(entity_id,employee_id,work_day,minutes_worked,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id")
 .bind(a.entity_id).bind(p.employee_id).bind(p.work_day).bind(p.minutes_worked).bind(a.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"hr_attendance_submitted","rc16_attendance",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"submitted"}))))
}
pub async fn accept_attendance(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr_manager"])?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let done=sqlx::query("UPDATE rc16_attendance SET status='accepted',accepted_by=$1,accepted_at=now() WHERE id=$2 AND entity_id=$3 AND status='submitted' AND created_by<>$1")
 .bind(a.user_id).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 if done.rows_affected()!=1{return Err(ApiError::conflict("Attendance not pending, unavailable, or self-approved"))}
 audit(&mut tx,&a,"hr_attendance_accepted","rc16_attendance",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"id":id,"status":"accepted"})))
}
pub async fn leaves(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr","hr_manager","auditor"])?;
 let rows=sqlx::query("SELECT id,employee_id,starts_on,ends_on,reason,status FROM rc16_leave_requests WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"employee_id":r.get::<Uuid,_>("employee_id"),"starts_on":r.get::<NaiveDate,_>("starts_on"),"ends_on":r.get::<NaiveDate,_>("ends_on"),"reason":r.get::<String,_>("reason"),"status":r.get::<String,_>("status")})).collect::<Vec<_>>()})))
}
pub async fn submit_leave(State(s):State<AppState>,h:HeaderMap,Json(p):Json<LeaveInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr"])?;
 if p.ends_on<p.starts_on||p.ends_on.signed_duration_since(p.starts_on).num_days()>90||p.reason.trim().len()<5||p.reason.len()>500 {return Err(ApiError::bad("Invalid leave period or reason"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc16_leave_requests(entity_id,employee_id,starts_on,ends_on,reason,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id")
 .bind(a.entity_id).bind(p.employee_id).bind(p.starts_on).bind(p.ends_on).bind(&p.reason).bind(a.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"hr_leave_submitted","rc16_leave",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"submitted"}))))
}
pub async fn review_leave(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<LeaveReview>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr_manager"])?;
 if !["approve","reject"].contains(&p.action.as_str()){return Err(ApiError::bad("Use approve or reject"))}
 let status=if p.action=="approve"{"approved"}else{"rejected"};
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let done=sqlx::query("UPDATE rc16_leave_requests SET status=$1,reviewed_by=$2,reviewed_at=now() WHERE id=$3 AND entity_id=$4 AND status='submitted' AND created_by<>$2")
 .bind(status).bind(a.user_id).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 if done.rows_affected()!=1{return Err(ApiError::conflict("Leave not pending, unavailable, or self-approved"))}
 audit(&mut tx,&a,"hr_leave_reviewed","rc16_leave",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"id":id,"status":status,"statutory_pay_treatment":"not_computed"})))
}
pub async fn payroll(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr","hr_manager","finance","auditor"])?;
 let rows=sqlx::query("SELECT r.id,r.period_key,r.status,count(l.id)::bigint AS employees,COALESCE(sum(l.monthly_base_xaf),0)::bigint AS base_total_xaf FROM rc16_payroll_runs r LEFT JOIN rc16_payroll_lines l ON l.run_id=r.id AND l.entity_id=r.entity_id WHERE r.entity_id=$1 GROUP BY r.id ORDER BY r.period_key DESC LIMIT 36")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 let totals=matches!(a.role.as_str(),"hr"|"hr_manager"|"finance");
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"period_key":r.get::<String,_>("period_key"),"status":r.get::<String,_>("status"),"employee_count":r.get::<i64,_>("employees"),"base_forecast_xaf":if totals{Some(r.get::<i64,_>("base_total_xaf"))}else{None}})).collect::<Vec<_>>(),"gross_to_net_computed":false,"tax_localization_certified":false,"bank_payment_executed":false})))
}
pub async fn create_payroll(State(s):State<AppState>,h:HeaderMap,Json(p):Json<PayrollInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr"])?;trade::validate_period(&p.period_key)?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc16_payroll_runs(entity_id,period_key,created_by) VALUES($1,$2,$3) RETURNING id")
 .bind(a.entity_id).bind(&p.period_key).bind(a.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 let n=sqlx::query("INSERT INTO rc16_payroll_lines(entity_id,run_id,employee_id,monthly_base_xaf) SELECT entity_id,$1,id,monthly_base_xaf FROM rc16_employees WHERE entity_id=$2 AND active=true")
 .bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 if n.rows_affected()==0{return Err(ApiError::conflict("No active employees for payroll preview"))}
 audit(&mut tx,&a,"hr_payroll_preview_created","rc16_payroll_run",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"draft","employees":n.rows_affected(),"tax_calculated":false,"net_pay_calculated":false,"disbursement":false}))))
}
pub async fn payroll_review(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["hr_manager"])?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let done=sqlx::query("UPDATE rc16_payroll_runs SET status='manager_reviewed',manager_by=$1,reviewed_at=now() WHERE id=$2 AND entity_id=$3 AND status='draft' AND created_by<>$1")
 .bind(a.user_id).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 if done.rows_affected()!=1{return Err(ApiError::conflict("Preview unavailable, not draft, or self-reviewed"))}
 audit(&mut tx,&a,"hr_payroll_manager_review","rc16_payroll_run",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"id":id,"status":"manager_reviewed","payroll_paid":false})))
}
pub async fn payroll_verify(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["finance"])?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let done=sqlx::query("UPDATE rc16_payroll_runs SET status='finance_verified',finance_by=$1,verified_at=now() WHERE id=$2 AND entity_id=$3 AND status='manager_reviewed' AND created_by<>$1 AND manager_by<>$1")
 .bind(a.user_id).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 if done.rows_affected()!=1{return Err(ApiError::conflict("Preview not manager-reviewed or reviewer not independent"))}
 audit(&mut tx,&a,"hr_payroll_finance_verified","rc16_payroll_run",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"id":id,"status":"finance_verified","statutory_payroll_completed":false,"gl_posted":false,"payment_sent":false})))
}
/// Role-filtered counts across actual tables. Not a consolidated financial statement.
pub async fn bridge(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["executive","finance","auditor","hr_manager"])?;
 let row=sqlx::query("SELECT (SELECT count(*) FROM trade_purchase_orders WHERE entity_id=$1) AS purchases,(SELECT count(*) FROM trade_sales_orders WHERE entity_id=$1) AS sales,(SELECT count(*) FROM rc13_invoices WHERE entity_id=$1) AS invoices,(SELECT count(*) FROM rc14_reservations WHERE entity_id=$1) AS reservations,(SELECT count(*) FROM rc15_projects WHERE entity_id=$1) AS projects,(SELECT count(*) FROM rc15_batches WHERE entity_id=$1) AS batches,(SELECT count(*) FROM rc16_employees WHERE entity_id=$1) AS employees")
 .bind(a.entity_id).fetch_one(&s.pool).await.map_err(ApiError::db)?;
 let mut result=json!({"entity_id":a.entity_id,"scope":"single_legal_entity","source":"postgresql_live_counts","financial_consolidated":false,"fiscal_reporting_certified":false,
 "purchasing_orders":row.get::<i64,_>("purchases"),"sales_orders":row.get::<i64,_>("sales"),"invoices":row.get::<i64,_>("invoices"),"reservations":row.get::<i64,_>("reservations"),"construction_projects":row.get::<i64,_>("projects"),"manufacturing_batches":row.get::<i64,_>("batches")});
 if matches!(a.role.as_str(),"hr_manager"|"finance"|"auditor"|"executive") {result["employee_headcount"]=json!(row.get::<i64,_>("employees"));}
 Ok(Json(result))
}
