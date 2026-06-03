import { getTheme } from './renderer.js';

export const coins = [];
export const particles = [];
export const enemies = [];
export const projectiles = [];

// Enemy tuning
const E_GRAVITY = 1600;
const STOMP_DAMAGE = 2;   // a head-stomp deals this much (kills 1-2 HP foes)
const STOMP_BOUNCE = 430; // upward velocity given to the player after a stomp
const INVULN_TIME = 0.9;  // player i-frames after taking a contact hit
// HP a side-contact hit drains from the player (out of 100), per enemy type.
const CONTACT_DAMAGE = { walker: 6, jumper: 8, brute: 15, flyer: 5 };

export let exitDoor = null;

export function initEntities(levelData) {
  coins.length = 0;
  particles.length = 0;
  enemies.length = 0;
  projectiles.length = 0;

  for (const c of levelData.coins) {
    coins.push({ x: c.x, y: c.y, collected: false, spinAngle: c.spinAngle || 0 });
  }

  // Clone enemy templates into live runtime objects (so respawn resets them).
  for (const e of (levelData.enemies || [])) {
    enemies.push({
      ...e,
      maxHp: e.hp,
      alive: true,
      vy: 0,
      t: e.phase || 0,
      hitFlash: 0,
      jumpTimer: e.jumpEvery ? e.jumpEvery * 0.5 : 0,
    });
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

export function addHitParticles(wx, wy, color, n = 7) {
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 130;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.4, maxLife: 0.4,
      color, size: 3.5, gravity: 360,
    });
  }
}

export function addExplosion(wx, wy, color) {
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2;
    const speed = 90 + Math.random() * 200;
    particles.push({
      x: wx, y: wy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.5, maxLife: 0.5,
      color: i % 2 ? color : '#ffae42', size: 5, gravity: 120,
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

// ─── COMBAT ──────────────────────────────────────────────────────────────

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function damageEnemy(e, dmg, knockDir, knock) {
  if (!e.alive) return;
  e.hp -= dmg;
  e.hitFlash = 0.13;
  if (e.type !== 'flyer') {
    // light knockback, clamped to the patrol band so it can't tunnel walls
    e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + knockDir * knock * 0.025));
  }
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  if (e.hp <= 0) {
    e.alive = false;
    addHitParticles(cx, cy, e.color, 12);
  } else {
    addHitParticles(cx, cy, '#ffffff', 4);
  }
}

// Instant melee swing: damages every enemy inside a hitbox in front of the
// player. Returns the number of enemies killed.
export function playerMeleeAttack(player, weapon) {
  const reach = weapon.reach || 24;
  const dir = player.facing;
  const hx = dir > 0 ? player.x + player.w - 4 : player.x - reach + 4;
  const hw = reach + 8;
  const hy = player.y - 4, hh = player.h + 8;
  let kills = 0;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (rectsOverlap(hx, hy, hw, hh, e.x, e.y, e.w, e.h)) {
      damageEnemy(e, weapon.damage, dir, weapon.knockback);
      if (!e.alive) kills++;
    }
  }
  return kills;
}

export function spawnProjectile(player, weapon) {
  const dir = player.facing;
  projectiles.push({
    x: player.x + player.w / 2 + dir * 16,
    y: player.y + player.h * 0.4,
    vx: dir * (weapon.speed || 500),
    vy: weapon.splash ? -55 : 0, // explosive arrows arc slightly
    grav: weapon.splash ? 340 : 0,
    dmg: weapon.damage,
    splash: weapon.splash || 0,
    knock: weapon.knockback || 200,
    color: weapon.color,
    r: weapon.splash ? 6 : 4,
    life: 2.4, dir,
  });
}

function detonate(pr) {
  if (pr.splash > 0) {
    addExplosion(pr.x, pr.y, pr.color);
    for (const e of enemies) {
      if (!e.alive) continue;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (Math.hypot(cx - pr.x, cy - pr.y) <= pr.splash) {
        damageEnemy(e, pr.dmg, cx < pr.x ? -1 : 1, pr.knock);
      }
    }
  } else {
    for (const e of enemies) {
      if (!e.alive) continue;
      if (rectsOverlap(pr.x - 3, pr.y - 3, 6, 6, e.x, e.y, e.w, e.h)) {
        damageEnemy(e, pr.dmg, pr.dir, pr.knock);
        break;
      }
    }
    addHitParticles(pr.x, pr.y, pr.color, 5);
  }
}

