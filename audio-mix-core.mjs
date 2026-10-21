export function mixStems(music,voice,musicDb=0,voiceDb=0){
 if(![musicDb,voiceDb].every(n=>Number.isFinite(n)&&n>=-24&&n<=12)||![music,voice].every(s=>s&&[1,2].includes(s.length)&&s[0]?.length&&s.every(c=>c.length===s[0].length))||Math.abs(music[0].length-voice[0].length)>2205)throw Error('Несовместимые дорожки');
 const count=Math.max(music.length,voice.length),length=Math.max(music[0].length,voice[0].length),a=10**(musicDb/20),b=10**(voiceDb/20);
 return Array.from({length:count},(_,c)=>{const output=new Float32Array(length),m=music[c]||music[0],v=voice[c]||voice[0];for(let i=0;i<length;i++)output[i]=(m[i]||0)*a+(v[i]||0)*b;return output;});
}
