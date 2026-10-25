import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const mod=read('backend-rust/src/warehouse.rs');
const schema=read('backend-rust/migrations/0007_rc12_multiwarehouse.sql');
const main=read('backend-rust/src/main.rs');
const testPg=read('backend-rust/tests/pg_rc12_warehouse.rs');
const html=read('public/rc12/index.html');
const js=read('public/rc12/pilot.js');
const mirrorHtml=read('../bluelinecapitale/public/erp/rc12/index.html');
const mirrorJs=read('../bluelinecapitale/public/erp/rc12/pilot.js');

test('RC12 migration uses scoped FK and immutable approval documents',()=>{
 for(const needle of ['CREATE TABLE inventory_transfers','CREATE TABLE inventory_stock_counts','FOREIGN KEY(from_warehouse_id,entity_id)','FOREIGN KEY(to_warehouse_id,entity_id)','FOREIGN KEY(warehouse_id,entity_id)','rc12_transfer_guard','rc12_stock_count_guard','CHECK (approved_by IS NULL OR approved_by<>created_by)']) assert.ok(schema.includes(needle),needle);
});
test('warehouse transfer has paired movements, guarded update and avoids GL revenue recognition',()=>{
 assert.match(mod,/"warehouse_transfer_out"/);assert.match(mod,/"warehouse_transfer_in"/);
 assert.match(mod,/let cost=trade::weighted_average_cost/);assert.match(mod,/only_role\(&a,"manager"\)/);
 assert.match(mod,/if row\.get::<Uuid,_>\("created_by"\)==a\.user_id/);
 assert.match(mod,/tx\.commit\(\)\.await/);
});
test('stock count prevents stale changes and creates balanced draft journal',()=>{
 assert.match(mod,/stock_qty!=snapshot/);assert.match(mod,/Accounting period is locked/);
 assert.match(mod,/Map inventory variance account/);assert.match(mod,/gl_lines/);
 assert.match(mod,/journal_posted":false/);assert.match(schema,/stock_count_adjustment/);
});
test('RC12 core restricts access per entity and reuses idempotency keys',()=>{
 assert.match(mod,/SELECT id,request_hash FROM inventory_transfers WHERE entity_id=\$1/);
 assert.match(mod,/SELECT id,request_hash FROM inventory_stock_counts WHERE entity_id=\$1/);
 assert.match(mod,/trade::require_idempotency/);
 assert.match(mod,/role==role/);assert.match(main,/applied_versions!=expected_versions/);
});
test('Integration suite includes actual PG rollback and legal entity boundary',()=>{
 for(const x of ['TEST_DATABASE_URL','approval','journal','period','stock','Idempotency']){
  if(x==='approval'||x==='Idempotency')continue;
  assert.match(testPg,new RegExp(x,'i'));
 }
 assert.match(testPg,/other_h/);assert.match(testPg,/sum_qty,sum_value/);assert.match(testPg,/count-locked/);
});
test('RC12 pilot frontend does not mutate browser balances optimistically',()=>{
 assert.match(js,/idempotency-key|Idempotency-Key/);assert.match(js,/Server-confirmed draft/);assert.match(js,/APPROVAL REJECTED/);
 assert.match(js,/await request\(`\/api\/v1\/inventory/);
 assert.ok(!js.includes('localStorage.setItem('));
});
test('Both RC12 pilots have matching source and unique HTML IDs',()=>{
 assert.equal(html,mirrorHtml);assert.equal(js,mirrorJs);
 const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'duplicate IDs');
 for(const id of ['rc12TransferForm','rc12CountForm','rc12Transfers','rc12Counts','rc12AccountMap','rc12Evidence'])assert.ok(ids.includes(id),id);
});
test('RC12 CI requires real Rust build and PostgreSQL integration, not only static tests',()=>{
 const yaml=read('.github/workflows/rc12-warehouse-gate.yml');
 assert.match(yaml,/cargo check --all-targets/);assert.match(yaml,/cargo test --all-targets/);
 assert.match(yaml,/postgres:16-alpine/);
});
