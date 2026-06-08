import { getTheme } from './renderer.js';

export const coins = [];
export const particles = [];
export const enemies = [];
export const projectiles = [];
export const enemyShots = []; // bolts fired by 'shoot' species (space turrets)

// Enemy tuning
const E_GRAVITY = 1600;
const STOMP_DAMAGE = 2;   // a head-stomp deals this much (kills 1-2 HP foes)
const STOMP_BOUNCE = 430; // upward velocity given to the player after a stomp
const INVULN_TIME = 0.9;  // player i-frames after taking a contact hit
// Fallback contact damage for legacy enemy types; species define their own `dmg`.
const CONTACT_DAMAGE = { walker: 6, jumper: 8, brute: 15, flyer: 5 };
// Legacy type → behavior mapping (species carry an explicit `behavior` field).
const LEGACY_BEHAVIOR = { walker: 'walk', jumper: 'hop', brute: 'walk', flyer: 'fly' };

export let exitDoor = null;

export function initEntities(levelData) {
  coins.length = 0;
  particles.length = 0;
  enemies.length = 0;
  projectiles.length = 0;
  enemyShots.length = 0;

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

  // Exit door (locked + dimmed while a stage boss is alive)
  if (exitDoor) {
    const { x, y, w, h } = exitDoor;
    if (x > camX - 60 && x < camX + W + 60) {
      drawExitDoor(ctx, x, y, w, h, theme, t, isBossAlive());
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

function drawExitDoor(ctx, x, y, w, h, theme, t, locked) {
  const pulse = locked ? 0.22 : 0.65 + Math.sin(t * 2.8) * 0.35;
  const acc = locked ? '#555566' : theme.accentColor;

  // Outer glow
  const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, 55);
  glow.addColorStop(0, `rgba(155,89,182,${pulse * 0.28})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 55, y - 55, w + 110, h + 110);

  // Frame
  ctx.fillStyle = acc;
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);

  // Door body
  ctx.fillStyle = '#1a0a28';
  ctx.fillRect(x, y, w, h);

  // Animated portal interior
  ctx.fillStyle = acc;
  ctx.globalAlpha = pulse * 0.4;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
  ctx.globalAlpha = 1;

  // Star portal center (a lock bar while the boss lives)
  ctx.fillStyle = acc;
  if (locked) {
    ctx.fillRect(x + w / 2 - 8, y + h / 2 - 3, 16, 6);
    ctx.strokeStyle = acc; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2 - 6, 6, Math.PI, 0); ctx.stroke();
    ctx.lineWidth = 1;
  } else {
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Label above the door
  ctx.fillStyle = locked ? '#8888aa' : theme.accentColor;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(locked ? 'DEFEAT THE BOSS' : 'EXIT', x + w / 2, y - 10);
  ctx.textAlign = 'left';
}

// ─── COMBAT ──────────────────────────────────────────────────────────────

// The exit door stays locked while a stage boss lives (checked by main.js).
export function isBossAlive() {
  return enemies.some(e => e.boss && e.alive);
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function damageEnemy(e, dmg, knockDir, knock) {
  if (!e.alive) return;
  e.hp -= dmg;
  e.hitFlash = 0.13;
  if (!e.air) {
    const dx = knockDir * knock * 0.025;
    // free-roaming hoppers take plain knockback; others stay in their band
    if (e.behavior === 'hop') e.x += dx;
    else if (e.patrolMax > e.patrolMin) e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + dx));
  }
  const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
  if (e.hp <= 0) {
    e.alive = false;
    addHitParticles(cx, cy, e.color, 12);
    if (e.boss) { // boss defeat: big celebratory blast (also unlocks the exit)
      addExplosion(cx, cy, e.color);
      addExplosion(cx, cy - 20, '#ffd700');
    }
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

// ─── BOSS SPECIAL ATTACKS ────────────────────────────────────────────────────
// Each of the 10 boss species has a unique special: projectile patterns,
// movement overrides, or area blasts. `_specialCD` counts down every frame;
// on zero it fires and resets. Rage at 50% HP cuts the cooldown by 35%.

function bossFireShot(e, vx, vy, color, dmg, grav, life, r) {
  const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
  enemyShots.push({ x: ecx, y: ecy, vx, vy: vy || 0, dmg, grav: grav || 0,
                    life: life || 2.2, r: r || 7, color, boss: true });
}

function triggerBossSpecial(e, pcx, pcy) {
  const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
  const dir = pcx >= ecx ? 1 : -1;
  e._atkFlash = 0.45;
  switch (e.species) {
    case 'slime':  // triple arcing green blob
      bossFireShot(e, -100, -550, '#58b94a', e.dmg, 1100, 2.0, 9);
      bossFireShot(e,    0, -620, '#58b94a', e.dmg, 1100, 2.0, 9);
      bossFireShot(e,  100, -550, '#58b94a', e.dmg, 1100, 2.0, 9);
      break;
    case 'crawler':  // shockwave: side shots + lobbed rock toward player
      bossFireShot(e, -360, 0, '#7f8c8d', e.dmg, 0, 2.0, 8);
      bossFireShot(e,  360, 0, '#7f8c8d', e.dmg, 0, 2.0, 8);
      bossFireShot(e, dir * 270, -85, '#9b9ba8', e.dmg, 230, 2.0, 9);
      addHitParticles(ecx, ecy + e.h * 0.5, '#aaa', 10);
      break;
    case 'slider':  // ice dash — movement handled in boss behavior block
      e._sliding = true; e._slideDir = dir; e._slideT = 0.6; e._slideV = 600;
      break;
    case 'scorpion': {  // 5-way venom fan aimed at the player
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -2; i <= 2; i++) {
        const a = ang + i * 0.3;
        bossFireShot(e, Math.cos(a) * 390, Math.sin(a) * 390, '#cc8e35', e.dmg, 0, 2.2, 8);
      }
      break;
    }
    case 'lavablob':  // 6-way radial magma slam + explosion ring
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        bossFireShot(e, Math.cos(a) * 320, Math.sin(a) * 320 - 50, '#ff793f', e.dmg, 290, 1.8, 10);
      }
      addExplosion(ecx, ecy + e.h * 0.45, '#ff793f');
      break;
    case 'bird': {  // 3 feather darts aimed at the player
      const ang = Math.atan2(pcy - ecy, pcx - ecx);
      for (let i = -1; i <= 1; i++) {
        const a = ang + i * 0.24;
        bossFireShot(e, Math.cos(a) * 370, Math.sin(a) * 370, '#f0e6d3', Math.round(e.dmg * 0.85), 0, 2.0, 7);
      }
      break;
    }
    case 'shroom': {  // large arcing spore bomb lobbed at player
      const dx = pcx - ecx, dy = pcy - ecy;
      const dist = Math.max(80, Math.hypot(dx, dy));
      bossFireShot(e, (dx / dist) * 200, -430, '#e17055', e.dmg, 720, 3.2, 14);
      break;
    }
    case 'drone':  // 5-beam laser spread fired straight down
      for (let i = -2; i <= 2; i++) bossFireShot(e, i * 72, 440, '#00d2d3', e.dmg, 0, 1.6, 7);
      break;
    case 'golem':  // 8-way crystal burst (radial in all directions)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        bossFireShot(e, Math.cos(a) * 300, Math.sin(a) * 300, '#48dbfb', e.dmg, 0, 1.8, 9);
      }
      addExplosion(ecx, ecy, '#48dbfb');
      break;
    case 'knight': {  // blade flurry: 3 slashes + lunging leap
      bossFireShot(e, dir * 490, -20, '#8854d0', e.dmg, 0, 1.4, 8);
      bossFireShot(e, dir * 430, -55, '#8854d0', e.dmg, 60, 1.4, 8);
      bossFireShot(e, dir * 460,  15, '#8854d0', e.dmg, 0, 1.4, 8);
      if (e.vy === 0) { e.vy = -480; e._vx = dir * 260; }
      break;
    }
  }
}

// Per-species behavior AI + player contact/stomp. Returns { playerHit }.
// Behaviors: walk (patrol), hop (bouncing patrol), fly (sine hover), swoop
// (hover→dive at player→return), float (slow homing drift), orbit (circles an
// anchor), charge (telegraph then dash), drop (falls when you pass beneath),
// spider (descends a thread, climbs back), shoot (fires bolts at the player).
export function updateEnemies(dt, platforms, player) {
  let playerHit = false;
  const pcx = player.x + player.w / 2;
  const pcy = player.y + player.h / 2;

  const hurtPlayer = (dmg, fromX) => {
    if (player.invuln > 0 || player.dead) return;
    player.hp -= dmg;
    player.invuln = INVULN_TIME;
    player.hurtFlash = 0.3;
    player.vx = (fromX >= pcx ? -1 : 1) * 260; // knock away from the source
    player.vy = -250;
    if (player.hp <= 0) { player.hp = 0; playerHit = true; }
  };

  for (const e of enemies) {
    if (!e.alive) continue;
    e.t += dt;
    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    const bhv = e.behavior || LEGACY_BEHAVIOR[e.type] || 'walk';
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;

    if (bhv === 'fly') {
      // Free-flying: pursues the player when near, otherwise hovers near home.
      const distP = Math.hypot(pcx - ecx, pcy - ecy);
      if (distP < 300 && distP > 1) {
        const sp = e.chase || 85;
        e.x += (pcx - ecx) / distP * sp * dt;
        e.y += (pcy - ecy) / distP * sp * dt + Math.sin(e.t * 3) * 10 * dt;
        e.dir = pcx >= ecx ? 1 : -1;
      } else {
        const hx = e.baseX + Math.sin(e.t * e.sx) * e.ampX;
        const hy = e.baseY + Math.sin(e.t * e.sy + 1.3) * e.ampY;
        e.x += (hx - e.x) * Math.min(1, dt * 2.5);
        e.y += (hy - e.y) * Math.min(1, dt * 2.5);
        e.dir = Math.cos(e.t * e.sx) >= 0 ? 1 : -1;
      }
    } else if (bhv === 'hop') {
      // Free-roaming hopper: real gravity + landing on any platform; hops toward
      // the player when they're near instead of staying on its home patrol.
      e.vy += E_GRAVITY * dt;
      const prevBottom = e.y + e.h;
      e.y += e.vy * dt;
      let grounded = false;
      if (e.vy >= 0) {
        for (const pl of platforms) {
          if (pl._crumbleState === 2) continue;
          if (e.x + e.w <= pl.x || e.x >= pl.x + pl.w) continue;
          if (prevBottom <= pl.y + 6 && e.y + e.h >= pl.y) {
            e.y = pl.y - e.h; e.vy = 0; grounded = true; break;
          }
        }
      }
      if (e.y > 600) { e.alive = false; continue; } // hopped into a pit
      const near = Math.abs(pcx - ecx) < 320 && Math.abs(pcy - ecy) < 240;
      if (grounded) {
        if (near) e.dir = pcx >= ecx ? 1 : -1;
        e.jumpTimer -= dt;
        if (e.jumpTimer <= 0) { e.vy = -(e.jumpForce || 480); e.jumpTimer = e.jumpEvery || 1.4; }
        e.x += e.dir * e.speed * dt * (near ? 1 : 0.65);
        if (!near) { // patrol the home platform while idle
          if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
          else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
        }
      } else {
        e.x += e.dir * e.speed * dt; // carry momentum through the air
      }
    } else if (bhv === 'boss') {
      if (e._sliding) {  // slider boss: high-speed ice dash across arena
        e.dir = e._slideDir;
        e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + e._slideDir * e._slideV * dt));
        e._slideT -= dt;
        if (e._slideT <= 0 || e.x <= e.patrolMin + 4 || e.x >= e.patrolMax - 4) {
          e._sliding = false;
          addHitParticles(ecx, ecy, '#82ccdd', 8); // ice shatter on stop
        }
      } else if (e.vy !== 0 || e.y < e.baseY) { // airborne mid-leap
        e.vy += E_GRAVITY * dt;
        e.y += e.vy * dt;
        e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + (e._vx || 0) * dt));
        if (e.y >= e.baseY) {
          e.y = e.baseY; e.vy = 0; e._vx = 0;
          addLandParticles(ecx, e.y + e.h);
        }
      } else {
        if (e._cd === undefined) e._cd = 1.1;
        e._cd = Math.max(0, e._cd - dt);
        e.dir = pcx >= ecx ? 1 : -1;
        e.x = Math.max(e.patrolMin, Math.min(e.patrolMax, e.x + e.dir * e.speed * dt));
        if (e._cd <= 0) {
          e.vy = -e.leapForce;
          e._vx = e.dir * Math.max(120, Math.min(330, Math.abs(pcx - ecx)));
          e._cd = e.leapEvery;
        }
      }
    } else if (bhv === 'walk') {
      e.x += e.dir * e.speed * dt;
      if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
      else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
    } else if (bhv === 'charge') {
      e._cd = Math.max(0, (e._cd || 0) - dt);
      if (e._st === 2) {            // dashing
        e.x += e.dir * e.chargeSpeed * dt;
        e._stT -= dt;
        if (e.x <= e.patrolMin) { e.x = e.patrolMin; e._st = 0; e._cd = 1.3; }
        else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e._st = 0; e._cd = 1.3; }
        else if (e._stT <= 0) { e._st = 0; e._cd = 1.3; }
      } else if (e._st === 1) {     // telegraph windup
        e._stT -= dt;
        if (e._stT <= 0) { e._st = 2; e._stT = 0.9; }
      } else {                      // patrol + look for the player
        e.x += e.dir * e.speed * dt;
        if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
        else if (e.x >= e.patrolMax) { e.x = e.patrolMax; e.dir = -1; }
        if (!e._cd && Math.abs(pcy - ecy) < 70 && Math.abs(pcx - ecx) < e.chargeRange) {
          e._st = 1; e._stT = 0.32; e.dir = pcx > ecx ? 1 : -1;
        }
      }
    } else if (bhv === 'swoop') {
      if (e._mode === 1) {          // diving at the snapshotted spot
        const dx = e._tx - ecx, dy = e._ty - ecy;
        const d = Math.hypot(dx, dy);
        e._stT -= dt;
        if (d < 12 || e._stT <= 0) e._mode = 2;
        else {
          e.x += dx / d * e.swoopSpeed * dt;
          e.y += dy / d * e.swoopSpeed * dt;
          e.dir = dx >= 0 ? 1 : -1;
        }
      } else if (e._mode === 2) {   // gliding back to the perch
        const dx = e.baseX - ecx, dy = e.baseY - ecy;
        const d = Math.hypot(dx, dy);
        if (d < 8) { e._mode = 0; e._cd = 1.0; }
        else {
          e.x += dx / d * e.swoopSpeed * 0.6 * dt;
          e.y += dy / d * e.swoopSpeed * 0.6 * dt;
          e.dir = dx >= 0 ? 1 : -1;
        }
      } else {                      // hovering at the perch
        e.x = e.baseX + Math.sin(e.t * 1.2) * 16 - e.w / 2;
        e.y = e.baseY + Math.sin(e.t * 1.9) * 9;
        e._cd = Math.max(0, (e._cd || 0) - dt);
        if (!e._cd && Math.hypot(pcx - ecx, pcy - ecy) < e.swoopRange) {
          e._mode = 1; e._tx = pcx; e._ty = pcy; e._stT = 1.0;
        }
      }
    } else if (bhv === 'float') {
      // Slow homing drift while the player is near; otherwise drift home.
      const near = Math.hypot(pcx - ecx, pcy - ecy) < 340;
      const tx = near ? pcx : e.baseX, ty = near ? pcy : e.baseY;
      const dx = tx - ecx, dy = ty - ecy;
      const d = Math.hypot(dx, dy) || 1;
      const sp = Math.min(e.floatSpeed, d * 2);
      e.x += dx / d * sp * dt;
      e.y += dy / d * sp * dt + Math.sin(e.t * 2.2) * 12 * dt;
      e.dir = dx >= 0 ? 1 : -1;
    } else if (bhv === 'orbit') {
      // The anchor itself stalks the player slowly, so orbiters roam too.
      const dax = pcx - e.baseX, day = pcy - e.baseY;
      const da = Math.hypot(dax, day);
      if (da > 1 && da < 320) {
        e.baseX += dax / da * 28 * dt;
        e.baseY += day / da * 28 * dt;
      }
      const a = e.t * e.orbitSpd + (e.phase || 0);
      e.x = e.baseX + Math.cos(a) * e.orbitR - e.w / 2;
      e.y = e.baseY + Math.sin(a) * e.orbitR * 0.7 - e.h / 2;
      e.dir = -Math.sin(a) >= 0 ? 1 : -1;
    } else if (bhv === 'drop') {
      if (e._mode === 1) {          // falling
        e.vy += 2300 * dt;
        e.y += e.vy * dt;
        for (const pl of platforms) {
          if (pl._crumbleState === 2) continue;
          if (e.x + e.w > pl.x && e.x < pl.x + pl.w &&
              e.y + e.h >= pl.y && e.y + e.h <= pl.y + pl.h + 18) {
            e.alive = false; // shatters on impact
            addHitParticles(ecx, e.y + e.h, e.color, 10);
            break;
          }
        }
        if (e.y > 600) e.alive = false;
      } else {                      // hanging, waiting for the player below
        e.y = e.baseY + Math.sin(e.t * 1.4) * 2;
        if (Math.abs(pcx - ecx) < 30 && pcy > e.y + e.h) { e._mode = 1; e.vy = 60; }
      }
    } else if (bhv === 'spider') {
      if (e._mode === 1) {          // dropping down the thread
        e.y += e.dropSpeed * dt;
        if (e.y >= e.dropY) { e.y = e.dropY; e._mode = 2; e._stT = 0.65; }
      } else if (e._mode === 2) {   // lingering low
        e._stT -= dt;
        if (e._stT <= 0) e._mode = 3;
      } else if (e._mode === 3) {   // climbing back up
        e.y -= 120 * dt;
        if (e.y <= e.anchorY) { e.y = e.anchorY; e._mode = 0; e._cd = 0.8; }
      } else {                      // waiting at the anchor
        e.y = e.anchorY + Math.sin(e.t * 1.6) * 4;
        e._cd = Math.max(0, (e._cd || 0) - dt);
        if (!e._cd && Math.abs(pcx - ecx) < 64 && pcy > e.y) e._mode = 1;
      }
    } else if (bhv === 'shoot') {
      e.dir = pcx >= ecx ? 1 : -1;  // track the player
      if (e._cd === undefined) e._cd = e.fireEvery * 0.5;
      e._cd = Math.max(0, e._cd - dt);
      if (e._cd <= 0 && Math.abs(pcx - ecx) < e.range && Math.abs(pcy - ecy) < 90) {
        enemyShots.push({
          x: ecx + e.dir * (e.w / 2 + 6), y: e.y + 6,
          vx: e.dir * 330, dmg: e.shotDmg, life: 2.2,
        });
        e._cd = e.fireEvery;
      }
    }

    // Boss special attack system: per-species cooldown + rage at 50% HP
    if (e.boss) {
      if (!e._rage && e.hp > 0 && e.hp <= e.maxHp * 0.5) {
        e._rage = true;
        e.speed = Math.round((e.speed || 60) * 1.4);
        if (e.leapEvery) e.leapEvery = Math.max(0.9, e.leapEvery * 0.7);
        e.swoopSpeed = Math.round((e.swoopSpeed || 300) * 1.3);
        addExplosion(ecx, ecy, e.color);
        addExplosion(ecx, ecy - 24, '#ff4500');
      }
      if (e._atkFlash > 0) e._atkFlash -= dt;
      e._specialCD -= dt;
      if (e._specialCD <= 0) {
        triggerBossSpecial(e, pcx, pcy);
        e._specialCD = e._baseCD * (e._rage ? 0.65 : 1.0);
      }
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
        if (!guarding) hurtPlayer(e.dmg || CONTACT_DAMAGE[e.type] || 8, eCx);
      }
    }
  }

  // Enemy shots: turret bolts (straight) + boss specials (may arc with vy/grav).
  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const s = enemyShots[i];
    s.x += s.vx * dt;
    s.y += (s.vy || 0) * dt;
    s.vy = (s.vy || 0) + (s.grav || 0) * dt;
    s.life -= dt;
    let dead = s.life <= 0;
    if (!dead) {
      for (const pl of platforms) {
        if (pl._crumbleState === 2) continue;
        if (pl.type === 'ground') {
          if (s.x > pl.x && s.x < pl.x + pl.w && s.y > pl.y) { dead = true; break; }
        } else if (s.x > pl.x && s.x < pl.x + pl.w && s.y > pl.y && s.y < pl.y + pl.h) {
          dead = true; break;
        }
      }
    }
    if (!dead && !player.dead) {
      // Boss specials use circular hit detection scaled to the projectile radius;
      // regular turret bolts keep the original simple box check.
      const sr = s.r || 3;
      const pCx = player.x + player.w / 2, pCy = player.y + player.h / 2;
      const hit = s.boss
        ? Math.hypot(s.x - pCx, s.y - pCy) < sr + player.w * 0.35
        : s.x > player.x && s.x < player.x + player.w && s.y > player.y && s.y < player.y + player.h;
      if (hit) {
        hurtPlayer(s.dmg, s.x - s.vx * 0.1);
        addHitParticles(s.x, s.y, s.color || '#7fdfff', s.boss ? 8 : 5);
        dead = true;
      }
    }
    if (dead) enemyShots.splice(i, 1);
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
    if (e.x + e.w < camX - 40 || e.x > camX + W + 80) continue;

    const cx = e.x + e.w / 2;
    ctx.save();
    ctx.translate(cx, e.y);

    const sd = SPECIES_DRAW[e.species];
    if (sd) {
      if (e.boss) { // menacing aura — expands and turns orange when enraged
        const raging = !!e._rage;
        const ar = Math.max(e.w, e.h) * (raging ? 0.95 : 0.78);
        const g = ctx.createRadialGradient(0, e.h / 2, ar * 0.3, 0, e.h / 2, ar);
        g.addColorStop(0, raging ? 'rgba(255,90,0,0.22)' : 'rgba(255,40,40,0.16)');
        g.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, e.h / 2, ar, 0, Math.PI * 2); ctx.fill();
        if (raging) { // pulsing ring
          const pls = 0.5 + Math.sin(e.t * 8) * 0.5;
          ctx.strokeStyle = `rgba(255,110,0,${pls * 0.65})`;
          ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.arc(0, e.h / 2, ar * 0.82, 0, Math.PI * 2); ctx.stroke();
          ctx.lineWidth = 1;
        }
      }
      ctx.save();
      if (e.dir < 0) ctx.scale(-1, 1); // species art faces +x; flip to face travel
      if (e.bossScale > 1) {
        // draw the species at its native proportions, scaled up to boss size
        ctx.scale(e.bossScale, e.bossScale);
        sd(ctx, { ...e, w: e.w / e.bossScale, h: e.h / e.bossScale }, t);
      } else {
        sd(ctx, e, t);
      }
      ctx.restore();
    } else if (e.type === 'flyer') drawFlyer(ctx, e);
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
    // special attack charge flash (yellow burst when a boss special fires)
    if (e._atkFlash > 0) {
      ctx.globalAlpha = (e._atkFlash / 0.45) * 0.72;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(-e.w / 2, 0, e.w, e.h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (e.boss) {
      // chunky boss HP bar — turns orange in rage, shows 50% rage threshold marker
      const bw = e.w + 14;
      const bx = e.x + e.w / 2 - bw / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bx - 2, e.y - 20, bw + 4, 12);
      ctx.fillStyle = e._rage ? '#ff6b35' : '#e74c3c';
      ctx.fillRect(bx, e.y - 18, bw * Math.max(0, e.hp / e.maxHp), 8);
      // rage threshold marker at 50%
      ctx.fillStyle = 'rgba(255,220,50,0.85)';
      ctx.fillRect(bx + bw * 0.5 - 1, e.y - 20, 2, 12);
      if (e._rage) {
        ctx.fillStyle = '#ff8c42';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ENRAGED', e.x + e.w / 2, e.y - 24);
        ctx.textAlign = 'left';
      }
    } else if (e.maxHp > 1) {
      // HP pips above tougher enemies
      const pw = e.w / e.maxHp;
      for (let i = 0; i < e.maxHp; i++) {
        ctx.fillStyle = i < e.hp ? '#e74c3c' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(e.x + i * pw + 1, e.y - 9, pw - 2, 4);
      }
    }
  }

  // Enemy shots: boss specials (glowing orbs) and turret bolts
  for (const s of enemyShots) {
    if (s.x < camX - 30 || s.x > camX + W + 30) continue;
    if (s.boss) {
      const r = s.r || 7;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 1.9);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, s.color || '#ff4444');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.32, 0, Math.PI * 2); ctx.fill();
    } else {
      // turret bolt
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 9);
      g.addColorStop(0, '#bff4ff');
      g.addColorStop(0.4, '#46d5ff');
      g.addColorStop(1, 'rgba(70,213,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x - (s.vx > 0 ? 6 : 0), s.y - 1.5, 6, 3);
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

// ─── SPECIES ART ────────────────────────────────────────────────────────────
// Each species has bespoke art. Drawn in a ctx translated to the enemy's
// top-center and pre-flipped so +x is the direction the creature faces.

function drawSlime(ctx, e, t) {
  const w = e.w, h = e.h;
  const air = Math.abs(e.vy || 0) > 30;
  const sx = air ? 0.84 : 1 + Math.sin(t * 5 + e.phase) * 0.06;
  const sy = 2 - sx;
  ctx.fillStyle = '#58b94a';
  ctx.beginPath();
  ctx.ellipse(0, h - h * 0.5 * sy, w * 0.5 * sx, h * 0.5 * sy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.ellipse(-w * 0.15, h * 0.35, w * 0.13, h * 0.1, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#143318';
  ctx.beginPath();
  ctx.arc(w * 0.12, h * 0.5, 2.4, 0, Math.PI * 2);
  ctx.arc(-w * 0.08, h * 0.5, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawBee(ctx, e, t) {
  const w = e.w, h = e.h;
  const flap = Math.sin(e.t * 26) * 0.6;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.save(); ctx.translate(-2, h * 0.25); ctx.rotate(-0.5 - flap);
  ctx.beginPath(); ctx.ellipse(0, -6, 5, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(4, h * 0.25); ctx.rotate(0.2 + flap);
  ctx.beginPath(); ctx.ellipse(0, -6, 5, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#f9ca24';
  ctx.beginPath(); ctx.ellipse(0, h * 0.55, w * 0.42, h * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2d2d2d';
  ctx.fillRect(-w * 0.16, h * 0.28, 4, h * 0.54);
  ctx.fillRect(w * 0.02, h * 0.28, 4, h * 0.54);
  ctx.beginPath(); // stinger at the back
  ctx.moveTo(-w * 0.42, h * 0.55); ctx.lineTo(-w * 0.58, h * 0.55); ctx.lineTo(-w * 0.42, h * 0.45);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(w * 0.3, h * 0.42, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(w * 0.34, h * 0.42, 1.6, 0, Math.PI * 2); ctx.fill();
}

function drawCrawler(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const lx = -w * 0.3 + i * w * 0.2;
    const wig = Math.sin(t * 12 + i) * 2;
    ctx.beginPath(); ctx.moveTo(lx, h - 6); ctx.lineTo(lx + wig, h); ctx.stroke();
  }
  ctx.fillStyle = '#7f8c8d';
  ctx.beginPath(); ctx.ellipse(0, h * 0.55, w * 0.5, h * 0.45, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; // shell segments
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * w * 0.16 - 1.5, h * 0.14, 3, h * 0.4);
  ctx.fillStyle = '#ffeaa7';
  ctx.beginPath(); ctx.arc(w * 0.34, h * 0.5, 2.2, 0, Math.PI * 2); ctx.fill();
}

function drawBat(ctx, e, t) {
  const w = e.w, h = e.h;
  const diving = e._mode === 1;
  const flap = Math.sin(e.t * (diving ? 26 : 12)) * (diving ? 0.9 : 0.55);
  ctx.fillStyle = '#4a3f63';
  for (const s of [-1, 1]) { // membrane wings
    ctx.save(); ctx.translate(s * w * 0.12, h * 0.4); ctx.rotate(s * (0.25 + flap));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(s * w * 0.55, -h * 0.35);
    ctx.lineTo(s * w * 0.62, h * 0.15);
    ctx.lineTo(s * w * 0.3, h * 0.05);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#352c49';
  ctx.beginPath(); ctx.ellipse(0, h * 0.48, w * 0.2, h * 0.34, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); // ears
  ctx.moveTo(-w * 0.12, h * 0.2); ctx.lineTo(-w * 0.05, h * 0.02); ctx.lineTo(0, h * 0.2);
  ctx.moveTo(w * 0.12, h * 0.2); ctx.lineTo(w * 0.05, h * 0.02); ctx.lineTo(0, h * 0.2);
  ctx.fill();
  ctx.fillStyle = '#ff5e57';
  ctx.beginPath();
  ctx.arc(-w * 0.07, h * 0.4, 1.8, 0, Math.PI * 2);
  ctx.arc(w * 0.07, h * 0.4, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawSlider(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.strokeStyle = 'rgba(190,230,255,0.5)'; ctx.lineWidth = 2; // speed lines
  ctx.beginPath();
  ctx.moveTo(-w * 0.7, h * 0.4); ctx.lineTo(-w * 0.45, h * 0.4);
  ctx.moveTo(-w * 0.75, h * 0.7); ctx.lineTo(-w * 0.5, h * 0.7);
  ctx.stroke();
  ctx.fillStyle = 'rgba(150,210,240,0.92)';
  roundRectE(ctx, -w / 2, 2, w, h - 2, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(-w / 2 + 2, 4, w - 4, 4); // frosty top
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-w * 0.2, h * 0.3); ctx.lineTo(w * 0.05, h * 0.62); ctx.stroke();
  ctx.fillStyle = '#1c4966';
  ctx.beginPath();
  ctx.arc(w * 0.18, h * 0.42, 2.4, 0, Math.PI * 2);
  ctx.arc(w * 0.36, h * 0.42, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawIcicle(ctx, e, t) {
  const w = e.w, h = e.h;
  if (e._mode !== 1) { // snowy cap while still anchored
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(0, 1, w * 0.65, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#d8f1ff'); grad.addColorStop(1, '#8fd0f5');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.lineTo(0, h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath(); ctx.moveTo(-w * 0.18, 2); ctx.lineTo(-w * 0.05, 2); ctx.lineTo(-w * 0.1, h * 0.7); ctx.closePath(); ctx.fill();
}

function drawScorpion(ctx, e, t) {
  const w = e.w, h = e.h;
  const winding = e._st === 1, dashing = e._st === 2;
  ctx.strokeStyle = '#8a5a20'; ctx.lineWidth = 2; // legs
  for (let i = 0; i < 3; i++) {
    const lx = -w * 0.25 + i * w * 0.18;
    const wig = Math.sin(t * (dashing ? 26 : 9) + i) * (dashing ? 3 : 2);
    ctx.beginPath(); ctx.moveTo(lx, h - 7); ctx.lineTo(lx - 4 + wig, h); ctx.stroke();
  }
  ctx.fillStyle = winding ? '#e8a13c' : '#cc8e35';
  ctx.beginPath(); ctx.ellipse(0, h * 0.62, w * 0.38, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b87a26'; // claws up front
  ctx.beginPath(); ctx.arc(w * 0.42, h * 0.6, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, 3.4, 0, Math.PI * 2); ctx.fill();
  // tail arched over the back, raised while telegraphing a charge
  const lift = winding ? -4 : 0;
  ctx.strokeStyle = '#b87a26'; ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-w * 0.34, h * 0.55);
  ctx.quadraticCurveTo(-w * 0.62, h * 0.1 + lift, -w * 0.3, lift + 2);
  ctx.stroke();
  ctx.fillStyle = '#7a4a10';
  ctx.beginPath(); ctx.arc(-w * 0.28, lift + 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#311b04';
  ctx.beginPath(); ctx.arc(w * 0.28, h * 0.5, 1.8, 0, Math.PI * 2); ctx.fill();
}

function drawVulture(ctx, e, t) {
  const w = e.w, h = e.h;
  const flap = Math.sin(e.t * 7) * 0.5;
  ctx.fillStyle = '#5d3a17';
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * w * 0.1, h * 0.4); ctx.rotate(s * flap * 0.8);
    ctx.beginPath(); ctx.ellipse(s * w * 0.32, -h * 0.08, w * 0.36, h * 0.16, s * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#6d4423';
  ctx.beginPath(); ctx.ellipse(0, h * 0.5, w * 0.26, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b4a0'; // bald head
  ctx.beginPath(); ctx.arc(w * 0.3, h * 0.3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c040'; // hooked beak
  ctx.beginPath(); ctx.moveTo(w * 0.42, h * 0.28); ctx.lineTo(w * 0.56, h * 0.36); ctx.lineTo(w * 0.4, h * 0.4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(w * 0.32, h * 0.27, 1.5, 0, Math.PI * 2); ctx.fill();
}

function drawLavaBlob(ctx, e, t) {
  const w = e.w, h = e.h;
  const cy = h * 0.55;
  const g = ctx.createRadialGradient(0, cy, 2, 0, cy, w * 0.85);
  g.addColorStop(0, 'rgba(255,170,60,0.55)'); g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w, cy - w, w * 2, w * 2);
  const wob = Math.sin(e.t * 9) * 0.08;
  ctx.fillStyle = '#ff793f';
  ctx.beginPath(); ctx.ellipse(0, cy, w * 0.46 * (1 + wob), h * 0.42 * (1 - wob), 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd32a';
  ctx.beginPath(); ctx.ellipse(0, cy, w * 0.26, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(60,10,0,0.55)'; // crust chips
  ctx.beginPath();
  ctx.arc(-w * 0.22, cy - h * 0.2, 3, 0, Math.PI * 2);
  ctx.arc(w * 0.25, cy + h * 0.12, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawEmber(ctx, e, t) {
  const w = e.w, h = e.h;
  const fl = Math.sin(e.t * 13) * 2;
  ctx.fillStyle = '#ff793f';
  ctx.beginPath();
  ctx.moveTo(0, fl * 0.4);
  ctx.quadraticCurveTo(w * 0.5, h * 0.45, 0, h);
  ctx.quadraticCurveTo(-w * 0.5, h * 0.45, 0, fl * 0.4);
  ctx.fill();
  ctx.fillStyle = '#ffd32a';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.35 + fl * 0.3);
  ctx.quadraticCurveTo(w * 0.22, h * 0.6, 0, h * 0.88);
  ctx.quadraticCurveTo(-w * 0.22, h * 0.6, 0, h * 0.35 + fl * 0.3);
  ctx.fill();
  ctx.fillStyle = '#5a1500';
  ctx.beginPath();
  ctx.arc(-3, h * 0.6, 1.6, 0, Math.PI * 2);
  ctx.arc(3, h * 0.6, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBird(ctx, e, t) {
  const w = e.w, h = e.h;
  const diving = e._mode === 1;
  const flap = Math.sin(e.t * (diving ? 18 : 9)) * 0.6;
  ctx.fillStyle = '#eef2fa';
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * w * 0.08, h * 0.42); ctx.rotate(s * flap);
    ctx.beginPath(); ctx.ellipse(s * w * 0.3, -h * 0.1, w * 0.34, h * 0.14, s * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#f5f6fa';
  ctx.beginPath(); ctx.ellipse(0, h * 0.55, w * 0.3, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(w * 0.26, h * 0.36, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0932b'; // beak
  ctx.beginPath(); ctx.moveTo(w * 0.4, h * 0.33); ctx.lineTo(w * 0.55, h * 0.4); ctx.lineTo(w * 0.38, h * 0.45); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(w * 0.28, h * 0.34, 1.6, 0, Math.PI * 2); ctx.fill();
}

function drawPuff(ctx, e, t) {
  const w = e.w, h = e.h;
  const bob = Math.sin(e.t * 2.4) * 1.5;
  ctx.fillStyle = 'rgba(240,245,255,0.95)';
  ctx.beginPath();
  ctx.arc(-w * 0.22, h * 0.55 + bob, h * 0.3, 0, Math.PI * 2);
  ctx.arc(0, h * 0.4 + bob, h * 0.38, 0, Math.PI * 2);
  ctx.arc(w * 0.24, h * 0.55 + bob, h * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5b7c9d'; ctx.lineWidth = 1.6; // cross brows
  ctx.beginPath();
  ctx.moveTo(-6, h * 0.42 + bob); ctx.lineTo(-2, h * 0.46 + bob);
  ctx.moveTo(6, h * 0.42 + bob); ctx.lineTo(2, h * 0.46 + bob);
  ctx.stroke();
  ctx.fillStyle = '#5b7c9d';
  ctx.beginPath();
  ctx.arc(-3.5, h * 0.52 + bob, 1.5, 0, Math.PI * 2);
  ctx.arc(3.5, h * 0.52 + bob, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpider(ctx, e, t) {
  const w = e.w, h = e.h;
  // silk thread up to the anchor
  ctx.strokeStyle = 'rgba(220,220,230,0.7)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, (e.anchorY || e.y) - e.y); ctx.lineTo(0, h * 0.3); ctx.stroke();
  ctx.strokeStyle = '#4a3520'; ctx.lineWidth = 2; // legs
  for (let i = 0; i < 4; i++) {
    const a = -0.7 + i * 0.45 + Math.sin(t * 8 + i) * 0.08;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(s * Math.cos(a) * w * 0.55, h * 0.5 + Math.sin(a) * h * 0.45);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#6d4c2a';
  ctx.beginPath(); ctx.ellipse(0, h * 0.45, w * 0.26, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8d6e4a';
  ctx.beginPath(); ctx.arc(0, h * 0.72, w * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(-2.5, h * 0.7, 1.3, 0, Math.PI * 2);
  ctx.arc(2.5, h * 0.7, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawShroom(ctx, e, t) {
  const w = e.w, h = e.h;
  const air = Math.abs(e.vy || 0) > 30;
  const sq = air ? 1.12 : 1 + Math.sin(t * 4 + e.phase) * 0.04;
  ctx.fillStyle = '#f5e8d0'; // stem
  ctx.fillRect(-w * 0.18, h * 0.45, w * 0.36, h * 0.55);
  ctx.fillStyle = '#5a4632';
  ctx.beginPath();
  ctx.arc(-3, h * 0.68, 1.7, 0, Math.PI * 2);
  ctx.arc(3, h * 0.68, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e0574a'; // cap
  ctx.beginPath(); ctx.ellipse(0, h * 0.42, w * 0.55, h * 0.36 * sq, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-w * 0.25, h * 0.3, 2.4, 0, Math.PI * 2);
  ctx.arc(w * 0.1, h * 0.2, 2.8, 0, Math.PI * 2);
  ctx.arc(w * 0.32, h * 0.34, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrone(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.fillStyle = 'rgba(150,230,255,0.35)'; // rotor shimmer
  ctx.beginPath(); ctx.ellipse(0, 2, w * 0.5, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a4b66';
  ctx.beginPath(); ctx.ellipse(0, h * 0.55, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#5a7390';
  ctx.beginPath(); ctx.ellipse(0, h * 0.42, w * 0.26, h * 0.2, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = Math.sin(e.t * 6) > 0 ? '#00d2d3' : '#16505a'; // scan light
  ctx.beginPath(); ctx.arc(0, h * 0.55, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f2c3f';
  ctx.fillRect(-w * 0.42, h * 0.52, 5, 3); ctx.fillRect(w * 0.42 - 5, h * 0.52, 5, 3);
}

function drawTurret(ctx, e, t) {
  const w = e.w, h = e.h;
  const charging = e._cd !== undefined && e._cd < 0.4;
  ctx.fillStyle = '#2c3a52'; // base
  ctx.beginPath();
  ctx.moveTo(-w / 2, h); ctx.lineTo(-w * 0.32, h * 0.45); ctx.lineTo(w * 0.32, h * 0.45); ctx.lineTo(w / 2, h);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#46608a'; // dome
  ctx.beginPath(); ctx.ellipse(0, h * 0.45, w * 0.3, h * 0.3, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#1f2c3f'; // barrel tracks the player (faces +x after flip)
  ctx.fillRect(w * 0.2, h * 0.32, w * 0.42, 5);
  ctx.fillStyle = charging ? '#46d5ff' : '#27405c'; // muzzle warms up before a shot
  ctx.beginPath(); ctx.arc(w * 0.64, h * 0.38, charging ? 3.6 : 2.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = Math.sin(e.t * 5) > 0 ? '#46d5ff' : '#1b3048';
  ctx.beginPath(); ctx.arc(0, h * 0.34, 2, 0, Math.PI * 2); ctx.fill();
}

function drawGolem(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.fillStyle = '#1b6f8c';
  ctx.fillRect(-w * 0.34, h - 8, w * 0.26, 8);
  ctx.fillRect(w * 0.08, h - 8, w * 0.26, 8);
  ctx.fillStyle = '#2e9cb8'; // angular crystal torso
  ctx.beginPath();
  ctx.moveTo(-w * 0.46, h * 0.85); ctx.lineTo(-w * 0.38, h * 0.18); ctx.lineTo(0, h * 0.02);
  ctx.lineTo(w * 0.38, h * 0.18); ctx.lineTo(w * 0.46, h * 0.85);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; // facets
  ctx.beginPath();
  ctx.moveTo(-w * 0.2, h * 0.1); ctx.lineTo(-w * 0.1, h * 0.8);
  ctx.moveTo(w * 0.18, h * 0.12); ctx.lineTo(w * 0.26, h * 0.78);
  ctx.stroke();
  const pulse = 0.6 + Math.sin(e.t * 3) * 0.4; // glowing core
  ctx.fillStyle = `rgba(72,219,251,${pulse})`;
  ctx.beginPath(); ctx.arc(0, h * 0.42, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#bff4ff';
  ctx.beginPath();
  ctx.arc(-w * 0.14, h * 0.22, 2.2, 0, Math.PI * 2);
  ctx.arc(w * 0.14, h * 0.22, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawShard(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.save();
  ctx.translate(0, h / 2);
  ctx.rotate(e.t * 3 + (e.phase || 0));
  const grad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, '#bffff5'); grad.addColorStop(1, '#00c8b4');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -h / 2); ctx.lineTo(w * 0.34, 0); ctx.lineTo(0, h / 2); ctx.lineTo(-w * 0.34, 0);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
  ctx.restore();
}

function drawKnight(ctx, e, t) {
  const w = e.w, h = e.h;
  const winding = e._st === 1, dashing = e._st === 2;
  ctx.fillStyle = '#23233c';
  ctx.fillRect(-w * 0.3, h - 7, w * 0.22, 7);
  ctx.fillRect(w * 0.08, h - 7, w * 0.22, 7);
  ctx.fillStyle = winding ? '#6a6a96' : '#4d4d78'; // armored torso
  roundRectE(ctx, -w * 0.36, h * 0.3, w * 0.72, h * 0.62, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(-w * 0.36, h * 0.38, w * 0.72, 4);
  ctx.fillStyle = '#5d5d8c'; // helmet
  ctx.beginPath(); ctx.ellipse(0, h * 0.22, w * 0.24, h * 0.18, 0, Math.PI, 0); ctx.fill();
  ctx.fillRect(-w * 0.24, h * 0.2, w * 0.48, h * 0.1);
  ctx.fillStyle = dashing ? '#ff7675' : '#a55eea'; // visor slit glow
  ctx.fillRect(w * 0.02, h * 0.21, w * 0.18, 3);
  ctx.fillStyle = '#c0392b'; // plume
  ctx.beginPath();
  ctx.moveTo(-w * 0.05, h * 0.05); ctx.quadraticCurveTo(-w * 0.3, -h * 0.06, -w * 0.4, h * 0.12);
  ctx.quadraticCurveTo(-w * 0.2, h * 0.1, -w * 0.05, h * 0.16);
  ctx.fill();
  ctx.fillStyle = '#c8d6e5'; // blade held forward
  ctx.fillRect(w * 0.36, h * 0.45, w * 0.4, 4);
}

function drawWraith(ctx, e, t) {
  const w = e.w, h = e.h;
  ctx.save();
  ctx.globalAlpha = 0.6 + Math.sin(e.t * 2.6) * 0.18;
  ctx.fillStyle = '#b08fd8';
  ctx.beginPath();
  ctx.arc(0, h * 0.32, w * 0.34, Math.PI, 0);
  const hem = h * 0.85;
  ctx.lineTo(w * 0.34, hem);
  for (let i = 2; i >= -2; i--) { // wavy hem
    const hx = (i / 2) * w * 0.34;
    const hy = hem + Math.sin(e.t * 5 + i) * 3 + (i % 2 ? 6 : 0);
    ctx.lineTo(hx, hy);
  }
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2d1b4e';
  ctx.beginPath();
  ctx.ellipse(-w * 0.12, h * 0.3, 2.6, 3.4, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.12, h * 0.3, 2.6, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const SPECIES_DRAW = {
  slime: drawSlime, bee: drawBee, crawler: drawCrawler, bat: drawBat,
  slider: drawSlider, icicle: drawIcicle, scorpion: drawScorpion, vulture: drawVulture,
  lavablob: drawLavaBlob, ember: drawEmber, bird: drawBird, puff: drawPuff,
  spider: drawSpider, shroom: drawShroom, drone: drawDrone, turret: drawTurret,
  golem: drawGolem, shard: drawShard, knight: drawKnight, wraith: drawWraith,
};

function roundRectE(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
