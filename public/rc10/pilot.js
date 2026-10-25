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
    await loadTrade();
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

  // RC8 trading cockpit — reuses the in-memory session from the RC7 pilot.
  // The UI never reports a mutation as completed before an HTTP 2xx response.
  const tradeMoney=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0}).format(Number(v)||0);
  let tradeCatalog={items:[],warehouses:[],balances:[],posting_accounts:[]};
  let tradePurchase=[],tradeSale=[];
  const actionStatus=(id,type,status)=>{
    if(status==='draft'&&['manager','executive'].includes(role))return `<button type="button" class="action-btn" data-trade-id="${esc(id)}" data-trade-type="${type}" data-trade-op="approve">Approve</button>`;
    if(status==='approved'&&['operator','manager'].includes(role))return `<button type="button" class="action-btn" data-trade-id="${esc(id)}" data-trade-type="${type}" data-trade-op="${type==='purchase'?'receive':'ship'}">${type==='purchase'?'Receive':'Ship'}</button>`;
    return '<span class="hint">—</span>';
  };
  function fillTrade(){
    const c=tradeCatalog;
    const whOptions=['<option value="">Choose warehouse</option>',...c.warehouses.map(w=>`<option value="${esc(w.id)}">${esc(w.code)} · ${esc(w.label)}</option>`)].join('');
    const itemOptions=['<option value="">Choose item</option>',...c.items.map(x=>`<option value="${esc(x.id)}">${esc(x.sku)} · ${esc(x.label)}</option>`)].join('');
    document.querySelectorAll('.tradeWarehouse').forEach(el=>{const selected=el.value;el.innerHTML=whOptions;if(c.warehouses.some(w=>w.id===selected))el.value=selected});
    document.querySelectorAll('.tradeItem').forEach(el=>{const selected=el.value;el.innerHTML=itemOptions;if(c.items.some(w=>w.id===selected))el.value=selected});
    const sku=id=>c.items.find(x=>x.id===id)?.sku||id.slice(0,8);
    const warehouse=id=>c.warehouses.find(x=>x.id===id)?.code||id.slice(0,8);
    $('tradeBalances').innerHTML=c.balances.length?c.balances.map(b=>`<tr><td>${esc(warehouse(b.warehouse_id))}</td><td>${esc(sku(b.item_id))}</td><td>${tradeMoney(b.quantity)}</td><td>${tradeMoney(b.value_xaf)}</td></tr>`).join(''):'<tr><td colspan="4">No stock movements recorded yet.</td></tr>';
    const totalQty=c.balances.reduce((sum,b)=>sum+Number(b.quantity||0),0);
    $('tradeSummary').textContent=`${c.items.length} SKU · ${c.warehouses.length} warehouses · ${tradeMoney(totalQty)} units`;
    const required=['inventory','accounts_payable','accounts_receivable','sales_revenue','cost_of_goods_sold'];
    const mapped=new Map(c.posting_accounts.map(x=>[x.role,x.code]));
    $('tradeMapping').innerHTML=required.map(k=>`<span>${esc(k)}: ${esc(mapped.get(k)||'NOT MAPPED')}</span>`).join('');
    $('tradeJournalStatus').textContent=mapped.size===5?'Five demo mapping roles available. Posting still needs finance review.':'Configure all five entity GL posting roles using the demo CLI.';
    const orderRows=(orders,type)=>orders.length?orders.map(o=>`<tr><td title="${esc(o.id)}">${esc(o.counterparty)}</td><td>${tradeMoney(o.total_xaf)}</td><td>${esc(o.status)}</td><td>${actionStatus(o.id,type,o.status)}</td></tr>`).join(''):'<tr><td colspan="4">No orders in selected legal entity.</td></tr>';
    $('purchasesBody').innerHTML=orderRows(tradePurchase,'purchase');
    $('salesBody').innerHTML=orderRows(tradeSale,'sale');
  }
  async function loadTrade(){
    if(!token)return;
    const [c,p,s]=await Promise.all([request('/api/v1/trade/catalog'),request('/api/v1/purchasing/orders'),request('/api/v1/sales/orders')]);
    tradeCatalog=c;tradePurchase=p.items||[];tradeSale=s.items||[];
    fillTrade();
  }
  $('refreshTrade').addEventListener('click',async()=>{try{await loadTrade();inspect('RC8 trade position refreshed',{entity_id:entityId,items:tradeCatalog.items.length,purchases:tradePurchase.length,sales:tradeSale.length})}catch(e){inspect('Trade refresh failed',{error:e.message})}});
  $('showMovements').addEventListener('click',async()=>{try{inspect('PostgreSQL stock movements',await request('/api/v1/trade/movements'));$('result').scrollIntoView({block:'nearest',behavior:'smooth'})}catch(e){inspect('Movement query failed',{error:e.message})}});
  for(const [id,endpoint] of [['itemForm','/api/v1/trade/catalog/items'],['warehouseForm','/api/v1/trade/catalog/warehouses']]){
    $(id).addEventListener('submit',async e=>{e.preventDefault();try{const data=Object.fromEntries(new FormData(e.currentTarget));const r=await request(endpoint,'POST',data);inspect('RC8 master data created',r);e.currentTarget.reset();await loadTrade()}catch(err){inspect('Master data rejected',{error:err.message})}});
  }
  for(const [id,endpoint] of [['buyForm','/api/v1/purchasing/orders'],['saleForm','/api/v1/sales/orders']]){
    $(id).addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget;
      const d=Object.fromEntries(new FormData(form));
      const payload={counterparty:d.counterparty,warehouse_id:d.warehouse_id,lines:[{item_id:d.item_id,quantity:Number(d.quantity),unit_amount_xaf:Number(d.unit_amount_xaf)}]};
      const signature=JSON.stringify(payload);
      // Same payload after ambiguous timeout => reuse key; edited payload => new key.
      if(form.dataset.pendingPayload!==signature){form.dataset.pendingKey=crypto.randomUUID();form.dataset.pendingPayload=signature;}
      const key=form.dataset.pendingKey||(form.dataset.pendingKey=crypto.randomUUID());
      try{const result=await request(endpoint,'POST',payload,{'Idempotency-Key':key});delete form.dataset.pendingKey;delete form.dataset.pendingPayload;inspect('RC8 order persisted in PostgreSQL',result);await loadTrade()}
      catch(err){inspect('Order unconfirmed: retry reuses same idempotency key',{error:err.message})}
    });
  }
  for(const tbodyId of ['purchasesBody','salesBody']){
    $(tbodyId).addEventListener('click',async e=>{
      const button=e.target.closest('[data-trade-op]');if(!button)return;
      const {tradeId:id,tradeType:type,tradeOp:op}=button.dataset;
      const resource=type==='purchase'?'purchasing':'sales';
      const action=op==='approve'?'approve':op==='receive'?'receive':'ship';
      const prefix=`/api/v1/${resource}/orders/${encodeURIComponent(id)}`;
      let period=null;
      if(action!=='approve'){
        period=window.prompt('Open accounting period YYYY-MM for a draft journal (example 2026-10):');
        if(period===null)return;
        if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)){inspect('Action canceled',{error:'Enter YYYY-MM, e.g. 2026-10'});return;}
      }
      button.disabled=true;
      try{const r=await request(`${prefix}/${action}`,'POST',period?{period_key:period}:null);inspect('RC8 server-confirmed transaction',r);await loadTrade();await refresh()}
      catch(err){inspect('RC8 server rejected operation',{error:err.message});button.disabled=false}
    });
  }

  // RC9: distinct, idempotent partial events. Never change browser stock optimistically.
  const partialCfg = {
    buy:{order:'partialBuyOrder',item:'partialBuyItem',form:'partialPurchaseForm',resource:'purchasing',action:'receive-partial'},
    sale:{order:'partialSaleOrder',item:'partialSaleItem',form:'partialSaleForm',resource:'sales',action:'ship-partial'}
  };
  const partialOut=(label,obj)=>{$('partialEvidence').textContent=label+'\n'+JSON.stringify(obj,null,2);};
  async function loadPartialOrders(){
    const [p,s]=await Promise.all([request('/api/v1/purchasing/orders'),request('/api/v1/sales/orders')]);
    for(const [kind,orders] of [['buy',p.items||[]],['sale',s.items||[]]]){
      const cfg=partialCfg[kind],sel=$(cfg.order),old=sel.value;
      const allowed=kind==='buy'?['approved','partially_received']:['approved','partially_shipped'];
      const available=orders.filter(o=>allowed.includes(o.status));
      sel.innerHTML='<option value="">Select an open order</option>'+available.map(o=>`<option value="${esc(o.id)}">${esc(o.counterparty)} · ${esc(o.status)} · ${esc(o.id.slice(0,8))}</option>`).join('');
      if(available.some(o=>o.id===old))sel.value=old;
      if(sel.value)await loadPartialLines(kind);
    }
    partialOut('RC9 open orders loaded',{purchases:p.items?.length||0,sales:s.items?.length||0});
  }
  async function loadPartialLines(kind){
    const cfg=partialCfg[kind],orderId=$(cfg.order).value;
    const sel=$(cfg.item);
    sel.innerHTML='<option value="">Select an unfulfilled item</option>';
    if(!orderId)return;
    const data=await request(`/api/v1/${cfg.resource}/orders/${encodeURIComponent(orderId)}/lines`);
    const remain=(data.lines||[]).filter(l=>l.backorder>0);
    sel.innerHTML+=[...remain].map(l=>{
      const product=tradeCatalog.items.find(it=>it.id===l.item_id);
      const label=product?`${product.sku} · ${product.label}`:l.item_id.slice(0,8);
      return `<option value="${esc(l.item_id)}" data-max="${Number(l.backorder)}">${esc(label)} · ${Number(l.backorder)} remaining</option>`;
    }).join('');
    partialOut('Server-confirmed quantity remaining',{order_id:orderId,items:data.lines});
  }
  $('refreshPartial').addEventListener('click',async()=>{try{await loadPartialOrders()}catch(e){partialOut('Cannot load orders',{error:e.message})}});
  $('showFulfilments').addEventListener('click',async()=>{try{partialOut('Immutable fulfilment history',await request('/api/v1/trade/fulfilments'))}catch(e){partialOut('History unavailable',{error:e.message})}});
  for(const kind of ['buy','sale']){
    const cfg=partialCfg[kind];
    $(cfg.order).addEventListener('change',async()=>{try{await loadPartialLines(kind)}catch(e){partialOut('Order lines unavailable',{error:e.message})}});
    $(cfg.form).addEventListener('submit',async ev=>{
      ev.preventDefault();const form=ev.currentTarget;
      const d=Object.fromEntries(new FormData(form));
      const selected=$(cfg.item).selectedOptions[0];
      const max=Number(selected?.dataset.max||0);
      const quantity=Number(d.quantity);
      if(!Number.isSafeInteger(quantity)||quantity<1||quantity>max){partialOut('Invalid quantity',{requested:quantity,remaining:max});return}
      const payload={period_key:d.period_key,lines:[{item_id:d.item_id,quantity}]};
      const signature=JSON.stringify({order_id:d.order_id,...payload});
      if(form.dataset.pendingPayload!==signature){form.dataset.pendingPayload=signature;form.dataset.pendingKey=crypto.randomUUID()}
      const key=form.dataset.pendingKey;
      const btn=form.querySelector('button[type=submit]');btn.disabled=true;
      try{
        const data=await request(`/api/v1/${cfg.resource}/orders/${encodeURIComponent(d.order_id)}/${cfg.action}`,'POST',payload,{'Idempotency-Key':key});
        delete form.dataset.pendingKey;delete form.dataset.pendingPayload;
        partialOut('PostgreSQL transaction committed / journal remains a draft',data);
        await loadTrade();await loadPartialOrders();await refresh();
      }catch(e){partialOut('NOT CONFIRMED. Retry identical request with the same idempotency key.',{error:e.message})}
      finally{btn.disabled=false}
    });
  }

  // RC10 auditable return workstation. Shared in-memory bearer session from this closure.
  const r10Out=(title,data)=>{$('rc10Evidence').textContent=title+'\n'+JSON.stringify(data,null,2);};
  async function loadReturns(){
    const data=await request('/api/v1/trade/returns');
    $('rc10ReturnsBody').innerHTML=(data.items||[]).length?(data.items||[]).map(r=>`<tr><td>${esc(String(r.id).slice(0,8))}</td><td>${esc(r.kind)}</td><td>${money(r.commercial_xaf)}</td><td>${money(r.inventory_value_xaf)}</td><td>${esc(String(r.journal_draft_id).slice(0,8))}</td></tr>`).join(''):'<tr><td colspan="5">No returns in current legal entity</td></tr>';
    r10Out('Server-confirmed returns',data);
  }
  async function loadOrigins(){
    const data=await request('/api/v1/trade/fulfilments');
    const events=(data.items||[]).filter(e=>['purchase_receipt','sales_shipment'].includes(e.kind));
    const sel=$('rc10Fulfilment');const prev=sel.value;
    sel.innerHTML='<option value="">Choose origin event</option>'+events.map(e=>`<option value="${esc(e.id||e.event_id)}">${esc(e.kind)} · ${esc(String(e.id||e.event_id).slice(0,8))}</option>`).join('');
    if(events.some(e=>(e.id||e.event_id)===prev))sel.value=prev;
    r10Out('Original fulfilment events',data);
    if(sel.value)await loadReturnable();
  }
  async function loadReturnable(){
    const origin=$('rc10Fulfilment').value;
    $('rc10Item').innerHTML='<option value="">Choose item</option>';
    if(!origin)return;
    const data=await request(`/api/v1/trade/fulfilments/${encodeURIComponent(origin)}/returnable`);
    const available=(data.lines||[]).filter(l=>l.returnable_qty>0);
    $('rc10Item').innerHTML+=[...available].map(l=>`<option value="${esc(l.item_id)}" data-max="${Number(l.returnable_qty)}">${esc(l.item_id.slice(0,8))} · ${l.returnable_qty} available</option>`).join('');
    r10Out('Returnable origin facts',data);
  }
  $('rc10LoadEvents').addEventListener('click',async()=>{try{await loadOrigins()}catch(e){r10Out('Origin load failed',{error:e.message})}});
  $('rc10LoadReturns').addEventListener('click',async()=>{try{await loadReturns()}catch(e){r10Out('Returns unavailable',{error:e.message})}});
  $('rc10Fulfilment').addEventListener('change',async()=>{try{await loadReturnable()}catch(e){r10Out('Cannot load return quantities',{error:e.message})}});
  $('rc10ReturnForm').addEventListener('submit',async e=>{
    e.preventDefault();const form=e.currentTarget,d=Object.fromEntries(new FormData(form));
    const qty=Number(d.quantity);const max=Number($('rc10Item').selectedOptions[0]?.dataset.max||0);
    if(!Number.isSafeInteger(qty)||qty<1||qty>max){r10Out('Quantity invalid',{quantity:qty,returnable:max});return;}
    const payload={period_key:d.period_key,reason:String(d.reason).trim(),lines:[{item_id:d.item_id,quantity:qty}]};
    const signature=JSON.stringify({origin:d.fulfilment_id,...payload});
    if(form.dataset.pendingPayload!==signature){form.dataset.pendingPayload=signature;form.dataset.pendingKey=crypto.randomUUID()}
    const key=form.dataset.pendingKey;const button=form.querySelector('[type=submit]');button.disabled=true;
    try{
      const response=await request(`/api/v1/trade/fulfilments/${encodeURIComponent(d.fulfilment_id)}/return`,'POST',payload,{'Idempotency-Key':key});
      delete form.dataset.pendingPayload;delete form.dataset.pendingKey;
      r10Out('Stock updated and GL DRAFT created. No credit note or refund issued.',response);
      await loadReturnable();await loadReturns();await loadTrade();
    }catch(err){r10Out('NOT CONFIRMED. Retry same request without changing form; idempotency retained.',{error:err.message});}
    finally{button.disabled=false}
  });
  $('logoutBtn').addEventListener('click',()=>{$('rc10Fulfilment').innerHTML='<option value="">Sign in again</option>';$('rc10Item').innerHTML='<option value="">Sign in again</option>';$('rc10ReturnsBody').innerHTML='<tr><td colspan="5">Not authenticated</td></tr>';r10Out('Session closed',{});});

  $('rc10VarianceForm').addEventListener('submit',async ev=>{
    ev.preventDefault(); const form=ev.currentTarget;
    try{
      const account=String(new FormData(form).get('account_code')||'').trim();
      if(!account)throw new Error('Provide an existing GL account code');
      const data=await request('/api/v1/trade/posting-accounts','POST',{posting_role:'purchase_price_variance',account_code:account});
      r10Out('Verified company-scoped posting mapping',data); await loadTrade();
    }catch(err){r10Out('Posting mapping rejected',{error:err.message})}
  });
  // Do not keep sensitive data after logout; only demo forms remain rendered.
  $('logoutBtn').addEventListener('click',()=>{
    for(const kind of ['buy','sale']){$(partialCfg[kind].order).innerHTML='<option value="">Sign in again</option>' ;$(partialCfg[kind].item).innerHTML='<option value="">Sign in again</option>';}
    $('partialEvidence').textContent='Session closed.';
    tradeCatalog={items:[],warehouses:[],balances:[],posting_accounts:[]};tradePurchase=[];tradeSale=[];
    $('tradeBalances').innerHTML='<tr><td colspan="4">Not authenticated</td></tr>';
    $('purchasesBody').innerHTML='<tr><td colspan="4">Not authenticated</td></tr>';
    $('salesBody').innerHTML='<tr><td colspan="4">Not authenticated</td></tr>';
    $('tradeSummary').textContent='Sign in to inspect stock';$('tradeMapping').textContent='Sign in to inspect GL mapping';
  });

})();
