import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const ctx=vm.createContext({Uint8Array,crypto:webcrypto});
vm.runInContext(fs.readFileSync(new URL('../track-upload.js',import.meta.url),'utf8'),ctx);
const file=(name,bytes,size=bytes.length)=>({name,size,slice:()=>({arrayBuffer:async()=>Uint8Array.from(bytes).buffer})});
const mp3=file('test.mp3',[73,68,51,0,0]);
test('accepts valid audio and rejects spoofed files, unsupported formats and size limits',async()=>{
 assert.equal((await ctx.voxiTrackFileInfo(mp3)).contentType,'audio/mpeg');
 for(const f of [file('bad.mp3',[60,104,116,109,108]),file('a.exe',[73,68,51]),file('empty.wav',[],0),file('large.mp3',[73,68,51],51*1024*1024)])await assert.rejects(ctx.voxiTrackFileInfo(f));
});
function fixture({insertError=null,uploadError=null,removeError=null,confirmed=null,confirmError=null}={}){
 const calls=[];const bucket={upload:async(...x)=>{calls.push(['upload',...x]);return {error:uploadError};},remove:async x=>{calls.push(['remove',x]);return {error:removeError};}};
 const client={storage:{from:()=>bucket},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:confirmed,error:confirmError}),order:()=>({limit:async()=>({data:[{song_number:2}],error:null})})})}),insert:async row=>{calls.push(['insert',row]);return {error:insertError};}})};
 return {calls,run:(patch={})=>ctx.voxiUploadPrivateTrack({client,userId:'22222222-2222-4222-8222-222222222222',file:mp3,title:'Песня',actorStillCurrent:()=>true,...patch})};
}
test('links uploaded private file to selected account and records next song number',async()=>{
 const f=fixture(),r=await f.run();assert.match(r.path,/^22222222-2222-4222-8222-222222222222\//);assert.deepEqual(f.calls.map(x=>x[0]),['upload','insert']);assert.equal(f.calls[1][1].song_number,3);assert.equal(f.calls[1][1].storage_path,r.path);
});
test('cleans uploaded file on definite database constraint failure',async()=>{const f=fixture({insertError:{code:'23503',message:'database constraint'}});await assert.rejects(f.run());assert.equal(f.calls.at(-1)[0],'remove');});
test('failed transfer does not insert metadata or remove another file',async()=>{const f=fixture({uploadError:Error('network')});await assert.rejects(f.run());assert.deepEqual(f.calls.map(x=>x[0]),['upload']);});
test('reports failed cleanup rather than silently encouraging another upload',async()=>{const f=fixture({insertError:{code:'23503',message:'constraint'},removeError:Error('storage')});await assert.rejects(f.run(),/очистить/);});
test('requires same staff session and title before transfer',async()=>{const f=fixture();await assert.rejects(f.run({actorStillCurrent:()=>false}));await assert.rejects(f.run({title:''}));assert.equal(f.calls.length,0);});
test('lost acknowledgement must not remove a file already linked to the account',async()=>{const f=fixture({insertError:Error('response lost'),confirmed:{id:'saved'}});await f.run();assert.ok(!f.calls.some(x=>x[0]==='remove'));});
test('uncertain database state preserves file for review',async()=>{const f=fixture({insertError:Error('network'),confirmError:Error('offline')});await assert.rejects(f.run(),/подтвердить/);assert.ok(!f.calls.some(x=>x[0]==='remove'));});
