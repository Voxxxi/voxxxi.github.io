(()=>{
 if(document.documentElement.hasAttribute('data-voxi-admin'))return;
 const form=document.getElementById('bookingForm');if(!form)return;
 function group(ids,cls){const grid=document.createElement('div');grid.className=cls;for(const id of ids){const input=document.getElementById(id),label=form.querySelector('label[for="'+id+'"]');if(!input||!label)continue;const field=document.createElement('div');field.className='voxi-booking-field';const control=input.closest('.voxi-date-control')||input;field.append(label,control);grid.append(field);}return grid;}
 const contact=group(['name','phone'],'voxi-booking-contacts'),options=group(['date','time','songs'],'voxi-booking-options');form.prepend(contact,options);
 const help=document.getElementById('timeHelp');options.after(help);form.querySelector(':scope>.notice')?.remove();
 const songs=document.getElementById('songFields');form.classList.add('voxi-booking-compact');
 const tabs=document.createElement('div');tabs.className='voxi-song-tabs';tabs.setAttribute('role','tablist');songs.before(tabs);
 let active=0,lastCount=songs.children.length;
 const cards=()=>[...songs.querySelectorAll('.song-card')];
 function selectSong(index,focus=false){const list=cards();active=Math.max(0,Math.min(index,list.length-1));list.forEach((card,i)=>{card.hidden=i!==active;});[...tabs.children].forEach((button,i)=>{button.setAttribute('aria-selected',String(i===active));button.tabIndex=i===active?0:-1;});if(focus)tabs.children[active]?.focus();}
 function renderTabs(){const list=cards(),kk=document.documentElement.lang==='kk';tabs.replaceChildren();tabs.hidden=list.length<2;tabs.setAttribute('aria-label',kk?'Әнді таңдау':'Выбор песни');list.forEach((card,i)=>{card.id='voxi-song-panel-'+i;card.setAttribute('role','tabpanel');card.setAttribute('aria-labelledby','voxi-song-tab-'+i);const button=document.createElement('button');button.type='button';button.id='voxi-song-tab-'+i;button.setAttribute('role','tab');button.setAttribute('aria-controls',card.id);button.textContent=kk?(i+1)+'-ән':'Песня '+(i+1);button.addEventListener('click',()=>selectSong(i));button.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%list.length;else if(e.key==='ArrowLeft')next=(i-1+list.length)%list.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=list.length-1;else return;e.preventDefault();selectSong(next,true);});tabs.append(button);});selectSong(active);}
 let revealingInvalid=false;form.addEventListener('invalid',e=>{const list=cards(),index=list.findIndex(card=>card.contains(e.target));if(index>=0&&!revealingInvalid){revealingInvalid=true;selectSong(index);queueMicrotask(()=>{revealingInvalid=false;});}},true);
 new MutationObserver(renderTabs).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});

 function arrange(){for(const card of songs.querySelectorAll('.song-card')){if(card.dataset.compact)return;card.dataset.compact='true';const title=card.querySelector('input[type=text]'),people=card.querySelector('input[type=number]');for(const input of [title,people]){const label=card.querySelector('label[for="'+input.id+'"]'),field=document.createElement('div');field.className='voxi-booking-field';field.append(label,input);card.append(field);}card.append(card.querySelector('.song-price'));}renderTabs();}
 new MutationObserver(arrange).observe(songs,{childList:true});arrange();
 // Keep existing song names/performers when adding the next song to the draft.
 let draft=[];const quantity=document.getElementById('songs');
 quantity.addEventListener('input',()=>{draft=[...songs.querySelectorAll('.song-card')].map(c=>({title:c.querySelector('input[type=text]')?.value,people:c.querySelector('input[type=number]')?.value}));},true);
 quantity.addEventListener('input',()=>{draft.forEach((d,i)=>{const title=document.getElementById('songTitle'+i),people=document.getElementById('songPeople'+i);if(title)title.value=d.title||'';if(people)people.value=d.people||'1';});calculatePrice();const count=cards().length;if(count>lastCount)active=count-1;lastCount=count;arrange();});
})();
