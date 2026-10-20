// Official GAKKU TV embed; the concert remains hosted by its publisher.
(()=>{
 let api;
 function youtube(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(api)return api;
  api=new Promise((resolve,reject)=>{
   const previous=window.onYouTubeIframeAPIReady;
   window.onYouTubeIframeAPIReady=()=>{try{previous?.();}finally{resolve(window.YT);}};
   const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
   script.onerror=()=>{api=null;reject(Error('YouTube unavailable'));};document.head.append(script);
  });return api;
 }
 window.voxiCreateConcert=({host,onFallback,onState})=>{
  let active=true,player=null,ready=false,playing=false,manuallyPaused=false;
  const autoplay=!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&!navigator.connection?.saveData;
  let wantsPlay=autoplay;
  const timer=setTimeout(fail,25000);
  function fail(){if(!active)return;stop();onFallback();}
  function stop(){active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);player?.destroy();host.replaceChildren();}
  function play(){wantsPlay=true;manuallyPaused=false;if(ready&&!document.hidden){player.mute();player.setVolume(0);player.playVideo();}}
  function visibility(){if(!ready)return;if(document.hidden)player.pauseVideo();else if(wantsPlay&&!manuallyPaused)play();}
  document.addEventListener('visibilitychange',visibility);
  youtube().then(YT=>{
   if(!active)return;
   const mount=document.createElement('div');host.append(mount);
   player=new YT.Player(mount,{host:'https://www.youtube-nocookie.com',videoId:'zMNBglg7-Vg',width:'100%',height:'100%',
    playerVars:{autoplay:0,mute:1,controls:0,disablekb:1,fs:0,playsinline:1,loop:1,playlist:'zMNBglg7-Vg',rel:0,origin:location.origin},
    events:{
     onReady(event){if(!active)return;ready=true;clearTimeout(timer);const frame=event.target.getIframe();frame.title='Gakku Дауысы 2017 — Димаш Құдайбергенов';frame.referrerPolicy='strict-origin-when-cross-origin';event.target.mute();event.target.setVolume(0);onState(false);if(wantsPlay)play();},
     onStateChange(event){if(!active)return;playing=event.data===1;if(playing){event.target.mute();event.target.setVolume(0);}onState(playing);if(event.data===0&&wantsPlay&&!manuallyPaused&&!document.hidden){event.target.seekTo(0,true);play();}},
     onAutoplayBlocked(){if(!active)return;playing=false;onState(false);},
     onError:fail
    }
   });
  }).catch(fail);
  return{destroy:stop,toggle(){if(playing||wantsPlay&&!ready){manuallyPaused=true;wantsPlay=false;if(ready)player.pauseVideo();onState(false);}else play();}};
 };
})();
