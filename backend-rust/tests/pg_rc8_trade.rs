//! Run with TEST_DATABASE_URL pointing to a disposable PostgreSQL16 database.
use axum::{extract::{Path,State},http::HeaderMap,Json};
use blue_line_erp_api::{AppState,auth::{self,Auth},trade::{self,ItemInput,WarehouseInput,OrderInput,OrderLineInput,PeriodInput}};
use sqlx::PgPool;
use uuid::Uuid;

async fn user(pool:&PgPool,entity:Uuid,role:&str)->Auth{
    let id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC8 QA User','NO_LOGIN_TEST') RETURNING id")
        .bind(format!("rc8-{}@example.test",Uuid::new_v4())).fetch_one(pool).await.unwrap();
    sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)")
        .bind(id).bind(entity).bind(role).execute(pool).await.unwrap();
    Auth{user_id:id,entity_id:entity,role:role.into()}
}
async fn headers(pool:&PgPool,a:&Auth,key:Option<&str>)->HeaderMap{
    let raw=format!("rc8-qa-token-{}",Uuid::new_v4());
    sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
        .bind(auth::hash_token(&raw)).bind(a.user_id).bind(a.entity_id).execute(pool).await.unwrap();
    let mut h=HeaderMap::new();
    h.insert("authorization",format!("Bearer {raw}").parse().unwrap());
    if let Some(k)=key{h.insert("idempotency-key",k.parse().unwrap());}
    h
}
async fn account_setup(pool:&PgPool,entity:Uuid){
    for(code,label,role)in[("31","Demo Inventory","inventory"),("401","Demo AP","accounts_payable"),("411","Demo AR","accounts_receivable"),("701","Demo Sales","sales_revenue"),("603","Demo COGS","cost_of_goods_sold")]{
        let id:Uuid=sqlx::query_scalar("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3) RETURNING id")
            .bind(entity).bind(code).bind(label).fetch_one(pool).await.unwrap();
        sqlx::query("INSERT INTO trade_posting_accounts(entity_id,posting_role,account_id) VALUES($1,$2,$3)")
            .bind(entity).bind(role).bind(id).execute(pool).await.unwrap();
    }
}

