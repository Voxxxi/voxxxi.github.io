import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminHandler} from '../supabase/functions/voxi-admin-users/admin-core.mjs';
const owner='11111111-1111-4111-8111-111111111111', target='22222222-2222-4222-8222-222222222222';
function fixture(patch={}){
 const calls=[];
 const api={getUser:async()=>({id:owner}),sessionRole:async()=>'owner',role:async()=>'client',targetExists:async()=>true,hasMedia:async()=>false,
 audit:async x=>{calls.push(['audit',x]);return 'log';},auditResult:async(...x)=>calls.push(['auditResult',...x]),
 deleteUser:async x=>calls.push(['delete',x]),setRole:async(...x)=>calls.push(['role',...x]),setBan:async(...x)=>calls.push(['ban',...x]),...patch};
 const handler=createAdminHandler(api);
 const run=(body={action:'delete_user',userId:target,confirmUserId:target},headers={Authorization:'Bearer signed-user-token'})=>handler(new Request('https://example.test',{method:'POST',headers,body:JSON.stringify(body)}));
 return {calls,run};
}
test('rejects missing or expired credentials before mutations',async()=>{
 const f=fixture();assert.equal((await f.run({},{})).status,401);assert.equal(f.calls.length,0);
 const expired=fixture({getUser:async()=>null});assert.equal((await expired.run()).status,401);assert.equal(expired.calls.length,0);
});
for(const role of [null,'client','helper','admin']) test('role '+role+' cannot mutate accounts',async()=>{
 const f=fixture({sessionRole:async()=>role});assert.equal((await f.run()).status,403);assert.equal(f.calls.length,0);
});
test('protects owner by caller ID and fresh target role',async()=>{
 let f=fixture();assert.equal((await f.run({action:'delete_user',userId:owner,confirmUserId:owner})).status,409);
 f=fixture({role:async()=>'owner'});assert.equal((await f.run()).status,409);assert.equal(f.calls.length,0);
});
test('checks confirmation, action and desired role',async()=>{
 const f=fixture();assert.equal((await f.run({action:'delete_user',userId:target})).status,400);
 assert.equal((await f.run({action:'set_role',role:'owner',userId:target,confirmUserId:target})).status,400);assert.equal(f.calls.length,0);
});
test('refuses account removal with media or failed storage checks',async()=>{
 const f=fixture({hasMedia:async()=>true});assert.equal((await f.run()).status,409);assert.equal(f.calls.length,0);
 const e=fixture({hasMedia:async()=>{throw Error('storage failed')}});assert.equal((await e.run()).status,500);assert.equal(e.calls.length,0);
});
test('deletes exactly selected account and audits success',async()=>{
 const f=fixture();assert.equal((await f.run()).status,200);assert.deepEqual(f.calls.map(x=>x[0]),['audit','delete','auditResult']);assert.equal(f.calls[1][1],target);
});
test('role changes use explicit allowed role and selected account',async()=>{
 for(const role of ['client','helper','admin']){const f=fixture();assert.equal((await f.run({action:'set_role',role,userId:target,confirmUserId:target})).status,200);assert.deepEqual(f.calls[1],['role',target,role]);}
});

test('suspension and restoration audit and affect only the confirmed account',async()=>{
 for(const banned of [true,false]){const f=fixture();const response=await f.run({action:'set_ban',userId:target,confirmUserId:target,banned});assert.equal(response.status,200);assert.deepEqual(f.calls.map(x=>x[0]),['audit','ban','auditResult']);assert.deepEqual(f.calls[1],['ban',target,banned]);assert.deepEqual(f.calls[0][1].details,{banned});}
});
test('invalid suspension state or unconfirmed recipient causes no mutation',async()=>{
 for(const banned of [undefined,'false',1,null]){const f=fixture();assert.equal((await f.run({action:'set_ban',userId:target,confirmUserId:target,banned})).status,400);assert.equal(f.calls.length,0);}
 const f=fixture();assert.equal((await f.run({action:'set_ban',userId:target,banned:true})).status,400);assert.equal(f.calls.length,0);
});
test('suspension cannot affect owner or be performed by other roles',async()=>{
 for(const role of ['admin','helper','client',null]){const f=fixture({sessionRole:async()=>role});assert.equal((await f.run({action:'set_ban',userId:target,confirmUserId:target,banned:true})).status,403);assert.equal(f.calls.length,0);}
 const f=fixture({role:async()=>'owner'});assert.equal((await f.run({action:'set_ban',userId:target,confirmUserId:target,banned:true})).status,409);assert.equal(f.calls.length,0);
});
test('audit failure prevents destructive operation',async()=>{
 const f=fixture({audit:async()=>{throw Error('no audit')}});assert.equal((await f.run()).status,500);assert.equal(f.calls.length,0);
});
test('records failed action without disclosing backend details',async()=>{
 const f=fixture({deleteUser:async()=>{throw Error('secret backend detail')}});const r=await f.run();assert.equal(r.status,500);assert.ok(!(await r.text()).includes('secret'));assert.deepEqual(f.calls.at(-1),['auditResult','log','failed']);
});
test('rejects foreign origin, invalid JSON and oversized request',async()=>{
 const f=fixture();assert.equal((await f.run({}, {Origin:'https://attacker.test',Authorization:'Bearer token'})).status,403);
 assert.equal((await f.run({data:'a'.repeat(5000)})).status,413);assert.equal(f.calls.length,0);
});
