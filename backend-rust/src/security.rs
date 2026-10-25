//! RC17 session controls and read-only permission matrix; no public user provisioning.
use axum::{extract::{Path,State},http::HeaderMap,Json};
use serde_json::{json,Value};
use sqlx::Row;
use uuid::Uuid;
use crate::{AppState,auth::{self},error::ApiError,policy};

pub async fn permissions(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let modules=policy::visible_modules(&a);
 let write_modules:Vec<String>=modules.iter().filter(|m|policy::can_module(&a.role,m,true)).cloned().collect();
 Ok(Json(json!({"entity_id":a.entity_id,"user_id":a.user_id,"role":a.role,"read_modules":modules,"write_modules":write_modules,"isolation":"legal_entity","rbac_enforced_by":"Rust service","rls_enabled":false})))
}
pub async fn revoke_self(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 sqlx::query("UPDATE app_users SET session_epoch=session_epoch+1 WHERE id=$1")
 .bind(a.user_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 sqlx::query("UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL")
 .bind(a.user_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 sqlx::query("INSERT INTO rc17_security_events(entity_id,actor_id,subject_id,action) VALUES($1,$2,$2,'revoke_self')")
 .bind(a.entity_id).bind(a.user_id).execute(&mut *tx).await.map_err(ApiError::db)?;
 tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"status":"revoked","all_sessions_for_user":true})))
}
pub async fn revoke_member(State(s):State<AppState>,h:HeaderMap,Path(target):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 if a.role!="group_admin"{return Err(ApiError::forbidden())}
 if target==a.user_id {return Err(ApiError::bad("Use revoke-self for your own sessions"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let member=sqlx::query("SELECT u.id FROM entity_memberships m JOIN app_users u ON u.id=m.user_id WHERE m.user_id=$1 AND m.entity_id=$2 AND m.active=true FOR UPDATE OF m")
 .bind(target).bind(a.entity_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
 if member.is_none(){return Err(ApiError::not_found())}
 sqlx::query("UPDATE app_users SET session_epoch=session_epoch+1 WHERE id=$1")
 .bind(target).execute(&mut *tx).await.map_err(ApiError::db)?;
 sqlx::query("UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL")
 .bind(target).execute(&mut *tx).await.map_err(ApiError::db)?;
 sqlx::query("INSERT INTO rc17_security_events(entity_id,actor_id,subject_id,action) VALUES($1,$2,$3,'revoke_member_sessions')")
 .bind(a.entity_id).bind(a.user_id).bind(target).execute(&mut *tx).await.map_err(ApiError::db)?;
 tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"status":"revoked","member_id":target,"scope":"all_user_sessions"})))
}
pub async fn security_feed(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 if !["group_admin","auditor"].contains(&a.role.as_str()){return Err(ApiError::forbidden())}
 let rows=sqlx::query("SELECT actor_id,subject_id,action,at FROM rc17_security_events WHERE entity_id=$1 ORDER BY at DESC LIMIT 50")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"events":rows.iter().map(|r|json!({"actor_id":r.get::<Uuid,_>("actor_id"),"subject_id":r.get::<Uuid,_>("subject_id"),"action":r.get::<String,_>("action"),"at":r.get::<chrono::DateTime<chrono::Utc>,_>("at")})).collect::<Vec<_>>(),"scope":"current_legal_entity"})))
}


// RC18 defense-in-depth: fail-closed HTTP method / route / role matrix.
// This is intentionally independent of any route handler's authorization;
// handlers remain responsible for tenant-scoped SQL and maker/checker rules.
// Do not treat this as database RLS or a production pentest.
use axum::{extract::Request, middleware::Next, response::Response, http::{Method,header,HeaderValue}};

