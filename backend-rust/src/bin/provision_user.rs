use std::env;
use argon2::{Argon2,PasswordHasher,password_hash::SaltString};
use rand::rngs::OsRng;
use sqlx::postgres::PgPoolOptions;
use uuid::Uuid;

#[tokio::main]
async fn main()->Result<(),Box<dyn std::error::Error>>{
  // Restricted operator CLI only. Never expose as public HTTP endpoint.
  let url=env::var("DATABASE_URL")?;
  let entity_id=Uuid::parse_str(&env::var("PROVISION_ENTITY_ID")?)?;
  let role=env::var("PROVISION_ROLE")?;
  let email=env::var("PROVISION_EMAIL")?.to_lowercase();
  let password=env::var("PROVISION_PASSWORD")?;
  if !["executive","finance","manager","operator","auditor","hr","hr_manager"].contains(&role.as_str()) {return Err("Invalid role".into())}
  if password.chars().count()<16||email.len()<6||!email.contains('@') {return Err("Email invalid or password shorter than 16 characters".into())}
  let pool=PgPoolOptions::new().max_connections(2).connect(&url).await?;
  let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM legal_entities WHERE id=$1)").bind(entity_id).fetch_one(&pool).await?;
  if !exists {return Err("No matching legal entity".into())}
  let encoded=Argon2::default().hash_password(password.as_bytes(),&SaltString::generate(&mut OsRng)).map_err(|e| e.to_string())?.to_string();
  let mut tx=pool.begin().await?;
  let user_id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,$2,$3) RETURNING id")
      .bind(email).bind("Pilot Operator").bind(encoded).fetch_one(&mut *tx).await?;
  sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)")
      .bind(user_id).bind(entity_id).bind(role).execute(&mut *tx).await?;
  tx.commit().await?;
  println!("Provisioned pilot role for entity {entity_id} (password omitted)");
  Ok(())
}
