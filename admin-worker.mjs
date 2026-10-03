import {slots,videoTitles,videoConfig,authorizeVideo} from './video-worker.mjs';
const BACKEND='https://script.google.com/macros/s/AKfycbyFdjV0zjHtGDSF2g_0UkBIjNo5jzc8htWFn590tT0fL_oXdVRbdPvYOJyf92MNTJJE/exec';
const COOKIE='__Host-sarif_admin';
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex','Referrer-Policy':'no-referrer'};
const cookie=(value,age)=>`${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${age}`;
function json(body,status=200,extra={}){return Response.json(body,{status,headers:{...headers,...extra}});}
export async function adminRequest(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/admin'||url.pathname==='/admin/'){
    if(!['GET','HEAD'].includes(request.method))return json({ok:false,error:'Method not allowed'},405);
    const asset=await env.ASSETS.fetch(new Request(url.origin+'/dashboard',request));
    const response=new Response(asset.body,asset);Object.entries(headers).forEach(([k,v])=>response.headers.set(k,v));
    response.headers.set('Content-Security-Policy',"frame-ancestors 'none'");return response;
  }
  if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
  if(request.headers.get('Origin')!==url.origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({ok:false,error:'Open the dashboard on this website.'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({ok:false,error:'JSON required'},415);
  if(Number(request.headers.get('Content-Length'))>1600000)return json({ok:false,error:'Request too large'},413);
  let phase='request';
  try{
    // Streaming size limit also covers requests without Content-Length.
    const reader=request.body?.getReader();if(!reader)return json({ok:false,error:'Request required'},400);
    let length=0;const chunks=[];
    while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>1600000){await reader.cancel();return json({ok:false,error:'Request too large'},413);}chunks.push(part.value);}
    const bytes=new Uint8Array(length);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
    const body=JSON.parse(new TextDecoder().decode(bytes));
    const operation=url.pathname.split('/').pop();
    if(!['request_code','verify_code','rpc','logout','logout_all'].includes(operation))return json({ok:false,error:'Not found'},404);
    if(operation==='rpc'&&!['state','save_event','moderate_review','booking_status','video_authorize','video_library','video_settings'].includes(body.action))return json({ok:false,error:'Unknown action'},400);
    const session=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||'';
    if(['rpc','logout','logout_all'].includes(operation)&&!/^[A-Za-z0-9_-]{43}$/.test(session))return json({ok:false,error:'Sign in again.'},401);
    const payload={operation,session,email:body.email,challenge:body.challenge,code:body.code,action:body.action,payload:body.payload};
    if(operation==='rpc'&&['video_authorize','video_settings'].includes(body.action)){payload.action='video_library';payload.payload={};}
    phase='backend';
    const response=await fetch(BACKEND,{method:'POST',body:new URLSearchParams({action:'admin_gateway',payload:JSON.stringify(payload)}),redirect:'follow',signal:AbortSignal.timeout(55000)});
    if(!response.ok)throw Error('backend');
    const result=await response.json();
    if(!result.ok)return json({ok:false,error:result.error||'Unable to complete request.',...(result.retryAfter?{retryAfter:result.retryAfter}:{})},result.error==='Sign in again.'?401:400);
    if(operation==='verify_code'){
      phase='session';
      if(!/^[A-Za-z0-9_-]{43}$/.test(result.session))throw Error('session');
      phase='cookie';
      return json({ok:true},200,{'Set-Cookie':cookie(result.session,604800)});
    }
    if(operation==='logout'||operation==='logout_all')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
    if(operation==='rpc'&&body.action==='video_authorize')return json(await authorizeVideo(body.payload||{},env));
    if(operation==='rpc'&&body.action==='video_settings'){
      const p=body.payload||{};if(!slots.includes(p.slot)||!['rename','hide'].includes(p.action))return json({ok:false,error:'Invalid video selection.'},400);
      const videos=await videoConfig(env),current=videos[p.slot];
      if(p.action==='rename'&&(!current?.url||typeof p.title!=='string'||!p.title.trim()||p.title.trim().length>60))return json({ok:false,error:'Choose a published video and a title of 1–60 characters.'},400);
      await env.VIDEOS.put('settings/'+p.slot+'.json',JSON.stringify(p.action==='hide'?null:{...current,title:p.title.trim()}),{httpMetadata:{contentType:'application/json'}});
      return json({ok:true,videos:await videoConfig(env)});
    }
    if(operation==='rpc'&&body.action==='video_library'){
      const listing=await env.VIDEOS.list({prefix:'clips/',limit:100,include:['customMetadata','httpMetadata']});
      const clips=listing.objects.filter(o=>/^clips\/[a-f0-9-]{36}\.mp4$/.test(o.key)).map(o=>({id:o.key.slice(6,-4),size:o.size,url:'/api/videos/file/'+o.key.slice(6,-4)+(o.customMetadata?.format==='mov'?'.mov':'.mp4'),uploadedAt:o.uploaded})).sort((a,b)=>new Date(b.uploadedAt)-new Date(a.uploadedAt));
      return json({ok:true,clips});
    }
    delete result.session;return json(result);
  }catch{return json({ok:false,error:'Could not complete sign-in. Please try again shortly. Reference: '+phase+'.'},503);}
}
