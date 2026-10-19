window.voxiLoadClientSongs=async function({client,userId,box,make,ru,isCurrent,refresh}){
 const retry=()=>{const b=make('button',ru?'Обновить список':'Тізімді жаңарту','cabinetExit');b.type='button';b.addEventListener('click',refresh);return b;};
 box.appendChild(make('p',ru?'Загружаем ваши песни…':'Әндеріңіз жүктелуде…'));
 try{
  const {data:tracks,error}=await client.from('voxi_tracks').select('id,song_title,storage_path,file_name,file_size,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(100);
  if(error)throw error;if(!isCurrent())return;box.replaceChildren();
  if(!tracks?.length){box.appendChild(make('p',ru?'Студия ещё не добавила готовые песни в ваш кабинет.':'Дайын әндер әзірге жүктелмеген.'));box.appendChild(retry());return;}
  const valid=tracks.filter(t=>t.storage_path.startsWith(userId+'/'));
  if(valid.length!==tracks.length)box.appendChild(make('p',ru?'Часть файлов недоступна. Обратитесь в студию.':'Кейбір файлдар қолжетімсіз. Студияға хабарласыңыз.'));
  const signed=valid.length?await client.storage.from('voxi-tracks').createSignedUrls(valid.map(t=>t.storage_path),3600):{data:[],error:null};
  if(signed.error)throw signed.error;if(!isCurrent())return;
  const urls=new Map(signed.data.map(item=>[item.path,item]));
  for(const track of valid){
   const card=make('article','','cabinet-record');card.appendChild(make('strong',track.song_title));
   const item=urls.get(track.storage_path);
   if(item?.signedUrl&&!item.error){
    const player=document.createElement('audio');player.controls=true;player.preload='none';player.src=item.signedUrl;player.style.width='100%';player.setAttribute('aria-label',track.song_title);card.appendChild(player);
    player.addEventListener('play',()=>{box.querySelectorAll('audio').forEach(other=>{if(other!==player)other.pause();});});
    player.addEventListener('error',()=>{if(!card.querySelector('.song-play-error'))card.appendChild(make('p',ru?'Не удалось воспроизвести файл. Обновите список или скачайте песню.':'Файл ойнатылмады. Тізімді жаңартыңыз немесе әнді жүктеп алыңыз.','song-play-error'));});
    const download=make('button',ru?'Скачать песню':'Әнді жүктеп алу','cabinetExit');download.type='button';
    download.addEventListener('click',async()=>{
     if(!isCurrent())return;download.disabled=true;
     try{const {data,error}=await client.storage.from('voxi-tracks').createSignedUrl(track.storage_path,3600,{download:track.file_name});if(error)throw error;if(!isCurrent())return;
      const link=document.createElement('a');link.href=data.signedUrl;link.download=track.file_name;link.rel='noopener';document.body.appendChild(link);link.click();link.remove();
     }catch{if(isCurrent())card.appendChild(make('p',ru?'Не удалось скачать песню. Попробуйте ещё раз.':'Ән жүктелмеді. Қайта көріңіз.'));}finally{download.disabled=false;}
    });card.appendChild(download);
   }else card.appendChild(make('p',ru?'Файл временно недоступен. Обратитесь в студию.':'Файл уақытша қолжетімсіз. Студияға хабарласыңыз.'));
   box.appendChild(card);
  }
  if(tracks.length===100)box.appendChild(make('p',ru?'Показаны последние 100 песен. За более ранними записями обратитесь в студию.':'Соңғы 100 ән көрсетілді. Бұрынғы жазбалар үшін студияға хабарласыңыз.'));
  box.appendChild(retry());
 }catch(error){if(!isCurrent())return;box.replaceChildren();box.appendChild(make('p',(ru?'Не удалось загрузить песни: ':'Әндерді жүктеу мүмкін болмады: ')+(error.message||'Ошибка сервера')));box.appendChild(retry());}
};
