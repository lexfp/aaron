import { getTheme } from './renderer.js';

export const coins = [];
export const particles = [];
export const enemies = []; // stub — ready to populate

export let exitDoor = null;

export function initEntities(levelData) {
  coins.length = 0;
  particles.length = 0;
  enemies.length = 0;

  for (const c of levelData.coins) {
    coins.push({ x: c.x, y: c.y, collected: false, spinAngle: c.spinAngle || 0 });
  }

  exitDoor = { ...levelData.exit };
}

export function addCoinParticles(wx, wy) {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const speed = 55 + Math.random() * 80;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 55,
      life: 0.52, maxLife: 0.52,
      color: '#f1c40f', size: 4,
      gravity: 200,
    });
  }
}

export function addDJParticles(wx, wy) {
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2;
    const speed = 65 + Math.random() * 65;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.38, maxLife: 0.38,
      color: '#00ffe5', size: 3.5,
      gravity: 0,
    });
  }
}

export function addLandParticles(wx, wy) {
  for (let i = 0; i < 5; i++) {
    const spread = (i / 4 - 0.5) * 2;
    particles.push({
      x: wx + spread * 14, y: wy,
      vx: spread * 45,
      vy: -30 - Math.random() * 30,
      life: 0.3, maxLife: 0.3,
      color: 'rgba(200,200,200,0.7)', size: 3,
      gravity: 300,
    });
  }
}

export function updateEntities(dt, player, magnetRadius) {
  let coinsCollected = 0;

  for (const coin of coins) {
    if (coin.collected) continue;
    coin.spinAngle += dt * 3.2;

    const cx = coin.x + 8;
    const cy = coin.y + 8;
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const dx = cx - px;
    const dy = cy - py;
    const dist = Math.hypot(dx, dy);

    // Magnet pull
    if (dist < magnetRadius && dist > 4) {
      const pull = 280;
      coin.x -= (dx / dist) * pull * dt;
      coin.y -= (dy / dist) * pull * dt;
    }

    // Collect
    if (Math.abs(dx) < player.w / 2 + 10 && Math.abs(dy) < player.h / 2 + 10) {
      coin.collected = true;
      addCoinParticles(cx, cy);
      coinsCollected++;
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += p.gravity * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Stub: updateEnemies(dt, platforms) — TODO when enemies are added
  // updateEnemies(dt, platforms);

  return coinsCollected;
}

export function drawEntities(ctx, camX, stage, t) {
  const theme = getTheme(stage);
  const W = 800;

  // Coins
  for (const coin of coins) {
    if (coin.collected) continue;
    if (coin.x < camX - 30 || coin.x > camX + W + 30) continue;

    const drawW = Math.max(2, Math.abs(Math.cos(coin.spinAngle)) * 16);
    const cx = coin.x + 8;
    const cy = coin.y + 8;

    // Glow
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
    glow.addColorStop(0, 'rgba(255,215,0,0.35)');
    glow.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill();

    // Coin body
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.ellipse(cx, cy, drawW / 2, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner ring
    ctx.fillStyle = '#e6a800';
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, drawW / 2 - 3), 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    if (drawW > 5) {
      ctx.fillStyle = 'rgba(255,255,200,0.75)';
      ctx.beginPath();
      ctx.ellipse(cx - 2, cy - 2, drawW / 2 * 0.45, 2.5, -0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Exit door
  if (exitDoor) {
    const { x, y, w, h } = exitDoor;
    if (x > camX - 60 && x < camX + W + 60) {
      drawExitDoor(ctx, x, y, w, h, theme, t);
    }
  }

  // Particles (in world space)
  for (const p of particles) {
    if (p.x < camX - 30 || p.x > camX + W + 30) continue;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Stub: drawEnemies(ctx, camX, W) — TODO when enemies are added
}

function drawExitDoor(ctx, x, y, w, h, theme, t) {
  const pulse = 0.65 + Math.sin(t * 2.8) * 0.35;

  // Outer glow
  const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 55);
  glow.addColorStop(0, `rgba(155,89,182,${pulse * 0.28})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 55, y - 55, w + 110, h + 110);

  // Frame
  ctx.fillStyle = theme.accentColor;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);

  // Door body
  ctx.fillStyle = '#1a0a28';
  ctx.fillRect(x, y, w, h);

  // Animated portal interior
  ctx.fillStyle = theme.accentColor;
  ctx.globalAlpha = pulse * 0.4;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.globalAlpha = 1;

  // Star portal center
  ctx.fillStyle = theme.accentColor;
  ctx.globalAlpha = pulse;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // "EXIT" label above door
  ctx.fillStyle = theme.accentColor;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', x + w / 2, y - 10);
  ctx.textAlign = 'left';
}

// Stub functions for future enemy implementation
export function updateEnemies(dt, platforms) {
  // TODO: patrol AI, gravity, player collision
}

export function drawEnemies(ctx, camX, W) {
  // TODO: draw walking enemy sprites
}
