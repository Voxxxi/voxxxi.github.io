(()=>{
 if(document.documentElement.hasAttribute('data-voxi-admin'))return;
 const form=document.getElementById('bookingForm');if(!form)return;
 function group(ids,cls){const grid=document.createElement('div');grid.className=cls;for(const id of ids){const input=document.getElementById(id),label=form.querySelector('label[for="'+id+'"]');if(!input||!label)continue;const field=document.createElement('div');field.className='voxi-booking-field';const control=input.closest('.voxi-date-control')||input;field.append(label,control);grid.append(field);}return grid;}
 const contact=group(['name','phone'],'voxi-booking-contacts'),options=group(['date','time','songs'],'voxi-booking-options');form.prepend(contact,options);
 const help=document.getElementById('timeHelp');options.after(help);form.querySelector(':scope>.notice')?.remove();
 const songs=document.getElementById('songFields');form.classList.add('voxi-booking-compact');
 function arrange(){for(const card of songs.querySelectorAll('.song-card')){if(card.dataset.compact)return;card.dataset.compact='true';const title=card.querySelector('input[type=text]'),people=card.querySelector('input[type=number]');for(const input of [title,people]){const label=card.querySelector('label[for="'+input.id+'"]'),field=document.createElement('div');field.className='voxi-booking-field';field.append(label,input);card.append(field);}card.append(card.querySelector('.song-price'));}}
 new MutationObserver(arrange).observe(songs,{childList:true});arrange();
 // Keep existing song names/performers when adding the next song to the draft.
 let draft=[];const quantity=document.getElementById('songs');
 quantity.addEventListener('input',()=>{draft=[...songs.querySelectorAll('.song-card')].map(c=>({title:c.querySelector('input[type=text]')?.value,people:c.querySelector('input[type=number]')?.value}));},true);
 quantity.addEventListener('input',()=>{draft.forEach((d,i)=>{const title=document.getElementById('songTitle'+i),people=document.getElementById('songPeople'+i);if(title)title.value=d.title||'';if(people)people.value=d.people||'1';});calculatePrice();arrange();});
})();
