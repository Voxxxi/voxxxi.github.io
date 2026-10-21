// Defaults belong to a booking draft. Editing them never updates the profile.
window.voxiCreateBookingPrefill=function({fields,isCurrent}){
 const touched=new Set();for(const [key,field]of Object.entries(fields))field.addEventListener('input',()=>touched.add(key));
 return{
  reset(){touched.clear();for(const [key,field]of Object.entries(fields)){field.value='';if(key==='phone')window.voxiPhoneInput?.set(field,'');}},
  apply(profile,actor){if(!isCurrent(actor)||!profile)return;const values={name:profile.full_name||'',phone:profile.phone||''};for(const [key,field]of Object.entries(fields))if(!touched.has(key)){field.value=values[key]||'';if(key==='phone')window.voxiPhoneInput?.set(field,values[key]);}},
  next(profile,actor){this.reset();this.apply(profile,actor);}
 };
};
