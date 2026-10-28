import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpeedControl } from '../src/speed.js';

test('instalar o controle preserva a velocidade original', () => {
  const player = { speed: 245, lives: 5, x: 130, y: 292.5 };
  const control = createSpeedControl(() => player);
  assert.equal(player.speed, 245);
  assert.equal(control.multiplier, 1);
});
test('multiplicadores usam a base original, sem acumular alterações', () => {
  const player = { speed: 245, lives: 5, x: 130, y: 292.5 };
  const control = createSpeedControl(() => player);
  control.setMultiplier(2);
  assert.equal(player.speed, 490);
  control.setMultiplier(3);
  assert.equal(player.speed, 735);
  assert.deepEqual({ ...player, speed: 245 }, { speed: 245, lives: 5, x: 130, y: 292.5 });
  control.reset();
  assert.equal(player.speed, 245);
  assert.equal(control.multiplier, 1);
});
test('valores inválidos são rejeitados sem modificar a partida', () => {
  const player = { speed: 245 };
  const control = createSpeedControl(() => player);
  for (const n of [0, -1, 21, NaN, Infinity, '2'])
    assert.throws(() => control.setMultiplier(n), /1.*20/);
  assert.equal(player.speed, 245);
});
test('20× usa a base original e pode voltar diretamente para 1×', () => {
  const player = { speed: 245, lives: 5, x: 130 };
  const control = createSpeedControl(() => player);
  control.setMultiplier(2);
  control.setMultiplier(20);
  assert.equal(player.speed, 4900);
  assert.equal(control.multiplier, 20);
  control.reset();
  assert.equal(player.speed, 245);
  assert.equal(player.lives, 5);
  assert.equal(player.x, 130);
});
test('o controle acompanha o objeto atual do jogador após reinício', () => {
  let player = { speed: 245 };
  const control = createSpeedControl(() => player);
  player = { speed: 245 };
  control.setMultiplier(2);
  assert.equal(player.speed, 490);
});
