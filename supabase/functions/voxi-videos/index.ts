import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
import {createVideoHandler,VIDEO_LIMIT} from './video-core.mjs';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const server=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket=server.storage.from('voxi-videos');
const checked=(r:any)=>{if(r.error)throw r.error;return r.data;};
const caller=(token:string)=>createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
async function previews(rows:any[]){
 const valid=rows.filter(v=>['pending','approved','rejected'].includes(v.status));
 const links=valid.length?checked(await bucket.createSignedUrls(valid.map(v=>v.storage_path),900)):[];
 const paths=new Map(links.map((l:any)=>[l.path,l.error?null:l.signedUrl]));
 return rows.map(v=>({id:v.id,userId:v.user_id,title:v.title,description:v.description,name:v.display_name,status:v.status,createdAt:v.created_at,duration:v.duration_seconds,reason:v.review_reason,previewUrl:paths.get(v.storage_path)||null}));
}
const adapter={
 now:()=>Date.now(),
 async user(token:string){const {data,error}=await server.auth.getUser(token);return error?null:data.user;},
 async sessionActive(token:string){return checked(await caller(token).rpc('voxi_active_session'))===true;},
 async staffRole(token:string){return checked(await caller(token).rpc('voxi_staff_session'));},
 async profile(id:string){return checked(await server.from('voxi_profiles').select('full_name,phone').eq('user_id',id).maybeSingle());},
 async previous(id:string,request:string){return checked(await server.from('voxi_videos').select('*').eq('user_id',id).eq('client_request_id',request).maybeSingle());},
 async owned(id:string,video:string){return checked(await server.from('voxi_videos').select('*').eq('user_id',id).eq('id',video).maybeSingle());},
 async verifyCaptcha(token:string){
  const secret=Deno.env.get('VOXI_TURNSTILE_SECRET');if(!secret)throw Error('Captcha not configured');
  const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:token}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('Captcha unavailable');return await response.json();
 },
 async reserve(args:any){const value=checked(await server.rpc('voxi_begin_video',args));return Array.isArray(value)?value[0]:value;},
 async uploadTicket(v:any){const data=checked(await bucket.createSignedUploadUrl(v.storage_path,{upsert:false}));return {videoId:v.id,path:v.storage_path,token:data.token};},
 async file(v:any){
  const name=v.storage_path.split('/').pop();
  const files=checked(await bucket.list(v.user_id,{search:name,limit:100}));const file=files.find((f:any)=>f.name===name);
  if(!file)return null;
  if(Number(file.metadata?.size)>VIDEO_LIMIT)throw Error('File too large');
  const blob=checked(await bucket.download(v.storage_path));if(blob.size>VIDEO_LIMIT)throw Error('File too large');
  return {size:Number(file.metadata?.size),mime:String(file.metadata?.mimetype||blob.type),bytes:new Uint8Array(await blob.arrayBuffer())};
 },
 async invalidate(v:any){checked(await server.from('voxi_videos').update({status:'error',review_reason:'Файл не прошёл техническую проверку.'}).eq('id',v.id).eq('status','uploading'));checked(await bucket.remove([v.storage_path]));},
 async complete(user:string,video:string,duration:number){return checked(await server.rpc('voxi_complete_video',{p_user:user,p_video:video,p_duration:duration}));},
 async mine(id:string){return await previews(checked(await server.from('voxi_videos').select('*').eq('user_id',id).order('created_at',{ascending:false}).limit(100)));},
 async queue(all:boolean){let query=server.from('voxi_videos').select('*');query=all?query.in('status',['pending','approved','rejected']):query.eq('status','pending');return await previews(checked(await query.order('created_at',{ascending:!all}).limit(100)));},
 async feed(){
  const rows=checked(await server.rpc('voxi_video_feed'))||[];
  const links=rows.length?checked(await bucket.createSignedUrls(rows.map((v:any)=>v.storage_path),600)):[];
  const paths=new Map(links.map((l:any)=>[l.path,l.error?null:l.signedUrl]));
  return rows.filter((v:any)=>paths.get(v.storage_path)).map((v:any)=>({id:v.id,title:v.title,description:v.description,name:v.display_name,likes:Number(v.likes),url:paths.get(v.storage_path)}));
 }
};
Deno.serve(createVideoHandler(adapter));
