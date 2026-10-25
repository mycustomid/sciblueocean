import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname,'..');
const txt = p => fs.readFileSync(path.join(root,p),'utf8');
test('RC9 additive migration preserves RC8 and introduces multi-event receipts/shipments',()=>{
 const sql=txt('backend-rust/migrations/0004_partial_fulfilment.sql');
 for (const phrase of ['received_qty','shipped_qty','partially_received','partially_shipped','trade_fulfilments','trade_fulfilment_lines','request_key','protect_finalized_fulfilment','UPDATE trade_purchase_lines l','UPDATE trade_sales_lines l']) assert.ok(sql.includes(phrase),phrase);
 assert.match(sql,/UNIQUE\(entity_id,kind,order_id,request_key\)/);
});
test('Rust partial handlers require backend auth, order lock, idempotency and database transaction',()=>{
 const rust=txt('backend-rust/src/partial.rs');
 for(const phrase of ['require_auth','require_ops','require_idempotency','FOR UPDATE','fetch_optional','request_hash','weighted_average_cost','journal_draft','audit_events','tx.commit().await','backorder','CREATE']) assert.ok(rust.includes(phrase),phrase);
 assert.match(rust,/if line.quantity>qty_total-already/);
 assert.match(rust,/return Err\(ApiError::forbidden\(\)\)/);
});
test('Routes expose partial receipts, shipments, line balances and history',()=>{
 const main=txt('backend-rust/src/main.rs');
 for(const p of ['/receive-partial','/ship-partial','/trade/fulfilments','/orders/{id}/lines'])assert.ok(main.includes(p),p);
 assert.match(main,/mod|use blue_line_erp_api/);
});
test('RC9 UI has no duplicate IDs and only server-confirmed success',()=>{
 const html=txt('public/rc9/index.html');
 const ids=Array.from(html.matchAll(/\bid="([^"]+)"/g),m=>m[1]);
 assert.equal(ids.length,new Set(ids).size,'duplicate ID');
 for(const id of ['partialBuyOrder','partialSaleOrder','partialBuyItem','partialSaleItem','partialPurchaseForm','partialSaleForm','partialEvidence','showFulfilments'])assert.ok(ids.includes(id),id);
 const js=txt('public/rc9/pilot.js');
 for(const phrase of ['crypto.randomUUID()','Idempotency-Key','await request(','await loadPartialOrders()','retry','data-max'])assert.ok(js.toLowerCase().includes(phrase.toLowerCase()),phrase);
 assert.ok(!js.includes('localStorage'));
});
test('PG integration tests cover partial flows and rollback',()=>{
 const x=txt('backend-rust/tests/pg_rc9_partial.rs');
 for(const term of ['partially_received','partially_shipped','backorder','journal_draft_id','is_locked=true','idempotent','outsider'])assert.ok(x.includes(term),term);
});
