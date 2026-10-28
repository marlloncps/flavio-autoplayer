/* Flávio Autoplayer 0.5.0 — local, sem serviços externos */
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
    const book=ghost.spectralKind==='constitution',turn=Math.min(1,(book?3.2:2.6)*dt),speed=book?205:210;
    ghost.vx+=(dx/d*speed-ghost.vx)*turn;
    ghost.vy+=(dy/d*speed-ghost.vy)*turn;
    ghost.x+=ghost.vx*dt;ghost.y=clamp(ghost.y+ghost.vy*dt,book?179:120,book?406:440);
    const fade=book?1:1.2;
    if(ghost.age/fade>0.6&&d<p.r+ghost.r) hit(s);
    if(ghost.age/fade>0.4) clearanceRisk(s,d-p.r-ghost.r,dt);
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

const OV_COLORS={player:'#65f5c4',prf:'#69bbff',red:'#ff819c',car:'#ffc067',ghost:'#d69cff',constitution:'#e8df9b',gate:'#ffe880'};
const OV_NAMES={player:'PILOTO',prf:'PRF',red:'MANIFESTANTE',car:'VIATURA',ghost:'FANTASMA',constitution:'CONSTITUIÇÃO',gate:'CANCELA'};

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
  s.ghosts.forEach((e,i)=>box(e,e.spectralKind==='constitution'?'constitution':'ghost',i));
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
  for(const [kind,label]of [['player','PILOTO'],['prf','PRF'],['red','MANIFESTANTE'],['car','VIATURA'],['ghost','FANTASMA'],['constitution','LIVRO']]){
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

// Mod local: projéteis próprios; o impacto remove apenas o alvo atingido do array vivo do jogo.
function wpnCircleTime(a,b,c,r){
  const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-c.x,fy=a.y-c.y;
  const cc=fx*fx+fy*fy-r*r;if(cc<=0)return 0;
  const aa=dx*dx+dy*dy;if(!aa)return null;
  const bb=2*(fx*dx+fy*dy),disc=bb*bb-4*aa*cc;if(disc<0)return null;
  const t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1?t:null;
}
function wpnRectTime(a,b,c){
  let enter=0,exit=1;
  for(const [p,d,min,max]of [[a.x,b.x-a.x,c.x-40,c.x+40],[a.y,b.y-a.y,c.y-15,c.y+17]]){
    if(Math.abs(d)<1e-9){if(p<min||p>max)return null;continue;}
    let t1=(min-p)/d,t2=(max-p)/d;if(t1>t2)[t1,t2]=[t2,t1];
    enter=Math.max(enter,t1);exit=Math.min(exit,t2);if(enter>exit)return null;
  }
  return enter>=0&&enter<=1?enter:null;
}
function wpnCandidates(g){
  return [['enemies','person'],['cars','car'],['ghosts','ghost'],['consts','constitution']].flatMap(([name,kind])=>
    (g[name]||[]).filter(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)&&(e.alpha===undefined||e.alpha>.2))
      .map(entity=>({entity,array:g[name],kind:kind==='person'?entity.type:kind})));
}
function wpnTarget(g){
  const p=g.player,cam=Math.max(0,Math.min(5665,p.x-420));
  return wpnCandidates(g).filter(t=>t.entity.x>=cam&&t.entity.x<=cam+960)
    .map(t=>({...t,distance:Math.hypot(t.entity.x-p.x,t.entity.y-p.y)}))
    .filter(t=>t.distance<500).sort((a,b)=>a.distance-b.distance)[0]||null;
}
function wpnLead(g,target,origin,bulletSpeed){
  const e=target.entity;let vx=e.vx??(e.dir||0)*(e.speed||0),vy=e.vy||0;
  if(e.type==='red'&&e.chasing){
    const dx=g.player.x-e.x,dy=g.player.y-e.y,d=Math.hypot(dx,dy)||1,sp=Math.min((e.speed||0)+30,g.player.speed*.6);
    vx=dx/d*sp;vy=dy/d*sp;
  }else if(e.type==='prf'&&Math.abs(e.x-g.player.x)<140&&Math.abs(e.y-g.player.y)<115){vy=Math.sign(g.player.y-e.y)*(e.speed||0)*.5;}
  const time=Math.min(.45,Math.hypot(e.x-origin.x,e.y-origin.y)/bulletSpeed);
  return {x:e.x+vx*time,y:e.y+vy*time};
}

