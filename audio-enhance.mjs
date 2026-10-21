import {encodeWav} from './audio-render.mjs';
export async function enhanceAudio(buffer,kind='mix',strength=.3){
 if(!buffer||buffer.duration>900||buffer.numberOfChannels>2||!['mix','vocal'].includes(kind)||!Number.isFinite(strength)||strength<0||strength>1)throw Error('Некорректные параметры обработки');
 const context=new OfflineAudioContext(buffer.numberOfChannels,buffer.length,buffer.sampleRate),source=context.createBufferSource();source.buffer=buffer;
 const dry=context.createGain(),wet=context.createGain();dry.gain.value=1-strength;wet.gain.value=strength;
 const filter=(type,hz,gain=0,q=.7)=>{const f=context.createBiquadFilter();f.type=type;f.frequency.value=hz;f.gain.value=gain;f.Q.value=q;return f;};
 const highpass=filter('highpass',kind==='vocal'?70:25),body=filter('peaking',280,kind==='vocal'?-1.5:-.6),presence=filter('peaking',2800,kind==='vocal'?1.2:.5),air=filter('highshelf',9500,kind==='vocal'?.8:.4),compressor=context.createDynamicsCompressor();
 compressor.threshold.value=kind==='vocal'?-22:-16;compressor.knee.value=12;compressor.ratio.value=kind==='vocal'?2:1.35;compressor.attack.value=.02;compressor.release.value=.18;
 source.connect(dry).connect(context.destination);source.connect(highpass).connect(body).connect(presence).connect(air).connect(compressor).connect(wet).connect(context.destination);source.start();const rendered=await context.startRendering();
 const channels=Array.from({length:rendered.numberOfChannels},(_,i)=>rendered.getChannelData(i));let before=0,after=0;
 for(let c=0;c<channels.length;c++){const input=buffer.getChannelData(c);for(let i=0;i<channels[c].length;i++){before+=input[i]*input[i];after+=channels[c][i]*channels[c][i];}}
 // Match average level so a louder output does not masquerade as better quality.
 const gain=after>1e-12?Math.min(2,Math.sqrt(before/after)):1;for(const channel of channels)for(let i=0;i<channel.length;i++)channel[i]*=gain;
 const encoded=encodeWav(channels,buffer.sampleRate);return new Blob([encoded.buffer],{type:'audio/wav'});
}
window.voxiEnhanceAudio=enhanceAudio;
