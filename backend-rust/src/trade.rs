//! RC8 bounded purchase -> receipt -> stock -> sale -> shipment -> GL draft.
//! XAF integer accounting, full-order only. No tax calculation, no refunds, no stock opening import.
use axum::{extract::{Path,State},http::{HeaderMap,StatusCode},Json};
use serde::{Deserialize,Serialize};
use serde_json::{Value,json};
use sqlx::{PgPool,Postgres,Row,Transaction};
use uuid::Uuid;
use sha2::{Sha256,Digest};
use crate::{AppState,auth::{self,Auth},error::ApiError};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ItemInput { pub sku:String,pub label:String,pub unit:String }
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WarehouseInput { pub code:String,pub label:String }
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct MappingInput {pub posting_role:String,pub account_code:String}
#[derive(Deserialize,Serialize,Clone)]
#[serde(deny_unknown_fields)]
pub struct OrderLineInput {pub item_id:Uuid,pub quantity:i64,pub unit_amount_xaf:i64}
#[derive(Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct OrderInput {pub counterparty:String,pub warehouse_id:Uuid,pub lines:Vec<OrderLineInput>}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PeriodInput {pub period_key:String}
const MAX_TOTAL:i128=9_000_000_000_000_000;
const ROLES:[&str;8]=["inventory","accounts_payable","accounts_receivable","sales_revenue","cost_of_goods_sold","purchase_price_variance","inventory_adjustment_gain","inventory_adjustment_loss"];
fn require_role(auth:&Auth,valid:&[&str])->Result<(),ApiError>{
    if valid.contains(&auth.role.as_str()){Ok(())}else{Err(ApiError::forbidden())}
}
fn validate_label(value:&str,max:usize)->Result<(),ApiError>{
    if value.trim().len()<2||value.len()>max{return Err(ApiError::bad("Invalid name or label"))}
    Ok(())
}
pub fn validate_order(payload:&OrderInput)->Result<i64,ApiError>{
    validate_label(&payload.counterparty,240)?;
    if payload.lines.is_empty()||payload.lines.len()>50{return Err(ApiError::bad("Provide 1..50 lines"))}
    let mut seen=std::collections::HashSet::new();let mut total=0i128;
    for l in &payload.lines{
        if !seen.insert(l.item_id){return Err(ApiError::bad("Duplicate item in an order"))}
        if !(1..=1_000_000).contains(&l.quantity)||!(1..=1_000_000_000).contains(&l.unit_amount_xaf){return Err(ApiError::bad("Quantity or price out of bounds"))}
        total+=i128::from(l.quantity)*i128::from(l.unit_amount_xaf);
        if total>MAX_TOTAL{return Err(ApiError::bad("Order amount exceeds safe XAF limit"))}
    }
    i64::try_from(total).map_err(|_|ApiError::bad("Order amount overflow"))
}
pub(crate) fn validate_period(s:&str)->Result<(),ApiError>{
    let b=s.as_bytes();
    if b.len()!=7||b[4]!=b'-'||!b.iter().enumerate().all(|(i,c)|i==4||c.is_ascii_digit())||!(1..=12).contains(&s[5..].parse::<u8>().unwrap_or(0)){return Err(ApiError::bad("Period must be YYYY-MM"))}
    Ok(())
}
pub(crate) fn require_idempotency(headers:&HeaderMap)->Result<String,ApiError>{
    let key=headers.get("idempotency-key").and_then(|h|h.to_str().ok()).ok_or_else(||ApiError::bad("Idempotency-Key required"))?;
    if key.len()<8||key.len()>120||!key.bytes().all(|b|b.is_ascii_alphanumeric()||b"-_".contains(&b)){return Err(ApiError::bad("Invalid idempotency key"))}
    Ok(key.to_owned())
}

