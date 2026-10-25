(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let base = '', token = '', entityId = '', role = '';
  const modules = ['holding','blex','property','construction','sugar','trade','finance','hr','digital'];
  const state = (label, ok=false) => { $('apiState').textContent=label; $('apiState').classList.toggle('online',ok); };
  const inspect = (action,data) => { $('result').textContent = `${new Date().toISOString()} · ${action}\n${JSON.stringify(data,null,2)}`; };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const apiUrl = (path) => `${base}${path}`;
  const money = (value) => new Intl.NumberFormat('fr-FR').format(Number(value)||0);
  async function request(path, method='GET', body=null, extra={}) {
    if (!base) throw new Error('Set API base URL and probe first.');
    const opts = { method, headers: { ...extra } };
    if (body!==null) {opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(body);}
    if (token) opts.headers.Authorization=`Bearer ${token}`;
    opts.signal=AbortSignal.timeout(15000);
    const response = await fetch(apiUrl(path), opts);
    const data = await response.json().catch(()=>({error:'INVALID_JSON_RESPONSE'}));
    if (!response.ok) {
      if (response.status===401 && path!=='/api/v1/login') {
        token='';role='';entityId='';state('SESSION EXPIRED');$('sessionState').textContent='Sign in again';
      }
      throw new Error(`${response.status} · ${data.error||'ERROR'} · ${data.message||'Request rejected'}`);
    }
    return data;
  }
  function fromForm(form){return Object.fromEntries(new FormData(form));}
  function setupBase(input){
    const candidate=new URL(input.trim());
    if(!['https:','http:'].includes(candidate.protocol) || candidate.username || candidate.password || candidate.search || candidate.hash || candidate.pathname!=='/') throw new Error('Use a clean API origin, e.g. http://127.0.0.1:8085');
    if(candidate.protocol==='http:' && !['localhost','127.0.0.1','[::1]'].includes(candidate.hostname)) throw new Error('Plain HTTP is limited to local development.');
    base=candidate.origin;
  }
  async function probe(){
    try {setupBase($('connectForm').elements.apiBase.value); const result=await request('/health');inspect('GET /health',result);state('RUST API REACHABLE',true);}catch(err){inspect('Health probe failed',{message:err.message});state('API UNAVAILABLE');}
  }
  async function refresh(){
    const [mods,recs,journals,entity,overview]=await Promise.all([request('/api/v1/modules'),request('/api/v1/records'),request('/api/v1/journals').catch(e=>({items:[],error:e.message})),request('/api/v1/entity'),request('/api/v1/overview')]);
    $('entityState').textContent=`${entity.legal_name} · ${entity.id} · ${entity.role}`;
    renderOverview(overview);
    $('domains').innerHTML=mods.modules.map((m,i)=>`<div class="domain"><small>${String(i+1).padStart(2,'0')} / 09</small><strong>${esc(m.name)}</strong><span>${esc(m.domain_category)} · ${esc(m.rollout_status)}</span></div>`).join('');
    $('moduleSelect').innerHTML=mods.modules.map(m=>`<option value="${esc(m.module_key)}">${esc(m.name)}</option>`).join('');
    $('recordsBody').innerHTML= recs.items.length ? recs.items.map(r=>`<tr><td>${esc(r.id.slice(0,8))}</td><td>${esc(r.module_key)}</td><td>${money(r.amount_xaf)}</td><td><span class="status-pill">${esc(r.status)}</span></td><td class="row-actions"><button type="button" class="action-btn" data-rec-detail="${esc(r.id)}">Evidence</button>${allowedAction(r.status,role)?`<button type="button" class="action-btn" data-rec="${esc(r.id)}" data-transition="${esc(allowedAction(r.status,role))}">${esc(allowedAction(r.status,role))}</button>`:''}</td></tr>`).join(''):'<tr><td colspan="5">No records</td></tr>';
    $('journalsBody').innerHTML= journals.items?.length?journals.items.map(j=>`<tr><td>${esc(j.period_key)}</td><td>${esc(j.memo)}</td><td>${esc(j.status)}</td><td class="row-actions"><button type="button" class="action-btn" data-journal-detail="${esc(j.id)}">Evidence</button>${j.status==='draft'&&['finance','executive'].includes(role)?`<button type="button" class="action-btn" data-journal="${esc(j.id)}">Post</button>`:''}</td></tr>`).join(''):'<tr><td colspan="4">No journals or access restricted</td></tr>';
  }
  const nextAction = (status) => ({draft:'submit',submitted:'approve_manager',manager_approved:'approve_finance',finance_approved:'approve_final'})[status]||'';
  const allowedAction=(status,userRole)=>{
    const action=nextAction(status);
    const roles={submit:['operator','manager','finance','executive'],approve_manager:['manager','executive'],approve_finance:['finance','auditor'],approve_final:['executive']};
    return action && roles[action]?.includes(userRole) ? action : '';
  };
  function renderOverview(data){
    const groups=Array.isArray(data.domain_status_counts)?data.domain_status_counts:[];
    const total=groups.reduce((sum,item)=>sum+Number(item.count||0),0);
    const approved=groups.filter(i=>i.status==='approved').reduce((sum,item)=>sum+Number(item.count||0),0);
    const cards=[['Domain records',total],['Approved dossiers',approved],['Posted GL journals',data.journals?.posted??0],['Draft GL journals',data.journals?.draft??0]];
    $('overviewCards').innerHTML=cards.map(([label,value])=>`<div class="domain"><small>VERIFIED · ENTITY SCOPE</small><strong>${esc(String(value))}</strong><span>${esc(label)}</span></div>`).join('');
  }
  $('probeBtn').addEventListener('click',probe);
  $('connectForm').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget;const data=fromForm(form);
    try{setupBase(data.apiBase); const creds=await request('/api/v1/login','POST',{email:data.email,password:data.password,entity_id:data.entityId}); token=creds.access_token;entityId=creds.entity_id;role=creds.role;form.elements.password.value='';state('AUTHENTICATED',true);$('sessionState').textContent=`Role · ${role}`;inspect('POST /api/v1/login',{role,entity_id:entityId,access_token:'[REDACTED]'});await refresh();}catch(err){token='';inspect('Login failed',{message:err.message});state('LOGIN FAILED');}
  });
  $('logoutBtn').addEventListener('click',async()=>{try{if(token)await request('/api/v1/logout','POST')}catch{}token='';entityId='';role='';state('SESSION REVOKED');$('sessionState').textContent='Not authenticated';$('entityState').textContent='Log in to a demo legal entity.';$('domains').innerHTML='<div class="placeholder">Authenticate to load the nine ERP domains.</div>';$('overviewCards').innerHTML='<div class="placeholder">Log in to inspect metrics.</div>';$('recordsBody').innerHTML='<tr><td colspan="5">Not authenticated</td></tr>';$('journalsBody').innerHTML='<tr><td colspan="4">Not authenticated</td></tr>';inspect('Logout',{status:'token_removed_from_memory'});});
  $('recordForm').addEventListener('submit',async e=>{
    e.preventDefault(); const form=e.currentTarget;
    // Preserve this key across retry after a timeout: server may have committed already.
    const key=form.dataset.pendingKey||(form.dataset.pendingKey=crypto.randomUUID());
    try{
      const d=fromForm(form);
      const payload={module_key:d.module_key,counterparty:d.counterparty,description:d.description,amount_xaf:Number(d.amount_xaf)};
      const data=await request('/api/v1/records','POST',payload,{'Idempotency-Key':key});
      delete form.dataset.pendingKey;
      inspect('Record persisted by PostgreSQL',data);await refresh();
    }catch(err){inspect('Record not confirmed; retry preserves idempotency key',{message:err.message});}
  });
  $('journalForm').addEventListener('submit',async e=>{e.preventDefault();try{const d=fromForm(e.currentTarget),amount=Number(d.amount_xaf);const data=await request('/api/v1/journals','POST',{period_key:d.period_key,memo:d.memo,source_record_id:null,lines:[{account_code:d.debit_account,debit_xaf:amount,credit_xaf:0},{account_code:d.credit_account,debit_xaf:0,credit_xaf:amount}]});inspect('Journal draft created',data);await refresh();}catch(err){inspect('Journal rejected',{message:err.message});}});
  $('recordsBody').addEventListener('click',async e=>{const b=e.target.closest('[data-rec]');if(!b)return;try{const data=await request(`/api/v1/records/${encodeURIComponent(b.dataset.rec)}/transition`,'POST',{action:b.dataset.transition,note:'Approved during controlled RC7 pilot'});inspect('Workflow transition',data);await refresh();}catch(err){inspect('Approval rejected',{message:err.message});}});
  $('journalsBody').addEventListener('click',async e=>{const b=e.target.closest('[data-journal]');if(!b)return;try{const data=await request(`/api/v1/journals/${encodeURIComponent(b.dataset.journal)}/post`,'POST');inspect('Journal posted',data);await refresh();}catch(err){inspect('Journal posting rejected',{message:err.message});}});
  $('recordsBody').addEventListener('click',async e=>{
    const b=e.target.closest('[data-rec-detail]');if(!b)return;
    try{const data=await request(`/api/v1/records/${encodeURIComponent(b.dataset.recDetail)}`);inspect('Record + workflow evidence',data);$('result').scrollIntoView({block:'nearest',behavior:'smooth'});}catch(err){inspect('Evidence unavailable',{error:err.message});}
  });
  $('journalsBody').addEventListener('click',async e=>{
    const b=e.target.closest('[data-journal-detail]');if(!b)return;
    try{const data=await request(`/api/v1/journals/${encodeURIComponent(b.dataset.journalDetail)}`);inspect('Journal + debit-credit evidence',data);$('result').scrollIntoView({block:'nearest',behavior:'smooth'});}catch(err){inspect('Journal evidence unavailable',{error:err.message});}
  });
  $('refreshOverview').addEventListener('click',async()=>{try{const data=await request('/api/v1/overview');renderOverview(data);inspect('Verified entity overview',data);}catch(e){inspect('Overview unavailable',{error:e.message})}});
  $('showAudit').addEventListener('click',async()=>{try{const data=await request('/api/v1/audit-events');inspect('Recent append-only audit events',data);$('result').scrollIntoView({block:'nearest',behavior:'smooth'});}catch(e){inspect('Audit feed restricted',{error:e.message})}});
  $('refreshRecords').addEventListener('click',async()=>{try{await refresh();inspect('Records refreshed',{status:'loaded'});}catch(e){inspect('Refresh failed',{message:e.message})}});
  $('refreshJournals').addEventListener('click',async()=>{try{await refresh();inspect('Journals refreshed',{status:'loaded'});}catch(e){inspect('Refresh failed',{message:e.message})}});
  $('clearConsole').addEventListener('click',()=>inspect('Console cleared',{}));
  // No fake API status; live calls happen only after direct user action.
})();
