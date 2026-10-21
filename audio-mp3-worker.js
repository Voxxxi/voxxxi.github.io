/* Standalone LGPL encoder: vendor/lame-LICENSE.txt and vendor/lame-SOURCE.txt. */
importScripts('/vendor/lame-1.2.1.min.js');
self.onmessage=({data})=>{try{
 const {channels,sampleRate}=data;if(!Array.isArray(channels)||channels.length<1||channels.length>2||!channels[0]?.length||![32000,44100,48000].includes(sampleRate))throw Error('Unsupported audio');
 const encoder=new lamejs.Mp3Encoder(channels.length,sampleRate,320),chunks=[];
 const pcm=(channel,start,end)=>{const out=new Int16Array(end-start);for(let j=start;j<end;j++){const value=Math.max(-1,Math.min(1,channel[j]));out[j-start]=Math.round(value*(value<0?32768:32767));}return out;};
 for(let i=0;i<channels[0].length;i+=1152){const end=Math.min(i+1152,channels[0].length),left=pcm(channels[0],i,end),right=channels[1]?pcm(channels[1],i,end):undefined;const encoded=encoder.encodeBuffer(left,right);if(encoded.length)chunks.push(new Int8Array(encoded));if(i%(1152*100)===0)postMessage({progress:Math.round(i/channels[0].length*100)});}
 const tail=encoder.flush();if(tail.length)chunks.push(new Int8Array(tail));postMessage({blob:new Blob(chunks,{type:'audio/mpeg'})});
}catch{postMessage({error:'Не удалось подготовить MP3. Попробуйте WAV.'});}};
