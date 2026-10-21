import {RawSignalsmithStretch} from './vendor/SignalsmithStretch.mjs';
// Offline rendering follows the upstream buffer-mode worklet's latency compensation.
export async function renderAudio(channels,sampleRate,semitones,rate,onProgress=()=>{}){
 if(!channels.length||channels.length>2||!channels[0].length||!channels.every(c=>c.length===channels[0].length)||sampleRate<8000||sampleRate>192000||!Number.isFinite(semitones)||Math.abs(semitones)>12||!Number.isFinite(rate)||rate<.5||rate>1.5)throw Error('Некорректные параметры аудио');
 const length=Math.ceil(channels[0].length/rate),output=channels.map(()=>new Float32Array(length));
 if(semitones===0&&rate===1){channels.forEach((c,i)=>output[i].set(c));return {channels:output,sampleRate};}
 const wasm=await RawSignalsmithStretch();wasm._presetDefault(channels.length,sampleRate);wasm._setTransposeSemitones(semitones,8000/sampleRate);wasm._setFormantSemitones(0,false);
 const inputLatency=wasm._inputLatency(),outputLatency=wasm._outputLatency(),blockLength=inputLatency+outputLatency,ptr=wasm._setBuffers(channels.length,blockLength),block=128;
 for(let pos=0;pos<length;pos+=block){
  const count=Math.min(block,length-pos),end=Math.round((pos+outputLatency)*rate+inputLatency),start=end-blockLength;
  for(let c=0;c<channels.length;c++){const target=new Float32Array(wasm.HEAP8.buffer,ptr+c*blockLength*4,blockLength);target.fill(0);const a=Math.max(0,start),b=Math.min(channels[c].length,end);if(b>a)target.set(channels[c].subarray(a,b),a-start);}
  wasm._seek(blockLength,rate);wasm._process(0,count);
  for(let c=0;c<channels.length;c++)output[c].set(new Float32Array(wasm.HEAP8.buffer,ptr+(c+channels.length)*blockLength*4,count),pos);
  if(pos%(128*256)===0)onProgress(Math.round(pos/length*100));
 }
 return {channels:output,sampleRate};
}
export function encodeWav(channels,sampleRate){
 const frames=channels[0].length,n=channels.length,buffer=new ArrayBuffer(44+frames*n*2),v=new DataView(buffer);const str=(p,s)=>{for(let i=0;i<s.length;i++)v.setUint8(p+i,s.charCodeAt(i));};
 str(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,n,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*n*2,true);v.setUint16(32,n*2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,frames*n*2,true);
 let peak=0;for(const c of channels)for(let i=0;i<c.length;i++)peak=Math.max(peak,Math.abs(c[i]));const gain=peak>.98?.98/peak:1;
 let offset=44;for(let i=0;i<frames;i++)for(let c=0;c<n;c++){const x=Math.max(-1,Math.min(1,channels[c][i]*gain));v.setInt16(offset,Math.round(x*(x<0?32768:32767)),true);offset+=2;}
 return {buffer,gain};
}
