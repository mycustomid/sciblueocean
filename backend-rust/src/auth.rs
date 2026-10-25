use axum::{http::HeaderMap,Json};
use chrono::{Duration,Utc};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use sqlx::{PgPool,Row};
use uuid::Uuid;
use rand::{RngCore,rngs::OsRng};
use sha2::{Sha256,Digest};
use argon2::{Argon2,PasswordVerifier,password_hash::PasswordHash};
use crate::error::ApiError;

#[derive(Debug, Clone)]
pub struct Auth { pub user_id: Uuid, pub entity_id: Uuid, pub role: String }

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LoginRequest { pub email:String, pub password:String, pub entity_id:Uuid }

#[derive(Serialize)]
pub struct LoginResponse { pub access_token:String, pub token_type:&'static str, pub expires_at:chrono::DateTime<Utc>, pub role:String, pub entity_id:Uuid }

pub fn hash_token(raw:&str)->String { hex::encode(Sha256::digest(raw.as_bytes())) }

pub async fn require_auth(headers:&HeaderMap,pool:&PgPool)->Result<Auth,ApiError> {
    let authorization=headers.get(axum::http::header::AUTHORIZATION)
        .and_then(|v|v.to_str().ok()).ok_or_else(ApiError::unauthorized)?;
    let raw=authorization.strip_prefix("Bearer ").ok_or_else(ApiError::unauthorized)?;
    if raw.len()<40 || raw.len()>256 {return Err(ApiError::unauthorized())}
    let hash=hash_token(raw);
    let row=sqlx::query("SELECT s.user_id,s.entity_id,m.role FROM auth_sessions s JOIN app_users u ON u.id=s.user_id AND u.active=true AND u.session_epoch=s.session_epoch JOIN entity_memberships m ON m.user_id=s.user_id AND m.entity_id=s.entity_id AND m.active=true WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()")
        .bind(hash).fetch_optional(pool).await.map_err(ApiError::db)?;
    let row=row.ok_or_else(ApiError::unauthorized)?;
    Ok(Auth { user_id:row.get("user_id"), entity_id:row.get("entity_id"), role:row.get("role") })
}

pub fn allow(auth:&Auth,permitted:&[&str])->Result<(),ApiError> {
    if permitted.contains(&auth.role.as_str()) { Ok(()) } else { Err(ApiError::forbidden()) }
}

async fn register_failure(pool:&PgPool,entity_id:Uuid,email_digest:&str)->Result<(),ApiError>{
    sqlx::query("INSERT INTO auth_login_attempts(entity_id,email_digest,failures,last_failed) VALUES($1,$2,1,now()) ON CONFLICT(entity_id,email_digest) DO UPDATE SET failures=CASE WHEN auth_login_attempts.last_failed < now()-interval '15 minutes' THEN 1 ELSE auth_login_attempts.failures+1 END,last_failed=now()")
        .bind(entity_id).bind(email_digest).execute(pool).await.map_err(ApiError::db)?;
    Ok(())
}

pub async fn login(pool:&PgPool,request:LoginRequest)->Result<Json<LoginResponse>,ApiError> {
    if request.password.len()>512 || request.email.len()>254 {return Err(ApiError::unauthorized())}
    let email_digest=hash_token(&format!("{}|{}",request.entity_id,request.email.trim().to_lowercase()));
    let too_many:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM auth_login_attempts WHERE entity_id=$1 AND email_digest=$2 AND failures>=5 AND last_failed>now()-interval '15 minutes')")
        .bind(request.entity_id).bind(&email_digest).fetch_one(pool).await.map_err(ApiError::db)?;
    if too_many {return Err(ApiError::unauthorized())}
    let row=sqlx::query("SELECT u.id,u.password_hash,m.role FROM app_users u JOIN entity_memberships m ON m.user_id=u.id WHERE lower(u.email)=lower($1) AND u.active=true AND m.entity_id=$2 AND m.active=true")
        .bind(&request.email).bind(request.entity_id).fetch_optional(pool).await.map_err(ApiError::db)?;
    let row=match row {Some(r)=>r,None=>{
        register_failure(pool,request.entity_id,&email_digest).await?;
        return Err(ApiError::unauthorized())
    }};
    let hash:String=row.get("password_hash");
    let parsed=PasswordHash::new(&hash).map_err(|_|ApiError::unauthorized())?;
    if Argon2::default().verify_password(request.password.as_bytes(),&parsed).is_err(){
        register_failure(pool,request.entity_id,&email_digest).await?;
        return Err(ApiError::unauthorized())
    }
    sqlx::query("DELETE FROM auth_login_attempts WHERE entity_id=$1 AND email_digest=$2")
        .bind(request.entity_id).bind(&email_digest).execute(pool).await.map_err(ApiError::db)?;
    let mut secret=[0u8;48]; OsRng.fill_bytes(&mut secret);
    let raw=hex::encode(secret);
    let token_hash=hash_token(&raw);
    let user_id:Uuid=row.get("id");
    let expires_at=Utc::now()+Duration::hours(8);
    sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at,session_epoch) SELECT $1,$2,$3,$4,session_epoch FROM app_users WHERE id=$2")
        .bind(token_hash).bind(user_id).bind(request.entity_id).bind(expires_at)
        .execute(pool).await.map_err(ApiError::db)?;
    Ok(Json(LoginResponse { access_token:raw, token_type:"Bearer",expires_at,role:row.get("role"),entity_id:request.entity_id }))
}

pub async fn me(pool:&PgPool,headers:&HeaderMap)->Result<Json<Value>,ApiError> {
    let auth=require_auth(headers,pool).await?;
    Ok(Json(json!({"user_id":auth.user_id,"entity_id":auth.entity_id,"role":auth.role})))
}

pub async fn logout(pool:&PgPool,headers:&HeaderMap)->Result<Json<Value>,ApiError> {
    require_auth(headers,pool).await?;
    let token=headers.get(axum::http::header::AUTHORIZATION).and_then(|v|v.to_str().ok())
        .and_then(|v|v.strip_prefix("Bearer ")).ok_or_else(ApiError::unauthorized)?;
    sqlx::query("UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL")
        .bind(hash_token(token)).execute(pool).await.map_err(ApiError::db)?;
    Ok(Json(json!({"status":"logged_out"})))
}
