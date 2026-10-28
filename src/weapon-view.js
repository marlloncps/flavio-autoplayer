function wpnDraw(ctx, g, state) {
  ctx.clearRect(0, 0, 960, 540);
  if (g.state !== 'playing' || !state.settings.enabled) return;
  const cam = Math.max(0, Math.min(5665, g.player.x - 420)),
    px = g.player.x - cam,
    py = g.player.y;
  ctx.save();
  ctx.translate(px + 10, py - 5);
  ctx.rotate(state.aim.angle);
  const recoil = state.flash > 0 ? 2 : 0;
  ctx.translate(-recoil, 0);
  ctx.shadowBlur = 4;
  ctx.shadowColor = '#54f6ff';
  ctx.fillStyle = '#101b29';
  ctx.strokeStyle = '#aac9da';
  ctx.lineWidth = 0.8;
  ctx.fillRect(-3, -4, 23, 8);
  ctx.strokeRect(-3, -4, 23, 8);
  ctx.fillStyle = '#2c4056';
  ctx.fillRect(1, 3, 5, 8);
  ctx.fillStyle = '#f3bf8c';
  ctx.fillRect(-1, 2, 5, 4);
  ctx.fillStyle = '#67f3ff';
  ctx.fillRect(6, -2, 12, 2);
  ctx.fillStyle = '#c6edff';
  ctx.fillRect(18, -3, 4, 6);
  if (state.flash > 0) {
    ctx.globalAlpha = Math.min(1, state.flash / 0.04);
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ebffff';
    ctx.beginPath();
    ctx.moveTo(21, -2);
    ctx.lineTo(34, -5);
    ctx.lineTo(29, 0);
    ctx.lineTo(34, 5);
    ctx.lineTo(21, 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  for (const b of state.bullets) {
    const angle = Math.atan2(b.vy, b.vx),
      x = b.x - cam;
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#53f4ff';
    ctx.strokeStyle = '#70f5ff';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(angle) * 17, b.y - Math.sin(angle) * 17);
    ctx.lineTo(x, b.y);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  }
  for (const effect of state.effects) {
    const t = 1 - effect.ttl / 0.4,
      x = effect.x - cam;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = '#78f5ff';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = '#78f5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, effect.y, 8 + t * 25, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (8 + t * 15), effect.y + Math.sin(a) * (8 + t * 15));
      ctx.lineTo(x + Math.cos(a) * (13 + t * 30), effect.y + Math.sin(a) * (13 + t * 30));
      ctx.stroke();
    }
    ctx.font = 'bold 8px ui-monospace,monospace';
    ctx.fillStyle = '#baffff';
    ctx.textAlign = 'center';
    ctx.fillText('ACERTO', x, effect.y - 22 - t * 10);
    ctx.restore();
  }
  const target = state.aim.target;
  if (target) {
    const x = target.x - cam,
      y = target.y;
    ctx.strokeStyle = 'rgba(108,243,255,.5)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(px + 10, py - 5);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.moveTo(x - 12, y);
    ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12);
    ctx.lineTo(x, y + 12);
    ctx.stroke();
  }
}

export function installWeaponLayer(win, doc, { weapon, getStatus, onError }) {
  const canvas = doc.createElement('canvas');
  canvas.id = 'flavio-weapon-canvas';
  canvas.width = 960;
  canvas.height = 540;
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: '2147483644',
    background: 'transparent',
  });
  doc.documentElement.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let last = win.performance.now();
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      const g = win.__game,
        rect = doc.querySelector('#game')?.getBoundingClientRect();
      if (doc.hidden || !g || !rect) {
        weapon.ceaseFire();
        ctx.clearRect(0, 0, 960, 540);
      } else {
        Object.assign(canvas.style, {
          left: rect.left + 'px',
          top: rect.top + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px',
        });
        weapon.update(dt, getStatus().running);
        wpnDraw(ctx, g, weapon.state);
        canvas.dataset.shots = String(weapon.state.shots);
        canvas.dataset.hits = String(weapon.state.hits);
      }
    } catch (error) {
      weapon.setEnabled(false);
      ctx.clearRect(0, 0, 960, 540);
      onError(error);
    }
    win.requestAnimationFrame(frame);
  }
  win.requestAnimationFrame(frame);
}
