// A previsão segue as regras observadas no script público do jogo em 2026-10-28.
// Trabalha exclusivamente sobre cópias do estado; nunca recebe referências para escrita no motor.
const TOP = 185, BOTTOM = 400, GOAL = 6165;
const ACTIONS = [
  {dx:1,dy:0}, {dx:1,dy:-1}, {dx:1,dy:1},
  {dx:0,dy:-1}, {dx:0,dy:1}, {dx:0,dy:0}, {dx:-1,dy:0},
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

export function validate(s) {
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

export function forecast(snapshot, action, seconds) {
  validate(snapshot);
  const s=copy(snapshot), n=Math.ceil(seconds*60), dt=seconds/n;
  for(let i=0;i<n;i++) step(s,action,dt);
  return s;
}

export function decide(snapshot) {
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