pub async fn create_item(State(s):State<AppState>,h:HeaderMap,Json(p):Json<ItemInput>)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;require_role(&a,&["manager","finance"])?;
    validate_label(&p.sku,48)?;validate_label(&p.label,240)?;
    if !["each","kg","litre","metre"].contains(&p.unit.as_str()){return Err(ApiError::bad("Invalid unit"))}
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    let id:Uuid=sqlx::query_scalar("INSERT INTO inventory_items(entity_id,sku,label,unit) VALUES($1,$2,$3,$4) RETURNING id")
        .bind(a.entity_id).bind(p.sku.trim()).bind(p.label.trim()).bind(&p.unit).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'inventory_item_created','inventory_item',$3,$4)")
        .bind(a.entity_id).bind(a.user_id).bind(id).bind(json!({"sku":p.sku})).execute(&mut *tx).await.map_err(ApiError::db)?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok((StatusCode::CREATED,Json(json!({"id":id,"entity_id":a.entity_id,"status":"created"}))))
}
pub async fn create_warehouse(State(s):State<AppState>,h:HeaderMap,Json(p):Json<WarehouseInput>)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;require_role(&a,&["manager"])?;
    validate_label(&p.code,48)?;validate_label(&p.label,240)?;
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    let id:Uuid=sqlx::query_scalar("INSERT INTO inventory_warehouses(entity_id,code,label) VALUES($1,$2,$3) RETURNING id")
        .bind(a.entity_id).bind(p.code.trim()).bind(p.label.trim()).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'warehouse_created','warehouse',$3,$4)")
        .bind(a.entity_id).bind(a.user_id).bind(id).bind(json!({"code":p.code})).execute(&mut *tx).await.map_err(ApiError::db)?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok((StatusCode::CREATED,Json(json!({"id":id,"entity_id":a.entity_id,"status":"created"}))))
}
pub async fn map_account(State(s):State<AppState>,h:HeaderMap,Json(p):Json<MappingInput>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;require_role(&a,&["finance"])?;
    if !ROLES.contains(&p.posting_role.as_str()){return Err(ApiError::bad("Unknown posting role"))}
    let account:Option<Uuid>=sqlx::query_scalar("SELECT id FROM gl_accounts WHERE entity_id=$1 AND code=$2 AND active=true")
        .bind(a.entity_id).bind(&p.account_code).fetch_optional(&s.pool).await.map_err(ApiError::db)?;
    let account=account.ok_or_else(||ApiError::bad("GL account not active or not in selected entity"))?;
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO trade_posting_accounts(entity_id,posting_role,account_id) VALUES($1,$2,$3) ON CONFLICT(entity_id,posting_role) DO UPDATE SET account_id=EXCLUDED.account_id")
        .bind(a.entity_id).bind(&p.posting_role).bind(account).execute(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'posting_account_mapped','gl_account',$3,$4)")
        .bind(a.entity_id).bind(a.user_id).bind(account).bind(json!({"posting_role":p.posting_role,"code":p.account_code}))
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(json!({"posting_role":p.posting_role,"account_code":p.account_code,"status":"mapped","entity_id":a.entity_id})))
}
pub async fn catalog(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;
    let items=sqlx::query("SELECT id,sku,label,unit FROM inventory_items WHERE entity_id=$1 AND active ORDER BY sku LIMIT 200")
        .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    let warehouses=sqlx::query("SELECT id,code,label FROM inventory_warehouses WHERE entity_id=$1 ORDER BY code LIMIT 100")
        .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    let balances=sqlx::query("SELECT b.item_id,b.warehouse_id,b.quantity,b.value_xaf FROM inventory_balances b WHERE b.entity_id=$1 ORDER BY b.warehouse_id,b.item_id LIMIT 200")
        .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    let mappings=sqlx::query("SELECT m.posting_role,a.code FROM trade_posting_accounts m JOIN gl_accounts a ON a.id=m.account_id AND a.entity_id=m.entity_id WHERE m.entity_id=$1")
        .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    Ok(Json(json!({
      "scope":"current_legal_entity","entity_id":a.entity_id,
      "items":items.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"sku":r.get::<String,_>("sku"),"label":r.get::<String,_>("label"),"unit":r.get::<String,_>("unit")})).collect::<Vec<_>>(),
      "warehouses":warehouses.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"code":r.get::<String,_>("code"),"label":r.get::<String,_>("label")})).collect::<Vec<_>>(),
      "balances":balances.iter().map(|r|json!({"item_id":r.get::<Uuid,_>("item_id"),"warehouse_id":r.get::<Uuid,_>("warehouse_id"),"quantity":r.get::<i64,_>("quantity"),"value_xaf":r.get::<i64,_>("value_xaf")})).collect::<Vec<_>>(),
      "posting_accounts":mappings.iter().map(|r|json!({"role":r.get::<String,_>("posting_role"),"code":r.get::<String,_>("code")})).collect::<Vec<_>>()
    })))
}