function createWeaponSystem(getGame){
  const state={settings:{enabled:true,auto:true},bullets:[],effects:[],shots:0,hits:0,hitKinds:{},
    aim:{angle:0,target:null},flash:0,cooldown:0,trigger:false,time:0,events:[]};
  let enemiesRef=getGame()?.enemies;
  function event(data){state.events.push({at:state.time,...data});if(state.events.length>250)state.events.shift();}
  function ceaseFire(){state.trigger=false;state.bullets=[];state.flash=0;}
  function syncRound(g){
    if(g.enemies!==enemiesRef){
      enemiesRef=g.enemies;ceaseFire();state.effects=[];state.shots=0;state.hits=0;state.hitKinds={};state.events=[];state.cooldown=0;state.aim={angle:0,target:null};
    }
  }
  function setEnabled(on){state.settings.enabled=Boolean(on);if(!on)ceaseFire();}
  function fire(){
    const g=getGame();if(!g||g.state!=='playing'||!state.settings.enabled)return false;
    syncRound(g);if(state.cooldown>0)return false;
    const origin={x:g.player.x+10,y:g.player.y-5},speed=Math.max(1400,g.player.speed*1.5),target=wpnTarget(g);
    const aim=target?wpnLead(g,target,origin,speed):{x:origin.x+500,y:origin.y};
    const angle=Math.atan2(aim.y-origin.y,aim.x-origin.x);
    state.aim={angle,target:target?{...aim,kind:target.kind}:null};
    state.bullets.push({x:origin.x+Math.cos(angle)*17,y:origin.y+Math.sin(angle)*17,
      vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,remaining:650});
    state.cooldown=.18;state.flash=.065;state.shots++;event({type:'shot',x:origin.x,y:origin.y,kind:target?.kind||null});
    return true;
  }
  function update(dt,autoRequested=false){
    if(!Number.isFinite(dt)||dt<0)return;
    const g=getGame();if(!g)return;syncRound(g);
    state.time+=dt;state.cooldown=Math.max(0,state.cooldown-dt);state.flash=Math.max(0,state.flash-dt);
    for(const effect of state.effects)effect.ttl-=dt;
    state.effects=state.effects.filter(e=>e.ttl>0);
    if(g.state!=='playing'||!state.settings.enabled){ceaseFire();return;}
    if(state.trigger||(autoRequested&&state.settings.auto&&wpnTarget(g)))fire();
    const alive=[];
    for(const bullet of state.bullets){
      const speed=Math.hypot(bullet.vx,bullet.vy),travel=Math.min(bullet.remaining,speed*dt);
      const end={x:bullet.x+bullet.vx/speed*travel,y:bullet.y+bullet.vy/speed*travel};
      let first=null;
      for(const target of wpnCandidates(g)){
        const t=target.kind==='car'?wpnRectTime(bullet,end,target.entity):wpnCircleTime(bullet,end,target.entity,(target.entity.r||12)+2);
        if(t!==null&&(!first||t<first.t))first={...target,t};
      }
      if(first){
        const index=first.array.indexOf(first.entity);
        if(index>=0){
          first.array.splice(index,1);state.hits++;state.hitKinds[first.kind]=(state.hitKinds[first.kind]||0)+1;
          state.effects.push({x:first.entity.x,y:first.entity.y,ttl:.4,kind:first.kind});
          if(state.effects.length>30)state.effects.shift();event({type:'hit',kind:first.kind,x:first.entity.x,y:first.entity.y});
        }
      }else{
        bullet.x=end.x;bullet.y=end.y;bullet.remaining-=travel;
        if(bullet.remaining>0&&bullet.y>80&&bullet.y<470)alive.push(bullet);
      }
    }
    state.bullets=alive;
    if(!wpnTarget(g))state.aim.target=null;
  }
  return {state,fire,update,ceaseFire,setEnabled,setTrigger:on=>{state.trigger=Boolean(on);}};
}

