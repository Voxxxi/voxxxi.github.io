// No privileged credentials in this module. The Edge runtime injects the adapter.
export function createAdminHandler(api) {
 const origin = 'https://voxxxi.github.io';
 return async request => {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
   'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
   'Access-Control-Allow-Methods':'POST, OPTIONS'};
  const reply = (status, body) => new Response(JSON.stringify(body),{status,headers});
  if(request.headers.get('Origin') && request.headers.get('Origin')!==origin) return reply(403,{error:'Недопустимый источник запроса.'});
  if(request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if(request.method!=='POST') return reply(405,{error:'Используйте POST.'});
  const token=request.headers.get('Authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token) return reply(401,{error:'Войдите в аккаунт владельца.'});
  let auditId;
  try {
   const caller=await api.getUser(token);
   if(!caller) return reply(401,{error:'Сессия недействительна. Войдите заново.'});
   if(await api.sessionRole(token)!=='owner') return reply(403,{error:'Это действие доступно только владельцу VOXi.'});
   if(Number(request.headers.get('Content-Length')||0)>4096) return reply(413,{error:'Слишком большой запрос.'});
   const raw=await request.text();
   if(raw.length>4096) return reply(413,{error:'Слишком большой запрос.'});
   let body; try{body=JSON.parse(raw)}catch{return reply(400,{error:'Неверный запрос.'})}
   if(!body || typeof body!=='object') return reply(400,{error:'Неверный запрос.'});
   const {action,userId}=body;
   if(!['delete_user','set_role','set_ban'].includes(action) || typeof userId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return reply(400,{error:'Укажите действие и корректный ID пользователя.'});
   if(userId.toLowerCase()===caller.id.toLowerCase() || await api.role(userId)==='owner') return reply(409,{error:'Аккаунт владельца защищён.'});
   if(!await api.targetExists(userId)) return reply(404,{error:'Пользователь уже удалён. Обновите список.'});
   if(action==='set_role' && !['client','helper','admin'].includes(body.role)) return reply(400,{error:'Недопустимая роль.'});
   if(action==='set_ban' && typeof body.banned!=='boolean')return reply(400,{error:'Укажите состояние доступа.'});
   if(body.confirmUserId!==userId) return reply(400,{error:'Подтвердите выбранный аккаунт.'});
   if(action==='delete_user' && await api.hasMedia(userId)) return reply(409,{error:'У клиента есть файлы. Сначала разберите его медиатеку; автоматическое удаление файлов отключено.'});
   auditId=await api.audit({actor_id:caller.id,target_id:userId,action,details:action==='set_role'?{role:body.role}:action==='set_ban'?{banned:body.banned}:{}});
   if(action==='delete_user') await api.deleteUser(userId);
   else if(action==='set_role')await api.setRole(userId,body.role);
   else await api.setBan(userId,body.banned);
   try{await api.auditResult(auditId,'success')}catch{console.error('VOXi audit result update failed');}
   return reply(200,{ok:true,action,userId});
  } catch {
   if(auditId) {try{await api.auditResult(auditId,'failed')}catch{}}
   return reply(500,{error:'Не удалось выполнить действие. Обновите список перед повтором. Связанные данные могут препятствовать удалению.'});
  }
 };
}
