import test from 'node:test';
import assert from 'node:assert/strict';
import {makeOverlayScene} from '../src/overlay.js';

function scene(overrides={}){
  return {state:'playing',player:{x:1000,y:292.5,r:12,speed:245,lives:5,invuln:0},
    gate:{x:3310,arm:0,timer:3,openDur:2.6,closedDur:2.8},
    enemies:[],cars:[],ghosts:[],...overrides};
}

test('caixas acompanham a câmera, mantendo o personagem no lugar correto',()=>{
  const s=scene({enemies:[{type:'prf',x:1100,y:250,r:12}]});
  const before=JSON.stringify(s),v=makeOverlayScene(s,{dx:1,dy:0});
  assert.equal(v.cameraX,580);assert.equal(v.player.x,420);
  assert.equal(v.objects.find(e=>e.kind==='prf').cx,520);
  assert.equal(JSON.stringify(s),before);
});

test('câmera respeita os limites no começo e fim do mapa',()=>{
  assert.equal(makeOverlayScene(scene({player:{x:130,y:292.5,r:12,speed:245}}),{}).player.x,130);
  const end=makeOverlayScene(scene({player:{x:6165,y:200,r:12,speed:245}}),{});
  assert.equal(end.cameraX,5665);assert.equal(end.player.x,500);
});

test('distingue viatura, fantasma e manifestante e descarta fora da tela',()=>{
  const v=makeOverlayScene(scene({enemies:[{type:'red',x:1200,y:300,r:12},{type:'prf',x:3000,y:300,r:12}],
    cars:[{x:1050,y:300}],ghosts:[{x:800,y:300,r:15}]}),{dx:1,dy:-1});
  assert.deepEqual(v.objects.map(e=>e.kind).sort(),['car','ghost','player','red']);
  assert.equal(v.objects.find(e=>e.kind==='car').w,90);
  assert.ok(v.arrow.to.x>v.player.x);assert.ok(v.arrow.to.y<v.player.y);
});

test('não desenha obstáculos da ponte sobre a cena da cabine',()=>{
  const v=makeOverlayScene(scene({state:'cabin'}),{dx:1,dy:0});
  assert.equal(v.active,false);assert.deepEqual(v.objects,[]);
});

test('não coloca etiquetas na borda para desenhos inteiramente fora da tela',()=>{
  const v=makeOverlayScene(scene({enemies:[{type:'prf',x:1570,y:250,r:12}]}),{});
  assert.equal(v.objects.some(e=>e.kind==='prf'),false);
});

test('exibe a cancela apenas quando ela está visível e respeita o estado do braço',()=>{
  const near=scene({gate:{x:1200,arm:1,open:false}});
  const gate=makeOverlayScene(near,{}).objects.find(e=>e.kind==='gate');
  assert.equal(gate.cx,620);assert.equal(gate.closed,true);
  assert.equal(makeOverlayScene(scene(),{}).objects.some(e=>e.kind==='gate'),false);
});
