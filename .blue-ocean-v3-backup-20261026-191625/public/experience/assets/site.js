/* Blue Ocean Collection · Guest UX. Production payment and PMS are deliberately NOT connected. */
(() => {
 'use strict';
 const API='/api/demo';
 document.addEventListener('error',e=>{if(e.target.tagName==='IMG')e.target.classList.add('photo-missing')},true);
 const $=(selector,root=document)=>root.querySelector(selector);
 const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
 const get=(name)=>new URLSearchParams(location.search).get(name)||'';
 const qs=(params)=>new URLSearchParams(params).toString();
 const text=(s)=>String(s||'');
 const escape=(s)=>text(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const xaf=(v)=>new Intl.NumberFormat('fr-CM').format(Number(v)||0)+' FCFA';
 const toDate=(s)=>s?new Date(`${s}T12:00:00`):new Date();
 const dateToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
 function nightCount(a,b){const x=new Date(a+'T12:00:00'),y=new Date(b+'T12:00:00');const n=Math.round((y-x)/864e5);if(!Number.isFinite(n)||n<1||n>180)throw Error('Sélectionnez un séjour de 1 à 180 nuits.');if(a<dateToday())throw Error("La date d'arrivée est dans le passé.");return n;}
 function field(form,name){return form?.elements?.namedItem(name)?.value?.trim()||'';}
 function notice(form,msg,ok=false){const target=$('[data-form-response]',form?.parentElement)||$('[data-form-response]');if(target){target.textContent=msg;target.classList.toggle('success',ok);}else{const t=$('#toast');if(t){t.textContent=msg;t.hidden=false;setTimeout(()=>{t.hidden=true},5500)}}}
 async function request(path,opts={}){let response;try{response=await fetch(API+path,{credentials:'same-origin',...opts,headers:{'Accept':'application/json',...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}})}catch{throw Error('Le serveur de démonstration est indisponible. Aucun enregistrement effectué.');}let data;try{data=await response.json();}catch{throw Error('Serveur de démonstration indisponible.');}if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data;}
 // Navigation, progressive mobile drawer.
 const menu=$('[data-mobile-menu]'),toggle=$('[data-mobile-toggle]');
 toggle?.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu&&!menu.hidden){menu.hidden=true;toggle?.setAttribute('aria-expanded','false');toggle?.focus();}});
 // Small but explicit bilingual toggle. All legal and long-form copy FR-first; no fake full translation.
 const navNames={stays:['Les résidences','Residences'],monthly:['Longs séjours','Monthly living'],bonapriso:['Bonapriso','Bonapriso'],story:['Notre histoire','Our story']};
 const translations={
 'Les résidences':'Residences','Longs séjours':'Monthly living','Notre histoire':'Our story','Mes réservations':'My bookings','Trouver un séjour':'Find a stay','Réservations sur demande':'Bookings on request',
 'Votre adresse à Douala, tout simplement.':'Your address in Douala, simply.','Réservation directe · Sans intermédiaire':'Book direct · No middleman','VOTRE PROCHAIN SÉJOUR':'YOUR NEXT STAY','RÉSIDENCE':'PROPERTY','ARRIVÉE':'CHECK-IN','DÉPART':'CHECK-OUT','VOYAGEURS':'GUESTS','Vérifier':'Search','Résidence Miague':'Résidence Miague',
 'Découvrir Bonapriso':'Discover Bonapriso','Tout Douala,':'All of Douala,','à votre rythme.':'at your pace.','Voir toutes les résidences':'Explore all residences','Découvrir aussi':'You may also like','Votre prochaine adresse':'Your next address','vous attend.':'awaits you.','Le sentiment':'The feeling','d’être':'of being','chez soi.':'at home.',
 'À chaque chapitre,':'Every chapter deserves','son adresse.':'a place of its own.','Le confort de se sentir':'The comfort of feeling','au bon endroit.':'right at home.','Ce qui fait la différence':'Thoughtful details','À connaître avant de réserver':'Before you book',
 'Paiement aujourd’hui':'Due today','Aucun paiement en ligne demandé à l’envoi de la demande':'No online payment at request','Studio privé':'Private studio','Parking sur place':'On-site parking','Résidence sécurisée':'Secured residence','Situation':'Location','Disponibilité':'Availability','Arrivée':'Check-in','Départ':'Check-out','Voyageurs':'Guests',
 'Vos réservations,':'Your bookings,','à portée de main.':'at your fingertips.','Trouvons votre prochain séjour.':'Find your next stay.','Un chez-soi,':'A home','pour la suite.':'for what comes next.','Notre collection':'Our collection','Choisir une adresse':'Choose a home','Vos coordonnées':'Your details',
 'CONDITIONS':'POLICIES','CONTACT':'CONTACT','DÉCOUVRIR':'EXPLORE','VOTRE SÉJOUR':'YOUR STAY','Résidences':'Residences','Locations mensuelles':'Monthly stays','Le quartier':'The neighbourhood','Disponibilités':'Availability','Questions fréquentes':'Frequently asked questions','Conditions et confidentialité':'Terms and privacy','Cameroun':'Cameroon','Écrire à l’équipe':'Contact the team','Confidentialité':'Privacy','Démonstration équipe':'Staff demo',
 'BONAPRISO · DOUALA · CAMEROUN':'BONAPRISO · DOUALA · CAMEROON','OUVERTE À LA RÉSERVATION':'OPEN FOR REQUESTS','PROJET EN COURS':'UNDER DEVELOPMENT','Voir le lieu':'View property','À PARTIR DE':'FROM','PAR NUIT':'PER NIGHT','PAR MOIS':'PER MONTH','Future résidence':'Upcoming residence',
 'Dès 40 000 FCFA / nuit':'From 40,000 FCFA / night','Choisir les dates':'Choose dates','Location mensuelle':'Monthly living','OUVERTE À LA RÉSERVATION':'OPEN FOR BOOKING REQUESTS'
 };
 const langPicker=$('[data-language-picker]');const originalTextNodes=new Map();
 const skipTags=new Set(['SCRIPT','STYLE','OPTION','TEXTAREA','TITLE','NOSCRIPT']);
 function captureTexts(){const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walk.nextNode()){if(skipTags.has(node.parentElement?.tagName))continue;const txt=node.nodeValue;const trimmed=txt.trim();if(trimmed && (translations[trimmed]||translations[trimmed.replace(/[↗]+$/,'').trim()]))originalTextNodes.set(node,txt);}}
 captureTexts();
 function applyLocale(lang){
  document.documentElement.lang=lang;
  originalTextNodes.forEach((fr,node)=>{const trimmed=fr.trim(),clean=trimmed.replace(/[↗]+$/,'').trim();const target=translations[trimmed]||translations[clean];node.nodeValue=lang==='en'&&target?fr.replace(trimmed,target+(clean!==trimmed?' ↗':'')):fr});
  $$('[data-i18n-nav]').forEach(el=>{const key=el.dataset.i18nNav;if(navNames[key])el.textContent=navNames[key][lang==='en'?1:0]});
  $('[data-language-current]')?.replaceChildren(document.createTextNode(lang.toUpperCase()));
  $$('[data-set-language]').forEach(el=>{const active=el.dataset.setLanguage===lang;el.setAttribute('aria-checked',String(active));const mark=$('.selected-mark',el);if(mark)mark.textContent=active?'✓':''});
 }
 const locale=localStorage.getItem('bo_guest_locale')==='en'?'en':'fr';applyLocale(locale);
 $$('[data-set-language]').forEach(el=>el.addEventListener('click',()=>{const lang=el.dataset.setLanguage;localStorage.setItem('bo_guest_locale',lang);applyLocale(lang);if(langPicker)langPicker.open=false}));
 document.addEventListener('click',event=>{if(langPicker?.open&&!langPicker.contains(event.target))langPicker.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&langPicker?.open){langPicker.open=false;langPicker.querySelector('summary')?.focus()}});
 // Date consistency and min dates. Native calendars work with keyboard and phone.
 $$('input[type=date]').forEach(input=>{input.min=dateToday();if(get(input.name))input.value=get(input.name);input.addEventListener('change',()=>{const f=input.form;if(!f)return;const a=f.elements.namedItem('checkin');const b=f.elements.namedItem('checkout');if(a&&b){b.min=a.value||dateToday();if(a.value&&b.value&&b.value<=a.value)b.value='';}updateQuote(f);});});
 $$('select[name=guests]').forEach(el=>{if(get('guests'))el.value=get('guests')});
 $$('select[name=property]').forEach(el=>{if(get('property'))el.value=get('property')});
 function updateQuote(form){const q=$('[data-estimate]')||$('[data-quote-result]');if(!q)return;try{const n=nightCount(field(form,'checkin'),field(form,'checkout'));q.textContent=`${n} nuit${n>1?'s':''} × ${xaf(40000)} = ${xaf(n*40000)} · estimation, sous réserve de confirmation`; }catch{q.textContent='Choisissez vos dates pour afficher une estimation indicative.';}}
 $$('[data-availability-form]').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();const p=field(form,'property');const a=field(form,'checkin'),b=field(form,'checkout');try{nightCount(a,b);if(p!=='miague'){location.href=`/experience/stays/${encodeURIComponent(p)}/`;return;}location.href='/experience/search/?'+qs({property:p,checkin:a,checkout:b,guests:field(form,'guests')||2});}catch(err){notice(form,err.message);}}));
 // Collection active filters, not decorative.
 $$('[data-property-filter]').forEach(btn=>btn.addEventListener('click',()=>{const value=btn.getAttribute('data-property-filter');$$('[data-property-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));$$('.residence-card').forEach(card=>{const status=card.querySelector('.property-status')?.classList.contains('status-plan')?'interest':'open';card.hidden=value!=='all'&&value!==status;});}));
 const search=$('[data-search-form]');
 async function performSearch(){if(!search)return;const property=field(search,'property'),a=field(search,'checkin'),b=field(search,'checkout');const area=$('[data-property-result]');try{const n=nightCount(a,b);let info=null;if(property==='miague'||property==='all'){info=await request(`/public/availability?${qs({checkin:a,checkout:b})}`).catch(()=>null)}const options=[['miague','Résidence Miague','Réservation de studio privé','40000'],['ebene','Résidence Ebène','En construction · préinscriptions','400000'],['amara','Résidence Amara','En construction · préinscriptions','450000']].filter(x=>property==='all'||x[0]===property);area.innerHTML=options.map(([id,name,desc,amount])=>`<article class="search-result"><div class="photo"><img src="/experience/assets/${id==='miague'?'miague-hero':id}.webp" loading="lazy" onerror="this.style.display='none'" alt="${escape(name)}"/></div><div><span class="eyebrow">BONAPRISO · DOUALA</span><h3>${escape(name)}</h3><p>${escape(desc)}. ${id==='miague'&&info?.available===false?'Période déjà occupée dans la base de démonstration.':''}</p><p>${id==='miague'?`${n} nuits · estimation ${xaf(n*Number(amount))}`:`Dès ${xaf(amount)}/mois · non disponible immédiatement`}</p><a href="${id==='miague'&&info?.available!==false?'/experience/booking/?'+qs({checkin:a,checkout:b,guests:field(search,'guests')||2}):'/experience/stays/'+id+'/'}">${id==='miague'&&info?.available!==false?'Continuer ma demande':'En savoir plus'} ↗</a></div></article>`).join('');if(!info)area.insertAdjacentHTML('afterbegin','<p class="quiet-note">Mode visuel uniquement : connexion locale absente, aucune disponibilité garantie.</p>');}catch(err){area.textContent=err.message;}}
 search?.addEventListener('submit',e=>{e.preventDefault();performSearch()});if(search&&get('checkin')&&get('checkout'))performSearch();
 const booking=$('[data-booking-form]');
 if(booking){['checkin','checkout','guests'].forEach(k=>{if(get(k)&&booking.elements.namedItem(k))booking.elements.namedItem(k).value=get(k)});updateQuote(booking);booking.addEventListener('change',()=>updateQuote(booking));booking.addEventListener('submit',async e=>{e.preventDefault();const button=$('button[type=submit]',booking);let payload;try{nightCount(field(booking,'checkin'),field(booking,'checkout'));if(!$('input[name=acknowledgement]',booking)?.checked)throw Error('Acceptez les conditions du formulaire de démonstration.');payload={property:'miague',checkin:field(booking,'checkin'),checkout:field(booking,'checkout'),guests:Number(field(booking,'guests')),guest:field(booking,'full_name'),email:field(booking,'email'),phone:field(booking,'phone')};button.disabled=true;button.textContent='Envoi de la demande…';const result=await request('/public/request',{method:'POST',body:JSON.stringify(payload)});notice(booking,`Demande de démonstration enregistrée : ${result.reference}. Statut : en attente. Aucun paiement effectué.`,true);booking.reset();const output=$('[data-quote-result]');if(output)output.textContent=`Référence ${result.reference} · ${xaf(result.estimate_xaf)} · demande de test.`;}catch(err){notice(booking,err.message);}finally{button.disabled=false;button.textContent='Envoyer ma demande de démonstration ↗';}});}
 const manage=$('[data-manage-form]');manage?.addEventListener('submit',async e=>{e.preventDefault();try{const data=await request(`/public/lookup?${qs({reference:field(manage,'reference'),email:field(manage,'email')})}`);const item=data.booking;const out=$('[data-manage-result]');if(out)out.innerHTML=`<div class="quote-output"><strong>${escape(item.reference)}</strong><p>${escape(item.checkin)} → ${escape(item.checkout)} · ${Number(item.guests)} voyageurs</p><p>Statut : <strong>${escape(item.status)}</strong></p><p>Estimation : ${xaf(item.estimate_xaf)} · Paiement : ${escape(item.payment?.state||'not_initiated')}</p><p><a class="btn btn-dark" href="/experience/payment/">Consulter le paiement ↗</a></p></div>`;notice(manage,'Demande de test retrouvée.',true);}catch(err){notice(manage,err.message)}});
 const payment=$('[data-payment-form]');
 payment?.addEventListener('submit',async event=>{
  event.preventDefault();const ref=field(payment,'reference');const email=field(payment,'email');const area=$('[data-payment-result]');
  try{
   const data=await request(`/public/lookup?${qs({reference:ref,email})}`);const b=data.booking;
   if(!b)throw Error('Réservation introuvable');
   let html=`<span class="eyebrow">${escape(b.reference)}</span><h3>Réservation : ${escape(b.status)}</h3><p>${escape(b.checkin)} → ${escape(b.checkout)} · ${xaf(b.estimate_xaf)}</p>`;
   if(b.status==='confirmed'||b.status==='checked_in'){
    const intent=await request('/public/payment-intent',{method:'POST',body:JSON.stringify({reference:ref,email})});
    html+=`<div class="pay-flow"><div class="pay-step"><svg class="ui-icon"><use href="/experience/assets/icons.svg#check-circle"></use></svg> Demande confirmée</div><div class="pay-step"><svg class="ui-icon"><use href="/experience/assets/icons.svg#check-circle"></use></svg> Montant établi côté serveur (${xaf(intent.intent.amount_xaf)})</div><div class="pay-step"><svg class="ui-icon"><use href="/experience/assets/icons.svg#wallet"></use></svg> Paiement ${escape(intent.intent.state)}</div></div><p><strong>Référence de paiement :</strong> ${escape(intent.intent.reference)}</p><p><strong>Mode local démo.</strong> Le PSP n'est pas connecté : aucun débit ni redirection.</p>`;
   }else{html+='<p>La résidence doit confirmer cette demande avant qu’un paiement puisse être ouvert. Aucun débit n’est effectué.</p>'}
   area.innerHTML=html;area.hidden=false;notice(payment,'Statut de la réservation vérifié.',true);
  }catch(err){notice(payment,err.message);if(area){area.hidden=true;area.textContent=''}}
 });
 $('[data-contact-form]')?.addEventListener('submit',e=>{e.preventDefault();const form=e.currentTarget;const name=field(form,'name'),email=field(form,'email'),reason=field(form,'reason'),msg=field(form,'message');if(!name||!email||!msg)return notice(form,'Renseignez les coordonnées et votre message.');const textBody=`Blue Ocean Collection\nNom : ${name}\nE-mail : ${email}\nObjet : ${reason}\n\n${msg}`;navigator.clipboard?.writeText(textBody).then(()=>notice(form,'Brouillon copié. Le canal d’envoi réel doit encore être configuré.',true)).catch(()=>notice(form,'Envoi indisponible. Veuillez contacter directement la résidence.'));});
})();
