//! RC11 fail-closed schema and accounting period regression.
//! MUST run against a disposable PostgreSQL database with TEST_DATABASE_URL.
use blue_line_erp_api::journal::{self, JournalInput, JournalLineInput};
use sqlx::{PgPool,Row};
use uuid::Uuid;

#[tokio::test]
async fn rc11_schema_and_period_lock_reject_raw_sql_mutations() {
    let url=std::env::var("TEST_DATABASE_URL")
        .expect("TEST_DATABASE_URL is mandatory for the RC11 PostgreSQL release gate");
    assert!(!url.to_lowercase().contains("prod"),"Refusing tests on a production-labelled DB");
    let pool=PgPool::connect(&url).await.expect("connect to disposable PostgreSQL");
    let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    sqlx::migrate::Migrator::new(dir.as_path()).await.expect("read SQLx migrations")
        .run(&pool).await.expect("migrate complete chain RC6–RC11");
    let version:i64=sqlx::query_scalar("SELECT COALESCE(MAX(version),0)::bigint FROM _sqlx_migrations WHERE success=true")
        .fetch_one(&pool).await.expect("migration version");
    assert_eq!(version,12,"all twelve migrations must apply in sequence");
    let entity:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
        .bind(format!("RC11 account guard {}",Uuid::new_v4()))
        .fetch_one(&pool).await.unwrap();
    let user:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC11 test','test-only') RETURNING id")
        .bind(format!("rc11-{}@example.invalid",Uuid::new_v4()))
        .fetch_one(&pool).await.unwrap();
    sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,'finance')")
        .bind(user).bind(entity).execute(&pool).await.unwrap();
    sqlx::query("INSERT INTO gl_periods(entity_id,period_key) VALUES($1,'2026-10')")
        .bind(entity).execute(&pool).await.unwrap();
    let account:Uuid=sqlx::query_scalar("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,'411','RC11 test account') RETURNING id")
        .bind(entity).fetch_one(&pool).await.unwrap();
    let journal:Uuid=sqlx::query_scalar("INSERT INTO gl_journals(entity_id,period_key,memo,created_by) VALUES($1,'2026-10','RC11 draft test',$2) RETURNING id")
        .bind(entity).bind(user).fetch_one(&pool).await.unwrap();
    sqlx::query("INSERT INTO gl_lines(entity_id,journal_id,account_id,debit_xaf,credit_xaf) VALUES($1,$2,$3,1000,0)")
        .bind(entity).bind(journal).bind(account).execute(&pool).await.unwrap();
    sqlx::query("UPDATE gl_periods SET is_locked=true WHERE entity_id=$1 AND period_key='2026-10'")
        .bind(entity).execute(&pool).await.unwrap();
    // Direct SQL clients must not bypass a locked period (both headers and lines).
    assert!(sqlx::query("INSERT INTO gl_lines(entity_id,journal_id,account_id,debit_xaf,credit_xaf) VALUES($1,$2,$3,0,1000)")
        .bind(entity).bind(journal).bind(account).execute(&pool).await.is_err());
    assert!(sqlx::query("UPDATE gl_journals SET memo='Manipulated closed draft' WHERE id=$1")
        .bind(journal).execute(&pool).await.is_err());
    assert!(sqlx::query("UPDATE gl_journals SET status='posted',posted_by=$1,posted_at=now() WHERE id=$2")
        .bind(user).bind(journal).execute(&pool).await.is_err());
    let remained:bool=sqlx::query_scalar("SELECT is_locked FROM gl_periods WHERE entity_id=$1 AND period_key='2026-10'")
        .bind(entity).fetch_one(&pool).await.unwrap();
    assert!(remained);
    let (status,): (String,)=sqlx::query_as("SELECT status FROM gl_journals WHERE id=$1")
        .bind(journal).fetch_one(&pool).await.unwrap();
    assert_eq!(status,"draft");
}

#[test]
fn rc11_reject_oversized_balanced_journal() {
    let excessive=9_000_000_000_000_001;
    let input=JournalInput{
        period_key:"2026-10".into(),memo:"Over limit journal".into(),source_record_id:None,
        lines:vec![
            JournalLineInput{account_code:"411".into(),debit_xaf:excessive,credit_xaf:0},
            JournalLineInput{account_code:"701".into(),debit_xaf:0,credit_xaf:excessive}
        ]
    };
    assert!(journal::validate(&input).is_err());
}
