//! RC16 real PG integration: must run only against disposable PostgreSQL 16.
use blue_line_erp_api::{AppState,auth,hr::{self,EmployeeInput,AttendanceInput,LeaveInput,LeaveReview,PayrollInput}};
use axum::{extract::{State,Path},http::HeaderMap,Json};
use chrono::NaiveDate;
use sqlx::PgPool;use uuid::Uuid;

async fn identity(db:&PgPool,entity:Uuid,role:&str)->(Uuid,HeaderMap){
 let user:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC16 Test','fixture-not-login') RETURNING id")
 .bind(format!("rc16-{}@test.invalid",Uuid::new_v4())).fetch_one(db).await.unwrap();
 sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)")
 .bind(user).bind(entity).bind(role).execute(db).await.unwrap();
 let secret=format!("{}{}",Uuid::new_v4().simple(),Uuid::new_v4().simple());
 sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
 .bind(auth::hash_token(&secret)).bind(user).bind(entity).execute(db).await.unwrap();
 let mut headers=HeaderMap::new();headers.insert("authorization",format!("Bearer {secret}").parse().unwrap());(user,headers)
}
#[tokio::test]async fn hr_role_isolation_independent_review_and_base_salary_forecast(){
 let url=std::env::var("TEST_DATABASE_URL").expect("Disposable TEST_DATABASE_URL required");
 assert!(!url.to_ascii_lowercase().contains("prod"),"Never execute integration test against production");
 let db=PgPool::connect(&url).await.unwrap();
 let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
 sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&db).await.unwrap();
 let version:i64=sqlx::query_scalar("SELECT max(version) FROM _sqlx_migrations WHERE success").fetch_one(&db).await.unwrap();assert_eq!(version,12);
 let e:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
 .bind(format!("HR-entity-{}",Uuid::new_v4())).fetch_one(&db).await.unwrap();
 let foreign:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
 .bind(format!("Foreign HR-{}",Uuid::new_v4())).fetch_one(&db).await.unwrap();
 let (_,hr_role)=identity(&db,e,"hr").await;
 let (_,hr_manager)=identity(&db,e,"hr_manager").await;
 let (_,finance)=identity(&db,e,"finance").await;
 let (_,operator)=identity(&db,e,"operator").await;
 let (_,foreign_manager)=identity(&db,foreign,"hr_manager").await;
 let state=AppState{pool:db.clone()};
 assert!(hr::employees(State(state.clone()),operator.clone()).await.is_err(),"Operator must not view wages");
 let (_,Json(emp))=hr::add_employee(State(state.clone()),hr_role.clone(),Json(EmployeeInput{
 staff_code:format!("H-{}",Uuid::new_v4().simple()),display_name:"Pilot employee".into(),monthly_base_xaf:220_000
 })).await.unwrap();
 let eid=Uuid::parse_str(emp["id"].as_str().unwrap()).unwrap();
 let date=NaiveDate::from_ymd_opt(2026,10,25).unwrap();
 let (_,Json(att))=hr::log_attendance(State(state.clone()),hr_role.clone(),Json(AttendanceInput{employee_id:eid,work_day:date,minutes_worked:480})).await.unwrap();
 let aid=Uuid::parse_str(att["id"].as_str().unwrap()).unwrap();
 assert!(hr::accept_attendance(State(state.clone()),foreign_manager.clone(),Path(aid)).await.is_err());
 assert!(hr::accept_attendance(State(state.clone()),hr_role.clone(),Path(aid)).await.is_err());
 hr::accept_attendance(State(state.clone()),hr_manager.clone(),Path(aid)).await.unwrap();
 assert!(hr::accept_attendance(State(state.clone()),hr_manager.clone(),Path(aid)).await.is_err());
 let (_,Json(leave))=hr::submit_leave(State(state.clone()),hr_role.clone(),Json(LeaveInput{employee_id:eid,starts_on:date,ends_on:date,reason:"Annual leave application".into()})).await.unwrap();
 let leave_id=Uuid::parse_str(leave["id"].as_str().unwrap()).unwrap();
 hr::review_leave(State(state.clone()),hr_manager.clone(),Path(leave_id),Json(LeaveReview{action:"approve".into()})).await.unwrap();
 let (_,Json(run))=hr::create_payroll(State(state.clone()),hr_role.clone(),Json(PayrollInput{period_key:"2026-10".into()})).await.unwrap();
 assert_eq!(run["tax_calculated"],false);assert_eq!(run["disbursement"],false);
 let rid=Uuid::parse_str(run["id"].as_str().unwrap()).unwrap();
 assert!(hr::payroll_verify(State(state.clone()),finance.clone(),Path(rid)).await.is_err());
 hr::payroll_review(State(state.clone()),hr_manager.clone(),Path(rid)).await.unwrap();
 hr::payroll_verify(State(state.clone()),finance.clone(),Path(rid)).await.unwrap();
 let Json(rows)=hr::payroll(State(state.clone()),finance.clone()).await.unwrap();
 assert_eq!(rows["items"][0]["base_forecast_xaf"].as_i64(),Some(220_000));
 assert_eq!(rows["bank_payment_executed"],false);
 assert!(hr::payroll(State(state.clone()),operator.clone()).await.is_err());
 let Json(bridge)=hr::bridge(State(state.clone()),finance.clone()).await.unwrap();
 assert_eq!(bridge["employee_headcount"],1);assert_eq!(bridge["financial_consolidated"],false);
}
