import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const videoDir=await mkdtemp(path.join(tmpdir(),'flavio-weapon-'));
const browser=await chromium.launch({headless:true,chromiumSandbox:true,
  executablePath:process.env.BROWSER_PATH||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ignoreDefaultArgs:['--unsafely-disable-devtools-self-xss-warnings','--enable-unsafe-swiftshader'],
  args:['--mute-audio','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
let context;
try{
  const bundle=await readFile(path.join(root,'extension/bot.js'),'utf8');
  const errors=[];
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  const load=async p=>{await p.goto('https://cadeflavio.run/?debug',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__game);await p.addScriptTag({content:bundle});};
  const snapshot=p=>p.evaluate(()=>({state:__game.state,x:__game.player.x,lives:__game.player.lives,
    speed:__game.player.speed,running:__flavioBot.status.running,shots:__flavioBot.weapon.state.shots,
    hits:__flavioBot.weapon.state.hits,hitKinds:{...__flavioBot.weapon.state.hitKinds},
    bullets:__flavioBot.weapon.state.bullets.length,trigger:__flavioBot.weapon.state.trigger,
    enemies:__game.enemies.length,cars:__game.cars.length}));
  await load(page);
  await page.locator('#btn-start').click();await page.locator('#btn-confirm').click();
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(900);await page.keyboard.up('ArrowRight');
  const before=await snapshot(page);
  assert.equal(before.shots,0);assert.equal(before.running,false);
  await page.keyboard.down('j');
  await page.waitForFunction(()=>__flavioBot.weapon.state.hits>0,{},{timeout:5000});
  await page.keyboard.up('j');
  const manual=await snapshot(page);
  assert.ok(manual.shots>0&&manual.hits>0);assert.equal(manual.running,false);
  assert.ok(manual.enemies+manual.cars<before.enemies+before.cars);
  const stops=[];
  for(const key of ['F8','Escape']){
    await page.keyboard.down('j');await page.waitForTimeout(210);await page.keyboard.press(key);
    const stopped=await snapshot(page);
    // Uma tecla ainda segurada pode continuar gerando repetição depois da parada.
    await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'j',repeat:true,bubbles:true,cancelable:true})));
    await page.waitForTimeout(350);
    const later=await snapshot(page);await page.keyboard.up('j');
    assert.equal(stopped.bullets,0);assert.equal(stopped.trigger,false);assert.equal(later.shots,stopped.shots);
    stops.push({key,shots:stopped.shots});
  }
  const panel=page.locator('#flavio-bot-panel');
  await panel.locator('#weapon-toggle').click();
  const disabled=await snapshot(page);await page.keyboard.press('j');await page.waitForTimeout(250);
  assert.equal((await snapshot(page)).shots,disabled.shots);
  await page.close();
  context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:videoDir,size:{width:1280,height:720}}});
  const demo=await context.newPage();demo.on('pageerror',e=>errors.push(e.message));
  await load(demo);
  assert.equal((await snapshot(demo)).shots,0);
  const demoPanel=demo.locator('#flavio-bot-panel');
  await demoPanel.getByRole('button',{name:'Iniciar tentativa',exact:true}).click();
  await demo.keyboard.press('g');
  await demo.waitForFunction(()=>__flavioBot.weapon.state.bullets.length>0&&__game.player.x>400,{},{timeout:10000});
  await demo.screenshot({path:path.join(root,'reports/weapon-preview.png')});
  await demo.waitForFunction(()=>!__flavioBot.status.running,{},{timeout:125000});
  await demo.waitForFunction(()=>document.querySelector('#flavio-bot-panel').shadowRoot.querySelector('#status').textContent===__flavioBot.status.message);
  const automatic=await snapshot(demo);
  const events=await demo.evaluate(()=>__flavioBot.weapon.state.events);
  await demo.screenshot({path:path.join(root,'reports/weapon-result.png')});
  assert.equal(automatic.state,'cabin');assert.ok(automatic.hits>0);assert.equal(automatic.speed,245);
  await demo.waitForTimeout(1000);
  const video=demo.video();await demo.close();const rawVideoPath=await video.path();
  const fast=await context.newPage();fast.on('pageerror',e=>errors.push(e.message));await load(fast);
  const fastPanel=fast.locator('#flavio-bot-panel');await fastPanel.locator('[data-speed="20"]').click();
  await fastPanel.getByRole('button',{name:'Iniciar tentativa',exact:true}).click();
  await fast.waitForFunction(()=>!__flavioBot.status.running,{},{timeout:20000});
  const speed20=await snapshot(fast);assert.equal(speed20.state,'cabin');
  await fast.close();assert.deepEqual(errors,[]);
  const report={date:new Date().toISOString(),checks:{manual:true,stops,disabled:true,reload:true,noPageErrors:true},
    manual:{before,after:manual},automatic,speed20,events,rawVideoPath};
  await writeFile(path.join(root,'reports/weapon-validation.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({checks:report.checks,automatic,speed20,rawVideoPath}));
}finally{await context?.close();await browser.close();}
