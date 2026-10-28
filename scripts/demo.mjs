import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'reports');await mkdir(out,{recursive:true});
const videoDir=await mkdtemp(path.join(tmpdir(),'flavio-visual-'));
const browser=await chromium.launch({headless:true,chromiumSandbox:true,
  executablePath:process.env.BROWSER_PATH||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ignoreDefaultArgs:['--unsafely-disable-devtools-self-xss-warnings','--enable-unsafe-swiftshader'],
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--mute-audio']});
let context;
try{
  context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:videoDir,size:{width:1280,height:720}}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://cadeflavio.run/?debug',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game);
  await page.addScriptTag({content:await readFile(path.join(root,'extension/bot.js'),'utf8')});
  const panel=page.locator('#flavio-bot-panel');
  await panel.getByRole('button',{name:'Iniciar tentativa',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('#flavio-bot-overlay')?.dataset.obstacles)>0);
  // Botões visuais e atalhos não devem parar o controlador nem interferir no jogo.
  await page.keyboard.press('v');
  const hidden=await page.evaluate(()=>document.querySelector('#flavio-bot-overlay').style.display==='none');
  await page.keyboard.press('v');await page.keyboard.press('g');
  const recording=await page.evaluate(()=>document.querySelector('#flavio-bot-panel').classList.contains('recording')&&window.__flavioBot.status.running);
  if(!hidden||!recording)throw new Error('Controles visuais não funcionaram');
  const screenshotTask=(async()=>{
    await page.waitForFunction(()=>window.__game.player.x>1000&&window.__game.state==='playing');
    const geometry=await page.evaluate(()=>{
      const game=document.querySelector('#game').getBoundingClientRect(),overlay=document.querySelector('#flavio-bot-overlay').getBoundingClientRect();
      return {game:{x:game.x,y:game.y,width:game.width,height:game.height},overlay:{x:overlay.x,y:overlay.y,width:overlay.width,height:overlay.height}};
    });
    if(Math.abs(geometry.game.x-geometry.overlay.x)>1||Math.abs(geometry.game.y-geometry.overlay.y)>1||Math.abs(geometry.game.width-geometry.overlay.width)>1)
      throw new Error('Camada visual desalinhada com o jogo');
    await page.screenshot({path:path.join(out,'visual-preview.png')});return geometry;
  })();
  await page.waitForFunction(()=>!window.__flavioBot.status.running,{},{timeout:125000});
  const geometry=await screenshotTask;
  await page.waitForFunction(()=>document.querySelector('#flavio-bot-panel').shadowRoot.querySelector('#status').textContent===window.__flavioBot.status.message);
  const result=await page.evaluate(()=>({state:window.__game.state,status:{...window.__flavioBot.status},
    overlayVisible:window.__flavioBot.visuals.settings.enabled}));
  await page.screenshot({path:path.join(out,'visual-result.png')});
  if(errors.length)throw new Error('Erros na página: '+errors.join('; '));
  const video=page.video();await page.close();const rawVideoPath=await video.path();
  const report={date:new Date().toISOString(),...result,checks:{toggleBoxes:hidden,recordingMode:recording,noPageErrors:true},geometry,rawVideoPath};
  await writeFile(path.join(out,'visual-validation.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));if(result.state!=='cabin')process.exitCode=1;
}finally{await context?.close();await browser.close();}