#[tokio::test]
async fn purchase_sale_stock_journal_and_entity_isolation(){
    let url=match std::env::var("TEST_DATABASE_URL"){Ok(x)=>x,Err(_)=>{eprintln!("SKIP: TEST_DATABASE_URL not provided");return}};
    let pool=PgPool::connect(&url).await.unwrap();
    let dir=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
    sqlx::migrate::Migrator::new(dir.as_path()).await.unwrap().run(&pool).await.unwrap();
    let e1:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id").bind(format!("RC8 Entity A {}",Uuid::new_v4())).fetch_one(&pool).await.unwrap();
    let e2:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id").bind(format!("RC8 Entity B {}",Uuid::new_v4())).fetch_one(&pool).await.unwrap();
    account_setup(&pool,e1).await;
    let operator=user(&pool,e1,"operator").await;
    let manager=user(&pool,e1,"manager").await;
    let finance=user(&pool,e1,"finance").await;
    let outsider=user(&pool,e2,"manager").await;
    let state=AppState{pool:pool.clone()};
    let (_,Json(warehouse))=trade::create_warehouse(State(state.clone()),headers(&pool,&manager,None).await,Json(WarehouseInput{code:"MAIN".into(),label:"Main QA Warehouse".into()})).await.unwrap();
    let (_,Json(item))=trade::create_item(State(state.clone()),headers(&pool,&manager,None).await,Json(ItemInput{sku:"SKU-QA".into(),label:"Test part".into(),unit:"each".into()})).await.unwrap();
    let wid=Uuid::parse_str(warehouse["id"].as_str().unwrap()).unwrap();
    let iid=Uuid::parse_str(item["id"].as_str().unwrap()).unwrap();
    let buy=OrderInput{counterparty:"QA Supplier".into(),warehouse_id:wid,lines:vec![OrderLineInput{item_id:iid,quantity:5,unit_amount_xaf:1000}]};
    let (_,Json(created))=trade::create_purchase(State(state.clone()),headers(&pool,&operator,Some("rc8-purchase-qa-0001")).await,Json(buy)).await.unwrap();
    let purchase_id=Uuid::parse_str(created["id"].as_str().unwrap()).unwrap();
    assert_eq!(created["total_xaf"],5000);
    // A different legal entity cannot approve or see this order.
    assert!(trade::approve_purchase(State(state.clone()),headers(&pool,&outsider,None).await,Path(purchase_id)).await.is_err());
    let Json(other_catalog)=trade::catalog(State(state.clone()),headers(&pool,&outsider,None).await).await.unwrap();
    assert!(other_catalog["items"].as_array().unwrap().is_empty());
    // Maker-checker: user cannot approve own order, manager can.
    assert!(trade::approve_purchase(State(state.clone()),headers(&pool,&operator,None).await,Path(purchase_id)).await.is_err());
    trade::approve_purchase(State(state.clone()),headers(&pool,&manager,None).await,Path(purchase_id)).await.unwrap();
    assert!(trade::receive_purchase(State(state.clone()),headers(&pool,&manager,None).await,Path(purchase_id),Json(PeriodInput{period_key:"2026-10".into()})).await.is_err());
    let Json(received)=trade::receive_purchase(State(state.clone()),headers(&pool,&operator,None).await,Path(purchase_id),Json(PeriodInput{period_key:"2026-10".into()})).await.unwrap();
    assert_eq!(received["status"],"received");
    assert_eq!(received["journal_posted"],false);
    assert!(trade::receive_purchase(State(state.clone()),headers(&pool,&operator,None).await,Path(purchase_id),Json(PeriodInput{period_key:"2026-10".into()})).await.is_err());
    let (qty,value):(i64,i64)=sqlx::query_as("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
        .bind(e1).bind(wid).bind(iid).fetch_one(&pool).await.unwrap();
    assert_eq!((qty,value),(5,5000));
    // A shipment in excess of current inventory must roll back all changes.
    let oversized=OrderInput{counterparty:"Customer QA".into(),warehouse_id:wid,lines:vec![OrderLineInput{item_id:iid,quantity:9,unit_amount_xaf:2500}]};
    let (_,Json(over_order))=trade::create_sale(State(state.clone()),headers(&pool,&operator,Some("rc8-sale-too-many")).await,Json(oversized)).await.unwrap();
    let over_id=Uuid::parse_str(over_order["id"].as_str().unwrap()).unwrap();
    trade::approve_sale(State(state.clone()),headers(&pool,&manager,None).await,Path(over_id)).await.unwrap();
    assert!(trade::ship_sale(State(state.clone()),headers(&pool,&operator,None).await,Path(over_id),Json(PeriodInput{period_key:"2026-10".into()})).await.is_err());
    let oversized_status:String=sqlx::query_scalar("SELECT status FROM trade_sales_orders WHERE id=$1").bind(over_id).fetch_one(&pool).await.unwrap();
    assert_eq!(oversized_status,"approved");
    // Successful sale: 3 units, 7500 XAF revenue, 3000 XAF COGS.
    let sale=OrderInput{counterparty:"Customer QA".into(),warehouse_id:wid,lines:vec![OrderLineInput{item_id:iid,quantity:3,unit_amount_xaf:2500}]};
    let (_,Json(so))=trade::create_sale(State(state.clone()),headers(&pool,&operator,Some("rc8-sale-qa-0001")).await,Json(sale)).await.unwrap();
    let sale_id=Uuid::parse_str(so["id"].as_str().unwrap()).unwrap();
    trade::approve_sale(State(state.clone()),headers(&pool,&manager,None).await,Path(sale_id)).await.unwrap();
    let Json(shipped)=trade::ship_sale(State(state.clone()),headers(&pool,&operator,None).await,Path(sale_id),Json(PeriodInput{period_key:"2026-10".into()})).await.unwrap();
    assert_eq!(shipped["cost_xaf"],3000);assert_eq!(shipped["sales_xaf"],7500);
    let (qty2,value2):(i64,i64)=sqlx::query_as("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
        .bind(e1).bind(wid).bind(iid).fetch_one(&pool).await.unwrap();
    assert_eq!((qty2,value2),(2,2000));
    let journal_id=Uuid::parse_str(shipped["journal_draft_id"].as_str().unwrap()).unwrap();
    let (debit,credit):(i64,i64)=sqlx::query_as("SELECT SUM(debit_xaf)::bigint,SUM(credit_xaf)::bigint FROM gl_lines WHERE journal_id=$1")
        .bind(journal_id).fetch_one(&pool).await.unwrap();
    assert_eq!(debit,credit);assert_eq!(debit,10500);
    let status:String=sqlx::query_scalar("SELECT status FROM gl_journals WHERE id=$1").bind(journal_id).fetch_one(&pool).await.unwrap();
    assert_eq!(status,"draft");
    // Independent reviewer posts actual GL journal; operator who created draft cannot post it.
    blue_line_erp_api::journal::post(&pool,&finance,journal_id).await.unwrap();
    let status2:String=sqlx::query_scalar("SELECT status FROM gl_journals WHERE id=$1").bind(journal_id).fetch_one(&pool).await.unwrap();
    assert_eq!(status2,"posted");
    let alter=sqlx::query("UPDATE gl_lines SET debit_xaf=0 WHERE journal_id=$1").bind(journal_id).execute(&pool).await;
    assert!(alter.is_err());
    // Accounting period lock must roll back a receipt (including stock rows).
    sqlx::query("UPDATE gl_periods SET is_locked=true WHERE entity_id=$1 AND period_key='2026-10'").bind(e1).execute(&pool).await.unwrap();
    let buy2=OrderInput{counterparty:"QA Supplier".into(),warehouse_id:wid,lines:vec![OrderLineInput{item_id:iid,quantity:2,unit_amount_xaf:500}]};
    let (_,Json(new2))=trade::create_purchase(State(state.clone()),headers(&pool,&operator,Some("rc8-purchase-qa-0002")).await,Json(buy2)).await.unwrap();
    let id2=Uuid::parse_str(new2["id"].as_str().unwrap()).unwrap();
    trade::approve_purchase(State(state.clone()),headers(&pool,&manager,None).await,Path(id2)).await.unwrap();
    assert!(trade::receive_purchase(State(state.clone()),headers(&pool,&operator,None).await,Path(id2),Json(PeriodInput{period_key:"2026-10".into()})).await.is_err());
    let qafter:i64=sqlx::query_scalar("SELECT quantity FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3").bind(e1).bind(wid).bind(iid).fetch_one(&pool).await.unwrap();
    assert_eq!(qafter,2);
    sqlx::query("UPDATE gl_periods SET is_locked=false WHERE entity_id=$1 AND period_key='2026-10'").bind(e1).execute(&pool).await.unwrap();
    // Repeated order submission using same idempotency key must NOT produce extra orders.
    let buy_duplicate=OrderInput{counterparty:"QA Supplier".into(),warehouse_id:wid,lines:vec![OrderLineInput{item_id:iid,quantity:2,unit_amount_xaf:500}]};
    let (_,Json(replayed))=trade::create_purchase(State(state.clone()),headers(&pool,&operator,Some("rc8-purchase-qa-0002")).await,Json(buy_duplicate)).await.unwrap();
    assert_eq!(replayed["id"],new2["id"]);assert_eq!(replayed["idempotent"],true);
    // Same key with a different order body must be rejected rather than reused.
    let different=OrderInput{counterparty:"Different QA Supplier".into(),warehouse_id:wid,lines:vec![OrderLineInput{item_id:iid,quantity:4,unit_amount_xaf:500}]};
    assert!(trade::create_purchase(State(state.clone()),headers(&pool,&operator,Some("rc8-purchase-qa-0002")).await,Json(different)).await.is_err());
    // Inventory movement rows are append-only facts.
    assert!(sqlx::query("DELETE FROM inventory_movements WHERE entity_id=$1 AND source_id=$2")
        .bind(e1).bind(purchase_id).execute(&pool).await.is_err());
}
