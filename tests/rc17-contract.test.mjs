import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const get=x=>readFileSync(new URL(x,root),'utf8');
const main=get('backend-rust/src/main.rs'),auth=get('backend-rust/src/auth.rs');
const policy=get('backend-rust/src/policy.rs'),hr=get('backend-rust/src/hr.rs');
const security=get('backend-rust/src/security.rs');
const sql16=get('backend-rust/migrations/0011_rc16_hr_bridge.sql');
const sql17=get('backend-rust/migrations/0012_rc17_security_governance.sql');
const filenames=readdirSync(new URL('backend-rust/migrations/',root)).filter(s=>s.endsWith('.sql')).sort();
test('RC17 migration chain is strictly 0001 through 0012 with startup fail-closed',()=>{
 assert.deepEqual(filenames.map(s=>s.slice(0,4)),Array.from({length:12},(_,i)=>String(i+1).padStart(4,'0')));
 assert.match(main,/failed>0 \|\| applied_versions!=expected_versions/);assert.match(main,/ERP_AUTO_MIGRATE/);
});
test('RC16 personnel records, payroll snapshot, and event history have legal-entity FK bounds',()=>{
 for(const s of ['CREATE TABLE rc16_employees','CREATE TABLE rc16_attendance','CREATE TABLE rc16_leave_requests','CREATE TABLE rc16_payroll_runs','CREATE TABLE rc16_payroll_lines','FOREIGN KEY(employee_id,entity_id)','FOREIGN KEY(run_id,entity_id)','FOREIGN KEY(created_by,entity_id)','rc16_run_guard','rc16_attendance_guard','rc16_leave_guard'])assert.ok(sql16.includes(s),s);
});
test('RC16 salary data is role gated and no statutory net-pay/payment is fabricated',()=>{
 for(const s of ['only(&a,&["hr"])?','only(&a,&["hr_manager"])?','only(&a,&["finance"])?','"tax_calculated":false','"net_pay_calculated":false','"disbursement":false','"gl_posted":false'])assert.ok(hr.includes(s),s);
 assert.match(hr,/monthly_base_xaf/);assert.match(hr,/created_by<>\$1/);assert.match(hr,/manager_by<>\$1/);
});
test('Cross-domain bridge returns only counts per company and disclaims consolidation',()=>{
 for(const t of ['trade_purchase_orders','trade_sales_orders','rc13_invoices','rc14_reservations','rc15_projects','rc15_batches','rc16_employees','"financial_consolidated":false'])assert.ok(hr.includes(t),t);
 assert.match(hr,/entity_id=\$1/);
});
test('RC17 bearer token checks session epoch and live membership',()=>{
 assert.match(auth,/u\.session_epoch=s\.session_epoch/);
 assert.match(auth,/m\.active=true/);
 assert.match(auth,/INSERT INTO auth_sessions\(token_hash,user_id,entity_id,expires_at,session_epoch\)/);
 assert.doesNotMatch(auth,/auth\.role=="group_admin"\|\|permitted/);
});
test('RC17 membership changes revoke active sessions in PostgreSQL',()=>{
 for(const s of ['CREATE FUNCTION rc17_revoke_sessions_on_membership_change','UPDATE app_users SET session_epoch=session_epoch+1','UPDATE auth_sessions SET revoked_at=now()','AFTER UPDATE OF role,active','CREATE TABLE rc17_security_events','rc17_security_event_immutable'])assert.ok(sql17.includes(s),s);
});
test('RC17 generic records use explicit module access for read and write',()=>{
 const routes=get('backend-rust/src/routes.rs'), evidence=get('backend-rust/src/evidence.rs');
 for(const s of ['ensure_module(&a,&req.module_key,true)','visible_modules(&a)','module_key=ANY($3::text[])'])assert.ok(routes.includes(s),s);
 assert.match(evidence,/ensure_module\(&a,&row\.get::<String,_>\("module_key"\),false\)/);
 for(const s of ['"hr" =>','"finance" =>','"digital" =>','"holding" =>','group_admin'])assert.ok(policy.includes(s),s);
});
test('RC17 role-admin cannot approve business workflow and revocation is authenticated',()=>{
 const workflow=get('backend-rust/src/workflow.rs');
 assert.match(workflow,/if !r\.roles\.contains/);
 assert.match(security,/if a\.role!="group_admin"/);
 assert.match(security,/auth::require_auth/);
 assert.match(security,/security_events/);
});
test('New RC16 and RC17 pilots are identical across both repos, no browser token persistence',()=>{
 for(const v of [16,17]){
   const a=`public/rc${v}/`,b=`../bluelinecapitale/public/erp/rc${v}/`;
   for(const f of ['index.html','pilot.js','pilot.css'])assert.equal(get(a+f),get(b+f),`Mirror mismatch: rc${v}/${f}`);
   const html=get(a+'index.html'),js=get(a+'pilot.js');
   assert.match(html,/NOT PRODUCTION CERTIFIED/);assert.match(html,/No server response yet/);
   assert.match(js,/credentials:'omit'/);assert.match(js,/Authorization/);
   assert.doesNotMatch(js,/localStorage|sessionStorage/);
   const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 }
});
test('RC16 and RC17 Rust integration tests explicitly require disposal PG and relevant isolation',()=>{
 const a=get('backend-rust/tests/pg_rc16_hr.rs'),b=get('backend-rust/tests/pg_rc17_security.rs');
 for(const test of [a,b]){assert.match(test,/TEST_DATABASE_URL/);assert.match(test,/contains\("prod"\)/);assert.match(test,/assert_eq!\(version,12\)/)}
 assert.match(a,/foreign_manager/);assert.match(a,/payroll_verify/);
 assert.match(b,/UPDATE entity_memberships SET role/);assert.match(b,/auth::require_auth/);
});
