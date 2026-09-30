// Homepage enhancements. No analytics, messages, or form submissions on page load.

(() => {

  const video = document.getElementById('performanceVideo');

  const clips = {highlight:'media/dj-sarif-highlight.mp4',club:'media/dj-sarif-clubs.mp4'};

  window.setMediaVideo = key => {

    if (!clips[key]) return;

    video.pause(); video.src = clips[key]; video.load();

    document.querySelectorAll('.media-tab').forEach(button => {

      const active = button.dataset.key === key;

      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));

    });

  };

  document.querySelectorAll('.media-tab').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));

  new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)video.pause();},{threshold:0}).observe(video);

  window.playInlineVideo=()=>video.play().catch(()=>{});

  window.openVideoModalFromInline=()=>video.requestFullscreen?.();

  window.watchAboutVideo=()=>{closeProfile();document.getElementById('media').scrollIntoView({behavior:'smooth'});};

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

        ticketLink:e.privateEvent===false?e.url:'',calendar:true

      }));

      const data={events:[...manual,...normalized]};

      const today=new Date();today.setHours(0,0,0,0);

      const eventDate=e=>new Date(e.date?.includes('T')?e.date:`${e.date}T12:00:00`);

      const events=(Array.isArray(data.events)?data.events:[]).filter(e=>e.status==='active'&&eventDate(e)>=today).sort((a,b)=>eventDate(a)-eventDate(b));

      list.replaceChildren();

      if(!events.length){list.innerHTML='<p class="event-promo-empty">New public dates will be posted here. Planning a private event? <a href="#booking">Check your date ↗</a></p>';return;}

      function makeCard(e){

        const card=document.createElement('article');card.className='event-promo-card';

        const date=document.createElement('p');date.className='eyebrow';date.textContent=eventDate(e).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'});

        const title=document.createElement('h3');title.textContent=e.title;

        const location=document.createElement('p');location.textContent=[e.venue,e.cityState,e.time].filter(Boolean).join(' · ');

        const details=document.createElement('div');details.append(date,title,location);

        const imageURL=safeMediaURL(e.image);if(imageURL){const img=document.createElement('img');img.className='event-flyer';img.src=imageURL;img.alt=e.title+' event flyer';img.loading='lazy';img.addEventListener('error',()=>img.remove());const destination=safeLink(e.ticketLink);if(destination){const a=document.createElement('a');a.href=destination;a.target='_blank';a.rel='noopener noreferrer';a.setAttribute('aria-label','View '+e.title+' event details');a.append(img);card.append(a)}else card.append(img)}

        card.append(details);

        try{const url=new URL(e.ticketLink);if(['https:','http:'].includes(url.protocol)){const a=document.createElement('a');a.href=url.href;a.textContent='Event details ↗';a.target='_blank';a.rel='noopener';details.append(a);}}catch{}

        return card;

      }

      for(const e of events)list.append(makeCard(e));

      const featured=document.getElementById('featuredEvent'),next=events.find(e=>!e.calendar&&e.image&&safeMediaURL(e.image));

      if(featured){featured.replaceChildren();featured.hidden=!next;if(next)featured.append(makeCard(next));}

    }catch{list.innerHTML='<p class="event-promo-empty">Public dates are unavailable right now. <a href="#booking">Contact Sarif about your event ↗</a></p>';}

  }

  upcoming();

})();

