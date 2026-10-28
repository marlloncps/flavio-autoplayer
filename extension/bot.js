/* Flávio Autoplayer 0.4.0 — local, sem serviços externos */
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

const OV_COLORS={player:'#65f5c4',prf:'#69bbff',red:'#ff819c',car:'#ffc067',ghost:'#d69cff',gate:'#ffe880'};
const OV_NAMES={player:'PILOTO',prf:'PRF',red:'MANIFESTANTE',car:'VIATURA',ghost:'FANTASMA',gate:'CANCELA'};

// A câmera não faz parte do gancho de debug. Esta é a mesma transformação do renderizador do jogo.
function makeOverlayScene(s,action={}) {
  if(s.state!=='playing')return {active:false,objects:[],cameraX:0,player:null,arrow:null,nearest:[]};
  const p=s.player,cameraX=Math.max(0,Math.min(5665,p.x-420));
  const player={x:p.x-cameraX,y:p.y};
  const objects=[];
  function box(e,kind,index){
    const cx=e.x-cameraX,cy=e.y;
    if(cx < -100 || cx > 1060)return;
    const shape=kind==='car'?[-45,-25,90,50]:kind==='ghost'?[-35,-50,70,80]:kind==='red'?[-19,-61,58,87]:[-20,-35,40,62];
    if(cx+shape[0]+shape[2]<0||cx+shape[0]>960)return;
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    const gap=d-p.r-(kind==='car'?42:(e.r||12));
    objects.push({kind,cx,cy,x:cx+shape[0],y:cy+shape[1],w:shape[2],h:shape[3],
      radius:e.r||12,distance:d,gap,alert:kind!=='player'&&gap<65,
      label:OV_NAMES[kind]+(kind==='player'?'':` ${String(index+1).padStart(2,'0')}`),color:OV_COLORS[kind]});
  }
  s.enemies.forEach((e,i)=>box(e,e.type==='prf'?'prf':'red',i));
  s.cars.forEach((e,i)=>box(e,'car',i));
  s.ghosts.forEach((e,i)=>box(e,'ghost',i));
  box(p,'player',0);
  const gx=s.gate.x-cameraX;
  if(gx>-30&&gx<990){
    const closed=s.gate.arm>0.5;
    objects.push({kind:'gate',cx:gx,cy:292.5,x:gx-7,y:180,w:closed?14:220,h:closed?225:14,
      closed,color:OV_COLORS.gate,label:closed?'CANCELA FECHADA':'CANCELA ABERTA',alert:false});
  }
  const norm=action.dx&&action.dy?Math.SQRT1_2:1;
  const dx=(action.dx||0)*norm*p.speed*0.32,dy=(action.dy||0)*norm*p.speed*0.32;
  const arrow={from:{...player},to:{x:player.x+dx,y:Math.max(197,Math.min(388,p.y+dy))}};
  return {active:true,cameraX,player,objects,arrow,
    nearest:objects.filter(o=>o.kind!=='player'&&o.kind!=='gate'&&o.distance<230).sort((a,b)=>a.gap-b.gap).slice(0,2)};
}

function ovTag(ctx,text,x,y,color) {
  ctx.font='600 8px ui-monospace, Menlo, monospace';
  const width=ctx.measureText(text).width+10;
  x=Math.max(3,Math.min(957-width,x));y=Math.max(14,Math.min(525,y));
  ctx.fillStyle='rgba(6,15,25,.90)';ctx.fillRect(x,y-12,width,15);
  ctx.fillStyle=color;ctx.fillRect(x,y-12,2,15);ctx.fillText(text,x+6,y-1);
}

