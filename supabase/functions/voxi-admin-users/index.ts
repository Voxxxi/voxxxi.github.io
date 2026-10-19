import { createClient } from 'npm:@supabase/supabase-js@2.49.8';
import { createAdminHandler } from './admin-core.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
// Supabase provides this server-side. Its value is never read by the browser.
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const server = createClient(url,serverKey,{auth:{persistSession:false,autoRefreshToken:false}});
function checked(result:any){if(result.error) throw result.error; return result.data;}
const adapter = {
 async getUser(token:string){const {data,error}=await server.auth.getUser(token);return error?null:data.user;},
 async sessionRole(token:string){
  const caller=createClient(url,anonKey,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  return checked(await caller.rpc('voxi_staff_session'));
 },
 async role(id:string){return checked(await server.from('voxi_staff').select('role').eq('user_id',id).maybeSingle())?.role||'client';},
 async targetExists(id:string){const {data,error}=await server.auth.admin.getUserById(id);if(error?.status===404)return false;if(error)throw error;return !!data.user;},
 async hasMedia(id:string){
  const tracks=checked(await server.from('voxi_tracks').select('id').eq('user_id',id).limit(1));
  const files=checked(await server.storage.from('voxi-tracks').list(id,{limit:1}));
  const videos=checked(await server.from('voxi_videos').select('id').eq('user_id',id).limit(1));
  const videoFiles=checked(await server.storage.from('voxi-videos').list(id,{limit:1}));
  return tracks.length>0||files.length>0||videos.length>0||videoFiles.length>0;
 },
 async audit(row:any){return checked(await server.from('voxi_admin_audit').insert(row).select('id').single()).id;},
 async auditResult(id:string,status:string){checked(await server.from('voxi_admin_audit').update({status}).eq('id',id));},
 async deleteUser(id:string){checked(await server.auth.admin.deleteUser(id));},
 async setBan(id:string,banned:boolean){checked(await server.auth.admin.updateUserById(id,{ban_duration:banned?'876000h':'none'}));},
 async setRole(id:string,role:string){
  if(role==='client') checked(await server.from('voxi_staff').delete().eq('user_id',id));
  else checked(await server.from('voxi_staff').upsert({user_id:id,role,updated_at:new Date().toISOString()}));
 }
};
Deno.serve(createAdminHandler(adapter));
