//! RC10 integration test: only runs when TEST_DATABASE_URL is an isolated disposable PG16 instance.
use axum::{extract::{Path,State},http::HeaderMap,Json};
use blue_line_erp_api::{AppState,auth,returns::{self,ReturnInput,ReturnLine},partial::{self,PartialInput,PartialLine},trade::{self,ItemInput,WarehouseInput,OrderInput,OrderLineInput}};
use sqlx::PgPool;
use uuid::Uuid;

async fn identity(pool:&PgPool,entity:Uuid,role:&str)->Uuid{
 let id:Uuid=sqlx::query_scalar("INSERT INTO app_users(email,display_name,password_hash) VALUES($1,'RC10 QA','TEST_ONLY') RETURNING id")
   .bind(format!("rc10-{}@example.test",Uuid::new_v4())).fetch_one(pool).await.unwrap();
 sqlx::query("INSERT INTO entity_memberships(user_id,entity_id,role) VALUES($1,$2,$3)")
   .bind(id).bind(entity).bind(role).execute(pool).await.unwrap();id
}
async fn headers(pool:&PgPool,user:Uuid,entity:Uuid,key:Option<&str>)->HeaderMap{
 let secret=format!("rc10-{}",Uuid::new_v4());
 sqlx::query("INSERT INTO auth_sessions(token_hash,user_id,entity_id,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')")
   .bind(auth::hash_token(&secret)).bind(user).bind(entity).execute(pool).await.unwrap();
 let mut h=HeaderMap::new();h.insert("authorization",format!("Bearer {}",secret).parse().unwrap());
 if let Some(k)=key{h.insert("idempotency-key",k.parse().unwrap());}h
}
fn return_input(item:Uuid,quantity:i64)->ReturnInput{ReturnInput{period_key:"2026-10".into(),reason:"Rejected after QC inspection".into(),lines:vec![ReturnLine{item_id:item,quantity}]}}
fn partial_input(item:Uuid,quantity:i64)->PartialInput{PartialInput{period_key:"2026-10".into(),lines:vec![PartialLine{item_id:item,quantity}]}}
#[tokio::test]
async fn returns_do_not_duplicate_or_cross_entity_and_post_balanced_drafts(){
 let url=match std::env::var("TEST_DATABASE_URL"){Ok(x)=>x,Err(_)=>{eprintln!("SKIP RC10 PG: TEST_DATABASE_URL missing");return}};
 assert!(!url.contains("prod"),"Use a disposable DB, never production");
 let pool=PgPool::connect(&url).await.unwrap();
 let migrations=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("migrations");
 sqlx::migrate::Migrator::new(migrations.as_path()).await.unwrap().run(&pool).await.unwrap();
 let company:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
   .bind(format!("RC10 Co {}",Uuid::new_v4())).fetch_one(&pool).await.unwrap();
 let outsider_entity:Uuid=sqlx::query_scalar("INSERT INTO legal_entities(legal_name) VALUES($1) RETURNING id")
   .bind(format!("RC10 Outside {}",Uuid::new_v4())).fetch_one(&pool).await.unwrap();
 let maker=identity(&pool,company,"operator").await;
 let manager=identity(&pool,company,"manager").await;
 let outsider=identity(&pool,outsider_entity,"manager").await;
 for (role,code) in [("inventory","31"),("accounts_payable","401"),("accounts_receivable","411"),("sales_revenue","701"),("cost_of_goods_sold","603"),("purchase_price_variance","609")]{
   let account:Uuid=sqlx::query_scalar("INSERT INTO gl_accounts(entity_id,code,label) VALUES($1,$2,$3) RETURNING id")
     .bind(company).bind(code).bind(format!("RC10 {role}")).fetch_one(&pool).await.unwrap();
   sqlx::query("INSERT INTO trade_posting_accounts(entity_id,posting_role,account_id) VALUES($1,$2,$3)")
     .bind(company).bind(role).bind(account).execute(&pool).await.unwrap();
 }
 let app=AppState{pool:pool.clone()};
 let (_,Json(wh))=trade::create_warehouse(State(app.clone()),headers(&pool,manager,company,None).await,Json(WarehouseInput{code:"RC10-A".into(),label:"Test warehouse".into()})).await.unwrap();
 let (_,Json(item))=trade::create_item(State(app.clone()),headers(&pool,manager,company,None).await,Json(ItemInput{sku:"RC10-SKU".into(),label:"Test product".into(),unit:"each".into()})).await.unwrap();
 let wh_id=Uuid::parse_str(wh["id"].as_str().unwrap()).unwrap();let item_id=Uuid::parse_str(item["id"].as_str().unwrap()).unwrap();
 let (_,Json(po))=trade::create_purchase(State(app.clone()),headers(&pool,maker,company,Some("rc10-po-unique-01")).await,Json(OrderInput{counterparty:"Supplier RC10".into(),warehouse_id:wh_id,lines:vec![OrderLineInput{item_id,quantity:10,unit_amount_xaf:1000}]})).await.unwrap();
 let po_id=Uuid::parse_str(po["id"].as_str().unwrap()).unwrap();
 trade::approve_purchase(State(app.clone()),headers(&pool,manager,company,None).await,Path(po_id)).await.unwrap();
 let (_,Json(rcv))=partial::receive_partial(State(app.clone()),headers(&pool,maker,company,Some("rc10-receipt-01")).await,Path(po_id),Json(partial_input(item_id,10))).await.unwrap();
 let receipt_id=Uuid::parse_str(rcv["event_id"].as_str().unwrap()).unwrap();
 let (_,Json(so))=trade::create_sale(State(app.clone()),headers(&pool,maker,company,Some("rc10-so-unique-01")).await,Json(OrderInput{counterparty:"Customer RC10".into(),warehouse_id:wh_id,lines:vec![OrderLineInput{item_id,quantity:5,unit_amount_xaf:2000}]})).await.unwrap();
 let so_id=Uuid::parse_str(so["id"].as_str().unwrap()).unwrap();
 trade::approve_sale(State(app.clone()),headers(&pool,manager,company,None).await,Path(so_id)).await.unwrap();
 let (_,Json(shipment))=partial::ship_partial(State(app.clone()),headers(&pool,maker,company,Some("rc10-shipment-01")).await,Path(so_id),Json(partial_input(item_id,5))).await.unwrap();
 let shipment_id=Uuid::parse_str(shipment["event_id"].as_str().unwrap()).unwrap();
 let (_,Json(first))=returns::create_return(State(app.clone()),headers(&pool,manager,company,Some("rc10-customer-01")).await,Path(shipment_id),Json(return_input(item_id,2))).await.unwrap();
 assert_eq!(first["commercial_xaf"],4000);assert_eq!(first["inventory_value_xaf"],2000);assert_eq!(first["journal_posted"],false);
 let (_,Json(retry))=returns::create_return(State(app.clone()),headers(&pool,manager,company,Some("rc10-customer-01")).await,Path(shipment_id),Json(return_input(item_id,2))).await.unwrap();
 assert_eq!(first["return_id"],retry["return_id"]);assert_eq!(retry["idempotent"],true);
 assert!(returns::create_return(State(app.clone()),headers(&pool,manager,company,Some("rc10-customer-01")).await,Path(shipment_id),Json(return_input(item_id,3))).await.is_err());
 assert!(returns::create_return(State(app.clone()),headers(&pool,manager,company,Some("rc10-customer-too-many")).await,Path(shipment_id),Json(return_input(item_id,4))).await.is_err());
 assert!(returns::create_return(State(app.clone()),headers(&pool,maker,company,Some("rc10-not-manager")).await,Path(shipment_id),Json(return_input(item_id,1))).await.is_err());
 assert!(returns::create_return(State(app.clone()),headers(&pool,outsider,outsider_entity,Some("rc10-cross-company")).await,Path(shipment_id),Json(return_input(item_id,1))).await.is_err());
 let (_,Json(second))=returns::create_return(State(app.clone()),headers(&pool,manager,company,Some("rc10-customer-02")).await,Path(shipment_id),Json(return_input(item_id,3))).await.unwrap();
 assert_eq!(second["commercial_xaf"],6000);assert_eq!(second["inventory_value_xaf"],3000);
 let (_,Json(supplier))=returns::create_return(State(app.clone()),headers(&pool,manager,company,Some("rc10-supplier-01")).await,Path(receipt_id),Json(return_input(item_id,2))).await.unwrap();
 assert_eq!(supplier["commercial_xaf"],2000);assert_eq!(supplier["inventory_value_xaf"],2000);
 let (qty,value):(i64,i64)=sqlx::query_as("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3")
     .bind(company).bind(wh_id).bind(item_id).fetch_one(&pool).await.unwrap();
 assert_eq!((qty,value),(8,8000));
 for v in [&first,&second,&supplier]{
   let jid=Uuid::parse_str(v["journal_draft_id"].as_str().unwrap()).unwrap();
   let (debit,credit):(i64,i64)=sqlx::query_as("SELECT sum(debit_xaf)::bigint,sum(credit_xaf)::bigint FROM gl_lines WHERE entity_id=$1 AND journal_id=$2")
     .bind(company).bind(jid).fetch_one(&pool).await.unwrap();
   assert!(debit>0);assert_eq!(debit,credit);
 }
 // Deliberately vary cost: a fresh receipt at 2000 changes WAC from 1000 to 1200.
 // Returning an original 1000-XAF unit to supplier must use WAC for inventory
 // and an explicit purchase-price-variance GL line, never an unbalanced draft.
 let (_,Json(expensive_po))=trade::create_purchase(State(app.clone()),headers(&pool,maker,company,Some("rc10-po-higher-cost")).await,Json(OrderInput{counterparty:"Different supplier".into(),warehouse_id:wh_id,lines:vec![OrderLineInput{item_id,quantity:2,unit_amount_xaf:2000}]})).await.unwrap();
 let expensive_po_id=Uuid::parse_str(expensive_po["id"].as_str().unwrap()).unwrap();
 trade::approve_purchase(State(app.clone()),headers(&pool,manager,company,None).await,Path(expensive_po_id)).await.unwrap();
 partial::receive_partial(State(app.clone()),headers(&pool,maker,company,Some("rc10-receipt-high-cost")).await,Path(expensive_po_id),Json(partial_input(item_id,2))).await.unwrap();
 let (_,Json(variance_return))=returns::create_return(State(app.clone()),headers(&pool,manager,company,Some("rc10-supplier-variance")).await,Path(receipt_id),Json(return_input(item_id,2))).await.unwrap();
 assert_eq!(variance_return["commercial_xaf"],2000);
 assert_eq!(variance_return["inventory_value_xaf"],2400);
 let variance_journal=Uuid::parse_str(variance_return["journal_draft_id"].as_str().unwrap()).unwrap();
 let (debit,credit):(i64,i64)=sqlx::query_as("SELECT sum(debit_xaf)::bigint,sum(credit_xaf)::bigint FROM gl_lines WHERE entity_id=$1 AND journal_id=$2")
   .bind(company).bind(variance_journal).fetch_one(&pool).await.unwrap();
 assert_eq!((debit,credit),(2400,2400));
 let variance_debit:i64=sqlx::query_scalar("SELECT sum(l.debit_xaf)::bigint FROM gl_lines l JOIN gl_accounts a ON a.id=l.account_id AND a.entity_id=l.entity_id WHERE l.entity_id=$1 AND l.journal_id=$2 AND a.code='609'")
   .bind(company).bind(variance_journal).fetch_one(&pool).await.unwrap();
 assert_eq!(variance_debit,400);
 let return_id=Uuid::parse_str(first["return_id"].as_str().unwrap()).unwrap();
 assert!(sqlx::query("UPDATE trade_returns SET commercial_xaf=1 WHERE id=$1").bind(return_id).execute(&pool).await.is_err());
 let pre_count:i64=sqlx::query_scalar("SELECT count(*) FROM trade_returns WHERE entity_id=$1").bind(company).fetch_one(&pool).await.unwrap();
 sqlx::query("UPDATE gl_periods SET is_locked=true WHERE entity_id=$1 AND period_key='2026-10'").bind(company).execute(&pool).await.unwrap();
 assert!(returns::create_return(State(app.clone()),headers(&pool,manager,company,Some("rc10-period-locked")).await,Path(receipt_id),Json(return_input(item_id,1))).await.is_err());
 let post_count:i64=sqlx::query_scalar("SELECT count(*) FROM trade_returns WHERE entity_id=$1").bind(company).fetch_one(&pool).await.unwrap();
 assert_eq!(pre_count,post_count);
}