function ovBrackets(ctx,o){
  const c=o.alert?'#ff586d':o.color;
  ctx.strokeStyle=c;ctx.fillStyle=c+'0a';ctx.lineWidth=0.7;
  ctx.fillRect(o.x,o.y,o.w,o.h);ctx.globalAlpha=0.5;ctx.strokeRect(o.x,o.y,o.w,o.h);ctx.globalAlpha=1;
  const k=Math.min(8,o.w/3,o.h/3);ctx.lineWidth=1.7;ctx.beginPath();
  for(const [x,y,dx,dy]of [[o.x,o.y,1,1],[o.x+o.w,o.y,-1,1],[o.x,o.y+o.h,1,-1],[o.x+o.w,o.y+o.h,-1,-1]]){
    ctx.moveTo(x,y+dy*k);ctx.lineTo(x,y);ctx.lineTo(x+dx*k,y);
  }
  ctx.stroke();
  const suffix=o.kind==='player'?' • CONTROLE LOCAL':o.kind==='gate'?'':` • ${Math.round(o.distance)} u`;
  ovTag(ctx,o.label+suffix,o.x,o.y-3,c);
  if(o.kind==='gate')return;
  ctx.globalAlpha=0.4;ctx.setLineDash([2,3]);ctx.lineWidth=0.8;ctx.beginPath();
  if(o.kind==='car')ctx.rect(o.cx-38,o.cy-13,76,28);
  else ctx.arc(o.cx,o.cy,o.radius,0,Math.PI*2);
  ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;
}

function ovRender(ctx,scene,status,trail){
  ctx.clearRect(0,0,960,540);if(!scene.active)return;
  // Trajeto realmente percorrido, em coordenadas do mundo.
  if(trail.length>1){
    ctx.strokeStyle='rgba(101,245,196,.45)';ctx.lineWidth=1.5;ctx.setLineDash([3,4]);ctx.beginPath();
    trail.forEach((p,i)=>{const x=p.x-scene.cameraX;i?ctx.lineTo(x,p.y):ctx.moveTo(x,p.y);});
    ctx.stroke();ctx.setLineDash([]);
  }
  for(const o of scene.nearest){
    ctx.strokeStyle=o.alert?'rgba(255,88,109,.65)':'rgba(182,210,235,.28)';
    ctx.lineWidth=0.8;ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(scene.player.x,scene.player.y);ctx.lineTo(o.cx,o.cy);ctx.stroke();ctx.setLineDash([]);
  }
  for(const o of scene.objects)ovBrackets(ctx,o);
  const {from,to}=scene.arrow;
  if(status.running&&Math.hypot(to.x-from.x,to.y-from.y)>2){
    const angle=Math.atan2(to.y-from.y,to.x-from.x);
    ctx.strokeStyle=OV_COLORS.player;ctx.fillStyle=OV_COLORS.player;ctx.lineWidth=2.3;
    ctx.shadowBlur=9;ctx.shadowColor=OV_COLORS.player;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
    ctx.beginPath();ctx.moveTo(to.x,to.y);ctx.lineTo(to.x-9*Math.cos(angle-.45),to.y-9*Math.sin(angle-.45));
    ctx.lineTo(to.x-9*Math.cos(angle+.45),to.y-9*Math.sin(angle+.45));ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ovTag(ctx,'MOVIMENTO ESCOLHIDO',to.x+10,to.y-8,OV_COLORS.player);
  }
  ctx.fillStyle='rgba(6,15,25,.82)';ctx.fillRect(22,74,238,41);
  ctx.fillStyle=status.running?OV_COLORS.player:'#a5b8c8';ctx.beginPath();ctx.arc(33,86,2.5,0,Math.PI*2);ctx.fill();
  ctx.font='600 9px ui-monospace, Menlo, monospace';ctx.fillText(status.running?'BOT ATIVO / DADOS DO MOTOR':'LEITURA DO JOGO / MANUAL',42,89);
  ctx.fillStyle='#b6cbdd';ctx.font='8px ui-monospace, Menlo, monospace';
  ctx.fillText(`${scene.objects.filter(o=>o.kind!=='player').length} obstáculos na tela  ·  previsão de movimento`,32,104);
  ctx.fillStyle='rgba(6,15,25,.82)';ctx.fillRect(22,475,448,35);
  let lx=32;
  for(const [kind,label]of [['player','PILOTO'],['prf','PRF'],['red','MANIFESTANTE'],['car','VIATURA'],['ghost','FANTASMA']]){
    ctx.fillStyle=OV_COLORS[kind];ctx.fillRect(lx,484,4,4);ctx.fillStyle='#d4e3ef';
    ctx.font='7.5px ui-monospace, Menlo, monospace';ctx.fillText(label,lx+8,488);lx+=ctx.measureText(label).width+23;
  }
  ctx.fillStyle='#9db3c6';ctx.font='7px ui-monospace, Menlo, monospace';
  ctx.fillText('Rastro = trajeto percorrido   ·   Vermelho = proximidade   ·   V: caixas / G: gravação',32,502);
}

