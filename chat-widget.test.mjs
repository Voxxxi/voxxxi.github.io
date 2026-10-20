import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('./chat.js',import.meta.url),'utf8');
class Element{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.events={};this.classes=new Set();this.value='';this.textContent='';this.scrollTop=this.scrollHeight=this.clientHeight=0;this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,on)=>{if(on===undefined)on=!this.classes.has(v);on?this.classes.add(v):this.classes.delete(v);},contains:v=>this.classes.has(v)};}
 set className(v){this.classes=new Set(v.split(/\s+/));}get className(){return [...this.classes].join(' ');}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=nodes;}setAttribute(k,v){this.attrs[k]=String(v);}addEventListener(k,fn){this.events[k]=fn;}focus(){}scrollIntoView(){throw Error('Chat must not scroll the page');}
 click(){return this.events.click?.({currentTarget:this,preventDefault(){}});}all(){return [this,...this.children.flatMap(x=>x.all?.()||[])];}
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture({standalone=false,aiResponse=async()=>({data:{body:'Сәлеметсіз бе! VOXi студиясына қош келдіңіз!',kind:'ai'}})}={}){
 const body=new Element('body'),main=new Element('main');body.append(main);let onAuth,reads=0,removed=0;const client={
 auth:{getSession:async()=>({data:{session:{user:{id:'client'}}}}),onAuthStateChange:fn=>{onAuth=fn;}},rpc:async()=>({data:null}),
 functions:{invoke:aiResponse},
 channel:()=>({on(){return this;},subscribe(fn){fn('SUBSCRIBED');return this;}}),removeChannel:async()=>{removed++;},
 from:()=>{reads++;const query={select(){return query;},order(){return query;},limit(){return query;},in(){return query;},then(resolve){return Promise.resolve({data:[{id:'msg',user_id:'other',author_name:'Пример',body:'Сообщение',created_at:'2026-10-19T10:00:00Z'}]}).then(resolve);}};return query;}
 };
 const document={body,documentElement:{lang:'ru'},createElement:t=>new Element(t),getElementById:id=>body.all().find(n=>n.id===id)||null,querySelector:s=>s==='.social'?body.all().find(n=>n.classes.has('social'))||null:s==='main'?main:null};
 const context={document,window:{addEventListener(){},voxiCabinetClient:standalone?client:null},setInterval:()=>1,clearInterval(){},setTimeout:(fn,ms)=>ms===35000?setTimeout(fn,ms):void Promise.resolve().then(fn),Date,JSON,console,Map,clearTimeout};
 if(!standalone)Object.assign(context,{supabaseClient:client,currentUser:{id:'owner'},voxiStaffRole:'owner',voxiStaffUserId:'owner',setSignedIn(){}});
 vm.createContext(context);vm.runInContext(source,context);
 return{body,main,context,readCount:()=>reads,removed:()=>removed,auth:(user)=>onAuth('SIGNED_OUT',{user}),by:id=>document.getElementById(id)};
}
test('chat opens next to contact icons and leaves page content in place',async()=>{
 const f=fixture();assert.equal(f.main.children.length,0);assert.equal(f.readCount(),0);const launcher=f.by('chatEntry');assert.ok(f.body.all().some(n=>n.className.includes('voxi-contact-dock')));assert.equal(launcher.attrs['aria-expanded'],'false');launcher.click();await flush();assert.equal(launcher.attrs['aria-expanded'],'true');assert.ok(f.readCount()>0);launcher.click();assert.equal(launcher.attrs['aria-expanded'],'false');assert.ok(f.by('voxiChatPanel').classes.has('hidden'));assert.equal(f.removed(),1);
});
test('sign-out clears visible private conversation and draft',async()=>{
 const f=fixture();f.by('chatEntry').click();await flush();const input=f.body.all().find(n=>n.tagName==='TEXTAREA');input.value='Private draft';f.context.setSignedIn(null);await flush();assert.equal(input.value,'');assert.ok(!f.body.all().some(n=>n.textContent==='Сообщение'));assert.ok(f.body.all().find(n=>n.tagName==='FORM').classes.has('hidden'));
});
test('cabinet uses its existing client and responds to sign-out',async()=>{
 const f=fixture({standalone:true});await flush();f.by('chatEntry').click();await flush();assert.ok(f.readCount()>0);f.auth(null);await flush();assert.ok(f.body.all().find(n=>n.tagName==='FORM').classes.has('hidden'));assert.ok(!f.body.all().some(n=>n.textContent==='Сообщение'));
});
test('private AI conversation is separate from the community and cleared at sign-out',async()=>{
 const f=fixture();f.by('chatEntry').click();await flush();f.body.all().find(n=>n.textContent==='ИИ-помощник').click();const reads=f.readCount();
 const input=f.body.all().find(n=>n.tagName==='TEXTAREA'),form=f.body.all().find(n=>n.tagName==='FORM');input.value='Саламатсыз ба';await form.events.submit({preventDefault(){}});await flush();
 assert.equal(f.readCount(),reads);assert.ok(f.body.all().some(n=>n.textContent==='Сәлеметсіз бе! VOXi студиясына қош келдіңіз!'));f.context.setSignedIn(null);assert.ok(!f.body.all().some(n=>n.textContent==='Сәлеметсіз бе! VOXi студиясына қош келдіңіз!'));
});
test('a late AI response cannot reappear under another account',async()=>{
 let resolve;const f=fixture({aiResponse:()=>new Promise(r=>resolve=r)});f.by('chatEntry').click();await flush();f.body.all().find(n=>n.textContent==='ИИ-помощник').click();
 const input=f.body.all().find(n=>n.tagName==='TEXTAREA');input.value='private';const running=f.body.all().find(n=>n.tagName==='FORM').events.submit({preventDefault(){}});f.context.setSignedIn(null);resolve({data:{body:'PRIVATE ANSWER',kind:'ai'}});await running;assert.ok(!f.body.all().some(n=>n.textContent==='PRIVATE ANSWER'));
});
