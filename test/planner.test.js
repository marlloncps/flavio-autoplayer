import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, forecast } from '../src/planner.js';

function scene(overrides = {}) {
  return {state:'playing', player:{x:500,y:292.5,r:12,speed:245,lives:5,invuln:0},
    gate:{x:3310,arm:1,timer:0,openDur:2.6,closedDur:2.8}, enemies:[],cars:[],ghosts:[],...overrides};
}

test('avança na pista vazia sem alterar a observação', () => {
  const s=scene(), before=JSON.stringify(s);
  const a=decide(s);
  assert.equal(a.dx,1); assert.equal(a.dy,0);
  assert.equal(JSON.stringify(s),before);
});

test('desvia de um policial no caminho imediato', () => {
  const s=scene({enemies:[{type:'prf',x:570,y:292.5,baseY:292.5,minX:570,maxX:570,dir:1,speed:0,r:12}]});
  const a=decide(s);
  assert.notEqual(a.dy,0);
  assert.equal(forecast(s,a,0.3).hits,0);
});

test('a previsão respeita a barreira da cancela fechada', () => {
  const s=scene({gate:{x:550,arm:1,timer:0,openDur:2.6,closedDur:2.8}});
  const future=forecast(s,{dx:1,dy:0},0.8);
  assert.ok(future.player.x <= 528);
});

test('a previsão atravessa uma cancela aberta por tempo suficiente', () => {
  const s=scene({gate:{x:550,arm:0,timer:3.2,openDur:2.6,closedDur:2.8}});
  assert.ok(forecast(s,{dx:1,dy:0},0.8).player.x>600);
});

test('a previsão limita o personagem à pista e detecta viaturas', () => {
  const s=scene({cars:[{x:570,y:292.5,minX:570,maxX:570,dir:1,speed:0}]});
  assert.equal(forecast(s,{dx:1,dy:0},0.5).hits,1);
  assert.ok(forecast(s,{dx:0,dy:1},2).player.y <= 388);
});

test('não age sem estado jogável e rejeita coordenadas inválidas', () => {
  assert.deepEqual(decide(scene({state:'cabin'})).dx,0);
  const s=scene(); s.player.x=NaN;
  assert.throws(()=>decide(s), /inválid/i);
});

test('a previsão acompanha fantasmas que se aproximam', () => {
  const s=scene({ghosts:[{x:550,y:292.5,vx:-210,vy:0,r:15,age:2,alpha:1}]});
  assert.equal(forecast(s,{dx:1,dy:0},0.4).hits,1);
});
