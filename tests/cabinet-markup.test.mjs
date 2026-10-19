import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const html=await fs.readFile(new URL('../cabinet.html',import.meta.url),'utf8');
test('cabinet handlers refer to existing dialog and content elements',()=>{
 const ids=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m=>m[1]));
 for(const match of html.matchAll(/\bel\("([^"]+)"\)/g))assert.ok(ids.has(match[1]),'Missing cabinet element: '+match[1]);
 assert.match(html,/el\("panel"\)\.addEventListener\("close"/);
});