async fn create_order(pool:&PgPool,a:&Auth,key:String,p:OrderInput,buy:bool)->Result<(StatusCode,Json<Value>),ApiError>{
    require_role(a,&["operator","manager"])?;
    let total=validate_order(&p)?;
    let op=if buy{"create_purchase"}else{"create_sale"};
    let digest=hex::encode(Sha256::digest(serde_json::to_vec(&p).map_err(|_|ApiError::bad("Invalid order"))?));
    let mut tx=pool.begin().await.map_err(ApiError::db)?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("trade:{}:{}:{}",a.entity_id,op,key)).execute(&mut *tx).await.map_err(ApiError::db)?;
    let prev=sqlx::query("SELECT order_id,request_hash FROM trade_idempotency WHERE entity_id=$1 AND operation=$2 AND request_key=$3")
        .bind(a.entity_id).bind(op).bind(&key).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    if let Some(row)=prev{
        if row.get::<String,_>("request_hash")!=digest {return Err(ApiError::conflict("Idempotency key already associated with different order"))}
        return Ok((StatusCode::OK,Json(json!({"id":row.get::<Uuid,_>("order_id"),"idempotent":true,"status":"existing"}))))
    }
    let exists:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM inventory_warehouses WHERE entity_id=$1 AND id=$2)")
        .bind(a.entity_id).bind(p.warehouse_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    if !exists{return Err(ApiError::bad("Warehouse does not belong to current entity"))}
    for l in &p.lines{
        let valid:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM inventory_items WHERE entity_id=$1 AND id=$2 AND active)")
            .bind(a.entity_id).bind(l.item_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
        if !valid{return Err(ApiError::bad("Item not active in selected legal entity"))}
    }
    let id:Uuid=if buy{
        sqlx::query_scalar("INSERT INTO trade_purchase_orders(entity_id,supplier,warehouse_id,total_xaf,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id")
            .bind(a.entity_id).bind(&p.counterparty).bind(p.warehouse_id).bind(total).bind(a.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?
    }else{
        sqlx::query_scalar("INSERT INTO trade_sales_orders(entity_id,customer,warehouse_id,total_xaf,created_by) VALUES($1,$2,$3,$4,$5) RETURNING id")
            .bind(a.entity_id).bind(&p.counterparty).bind(p.warehouse_id).bind(total).bind(a.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?
    };
    for (index,l) in p.lines.iter().enumerate(){
        if buy{
            sqlx::query("INSERT INTO trade_purchase_lines(entity_id,order_id,line_no,item_id,quantity,unit_cost_xaf) VALUES($1,$2,$3,$4,$5,$6)")
                .bind(a.entity_id).bind(id).bind((index+1) as i32).bind(l.item_id).bind(l.quantity).bind(l.unit_amount_xaf).execute(&mut *tx).await.map_err(ApiError::db)?;
        }else{
            sqlx::query("INSERT INTO trade_sales_lines(entity_id,order_id,line_no,item_id,quantity,unit_price_xaf) VALUES($1,$2,$3,$4,$5,$6)")
                .bind(a.entity_id).bind(id).bind((index+1) as i32).bind(l.item_id).bind(l.quantity).bind(l.unit_amount_xaf).execute(&mut *tx).await.map_err(ApiError::db)?;
        }
    }
    sqlx::query("INSERT INTO trade_idempotency(entity_id,operation,request_key,request_hash,order_id) VALUES($1,$2,$3,$4,$5)")
        .bind(a.entity_id).bind(op).bind(&key).bind(digest).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
    audit(&mut tx,a,if buy{"purchase_created"}else{"sale_created"},id,json!({"total_xaf":total,"lines":p.lines.len()})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"draft","total_xaf":total,"entity_id":a.entity_id,"idempotent":false}))))
}
pub async fn create_purchase(State(s):State<AppState>,h:HeaderMap,Json(p):Json<OrderInput>)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;create_order(&s.pool,&a,require_idempotency(&h)?,p,true).await
}
pub async fn create_sale(State(s):State<AppState>,h:HeaderMap,Json(p):Json<OrderInput>)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;create_order(&s.pool,&a,require_idempotency(&h)?,p,false).await
}
async fn audit(tx:&mut Transaction<'_,Postgres>,a:&Auth,event:&str,id:Uuid,metadata:Value)->Result<(),ApiError>{
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,$3,'trade_order',$4,$5)")
        .bind(a.entity_id).bind(a.user_id).bind(event).bind(id).bind(metadata).execute(&mut **tx).await.map_err(ApiError::db)?;
    Ok(())
}
async fn approve(pool:&PgPool,a:&Auth,id:Uuid,buy:bool)->Result<Json<Value>,ApiError>{
    require_role(a,&["manager","executive"])?;
    let mut tx=pool.begin().await.map_err(ApiError::db)?;
    let row=if buy{
        sqlx::query("SELECT status,created_by FROM trade_purchase_orders WHERE entity_id=$1 AND id=$2 FOR UPDATE")
            .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
    }else{
        sqlx::query("SELECT status,created_by FROM trade_sales_orders WHERE entity_id=$1 AND id=$2 FOR UPDATE")
            .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
    }.ok_or_else(ApiError::not_found)?;
    if row.get::<String,_>("status")!="draft"{return Err(ApiError::conflict("Only draft orders can be approved"))}
    if row.get::<Uuid,_>("created_by")==a.user_id{return Err(ApiError::forbidden())}
    if buy {
        sqlx::query("UPDATE trade_purchase_orders SET status='approved',approved_by=$1,approved_at=now() WHERE entity_id=$2 AND id=$3")
            .bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
    }else{
        sqlx::query("UPDATE trade_sales_orders SET status='approved',approved_by=$1,approved_at=now() WHERE entity_id=$2 AND id=$3")
            .bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    audit(&mut tx,a,if buy{"purchase_approved"}else{"sale_approved"},id,json!({"status":"approved"})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(json!({"id":id,"status":"approved"})))
}
pub async fn approve_purchase(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;approve(&s.pool,&a,id,true).await
}
pub async fn approve_sale(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;approve(&s.pool,&a,id,false).await
}

pub(crate) async fn journal_draft(tx:&mut Transaction<'_,Postgres>,a:&Auth,id:Uuid,source:&str,period:&str,total:i64,cost:i64)->Result<Uuid,ApiError>{
    validate_period(period)?;
    let roles:Vec<&str>=if source=="purchase_receipt"{vec!["inventory","accounts_payable"]}else{vec!["accounts_receivable","sales_revenue","cost_of_goods_sold","inventory"]};
    let mut accounts=std::collections::HashMap::new();
    for role in &roles{
        let gl:Option<Uuid>=sqlx::query_scalar("SELECT a.id FROM trade_posting_accounts m JOIN gl_accounts a ON a.id=m.account_id AND a.entity_id=m.entity_id WHERE m.entity_id=$1 AND m.posting_role=$2 AND a.active=true")
            .bind(a.entity_id).bind(role).fetch_optional(&mut **tx).await.map_err(ApiError::db)?;
        accounts.insert(*role,gl.ok_or_else(||ApiError::bad(format!("Missing active GL posting account for {}",role)))?);
    }
    sqlx::query("INSERT INTO gl_periods(entity_id,period_key) VALUES($1,$2) ON CONFLICT(entity_id,period_key) DO NOTHING")
        .bind(a.entity_id).bind(period).execute(&mut **tx).await.map_err(ApiError::db)?;
    let locked:bool=sqlx::query_scalar("SELECT is_locked FROM gl_periods WHERE entity_id=$1 AND period_key=$2 FOR UPDATE")
        .bind(a.entity_id).bind(period).fetch_one(&mut **tx).await.map_err(ApiError::db)?;
    if locked{return Err(ApiError::conflict("Accounting period locked"))}
    let journal_id:Uuid=sqlx::query_scalar("INSERT INTO gl_journals(entity_id,period_key,memo,source_trade_type,source_trade_id,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id")
        .bind(a.entity_id).bind(period).bind(format!("RC8 {} order {} - verify before posting",source,id)).bind(source).bind(id).bind(a.user_id)
        .fetch_one(&mut **tx).await.map_err(ApiError::db)?;
    let lines:Vec<(&str,i64,i64)>=if source=="purchase_receipt"{
        vec![("inventory",total,0),("accounts_payable",0,total)]
    }else{vec![("accounts_receivable",total,0),("sales_revenue",0,total),("cost_of_goods_sold",cost,0),("inventory",0,cost)]};
    for (role,dr,cr) in lines{
        if dr==0&&cr==0{continue}
        sqlx::query("INSERT INTO gl_lines(entity_id,journal_id,account_id,debit_xaf,credit_xaf) VALUES($1,$2,$3,$4,$5)")
            .bind(a.entity_id).bind(journal_id).bind(accounts[role]).bind(dr).bind(cr).execute(&mut **tx).await.map_err(ApiError::db)?;
    }
    Ok(journal_id)
}

pub async fn receive_purchase(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<PeriodInput>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;require_role(&a,&["operator","manager"])?;validate_period(&p.period_key)?;
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    let order=sqlx::query("SELECT status,approved_by,warehouse_id,total_xaf FROM trade_purchase_orders WHERE id=$1 AND entity_id=$2 FOR UPDATE")
        .bind(id).bind(a.entity_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
    if order.get::<String,_>("status")!="approved"{return Err(ApiError::conflict("Purchase must be approved and not previously received"))}
    if order.get::<Option<Uuid>,_>("approved_by")==Some(a.user_id){return Err(ApiError::forbidden())}
    let warehouse_id:Uuid=order.get("warehouse_id");let total:i64=order.get("total_xaf");
    let lines=sqlx::query("SELECT item_id,quantity,unit_cost_xaf FROM trade_purchase_lines WHERE entity_id=$1 AND order_id=$2 ORDER BY item_id")
        .bind(a.entity_id).bind(id).fetch_all(&mut *tx).await.map_err(ApiError::db)?;
    if lines.is_empty(){return Err(ApiError::conflict("Purchase without lines"))}
    for l in &lines{
        let item:Uuid=l.get("item_id");let qty:i64=l.get("quantity");let unit:i64=l.get("unit_cost_xaf");
        let value=qty.checked_mul(unit).ok_or_else(||ApiError::bad("Purchase line overflow"))?;
        sqlx::query("INSERT INTO inventory_balances(entity_id,warehouse_id,item_id,quantity,value_xaf) VALUES($1,$2,$3,$4,$5) ON CONFLICT(entity_id,warehouse_id,item_id) DO UPDATE SET quantity=inventory_balances.quantity+EXCLUDED.quantity,value_xaf=inventory_balances.value_xaf+EXCLUDED.value_xaf,updated_at=now()")
            .bind(a.entity_id).bind(warehouse_id).bind(item).bind(qty).bind(value).execute(&mut *tx).await.map_err(ApiError::db)?;
        sqlx::query("INSERT INTO inventory_movements(entity_id,warehouse_id,item_id,source_type,source_id,quantity_delta,value_delta_xaf,created_by) VALUES($1,$2,$3,'purchase_receipt',$4,$5,$6,$7)")
            .bind(a.entity_id).bind(warehouse_id).bind(item).bind(id).bind(qty).bind(value).bind(a.user_id).execute(&mut *tx).await.map_err(ApiError::db)?;
        // RC9 compatibility: full-order legacy receipt must also mark its line as fulfilled.
        sqlx::query("UPDATE trade_purchase_lines SET received_qty=quantity WHERE entity_id=$1 AND order_id=$2 AND item_id=$3")
            .bind(a.entity_id).bind(id).bind(item).execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    let journal=journal_draft(&mut tx,&a,id,"purchase_receipt",&p.period_key,total,total).await?;
    sqlx::query("UPDATE trade_purchase_orders SET status='received',received_by=$1,received_at=now() WHERE id=$2 AND entity_id=$3")
        .bind(a.user_id).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
    audit(&mut tx,&a,"purchase_received",id,json!({"journal_draft_id":journal,"amount_xaf":total})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(json!({"id":id,"status":"received","journal_draft_id":journal,"inventory_posted":true,"journal_posted":false})))
}

pub fn weighted_average_cost(stock_qty:i64,stock_value:i64,ship_qty:i64)->Result<i64,ApiError>{
    if stock_qty<=0||ship_qty<=0||ship_qty>stock_qty||stock_value<=0{return Err(ApiError::conflict("Insufficient quantity or unvalued inventory"))}
    if ship_qty==stock_qty{return Ok(stock_value)}
    let value=(i128::from(stock_value)*i128::from(ship_qty)+i128::from(stock_qty)/2)/i128::from(stock_qty);
    Ok(i64::try_from(value).map_err(|_|ApiError::bad("Cost amount overflow"))?.max(1).min(stock_value))
}
pub async fn ship_sale(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<PeriodInput>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;require_role(&a,&["operator","manager"])?;validate_period(&p.period_key)?;
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    let order=sqlx::query("SELECT status,approved_by,warehouse_id,total_xaf FROM trade_sales_orders WHERE id=$1 AND entity_id=$2 FOR UPDATE")
        .bind(id).bind(a.entity_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
    if order.get::<String,_>("status")!="approved"{return Err(ApiError::conflict("Sale must be approved and not previously shipped"))}
    if order.get::<Option<Uuid>,_>("approved_by")==Some(a.user_id){return Err(ApiError::forbidden())}
    let warehouse_id:Uuid=order.get("warehouse_id");let total:i64=order.get("total_xaf");
    let lines=sqlx::query("SELECT item_id,quantity FROM trade_sales_lines WHERE entity_id=$1 AND order_id=$2 ORDER BY item_id")
        .bind(a.entity_id).bind(id).fetch_all(&mut *tx).await.map_err(ApiError::db)?;
    if lines.is_empty(){return Err(ApiError::conflict("Sale without lines"))}
    let mut cost:i64=0;
    for l in &lines{
        let item:Uuid=l.get("item_id");let qty:i64=l.get("quantity");
        let bal=sqlx::query("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3 FOR UPDATE")
            .bind(a.entity_id).bind(warehouse_id).bind(item).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
        let bal=bal.ok_or_else(||ApiError::conflict("Item has no inventory in selected warehouse"))?;
        let outbound=weighted_average_cost(bal.get("quantity"),bal.get("value_xaf"),qty)?;
        cost=cost.checked_add(outbound).ok_or_else(||ApiError::bad("Total COGS overflow"))?;
        sqlx::query("UPDATE inventory_balances SET quantity=quantity-$1,value_xaf=value_xaf-$2,updated_at=now() WHERE entity_id=$3 AND warehouse_id=$4 AND item_id=$5")
            .bind(qty).bind(outbound).bind(a.entity_id).bind(warehouse_id).bind(item).execute(&mut *tx).await.map_err(ApiError::db)?;
        sqlx::query("INSERT INTO inventory_movements(entity_id,warehouse_id,item_id,source_type,source_id,quantity_delta,value_delta_xaf,created_by) VALUES($1,$2,$3,'sales_shipment',$4,$5,$6,$7)")
            .bind(a.entity_id).bind(warehouse_id).bind(item).bind(id).bind(-qty).bind(-outbound).bind(a.user_id).execute(&mut *tx).await.map_err(ApiError::db)?;
        // RC9 compatibility: legacy full shipment updates progress counters atomically.
        sqlx::query("UPDATE trade_sales_lines SET shipped_qty=quantity WHERE entity_id=$1 AND order_id=$2 AND item_id=$3")
            .bind(a.entity_id).bind(id).bind(item).execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    let journal=journal_draft(&mut tx,&a,id,"sales_shipment",&p.period_key,total,cost).await?;
    sqlx::query("UPDATE trade_sales_orders SET status='shipped',shipped_by=$1,shipped_at=now() WHERE id=$2 AND entity_id=$3")
        .bind(a.user_id).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
    audit(&mut tx,&a,"sale_shipped",id,json!({"journal_draft_id":journal,"sales_xaf":total,"cost_xaf":cost})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(json!({"id":id,"status":"shipped","journal_draft_id":journal,"sales_xaf":total,"cost_xaf":cost,"journal_posted":false})))
}

async fn list_orders(pool:&PgPool,a:&Auth,buy:bool)->Result<Json<Value>,ApiError>{
    let rows=if buy{
        sqlx::query("SELECT id,supplier AS counterparty,total_xaf,status,created_at FROM trade_purchase_orders WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
            .bind(a.entity_id).fetch_all(pool).await.map_err(ApiError::db)?
    }else{
        sqlx::query("SELECT id,customer AS counterparty,total_xaf,status,created_at FROM trade_sales_orders WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
            .bind(a.entity_id).fetch_all(pool).await.map_err(ApiError::db)?
    };
    let items:Vec<Value>=rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"counterparty":r.get::<String,_>("counterparty"),"total_xaf":r.get::<i64,_>("total_xaf"),"status":r.get::<String,_>("status"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect();
    Ok(Json(json!({"items":items,"scope":"current_legal_entity"})))
}
pub async fn purchases(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{let a=auth::require_auth(&h,&s.pool).await?;list_orders(&s.pool,&a,true).await}
pub async fn sales(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{let a=auth::require_auth(&h,&s.pool).await?;list_orders(&s.pool,&a,false).await}
pub async fn movements(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;
    let rows=sqlx::query("SELECT source_type,source_id,item_id,warehouse_id,quantity_delta,value_delta_xaf,created_at FROM inventory_movements WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 200")
        .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    let items:Vec<Value>=rows.iter().map(|r|json!({"source_type":r.get::<String,_>("source_type"),"source_id":r.get::<Uuid,_>("source_id"),"item_id":r.get::<Uuid,_>("item_id"),"warehouse_id":r.get::<Uuid,_>("warehouse_id"),"quantity_delta":r.get::<i64,_>("quantity_delta"),"value_delta_xaf":r.get::<i64,_>("value_delta_xaf"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect();
    Ok(Json(json!({"items":items,"scope":"current_legal_entity"})))
}

#[cfg(test)]mod tests{
    use super::*;
    fn order(qty:i64,amt:i64)->OrderInput{OrderInput{counterparty:"Example Supplier".into(),warehouse_id:Uuid::new_v4(),lines:vec![OrderLineInput{item_id:Uuid::new_v4(),quantity:qty,unit_amount_xaf:amt}]}}
    #[test]fn valid_order(){assert_eq!(validate_order(&order(10,1500)).unwrap(),15000)}
    #[test]fn bad_quantity(){assert!(validate_order(&order(0,1500)).is_err())}
    #[test]fn overflow_guard(){let mut o=order(1_000_000,1_000_000_000);o.lines.push(OrderLineInput{item_id:Uuid::new_v4(),quantity:1_000_000,unit_amount_xaf:1_000_000_000});assert!(validate_order(&o).is_ok());}
    #[test]fn cost_full_stock(){assert_eq!(weighted_average_cost(5,10000,5).unwrap(),10000)}
    #[test]fn cost_weighted_half(){assert_eq!(weighted_average_cost(8,1000,3).unwrap(),375)}
    #[test]fn overship_rejected(){assert!(weighted_average_cost(5,1000,6).is_err())}
    #[test]fn empty_label_rejected(){assert!(validate_label(" ",240).is_err())}
}
