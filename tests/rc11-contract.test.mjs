import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const base = new URL('../backend-rust/', import.meta.url);
const read=(p)=>readFileSync(new URL(p,base),'utf8');

test('RC11 guards remain valid as migration chain grows',()=>{
 const xs=readdirSync(new URL('migrations/',base)).filter(x=>x.endsWith('.sql')).sort();
 assert.deepEqual(xs.map(x=>x.slice(0,4)),Array.from({length:12},(_,i)=>String(i+1).padStart(4,'0')));
});
test('RC11 production startup cannot auto-migrate and requires exact schema version',()=>{
 const text=read('src/main.rs');
 assert.match(text,/ERP_AUTO_MIGRATE/);
 assert.match(text,/ERP_ENV/);
 assert.match(text,/if failed>0 \|\| applied_versions!=expected_versions/);
 assert.match(text,/Migrator::new/);
});
test('RC11 SQL guards draft journals and lines against closed-period writes',()=>{
 const sql=read('migrations/0006_rc11_period_guards.sql');
 assert.match(sql,/BEFORE INSERT OR UPDATE OR DELETE ON gl_lines/);
 assert.match(sql,/BEFORE INSERT OR UPDATE ON gl_journals/);
 assert.match(sql,/FOR SHARE/);
 assert.match(sql,/period_is_closed/);
 assert.match(sql,/rc11_posted_requires_identity_and_time/);
});
test('RC11 CI requires real cargo check and PostgreSQL tests, not only contract checks',()=>{
 const yaml=readFileSync(new URL('../.github/workflows/rc11-rust-postgres-gate.yml',base),'utf8');
 assert.match(yaml,/cargo check --all-targets/);
 assert.match(yaml,/cargo test --all-targets/);
 assert.match(yaml,/TEST_DATABASE_URL/);
 assert.match(yaml,/postgres:16-alpine/);
});
test('RC11 journal sums bound to supported XAF pilot range',()=>{
 const text=read('src/journal.rs');
 assert.match(text,/9_000_000_000_000_000/);
 assert.match(text,/dr>9_000_000_000_000_000/);
});
