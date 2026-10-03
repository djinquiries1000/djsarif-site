// R2 binding: VIDEOS. Shared secret: VIDEO_UPLOAD_SECRET (also in Apps Script).
const MAX_BYTES = 1024 * 1024 * 1024;
const PART_BYTES = 20 * 1024 * 1024;
const slots = ['highlight', 'club'];
const originOK = origin => origin === 'https://djsarif.com' || /^https:\/\/(?:[a-z0-9-]+\.)?googleusercontent\.com$/.test(origin) || /^https:\/\/[a-z0-9-]+\.script\.googleusercontent\.com$/.test(origin) || origin === 'https://script.google.com';
const json = (data, status = 200) => Response.json(data, {status, headers:{'Cache-Control':'no-store'}});
function decode64(value) { return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c => c.charCodeAt(0)); }
async function claims(request, env, action) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  if (token.length > 2000) throw Error('Invalid authorization');
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) throw Error('Sign in again to upload');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.VIDEO_UPLOAD_SECRET), {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  if (!await crypto.subtle.verify('HMAC',key,decode64(signature),new TextEncoder().encode(body))) throw Error('Invalid authorization');
  const p = JSON.parse(new TextDecoder().decode(decode64(body)));
  if (p.action !== action || !slots.includes(p.slot) || !/^[a-f0-9-]{36}$/.test(p.id) || !Number.isInteger(p.size) || p.size < 12 || p.size > MAX_BYTES || p.exp < Date.now()/1000 || p.exp > Date.now()/1000+1800) throw Error('Upload permission expired or invalid');
  return p;
}
export async function videoRequest(request, env) {
  const response = await handleVideo(request, env);
  const origin = request.headers.get('Origin') || '';
  if (originOK(origin)) {response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');}
  return response;
}
async function handleVideo(request, env) {
  const url = new URL(request.url), origin = request.headers.get('Origin') || '';
  const cors = originOK(origin) ? {'Access-Control-Allow-Origin':origin,'Vary':'Origin'} : {};
  let response;
  try {
    if (request.method === 'OPTIONS') response = new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, PUT, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
    else if (!env.VIDEOS || !env.VIDEO_UPLOAD_SECRET) response = json({ok:false,error:'Video storage setup is not complete.'},503);
    else if (url.pathname === '/api/videos/config' && request.method === 'GET') {
      const entries = await Promise.all(slots.map(async slot => {const obj = await env.VIDEOS.get('settings/'+slot+'.json');return [slot,obj ? await obj.json() : null]}));
      response = json({ok:true,videos:Object.fromEntries(entries)});
    } else if (url.pathname.startsWith('/api/videos/file/') && ['GET','HEAD'].includes(request.method)) {
      const requestedId = url.pathname.slice('/api/videos/file/'.length);
      if (!/^[a-f0-9-]{36}\.(mp4|mov)$/.test(requestedId)) return json({ok:false},404);
      const id=requestedId.replace(/\.mov$/,'.mp4');
      const metadata = await env.VIDEOS.head('clips/'+id);
      if (!metadata) return new Response('Video not found',{status:404});
      if (request.headers.get('If-None-Match') === metadata.httpEtag) return new Response(null,{status:304,headers:{ETag:metadata.httpEtag}});
      let range;
      const rawRange=request.headers.get('Range'),ifRange=request.headers.get('If-Range');
      if (rawRange && (!ifRange || ifRange===metadata.httpEtag)) {
        const match=/^bytes=(\d*)-(\d*)$/.exec(rawRange);
        if(!match || (!match[1]&&!match[2])) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+metadata.size}});
        const start=match[1]?Number(match[1]):Math.max(0,metadata.size-Number(match[2]));
        const end=match[1]&&match[2]?Math.min(Number(match[2]),metadata.size-1):metadata.size-1;
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=metadata.size) return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+metadata.size}});
        range={offset:start,length:end-start+1};
      }
      const object=request.method==='HEAD'?null:await env.VIDEOS.get('clips/'+id,range?{range}:{});
      const headers = new Headers({'Content-Type':metadata.httpMetadata?.contentType==='video/quicktime'?'video/quicktime':'video/mp4','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','ETag':metadata.httpEtag,'Cache-Control':'public, max-age=31536000, immutable'});
      if(range)headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${metadata.size}`);
      headers.set('Content-Length',String(range?range.length:metadata.size));
      response=new Response(object?object.body:null,{status:range?206:200,headers});
    } else if (url.pathname.startsWith('/api/videos/multipart/') && ['POST','PUT'].includes(request.method)) {
      const p=await claims(request,env,'upload'),key='clips/'+p.id+'.mp4',operation=url.pathname.split('/').pop();
      if(operation==='start'&&request.method==='POST'){
        if(await env.VIDEOS.head(key))return json({ok:false,error:'This video already exists. Start a new upload.'},409);
        const body=await request.text();if(body.length>200)return json({ok:false,error:'Invalid video format.'},400);
        const format=body?JSON.parse(body).format:'mp4';
        if(!['mp4','mov'].includes(format))return json({ok:false,error:'Choose MP4 or MOV.'},400);
        const upload=await env.VIDEOS.createMultipartUpload(key,{httpMetadata:{contentType:format==='mov'?'video/quicktime':'video/mp4'},customMetadata:{format}});
        return json({ok:true,uploadId:upload.uploadId,partSize:PART_BYTES});
      }
      const uploadId=url.searchParams.get('uploadId');
      if(!uploadId||uploadId.length>1000)return json({ok:false,error:'Invalid upload.'},400);
      const upload=env.VIDEOS.resumeMultipartUpload(key,uploadId);
      if(operation==='part'&&request.method==='PUT'){
        const partNumber=Number(url.searchParams.get('partNumber')),count=Math.ceil(p.size/PART_BYTES);
        const expected=partNumber===count?p.size-PART_BYTES*(count-1):PART_BYTES;
        if(!Number.isInteger(partNumber)||partNumber<1||partNumber>count||Number(request.headers.get('Content-Length'))!==expected||request.headers.get('Content-Type')!=='application/octet-stream')return json({ok:false,error:'Invalid video part.'},400);
        const part=await upload.uploadPart(partNumber,request.body);
        return json({ok:true,part});
      }
      if(operation==='abort'&&request.method==='POST'){await upload.abort();return json({ok:true});}
      if(operation==='complete'&&request.method==='POST'){
        const raw=await request.text();if(raw.length>20000)return json({ok:false,error:'Invalid video parts.'},400);
        const {parts}=JSON.parse(raw),count=Math.ceil(p.size/PART_BYTES);
        if(!Array.isArray(parts)||parts.length!==count||parts.some((part,i)=>part.partNumber!==i+1||typeof part.etag!=='string'||part.etag.length>200))return json({ok:false,error:'Upload all video parts before finishing.'},400);
        if(await env.VIDEOS.head(key))return json({ok:false,error:'This video already exists. Start a new upload.'},409);
        const object=await upload.complete(parts);
        const head=await env.VIDEOS.get(key,{range:{offset:0,length:12}}),bytes=new Uint8Array(await head.arrayBuffer());
        if(object.size!==p.size||String.fromCharCode(...bytes.slice(4,8))!=='ftyp'){
          await env.VIDEOS.delete(key);return json({ok:false,error:'The upload is incomplete or is not a supported MP4/MOV video.'},400);
        }
        return json({ok:true,id:p.id,url:'/api/videos/file/'+p.id+(object.customMetadata?.format==='mov'?'.mov':'.mp4')});
      }
      return json({ok:false,error:'Invalid upload operation.'},400);
    } else if (url.pathname === '/api/videos/upload' && request.method === 'PUT') {
      const p = await claims(request,env,'upload');
      if (p.size>100*1024*1024 || request.headers.get('Content-Type') !== 'video/mp4' || Number(request.headers.get('Content-Length')) !== p.size) return json({ok:false,error:'Refresh the admin dashboard to use the large-video uploader.'},400);
      // Uploaded objects are immutable; retry requires a fresh upload authorization.
      const stored = await env.VIDEOS.put('clips/'+p.id+'.mp4', request.body, {onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'video/mp4'}});
      if (!stored) return json({ok:false,error:'This upload was already used. Select the file again.'},409);
      const head = await env.VIDEOS.get('clips/'+p.id+'.mp4',{range:{offset:0,length:12}});
      const bytes = new Uint8Array(await head.arrayBuffer());
      if (String.fromCharCode(...bytes.slice(4,8)) !== 'ftyp') {await env.VIDEOS.delete('clips/'+p.id+'.mp4');return json({ok:false,error:'This file is not a supported MP4.'},400)}
      response = json({ok:true,id:p.id,url:'/api/videos/file/'+p.id+'.mp4'});
    } else if (url.pathname === '/api/videos/publish' && request.method === 'POST') {
      const p = await claims(request,env,'publish');
      const object = await env.VIDEOS.head('clips/'+p.id+'.mp4');
      if (!object || object.size !== p.size) return json({ok:false,error:'Upload the video before publishing.'},400);
      await env.VIDEOS.put('settings/'+p.slot+'.json',JSON.stringify({url:'/api/videos/file/'+p.id+(object.customMetadata?.format==='mov'?'.mov':'.mp4'),updatedAt:new Date().toISOString()}),{httpMetadata:{contentType:'application/json'}});
      response = json({ok:true});
    } else response = json({ok:false,error:'Not found'},404);
  } catch {response = json({ok:false,error:'Upload failed or authorization expired. Try again.'},400)}
  for (const [key,value] of Object.entries(cors)) response.headers.set(key,value);
  return response;
}
