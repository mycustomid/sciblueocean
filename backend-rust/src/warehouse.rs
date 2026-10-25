//! RC12 auditable inventory transfers and counted adjustments.
//! Local same-entity transfers have no GL entries (inventory value is conserved).
//! Physical count adjustments create DRAFT journals only; no statutory posting.
use axum::{extract::{Path,State},http::{HeaderMap,StatusCode},Json};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use sqlx::{Row,Transaction,Postgres};
use uuid::Uuid;
use crate::{AppState,auth::{self,Auth},error::ApiError,trade};

#[derive(Debug,Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct TransferInput {
    pub from_warehouse_id:Uuid,pub to_warehouse_id:Uuid,pub item_id:Uuid,
    pub quantity:i64,pub reason:String,
}
#[derive(Debug,Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct CountInput {
    pub warehouse_id:Uuid,pub item_id:Uuid,pub counted_quantity:i64,
    pub opening_unit_cost_xaf:Option<i64>,pub period_key:String,pub reason:String,
}
fn note_ok(s:&str)->bool{(8..=500).contains(&s.trim().chars().count())}
pub fn validate_transfer(p:&TransferInput)->Result<(),ApiError>{
    if p.from_warehouse_id==p.to_warehouse_id{return Err(ApiError::bad("Transfer warehouses must differ"))}
    if !(1..=1_000_000).contains(&p.quantity)||!note_ok(&p.reason){return Err(ApiError::bad("Invalid transfer quantity or reason"))}
    Ok(())
}
pub fn validate_count(p:&CountInput)->Result<(),ApiError>{
    trade::validate_period(&p.period_key)?;
    if !(0..=1_000_000_000).contains(&p.counted_quantity)||!note_ok(&p.reason) ||
      p.opening_unit_cost_xaf.is_some_and(|v|!(1..=1_000_000_000).contains(&v)){
        return Err(ApiError::bad("Invalid count, unit cost or reason"))
    }
    Ok(())
}
fn only_role(a:&Auth,role:&str)->Result<(),ApiError>{if a.role==role{Ok(())}else{Err(ApiError::forbidden())}}
async fn audit(tx:&mut Transaction<'_,Postgres>,a:&Auth,event:&str,id:Uuid,kind:&str,metadata:Value)->Result<(),ApiError>{
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,$3,$4,$5,$6)")
        .bind(a.entity_id).bind(a.user_id).bind(event).bind(kind).bind(id).bind(metadata)
        .execute(&mut **tx).await.map_err(ApiError::db)?;Ok(())
}
async fn advisory(tx:&mut Transaction<'_,Postgres>,a:&Auth,item:Uuid)->Result<(),ApiError>{
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("inventory:{}:{}",a.entity_id,item)).execute(&mut **tx).await.map_err(ApiError::db)?;Ok(())
}
async fn valid_item_and_wh(tx:&mut Transaction<'_,Postgres>,a:&Auth,item:Uuid,warehouses:&[Uuid])->Result<(),ApiError>{
    let item_valid:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM inventory_items WHERE entity_id=$1 AND id=$2 AND active=true)")
        .bind(a.entity_id).bind(item).fetch_one(&mut **tx).await.map_err(ApiError::db)?;
    if !item_valid{return Err(ApiError::bad("Item not found in current entity"))}
    for wh in warehouses{
        let found:bool=sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM inventory_warehouses WHERE entity_id=$1 AND id=$2)")
            .bind(a.entity_id).bind(wh).fetch_one(&mut **tx).await.map_err(ApiError::db)?;
        if !found{return Err(ApiError::bad("Warehouse not in current entity"))}
    }
    Ok(())
}
fn hash<T:Serialize>(p:&T)->Result<String,ApiError>{
    Ok(hex::encode(Sha256::digest(serde_json::to_vec(p).map_err(|_|ApiError::bad("Cannot encode request"))?)))
}
pub async fn transfers(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;
    let rows=sqlx::query("SELECT id,from_warehouse_id,to_warehouse_id,item_id,quantity,status,value_xaf,created_at FROM inventory_transfers WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
        .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    Ok(Json(json!({"scope":"current_legal_entity","items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"from_warehouse_id":r.get::<Uuid,_>("from_warehouse_id"),"to_warehouse_id":r.get::<Uuid,_>("to_warehouse_id"),"item_id":r.get::<Uuid,_>("item_id"),"quantity":r.get::<i64,_>("quantity"),"status":r.get::<String,_>("status"),"value_xaf":r.get::<Option<i64>,_>("value_xaf"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect::<Vec<_>>()})))
}
pub async fn submit_transfer(State(s):State<AppState>,h:HeaderMap,Json(p):Json<TransferInput>)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;only_role(&a,"operator")?;
    validate_transfer(&p)?;
    let key=trade::require_idempotency(&h)?;let digest=hash(&p)?;
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("transfer:{}:{}",a.entity_id,key)).execute(&mut *tx).await.map_err(ApiError::db)?;
    let prev=sqlx::query("SELECT id,request_hash FROM inventory_transfers WHERE entity_id=$1 AND request_key=$2")
        .bind(a.entity_id).bind(&key).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    if let Some(r)=prev{
        if r.get::<String,_>("request_hash")!=digest{return Err(ApiError::conflict("Idempotency key reused with different transfer"))}
        return Ok((StatusCode::OK,Json(json!({"id":r.get::<Uuid,_>("id"),"idempotent":true}))))
    }
    valid_item_and_wh(&mut tx,&a,p.item_id,&[p.from_warehouse_id,p.to_warehouse_id]).await?;
    let id:Uuid=sqlx::query_scalar("INSERT INTO inventory_transfers(entity_id,from_warehouse_id,to_warehouse_id,item_id,quantity,reason,request_key,request_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id")
        .bind(a.entity_id).bind(p.from_warehouse_id).bind(p.to_warehouse_id).bind(p.item_id).bind(p.quantity)
        .bind(p.reason.trim()).bind(key).bind(digest).bind(a.user_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    audit(&mut tx,&a,"transfer_submitted",id,"inventory_transfer",json!({"item_id":p.item_id,"quantity":p.quantity})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"draft","entity_id":a.entity_id,"idempotent":false}))))
}
pub async fn approve_transfer(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;only_role(&a,"manager")?;
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    let doc=sqlx::query("SELECT item_id FROM inventory_transfers WHERE entity_id=$1 AND id=$2")
        .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
    let item:Uuid=doc.get("item_id");advisory(&mut tx,&a,item).await?;
    let row=sqlx::query("SELECT from_warehouse_id,to_warehouse_id,quantity,created_by,status FROM inventory_transfers WHERE entity_id=$1 AND id=$2 FOR UPDATE")
        .bind(a.entity_id).bind(id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    if row.get::<String,_>("status")!="draft"{return Err(ApiError::conflict("Transfer already finalized"))}
    if row.get::<Uuid,_>("created_by")==a.user_id{return Err(ApiError::forbidden())}
    let from:Uuid=row.get("from_warehouse_id");let to:Uuid=row.get("to_warehouse_id");let qty:i64=row.get("quantity");
    let bal=sqlx::query("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3 FOR UPDATE")
        .bind(a.entity_id).bind(from).bind(item).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
        .ok_or_else(||ApiError::conflict("No stock in source warehouse"))?;
    let stock_qty:i64=bal.get("quantity");let stock_value:i64=bal.get("value_xaf");
    let cost=trade::weighted_average_cost(stock_qty,stock_value,qty)?;
    sqlx::query("UPDATE inventory_balances SET quantity=quantity-$1,value_xaf=value_xaf-$2,updated_at=now() WHERE entity_id=$3 AND warehouse_id=$4 AND item_id=$5")
        .bind(qty).bind(cost).bind(a.entity_id).bind(from).bind(item).execute(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO inventory_balances(entity_id,warehouse_id,item_id,quantity,value_xaf) VALUES($1,$2,$3,$4,$5) ON CONFLICT(entity_id,warehouse_id,item_id) DO UPDATE SET quantity=inventory_balances.quantity+EXCLUDED.quantity,value_xaf=inventory_balances.value_xaf+EXCLUDED.value_xaf,updated_at=now()")
        .bind(a.entity_id).bind(to).bind(item).bind(qty).bind(cost).execute(&mut *tx).await.map_err(ApiError::db)?;
    for (wh,kind,sign) in [(from,"warehouse_transfer_out",-1),(to,"warehouse_transfer_in",1)]{
        sqlx::query("INSERT INTO inventory_movements(entity_id,warehouse_id,item_id,source_type,source_id,quantity_delta,value_delta_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
            .bind(a.entity_id).bind(wh).bind(item).bind(kind).bind(id).bind(sign*qty).bind(sign*cost).bind(a.user_id)
            .execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    sqlx::query("UPDATE inventory_transfers SET status='applied',value_xaf=$1,approved_by=$2,applied_at=now() WHERE id=$3 AND entity_id=$4")
        .bind(cost).bind(a.user_id).bind(id).bind(a.entity_id).execute(&mut *tx).await.map_err(ApiError::db)?;
    audit(&mut tx,&a,"transfer_applied",id,"inventory_transfer",json!({"source":from,"destination":to,"quantity":qty,"cost_xaf":cost,"gl_entry":"not_required_intra_entity"})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(json!({"id":id,"status":"applied","quantity":qty,"value_xaf":cost,"source":from,"destination":to,"journal_required":false})))
}

pub async fn counts(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;
    let rows=sqlx::query("SELECT id,warehouse_id,item_id,snapshot_quantity,snapshot_value_xaf,counted_quantity,adjustment_xaf,journal_id,status,created_at FROM inventory_stock_counts WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 100")
        .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    Ok(Json(json!({"scope":"current_legal_entity","items":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"warehouse_id":r.get::<Uuid,_>("warehouse_id"),"item_id":r.get::<Uuid,_>("item_id"),"snapshot_quantity":r.get::<i64,_>("snapshot_quantity"),"snapshot_value_xaf":r.get::<i64,_>("snapshot_value_xaf"),"counted_quantity":r.get::<i64,_>("counted_quantity"),"adjustment_xaf":r.get::<Option<i64>,_>("adjustment_xaf"),"journal_draft_id":r.get::<Option<Uuid>,_>("journal_id"),"status":r.get::<String,_>("status"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect::<Vec<_>>()})))
}
pub async fn submit_count(State(s):State<AppState>,h:HeaderMap,Json(p):Json<CountInput>)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;only_role(&a,"operator")?;
    validate_count(&p)?;let key=trade::require_idempotency(&h)?;let digest=hash(&p)?;
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("stock_count:{}:{}",a.entity_id,key)).execute(&mut *tx).await.map_err(ApiError::db)?;
    let prev=sqlx::query("SELECT id,request_hash FROM inventory_stock_counts WHERE entity_id=$1 AND request_key=$2")
        .bind(a.entity_id).bind(&key).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    if let Some(r)=prev{
        if r.get::<String,_>("request_hash")!=digest{return Err(ApiError::conflict("Idempotency key reused with different count"))}
        return Ok((StatusCode::OK,Json(json!({"id":r.get::<Uuid,_>("id"),"idempotent":true}))))
    }
    advisory(&mut tx,&a,p.item_id).await?;
    valid_item_and_wh(&mut tx,&a,p.item_id,&[p.warehouse_id]).await?;
    let current=sqlx::query("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3 FOR UPDATE")
        .bind(a.entity_id).bind(p.warehouse_id).bind(p.item_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    let snapshot:i64=current.as_ref().map(|r|r.get("quantity")).unwrap_or(0);
    let snapshot_value:i64=current.as_ref().map(|r|r.get("value_xaf")).unwrap_or(0);
    if snapshot==p.counted_quantity{return Err(ApiError::bad("Count matches existing balance; no adjustment required"))}
    if snapshot==0 && p.counted_quantity>0 && p.opening_unit_cost_xaf.is_none(){return Err(ApiError::bad("Opening unit cost required for new discovered stock"))}
    if snapshot>0 && p.opening_unit_cost_xaf.is_some(){return Err(ApiError::bad("Do not override existing weighted-average cost"))}
    let id:Uuid=sqlx::query_scalar("INSERT INTO inventory_stock_counts(entity_id,warehouse_id,item_id,snapshot_quantity,snapshot_value_xaf,counted_quantity,opening_unit_cost_xaf,period_key,reason,request_key,request_hash,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id")
        .bind(a.entity_id).bind(p.warehouse_id).bind(p.item_id).bind(snapshot).bind(snapshot_value).bind(p.counted_quantity)
        .bind(p.opening_unit_cost_xaf).bind(&p.period_key).bind(p.reason.trim()).bind(key).bind(digest).bind(a.user_id)
        .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    audit(&mut tx,&a,"count_submitted",id,"inventory_count",json!({"snapshot":snapshot,"counted":p.counted_quantity})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok((StatusCode::CREATED,Json(json!({"id":id,"status":"draft","snapshot_quantity":snapshot,"snapshot_value_xaf":snapshot_value,"counted_quantity":p.counted_quantity}))))
}
pub async fn approve_count(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;only_role(&a,"manager")?;
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    let raw=sqlx::query("SELECT item_id FROM inventory_stock_counts WHERE entity_id=$1 AND id=$2")
        .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?.ok_or_else(ApiError::not_found)?;
    let item:Uuid=raw.get("item_id");advisory(&mut tx,&a,item).await?;
    let doc=sqlx::query("SELECT warehouse_id,snapshot_quantity,snapshot_value_xaf,counted_quantity,opening_unit_cost_xaf,period_key,created_by,status FROM inventory_stock_counts WHERE entity_id=$1 AND id=$2 FOR UPDATE")
        .bind(a.entity_id).bind(id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    if doc.get::<String,_>("status")!="draft"{return Err(ApiError::conflict("Count already applied"))}
    if doc.get::<Uuid,_>("created_by")==a.user_id{return Err(ApiError::forbidden())}
    let wh:Uuid=doc.get("warehouse_id");let snapshot:i64=doc.get("snapshot_quantity");
    let snapshot_value:i64=doc.get("snapshot_value_xaf");
    let counted:i64=doc.get("counted_quantity");let opening:Option<i64>=doc.get("opening_unit_cost_xaf");
    let period:String=doc.get("period_key");
    sqlx::query("INSERT INTO gl_periods(entity_id,period_key) VALUES($1,$2) ON CONFLICT(entity_id,period_key) DO NOTHING")
        .bind(a.entity_id).bind(&period).execute(&mut *tx).await.map_err(ApiError::db)?;
    let locked:bool=sqlx::query_scalar("SELECT is_locked FROM gl_periods WHERE entity_id=$1 AND period_key=$2 FOR UPDATE")
        .bind(a.entity_id).bind(&period).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    if locked{return Err(ApiError::conflict("Accounting period is locked"))}
    let current=sqlx::query("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3 FOR UPDATE")
        .bind(a.entity_id).bind(wh).bind(item).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    let stock_qty:i64=current.as_ref().map(|r|r.get("quantity")).unwrap_or(0);
    let stock_value:i64=current.as_ref().map(|r|r.get("value_xaf")).unwrap_or(0);
    if stock_qty!=snapshot || stock_value!=snapshot_value{return Err(ApiError::conflict("Stale physical count: quantity or valuation changed; recount required"))}
    let delta=counted-snapshot;
    let abs_qty=delta.abs();
    let cost=if delta<0{trade::weighted_average_cost(stock_qty,stock_value,abs_qty)?}
      else if stock_qty==0 {
        abs_qty.checked_mul(opening.ok_or_else(||ApiError::bad("Opening cost required"))?).ok_or_else(||ApiError::bad("Count value overflow"))?
      }else{
        let x=(i128::from(stock_value)*i128::from(abs_qty)+i128::from(stock_qty)/2)/i128::from(stock_qty);
        i64::try_from(x).map_err(|_|ApiError::bad("Count value overflow"))?
      };
    if cost<=0 || cost>9_000_000_000_000_000{return Err(ApiError::bad("Count cost exceeds safe limit"))}
    if delta>0{
        sqlx::query("INSERT INTO inventory_balances(entity_id,warehouse_id,item_id,quantity,value_xaf) VALUES($1,$2,$3,$4,$5) ON CONFLICT(entity_id,warehouse_id,item_id) DO UPDATE SET quantity=inventory_balances.quantity+EXCLUDED.quantity,value_xaf=inventory_balances.value_xaf+EXCLUDED.value_xaf,updated_at=now()")
            .bind(a.entity_id).bind(wh).bind(item).bind(abs_qty).bind(cost).execute(&mut *tx).await.map_err(ApiError::db)?;
    }else{
        sqlx::query("UPDATE inventory_balances SET quantity=quantity-$1,value_xaf=value_xaf-$2,updated_at=now() WHERE entity_id=$3 AND warehouse_id=$4 AND item_id=$5")
            .bind(abs_qty).bind(cost).bind(a.entity_id).bind(wh).bind(item).execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    sqlx::query("INSERT INTO inventory_movements(entity_id,warehouse_id,item_id,source_type,source_id,quantity_delta,value_delta_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
        .bind(a.entity_id).bind(wh).bind(item).bind(if delta>0{"stock_count_gain"}else{"stock_count_loss"})
        .bind(id).bind(delta).bind(if delta>0{cost}else{-cost}).bind(a.user_id)
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    let account_role=if delta>0{"inventory_adjustment_gain"}else{"inventory_adjustment_loss"};
    let rows=sqlx::query("SELECT m.posting_role,g.id FROM trade_posting_accounts m JOIN gl_accounts g ON g.entity_id=m.entity_id AND g.id=m.account_id AND g.active=true WHERE m.entity_id=$1 AND m.posting_role IN ('inventory',$2)")
        .bind(a.entity_id).bind(account_role).fetch_all(&mut *tx).await.map_err(ApiError::db)?;
    let mut stock_acct=None;let mut variance_acct=None;
    for row in rows {let role:String=row.get("posting_role");let acct:Uuid=row.get("id");if role=="inventory"{stock_acct=Some(acct)}else if role==account_role{variance_acct=Some(acct)}}
    let stock_acct=stock_acct.ok_or_else(||ApiError::bad("Map inventory account"))?;
    let variance_acct=variance_acct.ok_or_else(||ApiError::bad("Map inventory variance account"))?;
    if stock_acct==variance_acct{return Err(ApiError::bad("Inventory and variance accounts must differ"))}
    let journal:Uuid=sqlx::query_scalar("INSERT INTO gl_journals(entity_id,period_key,memo,source_trade_type,source_trade_id,created_by) VALUES($1,$2,$3,'stock_count_adjustment',$4,$5) RETURNING id")
        .bind(a.entity_id).bind(&period).bind(format!("RC12 stock count {} draft adjustment",id)).bind(id).bind(a.user_id)
        .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    for (acct,dr,cr) in if delta>0{[(stock_acct,cost,0),(variance_acct,0,cost)]}else{[(variance_acct,cost,0),(stock_acct,0,cost)]}{
        sqlx::query("INSERT INTO gl_lines(entity_id,journal_id,account_id,debit_xaf,credit_xaf) VALUES($1,$2,$3,$4,$5)")
            .bind(a.entity_id).bind(journal).bind(acct).bind(dr).bind(cr).execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    sqlx::query("UPDATE inventory_stock_counts SET status='applied',adjustment_xaf=$1,journal_id=$2,approved_by=$3,applied_at=now() WHERE entity_id=$4 AND id=$5")
        .bind(if delta>0{cost}else{-cost}).bind(journal).bind(a.user_id).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
    audit(&mut tx,&a,"count_applied",id,"inventory_count",json!({"delta":delta,"value_delta_xaf":if delta>0{cost}else{-cost},"journal_draft_id":journal})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok(Json(json!({"id":id,"status":"applied","quantity_delta":delta,"value_delta_xaf":if delta>0{cost}else{-cost},"journal_draft_id":journal,"journal_posted":false})))
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn rejects_same_warehouse(){let id=Uuid::new_v4();assert!(validate_transfer(&TransferInput{from_warehouse_id:id,to_warehouse_id:id,item_id:Uuid::new_v4(),quantity:1,reason:"counted manually".into()}).is_err())}
 #[test]fn rejects_negative_count(){assert!(validate_count(&CountInput{warehouse_id:Uuid::new_v4(),item_id:Uuid::new_v4(),counted_quantity:-1,opening_unit_cost_xaf:None,period_key:"2026-10".into(),reason:"cycle inventory count".into()}).is_err())}
}
