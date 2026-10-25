/* RC5 Blue Line ERP — evidence-based comparative evaluation workstation.
   Local only: no uploads, no fabricated ratings, no claim of production certification. */
(() => {
  'use strict';
  const STORAGE_KEY = 'blue-line-evidence-benchmark-rc5';
  const modules = [
    ['holding','Holding / CAPEX','Gouvernance du Groupe','Group governance','CAPEX → Risk → Compliance → Approval'],
    ['blex','BLEX / Change FX','Bureau de change','FX & Treasury','KYC → Quote → AML → Settlement'],
    ['property','SCI Blue Ocean','Immobilier & Hôtel','Property & Hotel','Reservation → Stay → Folio → Audit'],
    ['construction','Construction','Chantier & Contrat','Construction & EPC','BOQ → Procurement → Works → Certification'],
    ['sugar','Sugar Manufacturing','Production & Qualité','Manufacturing & Quality','Weighbridge → MRP → QC → Dispatch'],
    ['trade','Import / Assembly / Trade','Transit & Négoce','Trade & Logistics','Purchase → Customs → Receipt → Landed Cost'],
    ['finance','Finance SYSCOHADA','Comptabilité & Reporting','Accounting & Reporting','Source document → Journal → Reconciliation → Close'],
    ['hr','HR / Payroll','Ressources Humaines','People & Payroll','Employee → Attendance → Payroll → Payment'],
    ['digital','Digital / AI','Cloud & Service Management','IT & AI Operations','Incident → Triage → Change → Approval']
  ];
  const criteria = [
    {id:'coverage',weight:20,en:'Business process coverage',fr:'Couverture métier',proof:'End-to-end walkthrough, actual source documents and expected output'},
    {id:'workflow',weight:15,en:'Real operational workflow',fr:'Workflow opérationnel réel',proof:'Approvals, exceptions, rejection and segregation of duties'},
    {id:'integrity',weight:20,en:'Data integrity & accounting',fr:'Intégrité des données & comptabilité',proof:'Transactions, immutable audit entries, no double counting'},
    {id:'security',weight:20,en:'Security & authorization',fr:'Sécurité & autorisations',proof:'Authenticated role, server authorization, tenant boundaries'},
    {id:'usability',weight:15,en:'Usability & responsive design',fr:'Ergonomie & responsive',proof:'Desktop/mobile usability, keyboard, error states'},
    {id:'integration',weight:10,en:'Integration & deployability',fr:'Intégration & déploiement',proof:'API integration, documented environment, monitoring, backup/restore'}
  ];
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lang=() => document.documentElement.lang === 'en' ? 'en' : 'fr';
  const t=(fr,en)=> lang()==='fr'?fr:en;
  const getEmpty=()=>({selected:'property',leftName:'Notre prototype ERP',rightName:'ERP existant du client',ratings:{},updated:new Date().toISOString()});
  function load(){try{const obj=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(obj&&typeof obj==='object'&&obj.ratings) return {...getEmpty(),...obj};}catch{}return getEmpty()}
  let state=load();
  const save=()=>{state.updated=new Date().toISOString();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{}};
  const cell=(m,c,side)=>state.ratings[`${m}:${c}:${side}`]||{};
  const stats=(moduleId,side)=>{
    let weighted=0,total=0,known=0;
    criteria.forEach(c=>{const entry=cell(moduleId,c.id,side);if(Number.isInteger(entry.score)&&entry.score>=0&&entry.score<=5&&entry.evidence?.trim().length>=8){weighted+=c.weight*entry.score/5;total+=c.weight;known++}});
    return {value: total>0?Math.round(weighted/total*100):null,coverage:Math.round(total),known};
  };
  function download(name,text,mime){const b=new Blob([text],{type:mime}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),5000)}
  function renderScore(st){return st.value===null?`<b class="rc5-empty">${t('Aucune preuve','No evidence')}</b>`:`<b class="rc5-score-number">${st.value}/100</b><span class="rc5-coverage">${st.coverage}% ${t('critères pondérés évalués','weighted criteria evaluated')}</span>`;}
  const labels={left:t('Votre ERP / prototype','Your ERP / prototype'),right:t('ERP du client','Client ERP')};
  window.renderERPReadinessBenchmark=function(){
    const chosen=modules.find(m=>m[0]===state.selected)||modules[2];
    const left=stats(chosen[0],'left'),right=stats(chosen[0],'right');
    const lName=safe(state.leftName),rName=safe(state.rightName);
    const rows=criteria.map(c=>{
      const each=side=>{
        const v=cell(chosen[0],c.id,side);
        const name=side==='left'?lName:rName;
        return `<div class="rc5-rating-control"><label>${t('Note vérifiée','Verified score')} · ${name}
          <select class="rc5-select" data-rc5-field="score" data-module="${chosen[0]}" data-criterion="${c.id}" data-side="${side}" aria-label="${safe(c.en)} / ${side}">
          <option value="">${t('Non évalué','Not evaluated')}</option>${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${v.score===n?'selected':''}>${n} / 5 — ${[t('Échec','Fails'),t('Critique','Critical gaps'),t('Partiel','Partial'),t('Fonctionnel','Functional'),t('Solide','Strong'),t('Vérifié','Verified')][n]}</option>`).join('')}</select></label>
          <label class="rc5-proof-label">${t('Preuve observée, URL ou résultat de test','Observed evidence, URL or test result')}
          <textarea class="rc5-evidence" data-rc5-field="evidence" data-module="${chosen[0]}" data-criterion="${c.id}" data-side="${side}" rows="2" maxlength="700" placeholder="${t('Ex. Cas de test, document, capture, journal...','e.g. Test case, document, screenshot, log...')}">${safe(v.evidence||'')}</textarea></label></div>`;
      };
      return `<article class="rc5-criterion"><header><div><h4>${safe(t(c.fr,c.en))}</h4><p>${safe(c.proof)}</p></div><span>${c.weight}%</span></header><div class="rc5-compare-cells"><div>${each('left')}</div><div>${each('right')}</div></div></article>`;
    }).join('');
    const perModule=modules.map(m=>{
      const a=stats(m[0],'left'),b=stats(m[0],'right');
      const active=m[0]===chosen[0];
      return `<button type="button" class="rc5-module ${active?'is-active':''}" data-rc5-action="select" data-id="${m[0]}" aria-pressed="${active}"><span class="rc5-module-dot"></span><span class="rc5-module-name">${safe(m[1])}</span><span class="rc5-module-score">${a.value===null?'—':a.value} : ${b.value===null?'—':b.value}</span></button>`;
    }).join('');
    const evaluated=modules.reduce((sum,m)=>sum+criteria.filter(c=>['left','right'].some(s=>cell(m[0],c.id,s).evidence?.trim().length>=8&&Number.isInteger(cell(m[0],c.id,s).score))).length,0);
    return `<div class="rc5-root">
    <div class="rc5-masthead"><div><div class="rc5-overline">BLUE LINE / EVIDENCE LAB · RC5</div><h2>${t('Comparer les systèmes, pas les présentations.','Compare systems, not presentations.')}</h2><p>${t('Audit structuré des 9 domaines, sans note automatique ni résultat inventé.','Structured evaluation of 9 domains, with no automatic or invented scores.')}</p></div><div class="rc5-mast-aside"><strong>9</strong><span>${t('Domaines évaluables','Domains to evaluate')}</span></div></div>
    <div class="rc5-alert" role="note"><span aria-hidden="true">◉</span><span>${t('Mode démonstration. Les notes et preuves restent sur cet appareil et ne sont pas vérifiées par le système. Les scores ne deviennent exploitables qu’après test réel des deux solutions.','Demonstration mode. Ratings and evidence remain on this device and are not system-verified. Scores are meaningful only after actual tests of both solutions.')}</span></div>
    <div class="rc5-structure"><div class="rc5-overline">${t('Architecture cible','Target architecture')}</div><div class="rc5-structure-track"><div><strong>GROUP / HOLDING</strong><small>${t('Gouvernance / consolidation','Governance / consolidation')}</small></div><span>→</span><div><strong>5 BUSINESS DOMAINS</strong><small>FX · Hotel · EPC · Manufacturing · Trade</small></div><span>+</span><div><strong>3 SHARED SERVICES</strong><small>Finance · HR · Digital</small></div><span>↓</span><div><strong>ERP CORE</strong><small>Legal entity · RBAC · Ledger · Audit</small></div></div><p>${t('9 modules fonctionnels ne signifient pas nécessairement 9 sociétés juridiques.','Nine functional modules do not necessarily mean nine legal entities.')}</p></div>
    <div class="rc5-toolbar"><div class="rc5-names"><label>${t('Votre solution','Your solution')}<input class="rc5-name" data-rc5-name="left" maxlength="70" value="${lName}"/></label><label>${t('Solution du client','Client solution')}<input class="rc5-name" data-rc5-name="right" maxlength="70" value="${rName}"/></label></div><div class="rc5-toolbar-actions"><button class="btn btn-outline btn-small" data-rc5-action="csv" type="button">↓ CSV</button><button class="btn btn-outline btn-small" data-rc5-action="json" type="button">↓ JSON</button><button class="btn btn-outline btn-small" data-rc5-action="print" type="button">↗ Print</button><button class="btn btn-outline btn-small" data-rc5-action="reset" type="button">↺ Reset</button></div></div>
    <div class="rc5-workspace"><nav class="rc5-modules" aria-label="ERP module selection"><div class="rc5-modules-heading">${t('9 DOMAINES','9 DOMAINS')} <span>${evaluated} / 54 ${t('critères saisis','criteria entered')}</span></div>${perModule}</nav>
    <section class="rc5-detail"><div class="rc5-detail-head"><div><div class="rc5-overline">${safe(chosen[0].toUpperCase())} / MODULE AUDIT</div><h3>${safe(chosen[1])}</h3><p>${safe(t(chosen[2],chosen[3]))} · ${safe(chosen[4])}</p></div></div>
    <div class="rc5-scores"><div><span>${lName}</span>${renderScore(left)}</div><div><span>${rName}</span>${renderScore(right)}</div></div>
    <div class="rc5-warning">${t('Échelle 0–5 ; les champs non évalués et les scores sans preuve (8 caractères minimum) sont exclus. Un score élevé sur 1 seul critère ne constitue pas une validation générale.','Scale 0–5; unrated fields and scores without evidence (min. 8 characters) are excluded. A high score on one criterion is not an overall pass.')}</div>
    <div class="rc5-criteria">${rows}</div>
    <footer class="rc5-detail-foot"><strong>${t('Décision recommandée','Recommended decision')}</strong><p>${t('Attribuer la valeur commerciale uniquement aux écarts réellement démontrés par des tests reproductibles. Documenter les défauts des deux solutions avant de proposer une migration.','Attribute business value only to gaps proven by repeatable tests. Document shortcomings of both solutions before proposing a migration.')}</p></footer>
    </section></div></div>`;
  };
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-rc5-action]');if(!b)return;
    const action=b.dataset.rc5Action;
    if(action==='select'){state.selected=b.dataset.id;save();window.render?.();return}
    if(action==='reset'){if(!window.confirm(t('Effacer toutes les notes locales de comparaison ?','Erase all locally saved evaluation notes?')))return;state=getEmpty();save();window.render?.();return}
    if(action==='print'){window.print();return}
    if(action==='json'){download('blue-line-erp-comparison-evidence.json',JSON.stringify({schema:'rc5-benchmark',warning:'User-entered observations, not independently verified',modules,criteria,...state},null,2),'application/json');return}
    if(action==='csv'){
      const q=v=>{let x=String(v??'');if(/^[\s]*[=+\-@]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"'};
      const rows=[['module','criterion','weight','system','score','evidence']];
      modules.forEach(m=>criteria.forEach(c=>['left','right'].forEach(side=>{const z=cell(m[0],c.id,side);rows.push([m[1],c.en,c.weight,side==='left'?state.leftName:state.rightName,z.score??'',z.evidence||''])})));
      download('blue-line-erp-comparison.csv','\uFEFF'+rows.map(r=>r.map(q).join(',')).join('\r\n'),'text/csv;charset=utf-8');
    }
  });
  document.addEventListener('change',e=>{
    const x=e.target;if(!x.matches('[data-rc5-field]'))return;
    const key=`${x.dataset.module}:${x.dataset.criterion}:${x.dataset.side}`;
    const prev=state.ratings[key]||{};
    if(x.dataset.rc5Field==='score'){prev.score=x.value===''?null:Number(x.value)}
    else prev.evidence=x.value.slice(0,700);
    state.ratings[key]=prev;save();window.render?.();
  });
  document.addEventListener('input',e=>{
    const x=e.target;if(x.matches('[data-rc5-name]')){const side=x.dataset.rc5Name;state[side==='left'?'leftName':'rightName']=x.value.slice(0,70);save();}
    else if(x.matches('[data-rc5-field="evidence"]')){
      const key=`${x.dataset.module}:${x.dataset.criterion}:${x.dataset.side}`;
      const z=state.ratings[key]||{};z.evidence=x.value.slice(0,700);state.ratings[key]=z;save();
    }
  });
  window.RC5_BENCHMARK_TEST={modules,criteria,stats,cell};
})();
