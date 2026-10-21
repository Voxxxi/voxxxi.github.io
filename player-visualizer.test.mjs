import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./player-visualizer.js',import.meta.url),'utf8');
function fixture(reduced=false){
 const classes=()=>{const values=new Set();return {add:x=>values.add(x),remove:x=>values.delete(x),toggle:(x,on)=>on?values.add(x):values.delete(x),has:x=>values.has(x)};};
 const style=()=>({height:'20px',setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}});
 const items=Array.from({length:8},()=>({style:style()})),bars={children:items,classList:classes(),clientHeight:83},root={classList:classes()};
 const events={},audio={paused:true,ended:false,addEventListener:(name,fn)=>events[name]=fn},frames=new Map();let next=1,contexts=0,sources=0,intersection;
 class Context{constructor(){contexts++;this.state='suspended';this.destination={};}createMediaElementSource(){sources++;return {connect(){}};}createAnalyser(){return {frequencyBinCount:256,connect(){},getByteFrequencyData(a){a.fill(180);}};}async resume(){this.state='running';}}
 const ctx={Uint8Array,window:{AudioContext:Context,matchMedia:()=>({matches:reduced,addEventListener(){}}),addEventListener(){},IntersectionObserver:class{constructor(f){intersection=f;}observe(){}}},
 document:{hidden:false,getElementById:id=>id==='audio'?audio:bars,querySelector:()=>root,addEventListener(){}},
 requestAnimationFrame:f=>{const id=next++;frames.set(id,f);return id;},cancelAnimationFrame:id=>frames.delete(id)};
 ctx.IntersectionObserver=ctx.window.IntersectionObserver;vm.createContext(ctx);vm.runInContext(source,ctx);
 return {ctx,audio,events,frames,root,items,prepare:()=>ctx.window.voxiPlayerVisual.prepare(),counts:()=>({contexts,sources}),out:()=>intersection([{isIntersecting:false}])};
}
test('wave is driven by analyser data and freezes on pause',async()=>{
 const f=fixture();await f.prepare();f.audio.paused=false;f.events.playing();assert.equal(f.frames.size,1);
 const [id,frame]=f.frames.entries().next().value;f.frames.delete(id);frame(40);assert.notEqual(f.items[0].style.height,'20px');assert.equal(f.root.classList.has('voxi-sounding'),true);
 f.audio.paused=true;f.events.pause();assert.equal(f.frames.size,0);assert.equal(f.root.classList.has('voxi-sounding'),false);
 await f.prepare();assert.deepEqual(f.counts(),{contexts:1,sources:1});
});
test('reduced motion never creates an audio analysis context',async()=>{const f=fixture(true);await f.prepare();f.audio.paused=false;f.events.playing();assert.equal(f.frames.size,0);assert.deepEqual(f.counts(),{contexts:0,sources:0});});
test('offscreen visualizer stops rendering without pausing the song',async()=>{const f=fixture();await f.prepare();f.audio.paused=false;f.events.playing();f.out();assert.equal(f.frames.size,0);assert.equal(f.audio.paused,false);});

