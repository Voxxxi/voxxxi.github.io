/* Format checks, not identity or phone ownership verification. Keep SQL rules in sync. */
(()=>{
 const clean=value=>String(value||'').normalize('NFC').trim().replace(/\s+/g,' ');
 function validPart(value){
  const text=clean(value);if(text.length<2||text.length>75||! /^[\p{L}\p{M}]+(?:[ '\u2019\-][\p{L}\p{M}]+)*$/u.test(text))return false;
  return text.split(/[ '\u2019\-]+/u).every(word=>{
   const lower=word.toLocaleLowerCase();
   return !/(.)\1{3}/u.test(lower)&&!['qwerty','asdfgh','zxcvbn','йцукен','фывапр','ячсмит'].includes(lower)&&
    (word.length<5||/[aeiouyàáâãäåæèéêëìíîïòóôõöøùúûüýÿāăąēĕėęěĩīĭįıōŏőœũūŭůűųаәеёиіоөұүуыэюя]/iu.test(word));
  });
 }
 function phone(value){
  const raw=String(value||'').trim();if(!/^\+?[0-9\s().-]+$/.test(raw))return null;
  let digits=raw.replace(/\D/g,'');if(digits.length===10)digits='7'+digits;
  if(digits.length===11&&digits[0]==='8')digits='7'+digits.slice(1);
  if(!/^7(?:700|701|702|705|706|707|708|747|771|775|776|777|778)\d{7}$/.test(digits))return null;
  return '+'+digits;
 }
 function complete(profile){const names=clean(profile?.full_name).split(' ');return names.length>=2&&names.join(' ').length<=150&&names.every(validPart)&&!!phone(profile?.phone);}
 window.voxiProfileValidation={clean,validPart,phone,complete};
})();