function wpnDraw(ctx,g,state){
  ctx.clearRect(0,0,960,540);if(g.state!=='playing'||!state.settings.enabled)return;
  const cam=Math.max(0,Math.min(5665,g.player.x-420)),px=g.player.x-cam,py=g.player.y;
  ctx.save();ctx.translate(px+10,py-5);ctx.rotate(state.aim.angle);
  const recoil=state.flash>0?2:0;ctx.translate(-recoil,0);
  ctx.shadowBlur=4;ctx.shadowColor='#54f6ff';
  ctx.fillStyle='#101b29';ctx.strokeStyle='#aac9da';ctx.lineWidth=.8;
  ctx.fillRect(-3,-4,23,8);ctx.strokeRect(-3,-4,23,8);
  ctx.fillStyle='#2c4056';ctx.fillRect(1,3,5,8);ctx.fillStyle='#f3bf8c';ctx.fillRect(-1,2,5,4);
  ctx.fillStyle='#67f3ff';ctx.fillRect(6,-2,12,2);ctx.fillStyle='#c6edff';ctx.fillRect(18,-3,4,6);
  if(state.flash>0){
    ctx.globalAlpha=Math.min(1,state.flash/.04);ctx.shadowBlur=16;ctx.fillStyle='#ebffff';
    ctx.beginPath();ctx.moveTo(21,-2);ctx.lineTo(34,-5);ctx.lineTo(29,0);ctx.lineTo(34,5);ctx.lineTo(21,2);ctx.closePath();ctx.fill();
  }
  ctx.restore();
  for(const b of state.bullets){
    const angle=Math.atan2(b.vy,b.vx),x=b.x-cam;
    ctx.save();ctx.shadowBlur=10;ctx.shadowColor='#53f4ff';ctx.strokeStyle='#70f5ff';ctx.lineWidth=2.8;
    ctx.beginPath();ctx.moveTo(x-Math.cos(angle)*17,b.y-Math.sin(angle)*17);ctx.lineTo(x,b.y);ctx.stroke();
    ctx.strokeStyle='#ffffff';ctx.lineWidth=.8;ctx.stroke();ctx.restore();
  }
  for(const effect of state.effects){
    const t=1-effect.ttl/.4,x=effect.x-cam;ctx.save();ctx.globalAlpha=Math.max(0,1-t);
    ctx.strokeStyle='#78f5ff';ctx.lineWidth=1.4;ctx.shadowColor='#78f5ff';ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(x,effect.y,8+t*25,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(x+Math.cos(a)*(8+t*15),effect.y+Math.sin(a)*(8+t*15));
      ctx.lineTo(x+Math.cos(a)*(13+t*30),effect.y+Math.sin(a)*(13+t*30));ctx.stroke();
    }
    ctx.font='bold 8px ui-monospace,monospace';ctx.fillStyle='#baffff';ctx.textAlign='center';
    ctx.fillText('ACERTO',x,effect.y-22-t*10);ctx.restore();
  }
  const target=state.aim.target;
  if(target){
    const x=target.x-cam,y=target.y;ctx.strokeStyle='rgba(108,243,255,.5)';ctx.lineWidth=.8;ctx.setLineDash([3,4]);
    ctx.beginPath();ctx.moveTo(px+10,py-5);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.moveTo(x-12,y);ctx.lineTo(x+12,y);ctx.moveTo(x,y-12);ctx.lineTo(x,y+12);ctx.stroke();
  }
}

function installWeaponLayer(win,doc,{weapon,getStatus,onError}){
  const canvas=doc.createElement('canvas');canvas.id='flavio-weapon-canvas';canvas.width=960;canvas.height=540;canvas.setAttribute('aria-hidden','true');
  Object.assign(canvas.style,{position:'fixed',pointerEvents:'none',zIndex:'2147483644',background:'transparent'});
  doc.documentElement.appendChild(canvas);const ctx=canvas.getContext('2d');let last=win.performance.now();
  function frame(now){
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    try{
      const g=win.__game,rect=doc.querySelector('#game')?.getBoundingClientRect();
      if(doc.hidden||!g||!rect){weapon.ceaseFire();ctx.clearRect(0,0,960,540);}
      else{
        Object.assign(canvas.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
        weapon.update(dt,getStatus().running);wpnDraw(ctx,g,weapon.state);
        canvas.dataset.shots=String(weapon.state.shots);canvas.dataset.hits=String(weapon.state.hits);
      }
    }catch(error){weapon.setEnabled(false);ctx.clearRect(0,0,960,540);onError(error);}
    win.requestAnimationFrame(frame);
  }
  win.requestAnimationFrame(frame);
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
    ghosts:[...g.ghosts.map(e=>fields(e,['x','y','vx','vy','r','age','alpha'])),
      ...(g.consts||[]).map(e=>({...fields(e,['x','y','vx','vy','r','age','alpha']),spectralKind:'constitution'}))]};
  validate(s);return s;
}

