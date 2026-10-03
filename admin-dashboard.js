
const $=s=>document.querySelector(s);let state={},busy=false,imageData='';
async function rpc(action,payload={}){return adminApi('rpc',{action,payload});}
function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n}
function button(label,fn){const b=el('button',label);b.type='button';b.onclick=fn;return b}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn()}catch(e){$('#status').textContent=e.message;if(!$('#videos').hidden){$('#videoMessage').textContent=e.message;$('#videoMessage').setAttribute('role','alert');}}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false)}}
function reset(){ $('#eventForm').reset();$('#eventForm').elements.id.value='';$('#eventForm').elements.revision.value='0';imageData='';$('#flyerPreview').hidden=true;}
function edit(e){reset();for(const [k,v] of Object.entries(e))if($('#eventForm').elements[k])$('#eventForm').elements[k].value=v;$('#eventForm').scrollIntoView({behavior:'smooth'})}
function render(){for(const [kind,id] of [['events','eventList'],['reviews','reviewList'],['bookings','bookingList']]){const list=$('#'+id);list.replaceChildren();for(const item of state[kind]||[]){const c=el('article');c.className='row';c.append(el('h3',item.title||item.name||'Unnamed'));if(kind==='events'){c.append(el('p',item.date+' / '+item.status),el('p',item.venue),button('Edit event',()=>edit(item)))}if(kind==='reviews'){c.append(el('p',item.text),el('p',item.rating+' / 5 - '+item.status));const a=el('div');a.className='actions';for(const status of ['APPROVED','PENDING','REJECTED'])a.append(button(status,()=>run(async()=>{await rpc('moderate_review',{row:item.row,fingerprint:item.fingerprint,status});await refresh();$('#status').textContent='Review status saved.'})));c.append(a)}if(kind==='bookings'){for(const t of [item.email,item.phone,item.eventDate,item.location,item.notes])if(t)c.append(el('p',t));const label=el('label','Status');const select=el('select');for(const s of ['new','reviewed','follow_up','booked','completed','declined']){const o=el('option',s);o.value=s;select.append(o)}select.value=item.status;label.append(select);c.append(label,button('Save status',()=>run(async()=>{await rpc('booking_status',{id:item.id,fingerprint:item.fingerprint,status:select.value});await refresh();$('#status').textContent='Booking status saved.'})))}list.append(c)}if(!list.children.length)list.append(el('p','No records yet.'))}}
async function refresh(){state=await rpc('state');render();$('#status').textContent='Loaded from shared storage.'}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>['events','videos','reviews','bookings'].forEach(id=>$('#'+id).hidden=id!==b.dataset.tab));$('#refresh').onclick=()=>run(refresh);$('#newEvent').onclick=reset;
$('#flyerFile').onchange=async e=>{const file=e.target.files[0];imageData='';if(!file)return;try{if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20000000)throw Error('Choose a JPG, PNG or WebP under 20 MB.');const bitmap=await createImageBitmap(file),scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();imageData=canvas.toDataURL('image/jpeg',.85);if(imageData.length>1500000){imageData='';throw Error('Choose a smaller image.')}$('#flyerPreview').src=imageData;$('#flyerPreview').hidden=false;}catch(err){$('#status').textContent=err.message}};
$('#eventForm').onsubmit=e=>{e.preventDefault();run(async()=>{await rpc('save_event',{...Object.fromEntries(new FormData(e.target)),imageData});reset();await refresh();$('#status').textContent='Event saved. Active upcoming events are public.'})};
let uploadedVideo=null, localVideoURL='';
function clearVideoSelection(){uploadedVideo=null;$('#publishVideo').hidden=true;$('#videoMessage').textContent='';$('#videoProgress').hidden=true;}
$('#videoSlot').onchange=()=>{clearVideoSelection();$('#videoFile').value='';$('#videoPreview').hidden=true;if(localVideoURL)URL.revokeObjectURL(localVideoURL)};
$('#videoFile').onchange=()=>{
  clearVideoSelection();if(localVideoURL)URL.revokeObjectURL(localVideoURL);
  const file=$('#videoFile').files[0];$('#videoPreview').hidden=!file;
  if(file){localVideoURL=URL.createObjectURL(file);$('#videoPreview').src=localVideoURL;}
};
$('#videoForm').onsubmit=e=>{e.preventDefault();run(async()=>{
  const file=$('#videoFile').files[0],slot=$('#videoSlot').value;
  if(!file)throw Error('Choose a video first.');
  if(!/\.(mp4|mov)$/i.test(file.name))throw Error('This file format is not supported. Choose an MP4 or MOV video.');
  if(file.size>1024*1024*1024||file.size<12)throw Error('Your video is '+(file.size/1024/1024).toFixed(1)+' MB. Choose a video up to 1 GB.');
  if($('#videoPreview').error)throw Error('Your browser cannot play this video. Export it as H.264 MP4 and try again.');
  clearVideoSelection();$('#videoMessage').textContent='Preparing your upload…';$('#videoMessage').setAttribute('role','status');$('#videoSlot').disabled=true;$('#videoFile').disabled=true;
  try {
    $('#videoProgress').hidden=false;$('#videoProgress').value=0;
    const auth=await window.uploadSarifVideo(file,
      id=>rpc('video_authorize',{action:'upload',slot,size:file.size,...(id?{id}:{})}),
      percent=>$('#videoProgress').value=percent,
      message=>$('#videoMessage').textContent=message);
    uploadedVideo={id:auth.id,slot,size:file.size};$('#videoPreview').src='https://djsarif.com'+auth.url;$('#publishVideo').hidden=false;$('#videoMessage').textContent='Uploaded. Play the preview, then select Publish video.'+(file.name.toLowerCase().endsWith('.mov')?' MOV playback varies by device. H.264 MP4 is recommended for the widest compatibility.':'');
  } finally {$('#videoSlot').disabled=false;$('#videoFile').disabled=false;}
})};
$('#publishVideo').onclick=()=>run(async()=>{
  if(!uploadedVideo)throw Error('Upload a video first.');
  if($('#videoPreview').error)throw Error('Preview could not play. Upload a compatible MP4 before publishing.');
  const auth=await rpc('video_authorize',{action:'publish',...uploadedVideo});
  const response=await fetch('https://djsarif.com/api/videos/publish',{method:'POST',headers:{Authorization:'Bearer '+auth.token}}),data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'Could not publish.');
  const check=await fetch('/api/videos/config?verify='+Date.now(),{cache:'no-store'}).then(r=>r.json());
  if(!check.ok||!check.videos?.[uploadedVideo.slot]?.url?.includes(uploadedVideo.id))throw Error('Publication was not confirmed on the live site. Your upload is saved; try Publish video again.');
  $('#videoMessage').textContent='Published! Visitors will see this video when they open or refresh your website.';$('#publishVideo').hidden=true;uploadedVideo=null;
});

