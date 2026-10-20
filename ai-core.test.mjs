import test from 'node:test';import assert from 'node:assert/strict';import {operatorLanguage,referenceAnswer,cleanModelAnswer,safeHealthFacts} from './ai-core.mjs';
test('operator follows Russian and Kazakh, including a greeting without Kazakh letters',()=>{for(const s of ['Сәлеметсіз бе','Саламатсыз ба','Бағасы қанша?'])assert.equal(operatorLanguage(s),'kk');assert.equal(operatorLanguage('Здравствуйте, сколько стоит запись?','kk'),'ru');assert.equal(operatorLanguage('Hello','kk'),'kk');});
test('fallback keeps approved prices and does not invent long-song quotes',()=>{for(const lang of ['ru','kk']){const answer=referenceAnswer('цена',lang);for(const n of ['5 000','6 000','7 000','2 000'])assert.ok(answer.includes(n));}assert.match(referenceAnswer('адрес','ru'),/дом 30, квартира 47/);});
test('model reasoning and empty outputs are not published',()=>{assert.equal(cleanModelAnswer({response:'<think>private</think>Здравствуйте'}),'Здравствуйте');assert.equal(cleanModelAnswer({response:'<think>still thinking'}),null);assert.equal(cleanModelAnswer({}),null);});
test('AI health input contains only whitelisted aggregates and page codes',()=>{const data=safeHealthFacts({missing_tracks:2,phone:'secret',user_id:'private',checks:[{check:'home',ok:true,url:'private-url',token:'secret'},{check:'private-user-id',ok:false}]});assert.equal(JSON.stringify(data).includes('secret'),false);assert.equal(data.checks[1].check,'unknown');assert.equal(data.missingTracks,2);});
test('new studio policies remain accurate in reference mode in both languages',()=>{
 assert.match(referenceAnswer('Можно записать онлайн на диктофон?','ru'),/другой профессиональной студии/);
 assert.match(referenceAnswer('Записать ребёнка четырёх лет','ru'),/Четырёхлетних детей не записываем/);
 assert.match(referenceAnswer('Можно менять слова?','ru'),/подходить к мелодии и ритму/);
 assert.match(referenceAnswer('Suno песня','ru'),/предварительно согласуйте/);
 assert.match(referenceAnswer('На английском языке можно?','ru'),/любом языке/);
 assert.match(referenceAnswer('Онлайн жазу бола ма?','kk'),/мүмкін емес/);
});
