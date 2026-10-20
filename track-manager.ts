import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
import {deleteObject} from './r2-s3.ts';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}),bucket=db.storage.from('voxi-tracks');
const checked=(r:any)=>{if(r.error)throw r.error;return r.data;};
const uuid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://voxxxi.github.io','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
async function purge(row:any){
 if(!row.storage_path.startsWith(row.user_id+'/'))throw Error('Invalid path');
 if(row.storage_provider==='r2'){
  await deleteObject(row.storage_path);
  checked(await db.rpc('voxi_r2_removed',{p_path:row.storage_path}));
 }else checked(await bucket.remove([row.storage_path]));
 checked(await db.from('voxi_tracks').delete().eq('id',row.id).not('deleted_at','is',null));
}
Deno.serve(async(req:Request)=>{
 const reply=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers});
 if(req.headers.get('Origin')&&req.headers.get('Origin')!=='https://voxxxi.github.io')return reply(403,{error:'Недопустимый источник'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'Используйте POST'});
 try{
  const raw=await req.text();if(raw.length>4096)return reply(413,{error:'Большой запрос'});const body=JSON.parse(raw);
  if(body.action==='cleanup'){
   const secret=Deno.env.get('VOXI_WEBHOOK_SECRET');if(!secret||req.headers.get('x-voxi-secret')!==secret)return reply(401,{error:'Unauthorized'});
   const now=new Date().toISOString();const rows=checked(await db.from('voxi_tracks').select('*').or('deleted_at.not.is.null,expires_at.lte.'+now).limit(50));let removed=0,failed=0;
   for(const row of rows)try{
    if(!row.deleted_at){const claimed=checked(await db.from('voxi_tracks').update({deleted_at:now}).eq('id',row.id).is('deleted_at',null).lte('expires_at',now).select('*'));if(!claimed.length)continue;Object.assign(row,claimed[0]);checked(await db.from('voxi_track_audit').insert({track_id:row.id,user_id:row.user_id,action:'expire'}));}
    await purge(row);removed++;
   }catch{failed++;}
   const abandoned=checked(await db.rpc('voxi_r2_abandoned'));
   for(const path of abandoned)try{await deleteObject(path);checked(await db.rpc('voxi_r2_removed',{p_path:path}));}catch{failed++;}
   return reply(failed?503:200,{removed,failed});
  }
  const token=req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return reply(401,{error:'Войдите заново'});
  const user=await db.auth.getUser(token);if(user.error||!user.data.user)return reply(401,{error:'Войдите заново'});
  const caller=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  if(!['owner','admin'].includes(checked(await caller.rpc('voxi_staff_session'))))return reply(403,{error:'Недостаточно прав'});
  if(body.action!=='delete'||!uuid(body.trackId)||!uuid(body.userId)||body.confirmTrackId!==body.trackId)return reply(400,{error:'Подтвердите песню и получателя'});
  const row=checked(await db.from('voxi_tracks').select('*').eq('id',body.trackId).eq('user_id',body.userId).maybeSingle());if(!row)return reply(200,{ok:true});
  checked(await db.from('voxi_track_audit').insert({track_id:row.id,user_id:row.user_id,actor_id:user.data.user.id,action:'delete'}));
  checked(await db.from('voxi_tracks').update({deleted_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',body.userId));
  await purge(row);return reply(200,{ok:true});
 }catch{return reply(503,{error:'Не удалось завершить действие. Обновите список: при начатом удалении песня уже скрыта, очистка повторится автоматически.'});}
});