export function updateProjectiles(dt, platforms) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    pr.vy += pr.grav * dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;

    let hit = false;
    for (const p of platforms) {
      if (p.type === 'ground') {
        if (pr.x > p.x && pr.x < p.x + p.w && pr.y > p.y) { hit = true; break; }
      } else {
        if (p._crumbleState === 2) continue;
        if (pr.x > p.x && pr.x < p.x + p.w && pr.y > p.y && pr.y < p.y + p.h) { hit = true; break; }
      }
    }
    if (!hit) {
      for (const e of enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(pr.x - 2, pr.y - 2, 4, 4, e.x, e.y, e.w, e.h)) { hit = true; break; }
      }
    }

    if (hit || pr.life <= 0) {
      if (hit) detonate(pr);
      projectiles.splice(i, 1);
    }
  }
}

// Patrol AI + player contact/stomp. Returns { playerHit }.
export function updateEnemies(dt, platforms, player) {
  let playerHit = false;

  for (const e of enemies) {
    if (!e.alive) continue;
    e.t += dt;
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);

    if (e.type === 'flyer') {
      e.x = e.baseX + Math.sin(e.t * e.sx) * e.ampX;
      e.y = e.baseY + Math.sin(e.t * e.sy + 1.3) * e.ampY;
      e.dir = Math.cos(e.t * e.sx) >= 0 ? 1 : -1;
    } else if (e.type === 'jumper') {
      e.vy += E_GRAVITY * dt;
      e.y += e.vy * dt;
      if (e.y >= e.baseY) {
        e.y = e.baseY; e.vy = 0;
        e.jumpTimer -= dt;
        if (e.jumpTimer <= 0) { e.vy = -(e.jumpForce || 480); e.jumpTimer = e.jumpEvery || 1.4; }
      }
      e.x += e.dir * e.speed * dt;
      if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
      else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
    } else {
      // walker / brute
      e.x += e.dir * e.speed * dt;
      if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
      else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
    }

    if (player.dead) continue;
    if (rectsOverlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) {
      const prevBottom = player._prevY + player.h;
      const stomping = player.vy > 0 && prevBottom <= e.y + 12;
      if (stomping) {
        damageEnemy(e, STOMP_DAMAGE, player.x < e.x ? 1 : -1, 240);
        player.vy = -STOMP_BOUNCE;
        player.y = e.y - player.h;
        player._prevY = player.y;
        player.jumpsLeft = Math.max(player.jumpsLeft, 1); // regain a hop after a stomp
      } else {
        // If the player is mid-attack and facing this enemy, the weapon connects
        // and the contact deals no damage — so you can fight foes up close.
        const eCx = e.x + e.w / 2;
        const facingEnemy = player.facing > 0 ? eCx >= player.x : eCx <= player.x + player.w;
        const guarding = (player.attackCD > 0 || player.swingT > 0) && facingEnemy;
        // Otherwise the enemy chips the player's HP (with i-frames between hits).
        if (!guarding && player.invuln <= 0) {
          player.hp -= CONTACT_DAMAGE[e.type] || 12;
          player.invuln = INVULN_TIME;
          player.hurtFlash = 0.3;
          // knock the player back and up, away from the enemy
          const kdir = eCx >= player.x + player.w / 2 ? -1 : 1;
          player.vx = kdir * 260;
          player.vy = -250;
          if (player.hp <= 0) { player.hp = 0; playerHit = true; } // out of HP → death
        }
      }
    }
  }

  return { playerHit };
}

// ─── ENEMY / PROJECTILE RENDERING ──────────────────────────────────────────

