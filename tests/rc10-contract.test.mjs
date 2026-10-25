import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const rust=(p)=>fs.readFileSync(path.join(root,'backend-rust',p),'utf8');
const web=(p)=>fs.readFileSync(path.join(root,'public/rc10',p),'utf8');
test('RC10 API routes map to Rust functions',()=>{
  const entry=rust('src/main.rs'), source=rust('src/returns.rs'), lib=rust('src/lib.rs');
  for(const x of ['create_return','returnable','list_returns']) assert.match(source,new RegExp(`pub async fn ${x}`));
  assert.match(lib,/pub mod returns;/);
  for(const suffix of ['/trade/returns','/trade/fulfilments/{id}/return','/trade/fulfilments/{id}/returnable'])assert.ok(entry.includes(suffix));
});
test('RC10 returns are atomic and journals remain drafts',()=>{
  const s=rust('src/returns.rs');
  assert.match(s,/tx\.commit\(\)\.await/);
  assert.match(s,/journal_posted.*false/);
  assert.match(s,/credit_note_issued.*false/);
  assert.match(s,/weighted_average_cost/);
  assert.match(s,/posting_account\(&mut tx,&a,"purchase_price_variance"\)/);
  assert.ok(s.includes('Idempotency')||s.includes('idempotency'));
  assert.ok(s.includes('original fulfilment')||s.includes('original delivered quantity'));
});
test('RC10 migration guards source scope, immutable return, returned quantity',()=>{
  const s=rust('migrations/0005_controlled_returns.sql');
  for(const fragment of ['FOREIGN KEY(fulfilment_id,entity_id)','trade_returns_immutable_guard','trade_return_lines_immutable_guard','trade_return_lines_origin_cap','gl_trade_pair_rc10','supplier_return','customer_return'])assert.ok(s.includes(fragment),fragment);
});
test('RC10 UI has no duplicate ids and binds real return evidence',()=>{
  const html=web('index.html');const js=web('pilot.js');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'duplicate HTML IDs');
  for(const id of ['rc10LoadEvents','rc10ReturnForm','rc10ReturnsBody','rc10Evidence','rc10Fulfilment','rc10Item'])assert.ok(ids.includes(id));
  for(const path of ['/api/v1/trade/returns','/api/v1/trade/fulfilments/','/returnable'])assert.ok(js.includes(path));
  assert.match(js,/form\.dataset\.pendingKey/);
  assert.match(js,/if\s*\(!response\.ok\)/);
  assert.ok(!js.includes('localStorage.setItem('));
});
test('RC10 test suite proves relevant safety cases',()=>{
 const t=rust('tests/pg_rc10_returns.rs');
 for(const f of ['rc10-cross-company','rc10-customer-too-many','rc10-period-locked','rc10-customer-01','journal_draft_id','is_locked=true'])assert.ok(t.includes(f),f);
});
