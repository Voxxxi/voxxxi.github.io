(()=>{
 if(document.documentElement.hasAttribute('data-voxi-admin'))return;
 const where=document.getElementById('where');if(!where)return;
 const make=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
 const box=make('aside','voxi-ad-spot'),copy=make('div'),badge=make('small'),title=make('h2'),body=make('p'),link=make('a');
 link.href='https://wa.me/77011637393?text='+encodeURIComponent('Здравствуйте! Хочу обсудить размещение рекламы на сайте VOXi.');link.target='_blank';link.rel='noopener noreferrer';
 copy.append(badge,title,body);box.append(copy,link);where.before(box);
 function labels(){const kk=document.documentElement.lang==='kk';badge.textContent=kk?'СЕРІКТЕСТЕРГЕ':'ДЛЯ ПАРТНЁРОВ';title.textContent=kk?'Сіздің жарнамаңызға арналған орын':'Место для вашей рекламы';body.textContent=kk?'Өз жобаңыз туралы VOXi қонақтарына айтыңыз. Жарнаманы орналастыру шарттарын бірге талқылаймыз.':'Расскажите о своём проекте гостям VOXi. Обсудим формат и условия размещения.';link.textContent=kk?'Жарнама орналастыру ↗':'Разместить рекламу ↗';box.setAttribute('aria-label',title.textContent);link.href='https://wa.me/77011637393?text='+encodeURIComponent(kk?'Сәлеметсіз бе! VOXi сайтында жарнама орналастыру туралы сөйлескім келеді.':'Здравствуйте! Хочу обсудить размещение рекламы на сайте VOXi.');}
 document.getElementById('ru')?.addEventListener('click',labels);document.getElementById('kk')?.addEventListener('click',labels);labels();
})();
