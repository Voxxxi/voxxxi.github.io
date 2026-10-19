import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectVideo,createVideoHandler} from '../supabase/functions/voxi-videos/video-core.mjs';
const uid='11111111-1111-4111-8111-111111111111',vid='22222222-2222-4222-8222-222222222222',rid='33333333-3333-4333-8333-333333333333';
function atom(type,body){const head=Buffer.alloc(8);head.writeUInt32BE(8+body.length);head.write(type,4);return Buffer.concat([head,body]);}
function movie(seconds=10,handler='vide'){
 const header=Buffer.alloc(24);header.writeUInt32BE(1000,12);header.writeUInt32BE(seconds*1000,16);
 const hdlr=Buffer.concat([Buffer.alloc(8),Buffer.from(handler),Buffer.alloc(8)]);
 return new Uint8Array(Buffer.concat([atom('ftyp',Buffer.from('isom0000')),atom('moov',Buffer.concat([atom('mvhd',header),atom('trak',atom('mdia',atom('hdlr',hdlr)))])),atom('mdat',Buffer.alloc(16))]));
}
test('parses actual MP4 movie duration and video handler',()=>assert.equal(inspectVideo(movie()).duration,10));
test('rejects audio-only, oversized duration and malformed containers',()=>{assert.throws(()=>inspectVideo(movie(301)));assert.throws(()=>inspectVideo(movie(10,'soun')));const corrupt=movie();corrupt[0]=255;assert.throws(()=>inspectVideo(corrupt));assert.throws(()=>inspectVideo(new Uint8Array(12)));});
const bytes=movie();
const pending={id:vid,user_id:uid,client_request_id:rid,status:'uploading',storage_path:uid+'/'+vid+'.mp4',file_size:bytes.length,file_name:'party.mp4',title:'Праздник',mime_type:'video/mp4',upload_expires_at:'2099-01-01T00:00:00Z'};
function fixture(patch={}){
 const calls=[];const api={now:()=>Date.now(),user:async()=>({id:uid}),sessionActive:async()=>true,staffRole:async()=>null,previous:async()=>null,
  verifyCaptcha:async()=>({success:true,hostname:'voxxxi.github.io',action:'video_upload'}),profile:async()=>({full_name:'Иван Иванов',phone:'+77011234567'}),
  reserve:async x=>{calls.push(['reserve',x]);return pending;},uploadTicket:async x=>{calls.push(['ticket',x.id]);return {videoId:x.id,path:x.storage_path,token:'signed-upload'};},
  owned:async()=>pending,file:async()=>({bytes,size:bytes.length,mime:'video/mp4'}),invalidate:async x=>calls.push(['invalid',x.id]),
  complete:async(...x)=>{calls.push(['complete',...x]);return 'pending';},mine:async()=>[],queue:async()=>[],feed:async()=>[],...patch};
 const handler=createVideoHandler(api);
 const run=(body,headers={Authorization:'Bearer token'})=>handler(new Request('https://server.test',{method:'POST',headers,body:JSON.stringify(body)}));
 const begin=(patch={})=>run({action:'begin',requestId:rid,title:'Праздник',description:'',fileName:'party.mp4',size:bytes.length,consent:true,captcha:'valid',...patch});
 return {calls,run,begin};
}
test('anonymous visitors may read public feed but not private videos',async()=>{const f=fixture();assert.equal((await f.run({action:'feed'},{})).status,200);const denied=fixture({user:async()=>null});assert.equal((await denied.run({action:'my'},{})).status,401);});
test('revoked session cannot reserve an upload',async()=>{const f=fixture({sessionActive:async()=>false});assert.equal((await f.begin()).status,401);assert.equal(f.calls.length,0);});
test('missing captcha, missing consent and invalid file size cannot reserve objects',async()=>{for(const patch of [{captcha:''},{consent:false},{size:100000000},{fileName:'payload.html'}]){const f=fixture();assert.equal((await f.begin(patch)).status,400);assert.equal(f.calls.length,0);}});
test('rejects failed, wrong-hostname and wrong-action captcha',async()=>{for(const verified of [{success:false},{success:true,hostname:'attacker.test',action:'video_upload'},{success:true,hostname:'voxxxi.github.io',action:'login'}]){const f=fixture({verifyCaptcha:async()=>verified});assert.equal((await f.begin()).status,403);assert.equal(f.calls.length,0);}});
test('captcha verification outage fails closed',async()=>{const f=fixture({verifyCaptcha:async()=>{throw Error('offline')}});assert.equal((await f.begin()).status,503);assert.equal(f.calls.length,0);});
test('verified upload binds ID, canonical name and title to authenticated user',async()=>{const f=fixture();assert.equal((await f.begin()).status,200);assert.equal(f.calls[0][1].p_user,uid);assert.equal(f.calls[0][1].p_name,'Иван');assert.equal(f.calls[1][0],'ticket');});
test('incomplete registration cannot reserve upload',async()=>{const f=fixture({profile:async()=>null});assert.equal((await f.begin()).status,422);assert.equal(f.calls.length,0);});
test('retry of same previously verified request reissues only the same object token',async()=>{let verified=0;const f=fixture({previous:async()=>pending,verifyCaptcha:async()=>{verified++;throw Error('already used')}});assert.equal((await f.begin({captcha:'reused'})).status,200);assert.equal(verified,0);assert.deepEqual(f.calls,[['ticket',vid]]);});
test('cannot reuse reservation for different file',async()=>{const f=fixture({previous:async()=>pending});assert.equal((await f.begin({fileName:'other.mp4'})).status,409);assert.equal(f.calls.length,0);});
test('technical verification queues video and never approves it',async()=>{const f=fixture();const response=await f.run({action:'complete',videoId:vid});assert.equal(response.status,200);assert.equal((await response.json()).status,'pending');assert.deepEqual(f.calls,[['complete',uid,vid,10]]);});
test('cannot complete foreign object or absent transfer',async()=>{for(const patch of [{owned:async()=>null},{file:async()=>null}]){const f=fixture(patch);assert.ok([404,409].includes((await f.run({action:'complete',videoId:vid})).status));assert.equal(f.calls.length,0);}});
test('rejects mismatched size or malformed content before any publication',async()=>{for(const file of [{bytes:movie(301),size:bytes.length,mime:'video/mp4'},{bytes,size:1,mime:'video/mp4'}]){const f=fixture({file:async()=>file});assert.equal((await f.run({action:'complete',videoId:vid})).status,422);assert.deepEqual(f.calls,[['invalid',vid]]);}});
test('repeated completion does not create duplicate moderation notifications',async()=>{const f=fixture({owned:async()=>({...pending,status:'pending'})});assert.equal((await f.run({action:'complete',videoId:vid})).status,200);assert.equal(f.calls.length,0);});
test('clients cannot open moderator queue',async()=>{const f=fixture();assert.equal((await f.run({action:'queue'})).status,403);});