const libraryButton=el('button','Find my uploaded videos');libraryButton.type='button';
const libraryList=el('div');$('#videos').append(libraryButton,libraryList);
libraryButton.onclick=()=>run(async()=>{
  $('#videoMessage').textContent='Finding your saved uploads…';
  const data=await rpc('video_library');libraryList.replaceChildren();
  for(const clip of data.clips){const card=el('article');card.append(el('p',new Date(clip.uploadedAt).toLocaleString()+' — '+(clip.size/1024/1024).toFixed(1)+' MB'),button('Preview this upload',()=>{
    uploadedVideo={id:clip.id,size:clip.size,slot:$('#videoSlot').value};$('#videoPreview').src=clip.url;$('#videoPreview').hidden=false;$('#publishVideo').hidden=false;$('#videoMessage').textContent='Saved upload selected for '+$('#videoSlot').selectedOptions[0].text+'. Play the preview, then Publish video.';
  }));libraryList.append(card);}
  $('#videoMessage').textContent=data.clips.length?'Choose an upload below. No need to upload the file again.':'No saved uploads found.';
});

window.startAdmin=data=>{if(data){state=data;render();$('#status').textContent='Loaded from shared storage.';}else run(refresh);};
window.clearAdminState=()=>{state={};imageData='';uploadedVideo=null;$('#flyerPreview').removeAttribute('src');$('#flyerPreview').hidden=true;$('#videoPreview').removeAttribute('src');$('#videoPreview').hidden=true;$('#videoFile').value='';if(localVideoURL){URL.revokeObjectURL(localVideoURL);localVideoURL='';}};
