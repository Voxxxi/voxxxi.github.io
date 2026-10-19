// Private studio tracks. Only staff with directory access see this upload flow.
async function voxiTrackFileInfo(file){
 const max=50*1024*1024;
 if(!file||file.size<1||file.size>max)throw Error('Выберите аудиофайл размером до 50 МБ.');
 const extension=file.name.split('.').pop().toLowerCase();
 const types={mp3:'audio/mpeg',wav:'audio/wav',m4a:'audio/mp4',ogg:'audio/ogg',flac:'audio/flac'};
 if(!types[extension])throw Error('Поддерживаются MP3, WAV, M4A, OGG и FLAC.');
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const text=String.fromCharCode(...bytes);
 const valid=extension==='mp3'?(text.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224)):
  extension==='wav'?text.startsWith('RIFF')&&text.slice(8,12)==='WAVE':
  extension==='m4a'?text.slice(4,8)==='ftyp':extension==='ogg'?text.startsWith('OggS'):text.startsWith('fLaC');
 if(!valid)throw Error('Содержимое файла не соответствует формату аудио.');
 return {extension,contentType:types[extension]};
}
async function voxiUploadPrivateTrack({client,userId,file,title,actorStillCurrent}){
 const info=await voxiTrackFileInfo(file);
 title=String(title||'').trim();if(!title||title.length>200)throw Error('Укажите название песни длиной до 200 символов.');
 if(!/^[0-9a-f-]{36}$/i.test(userId))throw Error('Не выбран аккаунт клиента.');
 if(!actorStillCurrent())throw Error('Аккаунт изменился. Откройте загрузку заново.');
 const path=userId+'/'+crypto.randomUUID()+'.'+info.extension;
 const bucket=client.storage.from('voxi-tracks');let stored=false,metadataAttempted=false,insertRejected=false;
 try{
  const payload=file.slice(0,file.size,info.contentType);
  const {error}=await bucket.upload(path,payload,{contentType:info.contentType,upsert:false,cacheControl:'0'});if(error)throw error;stored=true;
  if(!actorStillCurrent())throw Error('Аккаунт изменился во время загрузки.');
  const latest=await client.from('voxi_tracks').select('song_number').eq('user_id',userId).order('song_number',{ascending:false}).limit(1);
  if(latest.error)throw latest.error;
  const songNumber=Number(latest.data?.[0]?.song_number||0)+1;
  if(!actorStillCurrent())throw Error('Аккаунт изменился во время загрузки.');
  metadataAttempted=true;
  const result=await client.from('voxi_tracks').insert({user_id:userId,song_number:songNumber,song_title:title,storage_path:path,file_name:file.name.slice(0,255),file_size:file.size});
  if(result.error){insertRejected=/^[0-9A-Z]{5}$/.test(result.error.code||'');throw result.error;}
  return {path,title};
 }catch(error){
  if(metadataAttempted&&!insertRejected){
   let saved;try{saved=await client.from('voxi_tracks').select('id').eq('storage_path',path).maybeSingle();}catch{throw Error('Не удалось подтвердить сохранение. Проверьте кабинет клиента перед повторной загрузкой.');}
   if(saved.error)throw Error('Не удалось подтвердить сохранение. Проверьте кабинет клиента перед повторной загрузкой.');
   if(saved.data)return {path,title};
   throw Error('Не удалось подтвердить сохранение. Проверьте кабинет клиента перед повторной загрузкой.');
  }
  if(stored){try{const removed=await bucket.remove([path]);if(removed.error)throw removed.error;}catch{throw Error('Не удалось сохранить песню в кабинет и очистить загруженный файл. Не повторяйте загрузку до проверки хранилища.');}}
  throw error;
 }
}
