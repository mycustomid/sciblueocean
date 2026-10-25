import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=x=>readFileSync(new URL(x,root),'utf8');
const sql=[8,9,10].map((v)=>read('backend-rust/migrations/'+({8:'0008_rc13_finance.sql',9:'0009_rc14_hospitality_fx.sql',10:'0010_rc15_industry_workflows.sql'}[v])));
const main=read('backend-rust/src/main.rs');
const rust=['finance','hospitality','fx','industry'].map(n=>read('backend-rust/src/'+n+'.rs'));
const migrations=readdirSync(new URL('backend-rust/migrations/',root)).filter(n=>n.endsWith('.sql')).sort();
test('RC15 records twelve cumulative migrations in strict ascending sequence',()=>{
 assert.deepEqual(migrations.map(x=>x.slice(0,4)),Array.from({length:12},(_,i)=>String(i+1).padStart(4,'0')));
 assert.match(main,/applied_versions!=expected_versions/);assert.match(main,/ERP_ENV/);assert.match(main,/failed>0/);
});
test('RC13 finance entities, scoped foreign keys and bank evidence are separate',()=>{
 for(const n of ['CREATE TABLE rc13_invoices','CREATE TABLE rc13_receipts','CREATE TABLE rc13_bank_lines','CREATE TABLE rc13_accounts','FOREIGN KEY(invoice_id,entity_id)','FOREIGN KEY(bank_line_id,entity_id)','rc13_invoice_guard'])assert.ok(sql[0].includes(n),n);
});
test('RC13 only counts receipts after bank reconciliation; journal drafts stay unposted',()=>{
 const f=rust[0];
 for(const n of ['"status":"pending_bank_match"','"reduces_ar":false','open_period','bank_line_id','FOR UPDATE','matched_receipt_id','draft_two_line','"posted":false','only(&a,"finance")'])assert.ok(f.includes(n),n);
});
test('RC13 routes use authenticated server Rust modules',()=>{
 for(const n of ['finance/invoices','finance/receipts','finance/bank-lines','finance/accounts'])assert.ok(main.includes(n));
});
test('RC14 DB exclusion prevents overlapping active room bookings and leases',()=>{
 for(const n of ['CREATE EXTENSION IF NOT EXISTS btree_gist','EXCLUDE USING gist','daterange(arrival,departure','daterange(starts_on,ends_on','checked_in','checked_out'])assert.ok(sql[1].includes(n),n);
});
test('RC14 rooms require entity-scoped access, active status and nights valuation',()=>{
 const f=rust[1];
 for(const n of ['entity_id=$1','FOR UPDATE','Room unavailable for service','nights','"payment_captured":false','"folio_settled":false'])assert.ok(f.includes(n),n);
});
test('RC14 FX is indicative only and never touches actual settlement',()=>{
 for(const n of ['indicative_only','live_rate_verified','settlement":false','manual_input_not_market_feed'])assert.ok((rust[2]+sql[1]).includes(n),n);
});
test('RC15 domain tables are not repurposed hotel bookings and require membership scope',()=>{
 for(const n of ['CREATE TABLE rc15_projects','CREATE TABLE rc15_progress','CREATE TABLE rc15_batches','CREATE TABLE rc15_import_dossiers','FOREIGN KEY(project_id,entity_id)','FOREIGN KEY(item_id,entity_id)','status IN','rc15_batch_transition_guard','rc15_import_transition_guard','rc15_progress_transition_guard'])assert.ok(sql[2].includes(n),n);
});
test('RC15 work package maker checker, batch QC roles and import evidence',()=>{
 const f=rust[3];
 for(const n of ['only(&a,"manager")','only(&a,"operator")','only(&a,"auditor")','"awaiting_qc"','"qc_passed"','"statutory_certified":false','"customs_release_confirmed":false','"client_billing_created":false'])assert.ok(f.includes(n),n);
});
test('RC15 routes contain 3 separate operational domains',()=>{
 for(const n of ['construction/projects','construction/progress','manufacturing/batches','import/dossiers'])assert.ok(main.includes(n),n);
});
for(const version of [13,14,15]){
 test('RC'+version+' pilots are mirrored and have valid unique controls',()=>{
  const a='public/rc'+version+'/';const b='../bluelinecapitale/public/erp/rc'+version+'/';
  for(const name of ['index.html','pilot.js','pilot.css'])assert.equal(read(a+name),read(b+name),'mirror '+name);
  const html=read(a+'index.html');const js=read(a+'pilot.js');const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
  for(const n of ['login','result','probe','identity','logout'])assert.ok(ids.includes(n),n);
  assert.match(js,/if\(!token\)/);assert.match(js,/Authentication required/);assert.ok(!js.includes('localStorage.setItem('));
  assert.ok(!html.includes('value="secret"'));
 });
}
test('RC13 RC14 RC15 programs do not falsely promise certified accounting or live FX',()=>{
 for(const v of [13,14,15]){const text=read('public/rc'+v+'/index.html');assert.match(text,/NOT PRODUCTION CERTIFIED/);assert.match(text,/No server response yet/)}
});
