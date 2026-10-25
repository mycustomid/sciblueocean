import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p))});server.on('error',reject)});
async function start(extra={}) {
 const p=await port();const env={...process.env,HOST:'127.0.0.1',PORT:String(p),...extra};
 for(const k of ['ERP_MODE','ERP_ENABLE_LOCAL_WRITES','ERP_ADMIN_TOKEN','VERCEL','ERP_LOCAL_DB_PATH']) if(!(k in extra)) delete env[k];
 const child=spawn(process.execPath,['server.js'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});let err='';child.stderr.on('data',d=>err+=d);
 const base=`http://127.0.0.1:${p}`;
 for(let i=0;i<70;i++) {
  if(child.exitCode!==null) throw new Error(`Server exited: ${err}`);
  try{const r=await fetch(base+'/api/health');if(r.ok)return {base,child}}catch{}
  await new Promise(r=>setTimeout(r,40));
 }
 child.kill('SIGTERM');throw new Error('Server timeout: '+err);
}
const req=(base,url,method='GET',body,token)=>fetch(base+url,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});

test('Public APIs expose only the demo catalog, cannot mutate or disclose records', async()=>{
 const {base,child}=await start();try{
  const health=await (await req(base,'/api/health')).json();assert.equal(health.productionReady,false);assert.equal(health.mode,'DEMO_READ_ONLY');
  const mods=await (await req(base,'/api/modules')).json();assert.equal(mods.modules.length,9);assert.equal(mods.modules[0].records,undefined);
  const denyGet=await req(base,'/api/records');assert.equal(denyGet.status,403);
  const denyPost=await req(base,'/api/records','POST',{moduleId:'holding',party:'Example Customer',desc:'New item',amount:100});assert.equal(denyPost.status,503);
  const denyWorkflow=await req(base,'/api/workflow','POST',{recordId:'HLD-2601',targetStep:4});assert.equal(denyWorkflow.status,503);
  const unknown=await req(base,'/api/internal');assert.equal(unknown.status,404);
  const traversal=await req(base,'/%2e%2e/%2e%2e/data/db.js');assert.notEqual(traversal.status,200);
 }finally{child.kill('SIGTERM')}
});

test('Local-demo protected writes validate records, sequential steps and durable files', async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'blcg-rc5-'));const key='test-only-strong-and-random-operator-token';
 const env={ERP_MODE:'local-demo',ERP_ENABLE_LOCAL_WRITES:'1',ERP_ADMIN_TOKEN:key,ERP_LOCAL_DB_PATH:path.join(dir,'records.json')};
 const {base,child}=await start(env);
 try{
  const unauthorized=await req(base,'/api/records','POST',{moduleId:'holding',desc:'test document',party:'Demo party',amount:1200});assert.equal(unauthorized.status,401);
  const invalid=await req(base,'/api/records','POST',{moduleId:'holding',party:'Demo party',desc:'test document',amount:1200,step:4},key);assert.equal(invalid.status,400);
  const invalidMod=await req(base,'/api/records','POST',{moduleId:'notreal',party:'Demo party',desc:'test document',amount:1200},key);assert.equal(invalidMod.status,400);
  const saved=await req(base,'/api/records','POST',{moduleId:'holding',party:'Demo partner',desc:'Valid test item',amount:1200},key);
  assert.equal(saved.status,201);const rec=(await saved.json()).record;assert.equal(rec.step,1);assert.equal(rec.status,'pending');assert.equal(rec.amount,1200);
  const notAllowed=await req(base,'/api/workflow','POST',{recordId:rec.id,targetStep:4},key);assert.equal(notAllowed.status,409);
  for(const step of [2,3,4]){
   const change=await req(base,'/api/workflow','POST',{recordId:rec.id,targetStep:step,note:'Operator reviewed sample'},key);
   assert.equal(change.status,200);assert.equal((await change.json()).record.step,step);
  }
  const repeat=await req(base,'/api/workflow','POST',{recordId:rec.id,targetStep:4},key);assert.equal(repeat.status,409);
  assert.equal((await req(base,'/api/records')).status,403);
  const result=await (await req(base,'/api/records','GET',null,key)).json();assert.ok(result.records.some(r=>r.id===rec.id&&r.status==='approved'));
  assert.ok(fs.existsSync(env.ERP_LOCAL_DB_PATH));assert.equal(fs.existsSync(env.ERP_LOCAL_DB_PATH+'.tmp'),false);
 }finally{child.kill('SIGTERM');fs.rmSync(dir,{recursive:true,force:true})}
});
