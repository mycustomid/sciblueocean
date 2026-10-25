// Runs only with TEST_DATABASE_URL; CI supplies a disposable PostgreSQL service.
use blue_line_erp_api::{AppState,auth::{self,Auth},routes::{self,RecordQuery},journal::{self,JournalInput,JournalLineInput},workflow::{self,TransitionRequest}};
use axum::{extract::{State,Query},http::{HeaderMap,header},Json};
use sqlx::{PgPool,Row};
use uuid::Uuid;

async fn create_user(pool:&PgPool,entity:Uuid,role:&str)->Uuid {
    let id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'QA Actor','TEST_PASSWORD_DISABLED') RETURNING id")
        .bind(format!("test-{}@example.test",Uuid::new_v4())).fetch_one(pool).await.unwrap();
    sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)")
        .bind(id).bind(entity).bind(role).execute(pool).await.unwrap();id
}

#[tokio::test]
async fn postgres_entity_and_gl_integration(){
    let url=match std::env::var("TEST_DATABASE_URL"){Ok(s)=>s,Err(_)=>{
        eprintln!("SKIP PostgreSQL integration: TEST_DATABASE_URL not set");return
    }};
    let pool=PgPool::connect(&url).await.unwrap();
    let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&pool).await.unwrap();
    let entity_a:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES('QA Entity A') RETURNING id").fetch_one(&pool).await.unwrap();
    let entity_b:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES('QA Entity B') RETURNING id").fetch_one(&pool).await.unwrap();
    let operator=create_user(&pool,entity_a,"operator").await;
    let manager=create_user(&pool,entity_a,"manager").await;
    let fin=create_user(&pool,entity_a,"finance").await;
    let exec=create_user(&pool,entity_a,"executive").await;
    let outsider=create_user(&pool,entity_b,"executive").await;
    let record:Uuid=sqlx::query_scalar("INSERT INTO domain_records(entity_id,module_key,counterparty,description,amount_xaf,created_by) VALUES($1,'sugar','Demo Supplier','A sugar test record',5000,$2) RETURNING id")
        .bind(entity_a).bind(operator).fetch_one(&pool).await.unwrap();
    let outsider_auth=Auth{user_id:outsider,entity_id:entity_b,role:"executive".into()};
    assert!(workflow::transition(&pool,&outsider_auth,record,TransitionRequest{action:"submit".into(),note:None}).await.is_err());
    let op_auth=Auth{user_id:operator,entity_id:entity_a,role:"operator".into()};
    let manager_auth=Auth{user_id:manager,entity_id:entity_a,role:"manager".into()};
    let fin_auth=Auth{user_id:fin,entity_id:entity_a,role:"finance".into()};
    let exec_auth=Auth{user_id:exec,entity_id:entity_a,role:"executive".into()};
    assert!(workflow::transition(&pool,&exec_auth,record,TransitionRequest{action:"approve_final".into(),note:None}).await.is_err());
    workflow::transition(&pool,&op_auth,record,TransitionRequest{action:"submit".into(),note:None}).await.unwrap();
    workflow::transition(&pool,&manager_auth,record,TransitionRequest{action:"approve_manager".into(),note:None}).await.unwrap();
    workflow::transition(&pool,&fin_auth,record,TransitionRequest{action:"approve_finance".into(),note:None}).await.unwrap();
    workflow::transition(&pool,&exec_auth,record,TransitionRequest{action:"approve_final".into(),note:None}).await.unwrap();
    let final_status:String=sqlx::query_scalar("SELECT status FROM domain_records WHERE id=$1").bind(record).fetch_one(&pool).await.unwrap();
    assert_eq!(final_status,"approved");

    for (code,label) in [("411","AR"),("701","Revenue")] {
        sqlx::query("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3)")
            .bind(entity_a).bind(code).bind(label).execute(&pool).await.unwrap();
    }
    let journal=journal::create(&pool,&fin_auth,JournalInput{period_key:"2026-10".into(),memo:"Test balanced invoice".into(),source_record_id:Some(record),lines:vec![
        JournalLineInput{account_code:"411".into(),debit_xaf:15000,credit_xaf:0},
        JournalLineInput{account_code:"701".into(),debit_xaf:0,credit_xaf:15000}
    ]}).await.unwrap().0;
    assert_eq!(journal.debits_xaf,journal.credits_xaf);
    assert!(journal::post(&pool,&fin_auth,journal.id).await.is_err()); // no self-approval
    journal::post(&pool,&exec_auth,journal.id).await.unwrap();
    let posted:String=sqlx::query_scalar("SELECT status FROM gl_journals WHERE id=$1").bind(journal.id).fetch_one(&pool).await.unwrap();
    assert_eq!(posted,"posted");
    let row=sqlx::query("SELECT id FROM gl_lines WHERE journal_id=$1 LIMIT 1").bind(journal.id).fetch_one(&pool).await.unwrap();
    let line_id:Uuid=row.get("id");
    assert!(sqlx::query("UPDATE gl_lines SET debit_xaf=999 WHERE id=$1").bind(line_id).execute(&pool).await.is_err());

    // API reads under session from entity B must not reveal entity A's business record.
    let raw="test-session-token-which-is-long-enough-to-be-used";
    sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
        .bind(auth::hash_token(raw)).bind(outsider).bind(entity_b).execute(&pool).await.unwrap();
    let mut headers=HeaderMap::new();headers.insert(header::AUTHORIZATION,format!("Bearer {raw}").parse().unwrap());
    let Json(v)=routes::list_records(State(AppState{pool:pool.clone()}),headers,Query(RecordQuery{module_key:None})).await.unwrap();
    assert_eq!(v["count"],0);
}
