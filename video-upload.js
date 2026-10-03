'use strict';
// Shared by the own-domain dashboard and the legacy Google-owner dashboard.
window.uploadSarifVideo=async function(file,authorize,onProgress,onMessage){
  const base='https://djsarif.com/api/videos/multipart/';
  let auth=await authorize(),renewAt=Date.now()+8*60000,uploadId='';
  async function token(){if(Date.now()>renewAt){auth=await authorize(auth.id);renewAt=Date.now()+8*60000;}return auth.token;}
  async function api(operation,body){
    const response=await fetch(base+operation+(uploadId?'?uploadId='+encodeURIComponent(uploadId):''),{method:'POST',headers:{Authorization:'Bearer '+await token(),'Content-Type':'application/json'},body:JSON.stringify(body||{})});
    let data;try{data=await response.json();}catch{throw Error('The upload service could not respond. Try again.');}
    if(!response.ok||!data.ok)throw Error(data.error||'Upload failed. Try again.');return data;
  }
  try{
    const start=await api('start',{format:file.name.toLowerCase().endsWith('.mov')?'mov':'mp4'});uploadId=start.uploadId;
    if(!Number.isInteger(start.partSize)||start.partSize<5*1024*1024||start.partSize>50*1024*1024)throw Error('Invalid upload settings. Refresh and try again.');
    const parts=[],count=Math.ceil(file.size/start.partSize);
    for(let i=0;i<count;i++){
      const offset=i*start.partSize,blob=file.slice(offset,Math.min(offset+start.partSize,file.size));
      let part;
      for(let attempt=0;attempt<3;attempt++){
        try{
          const bearer=await token();onMessage('Uploading part '+(i+1)+' of '+count+(attempt?' — retrying…':' — keep this page open.'));
          part=await new Promise((resolve,reject)=>{
            const xhr=new XMLHttpRequest();xhr.open('PUT',base+'part?uploadId='+encodeURIComponent(uploadId)+'&partNumber='+(i+1));
            xhr.setRequestHeader('Authorization','Bearer '+bearer);xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.timeout=10*60000;
            xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.min(99,Math.round((offset+e.loaded)/file.size*100)));};
            xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{}if(xhr.status===200&&data?.ok)resolve(data.part);else reject(Error(data?.error||'Could not upload this part.'));};
            xhr.onerror=()=>reject(Error('Connection lost. Please reconnect and try again.'));xhr.ontimeout=()=>reject(Error('Connection timed out. Try again on Wi-Fi.'));xhr.send(blob);
          });break;
        }catch(e){if(attempt===2)throw e;await new Promise(r=>setTimeout(r,1000*(attempt+1)));}
      }
      parts.push(part);onProgress(Math.min(99,Math.round(Math.min(offset+blob.size,file.size)/file.size*100)));
    }
    onMessage('Finishing your upload…');const completed=await api('complete',{parts});onProgress(100);return {...auth,url:completed.url};
  }catch(error){if(uploadId){try{await api('abort');}catch{}}throw error;}
};
