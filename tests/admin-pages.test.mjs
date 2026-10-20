import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../admin-workspace.js',import.meta.url),'utf8');
class Element{
 constructor(tag='section'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.events={};this.classes=new Set();this.textContent='';this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),toggle:(v,on)=>{if(on===undefined)on=!this.classes.has(v);on?this.classes.add(v):this.classes.delete(v);}};}
 set className(v){this.classes=new Set(v.split(/\s+/));}get className(){return [...this.classes].join(' ');}
 append(...n){this.children.push(...n);}prepend(...n){this.children.unshift(...n);}before(){}after(){}replaceChildren(...n){this.children=n;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}addEventListener(k,fn){this.events[k]=fn;}querySelectorAll(){return [];}closest(){return this;}scrollIntoView(){}click(){this.clicked=(this.clicked||0)+1;}all(){return [this,...this.children.flatMap(n=>n.all?.()||[])];}
}
function fixture({admin=true,role='owner',route='home'}={}){
 const body=new Element('body'),nav=new Element('nav'),functional=new Element(),nodes=new Map();body.append(nav,functional);
 for(const id of ['app','bookings','schedulePanel','backupPanel','usersPanel','videoModerationPanel','scheduleDate','scheduleList','usersEntry','incomePanel']){const n=new Element();n.id=id;nodes.set(id,n);body.append(n);}
 let opened=[],destinations=[],originalCalls=[];
 const document={body,documentElement:{hasAttribute:()=>admin},createElement:t=>new Element(t),getElementById:id=>nodes.get(id)||body.all().find(n=>n.id===id),querySelector:s=>s==='header nav'?nav:functional};
 const ctx={document,location:{search:'?section='+route+'&q=123',assign:x=>destinations.push(x)},URLSearchParams,Date,encodeURIComponent,currentUser:role?{id:'actor'}:null,voxiStaffRole:role,isAdmin:()=>['owner','admin','helper'].includes(ctx.voxiStaffRole),setSignedIn:user=>{ctx.currentUser=user;},openVOXiSection:async target=>{originalCalls.push(target);},renderBookings(){},currentBookings:[],supabaseClient:{from:()=>({select(){return this;},not(){return this;},is(){return this;},lte(){return this;},order(){return this;},limit:async()=>({data:[]})})},window:{voxiOpenClients:q=>opened.push(q)}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,body,nodes,nav,opened,destinations,originalCalls};
}
test('homepage staff entry navigates to a distinct admin document',async()=>{const f=fixture({admin:false});await f.ctx.openVOXiSection('admin');assert.deepEqual(f.destinations,['./admin.html?section=home']);assert.deepEqual(f.originalCalls,[]);assert.ok(f.nodes.get('schedulePanel').classes.has('voxi-admin-off'));assert.ok(f.nodes.get('backupPanel').classes.has('voxi-admin-off'));assert.ok(!f.body.all().find(n=>n.id==='adminWorkspace'));});
test('client links in the admin menu perform document navigation and retain the selected module',()=>{const f=fixture({route:'clients'});assert.deepEqual(f.opened,['123']);const links=f.nav.all().filter(n=>n.tagName==='A');assert.ok(links.some(n=>n.href==='./'));const moduleLinks=f.body.all().filter(n=>n.href?.startsWith('./admin.html?section='));assert.equal(moduleLinks.length,8);assert.equal(moduleLinks.find(n=>n.attrs['aria-current']==='page').href,'./admin.html?section=clients');assert.ok(!f.nodes.get('usersPanel').classes.has('voxi-admin-off'));assert.ok(f.nodes.get('schedulePanel').classes.has('voxi-admin-off'));});
test('helpers cannot open the client directory and account logout hides the admin workspace',()=>{const f=fixture({role:'helper',route:'users'});assert.equal(f.opened.length,0);assert.ok(f.nodes.get('usersPanel').classes.has('voxi-admin-off'));const userLink=f.body.all().find(n=>n.href==='./admin.html?section=clients');assert.equal(userLink.hidden,true);f.ctx.voxiStaffRole=null;f.ctx.setSignedIn(null);assert.ok(!f.body.classes.has('voxi-admin-mode'));assert.ok(f.body.all().find(n=>n.id==='adminWorkspace').classes.has('hidden'));});

test('income is available only to owner and the old users URL opens the unified directory',()=>{const owner=fixture({route:'users'});assert.deepEqual(owner.opened,['123']);assert.ok(!owner.body.all().some(n=>n.href==='./admin.html?section=users'));const admin=fixture({role:'admin',route:'income'});assert.ok(admin.nodes.get('incomePanel').classes.has('voxi-admin-off'));assert.equal(admin.body.all().find(n=>n.href==='./admin.html?section=income').hidden,true);});
