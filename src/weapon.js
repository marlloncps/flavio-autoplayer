// Mod local: projéteis próprios; o impacto remove apenas o alvo atingido do array vivo do jogo.
function wpnCircleTime(a, b, c, r) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    fx = a.x - c.x,
    fy = a.y - c.y;
  const cc = fx * fx + fy * fy - r * r;
  if (cc <= 0) return 0;
  const aa = dx * dx + dy * dy;
  if (!aa) return null;
  const bb = 2 * (fx * dx + fy * dy),
    disc = bb * bb - 4 * aa * cc;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}
function wpnRectTime(a, b, c) {
  let enter = 0,
    exit = 1;
  for (const [p, d, min, max] of [
    [a.x, b.x - a.x, c.x - 40, c.x + 40],
    [a.y, b.y - a.y, c.y - 15, c.y + 17],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (p < min || p > max) return null;
      continue;
    }
    let t1 = (min - p) / d,
      t2 = (max - p) / d;
    if (t1 > t2) [t1, t2] = [t2, t1];
    enter = Math.max(enter, t1);
    exit = Math.min(exit, t2);
    if (enter > exit) return null;
  }
  return enter >= 0 && enter <= 1 ? enter : null;
}
function wpnCandidates(g) {
  return [
    ['enemies', 'person'],
    ['cars', 'car'],
    ['ghosts', 'ghost'],
    ['consts', 'constitution'],
  ].flatMap(([name, kind]) =>
    (g[name] || [])
      .filter(
        (e) =>
          Number.isFinite(e.x) && Number.isFinite(e.y) && (e.alpha === undefined || e.alpha > 0.2),
      )
      .map((entity) => ({ entity, array: g[name], kind: kind === 'person' ? entity.type : kind })),
  );
}
function wpnTarget(g) {
  const p = g.player,
    cam = Math.max(0, Math.min(5665, p.x - 420));
  return (
    wpnCandidates(g)
      .filter((t) => t.entity.x >= cam && t.entity.x <= cam + 960)
      .map((t) => ({ ...t, distance: Math.hypot(t.entity.x - p.x, t.entity.y - p.y) }))
      .filter((t) => t.distance < 500)
      .sort((a, b) => a.distance - b.distance)[0] || null
  );
}
function wpnLead(g, target, origin, bulletSpeed) {
  const e = target.entity;
  let vx = e.vx ?? (e.dir || 0) * (e.speed || 0),
    vy = e.vy || 0;
  if (e.type === 'red' && e.chasing) {
    const dx = g.player.x - e.x,
      dy = g.player.y - e.y,
      d = Math.hypot(dx, dy) || 1,
      sp = Math.min((e.speed || 0) + 30, g.player.speed * 0.6);
    vx = (dx / d) * sp;
    vy = (dy / d) * sp;
  } else if (
    e.type === 'prf' &&
    Math.abs(e.x - g.player.x) < 140 &&
    Math.abs(e.y - g.player.y) < 115
  ) {
    vy = Math.sign(g.player.y - e.y) * (e.speed || 0) * 0.5;
  }
  const time = Math.min(0.45, Math.hypot(e.x - origin.x, e.y - origin.y) / bulletSpeed);
  return { x: e.x + vx * time, y: e.y + vy * time };
}

export function createWeaponSystem(getGame) {
  const state = {
    settings: { enabled: true, auto: true },
    bullets: [],
    effects: [],
    shots: 0,
    hits: 0,
    hitKinds: {},
    aim: { angle: 0, target: null },
    flash: 0,
    cooldown: 0,
    trigger: false,
    time: 0,
    events: [],
  };
  let enemiesRef = getGame()?.enemies;
  function event(data) {
    state.events.push({ at: state.time, ...data });
    if (state.events.length > 250) state.events.shift();
  }
  function ceaseFire() {
    state.trigger = false;
    state.bullets = [];
    state.flash = 0;
  }
  function syncRound(g) {
    if (g.enemies !== enemiesRef) {
      enemiesRef = g.enemies;
      ceaseFire();
      state.effects = [];
      state.shots = 0;
      state.hits = 0;
      state.hitKinds = {};
      state.events = [];
      state.cooldown = 0;
      state.aim = { angle: 0, target: null };
    }
  }
  function setEnabled(on) {
    state.settings.enabled = Boolean(on);
    if (!on) ceaseFire();
  }
  function fire() {
    const g = getGame();
    if (!g || g.state !== 'playing' || !state.settings.enabled) return false;
    syncRound(g);
    if (state.cooldown > 0) return false;
    const origin = { x: g.player.x + 10, y: g.player.y - 5 },
      speed = Math.max(1400, g.player.speed * 1.5),
      target = wpnTarget(g);
    const aim = target ? wpnLead(g, target, origin, speed) : { x: origin.x + 500, y: origin.y };
    const angle = Math.atan2(aim.y - origin.y, aim.x - origin.x);
    state.aim = { angle, target: target ? { ...aim, kind: target.kind } : null };
    state.bullets.push({
      x: origin.x + Math.cos(angle) * 17,
      y: origin.y + Math.sin(angle) * 17,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      remaining: 650,
    });
    state.cooldown = 0.18;
    state.flash = 0.065;
    state.shots++;
    event({ type: 'shot', x: origin.x, y: origin.y, kind: target?.kind || null });
    return true;
  }
  function update(dt, autoRequested = false) {
    if (!Number.isFinite(dt) || dt < 0) return;
    const g = getGame();
    if (!g) return;
    syncRound(g);
    state.time += dt;
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    for (const effect of state.effects) effect.ttl -= dt;
    state.effects = state.effects.filter((e) => e.ttl > 0);
    if (g.state !== 'playing' || !state.settings.enabled) {
      ceaseFire();
      return;
    }
    if (state.trigger || (autoRequested && state.settings.auto && wpnTarget(g))) fire();
    const alive = [];
    for (const bullet of state.bullets) {
      const speed = Math.hypot(bullet.vx, bullet.vy),
        travel = Math.min(bullet.remaining, speed * dt);
      const end = {
        x: bullet.x + (bullet.vx / speed) * travel,
        y: bullet.y + (bullet.vy / speed) * travel,
      };
      let first = null;
      for (const target of wpnCandidates(g)) {
        const t =
          target.kind === 'car'
            ? wpnRectTime(bullet, end, target.entity)
            : wpnCircleTime(bullet, end, target.entity, (target.entity.r || 12) + 2);
        if (t !== null && (!first || t < first.t)) first = { ...target, t };
      }
      if (first) {
        const index = first.array.indexOf(first.entity);
        if (index >= 0) {
          first.array.splice(index, 1);
          state.hits++;
          state.hitKinds[first.kind] = (state.hitKinds[first.kind] || 0) + 1;
          state.effects.push({ x: first.entity.x, y: first.entity.y, ttl: 0.4, kind: first.kind });
          if (state.effects.length > 30) state.effects.shift();
          event({ type: 'hit', kind: first.kind, x: first.entity.x, y: first.entity.y });
        }
      } else {
        bullet.x = end.x;
        bullet.y = end.y;
        bullet.remaining -= travel;
        if (bullet.remaining > 0 && bullet.y > 80 && bullet.y < 470) alive.push(bullet);
      }
    }
    state.bullets = alive;
    if (!wpnTarget(g)) state.aim.target = null;
  }
  return {
    state,
    fire,
    update,
    ceaseFire,
    setEnabled,
    setTrigger: (on) => {
      state.trigger = Boolean(on);
    },
  };
}
