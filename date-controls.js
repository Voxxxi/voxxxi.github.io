(() => {
 'use strict';
 const options=[['','Без ограничения'],['week','Неделя'],['month','Месяц'],['half-year','Полгода'],['year','Год']];
 function until(preset,from=new Date(),day){
  if(preset==='')return null;
  const date=new Date(from);
  if(!Number.isFinite(date.getTime()))throw Error('Некорректная дата.');
  if(preset==='custom'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))throw Error('Выберите дату окончания хранения.');
   const [year,month,number]=day.split('-').map(Number);date.setFullYear(year,month-1,number);
   if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==number)throw Error('Выберите существующую дату.');
  }else if(preset==='week')date.setDate(date.getDate()+7);
  else{
   const months={month:1,'half-year':6,year:12}[preset];
   if(!months)throw Error('Выберите срок хранения.');
   const number=date.getDate();date.setDate(1);date.setMonth(date.getMonth()+months);
   const last=new Date(date.getFullYear(),date.getMonth()+1,0).getDate();date.setDate(Math.min(number,last));
  }
  date.setHours(23,59,59,999);return date.toISOString();
 }
 function localDay(value){const d=new Date(value);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
 function enhance(input,label){
  if(!input||input.dataset.voxiCalendar)return;input.dataset.voxiCalendar='true';
  const wrap=document.createElement('div');wrap.className='voxi-date-control';input.before(wrap);wrap.append(input);
  const open=document.createElement('button');open.type='button';open.className='voxi-calendar-open';
  const icon=document.createElement('span');icon.textContent='▦';icon.setAttribute('aria-hidden','true');
  const caption=document.createElement('span');open.append(icon,caption);open.setAttribute('aria-label',label||'Открыть календарь');
  const update=()=>{caption.textContent=input.value?'Изменить дату':'Выбрать дату';};update();input.addEventListener('change',update);
  open.addEventListener('click',()=>{try{if(typeof input.showPicker==='function'){input.showPicker();return;}}catch{}input.focus();input.click();});wrap.append(open);
 }
 window.voxiRetention={options,until,localDay};window.voxiEnhanceDate=enhance;
 enhance(document.getElementById('date'),'Открыть календарь даты записи');
 enhance(document.getElementById('scheduleDate'),'Открыть календарь расписания');
})();
