import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../concert-loop.js',import.meta.url),'utf8');
function fixture({reduce=false,saveData=false}={}){
 const handlers={},timers=new Map(),states=[];let fallback=0,element;
 class Video{constructor(){this.events={};this.paused=true;this.readyState=3;this.plays=0;}setAttribute(){}addEventListener(n,f){this.events[n]=f;}pause(){this.paused=true;this.events.pause?.();}play(){this.paused=false;this.plays++;this.events.playing?.();return Promise.resolve();}load(){}removeAttribute(n){delete this[n];}}
 const host={children:[],append(e){element=e;this.children.push(e);},replaceChildren(){this.children=[];}};
 const document={hidden:false,createElement:()=>new Video(),addEventListener:(n,f)=>handlers[n]=f,removeEventListener:n=>delete handlers[n]};
 const context={Promise,window:{matchMedia:()=>({matches:reduce})},navigator:{connection:{saveData}},document,setTimeout:f=>{timers.set(1,f);return 1;},clearTimeout:n=>timers.delete(n)};
 vm.createContext(context);vm.runInContext(source,context);
 const api=context.window.voxiCreateConcert({host,onFallback:()=>fallback++,onState:x=>states.push(x)});
 return {api,host,video:element,states,document,handlers,timers,fallback:()=>fallback};
}
test('ambient video uses self-hosted silent looping media without third-party player',()=>{const f=fixture();assert.equal(f.video.src,'media/forest-river.mp4');assert.equal(f.video.muted,true);assert.equal(f.video.volume,0);assert.equal(f.video.loop,true);assert.equal(f.video.playsInline,true);assert.equal(f.video.controls,false);assert.equal(f.video.plays,1);assert.equal(f.states.at(-1),true);assert.doesNotMatch(source,/youtube|iframe_api|YT\.Player/i);});
test('reduced motion disables autoplay and still allows an explicit start',()=>{const f=fixture({reduce:true});assert.equal(f.video.plays,0);f.api.toggle();assert.equal(f.video.plays,1);assert.equal(f.video.muted,true);});
test('saveData disables automatic video transfer until the user starts it',()=>{const f=fixture({saveData:true});assert.equal(f.video.preload,'none');assert.equal(f.video.plays,0);f.api.toggle();assert.equal(f.video.plays,1);});
test('manual pause survives visibility changes',()=>{const f=fixture();f.api.toggle();f.document.hidden=true;f.handlers.visibilitychange();f.document.hidden=false;f.handlers.visibilitychange();assert.equal(f.video.plays,1);assert.equal(f.video.paused,true);});
test('a source error falls back once and disposes of the video source',()=>{const f=fixture();f.video.events.error();f.video.events.error();assert.equal(f.fallback(),1);assert.equal(f.host.children.length,0);assert.equal(f.video.src,undefined);});
test('switching to client videos destroys the ambient player and ignores late events',()=>{const f=fixture();f.api.destroy();f.video.events.error();f.video.events.playing();assert.equal(f.fallback(),0);assert.equal(f.host.children.length,0);assert.equal(f.handlers.visibilitychange,undefined);});

