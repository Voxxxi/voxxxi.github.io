(()=>{
 if(!document.documentElement.hasAttribute('data-voxi-admin'))return;
 const panel=document.getElementById('schedulePanel');if(!panel)return;
 const make=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const details=make('details'),title=make('summary','＋ Записать клиента из WhatsApp');details.className='voxi-manual-booking';details.append(title);
 const intro=make('p','Час сразу станет занятым. Предварительно открывать его для клиентов не нужно. Регистрация клиента на сайте не требуется.');intro.className='notice';details.append(intro);
 const form=make('form');form.id='manualBookingForm';const fields={};
 for(const [key,label,type]of [['date','Дата записи','date'],['time','Время записи','select'],['name','Имя клиента','text'],['phone','Телефон клиента','tel'],['title','Песня или примечание (необязательно)','text'],['people','Количество исполнителей','number']]){
  const l=make('label',label),input=make(type==='select'?'select':'input');input.id='manualBooking'+key;input.name=key;l.htmlFor=input.id;if(type!=='select')input.type=type;input.required=!['title'].includes(key);if(key==='name')input.maxLength=150;if(key==='phone'){input.maxLength=40;input.placeholder='+7 700 000 00 00';}if(key==='title')input.maxLength=300;if(key==='people'){input.min='1';input.max='100';input.value='1';}
  if(key==='time')for(let h=0;h<24;h++){const o=make('option',String(h).padStart(2,'0')+':00');o.value=o.textContent;input.append(o);}form.append(l,input);fields[key]=input;
 }
 const price=make('p'),status=make('p');price.className='notice';status.setAttribute('role','status');status.setAttribute('aria-live','polite');const submit=make('button','Забронировать за клиента');submit.type='submit';submit.className='primary';form.append(price,submit,status);details.append(form);document.getElementById('scheduleDate').before(details);
 const sync=()=>{if(!fields.date.value)fields.date.value=document.getElementById('scheduleDate').value;const n=Number(fields.people.value);price.textContent='Стоимость по тарифу: '+(n===1?5000:n===2?6000:n===3?7000:n*2000)+' ₸ · 1 песня';};fields.people.addEventListener('input',sync);details.addEventListener('toggle',sync);
 document.getElementById('scheduleChoices').addEventListener('click',e=>{const b=e.target.closest('[data-manual-time]');if(!b)return;details.open=true;fields.date.value=document.getElementById('scheduleDate').value;fields.time.value=b.dataset.manualTime;sync();fields.name.focus();details.scrollIntoView({block:'center',behavior:'smooth'});});
 const decorate=()=>{for(const row of document.querySelectorAll('#scheduleChoices .admin-hour:not([data-state="busy"])')){if(row.querySelector('[data-manual-time]'))continue;const t=row.querySelector('.admin-hour-label')?.textContent;if(!t)continue;const b=make('button','Занять');b.type='button';b.className='secondary';b.dataset.manualTime=t;b.setAttribute('aria-label','Занять '+t+' за клиента');row.append(b);}};
 new MutationObserver(decorate).observe(document.getElementById('scheduleChoices'),{childList:true});decorate();
 form.addEventListener('submit',async e=>{e.preventDefault();if(!currentUser||!isAdmin()||submit.disabled)return;submit.disabled=true;status.textContent='Сохраняю бронь…';
  try{const {data,error}=await supabaseClient.rpc('voxi_manual_booking',{p_date:fields.date.value,p_time:fields.time.value,p_name:fields.name.value.trim(),p_phone:fields.phone.value.trim(),p_title:fields.title.value.trim(),p_people:Number(fields.people.value)});if(error)throw error;
   const date=fields.date.value,time=fields.time.value;form.reset();fields.date.value=date;fields.time.value=time;sync();document.getElementById('scheduleDate').value=date;await loadBookings();await loadScheduleSlots();status.textContent='Бронь №'+data+' сохранена: '+date+' в '+time+'. Час занят.';
  }catch(error){status.textContent=error.code==='23505'?'Этот час уже занят. Выберите другое время.':error.message?.includes('closed on this day')?'В этот день студия закрыта. Сначала откройте день в расписании.':error.message?.includes('future full hour')?'Выберите будущую дату и полный час.':error.message?.includes('Check client details')?'Проверьте имя, телефон и количество исполнителей.':'Не удалось сохранить бронь: '+(error.message||'проверьте соединение');}
  finally{submit.disabled=false;}
 });sync();
})();
