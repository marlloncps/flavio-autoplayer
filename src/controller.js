import { decide, validate } from './planner.js';

export function readSnapshot(win) {
  const g=win.__game;
  if(!g) throw new Error('Abra o jogo com ?debug para habilitar a leitura.');
  const fields=(object,names)=>Object.fromEntries(names.map(k=>[k,object[k]]));
  const s={state:g.state,
    player:fields(g.player,['x','y','r','speed','lives','invuln']),
    gate:fields(g.gate,['x','arm','timer','openDur','closedDur']),
    enemies:g.enemies.map(e=>fields(e,['type','x','y','r','baseY','minX','maxX','dir','speed','chaseRange'])),
    cars:g.cars.map(e=>fields(e,['x','y','minX','maxX','dir','speed'])),
    ghosts:g.ghosts.map(e=>fields(e,['x','y','vx','vy','r','age','alpha']))};
  validate(s);return s;
}

export function createController({read,send,every,cancel,now=()=>performance.now()}) {
  let timer=null,held=new Set(),started=0;
  const logs=[],status={running:false,message:'Pronto',result:null,decisions:0,progress:0,lives:null,decisionMs:0};
  function record(entry){logs.push({at:now(),...entry});if(logs.length>6000)logs.shift();}
  function apply(a){
    const desired=new Set();
    if(a.dx>0)desired.add('ArrowRight');if(a.dx<0)desired.add('ArrowLeft');
    if(a.dy>0)desired.add('ArrowDown');if(a.dy<0)desired.add('ArrowUp');
    for(const k of held)if(!desired.has(k))send('keyup',k);
    for(const k of desired)if(!held.has(k))send('keydown',k);
    held=desired;
  }
  function stop(message='Parado pelo usuário'){
    status.running=false;if(timer!==null){cancel(timer);timer=null;}
    apply({dx:0,dy:0});status.message=message;record({type:'stop',message,result:status.result});
  }
  function tick(){
    if(!status.running)return;
    try{
      const s=read();status.lives=s.player.lives;
      status.progress=Math.max(0,Math.min(100,(s.player.x-130)/(6165-130)*100));
      if(s.state!=='playing'||s.player.lives<=0){
        status.result=s.state;stop(s.state==='cabin'?'Ponte concluída — entrou na cabine!':'Partida encerrada: '+s.state);return;
      }
      if(now()-started>120000){stop('Limite de 2 minutos atingido');return;}
      const t=now(),a=decide(s);status.decisionMs=now()-t;
      if(!Number.isFinite(a.dx)||!Number.isFinite(a.dy))throw new Error('Ação inválida');
      apply(a);status.decisions++;status.message=a.reason;
      record({type:'decision',x:s.player.x,y:s.player.y,lives:s.player.lives,invuln:s.player.invuln,
        gate:s.gate,action:a,decisionMs:status.decisionMs,
        threats:[...s.enemies,...s.cars,...s.ghosts].filter(e=>Math.abs(e.x-s.player.x)<350)});
    }catch(error){status.result='error';stop(error.message);}
  }
  function start(){
    if(status.running)return;
    logs.length=0;status.result=null;status.decisions=0;started=now();
    status.running=true;record({type:'start'});tick();
    if(status.running)timer=every(tick,50);
  }
  return {start,stop,tick,status,logs};
}

export function installBot(win,doc) {
  if(win.__flavioBot)return win.__flavioBot;
  if(win.location.origin!=='https://cadeflavio.run')throw new Error('Este bot só funciona em https://cadeflavio.run.');
  readSnapshot(win);
  const controller=createController({read:()=>readSnapshot(win),
    send:(type,key)=>win.dispatchEvent(new win.KeyboardEvent(type,{key,code:key,bubbles:true,cancelable:true})),
    every:(fn,ms)=>win.setInterval(fn,ms),cancel:id=>win.clearInterval(id),now:()=>win.performance.now()});
  const host=doc.createElement('div');host.id='flavio-bot-panel';
  const root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>
    :host{position:fixed;right:16px;bottom:16px;z-index:2147483647;font:13px/1.5 system-ui,sans-serif;color:#e9f2ff;width:290px}
    section{padding:16px;background:#101923f5;border:1px solid #43576d;border-radius:14px;box-shadow:0 8px 35px #0008}
    h2{font-size:16px;margin:0 0 8px}p{margin:7px 0}small{color:#a8bdd0;display:block}
    button{font:inherit;cursor:pointer;border:0;border-radius:7px;padding:8px 12px;margin:8px 4px 3px 0;color:#0b151f;background:#75e3b0}
    button.stop{background:#ffb9a8}button.export{background:#bbd5ef}#status{min-height:38px}#stats{font-variant-numeric:tabular-nums}
  </style><section><h2>Flávio · piloto local</h2><small>Estado real → previsão → teclas</small>
    <p id="status" role="status">Pronto para jogar</p><p id="stats">—</p>
    <button id="start">Iniciar tentativa</button><button class="stop" id="stop">Parar</button>
    <button class="export" id="export">Baixar registros</button>
    <small>F8 ou Escape para parar. Sair da aba também interrompe. Objetivo: entrar na cabine.</small></section>`;
  doc.documentElement.appendChild(host);
  const update=()=>{
    root.querySelector('#status').textContent=controller.status.message;
    root.querySelector('#stats').textContent=`${controller.status.progress.toFixed(1)}% · ${controller.status.lives??'—'} vidas · ${controller.status.decisionMs.toFixed(1)} ms/decisão`;
  };
  root.querySelector('#start').addEventListener('click',()=>{
    if(doc.hidden){controller.stop('Mantenha a aba visível');return;}
    const state=win.__game?.state;
    if(state==='start'){doc.querySelector('#btn-start').click();doc.querySelector('#btn-confirm').click();}
    else if(state==='select')doc.querySelector('#btn-confirm').click();
    else if(state==='over')doc.querySelector('#btn-retry').click();
    controller.start();update();
  });
  root.querySelector('#stop').addEventListener('click',()=>{controller.stop();update();});
  root.querySelector('#export').addEventListener('click',()=>{
    const text=JSON.stringify({version:'0.1.0',date:new Date().toISOString(),status:controller.status,logs:controller.logs},null,2);
    const url=win.URL.createObjectURL(new win.Blob([text],{type:'application/json'}));
    const link=doc.createElement('a');link.href=url;link.download='flavio-bot-partida.json';link.click();
    win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  });
  const emergency=e=>{if(e.key==='Escape'||e.key==='F8'){controller.stop('Interrompido por '+e.key);update();}};
  win.addEventListener('keydown',emergency,true);
  win.addEventListener('blur',()=>{controller.stop('Interrompido: janela sem foco');update();});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden){controller.stop('Interrompido: aba oculta');update();}});
  win.addEventListener('pagehide',()=>controller.stop('Página fechada'));
  win.setInterval(update,200);
  win.__flavioBot=controller;update();return controller;
}
