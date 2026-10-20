import {AwsClient} from 'npm:aws4fetch@1.0.20';
import {parseInventoryPage} from './r2-core.mjs';
const root='https://4a45f6c4765d1984338638f95f4f4c83.r2.cloudflarestorage.com/voxi-private';
export const configured=()=>!!Deno.env.get('VOXI_R2_ACCESS_KEY_ID')&&!!Deno.env.get('VOXI_R2_SECRET_ACCESS_KEY');
function client(){if(!configured())throw Error('R2 not configured');return new AwsClient({accessKeyId:Deno.env.get('VOXI_R2_ACCESS_KEY_ID')!,secretAccessKey:Deno.env.get('VOXI_R2_SECRET_ACCESS_KEY')!,service:'s3',region:'auto',retries:0});}
export function objectUrl(path:string){if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(mp3|wav|m4a|ogg|flac)$/i.test(path))throw Error('Invalid object path');return root+'/'+path;}
export async function inventory(){let bytes=0,objects=0,next:string|null=null;for(let page=0;page<100;page++){
 const u=new URL(root);u.searchParams.set('list-type','2');if(next)u.searchParams.set('continuation-token',next);
 const r=await client().fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('R2 inventory failed');
 const p=parseInventoryPage(await r.text());bytes+=p.bytes;objects+=p.objects;next=p.next;if(!next)return {bytes,objects};
 }throw Error('R2 inventory too large');}
export async function putObject(path:string,bytes:Uint8Array,type:string){const r=await client().fetch(objectUrl(path),{method:'PUT',body:bytes,headers:{'Content-Type':type,'If-None-Match':'*'},signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('R2 upload failed');}
export async function headObject(path:string){const r=await client().fetch(objectUrl(path),{method:'HEAD',signal:AbortSignal.timeout(15000)});if(r.status===404)return null;if(!r.ok)throw Error('R2 verification failed');const size=r.headers.get('Content-Length');if(!size||!/^\d+$/.test(size))throw Error('Unknown object size');return Number(size);}
export async function deleteObject(path:string){const r=await client().fetch(objectUrl(path),{method:'DELETE',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('R2 deletion failed');if(await headObject(path)!==null)throw Error('R2 deletion unconfirmed');}
export async function signedGet(path:string,name?:string){const u=new URL(objectUrl(path));u.searchParams.set('X-Amz-Expires','900');if(name){const safe=name.replace(/[\r\n"\\]/g,'_');u.searchParams.set('response-content-disposition',`attachment; filename="audio.${safe.split('.').pop()?.replace(/[^a-z0-9]/gi,'')||'mp3'}"; filename*=UTF-8''${encodeURIComponent(safe)}`);}return (await client().sign(new Request(u),{aws:{signQuery:true}})).url;}
