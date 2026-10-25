use std::env;
use argon2::{Argon2,PasswordHasher,password_hash::SaltString};
use rand::rngs::OsRng;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

#[tokio::main]
async fn main()->Result<(),Box<dyn std::error::Error>> {
    // CLI only; no public signup endpoint. Never log the provided password.
    let url=env::var("DATABASE_URL")?;
    let email=env::var("BOOTSTRAP_EMAIL")?.to_lowercase();
    let password=env::var("BOOTSTRAP_PASSWORD")?;
    let company=env::var("BOOTSTRAP_COMPANY_NAME")?;
    if password.chars().count()<16||email.len()<6||!email.contains('@')||company.trim().len()<3 {return Err("Bootstrap values invalid: password must be at least 16 characters".into())}
    let pool=PgPoolOptions::new().max_connections(2).connect(&url).await?;
    let migrations_dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    sqlx::migrate::Migrator::new(migrations_dir.as_path()).await?.run(&pool).await?;
    let existing=sqlx::query("SELECT id FROM app_users WHERE lower(email)=lower($1)")
        .bind(&email).fetch_optional(&pool).await?;
    if existing.is_some(){return Err("Email already exists: do not rerun bootstrap on existing users".into())}
    let salt=SaltString::generate(&mut OsRng);
    let encoded=Argon2::default().hash_password(password.as_bytes(),&salt)?.to_string();
    let mut tx=pool.begin().await?;
    let entity_id:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
        .bind(company).fetch_one(&mut *tx).await?;
    let user_id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,$2,$3) RETURNING id")
        .bind(email).bind("Bootstrap Administrator").bind(encoded).fetch_one(&mut *tx).await?;
    sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,'group_admin')")
        .bind(user_id).bind(entity_id).execute(&mut *tx).await?;
    // Demo accounts only. Validate mapping against certified Cameroonian SYSCOHADA localization before real postings.
    for (code,label) in [("411","Demo - Receivables"),("401","Demo - Payables"),("521","Demo - Bank"),("701","Demo - Revenue"),("601","Demo - Purchases")] {
        sqlx::query("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3)")
            .bind(entity_id).bind(code).bind(label).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    println!("CREATED DEMO LEGAL ENTITY ID: {entity_id}");
    println!("BOOTSTRAPPED ADMIN ACCOUNT (password omitted)");
    Ok(())
}
