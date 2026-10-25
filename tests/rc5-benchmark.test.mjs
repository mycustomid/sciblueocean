import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
function fixture(raw){
 const store=new Map(raw?Object.entries(raw):[]);
 const listeners={};const win={confirm:()=>false,render:()=>{}};
 const context={window:win,document:{documentElement:{lang:'en'},addEventListener:(n,fn)=>listeners[n]=fn},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},URL,Blob,Date,Intl,Number,JSON,Math,console};
 vm.runInNewContext(fs.readFileSync(path.join(base,'rc5-benchmark.js'),'utf8'),context);
 return {win,store,listeners};
}
test('Comparison starts without fake verdicts: all 9 modules and 6 criteria exist',()=>{
 const {win}=fixture();const html=win.renderERPReadinessBenchmark();
 assert.equal(win.RC5_BENCHMARK_TEST.modules.length,9);
 assert.equal(win.RC5_BENCHMARK_TEST.criteria.length,6);
 assert.equal(win.RC5_BENCHMARK_TEST.criteria.reduce((a,x)=>a+x.weight,0),100);
 assert.equal((html.match(/data-rc5-action="select"/g)||[]).length,9);
 assert.equal((html.match(/data-rc5-field="score"/g)||[]).length,12);
 assert.equal((html.match(/class="rc5-score-number"/g)||[]).length,0);
 assert.ok(html.includes('No evidence'));
});
test('Scores require score AND written evidence; malicious system name escaped',()=>{
 const sample={selected:'property',leftName:'<script>alert(1)</script>',rightName:'Client ERP',ratings:{'property:coverage:left':{score:5,evidence:'verified reproduction steps'},'property:workflow:left':{score:5,evidence:''},'property:security:right':{score:0,evidence:'Security review produced a failing request'}}};
 const {win}=fixture({'blue-line-evidence-benchmark-rc5':JSON.stringify(sample)});
 const stats=win.RC5_BENCHMARK_TEST.stats;
 assert.equal(stats('property','left').value,100);
 assert.equal(stats('property','left').coverage,20);
 assert.equal(stats('property','right').value,0);
 assert.equal(stats('property','right').coverage,20);
 const html=win.renderERPReadinessBenchmark();
 assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
 assert.ok(!html.includes('<script>alert(1)</script>'));
});
