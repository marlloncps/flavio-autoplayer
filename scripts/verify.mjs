import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const reports=path.join(root,'reports');await mkdir(reports,{recursive:true});
const executablePath=process.env.BROWSER_PATH||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const browser=await chromium.launch({headless:true,executablePath,chromiumSandbox:true,
  ignoreDefaultArgs:['--unsafely-disable-devtools-self-xss-warnings','--enable-unsafe-swiftshader'],
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--mute-audio']});
const results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>console.error('PAGE ERROR:',e.message));
  await page.goto('https://cadeflavio.run/?debug',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>window.__game,{timeout:15000});
  await page.addScriptTag({content:await readFile(path.join(root,'extension/bot.js'),'utf8')});
  const panel=page.locator('#flavio-bot-panel');
  // A interrupção deve funcionar também no navegador real, não só nos testes unitários.
  await panel.getByRole('button',{name:'Iniciar tentativa',exact:true}).click();
  await page.waitForTimeout(250);await page.keyboard.press('F8');
  const emergency=await page.evaluate(()=>({stopped:!window.__flavioBot.status.running,message:window.__flavioBot.status.message}));
  if(!emergency.stopped)throw new Error('F8 não interrompeu o bot');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game);
  await page.addScriptTag({content:await readFile(path.join(root,'extension/bot.js'),'utf8')});
  for(let i=1;i<=Number(process.env.ATTEMPTS||3);i++) {
    const start=Date.now();
    await panel.getByRole('button',{name:'Iniciar tentativa',exact:true}).click();
    await page.waitForFunction(()=>!window.__flavioBot.status.running,{},{timeout:125000});
    const result=await page.evaluate(()=>({state:window.__game.state,player:{...window.__game.player},
      status:{...window.__flavioBot.status},logs:window.__flavioBot.logs}));
    const summary={attempt:i,state:result.state,x:result.player.x,y:result.player.y,lives:result.player.lives,
      progress:result.status.progress,durationMs:Date.now()-start,decisions:result.status.decisions,message:result.status.message,
      meanDecisionMs:result.logs.filter(x=>x.type==='decision').reduce((n,x)=>n+x.decisionMs,0)/Math.max(1,result.status.decisions)};
    results.push(summary);console.log(JSON.stringify(summary));
    await writeFile(path.join(reports,`attempt-${i}.ndjson`),result.logs.map(x=>JSON.stringify(x)).join('\n'));
    await page.screenshot({path:path.join(reports,`attempt-${i}.png`)});
    if(result.state==='cabin'&&process.env.ALL_ATTEMPTS!=='1')break;
    if(result.state==='cabin'){
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__game);
      await page.addScriptTag({content:await readFile(path.join(root,'extension/bot.js'),'utf8')});
    }
  }
  await writeFile(path.join(reports,'validation.json'),JSON.stringify({date:new Date().toISOString(),url:'https://cadeflavio.run/?debug',
    browser:'isolated headless Brave',emergency,results,wins:results.filter(r=>r.state==='cabin').length},null,2));
  if(!results.some(r=>r.state==='cabin'))process.exitCode=1;
} finally {await browser.close();}
