import {renderAudio,encodeWav} from './audio-render.mjs';
self.onmessage=async({data})=>{try{const result=await renderAudio(data.channels,data.sampleRate,data.semitones,data.rate,progress=>self.postMessage({progress}));const wav=encodeWav(result.channels,result.sampleRate);self.postMessage({buffer:wav.buffer,gain:wav.gain},[wav.buffer]);}catch(e){self.postMessage({error:e.message});}};
