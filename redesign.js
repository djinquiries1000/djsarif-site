// Homepage enhancements. No analytics, messages, or form submissions on page load.

(() => {

  const video = document.getElementById('performanceVideo');
  const defaultVideoPoster=video.getAttribute('poster');
  const syncVideoPoster=key=>{if(clips[key].startsWith('/api/videos/file/'))video.removeAttribute('poster');else if(defaultVideoPoster)video.setAttribute('poster',defaultVideoPoster);};

  const clips = {highlight:'media/dj-sarif-highlight.mp4',club:'media/dj-sarif-clubs.mp4'};

  let selectedClip='highlight',mediaVisible=false;
  const videoLoader=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){mediaVisible=true;if(!video.getAttribute('src')){video.src=clips[selectedClip];video.load();}videoLoader.disconnect();}},{rootMargin:'200px'});videoLoader.observe(video);
  const error=document.getElementById('videoError'),fallback=document.getElementById('videoFallback');
  video.addEventListener('error',()=>{error.hidden=false;fallback.href=video.currentSrc||clips[selectedClip]});
  video.addEventListener('loadedmetadata',()=>error.hidden=true);
  fetch('/api/videos/config',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{
    if(!data?.ok)return;
    for(const key of ['highlight','club']) {
      const url=data.videos?.[key]?.url;
      if(typeof url==='string' && /^\/api\/videos\/file\/[a-f0-9-]{36}\.(mp4|mov)$/.test(url))clips[key]=url;
    }
    syncVideoPoster(selectedClip);
    // Never interrupt a video the visitor has already started.
    if(mediaVisible && video.paused && video.currentTime===0){video.src=clips[selectedClip];video.load();}
  }).catch(()=>{});
  window.setMediaVideo = key => {
    selectedClip=key;

    if (!clips[key]) return;

    video.pause(); syncVideoPoster(key);error.hidden=true;fallback.href=clips[key];video.src = clips[key]; video.load();

    document.querySelectorAll('.media-tab').forEach(button => {

      const active = button.dataset.key === key;

      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));

    });

  };

  document.querySelectorAll('.media-tab').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));

  new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)video.pause();},{threshold:0}).observe(video);

  window.playInlineVideo=()=>video.play().catch(()=>{});

  window.openVideoModalFromInline=()=>video.requestFullscreen?.();

  

  document.getElementById('currentYear').textContent=new Date().getFullYear();

  document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>{

    document.getElementById('navLinks').classList.remove('open');

    document.querySelector('.hamburger').setAttribute('aria-expanded','false');

  }));

  document.querySelectorAll('input:not([type="hidden"]),select,textarea').forEach(el=>{

    if(el.closest('label')||document.querySelector(`label[for="${el.id}"]`))return;

    const label=document.createElement('label');label.className='field-label';

    const name=el.placeholder||({mm:'Month',dd:'Day',yyyy:'Year',eventType:'Event type'}[el.name])||el.name;

    label.append(document.createTextNode(name));el.before(label);label.append(el);

  });

  document.querySelectorAll('.star-btn').forEach(b=>b.setAttribute('aria-label',`${b.dataset.val} stars`));

  const modal=document.getElementById('clientAccessModal');let returnFocus;

  const oldOpen=window.openClientAccess,oldClose=window.closeClientAccess;

  window.openClientAccess=()=>{returnFocus=document.activeElement;oldOpen();};

  window.closeClientAccess=()=>{const visible=modal.style.display==='block';oldClose();if(visible)returnFocus?.focus();};

  modal.addEventListener('keydown',e=>{

    if(e.key!=='Tab')return;

    const els=[...modal.querySelectorAll('button,input,select,textarea,a[href]')].filter(el=>!el.disabled&&el.offsetParent!==null);

    const first=els[0],last=els.at(-1);

    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}

    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}

  });

  function safeLink(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:''}catch{return ''}}

  function safeMediaURL(value){if(!value)return '';if(value.length<=1500000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value))return value;try{const u=new URL(value,location.href);return (u.protocol==='https:'||u.origin===location.origin)&&!u.username&&!u.password?u.href:''}catch{return ''}}

  const flyerRequests=new Map();
  function loadEventFlyer(url){if(!flyerRequests.has(url))flyerRequests.set(url,fetch('/api/event-preview?url='+encodeURIComponent(url),{signal:AbortSignal.timeout(12000)}).then(r=>r.ok?r.json():null).then(data=>data?.image||''));return flyerRequests.get(url);}
  async function upcoming(){

    const list=document.getElementById('eventPromoList');

    try{

      const sources=await Promise.allSettled([

        ((window.DJ_CONFIG?.eventsApiUrl||window.DJ_CONFIG?.publicApiUrl) ? fetchJsonp(`${window.DJ_CONFIG.eventsApiUrl||SCRIPT_URL}?action=public_state`).then(r=>{if(r.ok===false)throw Error('Events unavailable');return r;}) : fetch('events.json',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw new Error('Events unavailable');return r.json();})),

        fetchJsonp(`${SCRIPT_URL}?action=calendar_events&limit=20`)

      ]);

      if(sources.every(r=>r.status==='rejected'))throw new Error('Events unavailable');

      if(sources[0].status==='fulfilled'&&window.DJ_CONFIG?.publicApiUrl){const allowed=['about','media','services','gallery','reviews','calendar','contact'];for(const id of (sources[0].value.settings?.hiddenSections||[])){if(allowed.includes(id)){const section=document.getElementById(id);if(section)section.hidden=true;document.querySelectorAll(`a[href="#${id}"]`).forEach(a=>a.hidden=true);}}}

      const manual=sources[0].status==='fulfilled'?(sources[0].value.events||[]):[];

      const calendar=sources[1].status==='fulfilled'?(sources[1].value.events||[]):[];

      const normalized=calendar.filter(e=>e.status!=='cancelled').map(e=>({

        date:e.date||e.start?.dateTime||e.start?.date,status:'active',

        title:e.privateEvent===false?e.title||e.summary:'Private event',

        venue:e.privateEvent===false?e.location:'Booked — private celebration',

        ticketLink:e.privateEvent===false?e.url:'',image:e.privateEvent===false?e.image||'':'',calendar:true

      }));

      const data={events:[...manual,...normalized]};

      const today=new Date();today.setHours(0,0,0,0);

      const eventDate=e=>new Date(e.date?.includes('T')?e.date:`${e.date}T12:00:00Z`);

      const events=(Array.isArray(data.events)?data.events:[]).filter(e=>e.status==='active'&&eventDate(e)>=today).sort((a,b)=>eventDate(a)-eventDate(b));

      list.replaceChildren();

      if(!events.length){document.getElementById('eventPromoSidebar').hidden=true;document.querySelector('.quick-card[href="#eventPromoSidebar"]').hidden=true;return;}

      function makeCard(e){
        const destination=safeLink(e.ticketLink),isPublic=!!destination;
        const card=document.createElement('article');card.className='event-promo-card '+(isPublic?'public-date':'private-date');
        const date=eventDate(e),badge=document.createElement('div');badge.className='event-date-badge';const month=document.createElement('span');month.textContent=date.toLocaleDateString('en-US',{month:'short',timeZone:'America/New_York'});const day=document.createElement('strong');day.textContent=date.toLocaleDateString('en-US',{day:'2-digit',timeZone:'America/New_York'});badge.append(month,day);
        const details=document.createElement('div');details.className='event-card-details';const tag=document.createElement('span');tag.className='event-status';tag.textContent=isPublic?'YOU’RE INVITED':'PRIVATE BOOKING';
        const title=document.createElement('h3');title.textContent=isPublic?e.title:'Private event';
        const location=document.createElement('p');location.textContent=isPublic?[e.venue,e.cityState,e.time].filter(Boolean).join(' · '):'A night reserved for a private celebration.';
        const foot=document.createElement('span');foot.className='event-day-label';foot.textContent=date.toLocaleDateString('en-US',{weekday:'long',year:'numeric',timeZone:'America/New_York'});
        details.append(tag,title,location,foot);card.append(badge,details);
        function flyer(src){if(!isPublic||!safeMediaURL(src)||card.querySelector('.event-flyer'))return;const a=document.createElement('a');a.className='event-flyer-link';a.href=destination;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','Tickets and details for '+e.title);const img=document.createElement('img');img.className='event-flyer';img.src=src;img.alt=e.title+' event flyer';img.loading='lazy';img.width=1280;img.height=714;img.onerror=()=>{a.remove();card.classList.remove('has-flyer')};a.append(img);card.prepend(a);card.classList.add('has-flyer');}
        if(isPublic){const a=document.createElement('a');a.className='event-ticket-button';a.href=destination;a.textContent='Tickets & details';a.target='_blank';a.rel='noopener noreferrer';details.append(a);if(e.image)flyer(safeMediaURL(e.image));else loadEventFlyer(destination).then(flyer).catch(()=>{});}
        return card;
      }
      const seen=new Set();for(const e of events){const key=safeLink(e.ticketLink);if(key&&seen.has(key))continue;if(key)seen.add(key);list.append(makeCard(e));}
      const featured=document.getElementById('featuredEvent'),next=events.find(e=>safeLink(e.ticketLink));
      if(featured){featured.replaceChildren();featured.hidden=!next;if(next){const heading=document.createElement('h2');heading.className='visually-hidden';heading.textContent='Next public event';featured.append(heading,makeCard(next));}}
    }catch{document.getElementById('eventPromoSidebar').hidden=true;document.querySelector('.quick-card[href="#eventPromoSidebar"]').hidden=true;}

  }

  upcoming();

})();