function createController({read,send,every,cancel,now=()=>performance.now(),onStop=()=>{}}) {
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
    apply({dx:0,dy:0});status.action={dx:0,dy:0};status.message=message;record({type:'stop',message,result:status.result});onStop();
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
  const weapon=createWeaponSystem(()=>win.__game);
  const controller=createController({read:()=>readSnapshot(win),
    send:(type,key)=>win.dispatchEvent(new win.KeyboardEvent(type,{key,code:key,bubbles:true,cancelable:true})),
    every:(fn,ms)=>win.setInterval(fn,ms),cancel:id=>win.clearInterval(id),now:()=>win.performance.now(),onStop:()=>weapon.ceaseFire()});
  controller.weapon=weapon;
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
    #weapon-summary{color:#8deaff;font-size:11px;margin:5px 0}.weapon-row{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
    .weapon-row button{font-size:11px;background:#183c4b;color:#aaf5ff;padding:6px 8px;margin:0}
    :host(.recording){width:250px} :host(.recording) section{padding:12px;background:#0a1420de}
    :host(.recording) .controls,:host(.recording) .help,:host(.recording) .subtitle{display:none}
    :host(.recording) h2{font-size:14px;margin-bottom:4px}:host(.recording) #status{min-height:0}
    :host(.recording) #record{padding:3px 0;background:none;color:#91adbf;box-shadow:none;font-size:10px;margin:0}
  </style><section><h2>Flávio · piloto local</h2><small class="subtitle">Estado real → previsão → teclas</small>
    <p id="status" role="status">Pronto para jogar</p><p id="stats">—</p>
    <p id="speed-summary">Velocidade original · 1×</p>
    <p id="weapon-summary">Blaster equipado · J para atirar</p>
    <div class="controls">
    <small>Velocidade do personagem</small><div class="speed-row">
    <button data-speed="1" aria-pressed="true">1× original</button><button data-speed="2" aria-pressed="false">2×</button><button data-speed="3" aria-pressed="false">3×</button><button data-speed="20" aria-pressed="false" title="20× experimental">20×</button></div>
    <div class="weapon-row"><button id="weapon-toggle" aria-pressed="true">Arma: ligada</button><button id="weapon-auto" aria-pressed="true">Auto: ligado</button><button id="weapon-fire">Atirar · J</button></div>
    <button id="start">Iniciar tentativa</button><button class="stop" id="stop">Parar</button>
    <button class="export" id="export">Baixar registros</button>
    <button class="visual" id="visual" aria-pressed="true">Caixas: ligadas · V</button></div>
    <button class="visual" id="record" aria-pressed="false">Modo gravação · G</button>
    <small class="help">J: atirar. F8/Escape: parar. V: caixas. G: recolher controles.</small></section>`;
  doc.documentElement.appendChild(host);
  const overlay=installOverlay(win,doc,{read:()=>readSnapshot(win),getStatus:()=>controller.status});
  controller.visuals=overlay;
  controller.speedControl=speedControl;
  installWeaponLayer(win,doc,{weapon,getStatus:()=>controller.status,onError:error=>controller.stop('Arma: '+error.message)});
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
    root.querySelector('#weapon-summary').textContent=weapon.state.settings.enabled?`BLASTER · ${weapon.state.shots} disparos · ${weapon.state.hits} acertos`:'Arma desligada';
    root.querySelector('#weapon-toggle').textContent=`Arma: ${weapon.state.settings.enabled?'ligada':'desligada'}`;
    root.querySelector('#weapon-toggle').setAttribute('aria-pressed',String(weapon.state.settings.enabled));
    root.querySelector('#weapon-auto').textContent=`Auto: ${weapon.state.settings.auto?'ligado':'desligado'}`;
    root.querySelector('#weapon-auto').setAttribute('aria-pressed',String(weapon.state.settings.auto));
  };
  root.querySelector('#weapon-toggle').addEventListener('click',()=>{weapon.setEnabled(!weapon.state.settings.enabled);update();});
  root.querySelector('#weapon-auto').addEventListener('click',()=>{weapon.state.settings.auto=!weapon.state.settings.auto;update();});
  root.querySelector('#weapon-fire').addEventListener('click',()=>{weapon.fire();update();});
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
    const text=JSON.stringify({version:'0.5.0',date:new Date().toISOString(),experiment:{baseSpeed:speedControl.baseSpeed,speedMultiplier:speedControl.multiplier,
      weaponEnabled:weapon.state.settings.enabled,autoFire:weapon.state.settings.auto},weapon:{shots:weapon.state.shots,hits:weapon.state.hits,hitKinds:weapon.state.hitKinds,events:weapon.state.events},status:controller.status,logs:controller.logs},null,2);
    const url=win.URL.createObjectURL(new win.Blob([text],{type:'application/json'}));
    const link=doc.createElement('a');link.href=url;link.download='flavio-bot-partida.json';link.click();
    win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  });
  const movementKeys=new Set(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d']);
  const emergency=e=>{
    if(e.key==='Escape'||e.key==='F8'){controller.stop('Interrompido por '+e.key);update();}
    else if(e.key.toLowerCase()==='j'){
      if(e.type==='keyup'||!e.repeat)weapon.setTrigger(e.type==='keydown');
      e.preventDefault();
    }
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
