const OV_COLORS={player:'#65f5c4',prf:'#69bbff',red:'#ff819c',car:'#ffc067',ghost:'#d69cff',constitution:'#e8df9b',gate:'#ffe880'};
const OV_NAMES={player:'PILOTO',prf:'PRF',red:'MANIFESTANTE',car:'VIATURA',ghost:'FANTASMA',constitution:'CONSTITUIÇÃO',gate:'CANCELA'};

// A câmera não faz parte do gancho de debug. Esta é a mesma transformação do renderizador do jogo.
export function makeOverlayScene(s,action={}) {
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

export function installOverlay(win,doc,{read,getStatus}) {
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
