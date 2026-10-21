(()=>{
 window.voxiAudioDrop=function(input,onDrop,enabled=()=>!input.disabled){
  const zone=document.createElement('div');zone.className='voxi-audio-drop';zone.tabIndex=0;zone.setAttribute('role','button');zone.setAttribute('aria-label','Перетащите аудиофайл или нажмите, чтобы выбрать');
  const title=document.createElement('strong'),hint=document.createElement('span'),name=document.createElement('small');title.textContent='Перетащите песню сюда';hint.textContent='или нажмите, чтобы выбрать из папки';name.setAttribute('aria-live','polite');zone.append(title,hint,name);input.before(zone);
  const choose=()=>{if(enabled())input.click();};zone.addEventListener('click',choose);zone.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();choose();}});
  zone.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();if(enabled()){zone.classList.add('is-dragging');if(e.dataTransfer)e.dataTransfer.dropEffect='copy';}});
  zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('is-dragging');});
  zone.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();zone.classList.remove('is-dragging');if(!enabled())return;const f=e.dataTransfer?.files?.[0];if(!f)return;if(!f.type.startsWith('audio/')&&!/\.(mp3|wav|flac|m4a|aac|ogg|opus|aif|aiff)$/i.test(f.name)){name.textContent='Выберите аудиофайл: MP3, WAV, FLAC или M4A.';return;}input.value='';name.textContent=f.name;onDrop(f);});
  input.addEventListener('change',()=>{name.textContent=input.files?.[0]?.name||'';});return zone;
 };
})();
