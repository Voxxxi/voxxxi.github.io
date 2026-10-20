/* Technical event codes only. Never record messages, stacks, form values or URLs. */
(()=>{
 'use strict';
 const key='voxi-tech-events-v1',allowed=new Set(['index.html','admin.html','cabinet.html','admin-users.js','admin-workspace.js','income.js','portfolio.js','public-videos.js','video-client.js','video-moderation.js','chat.js','date-controls.js','track-upload.js','ui-language.js','maintenance.js','install.js','pwa.js']);
 const page=()=>{const name=location.pathname.split('/').pop()||'index.html';return allowed.has(name)?name:'other';};
 let events=[];
 function valid(e){return e&&['script-error','resource-error','promise-rejection'].includes(e.kind)&&allowed.has(e.asset)&&typeof e.at==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.at)&&Number.isInteger(e.line)&&e.line>=0;}
 try{const saved=JSON.parse(sessionStorage.getItem(key)||'[]');if(Array.isArray(saved))events=saved.filter(valid).slice(-20).map(e=>({kind:e.kind,asset:e.asset,at:e.at,line:e.line}));}catch{}
 function add(kind,url,line){let asset=page();try{const name=new URL(url,location.href).pathname.split('/').pop();if(allowed.has(name))asset=name;}catch{}events.push({kind,asset,at:new Date().toISOString(),line:Number.isSafeInteger(line)&&line>0?line:0});events=events.slice(-20);try{sessionStorage.setItem(key,JSON.stringify(events));}catch{}}
 window.addEventListener('error',e=>add(e.target&&e.target!==window?'resource-error':'script-error',e.filename||'',e.lineno),true);
 window.addEventListener('unhandledrejection',()=>add('promise-rejection','',0));
 window.voxiDiagnostics={snapshot:()=>events.map(e=>({...e})),clear:()=>{events=[];try{sessionStorage.removeItem(key);}catch{}}};
})();
