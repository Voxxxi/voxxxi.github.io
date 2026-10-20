import test from 'node:test';import assert from 'node:assert/strict';
import {parseInventoryPage,readExactBody,validAudio} from './r2-core.mjs';
test('R2 inventory sums objects and follows pagination without treating missing data as zero',()=>{
 assert.deepEqual(parseInventoryPage('<ListBucketResult><Contents><Key>a</Key><Size>10</Size></Contents><Contents><Size>12</Size></Contents><IsTruncated>true</IsTruncated><NextContinuationToken>x&amp;y</NextContinuationToken></ListBucketResult>'),{bytes:22,objects:2,next:'x&y'});
 assert.equal(parseInventoryPage('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>').bytes,0);
 for(const x of ['<Error>Denied</Error>','<ListBucketResult/>','<ListBucketResult><Contents></Contents><IsTruncated>false</IsTruncated></ListBucketResult>','<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>'])assert.throws(()=>parseInventoryPage(x));
});
test('R2 body reader refuses truncated or oversized transfers',async()=>{
 const req=n=>new Request('https://example.com',{method:'POST',body:new Uint8Array(n)});
 assert.equal((await readExactBody(req(4),4)).length,4);
 await assert.rejects(readExactBody(req(5),4));await assert.rejects(readExactBody(req(3),4));await assert.rejects(readExactBody(req(1),0));
 assert.equal(validAudio(new Uint8Array([73,68,51,0]),'a.mp3'),true);assert.equal(validAudio(new Uint8Array([60,104,116,109]),'a.mp3'),false);
});
