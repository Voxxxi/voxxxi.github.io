(()=>{
 const workers=new Set();let generation=0;
 window.voxiCancelAudioExports=()=>{generation++;for(const job of workers){job.worker.terminate();job.reject(Error('Обработка отменена.'));}workers.clear();};
 window.voxiExportAudio=async(blob,format,progress=()=>{})=>{
  if(format==='wav')return blob;
  const request=generation;let context;
  try{context=new AudioContext({sampleRate:44100});const audio=await context.decodeAudioData(await blob.arrayBuffer());if(request!==generation)throw Error('Обработка отменена.');if(audio.duration>900||audio.numberOfChannels>2)throw Error('Нужен моно- или стереофайл до 15 минут.');const channels=Array.from({length:audio.numberOfChannels},(_,i)=>audio.getChannelData(i).slice());
   return await new Promise((resolve,reject)=>{const worker=new Worker('/audio-mp3-worker.js?v=1'),job={worker,reject},timer=setTimeout(()=>finish(Error('Подготовка MP3 заняла слишком много времени. Попробуйте WAV.')),180000);workers.add(job);function finish(error,value){clearTimeout(timer);workers.delete(job);worker.terminate();if(error)reject(error);else resolve(value);}worker.onerror=()=>finish(Error('Не удалось запустить MP3-кодировщик. Можно скачать WAV.'));worker.onmessage=({data})=>{if(request!==generation){finish(Error('Обработка отменена.'));return;}if(data.error)finish(Error(data.error));else if(data.blob)finish(null,data.blob);else if(data.progress!==undefined)progress(data.progress);};worker.postMessage({channels,sampleRate:audio.sampleRate},channels.map(c=>c.buffer));});
  }finally{await context?.close();}
 };
})();
