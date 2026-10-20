(()=>{
 'use strict';
 window.voxiDiscountPrice=(base,percent)=>{if(!Number.isSafeInteger(base)||base<0||!Number.isInteger(percent)||percent<0||percent>90)throw Error('Invalid offer');return Math.floor(base*(100-percent)/100);};
 window.voxiCreateOfferLookup=({rpc,changed=()=>{},timeout=15000})=>{
  let generation=0,state={key:'',percent:0,id:null,ready:true},pending=null;
  const key=(day,time)=>day&&time?day+'|'+time:'';
  function get(day,time){return state.key===key(day,time)?{...state}:{key:key(day,time),percent:0,id:null,ready:!key(day,time)};}
  async function load(day,time,force=false){
   const wanted=key(day,time);if(!force&&state.key===wanted&&(state.ready||pending))return pending||{...state};
   const request=++generation;state={key:wanted,percent:0,id:null,ready:!wanted};pending=null;changed();if(!wanted)return {...state};
   let timer;pending=(async()=>{try{
    const result=await Promise.race([rpc(day,time),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timeout')),timeout);})]);
    if(request!==generation)return null;
    if(result.error||!Number.isInteger(result.data?.percent)||result.data.percent<0||result.data.percent>90)throw Error('Offer unavailable');
    state={key:wanted,percent:result.data.percent,id:result.data.id||null,ready:true};return {...state};
   }catch{if(request===generation)state={key:wanted,percent:0,id:null,ready:false,error:true};return null;}
   finally{clearTimeout(timer);if(request===generation){pending=null;changed();}}})();return pending;
  }
  return {get,load,reset(){generation++;pending=null;state={key:'',percent:0,id:null,ready:true};changed();}};
 };
})();
