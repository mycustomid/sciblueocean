use blue_line_erp_api::{AppState,auth,hospitality::{self,RoomInput,PropertyInput,BookingInput}};
use axum::{extract::{State,Path},http::HeaderMap,Json};use chrono::NaiveDate;use uuid::Uuid;use sqlx::PgPool;
async fn actor(p:&PgPool,e:Uuid,role:&str)->HeaderMap{
 let user:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC14 QA','fixture') RETURNING id")
 .bind(format!("{}@test.invalid",Uuid::new_v4())).fetch_one(p).await.unwrap();
 sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)").bind(user).bind(e).bind(role).execute(p).await.unwrap();
 let raw=format!("{}{}",Uuid::new_v4().simple(),Uuid::new_v4().simple());
 sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '2 hours')")
 .bind(auth::hash_token(&raw)).bind(user).bind(e).execute(p).await.unwrap();
 let mut h=HeaderMap::new();h.insert("authorization",format!("Bearer {raw}").parse().unwrap());h
}
#[tokio::test] async fn overlap_same_room_rejected_adjacent_stay_allowed(){
 let url=std::env::var("TEST_DATABASE_URL").expect("Disposable PG required");assert!(!url.contains("prod"));
 let p=PgPool::connect(&url).await.unwrap();let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
 sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&p).await.unwrap();
 let e:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
 .bind(format!("RC14 Hotel {}",Uuid::new_v4())).fetch_one(&p).await.unwrap();
 let e2:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
 .bind(format!("RC14 Other {}",Uuid::new_v4())).fetch_one(&p).await.unwrap();
 let operator=actor(&p,e,"operator").await;let manager=actor(&p,e,"manager").await;let other=actor(&p,e2,"operator").await;
 let st=AppState{pool:p.clone()};
 let (_,Json(property))=hospitality::create_property(State(st.clone()),manager.clone(),Json(PropertyInput{code:"YAOUNDE-1".into(),name:"RC14 Training Hotel".into(),city:"Yaounde".into()})).await.unwrap();
 let (_,Json(room))=hospitality::create_room(State(st.clone()),manager.clone(),Json(RoomInput{property_id:Uuid::parse_str(property["id"].as_str().unwrap()).unwrap(),code:"101".into(),nightly_rate_xaf:30000})).await.unwrap();
 let rid=Uuid::parse_str(room["id"].as_str().unwrap()).unwrap();
 let bk=|from:&str,to:&str|BookingInput{room_id:rid,guest_name:"Test Guest".into(),arrival:NaiveDate::parse_from_str(from,"%Y-%m-%d").unwrap(),departure:NaiveDate::parse_from_str(to,"%Y-%m-%d").unwrap()};
 assert!(hospitality::create_booking(State(st.clone()),other.clone(),Json(bk("2026-11-01","2026-11-03"))).await.is_err());
 let (_,Json(first))=hospitality::create_booking(State(st.clone()),operator.clone(),Json(bk("2026-11-01","2026-11-03"))).await.unwrap();
 assert!(hospitality::create_booking(State(st.clone()),operator.clone(),Json(bk("2026-11-02","2026-11-04"))).await.is_err());
 assert!(hospitality::create_booking(State(st.clone()),operator.clone(),Json(bk("2026-11-03","2026-11-05"))).await.is_ok());
 let first_id=Uuid::parse_str(first["id"].as_str().unwrap()).unwrap();
 assert!(hospitality::check_out(State(st.clone()),operator.clone(),Path(first_id)).await.is_err());
 hospitality::check_in(State(st.clone()),operator.clone(),Path(first_id)).await.unwrap();
 hospitality::check_out(State(st.clone()),operator.clone(),Path(first_id)).await.unwrap();
}
