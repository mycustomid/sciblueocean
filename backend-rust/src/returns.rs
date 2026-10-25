//! RC10 returns from an immutable RC9 fulfilment event.
//! Inventory changes and DRAFT GL adjustment are atomic; this is NOT a legal credit note,
//! cash refund, certified OHADA tax treatment, or automatic posted-journal reversal.
use std::collections::HashSet;
use axum::{extract::{Path,State},http::{HeaderMap,StatusCode},Json};
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use sqlx::{Row,Postgres,Transaction};
use sha2::{Digest,Sha256};
use uuid::Uuid;
use crate::{AppState,auth::{self,Auth},error::ApiError,trade};

#[derive(Clone,Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReturnLine {pub item_id:Uuid,pub quantity:i64}
#[derive(Deserialize,Serialize)]
#[serde(deny_unknown_fields)]
pub struct ReturnInput {pub period_key:String,pub reason:String,pub lines:Vec<ReturnLine>}

pub fn validate(p:&ReturnInput)->Result<(),ApiError>{
    trade::validate_period(&p.period_key)?;
    if p.reason.trim().len()<8||p.reason.len()>500{return Err(ApiError::bad("Return reason must be 8..500 characters"))}
    if p.lines.is_empty()||p.lines.len()>50{return Err(ApiError::bad("Return needs 1..50 item lines"))}
    let mut seen=HashSet::new();
    for line in &p.lines{
        if !(1..=1_000_000).contains(&line.quantity)||!seen.insert(line.item_id){
            return Err(ApiError::bad("Return quantity/item invalid or duplicated"))
        }
    }
    Ok(())
}

/// Allocate original COGS as individual customer returns arrive, preserving exact sum
/// on the last return. All values are whole XAF; overflow cannot silently wrap.
pub fn historical_cost(original_value:i64, original_qty:i64, already_value:i64, already_qty:i64, requested_qty:i64)->Result<i64,ApiError>{
    if original_qty<=0 || original_value<original_qty || already_value<0 || already_value>=original_value ||
       already_qty<0 || requested_qty<=0 || already_qty+requested_qty>original_qty {
        return Err(ApiError::conflict("Original fulfilment return balance invalid"))
    }
    let remaining=original_value-already_value;
    let calc=if already_qty+requested_qty==original_qty {remaining}
    else {
        let v=(i128::from(original_value)*i128::from(requested_qty))/i128::from(original_qty);
        i64::try_from(v).map_err(|_|ApiError::bad("Return valuation overflow"))?
    };
    if calc<=0 || calc>remaining{return Err(ApiError::conflict("Return valuation outside original balance"))}
    Ok(calc)
}

async fn posting_account(tx:&mut Transaction<'_,Postgres>,a:&Auth,role:&str)->Result<Uuid,ApiError>{
    sqlx::query_scalar("SELECT g.id FROM trade_posting_accounts t JOIN gl_accounts g ON g.entity_id=t.entity_id AND g.id=t.account_id WHERE t.entity_id=$1 AND t.posting_role=$2 AND g.active=true")
        .bind(a.entity_id).bind(role).fetch_optional(&mut **tx).await.map_err(ApiError::db)?
        .ok_or_else(||ApiError::bad(format!("Map an active {} GL account first",role)))
}
async fn add_gl_line(tx:&mut Transaction<'_,Postgres>,a:&Auth,journal:Uuid,account:Uuid,debit:i64,credit:i64)->Result<(),ApiError>{
    if debit==0&&credit==0{return Ok(())}
    sqlx::query("INSERT INTO gl_lines(entity_id,journal_id,account_id,debit_xaf,credit_xaf) VALUES($1,$2,$3,$4,$5)")
        .bind(a.entity_id).bind(journal).bind(account).bind(debit).bind(credit)
        .execute(&mut **tx).await.map_err(ApiError::db)?;
    Ok(())
}

