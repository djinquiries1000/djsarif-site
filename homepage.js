const SCRIPT_URL=window.DJ_CONFIG.publicApiUrl||window.DJ_CONFIG.eventsApiUrl;
async function fetchJsonp(url){const response=await fetch(url,{signal:AbortSignal.timeout(12000),cache:'no-store'});if(!response.ok)throw Error('Service unavailable');const data=await response.json();if(data?.ok!==true)throw Error('Service unavailable');return data;}
function toggleNav(){const open=document.getElementById('navLinks').classList.toggle('open');document.querySelector('.hamburger').setAttribute('aria-expanded',String(open));}
function openClientAccess(){const modal=document.getElementById('clientAccessModal');modal.style.display='block';document.body.style.overflow='hidden';document.getElementById('navLinks').classList.remove('open');document.querySelector('#clientAccessForm input').focus();}
function closeClientAccess(){document.getElementById('clientAccessModal').style.display='none';document.body.style.overflow='';}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeClientAccess();});
document.querySelector('.calendar-details').addEventListener('toggle',e=>{const frame=e.target.querySelector('iframe');if(e.target.open&&!frame.hasAttribute('src'))frame.src=frame.dataset.src;});
async function loadApprovedReviews(){
 const section=document.getElementById('reviews'),grid=document.getElementById('approvedReviews'),skeleton=document.getElementById('approvedReviewsEmpty'),summary=document.getElementById('reviewSummary');
 section.setAttribute('aria-busy','true');
 try{const data=await fetchJsonp(SCRIPT_URL+'?action=approved_reviews');const reviews=(Array.isArray(data.reviews)?data.reviews:[]).filter(r=>typeof r.text==='string'&&r.text.trim()&&Number(r.rating)>=1&&Number(r.rating)<=5);
 if(!reviews.length){section.hidden=true;return;}
 grid.replaceChildren();grid.setAttribute('role','list');
 for(const r of reviews){const card=document.createElement('div');card.className='approved-review-card';card.setAttribute('role','listitem');const stars=document.createElement('div');stars.className='review-stars';stars.textContent='★'.repeat(Math.round(Number(r.rating)));stars.setAttribute('aria-label',r.rating+' out of 5 stars');const quote=document.createElement('blockquote');quote.textContent=r.text;const byline=document.createElement('div');byline.className='review-byline';const name=document.createElement('strong');name.textContent=r.name;const type=document.createElement('span');type.textContent=r.eventType||'';byline.append(name,type);card.append(stars,quote,byline);grid.append(card);}
 summary.textContent=(reviews.reduce((n,r)=>n+Number(r.rating),0)/reviews.length).toFixed(1)+' out of 5 from '+reviews.length+' approved '+(reviews.length===1?'review':'reviews');summary.hidden=false;
 }catch{section.hidden=true;}finally{skeleton.remove();section.setAttribute('aria-busy','false');}
}
loadApprovedReviews();
