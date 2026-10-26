/* SCI Blue Ocean V4. Display ONLY quotes computed by the server.
   This is a demo-only integration: /api/demo is local, not a live PMS. */
(() => {
  'use strict';
  const fr = document.documentElement.lang !== 'en';
  const i18n = fr ? {
    est:'Estimation de votre séjour',night:'nuit',nights:'nuits',subtotal:'Hébergement',
    fee:'Frais obligatoires configurés',tax:'Taxe configurée',total:'Sous-total estimé',
    notfinal:'Taxes et frais non encore configurés ou vérifiés. Montant final à confirmer par la résidence.',
    unavailable:'Ces dates ne sont pas disponibles dans la base démo.',
    coming:'Cette résidence est en construction et ne peut pas être réservée.',
    choose:'Choisissez vos dates pour voir une estimation.',
    offline:'Le moteur de réservation est hors ligne. Estimation simple sans garantie de disponibilité ou de tarif final.',
    demo:'Prix indicatif · Disponibilité de démo uniquement',
    consent:'Autoriser les statistiques anonymes pour améliorer le parcours de réservation ?',
    yes:'Autoriser',no:'Refuser',receipt:'Prix mis à jour selon les dates choisies.'
  } : {
    est:'Your stay estimate',night:'night',nights:'nights',subtotal:'Accommodation',
    fee:'Configured mandatory fees',tax:'Configured tax',total:'Estimated subtotal',
    notfinal:'Taxes and fees are not yet fully configured or verified. The property team must confirm the final amount.',
    unavailable:'These dates are unavailable in the demo inventory.',
    coming:'This residence is under construction and is not bookable.',
    choose:'Select dates to see an estimate.',
    offline:'Reservation service is offline. Basic estimate only; neither availability nor final price is guaranteed.',
    demo:'Indicative quote · Demo availability only',
    consent:'Allow anonymous booking-flow analytics to help improve this website?',
    yes:'Allow',no:'Decline',receipt:'Price updated for your selected dates.'
  };
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const fmt=(n)=>new Intl.NumberFormat(fr?'fr-CM':'en-US',{maximumFractionDigits:0}).format(n)+' FCFA';
  const qs=({checkin,checkout,guests,property})=>new URLSearchParams({checkin,checkout,guests,property}).toString();
  const forms=$$('[data-search-bar], [data-guest-booking]');
  const pageRoute=document.body.dataset.route||'';
  const track=async event => {
    if(localStorage.getItem('bo_v4_analytics')!=='yes')return;
    try{await fetch('/api/demo/public/event',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({event,locale:fr?'fr':'en',path:location.pathname})});}catch{}
  };
  window.BOTrackConversion=track;
  if(!localStorage.getItem('bo_v4_analytics')){
    const el=document.createElement('div');el.className='bo-consent';el.setAttribute('role','dialog');
    el.setAttribute('aria-label',fr?'Statistiques':'Analytics');
    el.innerHTML='<p>'+i18n.consent+'</p><div><button type="button" data-consent="no">'+i18n.no+'</button><button type="button" data-consent="yes">'+i18n.yes+'</button></div>';
    document.body.append(el);
    el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem('bo_v4_analytics',b.dataset.consent);el.remove();if(b.dataset.consent==='yes'&&pageRoute.startsWith('stays/'))track('property_viewed')}));
  }else if(pageRoute.startsWith('stays/')) track('property_viewed');
  function valid(a,b){return /^\d{4}-\d{2}-\d{2}$/.test(a)&&/^\d{4}-\d{2}-\d{2}$/.test(b)&&b>a;}
  function value(form,key){return form.elements.namedItem(key)?.value||'';}
  function renderQuote(out,data){
    const nights=data.nights;
    const line=(k,v)=>'<div class="bo-quote-line"><span>'+k+'</span><strong>'+fmt(v)+'</strong></div>';
    out.innerHTML='<div class="bo-quote-header"><span class="bo-quote-symbol" aria-hidden="true">✦</span><div><strong>'+i18n.est+'</strong><small>'+i18n.demo+'</small></div></div>'+
      '<div class="bo-quote-dates">'+data.checkin+' → '+data.checkout+' · '+nights+' '+(nights===1?i18n.night:i18n.nights)+'</div>'+
      line(i18n.subtotal+' ('+nights+'×)',data.subtotal_xaf)+
      (data.mandatory_fees_xaf?line(i18n.fee,data.mandatory_fees_xaf):'')+
      (data.tax_status==='verified_configuration'&&data.configured_tax_xaf?line(i18n.tax,data.configured_tax_xaf):'')+
      '<div class="bo-quote-total"><span>'+i18n.total+'</span><strong>'+fmt(data.total_estimate_xaf)+'</strong></div>'+
      '<p class="bo-quote-footnote">'+i18n.notfinal+'</p>'+
      (data.available?'<span class="bo-availability">'+i18n.receipt+'</span>':'<span class="bo-unavailable">'+i18n.unavailable+'</span>');
    out.dataset.ready=data.available?'yes':'no';
  }
  forms.forEach(form=>{
    const checkin=form.elements.namedItem('checkin'),checkout=form.elements.namedItem('checkout');
    if(!checkin||!checkout)return;
    const out=document.createElement('output');out.className='bo-live-quote';out.setAttribute('role','status');out.setAttribute('aria-live','polite');
    out.textContent=i18n.choose;
    const existing=$('[data-stay-quote]');
    if(form.matches('[data-guest-booking]')&&existing)existing.hidden=true;
    // Detail/search booking cards and full booking form all share the same pricing engine.
    const slot=(form.matches('[data-guest-booking]')&&existing) ? existing : form;
    slot.insertAdjacentElement('afterend',out);
    let counter=0;let timer;
    async function refresh(){
      const serial=++counter;
      const a=value(form,'checkin'),b=value(form,'checkout');
      const property=value(form,'property')||'miague',guests=value(form,'guests')||'1';
      if(!valid(a,b)){out.textContent=i18n.choose;out.dataset.ready='no';return;}
      if(!['miague','miague-studio'].includes(property)){
        out.textContent=i18n.coming;out.dataset.ready='no';return;
      }
      out.innerHTML='<span class="bo-quote-loading">'+(fr?'Calcul du séjour…':'Calculating stay…')+'</span>';
      try{
        const resp=await fetch('/api/demo/public/quote?'+qs({checkin:a,checkout:b,guests,property}),{cache:'no-store'});
        const data=await resp.json();if(serial!==counter)return;
        if(!resp.ok)throw Error(data.error||i18n.offline);
        renderQuote(out,data);track('quote_shown');
      }catch(e){if(serial===counter){
        // Static Vercel fallback: readable estimate, NEVER a payable/final quote.
        const n=Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
        if(n>0&&n<=180){out.innerHTML='<strong>'+i18n.est+'</strong><div class="bo-quote-total"><span>'+n+' × '+fmt(40000)+'</span><strong>'+fmt(n*40000)+'</strong></div><p class="bo-unavailable">'+i18n.offline+'</p>';}else out.textContent=i18n.offline;
        out.dataset.ready='no';
      }}
    }
    function schedule(){clearTimeout(timer);timer=setTimeout(refresh,180);}
    [checkin,checkout,form.elements.namedItem('guests'),form.elements.namedItem('property')].filter(Boolean).forEach(el=>el.addEventListener('change',()=>{
      if(el===checkin){checkout.min=checkin.value||'';if(checkout.value&&checkout.value<=checkin.value)checkout.value='';}
      schedule();track('dates_selected');
    }));
    if(valid(checkin.value,checkout.value))refresh();
    // The booking-submitted event is emitted by V3 only after the API returns HTTP 201.
  });
})();
