// Direct, self-hosted ambient footage. No third-party player, scripts or advertising.
(()=>{
 window.voxiCreateConcert=({host,onFallback,onState})=>{
  let active=true,playing=false,manuallyPaused=false;
  const autoplay=!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!navigator.connection?.saveData;
  let wantsPlay=autoplay;
  const video=document.createElement('video');
  video.muted=true;video.defaultMuted=true;video.volume=0;video.loop=true;video.playsInline=true;video.controls=false;
  video.setAttribute('muted','');video.setAttribute('playsinline','');video.setAttribute('aria-label','Певица VOXi · студийное видео без звука');
  video.preload=autoplay?'metadata':'none';video.autoplay=autoplay;video.poster='media/singer-poster.jpg';video.src='media/singer-loop.mp4';
  host.append(video);
  const timer=setTimeout(()=>{if(active&&video.readyState<2)fail();},25000);
  function fail(){if(!active)return;stop();onFallback();}
  function stop(){if(!active)return;active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);video.pause();video.removeAttribute('src');video.load();host.replaceChildren();}
  function play(){
   if(!active)return;wantsPlay=true;manuallyPaused=false;video.muted=true;video.volume=0;
   if(!document.hidden)Promise.resolve(video.play()).catch(()=>{if(active){playing=false;wantsPlay=false;onState(false);}});
  }
  function visibility(){if(document.hidden)video.pause();else if(wantsPlay&&!manuallyPaused)play();}
  video.addEventListener('loadeddata',()=>{if(active)clearTimeout(timer);});
  video.addEventListener('playing',()=>{if(!active)return;clearTimeout(timer);playing=true;video.muted=true;video.volume=0;onState(true);});
  video.addEventListener('pause',()=>{if(active){playing=false;onState(false);}});
  video.addEventListener('error',fail);
  document.addEventListener('visibilitychange',visibility);onState(false);
  if(autoplay)play();
  return {destroy:stop,toggle(){if(playing||wantsPlay){manuallyPaused=true;wantsPlay=false;video.pause();playing=false;onState(false);}else play();}};
 };
})();
