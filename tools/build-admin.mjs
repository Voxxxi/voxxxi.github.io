// Build the admin document from the shared authentication and booking shell.
// Run with: node tools/build-admin.mjs
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
let html=await readFile(new URL('index.html',root),'utf8');
html=html.replace('<html lang="ru">','<html lang="ru" data-voxi-admin="true">')
 .replace('<title>VOXi — Recording Studio</title>','<title>VOXi — Рабочий кабинет</title>')
 .replace('<head>','<head><meta name="robots" content="noindex,nofollow">')
 .replace('<a class="brand" href="#"','<a class="brand" href="./"')
 .replace(/<script src="\/(?:public-videos|concert-loop)\.js[^>]*><\/script>\s*/g,'');
await writeFile(new URL('admin.html',root),html);
