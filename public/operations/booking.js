/* Blue Ocean local operations: server-computed estimates; online payments are not connected. */
(() => {
  'use strict';
  const fr = document.documentElement.lang !== 'en';
  const i18n = fr ? {
    est:'Estimation de votre séjour',night:'nuit',nights:'nuits',subtotal:'Hébergement',
    fee:'Frais obligatoires configurés',tax:'Taxe configurée',total:'Sous-total estimé',
    notfinal:'Taxes et frais non encore configurés ou vérifiés. Montant final à confirmer par la résidence.',
    unavailable:'Aucune chambre disponible pour ces dates.',
    rooms:(n,total)=>`${n} chambre${n===1?'':'s'} disponible${n===1?'':'s'} sur ${total}.`,
    rooms:(n,total)=>`${n} chambre${n===1?'':'s'} disponible${n===1?'':'s'} sur ${total}.`,
    coming:'Cette résidence est en construction et ne peut pas être réservée.',
    choose:'Choisissez vos dates pour voir une estimation.',
    invalid:'Le départ doit suivre l’arrivée (1 à 180 nuits). Vérifiez vos dates.',
    service:'Le service ne peut pas vérifier ces dates. Réessayez avant d’envoyer votre demande.',
    offline:'Le moteur de réservation est hors ligne. Estimation simple sans garantie de disponibilité ou de tarif final.',
    demo:'Prix indicatif · Confirmation par la résidence',
    consent:'Autoriser les statistiques anonymes pour améliorer le parcours de réservation ?',
    yes:'Autoriser',no:'Refuser',receipt:'Prix mis à jour selon les dates choisies.'
  } : {
    est:'Your stay estimate',night:'night',nights:'nights',subtotal:'Accommodation',
    fee:'Configured mandatory fees',tax:'Configured tax',total:'Estimated subtotal',
    notfinal:'Taxes and fees are not yet fully configured or verified. The property team must confirm the final amount.',
    unavailable:'No rooms are available for these dates.',
    rooms:(n,total)=>`${n} of ${total} rooms available.`,
    rooms:(n,total)=>`${n} of ${total} rooms available.`,
    coming:'This residence is under construction and is not bookable.',
    choose:'Select dates to see an estimate.',
    invalid:'Check-out must follow check-in (1 to 180 nights). Please check your dates.',
    service:'The service cannot verify these dates. Retry before sending your request.',
    offline:'Reservation service is offline. Basic estimate only; neither availability nor final price is guaranteed.',
    demo:'Indicative quote · Confirmation by the property',
    consent:'Allow anonymous booking-flow analytics to help improve this website?',
    yes:'Allow',no:'Decline',receipt:'Price updated for your selected dates.'
  };
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const fmt=(n)=>new Intl.NumberFormat(fr?'fr-CM':'en-US',{maximumFractionDigits:0}).format(n)+' FCFA';
  const qs=({checkin,checkout,guests,property})=>new URLSearchParams({checkin,checkout,guests,property}).toString();
  const forms=$$('[data-search-bar], [data-guest-booking]');
  const pageRoute=document.body.dataset.route||'';
  const track=()=>{};
  window.BOTrackConversion=track;
  const today=new Date().toISOString().slice(0,10);
  function valid(a,b){const count=(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000;return /^\d{4}-\d{2}-\d{2}$/.test(a)&&/^\d{4}-\d{2}-\d{2}$/.test(b)&&a>=today&&count>=1&&count<=180;}
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
      '<p class="bo-room-availability">'+i18n.rooms(data.available_rooms,data.room_count)+'</p>'+
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
    let counter=0;let timer;let controller;
    const state=(name)=>form.dispatchEvent(new CustomEvent('bo:quote-state',{bubbles:true,detail:{state:name}}));
    const validate=()=>{
      const a=value(form,'checkin'),b=value(form,'checkout');
      const minimum=a&&/^\d{4}-\d{2}-\d{2}$/.test(a)?new Date(Date.parse(a+'T00:00:00Z')+86400000).toISOString().slice(0,10):today;
      // Reassigning min while a native date segment is being typed can reset
      // Chromium's partial day/month editor. Update only when check-in changes.
      if(checkout.min!==minimum)checkout.min=minimum;
      checkout.setCustomValidity(a&&b&&!valid(a,b)?i18n.invalid:'');
      return valid(a,b);
    };
    async function refresh(){
      const serial=++counter;
      const a=value(form,'checkin'),b=value(form,'checkout');
      const property=value(form,'property')||'miague',guests=value(form,'guests')||'1';
      if(!validate()){out.textContent=a&&b?i18n.invalid:i18n.choose;out.dataset.ready='no';state('invalid');return;}
      if(!['miague','miague-studio'].includes(property)){
        out.textContent=i18n.coming;out.dataset.ready='no';state('unavailable');return;
      }
      out.innerHTML='<span class="bo-quote-loading">'+(fr?'Calcul du séjour…':'Calculating stay…')+'</span>';
      state('checking');controller=new AbortController();
      try{
        const resp=await fetch('/api/booking/public/quote?'+qs({checkin:a,checkout:b,guests,property}),{cache:'no-store',signal:controller.signal});
        let data;try{data=await resp.json();}catch{throw Error(i18n.service+' (HTTP '+resp.status+')');}if(serial!==counter)return;
        if(!resp.ok)throw Error((data.error||i18n.service)+' (HTTP '+resp.status+')');
        renderQuote(out,data);state(data.available?'available':'unavailable');track('quote_shown');
      }catch(e){if(serial===counter){
        if(e.name==='AbortError')return;
        out.textContent=i18n.service+' '+(e.message||'');out.dataset.ready='no';state('error');
      }}
    }
    function schedule(){clearTimeout(timer);++counter;controller?.abort();if(!validate()){out.textContent=checkin.value&&checkout.value?i18n.invalid:i18n.choose;out.dataset.ready='no';state('invalid');return;}state('checking');timer=setTimeout(refresh,180);}
    [checkin,checkout,form.elements.namedItem('guests'),form.elements.namedItem('property')].filter(Boolean).forEach(el=>{el.addEventListener('input',schedule);el.addEventListener('change',()=>{schedule();track('dates_selected');});});
    form.addEventListener('invalid',()=>{validate();out.textContent=checkin.value&&checkout.value?i18n.invalid:i18n.choose;},true);
    if(validate())refresh();
    // The booking-submitted event is emitted by V3 only after the API returns HTTP 201.
  });
})();
