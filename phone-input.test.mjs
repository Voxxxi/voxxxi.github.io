import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(await fs.readFile(new URL('./phone-input.js',import.meta.url),'utf8'),ctx);const f=ctx.window.voxiPhoneInput.format;
test('empty phone already contains Kazakhstan country prefix',()=>assert.equal(f(''),'+7 '));
test('operator and number, full +7, and national 8 format identically',()=>{for(const s of ['7011637393','+7 701 163 73 93','87011637393','77011637393'])assert.equal(f(s),'+7 701 163 73 93');});
test('partial operator and backspace keep prefix without duplication',()=>{assert.equal(f('+7'),'+7 ');assert.equal(f('+7 7'),'+7 7');assert.equal(f('+7 747123'),'+7 747 123');});
test('a foreign country number is not silently converted to a Kazakhstan number',()=>assert.equal(f('+44 123 456 78'),'+44 123 456 78'));