function installOverlay(win,doc,{read,getStatus}) {
  const canvas=doc.createElement('canvas');canvas.id='flavio-bot-overlay';canvas.width=960;canvas.height=540;
  canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483645',background:'transparent',display:'block'});
  doc.documentElement.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const settings={enabled:true};let trail=[],lastX=null,wasActive=false;
  function setEnabled(on){
    settings.enabled=Boolean(on);canvas.style.display=on?'block':'none';
    trail=[];lastX=null;wasActive=false;
    if(!on)ctx.clearRect(0,0,960,540);
  }
  function frame(){
    try{
      const target=doc.querySelector('#game'),rect=target?.getBoundingClientRect();
      if(!settings.enabled||doc.hidden||!rect){ctx.clearRect(0,0,960,540);win.requestAnimationFrame(frame);return;}
      Object.assign(canvas.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
      const snapshot=read(),status=getStatus(),scene=makeOverlayScene(snapshot,status.action);
      if(!scene.active||!wasActive||lastX!==null&&Math.abs(snapshot.player.x-lastX)>200)trail=[];
      if(scene.active&&(!trail.length||Math.hypot(snapshot.player.x-trail.at(-1).x,snapshot.player.y-trail.at(-1).y)>2)){
        trail.push({x:snapshot.player.x,y:snapshot.player.y});if(trail.length>100)trail.shift();
      }
      lastX=snapshot.player.x;wasActive=scene.active;
      canvas.dataset.obstacles=String(scene.objects.filter(o=>o.kind!=='player').length);
      ovRender(ctx,scene,status,trail);
    }catch{ctx.clearRect(0,0,960,540);}
    win.requestAnimationFrame(frame);
  }
  win.requestAnimationFrame(frame);
  return {settings,setEnabled,toggle:()=>setEnabled(!settings.enabled)};
}

// Experimento solicitado pelo usuário: única escrita permitida no estado do motor.
function createSpeedControl(getPlayer) {
  const baseSpeed=getPlayer()?.speed;
  if(!Number.isFinite(baseSpeed)||baseSpeed<=0)throw new Error('Velocidade original inválida.');
  let multiplier=1;
  function setMultiplier(value){
    if(!Number.isFinite(value)||value<1||value>20)throw new Error('Escolha uma velocidade entre 1 e 20.');
    const player=getPlayer();
    if(!player||!Number.isFinite(player.speed)||player.speed<=0)throw new Error('Jogador indisponível para ajustar a velocidade.');
    player.speed=baseSpeed*value;multiplier=value;
    return player.speed;
  }
  return {baseSpeed,get multiplier(){return multiplier;},setMultiplier,reset:()=>setMultiplier(1)};
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
  const logs=[],status={running:false,message:'Pronto',result:null,decisions:0,progress:0,lives:null,decisionMs:0,action:{dx:0,dy:0}};
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
    apply({dx:0,dy:0});status.action={dx:0,dy:0};status.message=message;record({type:'stop',message,result:status.result});
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
      apply(a);status.action={dx:a.dx,dy:a.dy};status.decisions++;status.message=a.reason;
      record({type:'decision',x:s.player.x,y:s.player.y,lives:s.player.lives,invuln:s.player.invuln,speed:s.player.speed,
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
  const speedControl=createSpeedControl(()=>win.__game?.player);
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
    button.visual{background:#253b50;color:#cce5fa;padding:6px 10px;font-size:12px}
    button[aria-pressed="true"]{box-shadow:inset 0 0 0 1px #65f5c4}
    .speed-row{display:grid;grid-template-columns:1.5fr repeat(3,1fr);gap:5px;margin:6px 0 2px}.speed-row button{background:#263b4d;color:#d9e9f5;font-size:12px;padding:6px 4px;margin:0}
    .speed-row button[data-speed="20"]{background:#502839;color:#ffd6e5}
    #speed-summary{color:#8ee8c7;font-size:11px;margin:5px 0 8px}
    :host(.recording){width:250px} :host(.recording) section{padding:12px;background:#0a1420de}
    :host(.recording) .controls,:host(.recording) .help,:host(.recording) .subtitle{display:none}
    :host(.recording) h2{font-size:14px;margin-bottom:4px}:host(.recording) #status{min-height:0}
    :host(.recording) #record{padding:3px 0;background:none;color:#91adbf;box-shadow:none;font-size:10px;margin:0}
  </style><section><h2>Flávio · piloto local</h2><small class="subtitle">Estado real → previsão → teclas</small>
    <p id="status" role="status">Pronto para jogar</p><p id="stats">—</p>
    <p id="speed-summary">Velocidade original · 1×</p>
    <div class="controls">
    <small>Velocidade do personagem</small><div class="speed-row">
    <button data-speed="1" aria-pressed="true">1× original</button><button data-speed="2" aria-pressed="false">2×</button><button data-speed="3" aria-pressed="false">3×</button><button data-speed="20" aria-pressed="false" title="20× experimental">20×</button></div>
    <button id="start">Iniciar tentativa</button><button class="stop" id="stop">Parar</button>
    <button class="export" id="export">Baixar registros</button>
    <button class="visual" id="visual" aria-pressed="true">Caixas: ligadas · V</button></div>
    <button class="visual" id="record" aria-pressed="false">Modo gravação · G</button>
    <small class="help">F8 ou Escape para parar. V: caixas. G: recolher controles. Objetivo: entrar na cabine.</small></section>`;
  doc.documentElement.appendChild(host);
  const overlay=installOverlay(win,doc,{read:()=>readSnapshot(win),getStatus:()=>controller.status});
  controller.visuals=overlay;
  controller.speedControl=speedControl;
  const toggleVisual=()=>{
    overlay.toggle();root.querySelector('#visual').setAttribute('aria-pressed',String(overlay.settings.enabled));
    root.querySelector('#visual').textContent=`Caixas: ${overlay.settings.enabled?'ligadas':'desligadas'} · V`;
  };
  const toggleRecording=()=>{
    const on=host.classList.toggle('recording');root.querySelector('#record').setAttribute('aria-pressed',String(on));
    root.querySelector('#record').textContent=on?'Mostrar controles · G':'Modo gravação · G';
  };
  root.querySelector('#visual').addEventListener('click',toggleVisual);
  root.querySelector('#record').addEventListener('click',toggleRecording);
  const update=()=>{
    root.querySelector('#status').textContent=controller.status.message;
    root.querySelector('#stats').textContent=`${controller.status.progress.toFixed(1)}% · ${controller.status.lives??'—'} vidas · ${controller.status.decisionMs.toFixed(1)} ms/decisão`;
    root.querySelector('#speed-summary').textContent=speedControl.multiplier===1?'Velocidade original · 1×':`Velocidade modificada · ${speedControl.multiplier}×`;
    for(const button of root.querySelectorAll('[data-speed]'))button.setAttribute('aria-pressed',String(Number(button.dataset.speed)===speedControl.multiplier));
  };
  for(const button of root.querySelectorAll('[data-speed]'))button.addEventListener('click',()=>{
    try{speedControl.setMultiplier(Number(button.dataset.speed));update();}
    catch(error){controller.stop(error.message);update();}
  });
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
    const text=JSON.stringify({version:'0.4.0',date:new Date().toISOString(),experiment:{baseSpeed:speedControl.baseSpeed,speedMultiplier:speedControl.multiplier},status:controller.status,logs:controller.logs},null,2);
    const url=win.URL.createObjectURL(new win.Blob([text],{type:'application/json'}));
    const link=doc.createElement('a');link.href=url;link.download='flavio-bot-partida.json';link.click();
    win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  });
  const movementKeys=new Set(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d']);
  const emergency=e=>{
    if(e.key==='Escape'||e.key==='F8'){controller.stop('Interrompido por '+e.key);update();}
    else if(e.type==='keydown'&&!e.repeat&&e.key.toLowerCase()==='v')toggleVisual();
    else if(e.type==='keydown'&&!e.repeat&&e.key.toLowerCase()==='g')toggleRecording();
    else if(controller.status.running&&e.isTrusted&&movementKeys.has(e.key.toLowerCase())){
      controller.stop('Interrompido: controle manual detectado');update();
    }
  };
  win.addEventListener('keydown',emergency,true);
  win.addEventListener('keyup',emergency,true);
  win.addEventListener('blur',()=>{controller.stop('Interrompido: janela sem foco');update();});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden){controller.stop('Interrompido: aba oculta');update();}});
  win.addEventListener('pagehide',()=>controller.stop('Página fechada'));
  win.setInterval(update,200);
  win.__flavioBot=controller;update();return controller;
}

installBot(window,document);
})();
