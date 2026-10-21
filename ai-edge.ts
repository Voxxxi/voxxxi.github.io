import {createClient} from 'npm:@supabase/supabase-js@2.49.8';
import {operatorLanguage,operatorFacts,referenceAnswer,cleanModelAnswer,safeHealthFacts} from './ai-core.mjs';
import {approvedKnowledge} from './ai-knowledge.mjs';
import {readJsonBody} from './r2-core.mjs';
const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const checked=(r:any)=>{if(r.error)throw r.error;return r.data;};
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://voxxxi.github.io','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const configured=()=>!!Deno.env.get('VOXI_WORKERS_AI_TOKEN');
async function model(messages:any[]){
 const response=await fetch('https://api.cloudflare.com/client/v4/accounts/4a45f6c4765d1984338638f95f4f4c83/ai/run/@cf/qwen/qwen3-30b-a3b-fp8',{
  method:'POST',headers:{Authorization:'Bearer '+Deno.env.get('VOXI_WORKERS_AI_TOKEN'),'Content-Type':'application/json'},body:JSON.stringify({messages,max_tokens:512,temperature:0.2}),signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('AI unavailable');const data=await response.json();if(!data.success)throw Error('AI unavailable');return cleanModelAnswer(data.result);
}
async function pageCheck(path:string,json=false){const code=path==='/'?'home':path.includes('cabinet')?'cabinet':path.includes('admin')?'admin':'manifest';try{
 const r=await fetch('https://voxxxi.github.io'+path,{method:json?'GET':'HEAD',redirect:'error',signal:AbortSignal.timeout(12000)});let ok=r.ok;if(ok&&json){const m=await r.json();ok=!!m.name&&Array.isArray(m.icons)&&m.icons.length>=2&&m.display==='standalone';}return {check:code,ok};
 }catch{return{check:code,ok:false};}}
async function monitor(){
 const [snapshot,checks,lastResult]=await Promise.all([db.rpc('voxi_monitor_facts'),Promise.all([pageCheck('/'),pageCheck('/cabinet.html'),pageCheck('/admin.html'),pageCheck('/manifest.webmanifest',true)]),db.rpc('voxi_health_latest_service')]);
 const facts=safeHealthFacts({...checked(snapshot),checks}),last=checked(lastResult),ok=facts.checks.every((c:any)=>c.ok)&&facts.missingTracks===0&&facts.unknownSizes===0;
 const fingerprint=facts.checks.map((c:any)=>c.check+':'+Number(c.ok)).join(',')+'|missing:'+facts.missingTracks+'|unknown:'+facts.unknownSizes;
 let explanation=ok?'Проверки доступности и связей файлов пройдены. Успешная загрузка песни, установка приложения и работа на реальном телефоне проверяются отдельно.':last?.fingerprint===fingerprint?last.explanation:null;
 if(!ok&&!explanation){
  explanation='Обнаружена неполадка. Проверьте отмеченные страницы и связи файлов. Данные клиентов не изменялись.';
  if(configured()&&checked(await db.rpc('voxi_ai_monitor_claim')))try{explanation=await model([{role:'system',content:'Ты помощник владельца VOXi. По обезличенным кодам проверки кратко по-русски объясни возможную причину и безопасный первый шаг. Это наблюдение, не доказательство точной причины. Не утверждай, что исправил сайт. Не предлагай удалять данные или отключать защиту. Никаких персональных данных. /no_think'},{role:'user',content:JSON.stringify(facts)}])||explanation;}catch{}
 }
 checked(await db.rpc('voxi_health_save',{p_ok:ok,p_fingerprint:fingerprint,p_facts:facts,p_explanation:explanation}));return{ok};
}
Deno.serve(async(req:Request)=>{
 const reply=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers});
 if(req.headers.get('Origin')&&req.headers.get('Origin')!=='https://voxxxi.github.io')return reply(403,{error:'Недопустимый источник'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{error:'Используйте POST'});
 try{
  const body=await readJsonBody(req);
  if(body.action==='monitor'){
   const secret=Deno.env.get('VOXI_WEBHOOK_SECRET');if(!secret||req.headers.get('x-voxi-secret')!==secret)return reply(401,{error:'Unauthorized'});
   return reply(200,await monitor());
  }
  const token=req.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!token)return reply(401,{error:'Войдите в аккаунт, чтобы написать ИИ-помощнику'});
  const auth=await db.auth.getUser(token);if(auth.error||!auth.data.user)return reply(401,{error:'Войдите заново'});
  const caller=createClient(url,anon,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  // A harmless RLS query verifies the live session, even when AI quota is exhausted.
  const active=checked(await caller.rpc('voxi_ai_session_active'));if(!active)return reply(401,{error:'Войдите заново'});
  let question=String(body.message||'').trim().slice(0,1000),parent:any=null;
  if(body.action==='community'){
   if(typeof body.messageId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.messageId))return reply(400,{error:'Выберите сообщение'});
   parent=checked(await caller.from('voxi_chat_messages').select('id,user_id,body,created_at').eq('id',body.messageId).eq('user_id',auth.data.user.id).maybeSingle());
   if(!parent||Date.now()-new Date(parent.created_at).getTime()>300000||!/(?:^|\s)@?(?:voxi|вокси)(?=$|\s|[,.!?])/i.test(parent.body))return reply(400,{error:'В общем чате обратитесь к @VOXi'});
   const existing=checked(await caller.from('voxi_ai_replies').select('body,kind').eq('message_id',parent.id).maybeSingle());if(existing)return reply(200,existing);
   question=parent.body;
  }else if(body.action!=='chat')return reply(400,{error:'Неизвестное действие'});
  if(!question)return reply(400,{error:'Напишите вопрос'});
  const lang=operatorLanguage(question,body.language),fallback=referenceAnswer(question,lang);
  const knowledgeRows=checked(await db.from('voxi_ai_knowledge').select('question,answer,language,active').eq('active',true).eq('language',lang).order('created_at',{ascending:false}).limit(100));
  const knowledge=approvedKnowledge(knowledgeRows,question,lang);let answer=knowledge.exact||fallback,kind='reference';
  if(!knowledge.exact&&configured()&&checked(await caller.rpc('voxi_ai_claim')))try{
   const history=body.action==='chat'&&Array.isArray(body.history)?body.history.slice(-4).filter((m:any)=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').map((m:any)=>({role:m.role,content:m.content.slice(0,700)})):[];
   const generated=await model([{role:'system',content:operatorFacts+knowledge.context+'\nЯзык ответа: '+(lang==='kk'?'казахский':'русский')},...history,{role:'user',content:question+' /no_think'}]);if(generated){answer=generated;kind='ai';}
  }catch{}
  if(parent){
   // No profile data or other messages are sent to the model. The answer is
   // attached only to the requester's existing public message.
   checked(await db.from('voxi_ai_replies').upsert({message_id:parent.id,body:answer,kind},{onConflict:'message_id',ignoreDuplicates:true}));
  }
  return reply(200,{body:answer,kind,language:lang});
 }catch{return reply(503,{error:'Помощник временно недоступен. Напишите в WhatsApp или повторите позже.'});}
});
