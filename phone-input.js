/* Presentation only: the existing profile validator remains the authority. */
(()=>{
 function format(raw){const text=String(raw||'').trim();if(text.startsWith('+')&&!text.startsWith('+7'))return text;let digits=text.replace(/\D/g,'');if(text.startsWith('+7')||digits.length===11&&/^[78]/.test(digits))digits=digits.slice(1);digits=digits.slice(0,10);const groups=[digits.slice(0,3),digits.slice(3,6),digits.slice(6,8),digits.slice(8,10)].filter(Boolean);return '+7 '+groups.join(' ');}
 function set(input,value){if(input)input.value=format(value);}
 function bind(input){if(!input||input.dataset.voxiPhone)return;input.dataset.voxiPhone='true';input.inputMode='tel';input.autocomplete='tel';input.maxLength=30;set(input,input.value);
  input.addEventListener('focus',()=>{if(!input.value.trim()||input.value.trim()==='+7'){set(input,'');input.setSelectionRange(input.value.length,input.value.length);}});
  input.addEventListener('beforeinput',e=>{if(e.inputType==='deleteContentBackward'&&input.selectionStart===input.selectionEnd&&input.selectionStart<=3)e.preventDefault();});
  input.addEventListener('input',()=>{const caret=input.selectionStart??input.value.length,before=input.value.slice(0,caret).replace(/\D/g,'').length;set(input,input.value);let p=3,count=0;for(let i=0;i<input.value.length;i++){if(/\d/.test(input.value[i]))count++;if(count>=before){p=Math.max(3,i+1);break;}}input.setSelectionRange(p,p);});
  input.addEventListener('paste',e=>{const text=e.clipboardData?.getData('text');if(!text)return;e.preventDefault();const digits=text.replace(/\D/g,'');if(digits.length>=10)set(input,text);else set(input,input.value.slice(0,input.selectionStart)+text+input.value.slice(input.selectionEnd));input.setSelectionRange(input.value.length,input.value.length);input.dispatchEvent(new Event('input',{bubbles:true}));});
 }
 const scan=()=>{for(const id of ['phone','contactPhoneInput','manualBookingphone']){const field=document.getElementById(id);bind(field);if(field&&!field.value.trim())set(field,'');}};
 window.voxiPhoneInput={format,set,bind};if(typeof document!=='undefined'){scan();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});document.addEventListener('reset',()=>setTimeout(scan,0));}
})();
