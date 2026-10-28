import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const planner=await readFile(new URL('src/planner.js',root),'utf8');
const controller=await readFile(new URL('src/controller.js',root),'utf8');
const bundle=`/* Flávio Autoplayer 0.1.0 — local, sem serviços externos */\n(()=>{\n'use strict';\n${planner.replaceAll('export function ','function ')}\n${controller.replace(/^import .*\n/,'').replaceAll('export function ','function ')}\ninstallBot(window,document);\n})();\n`;
await writeFile(new URL('extension/bot.js',root),bundle);
console.log('Extensão criada em extension/');
