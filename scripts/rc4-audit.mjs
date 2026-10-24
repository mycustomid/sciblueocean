import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const root=process.cwd();const isSCI=fs.existsSync(path.join(root,'public/app.js'));
let checks=[];const check=(name,fn)=>{try{fn();checks.push({name,status:'PASS'});}catch(error){checks.push({name,status:'FAIL',detail:String(error.message).slice(0,300)});}};
const read=p=>fs.readFileSync(path.join(root,p),'utf8');const exists=p=>fs.existsSync(path.join(root,p));
const slugs=['blue-line-capital-group','blue-line-exchange','blue-line-property-management','blue-line-construction','blue-line-sugar-manufacturing','blue-line-import-assembly-trade','group-finance-accounting','hr-payroll','digital-transformation-ai'];
check('Nine individual sector illustrations exist',()=>{for(const slug of slugs) assert.ok(exists(isSCI?`public/editorial/${slug}.svg`:`public/assets/editorial/${slug}.svg`),slug);});
check('ESM JavaScript syntax checks',()=>{let files=isSCI?['public/app.js','public/rc4-workspace.js']:['public/erp/app.js','public/erp/rc4-workspace.js','public/assets/site.js'];for(const p of files) execFileSync(process.execPath,['--check',path.join(root,p)],{stdio:'pipe'});});
check('ERP entrypoint includes both RC4 assets',()=>{let entry=read(isSCI?'src/pages/index.astro':'public/erp/index.html');assert.ok(entry.includes('rc4-design.css')&&entry.includes('rc4-workspace.js'));});
check('Demo disclosure present',()=>{let js=read(isSCI?'public/app.js':'public/erp/app.js');assert.match(js,/DEMO MODE|MODE DÉMONSTRATION/);assert.match(js,/localStorage/);});
check('Operating workflow includes 9 product IDs',()=>{let js=read(isSCI?'public/app.js':'public/erp/app.js');for(const id of ['holding','blex','property','construction','sugar','trade','finance','hr','digital']) assert.ok(js.includes(`id: '${id}'`),id);});
if(!isSCI){
check('Corporate global editorial layer linked',()=>assert.ok(read('src/layouts/SiteLayout.astro').includes('enterprise-refinement.css')));
check('All 18 business pages receive route-specific enhancements',()=>{let layout=read('src/layouts/SiteLayout.astro');let comp=read('src/components/DivisionProof.astro');assert.ok(layout.includes('sectorSlug')&&layout.includes('DivisionProof'));for(const slug of slugs)assert.ok(comp.includes(`"slug": "${slug}"`),slug);});
check('Five bilingual corporate interior routes receive content',()=>{let s=read('src/components/EditorialJourney.astro');for(const page of ['about','approach','careers','contact','businesses']) assert.ok(s.includes(`${page}:{`)||s.includes(`${page}: {`),page);});
check('ERP is linked from global header',()=>{let t=read('src/components/SiteHeader.astro');assert.ok(t.includes('/erp/?gate=1'));});
}
for(const c of checks) console.log(`${c.status.padEnd(4)} ${c.name}${c.detail?' — '+c.detail:''}`);
let errors=checks.filter(x=>x.status==='FAIL');console.log(`RESULT ${checks.length-errors.length}/${checks.length}`);if(errors.length)process.exitCode=1;
