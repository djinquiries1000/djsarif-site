'use strict';
let adminChallenge='',adminLoginBusy=false;
function showAdminLogin(message=''){
  document.querySelector('#manager').hidden=true;document.querySelector('#login').hidden=false;
  document.querySelector('#loginStatus').textContent=message;
  for(const id of ['eventList','reviewList','bookingList'])document.getElementById(id).replaceChildren();
  document.getElementById('eventForm').reset();document.getElementById('videoPreview').pause();
  window.clearAdminState?.();
}
async function adminApi(operation,payload={}){
  let response,data;
  try{response=await fetch('/api/admin/'+operation,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});data=await response.json();}
  catch{throw Error('Could not connect. Check your connection and try again.');}
  if(response.status===401)showAdminLogin('Your session has ended. Email yourself a new code to sign in.');
  if(!response.ok||!data.ok)throw Error((data.error||'Unable to complete request. Try again.')+(data.retryAfter?' Try again in '+Math.ceil(data.retryAfter/60)+' minute(s).':''));
  return data;
}
async function loginAction(action){
  if(adminLoginBusy)return;adminLoginBusy=true;
  const buttons=document.querySelectorAll('#login button');buttons.forEach(b=>b.disabled=true);
  try{await action();}catch(e){document.getElementById('loginStatus').textContent=e.message;}
  finally{adminLoginBusy=false;buttons.forEach(b=>b.disabled=false);}
}
async function requestAdminCode(){
  document.getElementById('loginStatus').textContent='Sending your code…';
  const result=await adminApi('request_code',{email:document.getElementById('adminEmail').value.trim()});
  adminChallenge=result.challenge;
  try{sessionStorage.setItem('sarif-login-challenge',JSON.stringify({challenge:result.challenge,expires:result.expires}));}catch{}
  document.getElementById('requestCode').hidden=true;document.getElementById('verifyCode').hidden=false;
  document.getElementById('adminCode').value='';document.getElementById('adminCode').focus();
  document.getElementById('loginStatus').textContent=result.reused?'Use the code already in your inbox. No new email was needed.':'Code sent to your admin inbox. Check spam if it has not arrived.';
}
document.getElementById('requestCode').addEventListener('submit',e=>{e.preventDefault();loginAction(requestAdminCode);});
document.getElementById('resendCode').addEventListener('click',()=>loginAction(requestAdminCode));
document.getElementById('verifyCode').addEventListener('submit',e=>{e.preventDefault();loginAction(async()=>{
  document.getElementById('loginStatus').textContent='Checking your code…';
  await adminApi('verify_code',{challenge:adminChallenge,code:document.getElementById('adminCode').value.trim()});
  adminChallenge='';try{sessionStorage.removeItem('sarif-login-challenge');}catch{}document.getElementById('adminCode').value='';
  document.getElementById('verifyCode').hidden=true;document.getElementById('requestCode').hidden=false;
  document.getElementById('login').hidden=true;document.getElementById('manager').hidden=false;window.startAdmin();
});});
for(const [id,operation] of [['signOut','logout'],['signOutAll','logout_all']])document.getElementById(id).onclick=async()=>{
  const button=document.getElementById(id);button.disabled=true;
  try{await adminApi(operation);adminChallenge='';document.getElementById('verifyCode').hidden=true;document.getElementById('requestCode').hidden=false;showAdminLogin(operation==='logout_all'?'Signed out on all devices.':'You are signed out.');}
  catch(e){document.getElementById('status').textContent=e.message;}
  finally{button.disabled=false;}
};
document.addEventListener('DOMContentLoaded',async()=>{
  document.getElementById('loginStatus').textContent='Checking your saved sign-in…';
  try{const pending=JSON.parse(sessionStorage.getItem('sarif-login-challenge')||'null');if(pending&&pending.expires>Date.now()){adminChallenge=pending.challenge;document.getElementById('requestCode').hidden=true;document.getElementById('verifyCode').hidden=false;}}catch{}
  try{const data=await adminApi('rpc',{action:'state'});document.getElementById('login').hidden=true;document.getElementById('manager').hidden=false;window.startAdmin(data);}
  catch(e){showAdminLogin(e.message==='Sign in again.'?'':e.message);}
});
