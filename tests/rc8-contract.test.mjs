// RC8 contract / anti-regression assertions; these are STATIC tests, not Cargo or PG execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const rust=read('backend-rust/src/trade.rs');
const server=read('backend-rust/src/main.rs');
const sql=read('backend-rust/migrations/0003_trade_inventory.sql');
const pilot=read('public/rc8/pilot.js');
const html=read('public/rc8/index.html');
test('11 trading routes explicitly registered',()=>{
 const paths=['/api/v1/trade/catalog','/api/v1/trade/catalog/items','/api/v1/trade/catalog/warehouses','/api/v1/trade/posting-accounts','/api/v1/trade/movements','/api/v1/purchasing/orders','/api/v1/purchasing/orders/{id}/approve','/api/v1/purchasing/orders/{id}/receive','/api/v1/sales/orders','/api/v1/sales/orders/{id}/approve','/api/v1/sales/orders/{id}/ship'];
 paths.forEach(p=>assert.ok(server.includes(`"${p}"`),p));
});
test('legal entity scope in business documents, balances and composite references',()=>{
 for(const t of ['inventory_items','inventory_warehouses','inventory_balances','trade_purchase_orders','trade_purchase_lines','trade_sales_orders','trade_sales_lines','inventory_movements','trade_posting_accounts'])assert.match(sql,new RegExp(`CREATE TABLE ${t} \\(`));
 assert.ok((sql.match(/FOREIGN KEY\([^)]+,entity_id\)/g)||[]).length>=9);
 assert.match(rust,/WHERE entity_id=\$1 AND id=\$2 FOR UPDATE/);
});
test('business actions restrict group_admin and separate actor responsibilities',()=>{
 assert.match(rust,/fn require_role\(/);
 assert.match(rust,/valid\.contains\(&auth\.role\.as_str\(\)\)/);
 assert.match(rust,/approved_by.*Some\(a\.user_id\)/);
 assert.match(rust,/created_by.*==a\.user_id/);
});
test('stock prevents overselling, locks rows, never edits posted journal lines',()=>{
 assert.match(rust,/FOR UPDATE/);
 assert.match(rust,/weighted_average_cost\(/);
 assert.match(rust,/Insufficient quantity or unvalued inventory/);
 assert.match(sql,/CREATE TRIGGER inventory_movements_append_only/);
 assert.match(sql,/CHECK \(quantity>=0\)/);
});
test('journal is a draft tied uniquely to source and created within transaction',()=>{
 assert.match(sql,/CREATE UNIQUE INDEX gl_source_trade_once/);
 assert.match(rust,/journal_draft\(&mut tx/);
 assert.match(rust,/tx\.commit\(\)\.await/);
 assert.match(rust,/journal_posted":false/);
});
test('order creation uses entity-scoped idempotency and rejects repeated SKU in one order',()=>{
 assert.match(sql,/PRIMARY KEY\(entity_id,operation,request_key\)/);
 assert.match(rust,/Duplicate item in an order/);
 assert.match(rust,/request_hash/);
 assert.match(rust,/pg_advisory_xact_lock/);
});
test('RC8 UI keeps idempotency token on failure and requires confirmed server response',()=>{
 assert.match(pilot,/form\.dataset\.pendingKey\|\|/);
 assert.match(pilot,/delete form\.dataset\.pendingKey;/);
 assert.match(pilot,/await request\(`/);
 assert.ok(!pilot.includes('Math.random() * 890'));
});
test('RC8 pilot has unique controls and callable trade actions',()=>{
 for(const id of ['buyForm','saleForm','itemForm','warehouseForm','tradeBalances','purchasesBody','salesBody','refreshTrade','showMovements'])assert.ok(html.includes(`id="${id}"`),id);
 assert.match(pilot,/loadTrade\(\)/);
 assert.match(pilot,/\/api\/v1\/purchasing\/orders/);
 assert.match(pilot,/\/api\/v1\/sales\/orders/);
});
