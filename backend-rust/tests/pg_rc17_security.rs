//! RC17 PG integration: membership role changes invalidate bearer sessions.
use blue_line_erp_api::{AppState,auth,security,policy};
use axum::{extract::{State,Path},http::HeaderMap};use sqlx::PgPool;use uuid::Uuid;
async fn actor(db:&PgPool,entity:Uuid,role:&str)->(Uuid,HeaderMap){
 let id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC17 Identity','local-qa') RETURNING id")
 .bind(format!("rc17-{}@test.invalid",Uuid::new_v4())).fetch_one(db).await.unwrap();
 sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)").bind(id).bind(entity).bind(role).execute(db).await.unwrap();
 let raw=format!("{}{}",Uuid::new_v4().simple(),Uuid::new_v4().simple());
 sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
 .bind(auth::hash_token(&raw)).bind(id).bind(entity).execute(db).await.unwrap();
 let mut h=HeaderMap::new();h.insert("authorization",format!("Bearer {raw}").parse().unwrap());(id,h)
}
#[tokio::test]async fn admin_bypass_removed_and_membership_change_revokes_tokens(){
 assert!(!policy::can_module("group_admin","finance",true));
 let url=std::env::var("TEST_DATABASE_URL").expect("Disposable TEST_DATABASE_URL required");
 assert!(!url.to_ascii_lowercase().contains("prod"),"Never execute against production");
 let db=PgPool::connect(&url).await.unwrap();
 let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
 sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&db).await.unwrap();
 let version:i64=sqlx::query_scalar("SELECT max(version) FROM _sqlx_migrations WHERE success").fetch_one(&db).await.unwrap();assert_eq!(version,12);
 let e:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
 .bind(format!("Security QA {}",Uuid::new_v4())).fetch_one(&db).await.unwrap();
 let f:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
 .bind(format!("Foreign QA {}",Uuid::new_v4())).fetch_one(&db).await.unwrap();
 let (_,admin)=actor(&db,e,"group_admin").await;
 let (user,user_headers)=actor(&db,e,"operator").await;
 let (_,foreign_admin)=actor(&db,f,"group_admin").await;
 let state=AppState{pool:db.clone()};
 assert!(auth::require_auth(&user_headers,&db).await.is_ok());
 assert!(security::revoke_member(State(state.clone()),foreign_admin,Path(user)).await.is_err());
 let Json(grants)=security::permissions(State(state.clone()),admin.clone()).await.unwrap();
 assert!(grants["write_modules"].as_array().unwrap().iter().all(|x|x!="finance"));
 sqlx::query("UPDATE entity_memberships SET role='manager' WHERE entity_id=$1 AND user_id=$2")
 .bind(e).bind(user).execute(&db).await.unwrap();
 assert!(auth::require_auth(&user_headers,&db).await.is_err(),"Role change must immediately revoke stale token");
 let (other,other_headers)=actor(&db,e,"operator").await;
 security::revoke_member(State(state.clone()),admin.clone(),Path(other)).await.unwrap();
 assert!(auth::require_auth(&other_headers,&db).await.is_err());
 security::revoke_self(State(state.clone()),admin.clone()).await.unwrap();
 assert!(auth::require_auth(&admin,&db).await.is_err());
}
