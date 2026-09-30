(() => {
 const token=new URLSearchParams(location.hash.slice(1)).get('token')||'';
 const endpoint=window.DJ_CONFIG?.publicApiUrl;
 const status=document.getElementById('status'),form=document.getElementById('signatureForm'),button=document.getElementById('signButton');let agreement,requestId=crypto.randomUUID();
 const money=cents=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'});
 async function api(payload){
   if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint||''))throw new Error('Agreement service is being configured. Please contact DJ Sarif for a new signing link.');
   const response=await fetch(endpoint,{method:'POST',body:JSON.stringify(payload),headers:{'Content-Type':'text/plain;charset=UTF-8'},signal:AbortSignal.timeout(20000),referrerPolicy:'no-referrer'});
   const result=await response.json();if(!response.ok||result?.ok!==true)throw new Error(result?.error||'The agreement service did not confirm success.');return result;
 }
 function render(a){
   agreement=a;const s=a.snapshot;
   document.getElementById('agreementTitle').textContent=s.clientName+' — Version '+a.version;
   document.getElementById('reference').textContent='Agreement reference: '+a.id;
   document.getElementById('eventDetails').textContent=[s.eventType,s.eventDate,s.location].join(' · ');
   const amounts=document.getElementById('amounts');amounts.replaceChildren();
   for(const [label,key]of[['Total fee','totalCents'],['Deposit (30%)','depositCents'],['Remaining balance','balanceCents']]){const div=document.createElement('div'),strong=document.createElement('strong');div.append(document.createTextNode(label));strong.textContent=money(s[key]);div.append(strong);amounts.append(div)}
   document.getElementById('paymentDue').textContent='Payment due: '+s.dueDate;
   document.getElementById('terms').textContent=s.terms;document.getElementById('agreement').hidden=false;
   if(a.status==='signed'){form.hidden=true;status.textContent='This agreement is already signed.';const receipt=document.getElementById('signedReceipt');receipt.hidden=false;receipt.textContent='Signed at '+a.signedAt;}
   else{form.hidden=false;status.textContent='Review the complete agreement before signing. Link expires '+new Date(a.expiresAt).toLocaleString()+'.';}
 }
 form.onsubmit=async e=>{
   e.preventDefault();if(button.disabled||!agreement)return;
   const name=document.getElementById('typedSignature').value.trim();
   if(name.replace(/\s+/g,' ').toLowerCase()!==agreement.snapshot.clientName.replace(/\s+/g,' ').toLowerCase()){status.textContent='Type the client name exactly as shown on the agreement.';return}
   button.disabled=true;status.textContent='Recording your signature…';
   try{const result=await api({action:'sign_agreement',token,requestId,typedSignature:name,acceptedTerms:document.getElementById('acceptedTerms').checked?'yes':'no',snapshotHash:agreement.snapshotHash});render({...agreement,status:'signed',signedAt:result.signedAt});status.textContent='Signature saved. Reference: '+result.id;}
   catch(e){status.textContent=e.message+' Your signature was not confirmed; you can retry unchanged.';button.disabled=false;}
 };
 document.getElementById('printAgreement').onclick=()=>window.print();
 if(!/^[a-f0-9]{64}$/.test(token)){status.textContent='This signing link is missing or invalid. Please ask DJ Sarif for a new agreement link.';return}
 api({action:'get_agreement',token}).then(r=>render(r.agreement)).catch(e=>{status.textContent=e.message;});
})();