export function drawProjectiles(ctx, camX, W) {
  for (const pr of projectiles) {
    if (pr.x < camX - 20 || pr.x > camX + W + 20) continue;
    // trail
    ctx.strokeStyle = pr.color;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = pr.r;
    ctx.beginPath();
    ctx.moveTo(pr.x, pr.y);
    ctx.lineTo(pr.x - pr.vx * 0.02, pr.y - pr.vy * 0.02);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // glow + core
    const g = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, pr.r * 3);
    g.addColorStop(0, pr.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawEnemies(ctx, camX, W, t) {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.x < camX - 60 || e.x > camX + W + 60) continue;

    const cx = e.x + e.w / 2;
    ctx.save();
    ctx.translate(cx, e.y);

    if (e.type === 'flyer') drawFlyer(ctx, e);
    else if (e.type === 'jumper') drawJumper(ctx, e);
    else if (e.type === 'brute') drawBrute(ctx, e);
    else drawWalker(ctx, e, t);

    // hit flash
    if (e.hitFlash > 0) {
      ctx.globalAlpha = e.hitFlash / 0.13 * 0.8;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-e.w / 2, 0, e.w, e.h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // HP pips above tougher enemies
    if (e.maxHp > 1) {
      const pw = e.w / e.maxHp;
      for (let i = 0; i < e.maxHp; i++) {
        ctx.fillStyle = i < e.hp ? '#e74c3c' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(e.x + i * pw + 1, e.y - 9, pw - 2, 4);
      }
    }
  }
}

function eyes(ctx, w, y, dir, angry) {
  const ex = w * 0.18;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-ex, y, 4, 0, Math.PI * 2);
  ctx.arc(ex, y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-ex + dir * 1.5, y, 2, 0, Math.PI * 2);
  ctx.arc(ex + dir * 1.5, y, 2, 0, Math.PI * 2);
  ctx.fill();
  if (angry) {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-ex - 4, y - 6); ctx.lineTo(-ex + 3, y - 3);
    ctx.moveTo(ex + 4, y - 6); ctx.lineTo(ex - 3, y - 3);
    ctx.stroke();
  }
}

function drawWalker(ctx, e, t) {
  const w = e.w, h = e.h;
  // shuffling feet
  const sh = Math.sin((t || 0) * 9 + e.x * 0.1) * 2;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-w * 0.32, h - 4 + sh, w * 0.26, 5);
  ctx.fillRect(w * 0.06, h - 4 - sh, w * 0.26, 5);
  // body
  ctx.fillStyle = e.color;
  roundRectE(ctx, -w / 2, 2, w, h - 4, 7);
  ctx.fill();
  // darker belly
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRectE(ctx, -w / 2 + 3, h * 0.5, w - 6, h * 0.4, 5);
  ctx.fill();
  eyes(ctx, w, h * 0.36, e.dir, true);
  // frown
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, h * 0.66, 4, Math.PI + 0.3, -0.3); ctx.stroke();
}

function drawBrute(ctx, e) {
  const w = e.w, h = e.h;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(-w * 0.34, h - 5, w * 0.3, 6);
  ctx.fillRect(w * 0.04, h - 5, w * 0.3, 6);
  // armored body
  ctx.fillStyle = e.color;
  roundRectE(ctx, -w / 2, 0, w, h - 3, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 3;
  roundRectE(ctx, -w / 2 + 1.5, 1.5, w - 3, h - 6, 6); ctx.stroke();
  // helmet band
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(-w / 2, h * 0.22, w, 5);
  eyes(ctx, w, h * 0.42, e.dir, true);
}

function drawJumper(ctx, e) {
  const w = e.w, h = e.h;
  // spring coil
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) ctx.arc(0, h - 4 - i * 4, w * 0.28, 0, Math.PI);
  ctx.stroke();
  ctx.fillStyle = e.color;
  ctx.beginPath();
  ctx.arc(0, h * 0.42, w * 0.46, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, w, h * 0.36, e.dir, false);
}

function drawFlyer(ctx, e) {
  const w = e.w, h = e.h;
  const flap = Math.sin(e.t * 14) * 0.5;
  // wings
  ctx.fillStyle = e.color;
  ctx.save(); ctx.translate(-w * 0.3, h * 0.4); ctx.rotate(-0.4 - flap);
  ctx.beginPath(); ctx.ellipse(-w * 0.25, 0, w * 0.4, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(w * 0.3, h * 0.4); ctx.rotate(0.4 + flap);
  ctx.beginPath(); ctx.ellipse(w * 0.25, 0, w * 0.4, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // body
  ctx.fillStyle = '#2a2230';
  ctx.beginPath(); ctx.ellipse(0, h * 0.45, w * 0.3, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  // glowing eyes
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(-w * 0.12, h * 0.35, 2.5, 0, Math.PI * 2);
  ctx.arc(w * 0.12, h * 0.35, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function roundRectE(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