pub fn route_allowed(role: &str, method: &Method, path: &str) -> bool {
    let read = method == Method::GET;
    let write = method == Method::POST;
    if !(read || write) { return false; }
    let in_path = |prefix: &str| path == prefix || path.starts_with(&format!("{prefix}/"));
    // Any authenticated user may inspect their OWN session and company identity.
    if matches!(path,"/api/v1/me" | "/api/v1/entity") { return read; }
    if path == "/api/v1/logout" { return write; }
    if path == "/api/v1/modules" { return read; }
    if path == "/api/v1/security/permissions" { return read; }
    if path == "/api/v1/security/revoke-self" { return write; }
    if path == "/api/v1/security/events" { return read && matches!(role,"auditor"|"group_admin"); }
    if in_path("/api/v1/security/users") {return write && role == "group_admin" && path.ends_with("/revoke");}
    if path == "/api/v1/bridge/overview" {return read && matches!(role,"executive"|"finance"|"auditor"|"hr_manager");}
    if in_path("/api/v1/hr") {return matches!(role,"hr"|"hr_manager"|"finance"|"auditor"|"executive");}
    if in_path("/api/v1/finance") {return matches!(role,"operator"|"finance"|"auditor"|"executive");}
    if in_path("/api/v1/journals") {return matches!(role,"finance"|"auditor"|"executive"|"manager");}
    if in_path("/api/v1/overview") || in_path("/api/v1/audit-events") {
        return read && matches!(role,"finance"|"auditor"|"executive"|"manager");
    }
    if in_path("/api/v1/records") {return matches!(role,"operator"|"manager"|"finance"|"auditor"|"executive"|"hr"|"hr_manager"|"group_admin");}
    if in_path("/api/v1/blex") {return matches!(role,"operator"|"manager"|"finance"|"auditor"|"executive");}
    if in_path("/api/v1/hospitality") || in_path("/api/v1/property") {
        return matches!(role,"operator"|"manager"|"finance"|"auditor"|"executive");
    }
    if in_path("/api/v1/construction") || in_path("/api/v1/manufacturing") || in_path("/api/v1/import") {
        return matches!(role,"operator"|"manager"|"finance"|"auditor"|"executive");
    }
    if in_path("/api/v1/trade") || in_path("/api/v1/purchasing") || in_path("/api/v1/sales") || in_path("/api/v1/inventory") {
        return matches!(role,"operator"|"manager"|"finance"|"auditor"|"executive");
    }
    false // a new route MUST be added to the matrix explicitly
}

pub async fn access_gate(State(s): State<AppState>, req: Request, next: Next) -> Result<Response, ApiError> {
    let path=req.uri().path();
    // Login and DB health are intentionally unauthenticated. OPTIONS preflight
    // is evaluated by the outer strict-origin CORS layer.
    if req.method() != Method::OPTIONS && path != "/health" && path != "/api/v1/login" {
        let identity=auth::require_auth(req.headers(),&s.pool).await?;
        if !route_allowed(&identity.role,req.method(),path){return Err(ApiError::forbidden())}
    }
    let mut response=next.run(req).await;
    response.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response.headers_mut().insert(header::HeaderName::from_static("x-content-type-options"),HeaderValue::from_static("nosniff"));
    response.headers_mut().insert(header::HeaderName::from_static("referrer-policy"),HeaderValue::from_static("no-referrer"));
    Ok(response)
}

#[cfg(test)]
mod route_gate_tests {
    use super::*;
    #[test] fn it_fails_closed_for_unknown_and_bad_methods(){
        assert!(!route_allowed("executive",&Method::GET,"/api/v1/surprise"));
        assert!(!route_allowed("operator",&Method::DELETE,"/api/v1/sales/orders"));
        assert!(!route_allowed("group_admin",&Method::GET,"/api/v1/finance/invoices"));
    }
    #[test] fn it_limits_sensitive_domains(){
        assert!(!route_allowed("operator",&Method::GET,"/api/v1/hr/employees"));
        assert!(!route_allowed("group_admin",&Method::POST,"/api/v1/hr/payroll-previews"));
        assert!(!route_allowed("operator",&Method::GET,"/api/v1/security/events"));
        assert!(route_allowed("hr_manager",&Method::GET,"/api/v1/hr/employees"));
        assert!(route_allowed("manager",&Method::GET,"/api/v1/hospitality/rooms"));
        assert!(route_allowed("group_admin",&Method::POST,"/api/v1/security/users/00000000-0000-0000-0000-000000000000/revoke"));
    }
}
