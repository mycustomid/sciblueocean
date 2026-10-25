// RC7: uses a disposable PostgreSQL database provided by CI, not real customer records.
use axum::{extract::{Path,State},http::HeaderMap,Json};
use blue_line_erp_api::{AppState,auth::{self,Auth},evidence,workflow::{self,TransitionRequest},journal::{self,JournalInput,JournalLineInput}};
use sqlx::PgPool;
use uuid::Uuid;

async fn actor(pool:&PgPool,entity:Uuid,role:&str)->Auth{
    let id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC7 QA Actor','TEST_PASSWORD_DISABLED') RETURNING id")
        .bind(format!("rc7-{}@example.test",Uuid::new_v4())).fetch_one(pool).await.unwrap();
    sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)")
        .bind(id).bind(entity).bind(role).execute(pool).await.unwrap();
    Auth{user_id:id,entity_id:entity,role:role.into()}
}
async fn api_headers(pool:&PgPool,a:&Auth)->HeaderMap{
    let raw=format!("test-session-valid-token-that-is-long-enough-{}",Uuid::new_v4());
    sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
        .bind(auth::hash_token(&raw)).bind(a.user_id).bind(a.entity_id).execute(pool).await.unwrap();
    let mut headers=HeaderMap::new();
    headers.insert(axum::http::header::AUTHORIZATION,format!("Bearer {raw}").parse().unwrap());
    headers
}
#[tokio::test]
async fn verify_approval_evidence_and_cross_entity_access(){
    let url=match std::env::var("TEST_DATABASE_URL"){Ok(s)=>s,Err(_)=>{eprintln!("SKIP: set TEST_DATABASE_URL to execute PostgreSQL tests");return}};
    let pool=PgPool::connect(&url).await.unwrap();
    let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&pool).await.unwrap();
    let entity_a:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES('RC7 Verification A') RETURNING id").fetch_one(&pool).await.unwrap();
    let entity_b:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES('RC7 Verification B') RETURNING id").fetch_one(&pool).await.unwrap();
    let operator=actor(&pool,entity_a,"operator").await;
    let manager=actor(&pool,entity_a,"manager").await;
    let finance=actor(&pool,entity_a,"finance").await;
    let exec1=actor(&pool,entity_a,"executive").await;
    let exec2=actor(&pool,entity_a,"executive").await;
    let admin=actor(&pool,entity_a,"group_admin").await;
    let outsider=actor(&pool,entity_b,"auditor").await;
    // DB compound FK must reject cross-entity creators even for SQL clients.
    let forged=sqlx::query("INSERT INTO domain_records(entity_id,module_key,counterparty,description,amount_xaf,created_by) VALUES($1,'sugar','QA','Forged creator',100,$2)")
        .bind(entity_a).bind(outsider.user_id).execute(&pool).await;
    assert!(forged.is_err());
    let rec:Uuid=sqlx::query_scalar("INSERT INTO domain_records(entity_id,module_key,counterparty,description,amount_xaf,created_by) VALUES($1,'sugar','RC7 Supplier','RC7 batch proof',2000,$2) RETURNING id")
        .bind(entity_a).bind(operator.user_id).fetch_one(&pool).await.unwrap();
    let change=|action:&str|TransitionRequest{action:action.to_string(),note:Some("RC7 evidence".into())};
    workflow::transition(&pool,&operator,rec,change("submit")).await.unwrap();
    // Non-business admin is forbidden even though RC6 generic `allow()` grants admin access elsewhere.
    assert!(workflow::transition(&pool,&admin,rec,change("approve_manager")).await.is_err());
    workflow::transition(&pool,&exec1,rec,change("approve_manager")).await.unwrap();
    workflow::transition(&pool,&finance,rec,change("approve_finance")).await.unwrap();
    // exec1 is eligible for final role, but already approved manager stage; distinct reviewer required.
    assert!(workflow::transition(&pool,&exec1,rec,change("approve_final")).await.is_err());
    workflow::transition(&pool,&exec2,rec,change("approve_final")).await.unwrap();
    let h1=api_headers(&pool,&exec2).await;
    let Json(details)=evidence::record_detail(State(AppState{pool:pool.clone()}),h1,Path(rec)).await.unwrap();
    assert_eq!(details["status"],"approved");
    assert_eq!(details["workflow_history"].as_array().unwrap().len(),4);
    let h2=api_headers(&pool,&outsider).await;
    assert!(evidence::record_detail(State(AppState{pool:pool.clone()}),h2,Path(rec)).await.is_err());
    for(code,label)in[("411","RC7 AR"),("701","RC7 Revenue")]{
        sqlx::query("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3)")
            .bind(entity_a).bind(code).bind(label).execute(&pool).await.unwrap();
    }
    let draft=journal::create(&pool,&finance,JournalInput{period_key:"2026-10".into(),memo:"RC7 balanced test posting".into(),source_record_id:Some(rec),lines:vec![
        JournalLineInput{account_code:"411".into(),debit_xaf:2000,credit_xaf:0},
        JournalLineInput{account_code:"701".into(),debit_xaf:0,credit_xaf:2000}
    ]}).await.unwrap().0;
    assert!(journal::post(&pool,&admin,draft.id).await.is_err());
    journal::post(&pool,&exec2,draft.id).await.unwrap();
    let h3=api_headers(&pool,&finance).await;
    let Json(gl)=evidence::journal_detail(State(AppState{pool:pool.clone()}),h3,Path(draft.id)).await.unwrap();
    assert_eq!(gl["totals"]["balanced"],true);
    assert_eq!(gl["lines"].as_array().unwrap().len(),2);
    let h4=api_headers(&pool,&outsider).await;
    assert!(evidence::journal_detail(State(AppState{pool:pool.clone()}),h4,Path(draft.id)).await.is_err());
    let h5=api_headers(&pool,&outsider).await;
    let Json(overview)=evidence::overview(State(AppState{pool:pool.clone()}),h5).await.unwrap();
    assert!(overview["domain_status_counts"].as_array().unwrap().is_empty());
    assert_eq!(overview["journals"]["posted"],0);
}
