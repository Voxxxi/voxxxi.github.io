// Build the admin document from the shared authentication and booking shell.
// Run with: node tools/build-admin.mjs
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
let html=await readFile(new URL('index.html',root),'utf8');
html=html.replace(/<html lang="ru"(?: data-voxi-home)?>/,'<html lang="ru" data-voxi-admin="true">')
 .replace('<title>VOXi — Recording Studio</title>','<title>VOXi — Рабочий кабинет</title>')
 .replace('<head>','<head><meta name="robots" content="noindex,nofollow">')
 .replace('<a class="brand" href="#"','<a class="brand" href="./"')
 .replace(/<script src="\/(?:public-videos|concert-loop)\.js[^>]*><\/script>\s*/g,'');
html=html.replace(/<link rel="stylesheet" href="\/home\.css[^>]*>/g,'').replace(/<script src="\/home\.js[^>]*><\/script>/g,'');
html=html.replace('</head>','<link rel="stylesheet" href="audio-tools.css?v=4"><link rel="stylesheet" href="ai-knowledge-admin.css?v=1"></head>')
 .replace('<script src="admin-workspace.js?v=stats1"></script>','<script src="manual-booking.js?v=3"></script><script src="audio-drop.js?v=1"></script><script src="audio-local.js?v=1"></script><script src="audio-export.js?v=1"></script><script type="module" src="audio-enhance.mjs?v=1"></script><script src="audio-tools.js?v=7"></script><script src="audio-mix.js?v=1"></script><script src="ai-knowledge-admin.js?v=1"></script><script src="admin-workspace.js?v=ai1"></script>');
await writeFile(new URL('admin.html',root),html);
