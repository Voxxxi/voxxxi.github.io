import test from 'node:test';
import assert from 'node:assert/strict';
import {r2UploadDecision as decide,R2_UPLOAD_LIMIT_BYTES as cap,R2_MAX_FILE_BYTES as max} from './r2-policy.mjs';
const base={configured:true,inventoryComplete:true,inventoryAt:1_000_000,now:1_000_000,storedBytes:0,reservedBytes:0,incomingBytes:100};
test('R2 refuses missing configuration, partial or stale inventories',()=>{
  for(const patch of [{configured:false},{inventoryComplete:false},{inventoryAt:699999},{inventoryAt:1000001},{now:NaN}])
    assert.equal(decide({...base,...patch}).allowed,false);
});
test('R2 includes outstanding reservations and stops at 9 GB',()=>{
  assert.deepEqual(decide({...base,storedBytes:cap-200,reservedBytes:100}),{allowed:true,remainingBytes:0});
  assert.equal(decide({...base,storedBytes:cap-199,reservedBytes:100}).reason,'storage_limit');
  assert.equal(decide({...base,storedBytes:cap+1}).allowed,false);
});
test('R2 rejects corrupt counters, oversized and empty uploads',()=>{
  for(const field of ['storedBytes','reservedBytes','incomingBytes'])
    for(const value of [-1,NaN,Infinity,1.5,'100',Number.MAX_SAFE_INTEGER+1])
      assert.equal(decide({...base,[field]:value}).allowed,false);
  for(const value of [0,max+1]) assert.equal(decide({...base,incomingBytes:value}).allowed,false);
  assert.equal(decide({...base,incomingBytes:max}).allowed,true);
});
