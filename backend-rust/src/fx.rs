//! RC14 INDICATIVE FX quotes only; NOT a licensed FX/AML/settlement system.
use axum::{extract::State,http::{HeaderMap,StatusCode},Json};use serde::Deserialize;
use serde_json::{json,Value};use sqlx::Row;use uuid::Uuid;
use crate::{AppState,auth::{self},error::ApiError};
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct QuoteInput {pub currency:String,pub foreign_units:i64,pub rate_xaf_per_1000:i64}
pub fn quote_value(p:&QuoteInput)->Result<i64,ApiError>{
 if !["USD","EUR","GBP","CNY"].contains(&p.currency.as_str())||!(1..=1_000_000_000).contains(&p.foreign_units)||!(1..=1_000_000_000).contains(&p.rate_xaf_per_1000) {
  return Err(ApiError::bad("Invalid indicative FX quote"));
 }
 let val=i128::from(p.foreign_units)*i128::from(p.rate_xaf_per_1000);
 let rounded=(val+500)/1000;
 if rounded<=0 || rounded>9_000_000_000_000_000{return Err(ApiError::bad("Quote out of safe limits"))}
 Ok(rounded as i64)
}
pub async fn quotes(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,currency,foreign_units,rate_xaf_per_1000,indicated_xaf,expires_at FROM rc14_fx_quotes WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"regulatory_status":"indicative_only_no_execution","items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"currency":r.get::<String,_>("currency"),"foreign_units":r.get::<i64,_>("foreign_units"),"rate_xaf_per_1000":r.get::<i64,_>("rate_xaf_per_1000"),"indicated_xaf":r.get::<i64,_>("indicated_xaf"),"expires_at":r.get::<chrono::DateTime<chrono::Utc>,_>("expires_at")})).collect::<Vec<_>>()})))
}
pub async fn create_quote(State(s):State<AppState>,h:HeaderMap,Json(p):Json<QuoteInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 if a.role!="operator"{return Err(ApiError::forbidden())}
 let amount=quote_value(&p)?;let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc14_fx_quotes(entity_id,currency,foreign_units,rate_xaf_per_1000,indicated_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id")
 .bind(a.entity_id).bind(&p.currency).bind(p.foreign_units).bind(p.rate_xaf_per_1000).bind(amount).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'indicative_fx_quote_created','rc14_fx_quote',$3,$4)")
 .bind(a.entity_id).bind(a.user_id).bind(id).bind(json!({"currency":p.currency,"source":"manual_input_not_market_feed"})).execute(&mut *tx).await.map_err(ApiError::db)?;
 tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"indicative_xaf":amount,"status":"indicative_only","settlement":false,"live_rate_verified":false}))))
}
#[cfg(test)] mod tests{use super::*;#[test]fn calculates_rounding(){assert_eq!(quote_value(&QuoteInput{currency:"EUR".into(),foreign_units:1000,rate_xaf_per_1000:655957}).unwrap(),655957)} }