pub async fn create_return(State(s):State<AppState>,headers:HeaderMap,Path(fulfilment):Path<Uuid>,Json(payload):Json<ReturnInput>)->Result<(StatusCode,Json<Value>),ApiError>{
    let a=auth::require_auth(&headers,&s.pool).await?;
    // Require different business manager from original fulfiller; IT admin cannot perform stock return.
    if a.role!="manager"{return Err(ApiError::forbidden())}
    validate(&payload)?;
    let key=trade::require_idempotency(&headers)?;
    let hash=hex::encode(Sha256::digest(serde_json::to_vec(&payload).map_err(|_|ApiError::bad("Invalid return"))?));
    let mut tx=s.pool.begin().await.map_err(ApiError::db)?;
    let f=sqlx::query("SELECT order_id,kind,created_by,journal_id FROM trade_fulfilments WHERE entity_id=$1 AND id=$2 FOR UPDATE")
        .bind(a.entity_id).bind(fulfilment).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
        .ok_or_else(ApiError::not_found)?;
    let original_kind:String=f.get("kind");
    let kind=match original_kind.as_str(){"sales_shipment"=>"customer_return","purchase_receipt"=>"supplier_return",_=>return Err(ApiError::bad("Unsupported original event"))};
    let previous=sqlx::query("SELECT id,request_hash,journal_id,commercial_xaf,inventory_value_xaf FROM trade_returns WHERE entity_id=$1 AND fulfilment_id=$2 AND kind=$3 AND request_key=$4")
        .bind(a.entity_id).bind(fulfilment).bind(kind).bind(&key).fetch_optional(&mut *tx).await.map_err(ApiError::db)?;
    if let Some(p)=previous{
        if p.get::<String,_>("request_hash")!=hash{return Err(ApiError::conflict("Idempotency key reused with different return payload"))}
        return Ok((StatusCode::OK,Json(json!({"return_id":p.get::<Uuid,_>("id"),"journal_draft_id":p.get::<Option<Uuid>,_>("journal_id"),"commercial_xaf":p.get::<i64,_>("commercial_xaf"),"inventory_value_xaf":p.get::<i64,_>("inventory_value_xaf"),"idempotent":true,"journal_posted":false}))))
    }
    if f.get::<Uuid,_>("created_by")==a.user_id{return Err(ApiError::forbidden())}
    if f.get::<Option<Uuid>,_>("journal_id").is_none(){return Err(ApiError::conflict("Original fulfilment not finalized"))}
    let order:Uuid=f.get("order_id");
    let wh:Uuid=(if kind=="customer_return"{
        sqlx::query_scalar("SELECT warehouse_id FROM trade_sales_orders WHERE entity_id=$1 AND id=$2")
            .bind(a.entity_id).bind(order).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
    }else{
        sqlx::query_scalar("SELECT warehouse_id FROM trade_purchase_orders WHERE entity_id=$1 AND id=$2")
            .bind(a.entity_id).bind(order).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
    }).ok_or_else(ApiError::not_found)?;
    // Period lock precedes all inventory side effects and is held through commit.
    sqlx::query("INSERT INTO gl_periods(entity_id,period_key) VALUES($1,$2) ON CONFLICT(entity_id,period_key) DO NOTHING")
        .bind(a.entity_id).bind(&payload.period_key).execute(&mut *tx).await.map_err(ApiError::db)?;
    let locked:bool=sqlx::query_scalar("SELECT is_locked FROM gl_periods WHERE entity_id=$1 AND period_key=$2 FOR UPDATE")
        .bind(a.entity_id).bind(&payload.period_key).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    if locked{return Err(ApiError::conflict("Accounting period locked"))}
    let ret_id=Uuid::new_v4();let mut commercial=0i64;let mut inv_value=0i64;
    sqlx::query("INSERT INTO trade_returns(id,entity_id,fulfilment_id,warehouse_id,kind,period_key,request_key,request_hash,reason,commercial_xaf,inventory_value_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,1,1,$10)")
        .bind(ret_id).bind(a.entity_id).bind(fulfilment).bind(wh).bind(kind).bind(&payload.period_key).bind(&key).bind(&hash).bind(payload.reason.trim()).bind(a.user_id)
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    for line in &payload.lines{
        let original=sqlx::query("SELECT quantity,commercial_amount_xaf,inventory_value_xaf FROM trade_fulfilment_lines WHERE entity_id=$1 AND fulfilment_id=$2 AND item_id=$3")
            .bind(a.entity_id).bind(fulfilment).bind(line.item_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
            .ok_or_else(||ApiError::bad("Item is not part of original fulfilment"))?;
        let qty:i64=original.get("quantity");
        // Serialize concurrent return creation by the origin row lock; sum remains stable.
        let prior=sqlx::query("SELECT COALESCE(sum(l.quantity),0)::bigint AS qty,COALESCE(sum(l.inventory_value_xaf),0)::bigint AS value,COALESCE(sum(l.commercial_xaf),0)::bigint AS commercial_value FROM trade_return_lines l JOIN trade_returns r ON r.id=l.return_id AND r.entity_id=l.entity_id WHERE r.entity_id=$1 AND r.fulfilment_id=$2 AND l.item_id=$3")
            .bind(a.entity_id).bind(fulfilment).bind(line.item_id).fetch_one(&mut *tx).await.map_err(ApiError::db)?;
        let previous_qty:i64=prior.get("qty");let prev_value:i64=prior.get("value");let prev_commercial:i64=prior.get("commercial_value");
        if line.quantity>qty-previous_qty{return Err(ApiError::conflict("Return exceeds original delivered quantity"))}
        let original_commercial:i64=original.get("commercial_amount_xaf");
        let original_value:i64=original.get("inventory_value_xaf");
        let comm=historical_cost(original_commercial,qty,prev_commercial,previous_qty,line.quantity)?;
        let cost=if kind=="customer_return"{
            historical_cost(original_value,qty,prev_value,previous_qty,line.quantity)?
        }else{
            let bal=sqlx::query("SELECT quantity,value_xaf FROM inventory_balances WHERE entity_id=$1 AND warehouse_id=$2 AND item_id=$3 FOR UPDATE")
                .bind(a.entity_id).bind(wh).bind(line.item_id).fetch_optional(&mut *tx).await.map_err(ApiError::db)?
                .ok_or_else(||ApiError::conflict("No stock available for supplier return"))?;
            trade::weighted_average_cost(bal.get("quantity"),bal.get("value_xaf"),line.quantity)?
        };
        commercial=commercial.checked_add(comm).ok_or_else(||ApiError::bad("Commercial total overflow"))?;
        inv_value=inv_value.checked_add(cost).ok_or_else(||ApiError::bad("Inventory total overflow"))?;
        if kind=="customer_return"{
            sqlx::query("INSERT INTO inventory_balances(entity_id,warehouse_id,item_id,quantity,value_xaf) VALUES($1,$2,$3,$4,$5) ON CONFLICT(entity_id,warehouse_id,item_id) DO UPDATE SET quantity=inventory_balances.quantity+EXCLUDED.quantity,value_xaf=inventory_balances.value_xaf+EXCLUDED.value_xaf,updated_at=now()")
                .bind(a.entity_id).bind(wh).bind(line.item_id).bind(line.quantity).bind(cost)
                .execute(&mut *tx).await.map_err(ApiError::db)?;
        }else{
            sqlx::query("UPDATE inventory_balances SET quantity=quantity-$1,value_xaf=value_xaf-$2,updated_at=now() WHERE entity_id=$3 AND warehouse_id=$4 AND item_id=$5")
                .bind(line.quantity).bind(cost).bind(a.entity_id).bind(wh).bind(line.item_id)
                .execute(&mut *tx).await.map_err(ApiError::db)?;
        }
        let delta=if kind=="customer_return"{line.quantity}else{-line.quantity};
        let value_delta=if kind=="customer_return"{cost}else{-cost};
        sqlx::query("INSERT INTO inventory_movements(entity_id,warehouse_id,item_id,source_type,source_id,quantity_delta,value_delta_xaf,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)")
            .bind(a.entity_id).bind(wh).bind(line.item_id).bind(kind).bind(ret_id).bind(delta).bind(value_delta).bind(a.user_id)
            .execute(&mut *tx).await.map_err(ApiError::db)?;
        sqlx::query("INSERT INTO trade_return_lines(return_id,entity_id,item_id,quantity,commercial_xaf,inventory_value_xaf) VALUES($1,$2,$3,$4,$5,$6)")
            .bind(ret_id).bind(a.entity_id).bind(line.item_id).bind(line.quantity).bind(comm).bind(cost)
            .execute(&mut *tx).await.map_err(ApiError::db)?;
    }
    // Return journal offsets purchase/sale recognition but remains DRAFT. External refund not executed.
    let journal:Uuid=sqlx::query_scalar("INSERT INTO gl_journals(entity_id,period_key,memo,source_trade_type,source_trade_id,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id")
        .bind(a.entity_id).bind(&payload.period_key).bind(format!("RC10 {} {} — draft adjustment, manual review",kind,ret_id)).bind(kind).bind(ret_id).bind(a.user_id)
        .fetch_one(&mut *tx).await.map_err(ApiError::db)?;
    if kind=="customer_return"{
        let ar=posting_account(&mut tx,&a,"accounts_receivable").await?;
        let sales=posting_account(&mut tx,&a,"sales_revenue").await?;
        let inventory=posting_account(&mut tx,&a,"inventory").await?;
        let cogs=posting_account(&mut tx,&a,"cost_of_goods_sold").await?;
        add_gl_line(&mut tx,&a,journal,sales,commercial,0).await?;
        add_gl_line(&mut tx,&a,journal,ar,0,commercial).await?;
        add_gl_line(&mut tx,&a,journal,inventory,inv_value,0).await?;
        add_gl_line(&mut tx,&a,journal,cogs,0,inv_value).await?;
    }else{
        let ap=posting_account(&mut tx,&a,"accounts_payable").await?;
        let inventory=posting_account(&mut tx,&a,"inventory").await?;
        add_gl_line(&mut tx,&a,journal,ap,commercial,0).await?;
        add_gl_line(&mut tx,&a,journal,inventory,0,inv_value).await?;
        let difference=i128::from(commercial)-i128::from(inv_value);
        if difference!=0{
            let variance=posting_account(&mut tx,&a,"purchase_price_variance").await?;
            let amount=i64::try_from(difference.abs()).map_err(|_|ApiError::bad("Variance overflow"))?;
            if difference>0{add_gl_line(&mut tx,&a,journal,variance,0,amount).await?}
            else{add_gl_line(&mut tx,&a,journal,variance,amount,0).await?}
        }
    }
    sqlx::query("UPDATE trade_returns SET commercial_xaf=$1,inventory_value_xaf=$2,journal_id=$3 WHERE id=$4 AND entity_id=$5")
        .bind(commercial).bind(inv_value).bind(journal).bind(ret_id).bind(a.entity_id)
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    sqlx::query("INSERT INTO audit_events(entity_id,actor_id,event_type,resource_type,resource_id,metadata) VALUES($1,$2,'rc10_trade_return_created','trade_return',$3,$4)")
        .bind(a.entity_id).bind(a.user_id).bind(ret_id).bind(json!({"origin_fulfilment":fulfilment,"kind":kind,"commercial_xaf":commercial,"inventory_value_xaf":inv_value,"journal_draft_id":journal,"disclaimer":"No statutory credit note, tax refund or posted GL reversal"}))
        .execute(&mut *tx).await.map_err(ApiError::db)?;
    tx.commit().await.map_err(ApiError::db)?;
    Ok((StatusCode::CREATED,Json(json!({"return_id":ret_id,"origin_fulfilment_id":fulfilment,"kind":kind,"commercial_xaf":commercial,"inventory_value_xaf":inv_value,"journal_draft_id":journal,"journal_posted":false,"idempotent":false,"credit_note_issued":false}))))
}

pub async fn returnable(State(s):State<AppState>,headers:HeaderMap,Path(fulfilment):Path<Uuid>)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&s.pool).await?;
    let original=sqlx::query("SELECT kind,journal_id FROM trade_fulfilments WHERE entity_id=$1 AND id=$2")
       .bind(a.entity_id).bind(fulfilment).fetch_optional(&s.pool).await.map_err(ApiError::db)?
       .ok_or_else(ApiError::not_found)?;
    let rows=sqlx::query("SELECT l.item_id,l.quantity AS original_qty,COALESCE((SELECT SUM(t.quantity) FROM trade_return_lines t JOIN trade_returns r ON r.id=t.return_id AND r.entity_id=t.entity_id WHERE r.entity_id=l.entity_id AND r.fulfilment_id=l.fulfilment_id AND t.item_id=l.item_id),0)::bigint AS returned_qty FROM trade_fulfilment_lines l WHERE l.entity_id=$1 AND l.fulfilment_id=$2 ORDER BY l.item_id")
        .bind(a.entity_id).bind(fulfilment).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    let lines:Vec<Value>=rows.iter().map(|r|{let qty:i64=r.get("original_qty");let done:i64=r.get("returned_qty");json!({"item_id":r.get::<Uuid,_>("item_id"),"original_qty":qty,"returned_qty":done,"returnable_qty":qty-done})}).collect();
    Ok(Json(json!({"fulfilment_id":fulfilment,"kind":original.get::<String,_>("kind"),"finalized":original.get::<Option<Uuid>,_>("journal_id").is_some(),"lines":lines,"scope":"current_legal_entity"})))
}

