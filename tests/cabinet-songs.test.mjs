import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.children=[];this.events={};}
 appendChild(c){this.children.push(c);return c;}replaceChildren(...c){this.children=c;}setAttribute(){}addEventListener(type,fn){this.events[type]=fn;}
 querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tag===tag?[c]:[]),...c.querySelectorAll(tag)]);}querySelector(){return null;}pause(){this.paused=true;}style={};
}
const userId='user-one',track={id:'one',song_title:'Моя песня',storage_path:'user-one/track.mp3',file_name:'Песня.mp3'};
function fixture({tracks=[track],error=null,signError=null,current=()=>true}={}){
 const box=new Element('div'),calls=[],ctx=vm.createContext({window:{},document:{createElement:tag=>new Element(tag)},Map});
 vm.runInContext(fs.readFileSync(new URL('../cabinet-songs.js',import.meta.url),'utf8'),ctx);
 const client={from:table=>({select:()=>({eq:(field,id)=>{calls.push(['filter',table,field,id]);return {order:()=>({limit:async()=>({data:tracks,error})})};}})}),storage:{from:()=>({createSignedUrls:async paths=>{calls.push(['sign',...paths]);return {data:paths.map(path=>({path,signedUrl:'https://private.test/'+path})),error:signError};}})}};
 return {box,calls,run:()=>ctx.window.voxiLoadClientSongs({client,userId,box,make:(tag,text)=>new Element(tag,text),ru:true,isCurrent:current,refresh:()=>{}})};
}
test('filters metadata by current account and signs only its file paths',async()=>{const f=fixture();await f.run();assert.deepEqual(f.calls[0],['filter','voxi_tracks','user_id',userId]);assert.deepEqual(f.calls[1],['sign',track.storage_path]);assert.equal(f.box.querySelectorAll('audio').length,1);});
test('never signs a path belonging to another account',async()=>{const f=fixture({tracks:[track,{...track,storage_path:'another-user/private.mp3'}]});await f.run();assert.deepEqual(f.calls[1],['sign',track.storage_path]);assert.equal(f.box.querySelectorAll('audio').length,1);});
test('session change before metadata response prevents private media from rendering',async()=>{const f=fixture({current:()=>false});await f.run();assert.equal(f.calls.length,1);assert.equal(f.box.querySelectorAll('audio').length,0);});
test('errors show a retry action without an invalid audio player',async()=>{for(const patch of [{error:Error('db')},{signError:Error('storage')}]){const f=fixture(patch);await f.run();assert.equal(f.box.querySelectorAll('audio').length,0);assert.equal(f.box.querySelectorAll('button').length,1);}});
test('empty library remains an honest empty state with refresh',async()=>{const f=fixture({tracks:[]});await f.run();assert.equal(f.calls.length,1);assert.equal(f.box.querySelectorAll('audio').length,0);assert.equal(f.box.querySelectorAll('button').length,1);});
