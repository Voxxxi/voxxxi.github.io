import fs from 'node:fs/promises';import path from 'node:path';import vm from 'node:vm';import {spawnSync} from 'node:child_process';
const root=new URL('../',import.meta.url),files=await fs.readdir(root),errors=[];let syntax=0,inline=0,references=0;
for(const file of files.filter(n=>/\.(?:js|mjs|ts)$/.test(n)&&!n.endsWith('.test.mjs'))){const r=spawnSync(process.execPath,['--check',new URL(file,root).pathname.replace(/^\/([A-Za-z]:)/,'$1')],{encoding:'utf8'});if(r.status!==0)errors.push(file+': '+r.stderr);syntax++;}
for(const name of ['index.html','admin.html','cabinet.html','rules.html','privacy.html','install-check.html']){
 const html=await fs.readFile(new URL(name,root),'utf8');for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){if(/\bsrc=|application\/ld\+json|application\/json/.test(match[1])||!match[2].trim())continue;try{new vm.Script(match[2]);inline++;}catch(e){errors.push(name+' inline: '+e.message);}}
 for(const m of html.matchAll(/<(?:script|link|img|source)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)){const ref=m[1];if(/^(?:https?:|data:|\/\/|#)/.test(ref))continue;const rel=decodeURIComponent(ref.split(/[?#]/)[0]).replace(/^\//,'');if(!rel)continue;try{await fs.access(new URL(rel,root));references++;}catch{errors.push(name+' missing '+rel);}}
}
const publicHtml=await fs.readFile(new URL('index.html',root),'utf8'),cabinet=await fs.readFile(new URL('cabinet.html',root),'utf8');if([publicHtml,cabinet].some(s=>/src=["'](?:audio-tools|audio-local|audio-export|audio-enhance|audio-mix|ai-knowledge-admin)\./.test(s)))errors.push('Admin audio/knowledge script included in client document');
console.log(JSON.stringify({syntax,inline,references,errors},null,2));if(errors.length)process.exitCode=1;
