/* Local audio analysis only: no microphone access and no audio transmission. */
(()=>{
 const audio=document.getElementById('audio'),bars=document.getElementById('bars'),root=document.querySelector('[aria-label="Музыкальный плеер"]');
 if(!audio||!bars||!root)return;
 const items=[...bars.children],rest=items.map(el=>el.style.height),reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
 let context=null,source=null,analyser=null,data=null,frame=0,last=0,visible=true,failed=false;
 const stop=()=>{if(frame)cancelAnimationFrame(frame);frame=0;root.classList.remove('voxi-sounding');};
 function reset(){stop();items.forEach((el,i)=>{el.style.height=rest[i];el.style.removeProperty('--wave-light');});}
 function allowed(){return !audio.paused&&!audio.ended&&!document.hidden&&visible&&!reduce.matches&&analyser&&context?.state==='running';}
 function draw(now){
  frame=0;if(!allowed()){stop();return;}
  if(now-last>=33){last=now;analyser.getByteFrequencyData(data);let energy=0;
   const maxHeight=Math.max(18,bars.clientHeight-8),half=Math.ceil(items.length/2);
   items.forEach((el,i)=>{
    const distance=Math.abs(i-(items.length-1)/2)/half;
    const bin=Math.min(data.length-1,Math.max(1,Math.floor(Math.pow(distance,1.8)*data.length*.55)));
    const level=(data[bin]+data[Math.min(bin+1,data.length-1)])/510;energy+=level;
    el.style.height=(4+level*maxHeight*(.55+.45*(1-distance))).toFixed(1)+'px';
    el.style.setProperty('--wave-light',(.75+level*.8).toFixed(2));
   });
   root.classList.toggle('voxi-sounding',energy/items.length>.07);
  }
  frame=requestAnimationFrame(draw);
 }
 function sync(){if(allowed()){bars.classList.add('live-wave');if(!frame)frame=requestAnimationFrame(draw);}else stop();}
 async function prepare(){
  if(reduce.matches||failed)return;
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){failed=true;return;}
  try{
   if(!context){
    context=new Audio();
    source=context.createMediaElementSource(audio);
    source.connect(context.destination);
    analyser=context.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.78;
    source.connect(analyser);data=new Uint8Array(analyser.frequencyBinCount);
   }
   if(context.state==='suspended')await context.resume();
   bars.classList.add('live-wave');sync();
  }catch{failed=true;root.classList.remove('voxi-sounding');}
 }
 window.voxiPlayerVisual={prepare};
 audio.addEventListener('playing',sync);audio.addEventListener('play',sync);
 for(const event of ['pause','ended','waiting','stalled'])audio.addEventListener(event,stop);
 audio.addEventListener('emptied',reset);
 document.addEventListener('visibilitychange',sync);
 reduce.addEventListener?.('change',()=>{if(reduce.matches)reset();else sync();});
 if(window.IntersectionObserver)new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;sync();},{threshold:0}).observe(root);
 window.addEventListener('pagehide',stop);
})();

