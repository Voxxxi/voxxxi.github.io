import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('./profile-validation.js',import.meta.url),'utf8');
const context={window:{}};vm.createContext(context);vm.runInContext(source,context);
const v=context.window.voxiProfileValidation;
test('Kazakh, Russian, Latin and hyphenated names remain valid',()=>{
 for(const name of ['Әлия','Нұрсұлтан','Қожахметова','Әбдірахманұлы','Аружан','Ғалым','Ілияс','Ұлжан','Өмірзақ','Һарун','Анна','Елена','Ali','Dmytro','O’Neil','Ай-Сұлу','Li'])assert.equal(v.validPart(name),true,name);
});
test('obvious junk, digits, links and keyboard sequences are rejected',()=>{
 for(const name of ['123','Ali123','KGBKBK','ҚРТҚРТ','https://x.kz','Qwerty','aaaa','<script>','A','--'])assert.equal(v.validPart(name),false,name);
});
test('Kazakhstan mobile prefixes normalize to +7 without accepting foreign or malformed numbers',()=>{
 for(const code of ['700','701','702','705','706','707','708','747','771','775','776','777','778'])assert.equal(v.phone('+7 '+code+' 234 56 78'),'+7'+code+'2345678');
 assert.equal(v.phone('8 (701) 234-56-78'),'+77012345678');
 assert.equal(v.phone('7012345678'),'+77012345678');
 for(const phone of ['+79992345678','+7701234567','+770123456789','call +77012345678','++77012345678','+7 717 234 56 78','+1 234 567 89 00'])assert.equal(v.phone(phone),null,phone);
});
test('completion requires both names and a valid Kazakhstan mobile number',()=>{
 assert.equal(v.complete({full_name:'Әлия Қожахметова',phone:'+77012345678'}),true);
 assert.equal(v.complete({full_name:'Әлия',phone:'+77012345678'}),false);
 assert.equal(v.complete({full_name:'KGBKBK Test',phone:'+77012345678'}),false);
});

