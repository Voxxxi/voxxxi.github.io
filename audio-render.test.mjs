import test from 'node:test';import assert from 'node:assert/strict';
import {renderAudio,encodeWav} from './audio-render.mjs';
const sr=44100,tone=(hz,seconds=3)=>Float32Array.from({length:sr*seconds},(_,i)=>.4*Math.sin(i*2*Math.PI*hz/sr));
const frequency=a=>{let crossings=0;for(let i=sr/2+1;i<a.length-sr/2;i++)if(a[i-1]<=0&&a[i]>0)crossings++;return crossings*sr/(a.length-sr);};
test('pitch shifts an octave without changing duration',async()=>{const r=await renderAudio([tone(440)],sr,12,1);assert.equal(r.channels[0].length,sr*3);assert.ok(Math.abs(frequency(r.channels[0])-880)<5);});
test('tempo changes duration and preserves musical pitch',async()=>{const r=await renderAudio([tone(440)],sr,0,1.25);assert.equal(r.channels[0].length,Math.ceil(sr*3/1.25));assert.ok(Math.abs(frequency(r.channels[0])-440)<5);});
test('downshift preserves stereo separation',async()=>{const r=await renderAudio([tone(440),tone(660)],sr,-12,1);assert.ok(Math.abs(frequency(r.channels[0])-220)<5);assert.ok(Math.abs(frequency(r.channels[1])-330)<5);});
test('neutral rendering preserves every sample and WAV header reports correct length',async()=>{const input=tone(440,1),r=await renderAudio([input],sr,0,1);assert.deepEqual(r.channels[0],input);const wav=encodeWav(r.channels,sr),view=new DataView(wav.buffer);assert.equal(view.getUint32(40,true),sr*2);assert.equal(view.getUint32(24,true),sr);assert.equal(view.getUint16(22,true),1);});
test('WAV encoder protects clipping; renderer rejects invalid parameters',async()=>{const wav=encodeWav([new Float32Array([2,-2])],sr);assert.equal(wav.gain,.49);assert.ok(Math.abs(new DataView(wav.buffer).getInt16(44,true))<32767);await assert.rejects(renderAudio([tone(440,1)],sr,13,1));await assert.rejects(renderAudio([tone(440,1)],sr,0,0));});
