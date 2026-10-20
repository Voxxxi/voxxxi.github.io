import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=stripTypeScriptTypes((await fs.readFile(new URL('./track-manager.ts',import.meta.url),'utf8')).replace(/^import .*\r?\n/gm,''));
const id='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222';
function setup({role='owner',removeError=false,provider='supabase'}={}){
 let handler;const log=[],row={id,user_id:user,storage_provider:provider,storage_path:user+'/song.mp3',expires_at:null,deleted_at:null};
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},rpc:async name=>({data:name==='voxi_r2_abandoned'?[]:role}),storage:{from:()=>({remove:async paths=>{log.push(['remove',paths]);return {error:removeError?Error('storage'):null};}})},from:table=>{
  let operation='select',filters=[],value;const query={select(){return query;},eq(k,v){filters.push([k,v]);return query;},not(){return query;},is(){return query;},lte(){return query;},or(){return query;},limit(){return query;},update(v){operation='update';value=v;return query;},delete(){operation='delete';return query;},insert(v){operation='insert';value=v;return query;},maybeSingle(){return Promise.resolve({data:filters.every(([k,v])=>row[k]===v)?{...row}:null});},then(ok,bad){log.push([table,operation,value]);if(operation==='update')Object.assign(row,value);return Promise.resolve({data:operation==='select'?[]:null}).then(ok,bad);}};return query;
 }};
 vm.runInNewContext(source,{deleteObject:async path=>{log.push(['r2-remove',path]);if(removeError)throw Error('R2 unavailable');},createClient:()=>db,Deno:{env:{get:n=>n==='VOXI_WEBHOOK_SECRET'?'cron-secret':'env'},serve:h=>handler=h},Response,Date,JSON,Error});
 const call=async(body,headers={Authorization:'Bearer test'})=>handler(new Request('https://unit.test',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}));
 return{call,log,row};
}
test('track deletion requires fresh staff role and exact recipient confirmation',async()=>{
 const client=setup({role:null});assert.equal((await client.call({action:'delete',trackId:id,userId:user,confirmTrackId:id})).status,403);assert.equal(client.log.length,0);
 const owner=setup();assert.equal((await owner.call({action:'delete',trackId:id,userId:user})).status,400);assert.equal(owner.log.length,0);
 const other=setup();assert.equal((await other.call({action:'delete',trackId:id,userId:id,confirmTrackId:id})).status,200);assert.equal(other.log.length,0);
});
test('deletes only selected object and marks it hidden before storage removal',async()=>{
 const s=setup();assert.equal((await s.call({action:'delete',trackId:id,userId:user,confirmTrackId:id})).status,200);
 assert.deepEqual(s.log.map(v=>v[0]),['voxi_track_audit','voxi_tracks','remove','voxi_tracks']);assert.equal(s.log[2][1][0],user+'/song.mp3');assert.ok(s.row.deleted_at);
});
test('storage failure preserves metadata for cleanup retry',async()=>{
 const s=setup({removeError:true});assert.equal((await s.call({action:'delete',trackId:id,userId:user,confirmTrackId:id})).status,503);assert.ok(s.row.deleted_at);assert.equal(s.log.filter(v=>v[1]==='delete').length,0);
});
test('cleanup requires existing server webhook secret',async()=>{
 const s=setup();assert.equal((await s.call({action:'cleanup'},{})).status,401);assert.equal(s.log.length,0);
 assert.equal((await s.call({action:'cleanup'},{'x-voxi-secret':'cron-secret'})).status,200);
});
test('R2 deletion targets only the selected track and keeps retry metadata on failure',async()=>{
 const s=setup({provider:'r2'});assert.equal((await s.call({action:'delete',trackId:id,userId:user,confirmTrackId:id})).status,200);
 assert.equal(s.log.find(x=>x[0]==='r2-remove')[1],user+'/song.mp3');assert.ok(!s.log.some(x=>x[0]==='remove'));
 const fail=setup({provider:'r2',removeError:true});assert.equal((await fail.call({action:'delete',trackId:id,userId:user,confirmTrackId:id})).status,503);assert.ok(!fail.log.some(x=>x[1]==='delete'));
});
