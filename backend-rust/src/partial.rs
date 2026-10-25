//! RC9: company-scoped partial fulfilment events, without rewriting RC8 legacy endpoints.
//! Explicitly not a certified tax, credit-note or financial consolidation subsystem.
use axum::{extract::{Path,State},http::{HeaderMap,StatusCode},Json};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use sqlx::{Row,PgPool,Postgres,Transaction};
use sha2::{Digest,Sha256};
use uuid::Uuid;
use crate::{AppState,auth::{self,Auth},error::ApiError,trade};

#[derive(Debug,Deserialize,Serialize,Clone)]
#[serde(deny_unknown_fields)]
pub struct PartialLine {pub item_id:Uuid,pub quantity:i64}
#[derive(Debug,Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct PartialInput {pub period_key:String,pub lines:Vec<PartialLine>}

pub fn check_lines(p:&PartialInput)->Result<(),ApiError>{
    trade::validate_period(&p.period_key)?;
    if p.lines.is_empty()||p.lines.len()>50{return Err(ApiError::bad("Provide 1..50 fulfilment lines"))}
    let mut seen=std::collections::HashSet::new();
    for l in &p.lines{
        if !(1..=1_000_000).contains(&l.quantity)||!seen.insert(l.item_id){
            return Err(ApiError::bad("Invalid/duplicate fulfilment item or quantity"))
        }
    }
    Ok(())
}
fn require_ops(a:&Auth)->Result<(),ApiError>{
    if ["operator","manager"].contains(&a.role.as_str()){Ok(())}else{Err(ApiError::forbidden())}
}
async fn audited(tx:&mut Transaction<'_,Postgres>,a:&Auth,event:&str,id:Uuid,details:Value)->Result<(),ApiError>{
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,$3,'trade_fulfilment',$4,$5)")
      .bind(a.entity_id).bind(a.user_id).bind(event).bind(id).bind(details).execute(&mut **tx).await.map_err(ApiError::db)?;
    Ok(())
}
async fn execute(s:AppState,h:HeaderMap,id:Uuid,p:PartialInput,buy:bool)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;
    require_ops(&a)?;check_lines(&p)?;
    let key=trade::require_idempotency(&h)?;
    let kind=if buy{"purchase_receipt"}else{"sales_shipment"};
    let digest=hex::encode(Sha256::digest(serde_json::to_vec(&p).map_err(|_|ApiError::bad("Invalid body"))?));
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    // Lock source order row: one serial stream of inventory fulfilments per document.
    let order=if buy{
        sqlx::query("SELECT warehouse_id,status,approved_by FROM trade_purchase_orders WHERE entity_id=$1 AND id=$2 FOR UPDATE")
          .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
    }else{
        sqlx::query("SELECT warehouse_id,status,approved_by FROM trade_sales_orders WHERE entity_id=$1 AND id=$2 FOR UPDATE")
          .bind(a.entity_id).bind(id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
    }.ok_or_else(ApiError::not_found)?;
    // Allow repeat of a completed request even after the order reached its final state.
    let previous=sqlx::query("SELECT id,request_hash,journal_id,amount_xaf,cost_xaf FROM trade_fulfilments WHERE entity_id=$1 AND kind=$2 AND order_id=$3 AND request_key=$4")
      .bind(a.entity_id).bind(kind).bind(id).bind(&key).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    if let Some(prev)=previous{
        if prev.get::<String,_>("request_hash")!=digest{return Err(ApiError::conflict("Idempotency key reused for different fulfilment"))}
        return Ok((StatusCode::OK,Json(json!({"event_id":prev.get::<Uuid,_>("id"),"journal_draft_id":prev.get::<Option<Uuid>,_>("journal_id"),"commercial_xaf":prev.get::<i64,_>("amount_xaf"),"stock_cost_xaf":prev.get::<i64,_>("cost_xaf"),"idempotent":true}))))
    }
    let status:String=order.get("status");
    let allowed=if buy{&["approved","partially_received"][..]}else{&["approved","partially_shipped"][..]};
    if !allowed.contains(&status.as_str()){return Err(ApiError::conflict("Order is not open for fulfilment"))}
    if order.get::<Option<Uuid>,_>("approved_by")==Some(a.user_id){return Err(ApiError::forbidden())}
    let wh:Uuid=order.get("warehouse_id");
    let event=Uuid::new_v4();
    let mut commercial:i64=0;
    let mut stock_cost:i64=0;
    // Insert event before movement facts; transaction rollback on any validation failure.
    sqlx::query("INSERT INTO trade_fulfilments(id,entity_id,order_id,kind,request_key,request_hash,period_key,amount_xaf,cost_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,1,1,$8)")
      .bind(event).bind(a.entity_id).bind(id).bind(kind).bind(&key).bind(&digest).bind(&p.period_key).bind(a.user_id)
      .execute(&mut *tx).await.map_err(ApiError::db)?;
    for line in &p.lines{
        let source=if buy{
            sqlx::query("SELECT quantity,received_qty,unit_cost_xaf AS unit_xaf FROM trade_purchase_lines WHERE entity_id=$1 AND order_id=$2 AND item_id=$3 FOR UPDATE")
              .bind(a.entity_id).bind(id).bind(line.item_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
        }else{
            sqlx::query("SELECT quantity,shipped_qty AS received_qty,unit_price_xaf AS unit_xaf FROM trade_sales_lines WHERE entity_id=$1 AND order_id=$2 AND item_id=$3 FOR UPDATE")
              .bind(a.entity_id).bind(id).bind(line.item_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
        }.ok_or_else(||ApiError::bad("Item is not on this order"))?;
        let qty_total:i64=source.get("quantity");let already:i64=source.get("received_qty");let unit:i64=source.get("unit_xaf");
        if line.quantity>qty_total-already{return Err(ApiError::conflict("Fulfilment exceeds unfulfilled quantity"))}
        let value=line.quantity.checked_mul(unit).ok_or_else(||ApiError::bad("Commercial amount overflow"))?;
        commercial=commercial.checked_add(value).ok_or_else(||ApiError::bad("Commercial total overflow"))?;
        let movement_value:i64=if buy{
            sqlx::query("INSERT INTO inventory_balances(entity_id,warehouse_id,item_id,quantity,value_xaf) VALUES($1,$2,$3,$4,$5) ON CONFLICT(entity_id,warehouse_id,item_id) DO UPDATE SET quantity=inventory_balances.quantity+EXCLUDED.quantity,value_xaf=inventory_balances.value_xaf+EXCLUDED.value_xaf,updated_at=now()")
              .bind(a.entity_id).bind(wh).bind(line.item_id).bind(line.quantity).bind(value)
              .execute(&mut *tx).await.map_err(ApiError::db)?;
            value
        }else{
            let bal=sqlx::query("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3 FOR UPDATE")
              .bind(a.entity_id).bind(wh).bind(line.item_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
              .ok_or_else(||ApiError::conflict("No inventory for shipment"))?;
            let cost=trade::weighted_average_cost(bal.get("quantity"),bal.get("value_xaf"),line.quantity)?;
            sqlx::query("UPDATE inventory_balances SET quantity=quantity-$1,value_xaf=value_xaf-$2,updated_at=now() WHERE entity_id=$3 AND warehouse_id=$4 AND item_id=$5")
              .bind(line.quantity).bind(cost).bind(a.entity_id).bind(wh).bind(line.item_id)
              .execute(&mut *tx).await.map_err(ApiError::db)?;
            cost
        };
        stock_cost=stock_cost.checked_add(movement_value).ok_or_else(||ApiError::bad("Cost total overflow"))?;
        let delta=if buy{line.quantity}else{-line.quantity};
        let delta_value=if buy{movement_value}else{-movement_value};
        sqlx::query("INSERT INTO inventory_movements(entity_id,warehouse_id,item_id,source_type,source_id,quantity_delta,value_delta_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
          .bind(a.entity_id).bind(wh).bind(line.item_id).bind(kind).bind(event).bind(delta).bind(delta_value).bind(a.user_id)
          .execute(&mut *tx).await.map_err(ApiError::db)?;
        sqlx::query("INSERT INTO trade_fulfilment_lines(fulfilment_id,entity_id,item_id,quantity,commercial_amount_xaf,inventory_value_xaf) VALUES($1,$2,$3,$4,$5,$6)")
          .bind(event).bind(a.entity_id).bind(line.item_id).bind(line.quantity).bind(value).bind(movement_value)
          .execute(&mut *tx).await.map_err(ApiError::db)?;
        if buy{
            sqlx::query("UPDATE trade_purchase_lines SET received_qty=received_qty+$1 WHERE entity_id=$2 AND order_id=$3 AND item_id=$4")
              .bind(line.quantity).bind(a.entity_id).bind(id).bind(line.item_id).execute(&mut *tx).await.map_err(ApiError::db)?;
        }else{
            sqlx::query("UPDATE trade_sales_lines SET shipped_qty=shipped_qty+$1 WHERE entity_id=$2 AND order_id=$3 AND item_id=$4")
              .bind(line.quantity).bind(a.entity_id).bind(id).bind(line.item_id).execute(&mut *tx).await.map_err(ApiError::db)?;
        }
    }
    let journal=trade::journal_draft(&mut tx,&a,event,kind,&p.period_key,commercial,stock_cost).await?;
    sqlx::query("UPDATE trade_fulfilments SET amount_xaf=$1,cost_xaf=$2,journal_id=$3 WHERE id=$4 AND entity_id=$5")
      .bind(commercial).bind(stock_cost).bind(journal).bind(event).bind(a.entity_id)
      .execute(&mut *tx).await.map_err(ApiError::db)?;
    let pending:bool=if buy{
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM trade_purchase_lines WHERE entity_id=$1 AND order_id=$2 AND received_qty<quantity)")
          .bind(a.entity_id).bind(id).fetch_one(&mut *tx).await.map_err(ApiError::db)?
    }else{
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM trade_sales_lines WHERE entity_id=$1 AND order_id=$2 AND shipped_qty<quantity)")
          .bind(a.entity_id).bind(id).fetch_one(&mut *tx).await.map_err(ApiError::db)?
    };
    let new_status=if buy{if pending{"partially_received"}else{"received"}}else if pending{"partially_shipped"}else{"shipped"};
    if buy{
        sqlx::query("UPDATE trade_purchase_orders SET status=$1,received_by=$2,received_at=CASE WHEN $3 THEN NULL ELSE now() END WHERE entity_id=$4 AND id=$5")
          .bind(new_status).bind(a.user_id).bind(pending).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
    }else{
        sqlx::query("UPDATE trade_sales_orders SET status=$1,shipped_by=$2,shipped_at=CASE WHEN $3 THEN NULL ELSE now() END WHERE entity_id=$4 AND id=$5")
          .bind(new_status).bind(a.user_id).bind(pending).bind(a.entity_id).bind(id).execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    audited(&mut tx,&a,if buy{"partial_receipt"}else{"partial_shipment"},event,json!({"order_id":id,"lines":p.lines.len(),"journal_draft_id":journal,"status":new_status})).await?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok((StatusCode::CREATED,Json(json!({"id":id,"event_id":event,"journal_draft_id":journal,"status":new_status,"commercial_xaf":commercial,"stock_cost_xaf":stock_cost,"idempotent":false,"journal_posted":false}))))
}
pub async fn receive_partial(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<PartialInput>)->Result<(StatusCode,Json<Value>),ApiError>{execute(s,h,id,p,true).await}
pub async fn ship_partial(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>,Json(p):Json<PartialInput>)->Result<(StatusCode,Json<Value>),ApiError>{execute(s,h,id,p,false).await}

async fn progress(pool:&PgPool,a:Auth,id:Uuid,buy:bool)->Result<Json<Value>,ApiError>{
    let exists:bool=if buy{
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM trade_purchase_orders WHERE entity_id=$1 AND id=$2)").bind(a.entity_id).bind(id).fetch_one(pool).await.map_err(ApiError::db)?
    }else{
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM trade_sales_orders WHERE entity_id=$1 AND id=$2)").bind(a.entity_id).bind(id).fetch_one(pool).await.map_err(ApiError::db)?
    };
    if !exists{return Err(ApiError::not_found())}
    let rows=if buy{
        sqlx::query("SELECT item_id,quantity,received_qty AS delivered_qty,unit_cost_xaf AS unit_xaf FROM trade_purchase_lines WHERE entity_id=$1 AND order_id=$2 ORDER BY line_no")
          .bind(a.entity_id).bind(id).fetch_all(pool).await.map_err(ApiError::db)?
    }else{
        sqlx::query("SELECT item_id,quantity,shipped_qty AS delivered_qty,unit_price_xaf AS unit_xaf FROM trade_sales_lines WHERE entity_id=$1 AND order_id=$2 ORDER BY line_no")
          .bind(a.entity_id).bind(id).fetch_all(pool).await.map_err(ApiError::db)?
    };
    let lines:Vec<Value>=rows.iter().map(|r|{
        let ordered:i64=r.get("quantity");let delivered:i64=r.get("delivered_qty");
        json!({"item_id":r.get::<Uuid,_>("item_id"),"ordered":ordered,"delivered":delivered,"backorder":ordered-delivered,"unit_xaf":r.get::<i64,_>("unit_xaf")})
    }).collect();
    Ok(Json(json!({"order_id":id,"scope":"current_legal_entity","lines":lines})))
}
pub async fn purchase_lines(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{let a=auth::require_auth(&h,&s.pool).await?;progress(&s.pool,a,id,true).await}
pub async fn sale_lines(State(s):State<AppState>,h:HeaderMap,Path(id):Path<Uuid>)->Result<Json<Value>,ApiError>{let a=auth::require_auth(&h,&s.pool).await?;progress(&s.pool,a,id,false).await}
pub async fn fulfilments(State(s):State<AppState>,h:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&h,&s.pool).await?;
    let rows=sqlx::query("SELECT id,order_id,kind,period_key,amount_xaf,cost_xaf,journal_id,created_at FROM trade_fulfilments WHERE entity_id=$1 ORDER BY created_at DESC LIMIT 150")
      .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    Ok(Json(json!({"scope":"current_legal_entity","items":rows.iter().map(|r|json!({"event_id":r.get::<Uuid,_>("id"),"order_id":r.get::<Uuid,_>("order_id"),"kind":r.get::<String,_>("kind"),"period_key":r.get::<String,_>("period_key"),"commercial_xaf":r.get::<i64,_>("amount_xaf"),"stock_cost_xaf":r.get::<i64,_>("cost_xaf"),"journal_draft_id":r.get::<Option<Uuid>,_>("journal_id"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect::<Vec<_>>() })))
}

#[cfg(test)] mod tests{
    use super::*;
    #[test]fn reject_empty_request(){assert!(check_lines(&PartialInput{period_key:"2026-10".into(),lines:vec![]}).is_err())}
    #[test]fn reject_duplicate_items(){let id=Uuid::new_v4();let p=PartialInput{period_key:"2026-10".into(),lines:vec![PartialLine{item_id:id,quantity:1},PartialLine{item_id:id,quantity:2}]};assert!(check_lines(&p).is_err())}
    #[test]fn reject_negative_quantities(){assert!(check_lines(&PartialInput{period_key:"2026-10".into(),lines:vec![PartialLine{item_id:Uuid::new_v4(),quantity:-1}]}).is_err())}
    #[test]fn reject_bad_period(){assert!(check_lines(&PartialInput{period_key:"2026-19".into(),lines:vec![PartialLine{item_id:Uuid::new_v4(),quantity:1}]}).is_err())}
}
