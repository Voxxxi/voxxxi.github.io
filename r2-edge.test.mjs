import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';
import {readExactBody,validAudio,readJsonBody} from './r2-core.mjs';
const source=stripTypeScriptTypes((await readFile(new URL('./r2-edge.ts',import.meta.url),'utf8')).replace(/^import .*\r?\n/gm,''));
const actor='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
function fixture({role='owner',track=null,revoke=false,head=4,finalizeError=false}={}){
 let handler,roleCalls=0;const log=[];
 const db={auth:{getUser:async()=>({data:{user:{id:actor}}})},rpc:async(name,args)=>{
  log.push([name,args]);if(name==='voxi_staff_session')return{data:revoke&&roleCalls++>0?null:role};
  if(name==='voxi_r2_claim')return{data:{path:actor+'/'+id+'.mp3',bytes:4,file_name:'test.mp3',content_type:'audio/mpeg'}};
  if(name==='voxi_r2_finalize'&&finalizeError)return{error:Error('lost')};
  return{data:name==='voxi_r2_pending_bytes'?0:name==='voxi_r2_reserve'?{id}:id};
 },from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:track})})};
 vm.runInNewContext(source,{createClient:()=>db,readExactBody,validAudio,readJsonBody,configured:()=>true,inventory:async()=>({bytes:123,objects:1}),putObject:async(...args)=>log.push(['put',...args]),headObject:async()=>head,deleteObject:async()=>{throw Error('Unexpected delete');},signedGet:async()=>{log.push(['signed']);return 'https://signed.example/file';},Deno:{env:{get:()=> 'env'},serve:h=>handler=h},Response,Date,JSON,Error});
 const call=(body,extra={},auth=true)=>handler(new Request('https://unit.test',{method:'POST',headers:{...(auth?{Authorization:'Bearer test'}:{}),...extra},body:body instanceof Uint8Array?body:JSON.stringify(body)}));return{call,log};
}
test('R2 endpoint rejects anonymous and nonstaff writes before reservations',async()=>{
 const s=fixture();assert.equal((await s.call({action:'status'},{},false)).status,401);
 const c=fixture({role:null});assert.equal((await c.call({action:'prepare',userId:id,bytes:4})).status,403);assert.ok(!c.log.some(x=>x[0]==='voxi_r2_reserve'));
});
test('R2 reader requires RLS-visible active metadata and never signs unknown tracks',async()=>{
 const s=fixture({role:null});assert.equal((await s.call({action:'read',trackId:id})).status,404);assert.ok(!s.log.some(x=>x[0]==='signed'));
 const t={id,user_id:actor,storage_path:actor+'/'+id+'.mp3',storage_provider:'r2',file_name:'song.mp3'};
 assert.equal((await fixture({role:null,track:t}).call({action:'read',trackId:id})).status,200);
 assert.equal((await fixture({track:{...t,deleted_at:'2026-01-01'}}).call({action:'read',trackId:id})).status,404);
});
test('R2 upload rechecks session and verifies remote size before metadata delivery',async()=>{
 const bytes=new Uint8Array([73,68,51,0]),headers={'x-voxi-upload':id};
 const s=fixture();assert.equal((await s.call(bytes,headers)).status,200);assert.deepEqual(s.log.map(x=>x[0]),['voxi_staff_session','voxi_r2_claim','voxi_staff_session','put','voxi_r2_verify','voxi_r2_finalize']);
 for(const options of [{revoke:true},{head:3}]){const f=fixture(options);assert.equal((await f.call(bytes,headers)).status,503);assert.ok(!f.log.some(x=>x[0]==='voxi_r2_finalize'));}
});
test('R2 refuses spoofed audio and preserves ambiguous delivered object',async()=>{
 const s=fixture();assert.equal((await s.call(new Uint8Array([60,104,116,109]),{'x-voxi-upload':id})).status,503);assert.ok(!s.log.some(x=>x[0]==='put'));
 const f=fixture({finalizeError:true});assert.equal((await f.call(new Uint8Array([73,68,51,0]),{'x-voxi-upload':id})).status,503);assert.ok(f.log.some(x=>x[0]==='voxi_r2_verify'));
});
test('JSON parser stops oversized requests without reading unlimited bodies',async()=>{
 await assert.rejects(readJsonBody(new Request('https://unit.test',{method:'POST',body:'x'.repeat(5000)})));
});
