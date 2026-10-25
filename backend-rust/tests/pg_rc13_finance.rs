use blue_line_erp_api::{AppState,auth,finance};
use axum::{extract::{State,Path},http::HeaderMap,Json};
use sqlx::{PgPool,Row};use uuid::Uuid;
async fn identity(db:&PgPool,entity:Uuid,role:&str)->HeaderMap{
 let email=format!("rc13-{}@qa.invalid",Uuid::new_v4());
 let user:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC13 QA','fixture-only') RETURNING id")
 .bind(email).fetch_one(db).await.unwrap();
 sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)").bind(user).bind(entity).bind(role).execute(db).await.unwrap();
 let raw=format!("{}{}",Uuid::new_v4().simple(),Uuid::new_v4().simple());
 sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '2 hours')")
 .bind(auth::hash_token(&raw)).bind(user).bind(entity).execute(db).await.unwrap();
 let mut h=HeaderMap::new();h.insert("authorization",format!("Bearer {raw}").parse().unwrap());h
}
#[tokio::test] async fn rc13_invoice_bank_reconciliation_end_to_end(){
 let url=std::env::var("TEST_DATABASE_URL").expect("Required disposable database URL");assert!(!url.contains("prod"));
 let p=PgPool::connect(&url).await.unwrap();
 let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
 sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&p).await.unwrap();
 let e:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES('RC13 Finance One') RETURNING id").fetch_one(&p).await.unwrap();
 let other:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES('RC13 Finance Two') RETURNING id").fetch_one(&p).await.unwrap();
 let op=identity(&p,e,"operator").await;let fi=identity(&p,e,"finance").await;let foreign=identity(&p,other,"finance").await;
 let st=AppState{pool:p.clone()};
 for (role,code) in [("ar","411"),("revenue","701"),("bank","521")]{
  sqlx::query("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3)").bind(e).bind(code).bind(role).execute(&p).await.unwrap();
  finance::map_account(State(st.clone()),fi.clone(),Json(finance::MappingInput{role:role.into(),account_code:code.into()})).await.unwrap();
 }
 let (_,Json(created))=finance::create_invoice(State(st.clone()),op.clone(),Json(finance::InvoiceInput{
 customer:"Pilot Buyer".into(),description:"RC13 test transaction".into(),external_ref:format!("QA-{}",Uuid::new_v4()),total_xaf:15000,period_key:"2026-10".into()
 })).await.unwrap();let id=Uuid::parse_str(created["id"].as_str().unwrap()).unwrap();
 assert!(finance::issue_invoice(State(st.clone()),foreign.clone(),Path(id)).await.is_err());
 let Json(issued)=finance::issue_invoice(State(st.clone()),fi.clone(),Path(id)).await.unwrap();assert_eq!(issued["posted"],false);
 let (_,Json(receipt))=finance::create_receipt(State(st.clone()),op.clone(),Json(finance::ReceiptInput{invoice_id:id,amount_xaf:9000,payment_ref:format!("PAY-{}",Uuid::new_v4())})).await.unwrap();
 let rid=Uuid::parse_str(receipt["id"].as_str().unwrap()).unwrap();
 let (_,Json(bank))=finance::create_bank_line(State(st.clone()),fi.clone(),Json(finance::BankLineInput{bank_reference:format!("BANK-{}",Uuid::new_v4()),amount_xaf:9000})).await.unwrap();
 let bid=Uuid::parse_str(bank["id"].as_str().unwrap()).unwrap();
 let Json(matched)=finance::match_receipt(State(st.clone()),fi.clone(),Path(rid),Json(finance::MatchInput{bank_line_id:bid})).await.unwrap();
 assert_eq!(matched["invoice_paid_xaf"],9000);
 assert!(finance::match_receipt(State(st.clone()),fi.clone(),Path(rid),Json(finance::MatchInput{bank_line_id:bid})).await.is_err());
 let bal:(i64,String)=sqlx::query_as("SELECT paid_xaf,status FROM rc13_invoices WHERE entity_id=$1 AND id=$2").bind(e).bind(id).fetch_one(&p).await.unwrap();
 assert_eq!(bal,(9000,"partial".into()));
 let journal_count:i64=sqlx::query_scalar("SELECT COUNT(*) FROM gl_journals WHERE entity_id=$1 AND memo LIKE 'RC13%' ").bind(e).fetch_one(&p).await.unwrap();assert!(journal_count>=2);
}
