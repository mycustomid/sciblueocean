//! RC14 hotel/property bounded operational pilot. No payment card or OTA integration.
use axum::{extract::{Path,State},http::{HeaderMap,StatusCode},Json};
use serde::Deserialize;use serde_json::{json,Value};use sqlx::{Row,Postgres,Transaction};use uuid::Uuid;
use chrono::NaiveDate;
use crate::{AppState,auth::{self,Auth},error::ApiError};
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct PropertyInput{pub code:String,pub name:String,pub city:String}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct RoomInput{pub property_id:Uuid,pub code:String,pub nightly_rate_xaf:i64}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct BookingInput{pub room_id:Uuid,pub guest_name:String,pub arrival:NaiveDate,pub departure:NaiveDate}
#[derive(Deserialize)] #[serde(deny_unknown_fields)] pub struct LeaseInput{pub unit_reference:String,pub tenant:String,pub starts_on:NaiveDate,pub ends_on:NaiveDate,pub rent_xaf:i64,pub deposit_xaf:i64}
fn only(a:&Auth,roles:&[&str])->Result<(),ApiError>{if roles.contains(&a.role.as_str()){Ok(())}else{Err(ApiError::forbidden())}}
fn valid(s:&str,min:usize,max:usize)->bool{s.trim().len()>=min&&s.len()<=max}
async fn audit(tx:&mut Transaction<'_,Postgres>,a:&Auth,kind:&str,resource:&str,id:Uuid)->Result<(),ApiError>{
 sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id) VALUES($1,$2,$3,$4,$5)")
 .bind(a.entity_id).bind(a.user_id).bind(kind).bind(resource).bind(id).execute(&mut **tx).await.map_err(ApiError::db)?;Ok(())
}
pub async fn properties(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,code,name,city FROM rc14_properties WHERE entity_id=$1 ORDER BY code LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"code":r.get::<String,_>("code"),"name":r.get::<String,_>("name"),"city":r.get::<String,_>("city")})).collect::<Vec<_>>()})))
}
pub async fn create_property(State(s):State<AppState>,h:HeaderMap,Json(p):Json<PropertyInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["manager"])?;
 if !valid(&p.code,2,40)||!valid(&p.name,2,180)||!valid(&p.city,2,120){return Err(ApiError::bad("Invalid property"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc14_properties(entity_id,code,name,city) VALUES($1,$2,$3,$4) RETURNING id")
 .bind(a.entity_id).bind(p.code).bind(p.name).bind(p.city).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"property_created","rc14_property",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id}))))
}
pub async fn rooms(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,property_id,code,nightly_rate_xaf,condition FROM rc14_rooms WHERE entity_id=$1 ORDER BY code LIMIT 150")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"property_id":r.get::<Uuid,_>("property_id"),"code":r.get::<String,_>("code"),"nightly_rate_xaf":r.get::<i64,_>("nightly_rate_xaf"),"condition":r.get::<String,_>("condition")})).collect::<Vec<_>>()})))
}
pub async fn create_room(State(s):State<AppState>,h:HeaderMap,Json(p):Json<RoomInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["manager"])?;
 if !valid(&p.code,1,40)||!(1..=1_000_000_000).contains(&p.nightly_rate_xaf){return Err(ApiError::bad("Invalid room"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc14_rooms(entity_id,property_id,code,nightly_rate_xaf) VALUES($1,$2,$3,$4) RETURNING id")
 .bind(a.entity_id).bind(p.property_id).bind(&p.code).bind(p.nightly_rate_xaf).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"room_created","rc14_room",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id}))))
}
pub async fn bookings(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,room_id,guest_name,arrival,departure,total_xaf,status FROM rc14_reservations WHERE entity_id=$1 ORDER BY arrival DESC LIMIT 150")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"room_id":r.get::<Uuid,_>("room_id"),"guest_name":r.get::<String,_>("guest_name"),"arrival":r.get::<NaiveDate,_>("arrival"),"departure":r.get::<NaiveDate,_>("departure"),"total_xaf":r.get::<i64,_>("total_xaf"),"status":r.get::<String,_>("status")})).collect::<Vec<_>>()})))
}
pub async fn create_booking(State(s):State<AppState>,h:HeaderMap,Json(p):Json<BookingInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["operator"])?;
 let nights=(p.departure-p.arrival).num_days();
 if !(1..=365).contains(&nights)||!valid(&p.guest_name,2,240){return Err(ApiError::bad("Invalid stay duration/guest"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let room=sqlx::query("SELECT nightly_rate_xaf,condition FROM rc14_rooms WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(p.room_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if room.get::<String,_>("condition")!="ready"{return Err(ApiError::conflict("Room unavailable for service"))}
 let amount=room.get::<i64,_>("nightly_rate_xaf").checked_mul(nights).ok_or_else(||ApiError::bad("Rate overflow"))?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc14_reservations(entity_id,room_id,guest_name,arrival,departure,total_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id")
 .bind(a.entity_id).bind(p.room_id).bind(&p.guest_name).bind(p.arrival).bind(p.departure).bind(amount).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"reservation_created","rc14_reservation",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"total_xaf":amount,"status":"reserved","payment_captured":false}))))
}
pub async fn check_in(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["operator"])?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let r=sqlx::query("SELECT status FROM rc14_reservations WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if r.get::<String,_>("status")!="reserved"{return Err(ApiError::conflict("Not reserved"))}
 sqlx::query("UPDATE rc14_reservations SET status='checked_in',updated_by=$1 WHERE entity_id=$2 AND id=$3")
 .bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"guest_checked_in","rc14_reservation",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"id":id,"status":"checked_in"})))
}
pub async fn check_out(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["operator"])?;
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let r=sqlx::query("SELECT status FROM rc14_reservations WHERE entity_id=$1 AND id=$2 FOR UPDATE")
 .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
 if r.get::<String,_>("status")!="checked_in"{return Err(ApiError::conflict("Not checked-in"))}
 sqlx::query("UPDATE rc14_reservations SET status='checked_out',updated_by=$1 WHERE entity_id=$2 AND id=$3")
 .bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"guest_checked_out","rc14_reservation",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok(Json(json!({"id":id,"status":"checked_out","folio_settled":false})))
}
pub async fn leases(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;
 let rows=sqlx::query("SELECT id,unit_reference,tenant,starts_on,ends_on,rent_xaf,deposit_xaf FROM rc14_leases WHERE entity_id=$1 ORDER BY starts_on DESC LIMIT 100")
 .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
 Ok(Json(json!({"items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"unit":r.get::<String,_>("unit_reference"),"tenant":r.get::<String,_>("tenant"),"starts_on":r.get::<NaiveDate,_>("starts_on"),"ends_on":r.get::<NaiveDate,_>("ends_on"),"rent_xaf":r.get::<i64,_>("rent_xaf"),"deposit_xaf":r.get::<i64,_>("deposit_xaf")})).collect::<Vec<_>>()})))
}
pub async fn create_lease(State(s):State<AppState>,h:HeaderMap,Json(p):Json<LeaseInput>)->Result<(StatusCode,Json<Value>),ApiError>{
 let a=auth::require_auth(&h,&s.pool).await?;only(&a,&["manager"])?;
 if !valid(&p.unit_reference,3,80)||!valid(&p.tenant,2,240)||p.ends_on<=p.starts_on||p.rent_xaf<=0||p.deposit_xaf<0 {return Err(ApiError::bad("Invalid lease"))}
 let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
 let id:Uuid=sqlx::query_scalar("INSERT INTO rc14_leases(entity_id,unit_reference,tenant,starts_on,ends_on,rent_xaf,deposit_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id")
 .bind(a.entity_id).bind(&p.unit_reference).bind(&p.tenant).bind(p.starts_on).bind(p.ends_on).bind(p.rent_xaf).bind(p.deposit_xaf).bind(a.user_id)
 .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
 audit(&mut tx,&a,"lease_registered","rc14_lease",id).await?;tx.commit().await.map_err(ApiError::db)?;
 Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"registered_only","payments_recorded":false}))))
}
