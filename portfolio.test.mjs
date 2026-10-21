import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./portfolio.js',import.meta.url),'utf8');
class El{
 constructor(){this.children=[];this.events={};this.attrs={};this.paused=true;this.plays=0;this.preload='auto';}
 append(...x){this.children.push(...x);}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];if(k==='src')delete this.src;}
 addEventListener(k,f){this.events[k]=f;}pause(){this.paused=true;}load(){}async play(){this.paused=false;this.plays++;}querySelector(){return this.name;}
}
const tick=()=>new Promise(setImmediate);
async function fixture({user={id:'a'},allowed=true,tracks=[],download}={}){
 const audio=new El(),play=new El(),root=new El();root.name=new El();const calls=[],revoked=[],documentEvents={};let authChange;
 const client={rpc:async name=>{calls.push(name);return {data:name==='voxi_listening_allowed'?allowed:tracks};},
 storage:{from:bucket=>({download:async path=>{calls.push({bucket,path});return download?download(path):{data:{audio:true}};}})},
 auth:{getSession:async()=>({data:{session:user?{user}:null}}),onAuthStateChange:f=>authChange=f}};
 class Url extends URL{};Url.createObjectURL=()=> 'blob:test';Url.revokeObjectURL=x=>revoked.push(x);
 const ctx={URL:Url,setTimeout,location:{assign:x=>calls.push(x)},window:{addEventListener(){}},supabaseClient:client,startGoogleLogin:()=>calls.push('login'),
 document:{hidden:false,documentElement:{lang:'ru'},getElementById:id=>id==='audio'?audio:play,querySelector:()=>root,createElement:()=>new El(),addEventListener:(name,fn)=>documentEvents[name]=fn},MutationObserver:class{observe(){}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);await tick();await tick();
 return {audio,play,root,nav:root.children[0],status:root.children[1],login:root.children[2],calls,revoked,change:authChange,documentEvents};
}
test('guest is invited to sign in and receives neither playlist nor audio',async()=>{
 const f=await fixture({user:null});assert.equal(f.calls.length,0);assert.match(f.status.textContent,/регистрации/);assert.equal(f.nav.hidden,true);
 await f.play.onclick();assert.deepEqual(f.calls,['login']);assert.equal(f.audio.src,undefined);
});
test('incomplete profile never gets playlist or audio',async()=>{
 const f=await fixture({allowed:false});assert.deepEqual(f.calls,['voxi_listening_allowed']);await f.play.onclick();assert.match(f.calls[1],/registration=1/);assert.equal(f.audio.src,undefined);
});
test('registered playback fetches private bucket only after a click and uses a local blob URL',async()=>{
 const f=await fixture({tracks:[{id:'1',title:'A',path:'a.mp3'}]});assert.equal(f.audio.src,undefined);assert.equal(f.audio.plays,0);
 await f.play.onclick();assert.deepEqual(f.calls.at(-1),{bucket:'voxi-portfolio',path:'a.mp3'});assert.equal(f.audio.src,'blob:test');assert.equal(f.audio.plays,1);
 f.change('SIGNED_OUT',null);assert.equal(f.audio.src,undefined);assert.equal(f.audio.paused,true);assert.deepEqual(f.revoked,['blob:test']);assert.equal(f.nav.hidden,true);
});
test('sign-out during download cannot restore audio to a guest',async()=>{
 let finish;const response=new Promise(resolve=>finish=resolve);
 const f=await fixture({tracks:[{id:'1',title:'A',path:'a.mp3'}],download:()=>response});
 const pending=f.play.onclick();f.change('SIGNED_OUT',null);finish({data:{audio:true}});await pending;
 assert.equal(f.audio.plays,0);assert.equal(f.audio.src,undefined);
});
test('random playlist cycles once through each track without immediately repeating the last song',async()=>{
 const f=await fixture({tracks:['a','b','c'].map(x=>({id:x,title:x,path:x+'.mp3'}))});const names=[f.root.name.textContent];await f.play.onclick();
 for(let i=0;i<2;i++){await f.nav.children[2].events.click();await tick();names.push(f.root.name.textContent);}
 assert.equal(new Set(names).size,3);const last=f.root.name.textContent;await f.audio.events.ended();await tick();assert.notEqual(f.root.name.textContent,last);assert.equal(f.audio.paused,false);
});
test('empty private portfolio stays honest and never requests demo audio',async()=>{
 const f=await fixture();assert.match(f.status.textContent,/скоро/);assert.equal(f.play.disabled,true);assert.equal(f.nav.hidden,true);assert.equal(f.audio.src,undefined);
});
test('returning to the page rechecks access without resetting an active song',async()=>{
 const f=await fixture({tracks:[{id:'1',title:'Запись 1',path:'track-01.mp3'}]});await f.play.onclick();f.audio.currentTime=42;
 f.documentEvents.visibilitychange();await tick();await tick();assert.equal(f.audio.src,'blob:test');assert.equal(f.audio.paused,false);assert.equal(f.audio.currentTime,42);assert.equal(f.revoked.length,0);
});

