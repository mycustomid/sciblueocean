//! RC9 integration tests require disposable TEST_DATABASE_URL and Rust toolchain.
//! These tests are intentionally SKIPPED without a database, not counted as passes.
use axum::{extract::{Path,State},http::HeaderMap,Json};
use blue_line_erp_api::{AppState,auth::{self,Auth},partial::{self,PartialInput,PartialLine},trade::{self,ItemInput,WarehouseInput,OrderInput,OrderLineInput}};
use sqlx::PgPool;
use uuid::Uuid;
async fn identity(pool:&PgPool,entity:Uuid,role:&str)->Auth{
    let id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC9 QA','TEST_ONLY') RETURNING id")
       .bind(format!("qa9-{}@example.test",Uuid::new_v4())).fetch_one(pool).await.unwrap();
    sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)")
       .bind(id).bind(entity).bind(role).execute(pool).await.unwrap();
    Auth{user_id:id,entity_id:entity,role:role.into()}
}
async fn headers(pool:&PgPool,a:&Auth,key:Option<&str>)->HeaderMap{
    let secret=format!("rc9-{}",Uuid::new_v4());
    sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
        .bind(auth::hash_token(&secret)).bind(a.user_id).bind(a.entity_id).execute(pool).await.unwrap();
    let mut h=HeaderMap::new();h.insert("authorization",format!("Bearer {}",secret).parse().unwrap());
    if let Some(k)=key{h.insert("idempotency-key",k.parse().unwrap());}h
}
async fn maps(pool:&PgPool,entity:Uuid){
    for (role,code) in [("inventory","31"),("accounts_payable","401"),("accounts_receivable","411"),("sales_revenue","701"),("cost_of_goods_sold","603")]{
      let id:Uuid=sqlx::query_scalar("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3) RETURNING id")
        .bind(entity).bind(code).bind(format!("RC9 demo {role}")).fetch_one(pool).await.unwrap();
      sqlx::query("INSERT INTO trade_posting_accounts(entity_id,posting_role,account_id) VALUES($1,$2,$3)")
        .bind(entity).bind(role).bind(id).execute(pool).await.unwrap();
    }
}
fn input(item_id:Uuid,quantity:i64)->PartialInput{PartialInput{period_key:"2026-10".into(),lines:vec![PartialLine{item_id,quantity}]}}
#[tokio::test]
async fn staged_receipts_shipments_atomicity_and_backorders(){
    let url=match std::env::var("TEST_DATABASE_URL"){Ok(x)=>x,Err(_)=>{eprintln!("SKIP RC9 PG: TEST_DATABASE_URL missing");return}};
    let pool=PgPool::connect(&url).await.unwrap();
    let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&pool).await.unwrap();
    let entity:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
        .bind(format!("RC9 Test Enterprise {}",Uuid::new_v4())).fetch_one(&pool).await.unwrap();
    let other:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
        .bind(format!("RC9 Other {}",Uuid::new_v4())).fetch_one(&pool).await.unwrap();
    maps(&pool,entity).await;
    let maker=identity(&pool,entity,"operator").await;
    let manager=identity(&pool,entity,"manager").await;
    let outsider=identity(&pool,other,"operator").await;
    let state=AppState{pool:pool.clone()};
    let (_,Json(wh))=trade::create_warehouse(State(state.clone()),headers(&pool,&manager,None).await,Json(WarehouseInput{code:"RC9WH".into(),label:"RC9 warehouse".into()})).await.unwrap();
    let (_,Json(item))=trade::create_item(State(state.clone()),headers(&pool,&manager,None).await,Json(ItemInput{sku:"RC9SKU".into(),label:"RC9 item".into(),unit:"each".into()})).await.unwrap();
    let wh_id=Uuid::parse_str(wh["id"].as_str().unwrap()).unwrap();
    let item_id=Uuid::parse_str(item["id"].as_str().unwrap()).unwrap();
    let purchase=OrderInput{counterparty:"Supplier RC9".into(),warehouse_id:wh_id,lines:vec![OrderLineInput{item_id,quantity:8,unit_amount_xaf:1000}]};
    let (_,Json(po))=trade::create_purchase(State(state.clone()),headers(&pool,&maker,Some("rc9-create-po-1")).await,Json(purchase)).await.unwrap();
    let po_id=Uuid::parse_str(po["id"].as_str().unwrap()).unwrap();
    trade::approve_purchase(State(state.clone()),headers(&pool,&manager,None).await,Path(po_id)).await.unwrap();
    assert!(partial::receive_partial(State(state.clone()),headers(&pool,&manager,Some("rc9-invalid-maker")).await,Path(po_id),Json(input(item_id,2))).await.is_err());
    assert!(partial::receive_partial(State(state.clone()),headers(&pool,&outsider,Some("rc9-wrong-tenant")).await,Path(po_id),Json(input(item_id,2))).await.is_err());
    let (_,Json(first))=partial::receive_partial(State(state.clone()),headers(&pool,&maker,Some("rc9-receipt-1")).await,Path(po_id),Json(input(item_id,3))).await.unwrap();
    assert_eq!(first["status"],"partially_received");assert_eq!(first["commercial_xaf"],3000);
    let (_,Json(retry))=partial::receive_partial(State(state.clone()),headers(&pool,&maker,Some("rc9-receipt-1")).await,Path(po_id),Json(input(item_id,3))).await.unwrap();
    assert_eq!(first["event_id"],retry["event_id"]);assert_eq!(retry["idempotent"],true);
    assert!(partial::receive_partial(State(state.clone()),headers(&pool,&maker,Some("rc9-receipt-1")).await,Path(po_id),Json(input(item_id,4))).await.is_err());
    assert!(partial::receive_partial(State(state.clone()),headers(&pool,&maker,Some("rc9-over-receipt")).await,Path(po_id),Json(input(item_id,6))).await.is_err());
    let Json(progress)=partial::purchase_lines(State(state.clone()),headers(&pool,&maker,None).await,Path(po_id)).await.unwrap();
    assert_eq!(progress["lines"][0]["backorder"],5);
    let (_,Json(second))=partial::receive_partial(State(state.clone()),headers(&pool,&maker,Some("rc9-receipt-2")).await,Path(po_id),Json(input(item_id,5))).await.unwrap();
    assert_eq!(second["status"],"received");
    let sale=OrderInput{counterparty:"Client RC9".into(),warehouse_id:wh_id,lines:vec![OrderLineInput{item_id,quantity:6,unit_amount_xaf:2400}]};
    let (_,Json(so))=trade::create_sale(State(state.clone()),headers(&pool,&maker,Some("rc9-create-so-1")).await,Json(sale)).await.unwrap();
    let so_id=Uuid::parse_str(so["id"].as_str().unwrap()).unwrap();
    trade::approve_sale(State(state.clone()),headers(&pool,&manager,None).await,Path(so_id)).await.unwrap();
    let (_,Json(ship1))=partial::ship_partial(State(state.clone()),headers(&pool,&maker,Some("rc9-shipment-1")).await,Path(so_id),Json(input(item_id,2))).await.unwrap();
    assert_eq!(ship1["status"],"partially_shipped");assert_eq!(ship1["commercial_xaf"],4800);assert_eq!(ship1["stock_cost_xaf"],2000);
    let (_,Json(ship2))=partial::ship_partial(State(state.clone()),headers(&pool,&maker,Some("rc9-shipment-2")).await,Path(so_id),Json(input(item_id,4))).await.unwrap();
    assert_eq!(ship2["status"],"shipped");
    let (qty,value):(i64,i64)=sqlx::query_as("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
       .bind(entity).bind(wh_id).bind(item_id).fetch_one(&pool).await.unwrap();
    assert_eq!((qty,value),(2,2000));
    let journal_id=Uuid::parse_str(ship1["journal_draft_id"].as_str().unwrap()).unwrap();
    let (dr,cr):(i64,i64)=sqlx::query_as("SELECT SUM(debit_xaf)::bigint,SUM(credit_xaf)::bigint FROM gl_lines WHERE journal_id=$1")
       .bind(journal_id).fetch_one(&pool).await.unwrap();
    assert_eq!(dr,cr);
    let event_id=Uuid::parse_str(ship1["event_id"].as_str().unwrap()).unwrap();
    assert!(sqlx::query("UPDATE trade_fulfilments SET amount_xaf=42 WHERE id=$1")
       .bind(event_id).execute(&pool).await.is_err());
    // Locked accounting period must roll back the stock movement and increment counts.
    let buy2=OrderInput{counterparty:"Supplier RC9".into(),warehouse_id:wh_id,lines:vec![OrderLineInput{item_id,quantity:1,unit_amount_xaf:1000}]};
    let (_,Json(po2))=trade::create_purchase(State(state.clone()),headers(&pool,&maker,Some("rc9-create-po-2")).await,Json(buy2)).await.unwrap();
    let po2_id=Uuid::parse_str(po2["id"].as_str().unwrap()).unwrap();
    trade::approve_purchase(State(state.clone()),headers(&pool,&manager,None).await,Path(po2_id)).await.unwrap();
    sqlx::query("UPDATE gl_periods SET is_locked=true WHERE entity_id=$1 AND period_key='2026-10'").bind(entity).execute(&pool).await.unwrap();
    assert!(partial::receive_partial(State(state.clone()),headers(&pool,&maker,Some("rc9-locked-period")).await,Path(po2_id),Json(input(item_id,1))).await.is_err());
    let count:i64=sqlx::query_scalar("SELECT count(*) FROM trade_fulfilments WHERE entity_id=$1 AND order_id=$2")
       .bind(entity).bind(po2_id).fetch_one(&pool).await.unwrap();
    assert_eq!(count,0);
    sqlx::query("UPDATE gl_periods SET is_locked=false WHERE entity_id=$1 AND period_key='2026-10'").bind(entity).execute(&pool).await.unwrap();
}
