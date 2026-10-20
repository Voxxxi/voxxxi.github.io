// Keys stay in Edge Function secrets. No direct R2 write URL is issued.
window.voxiR2Call=async function(client,body,uploadId){
 let timer,result;
 try{result=await Promise.race([client.functions.invoke('voxi-r2',{body,headers:uploadId?{'x-voxi-upload':uploadId}:undefined}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Нет ответа R2. Проверьте список песен перед повторной загрузкой.')),uploadId?120000:30000);})]);}finally{clearTimeout(timer);}
 const {data,error}=result;
 if(error||data?.error)throw Error(data?.error||'Не удалось выполнить действие в R2. Проверьте список песен перед повторной загрузкой.');
 return data;
};
window.voxiTrackUrl=async function(client,track,download=false){
 if(track.storage_provider==='r2')return window.voxiR2Call(client,{action:'read',trackId:track.id,download});
 const {data,error}=await client.storage.from('voxi-tracks').createSignedUrl(track.storage_path,900,download?{download:track.file_name}:undefined);
 if(error)throw error;return data;
};
window.voxiUploadR2Track=async function({client,userId,file,title,expiresAt,bookingId,bookingSongNumber,actorStillCurrent,info}){
 const {data:{session}}=await client.auth.getSession();
 if(!session?.user?.id||!actorStillCurrent())throw Error('Войдите заново');
 const pendingKey='voxi-r2-upload:'+session.user.id+':'+userId;
 const saved=sessionStorage.getItem(pendingKey);
 if(saved){const state=await client.rpc('voxi_r2_pending',{p_id:saved});if(state.error)throw Error('Не удалось проверить предыдущую загрузку.');
  if(state.data==='removed')sessionStorage.removeItem(pendingKey);
  else try{await window.voxiR2Call(client,{action:'finalize',uploadId:saved});sessionStorage.removeItem(pendingKey);return {title,recovered:true};}catch{throw Error('Предыдущая загрузка не подтверждена. Обновите список песен. Незавершённый файл очистится в течение нескольких часов; не загружайте его повторно сейчас.');}}
 const prepared=await window.voxiR2Call(client,{action:'prepare',userId,bytes:file.size,title,fileName:file.name.slice(0,255),contentType:info.contentType,bookingId,songSlot:bookingSongNumber,expiresAt});
 sessionStorage.setItem(pendingKey,prepared.uploadId);
 if(!actorStillCurrent())throw Error('Аккаунт изменился во время загрузки.');
 try{const result=await window.voxiR2Call(client,file.slice(0,file.size,info.contentType),prepared.uploadId);sessionStorage.removeItem(pendingKey);return {...result,title};}
 catch{try{const result=await window.voxiR2Call(client,{action:'finalize',uploadId:prepared.uploadId});sessionStorage.removeItem(pendingKey);return {...result,title};}catch{throw Error('Загрузка не подтверждена. Обновите песни клиента; повторная попытка сначала проверит эту же загрузку.');}}
};
