import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeaponSystem } from '../src/weapon.js';

function game() {
  return {
    state: 'playing',
    player: { x: 130, y: 292.5, speed: 245, lives: 5 },
    gate: { x: 3310, arm: 1 },
    enemies: [],
    cars: [],
    ghosts: [],
    consts: [],
  };
}
const enemy = (x, y = 292.5) => ({ type: 'prf', x, y, r: 12 });

test('equipar não altera jogador nem remove alvos antes de disparar', () => {
  const g = game();
  g.enemies.push(enemy(240));
  const before = JSON.stringify(g);
  const w = createWeaponSystem(() => g);
  assert.equal(w.state.settings.enabled, true);
  assert.equal(JSON.stringify(g), before);
  assert.equal(w.state.shots, 0);
});
test('projétil atinge e remove somente o primeiro alvo no percurso', () => {
  const g = game();
  g.enemies.push(enemy(240), enemy(300));
  const w = createWeaponSystem(() => g);
  assert.equal(w.fire(), true);
  w.update(0.1, false);
  assert.equal(g.enemies.length, 1);
  assert.equal(g.enemies[0].x, 300);
  assert.equal(w.state.hits, 1);
  assert.equal(g.player.lives, 5);
  assert.equal(g.player.x, 130);
});
test('colisão contínua detecta alvo mesmo em projétil muito rápido', () => {
  const g = game();
  g.player.speed = 4900;
  g.enemies.push(enemy(240));
  const w = createWeaponSystem(() => g);
  w.fire();
  w.update(0.05, false);
  assert.equal(g.enemies.length, 0);
  assert.equal(w.state.hits, 1);
});
test('colisão funciona para viaturas, fantasmas e obstáculos novos', () => {
  for (const [array, entity] of [
    ['cars', { x: 240, y: 292.5 }],
    ['ghosts', { x: 240, y: 292.5, r: 15, alpha: 1 }],
    ['consts', { x: 240, y: 292.5, r: 15, alpha: 1 }],
  ]) {
    const g = game();
    g[array].push(entity);
    const w = createWeaponSystem(() => g);
    w.fire();
    w.update(0.15, false);
    assert.equal(g[array].length, 0);
    assert.equal(w.state.hits, 1);
  }
});
test('intervalo entre tiros limita o automático e evita disparo fora da partida', () => {
  const g = game();
  g.enemies.push(enemy(500));
  const w = createWeaponSystem(() => g);
  w.update(0.01, true);
  assert.equal(w.state.shots, 1);
  w.update(0.01, true);
  assert.equal(w.state.shots, 1);
  g.state = 'cabin';
  assert.equal(w.fire(), false);
  w.update(0.5, true);
  assert.equal(w.state.bullets.length, 0);
});
test('desligar ou interromper cancela projéteis sem remover alvos', () => {
  const g = game();
  g.enemies.push(enemy(400));
  const w = createWeaponSystem(() => g);
  w.fire();
  w.ceaseFire();
  w.update(0.3, false);
  assert.equal(g.enemies.length, 1);
  w.setEnabled(false);
  assert.equal(w.fire(), false);
});
test('o tiro manual funciona com o automático desligado', () => {
  const g = game();
  g.enemies.push(enemy(240));
  const w = createWeaponSystem(() => g);
  w.state.settings.auto = false;
  w.update(0.02, true);
  assert.equal(w.state.shots, 0);
  w.setTrigger(true);
  w.update(0.02, false);
  assert.equal(w.state.shots, 1);
});
test('reiniciar a partida limpa projéteis e contadores', () => {
  const g = game();
  g.enemies.push(enemy(240));
  const w = createWeaponSystem(() => g);
  w.fire();
  w.update(0.1, false);
  assert.equal(w.state.hits, 1);
  g.enemies = [enemy(350)];
  w.update(0.01, false);
  assert.equal(w.state.hits, 0);
  assert.equal(w.state.shots, 0);
  assert.equal(w.state.bullets.length, 0);
});
