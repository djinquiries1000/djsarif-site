(() => {

  const config=window.DJ_CONFIG||{};

  const validEndpoint=url=>/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url||'');

  const configured=validEndpoint(config.publicApiUrl)&&!!config.turnstileSiteKey;

  const legacyEndpoint=typeof SCRIPT_URL==='string'?SCRIPT_URL:'';

  const canSubmit=configured||(!config.publicApiUrl&&validEndpoint(legacyEndpoint));

  const api=async payload=>{

    if(!canSubmit)throw new Error('Online submission is being upgraded. Please call 614-772-6549 or use the booking form.');

    const packages={basic:'Basic',premium:'Premium — All Out',unsure:'Help me choose'};

    const legacy=payload.action==='submit_review'?{source:'review',reviewerName:payload.name,reviewerEmail:payload.email,eventType:payload.eventType,rating:payload.rating,reviewText:payload.text,website:payload.website||'',requestId:payload.requestId||''}:{source:'vip',name:payload.name,email:payload.email,eventType:payload.eventType,eventDate:payload.eventDate,venue:payload.location,phone:payload.phone||'',guests:payload.guests||'',website:payload.website||'',requestId:payload.requestId||'',notes:'Package: '+(packages[payload.packageOption]||'Help me choose')+'\nBudget preference: '+(payload.budgetPreference||'Prefer to discuss')+'\n'+(payload.notes||'')};

    const response=await fetch(configured?config.publicApiUrl:legacyEndpoint,{method:'POST',body:configured?JSON.stringify(payload):new URLSearchParams(legacy),headers:configured?{'Content-Type':'text/plain;charset=UTF-8'}:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},signal:AbortSignal.timeout(20000)});

    let result;try{result=await response.json()}catch{throw new Error('The service did not confirm your request. Your entries are still here.')}

    if(!response.ok||result?.ok!==true)throw new Error(result?.error||'The service did not confirm your request.');

    return result;

  };

  window.DJ_API={api,configured,validEndpoint};

  const challenges=new Map();

  const formNames=['reviewForm','clientAccessForm','inquiryForm'];

  function setupChallenge(form){

    if(!form||challenges.has(form)||!window.turnstile)return;

    const container=document.createElement('div');container.className='human-check';form.append(container);



    const widget=turnstile.render(container,{sitekey:config.turnstileSiteKey,action:'dj-inquiry',theme:'dark'});challenges.set(form,widget);

  }

  function requestId(form,payload){

    const fingerprint=JSON.stringify(payload);

    if(form.dataset.requestFingerprint!==fingerprint){form.dataset.requestFingerprint=fingerprint;form.dataset.requestId=crypto.randomUUID()}

    return form.dataset.requestId;

  }

  async function submit(form,payload,note,button){

    if(button.disabled)return;
    if(!form.reportValidity())return;
    if(form.elements.website?.value){note.textContent='Unable to submit. Please contact hello@djsarif.com.';return;}
    const last=Number(sessionStorage.getItem('sarif-last-submit-'+payload.action)||0);
    if(Date.now()-last<60000){note.textContent='Please wait a minute before sending another submission.';return;}

    if(!canSubmit){note.textContent='Online submission is being upgraded. Please call 614-772-6549 or use the booking form.';return}

    const widget=challenges.get(form),challenge=widget!==undefined?window.turnstile?.getResponse(widget):'';

    if(configured&&!challenge){note.textContent='Please complete the verification below.';return}

    const id=requestId(form,payload);button.disabled=true;note.textContent='Saving your request…';

    try{

      const result=await api({...payload,requestId:id,challenge,website:form.elements.website?.value||''});

      note.textContent=payload.action==='submit_review'?'Thank you. Your review was submitted for approval.': 'Thanks! Your inquiry was received. Sarif will follow up within 24–48 hours about your date and package.'; if(result.id)note.textContent+=' Reference: '+result.id;

      sessionStorage.setItem('sarif-last-submit-'+payload.action,String(Date.now()));form.reset();delete form.dataset.requestFingerprint;delete form.dataset.requestId;

    }catch(e){note.textContent=e.message+(configured?' If uncertain, retry unchanged or contact Sarif with reference '+id+'.':' Please contact Sarif before resubmitting if you are unsure whether it arrived.');}

    finally{button.disabled=false;if(widget!==undefined)window.turnstile?.reset(widget)}

  }

  window.submitReview=e=>{e.preventDefault();const f=e.target,d=new FormData(f),rating=Number(d.get('rating'));if(rating<1||rating>5){document.getElementById('reviewNote').textContent='Choose a star rating from 1 to 5.';return}return submit(f,{action:'submit_review',name:d.get('reviewerName'),email:d.get('reviewerEmail'),eventType:d.get('eventType'),rating,text:d.get('reviewText')},document.getElementById('reviewNote'),document.getElementById('reviewSubmitBtn'));};

  window.submitClientAccess=e=>{e.preventDefault();const f=e.target,d=new FormData(f);return submit(f,{action:'submit_booking',name:d.get('clientName'),email:d.get('clientEmail'),eventType:d.get('eventType'),eventDate:d.get('eventDate'),location:d.get('location'),notes:d.get('notes'),phone:'',packageOption:d.get('packageOption')||'unsure'},document.getElementById('clientNote'),document.getElementById('clientSubmitBtn'));};

  // Legacy inquiry panel remains inert; the unified inquiry dialog replaces it.

  window.submitVIP=e=>{e.preventDefault();document.getElementById('vipNote').textContent='Please use Check my date to send an inquiry.';};

  function createInquiry(){

    const dialog=document.createElement('dialog');dialog.id='inquiryDialog';dialog.setAttribute('aria-labelledby','inquiryTitle');

    dialog.innerHTML='<button type="button" class="inquiry-close" aria-label="Close inquiry">×</button><h2 id="inquiryTitle">Let’s plan your event.</h2><form id="inquiryForm"><label>Your name<input name="name" autocomplete="name" maxlength="120" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Event type<select name="eventType" required><option value="">Choose an event</option><option>Wedding</option><option>Birthday</option><option>Corporate</option><option>Concert</option><option>Private Party</option><option>Club</option><option>Other</option></select></label><label>Package preference<select name="packageOption"><option value="unsure">Help me choose</option><option value="basic">Basic</option><option value="premium">Premium — All Out</option></select></label><label>Event date<input name="eventDate" type="date" required></label><label>Venue name / city<input name="location" maxlength="300" required></label><label>Phone (optional)<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label><label>Estimated guest count<input name="guests" type="number" min="1" max="100000" step="1" required></label><label>Budget preference (optional)<select name="budgetPreference"><option value="">Prefer to discuss</option><option>Keep the setup simple</option><option>Flexible for the right setup</option><option>Still planning</option></select></label><label>Message / must-play songs (optional)<textarea name="notes" maxlength="3000"></textarea></label><p class="booking-small">Expect a reply within 24–48 hours. An inquiry does not reserve your date. <a href="privacy.html" target="_blank" rel="noopener">How I use your information</a>.</p><button type="submit" class="primary">Send inquiry</button><p class="form-status" role="status"></p></form>';

    document.body.append(dialog);dialog.querySelector('.inquiry-close').onclick=()=>dialog.close();

    const form=dialog.querySelector('form');form.onsubmit=e=>{e.preventDefault();return submit(form,Object.fromEntries([['action','submit_booking'],...['name','email','eventType','eventDate','location','phone','notes','packageOption','guests','budgetPreference'].map(key=>[key,new FormData(form).get(key)])]),form.querySelector('.form-status'),form.querySelector('[type=submit]'));};

    document.querySelectorAll('#booking [data-inquiry]').forEach(a=>a.addEventListener('click',e=>{if(!canSubmit)return;e.preventDefault();dialog.showModal();if(configured)setupChallenge(form)}));

  }

  if(document.getElementById('booking'))createInquiry();
  const today=new Date();today.setMinutes(today.getMinutes()-today.getTimezoneOffset());
  document.querySelectorAll('input[type=date]').forEach(input=>input.min=today.toISOString().slice(0,10));
  for(const id of formNames){const form=document.getElementById(id);if(!form)continue;const label=document.createElement('label');label.className='form-honeypot';label.setAttribute('aria-hidden','true');label.textContent='Leave this field empty';const input=document.createElement('input');input.name='website';input.tabIndex=-1;input.autocomplete='off';label.append(input);form.append(label);}

  document.querySelectorAll('[data-package]').forEach(a=>a.addEventListener('click',e=>{if(!canSubmit)return;e.preventDefault();const dialog=document.getElementById('inquiryDialog');dialog.querySelector('[name=packageOption]').value=a.dataset.package;dialog.showModal();if(configured)setupChallenge(dialog.querySelector('form'));}));

  if(configured){

    const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>formNames.forEach(id=>setupChallenge(document.getElementById(id)));document.head.append(script);

  }else if(!canSubmit){

    ['reviewForm','clientAccessForm'].forEach(id=>{const form=document.getElementById(id);if(!form)return;const note=document.createElement('p');note.className='form-note';note.textContent='Online submissions are being upgraded. Please call or use the booking inquiry link.';form.prepend(note);form.querySelector('[type=submit]').disabled=true;});

  }

})();

