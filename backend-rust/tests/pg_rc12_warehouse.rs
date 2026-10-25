//! Execute against a dedicated disposable PostgreSQL database (TEST_DATABASE_URL).
//! Tests real SQLx, actual migrations, legal-entity scope, maker-checker,
//! paired movements, rollback, idempotency and journal balance.
use axum::{extract::{Path,State},http::HeaderMap,Json};
use blue_line_erp_api::{AppState,auth::{self,Auth},warehouse::{self,TransferInput,CountInput},trade::{self,ItemInput,WarehouseInput}};
use sqlx::{PgPool,Row};
use uuid::Uuid;

async fn identity(p:&PgPool,e:Uuid,role:&str)->(Auth,HeaderMap){
    let id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC12 QA','not-a-real-password') RETURNING id")
        .bind(format!("rc12-{}@test.invalid",Uuid::new_v4())).fetch_one(p).await.unwrap();
    sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)")
        .bind(id).bind(e).bind(role).execute(p).await.unwrap();
    let secret=format!("rc12-{}-{}",Uuid::new_v4(),Uuid::new_v4());
    sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
        .bind(auth::hash_token(&secret)).bind(id).bind(e).execute(p).await.unwrap();
    let mut h=HeaderMap::new();h.insert("authorization",format!("Bearer {}",secret).parse().unwrap());
    (Auth{user_id:id,entity_id:e,role:role.into()},h)
}
fn keyed(h:&HeaderMap,k:&str)->HeaderMap{let mut x=h.clone();x.insert("idempotency-key",k.parse().unwrap());x}
fn transfer(from:Uuid,to:Uuid,item:Uuid,qty:i64)->TransferInput{
    TransferInput{from_warehouse_id:from,to_warehouse_id:to,item_id:item,quantity:qty,reason:"Inter-depot stock relocation confirmed".into()}
}
fn count(wh:Uuid,item:Uuid,qty:i64,opening:Option<i64>)->CountInput{
    CountInput{warehouse_id:wh,item_id:item,counted_quantity:qty,opening_unit_cost_xaf:opening,period_key:"2026-10".into(),reason:"Signed physical warehouse count".into()}
}
#[tokio::test]
async fn rc12_two_warehouses_count_and_gl_conservation(){
    let url=std::env::var("TEST_DATABASE_URL").expect("RC12 release gate REQUIRES TEST_DATABASE_URL");
    assert!(!url.to_ascii_lowercase().contains("prod"),"Never test against production");
    let p=PgPool::connect(&url).await.unwrap();
    let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&p).await.unwrap();
    let version:i64=sqlx::query_scalar("SELECT MAX(version) FROM _sqlx_migrations WHERE success").fetch_one(&p).await.unwrap();
    assert_eq!(version,12);
    let e:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
        .bind(format!("RC12 warehouse {}",Uuid::new_v4())).fetch_one(&p).await.unwrap();
    let e2:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
        .bind(format!("RC12 other company {}",Uuid::new_v4())).fetch_one(&p).await.unwrap();
    let (_,maker_h)=identity(&p,e,"operator").await;
    let (_,manager_h)=identity(&p,e,"manager").await;
    let (_,other_h)=identity(&p,e2,"manager").await;
    let state=AppState{pool:p.clone()};
    let (_,Json(a))=trade::create_warehouse(State(state.clone()),manager_h.clone(),Json(WarehouseInput{code:"RCTW01".into(),label:"RC12 source warehouse".into()})).await.unwrap();
    let (_,Json(b))=trade::create_warehouse(State(state.clone()),manager_h.clone(),Json(WarehouseInput{code:"RCTW02".into(),label:"RC12 destination warehouse".into()})).await.unwrap();
    let (_,Json(it))=trade::create_item(State(state.clone()),manager_h.clone(),Json(ItemInput{sku:"RC12SKU".into(),label:"RC12 item".into(),unit:"each".into()})).await.unwrap();
    let from=Uuid::parse_str(a["id"].as_str().unwrap()).unwrap();
    let to=Uuid::parse_str(b["id"].as_str().unwrap()).unwrap();
    let item=Uuid::parse_str(it["id"].as_str().unwrap()).unwrap();
    // Test fixture: 10 units valued at 10_000 XAF (seed without posting: QA ONLY).
    sqlx::query("INSERT INTO inventory_balances(entity_id,warehouse_id,item_id,quantity,value_xaf) VALUES($1,$2,$3,10,10000)")
        .bind(e).bind(from).bind(item).execute(&p).await.unwrap();
    let payload=transfer(from,to,item,4);
    assert!(warehouse::submit_transfer(State(state.clone()),keyed(&other_h,"rc12-foreign-transfer"),Json(transfer(from,to,item,4))).await.is_err());
    let (_,Json(created))=warehouse::submit_transfer(State(state.clone()),keyed(&maker_h,"rc12-transfer-1"),Json(payload)).await.unwrap();
    let trans=Uuid::parse_str(created["id"].as_str().unwrap()).unwrap();
    let (_,Json(replayed))=warehouse::submit_transfer(State(state.clone()),keyed(&maker_h,"rc12-transfer-1"),Json(transfer(from,to,item,4))).await.unwrap();
    assert_eq!(created["id"],replayed["id"]);assert_eq!(replayed["idempotent"],true);
    assert!(warehouse::submit_transfer(State(state.clone()),keyed(&maker_h,"rc12-transfer-1"),Json(transfer(from,to,item,3))).await.is_err());
    assert!(warehouse::approve_transfer(State(state.clone()),other_h.clone(),Path(trans)).await.is_err());
    assert!(warehouse::approve_transfer(State(state.clone()),maker_h.clone(),Path(trans)).await.is_err());
    let Json(applied)=warehouse::approve_transfer(State(state.clone()),manager_h.clone(),Path(trans)).await.unwrap();
    assert_eq!(applied["status"],"applied");assert_eq!(applied["value_xaf"],4000);
    let source:(i64,i64)=sqlx::query_as("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
        .bind(e).bind(from).bind(item).fetch_one(&p).await.unwrap();
    let dest:(i64,i64)=sqlx::query_as("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
        .bind(e).bind(to).bind(item).fetch_one(&p).await.unwrap();
    assert_eq!(source,(6,6000));assert_eq!(dest,(4,4000));
    assert!(warehouse::approve_transfer(State(state.clone()),manager_h.clone(),Path(trans)).await.is_err());
    let (sum_qty,sum_value):(i64,i64)=sqlx::query_as("SELECT SUM(quantity_delta)::bigint,SUM(value_delta_xaf)::bigint FROM inventory_movements WHERE entity_id=$1 AND source_id=$2")
        .bind(e).bind(trans).fetch_one(&p).await.unwrap();
    assert_eq!((sum_qty,sum_value),(0,0));
    assert!(sqlx::query("UPDATE inventory_transfers SET reason='changed maliciously' WHERE id=$1").bind(trans).execute(&p).await.is_err());
    // Must map explicit, accountant-reviewed GL roles, never assume OHADA numbers.
    for (role,code) in [("inventory","31"),("inventory_adjustment_gain","758"),("inventory_adjustment_loss","658")]{
        let account:Uuid=sqlx::query_scalar("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3) RETURNING id")
            .bind(e).bind(code).bind(format!("RC12 UNVERIFIED {role}")).fetch_one(&p).await.unwrap();
        sqlx::query("INSERT INTO trade_posting_accounts(entity_id,posting_role,account_id) VALUES($1,$2,$3)")
            .bind(e).bind(role).bind(account).execute(&p).await.unwrap();
    }
    // Snapshot 4, physical count 3: one unit deficiency worth 1000 XAF.
    let (_,Json(c))=warehouse::submit_count(State(state.clone()),keyed(&maker_h,"rc12-count-short"),Json(count(to,item,3,None))).await.unwrap();
    let count_id=Uuid::parse_str(c["id"].as_str().unwrap()).unwrap();
    assert!(warehouse::approve_count(State(state.clone()),other_h.clone(),Path(count_id)).await.is_err());
    assert!(warehouse::approve_count(State(state.clone()),maker_h.clone(),Path(count_id)).await.is_err());
    let Json(f)=warehouse::approve_count(State(state.clone()),manager_h.clone(),Path(count_id)).await.unwrap();
    assert_eq!(f["value_delta_xaf"],-1000);assert_eq!(f["journal_posted"],false);
    let journal=Uuid::parse_str(f["journal_draft_id"].as_str().unwrap()).unwrap();
    let (dr,cr):(i64,i64)=sqlx::query_as("SELECT SUM(debit_xaf)::bigint,SUM(credit_xaf)::bigint FROM gl_lines WHERE entity_id=$1 AND journal_id=$2")
        .bind(e).bind(journal).fetch_one(&p).await.unwrap();assert_eq!(dr,cr);assert_eq!(dr,1000);
    assert!(sqlx::query("UPDATE inventory_stock_counts SET counted_quantity=123 WHERE id=$1").bind(count_id).execute(&p).await.is_err());
    // Discover 2 units in a previously empty SKU with an explicit opening unit cost.
    let (_,Json(new_item))=trade::create_item(State(state.clone()),manager_h.clone(),Json(ItemInput{sku:"RC12NEW".into(),label:"RC12 counted discovery".into(),unit:"each".into()})).await.unwrap();
    let new_id=Uuid::parse_str(new_item["id"].as_str().unwrap()).unwrap();
    let (_,Json(found_doc))=warehouse::submit_count(State(state.clone()),keyed(&maker_h,"rc12-zero-opening"),Json(count(to,new_id,2,Some(700)))).await.unwrap();
    let found_id=Uuid::parse_str(found_doc["id"].as_str().unwrap()).unwrap();
    let Json(found)=warehouse::approve_count(State(state.clone()),manager_h.clone(),Path(found_id)).await.unwrap();
    assert_eq!(found["value_delta_xaf"],1400);
    let new_balance:(i64,i64)=sqlx::query_as("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
        .bind(e).bind(to).bind(new_id).fetch_one(&p).await.unwrap();
    assert_eq!(new_balance,(2,1400));
    let (_,Json(too_large))=warehouse::submit_transfer(State(state.clone()),keyed(&maker_h,"rc12-insufficient"),Json(transfer(to,from,item,50))).await.unwrap();
    let excess_id=Uuid::parse_str(too_large["id"].as_str().unwrap()).unwrap();
    assert!(warehouse::approve_transfer(State(state.clone()),manager_h.clone(),Path(excess_id)).await.is_err());
    // A stale count must fail even if a different approved transfer changed warehouse quantity.
    let (_,Json(stale))=warehouse::submit_count(State(state.clone()),keyed(&maker_h,"rc12-count-stale"),Json(count(from,item,5,None))).await.unwrap();
    let stale_id=Uuid::parse_str(stale["id"].as_str().unwrap()).unwrap();
    sqlx::query("UPDATE inventory_balances SET quantity=5,value_xaf=5000 WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
        .bind(e).bind(from).bind(item).execute(&p).await.unwrap();
    assert!(warehouse::approve_count(State(state.clone()),manager_h.clone(),Path(stale_id)).await.is_err());
    // Locked period must roll back count adjustment, both movement and GL.
    let (_,Json(locked_doc))=warehouse::submit_count(State(state.clone()),keyed(&maker_h,"rc12-count-locked"),Json(count(to,item,2,None))).await.unwrap();
    let locked_id=Uuid::parse_str(locked_doc["id"].as_str().unwrap()).unwrap();
    sqlx::query("UPDATE gl_periods SET is_locked=true WHERE entity_id=$1 AND period_key='2026-10'").bind(e).execute(&p).await.unwrap();
    assert!(warehouse::approve_count(State(state.clone()),manager_h.clone(),Path(locked_id)).await.is_err());
    let q:i64=sqlx::query_scalar("SELECT quantity FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
        .bind(e).bind(to).bind(item).fetch_one(&p).await.unwrap();assert_eq!(q,3);
    let m:i64=sqlx::query_scalar("SELECT count(*) FROM inventory_movements WHERE entity_id=$1 AND source_id=$2")
        .bind(e).bind(locked_id).fetch_one(&p).await.unwrap();assert_eq!(m,0);
}