pub async fn list_returns(State(s):State<AppState>,headers:HeaderMap)->Result<Json<Value>,ApiError>{
    let a=auth::require_auth(&headers,&s.pool).await?;
    let rows=sqlx::query("SELECT id,fulfilment_id,kind,period_key,commercial_xaf,inventory_value_xaf,journal_id,created_at FROM trade_returns WHERE entity_id=$1 ORDER BY created_at DESC,id DESC LIMIT 150")
        .bind(a.entity_id).fetch_all(&s.pool).await.map_err(ApiError::db)?;
    let items:Vec<Value>=rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"fulfilment_id":r.get::<Uuid,_>("fulfilment_id"),"kind":r.get::<String,_>("kind"),"period_key":r.get::<String,_>("period_key"),"commercial_xaf":r.get::<i64,_>("commercial_xaf"),"inventory_value_xaf":r.get::<i64,_>("inventory_value_xaf"),"journal_draft_id":r.get::<Option<Uuid>,_>("journal_id"),"created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at")})).collect();
    Ok(Json(json!({"items":items,"scope":"current_legal_entity","credit_notes_issued":false})))
}

#[cfg(test)]
mod tests{
 use super::*;
 fn req(q:i64)->ReturnInput{ReturnInput{period_key:"2026-10".into(),reason:"Customer rejected package".into(),lines:vec![ReturnLine{item_id:Uuid::new_v4(),quantity:q}]}}
 #[test]fn reject_zero_qty(){assert!(validate(&req(0)).is_err())}
 #[test]fn reject_bad_reason(){let mut x=req(1);x.reason="bad".into();assert!(validate(&x).is_err())}
 #[test]fn allocate_full_remainder(){assert_eq!(historical_cost(100,3,33,1,2).unwrap(),67)}
 #[test]fn reject_excess_return(){assert!(historical_cost(300,3,0,2,2).is_err())}
}
