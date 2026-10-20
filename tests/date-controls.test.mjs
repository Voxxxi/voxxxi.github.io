import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../date-controls.js',import.meta.url),'utf8');
const context={window:{},document:{getElementById:()=>null},Date};vm.createContext(context);vm.runInContext(source,context);const api=context.window.voxiRetention;
test('calendar months clamp to the last valid day, including leap years',()=>{
 const month=new Date(api.until('month',new Date(2027,0,31,9)));assert.deepEqual([month.getFullYear(),month.getMonth(),month.getDate(),month.getHours()],[2027,1,28,23]);
 const year=new Date(api.until('year',new Date(2028,1,29,9)));assert.deepEqual([year.getFullYear(),year.getMonth(),year.getDate()],[2029,1,28]);
 const half=new Date(api.until('half-year',new Date(2026,7,31,9)));assert.deepEqual([half.getFullYear(),half.getMonth(),half.getDate()],[2027,1,28]);
});
test('week and custom dates last through the selected local day; unlimited remains null',()=>{
 const week=new Date(api.until('week',new Date(2026,11,28,10)));assert.deepEqual([week.getFullYear(),week.getMonth(),week.getDate(),week.getHours(),week.getMinutes()],[2027,0,4,23,59]);
 assert.equal(api.until(''),null);assert.equal(api.localDay(api.until('custom',new Date(2026,9,20),'2026-12-05')),'2026-12-05');
 assert.throws(()=>api.until('custom',new Date(),'2026-02-31'));assert.throws(()=>api.until('custom',new Date(),''));assert.throws(()=>api.until('bad'));
});
