/* Flávio Autoplayer 0.1.0 — local, sem serviços externos */
(()=>{
'use strict';
// A previsão segue as regras observadas no script público do jogo em 2026-10-28.
// Trabalha exclusivamente sobre cópias do estado; nunca recebe referências para escrita no motor.
const TOP = 185, BOTTOM = 400, GOAL = 6165;
const ACTIONS = [
  {dx:1,dy:0}, {dx:1,dy:-1}, {dx:1,dy:1},
  {dx:0,dy:-1}, {dx:0,dy:1}, {dx:0,dy:0}, {dx:-1,dy:0},
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

function validate(s) {
  if (!s || !s.player || !s.gate || !['enemies','cars','ghosts'].every(k=>Array.isArray(s[k])))
    throw new Error('Estado do jogo inválido ou incompatível.');
  for(const k of ['x','y','r','speed','lives','invuln'])
    if(!Number.isFinite(s.player[k])) throw new Error('Estado do jogador inválido: '+k);
  for(const k of ['x','arm','timer','openDur','closedDur'])
    if(!Number.isFinite(s.gate[k])) throw new Error('Estado da cancela inválido: '+k);
  if(s.player.r<=0 || s.player.speed<=0 || s.gate.openDur<=0 || s.gate.closedDur<=0)
    throw new Error('Parâmetros do jogo inválidos.');
  for(const k of ['enemies','cars','ghosts']) for(const e of s[k]) {
    const fields=k==='ghosts'?['x','y','vx','vy','r','age']:['x','y','minX','maxX','dir','speed'];
    if(!fields.every(f=>Number.isFinite(e[f]))) throw new Error('Estado de ameaça inválido.');
    if(k==='enemies' && (!Number.isFinite(e.r)||!Number.isFinite(e.baseY)||
      (e.type==='red'&&!Number.isFinite(e.chaseRange)))) throw new Error('Estado de inimigo inválido.');
  }
}

function copy(s) {
  return {...s, player:{...s.player},gate:{...s.gate},
    enemies:s.enemies.map(e=>({...e})),cars:s.cars.map(e=>({...e})),ghosts:s.ghosts.map(e=>({...e})),
    hits:s.hits||0,risk:s.risk||0};
}

function hit(s) {
  if(s.player.invuln>0) return;
  s.player.invuln=1.4; s.player.lives--; s.hits++;
}

function clearanceRisk(s, gap, dt) {
  if(s.player.invuln > 0.15) return;
  if(gap < 45) s.risk += ((45-Math.max(0,gap))/45)**2*dt;
}

function step(s,a,dt) {
  const p=s.player, g=s.gate;
  const norm=a.dx&&a.dy?0.7071:1;
  p.x=clamp(p.x+a.dx*norm*p.speed*dt,30,6595);
  p.y=clamp(p.y+a.dy*norm*p.speed*dt,TOP+p.r,BOTTOM-p.r);
  g.timer+=dt;
  const open=g.timer%(g.openDur+g.closedDur)>=g.closedDur;
  g.arm+=((open?0:1)-g.arm)*Math.min(1,dt*6);
  if(g.arm>0.5&&p.x>g.x-22&&p.x<g.x+22) p.x=p.x<g.x?g.x-22:g.x+22;
  p.invuln=Math.max(0,p.invuln-dt);
  for(const e of s.enemies) {
    const dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);
    if(e.type==='red'&&d<e.chaseRange) {
      const speed=Math.min(e.speed+30,p.speed*0.6);
      e.x+=dx/(d||1)*speed*dt; e.y+=dy/(d||1)*speed*dt;
      e.dir=dx>=0?1:-1;
    } else {
      e.x+=e.dir*e.speed*dt;
      if(e.x<=e.minX) {e.x=e.minX;e.dir=1;}
      if(e.x>=e.maxX) {e.x=e.maxX;e.dir=-1;}
      if(e.type==='prf') {
        const target=Math.abs(dx)<140&&Math.abs(dy)<115?dy:e.baseY-e.y;
        const speed=Math.abs(dx)<140&&Math.abs(dy)<115?e.speed*0.5:45;
        e.y+=Math.sign(target)*Math.min(Math.abs(target),speed*dt);
      }
    }
    e.y=clamp(e.y,TOP+e.r,BOTTOM-e.r);
    if(d<p.r+e.r) hit(s);
    clearanceRisk(s,d-p.r-e.r,dt);
  }
  for(const c of s.cars) {
    c.x+=c.dir*c.speed*dt;
    if(c.x<c.minX) {c.x=c.minX;c.dir=1;}
    if(c.x>c.maxX) {c.x=c.maxX;c.dir=-1;}
    const gap=Math.hypot(p.x-clamp(p.x,c.x-38,c.x+38),p.y-clamp(p.y,c.y-13,c.y+15))-(p.r-1);
    if(gap<0) hit(s);
    clearanceRisk(s,gap,dt);
  }
  for(const ghost of s.ghosts) {
    ghost.age+=dt;
    const dx=p.x-ghost.x,dy=p.y-ghost.y,d=Math.hypot(dx,dy)||1;
    const turn=Math.min(1,2.6*dt);
    ghost.vx+=(dx/d*210-ghost.vx)*turn;
    ghost.vy+=(dy/d*210-ghost.vy)*turn;
    ghost.x+=ghost.vx*dt;ghost.y=clamp(ghost.y+ghost.vy*dt,120,440);
    if(ghost.age/1.2>0.6&&d<p.r+ghost.r) hit(s);
    if(ghost.age/1.2>0.4) clearanceRisk(s,d-p.r-ghost.r,dt);
  }
}

function forecast(snapshot, action, seconds) {
  validate(snapshot);
  const s=copy(snapshot), n=Math.ceil(seconds*60), dt=seconds/n;
  for(let i=0;i<n;i++) step(s,action,dt);
  return s;
}

function decide(snapshot) {
  validate(snapshot);
  if(snapshot.state!=='playing'||snapshot.player.lives<=0) return {dx:0,dy:0,reason:'Etapa encerrada',score:0};
  const start=copy({...snapshot,
    enemies:snapshot.enemies.filter(e=>Math.abs(e.x-snapshot.player.x)<750),
    cars:snapshot.cars.filter(e=>Math.abs(e.x-snapshot.player.x)<850),
  });
  let beam=[{s:start,first:null,score:0,turns:0,last:null}];
  for(let depth=0;depth<7;depth++) {
    const choices=[];
    for(const parent of beam) for(const a of ACTIONS) {
      const s=copy(parent.s);
      for(let k=0;k<8;k++) step(s,a,0.02);
      const turns=parent.turns+(parent.last&&(parent.last.dx!==a.dx||parent.last.dy!==a.dy)?1:0);
      const progress=Math.min(GOAL,s.player.x)-start.player.x;
      const score=progress*3-s.hits*12000-s.risk*85-turns*0.5-
        Math.abs(s.player.y-292.5)*0.002;
      choices.push({s,first:parent.first||a,last:a,score,turns});
    }
    choices.sort((a,b)=>b.score-a.score);
    const seen=new Set();beam=[];
    for(const c of choices) {
      const key=[Math.round(c.s.player.x/12),Math.round(c.s.player.y/12),c.s.hits,Math.round(c.s.player.invuln*5)].join(':');
      if(!seen.has(key)) {seen.add(key);beam.push(c);}
      if(beam.length===10) break;
    }
  }
  const best=beam[0];
  return {...best.first,score:best.score,reason:best.first.dx<1?'Reposicionar / aguardar passagem':best.first.dy?'Desviar e avançar':'Avançar'};
}


function readSnapshot(win) {
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

function createController({read,send,every,cancel,now=()=>performance.now()}) {
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

function installBot(win,doc) {
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

installBot(window,document);
})();
