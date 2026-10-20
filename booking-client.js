(()=>{
 'use strict';
 const studioNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Oral',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).replace(' ','T');
 window.voxiCanCancel=b=>b.status==='Запланировано'&&b.booking_date+'T'+String(b.booking_time).slice(0,5)>studioNow();
 window.voxiCancelControl=({client,booking,make,ru,isCurrent,onDone})=>{
  if(!window.voxiCanCancel(booking))return null;
  const wrap=make('div'),button=make('button',ru?'Отменить запись':'Жазылудан бас тарту','cabinetExit'),note=make('p');
  button.type='button';note.setAttribute('role','status');wrap.append(button,note);
  let busy=false;
  button.addEventListener('click',async()=>{
   if(busy||!isCurrent())return;
   if(!confirm(ru?'Отменить запись на '+booking.booking_date+' в '+String(booking.booking_time).slice(0,5)+'? Если до записи мало времени, предупредите студию в WhatsApp.':'Осы жазылудан бас тартасыз ба? Уақыт аз қалса, студияға WhatsApp арқылы хабарлаңыз.'))return;
   busy=true;button.disabled=true;
   try{
    const {data,error}=await client.rpc('voxi_cancel_booking',{booking_id:booking.id});
    if(!isCurrent())return;
    if(error||data?.status!=='Отменено')throw Error('cancel');
    booking.status='Отменено';onDone();
   }catch{if(isCurrent())note.textContent=ru?'Не удалось подтвердить отмену. Обновите историю перед повтором или свяжитесь со студией.':'Бас тарту расталмады. Қайталамас бұрын тарихты жаңартыңыз немесе студияға хабарласыңыз.';}
   finally{busy=false;if(isCurrent())button.disabled=false;}
  });return wrap;
 };
})();
