import test from 'node:test';
import assert from 'node:assert/strict';
import { createController, readSnapshot } from '../src/controller.js';

function game() {
  return {
    state: 'playing',
    player: { x: 130, y: 292.5, r: 12, speed: 245, lives: 5, invuln: 0 },
    gate: { x: 3310, arm: 0, timer: 3, openDur: 2.6, closedDur: 2.8 },
    enemies: [],
    cars: [],
    ghosts: [],
  };
}
function rig() {
  const g = game(),
    held = new Set();
  let timer;
  const c = createController({
    read: () => readSnapshot({ __game: g }),
    send: (type, key) => (type === 'keydown' ? held.add(key) : held.delete(key)),
    every: (fn) => ((timer = fn), 1),
    cancel: () => {
      timer = null;
    },
    now: () => 0,
  });
  return { g, c, held, run: () => timer?.() };
}

test('parar solta todas as teclas e impede novos movimentos', () => {
  const { c, held, run } = rig();
  c.start();
  assert.ok(held.has('ArrowRight'));
  c.stop('teste');
  assert.equal(held.size, 0);
  run();
  assert.equal(held.size, 0);
  assert.equal(c.status.running, false);
});
test('entrar na cabine encerra a execução com sucesso observado', () => {
  const { g, c, held, run } = rig();
  c.start();
  g.state = 'cabin';
  run();
  assert.equal(held.size, 0);
  assert.equal(c.status.result, 'cabin');
  assert.equal(c.status.running, false);
});
test('um estado incompatível para o bot e solta as teclas', () => {
  const { g, c, held, run } = rig();
  c.start();
  g.player.x = NaN;
  run();
  assert.equal(held.size, 0);
  assert.equal(c.status.running, false);
  assert.match(c.status.message, /inválid/i);
});
test('a ponte copia os dados sem modificar os objetos do jogo', () => {
  const g = game(),
    s = readSnapshot({ __game: g });
  s.player.x = 999;
  s.gate.arm = 1;
  assert.equal(g.player.x, 130);
  assert.equal(g.gate.arm, 0);
  assert.throws(() => readSnapshot({}), /debug/i);
});
test('iniciar repetidamente não duplica o controlador', () => {
  const { c } = rig();
  c.start();
  c.start();
  assert.equal(c.logs.filter((x) => x.type === 'start').length, 1);
  c.stop();
});
test('a ponte inclui o novo perseguidor do tipo Constituição', () => {
  const g = game();
  g.consts = [{ x: 500, y: 250, vx: -20, vy: 10, r: 15, age: 1, alpha: 1 }];
  const s = readSnapshot({ __game: g });
  assert.equal(s.ghosts.length, 1);
  assert.equal(s.ghosts[0].spectralKind, 'constitution');
  s.ghosts[0].x = 999;
  assert.equal(g.consts[0].x, 500);
});
