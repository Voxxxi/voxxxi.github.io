export function parseInventoryPage(xml){
 if(!xml.includes('<ListBucketResult')||/<Error[ >]/.test(xml))throw Error('Invalid R2 inventory');
 const contents=[...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)];let bytes=0;
 for(const [,part]of contents){const size=part.match(/<Size>(\d+)<\/Size>/)?.[1];if(size===undefined||!Number.isSafeInteger(Number(size)))throw Error('Unknown size');bytes+=Number(size);if(!Number.isSafeInteger(bytes))throw Error('Invalid total');}
 const truncated=xml.match(/<IsTruncated>(true|false)<\/IsTruncated>/)?.[1];
 if(!truncated)throw Error('Incomplete inventory');
 const next=xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/)?.[1]?.replaceAll('&amp;','&');
 if(truncated==='true'&&!next)throw Error('Missing continuation');
 return {bytes,objects:contents.length,next:truncated==='true'?next:null};
}
export async function readExactBody(request,expected){
 if(!Number.isSafeInteger(expected)||expected<1||expected>50*1024*1024||!request.body)throw Error('Invalid file size');
 const out=new Uint8Array(expected),reader=request.body.getReader();let offset=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;if(value.length>expected-offset)throw Error('File too large');out.set(value,offset);offset+=value.length;}if(offset!==expected)throw Error('File incomplete');return out;}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
export function validAudio(bytes,name){
 const ext=name.split('.').pop().toLowerCase(),t=String.fromCharCode(...bytes.subarray(0,16));
 return ext==='mp3'?(t.startsWith('ID3')||(bytes[0]===255&&(bytes[1]&224)===224)):
 ext==='wav'?t.startsWith('RIFF')&&t.slice(8,12)==='WAVE':ext==='m4a'?t.slice(4,8)==='ftyp':ext==='ogg'?t.startsWith('OggS'):ext==='flac'?t.startsWith('fLaC'):false;
}
export async function readJsonBody(request){
 if(!request.body)throw Error('Missing request');const reader=request.body.getReader(),decoder=new TextDecoder();let size=0,text='';
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096)throw Error('Request too large');text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
