(()=>{
 const by=id=>document.getElementById(id),ru=()=>document.documentElement.lang!=='kk';
 const say=(r,k)=>ru()?r:k;
 let clientRequest=0,adminRequest=0,ready=false,closed=false,stateDate='',saving=false,adminError=false;
 const panel=by('schedulePanel'),date=by('scheduleDate'),status=document.createElement('p'),toggle=document.createElement('button');
 status.id='scheduleDayStatus';status.className='notice';status.setAttribute('role','status');
 toggle.id='dayOffButton';toggle.type='button';toggle.className='secondary full';toggle.disabled=true;
 if(panel&&date){(date.closest('.voxi-date-control')||date).after(toggle,status);}
 async function read(day){
  let timer;try{return await Promise.race([
   supabaseClient.from('voxi_schedule_days').select('is_closed').eq('booking_date',day).maybeSingle(),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('timeout')),15000);})
  ]);}finally{clearTimeout(timer);}
 }
 const originalAvailable=loadAvailableTimes;
 loadAvailableTimes=async function(){
  const day=by('date').value,actor=currentUser?.id,request=++clientRequest;++availableGeneration;
  if(!day||!actor)return originalAvailable();
  resetAvailableTimes(say('Проверяем расписание…','Кесте тексерілуде…'));
  try{
   const result=await read(day);
   if(request!==clientRequest||currentUser?.id!==actor||by('date').value!==day)return;
   if(result.error)throw result.error;
   if(result.data?.is_closed){resetAvailableTimes(say('Нерабочий день','Демалыс күні'));by('timeHelp').textContent=say('В этот день студия не работает. Выберите другую дату.','Бұл күні студия жұмыс істемейді. Басқа күнді таңдаңыз.');return;}
   await originalAvailable();
  }catch{if(request===clientRequest&&currentUser?.id===actor&&by('date').value===day){resetAvailableTimes(say('Не удалось проверить расписание','Кестені тексеру мүмкін болмады'));by('timeHelp').textContent=say('Выберите дату ещё раз, чтобы обновить расписание.','Кестені жаңарту үшін күнді қайта таңдаңыз.');}}
 };
 function paint(){
  toggle.textContent=closed?say('Сделать рабочим днём','Жұмыс күні ету'):say('Нерабочий день','Демалыс күні');toggle.setAttribute('aria-pressed',String(closed));toggle.disabled=saving||!ready||!date?.value||!isAdmin();
  status.textContent=!date?.value?say('Сначала выберите дату.','Алдымен күнді таңдаңыз.'):!ready?(adminError?say('Не удалось проверить статус дня. Выберите дату ещё раз.','Күннің күйін тексеру мүмкін болмады. Күнді қайта таңдаңыз.'):say('Проверяем статус дня…','Күннің күйі тексерілуде…')):closed?say('Нерабочий день — клиентам запись недоступна. Существующие записи сохранены.','Демалыс күні — клиенттер жазыла алмайды. Бұрынғы жазылулар сақталады.'):say('Рабочий день. Откройте часы, в которые готовы принимать клиентов.','Жұмыс күні. Клиенттерді қабылдайтын уақытты ашыңыз.');
  if(!ready||closed||saving){for(const id of ['scheduleChoices','scheduleList'])by(id)?.querySelectorAll('button,input[type="checkbox"]').forEach(n=>n.disabled=true);}
  if(by('openSlotsButton'))by('openSlotsButton').disabled=!ready||closed||saving;
 }
 const originalRender=renderScheduleChoices;
 renderScheduleChoices=function(){originalRender();paint();};
 async function loadDay(){
  const day=date?.value,actor=currentUser?.id,request=++adminRequest;ready=false;closed=false;adminError=false;stateDate=day;paint();
  if(!day||!isAdmin())return;
  try{const result=await read(day);if(request!==adminRequest||currentUser?.id!==actor||date.value!==day||!isAdmin())return;if(result.error)throw result.error;closed=!!result.data?.is_closed;ready=true;renderScheduleChoices();paint();}
  catch{if(request===adminRequest&&currentUser?.id===actor&&date.value===day){adminError=true;paint();}}
 }
 const originalSchedule=loadScheduleSlots;
 loadScheduleSlots=async function(){await Promise.all([loadDay(),originalSchedule()]);paint();};
 toggle.addEventListener('click',async()=>{
  if(!isAdmin()||!ready||saving||stateDate!==date.value)return;
  const day=date.value,actor=currentUser?.id,next=!closed;saving=true;paint();
  try{
   const {error}=await supabaseClient.from('voxi_schedule_days').upsert({booking_date:day,is_closed:next},{onConflict:'booking_date'});
   if(error)throw error;
   if(currentUser?.id!==actor||!isAdmin())return;
   showMessage(next?say('День отмечен как нерабочий.','Күн демалыс күні болып белгіленді.'):say('День снова рабочий. Проверьте открытые часы.','Күн қайтадан жұмыс күні болды. Ашық уақытты тексеріңіз.'),'success');
   await loadScheduleSlots();if(by('date').value===day)await loadAvailableTimes();
  }catch{if(currentUser?.id===actor)showMessage(say('Не удалось изменить день. Обновите расписание и проверьте его статус.','Күнді өзгерту мүмкін болмады. Кестені жаңартып, күйін тексеріңіз.'),'error');}
  finally{saving=false;if(currentUser?.id===actor&&isAdmin()){renderScheduleChoices();paint();}}
 });
 function relabel(){paint();if(currentUser&&by('date')?.value)void loadAvailableTimes();}
 by('ru')?.addEventListener('click',relabel);by('kk')?.addEventListener('click',relabel);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)return;if(isAdmin()&&date?.value)void loadScheduleSlots();if(currentUser&&by('date')?.value)void loadAvailableTimes();});
 if(isAdmin()&&date?.value)void loadDay();
})();
