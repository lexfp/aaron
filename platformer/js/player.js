import { isLeft, isRight, isDown, consumeDash } from './input.js';
import { resolveX, resolveY } from './level.js';
import { addDJParticles, addLandParticles, addDashParticles, addSlideParticles } from './entities.js';
import { getJumpMult, getDJMult, getSpeedMult, getEquippedWeapon, getEquippedSkin } from './state.js';

function lerp(a, b, t) { return a + (b - a) * t; }

const BASE_JUMP = 555;
const BASE_DJ = 495;
const BASE_SPEED = 280;
const GRAVITY = 1850;
const TERMINAL_VEL = 950;
const COYOTE_TIME = 0.1;
const PLAYER_H = 42;    // full standing height
const SLIDE_H = 20;     // crouched height during slide
const DASH_SPEED = 620; // px/s during dash burst
const DASH_DUR = 0.18;  // seconds of active dash
const DASH_CD = 1.6;    // seconds before dash is available again
const SLIDE_DUR = 0.45; // seconds the slide lasts
const SLIDE_CD = 0.7;   // cooldown after a slide ends
// Idle horizontal damping is per-stage now (see STAGE_MODIFIERS `.fric`); base is 0.72.

// Per-stage gameplay twist (index 0-9, matches STAGE_THEMES order in renderer.js).
//   gMul  — gravity multiplier
//   jMul  — jump/double-jump force multiplier (scaled WITH gravity on "heavy"
//           stages so required jumps stay reachable — see physics note below)
//   fric  — idle horizontal damping per frame (base 0.72; ↑ = slippery, ↓ = grippy)
//   wind  — sideways gust acceleration amplitude (px/s², 0 = none)
//   dark  — 1 = limited-visibility vignette around the player (rendered in main.js)
// NOTE on reachability: scaling gMul and jMul together leaves horizontal jump
// distance unchanged and only INCREASES vertical reach, and lowering gMul alone
// only increases reach — so every twist keeps all 500 validated levels solvable.
export const STAGE_MODIFIERS = [
  { label: '🌱 Springy Grass', gMul: 1.0,  jMul: 1.12, fric: 0.72, wind: 0,    dark: 0 }, // Meadow
  { label: '🕯️ Pitch Dark',    gMul: 1.0,  jMul: 1.0,  fric: 0.72, wind: 0,    dark: 1 }, // Cave
  { label: '❄️ Slippery Ice',  gMul: 1.0,  jMul: 1.0,  fric: 0.965, wind: 0,   dark: 0 }, // Icy Peaks
  { label: '🌬️ Desert Gusts',  gMul: 1.0,  jMul: 1.0,  fric: 0.72, wind: 1300, dark: 0 }, // Desert
  { label: '🔥 Scorching Heat', gMul: 1.25, jMul: 1.25, fric: 0.72, wind: 0,    dark: 0 }, // Lava
  { label: '☁️ Sky Updrafts',  gMul: 0.6,  jMul: 1.0,  fric: 0.78, wind: 0,    dark: 0 }, // Sky
  { label: '🍄 Mossy Grip',    gMul: 1.0,  jMul: 1.0,  fric: 0.42, wind: 0,    dark: 0 }, // Forest
  { label: '🚀 Zero Gravity',  gMul: 0.32, jMul: 1.0,  fric: 0.86, wind: 0,    dark: 0 }, // Space
  { label: '💎 Bouncy Crystal', gMul: 1.0,  jMul: 1.24, fric: 0.72, wind: 0,    dark: 0 }, // Crystal
  { label: '🏰 Heavy Gravity',  gMul: 1.45, jMul: 1.45, fric: 0.72, wind: 0,    dark: 0 }, // Dark Fortress
];

let _mod = STAGE_MODIFIERS[0];
let _modT = 0; // time accumulator for oscillating effects (wind gusts)

// Select the active stage twist (call before initPlayer on level start/respawn).
export function setStageModifier(stageIdx) {
  _mod = STAGE_MODIFIERS[((stageIdx % 10) + 10) % 10] || STAGE_MODIFIERS[0];
  _modT = 0;
}

export function getStageModifier() { return _mod; }

export const player = {
  x: 80, y: 380,
  w: 28, h: 42,
  vx: 0, vy: 0,
  _prevY: 380,
  onGround: false,
  jumpsLeft: 2,
  coyoteTimer: 0,
  jumpBufferTimer: 0,
  facing: 1,
  distanceTraveled: 0,
  animState: 'idle',
  animTimer: 0,
  landSquash: 0,
  djFlash: 0,
  dead: false,
  // Health
  maxHp: 100,
  hp: 100,
  invuln: 0,          // i-frame timer after taking a hit (no further contact damage)
  hurtFlash: 0,       // red flash timer when damaged
  // Combat
  attackCD: 0,        // seconds until the next attack is allowed
  swingT: 0,          // remaining swing-animation time
  swingDur: 0.16,
  weapon: null,       // equipped weapon def (for drawing)
  // Boss signature effect timers (all decay to 0; reset by initPlayer)
  iceSlipT: 0,        // slider ice trail: overrides idle friction toward slippery
  windPushT: 0,       // bird wind gust: horizontal push for this many seconds
  windPushDir: 0,     // direction of the wind push (+1 or -1)
  dazeT: 0,           // shroom spore: dampens horizontal input
  _charge: 0,         // seconds the attack input has been held (charge tracking)
  _shieldT: 0,        // Shield Surge active timer (visual bubble + invuln)
  // Dash / slide
  dashT: 0,    // remaining active dash time
  dashCD: 0,   // cooldown until next dash
  slideT: 0,   // remaining slide time
  slideCD: 0,  // cooldown until next slide
  // Computed from upgrades each level
  jumpForce: BASE_JUMP,
  djForce: BASE_DJ,
  speed: BASE_SPEED,
};

export function initPlayer(spawnX, spawnY) {
  player.x = spawnX;
  player.y = spawnY;
  player._prevY = spawnY - 1; // slightly above to trigger landing on first frame
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.jumpsLeft = 2;
  player.coyoteTimer = COYOTE_TIME;
  player.jumpBufferTimer = 0;
  player.facing = 1;
  player.distanceTraveled = 0;
  player.animState = 'idle';
  player.animTimer = 0;
  player.landSquash = 0;
  player.djFlash = 0;
  player.dead = false;
  player.maxHp = 100;
  player.hp = 100;
  player.invuln = 0;
  player.hurtFlash = 0;
  player.attackCD = 0;
  player.swingT = 0;
  player._charge = 0;
  player._shieldT = 0;
  player.weapon = getEquippedWeapon();
  player.iceSlipT = 0;
  player.windPushT = 0;
  player.windPushDir = 0;
  player.dazeT = 0;
  player.dashT = 0;
  player.dashCD = 0;
  player.slideT = 0;
  player.slideCD = 0;
  player.h = PLAYER_H;

  player.jumpForce = BASE_JUMP * getJumpMult() * _mod.jMul;
  player.djForce = BASE_DJ * getDJMult() * _mod.jMul;
  player.speed = BASE_SPEED * getSpeedMult();
}

function endSlide() {
  if (player.h === SLIDE_H) {
    player.y -= (PLAYER_H - SLIDE_H); // restore top: move up by height difference
    player.h = PLAYER_H;
  }
  player.slideT = 0;
}

export function updatePlayer(dt, platforms, jumpJustPressed) {
  if (player.dead) return;

  // Ride moving platforms: if grounded on one last frame, inherit its motion
  // this frame so the player stays attached instead of sliding off.
  if (player.onGround && player._groundPlat && player._groundPlat.type === 'move') {
    player.x += player._groundPlat._dx || 0;
    player.y += player._groundPlat._dy || 0;
  }

  // Jump buffer
  if (jumpJustPressed) player.jumpBufferTimer = 0.085;
  else if (player.jumpBufferTimer > 0) player.jumpBufferTimer = Math.max(0, player.jumpBufferTimer - dt);

  // Coyote timer decrement
  if (!player.onGround) {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  // Jump while sliding: end slide first so height is correct
  if (jumpJustPressed && player.slideT > 0) endSlide();

  // Jump logic
  if (player.jumpBufferTimer > 0) {
    if (player.coyoteTimer > 0 && player.jumpsLeft === 2) {
      // Ground / coyote jump
      player.vy = -player.jumpForce;
      player.coyoteTimer = 0;
      player.jumpBufferTimer = 0;
      player.jumpsLeft = 1; // first jump used
      player.animState = 'jump';
    } else if (player.jumpsLeft > 0 && player.coyoteTimer <= 0) {
      // Double jump
      player.vy = -player.djForce;
      player.jumpsLeft = 0;
      player.jumpBufferTimer = 0;
      player.djFlash = 0.28;
      player.animState = 'jump';
      addDJParticles(player.x + player.w / 2, player.y + player.h);
    }
  }

  // ── Dash ──────────────────────────────────────────────────────────────────
  const dashPressed = consumeDash();
  if (dashPressed && player.dashCD <= 0 && player.slideT <= 0) {
    player.dashT = DASH_DUR;
    player.dashCD = DASH_CD;
    player.vy = Math.min(player.vy, 60); // dampen fall for a moment
    player.invuln = Math.max(player.invuln, 0.18);
    addDashParticles(player.x + player.w / 2, player.y + player.h / 2, player.facing);
  }

  // ── Slide ──────────────────────────────────────────────────────────────────
  // Activate by holding Down/S while running on ground with cooldown ready.
  if (player.onGround && player.slideT <= 0 && player.slideCD <= 0
      && player.dashT <= 0 && Math.abs(player.vx) > 60 && isDown()) {
    player.slideT = SLIDE_DUR;
    player.slideCD = SLIDE_CD;
    player.y += PLAYER_H - SLIDE_H; // keep feet planted: shrink from top
    player.h = SLIDE_H;
    player.vx = player.facing * player.speed * 1.55; // forward momentum boost
    addSlideParticles(player.x + player.w / 2, player.y + player.h, player.facing);
  }

  _modT += dt;

  // Horizontal movement (idle damping varies by stage: slippery ice vs. mossy grip)
  if (player.dashT > 0) {
    // Dash overrides normal movement completely
    player.vx = player.facing * DASH_SPEED;
  } else if (player.slideT > 0) {
    // Slide: decelerate naturally from the boost, no steering
    player.vx *= 0.97;
  } else {
    const dazeScale = player.dazeT > 0 ? 0.35 : 1.0; // shroom daze dampens input
    const targetVx = isLeft() ? -player.speed * dazeScale : isRight() ? player.speed * dazeScale : 0;
    if (targetVx !== 0) {
      player.vx = targetVx;
      player.facing = targetVx > 0 ? 1 : -1;
    } else {
      const activeFric = player.iceSlipT > 0 ? Math.max(_mod.fric, 0.965) : _mod.fric;
      player.vx *= activeFric;
      if (Math.abs(player.vx) < 8) player.vx = 0;
    }
  }

  // Desert gusts: oscillating sideways push you must lean against (skip during dash).
  if (_mod.wind && player.dashT <= 0) player.vx += _mod.wind * Math.sin(_modT * 0.6) * dt;

  // Bird wind gust: horizontal push for capped duration
  if (player.windPushT > 0) {
    player.vx += player.windPushDir * 560 * dt; // sustained gust acceleration
    player.vx = Math.max(-BASE_SPEED, Math.min(BASE_SPEED, player.vx));
    player.windPushT = Math.max(0, player.windPushT - dt);
  }

  // Gravity (per-stage multiplier; terminal velocity tracks it so low-g feels floaty)
  const grav = GRAVITY * _mod.gMul;
  const term = TERMINAL_VEL * Math.max(0.45, _mod.gMul);
  player.vy = Math.min(player.vy + grav * dt, term);

  // Store prevY for collision resolution
  player._prevY = player.y;

  // Move X → resolve X (uses current y, before y-move)
  player.x += player.vx * dt;
  player.x = Math.max(0, player.x); // left wall clamp
  resolveX(player, platforms);

  // Move Y → resolve Y (uses _prevY to determine landing direction)
  player._prevY = player.y;
  player.y += player.vy * dt;

  const wasOnGround = player.onGround;
  player.onGround = resolveY(player, platforms);

  if (player.onGround) {
    player.jumpsLeft = 2;
    player.coyoteTimer = COYOTE_TIME;
    if (!wasOnGround) {
      // Just landed
      player.landSquash = 0.18;
      addLandParticles(player.x + player.w / 2, player.y + player.h);
    }
  }

  // End slide if the player left the ground or the timer expired
  if (player.slideT > 0 && !player.onGround) endSlide();

  // Update timers
  player.landSquash = Math.max(0, player.landSquash - dt * 5.5);
  player.djFlash = Math.max(0, player.djFlash - dt);
  player.attackCD = Math.max(0, player.attackCD - dt);
  player.swingT = Math.max(0, player.swingT - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);
  player.iceSlipT = Math.max(0, player.iceSlipT - dt);
  player.windPushT = Math.max(0, player.windPushT - dt);
  player.dazeT = Math.max(0, player.dazeT - dt);
  player._shieldT = Math.max(0, player._shieldT - dt);
  player.dashT = Math.max(0, player.dashT - dt);
  player.dashCD = Math.max(0, player.dashCD - dt);
  if (player.slideT > 0) {
    player.slideT = Math.max(0, player.slideT - dt);
    if (player.slideT <= 0) endSlide();
  }
  player.slideCD = Math.max(0, player.slideCD - dt);

  // Walk distance for leg swing animation
  if (player.onGround && Math.abs(player.vx) > 15) {
    player.distanceTraveled += Math.abs(player.vx) * dt;
  }

  // Animation state
  if (player.slideT > 0) {
    player.animState = 'slide';
  } else if (player.dashT > 0) {
    player.animState = 'dash';
  } else if (!player.onGround) {
    player.animState = player.vy > 80 ? 'fall' : 'jump';
  } else if (Math.abs(player.vx) > 15) {
    player.animState = 'walk';
  } else {
    player.animState = 'idle';
  }

  player.animTimer += dt;
}

export function drawPlayer(ctx, t) {
  const palette = getEquippedSkin().palette;
  const { x, facing, animState, animTimer, landSquash, djFlash, distanceTraveled } = player;
  // Always draw at full height so the art isn't squashed when sliding.
  const w = player.w;
  const h = PLAYER_H;
  const y = player.h === SLIDE_H ? player.y - (PLAYER_H - SLIDE_H) : player.y;

  const centerX = x + w / 2;
  const centerY = y + h / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  if (facing < 0) ctx.scale(-1, 1);

  // Ghost skin is translucent; invuln blink multiplies on top of the base alpha.
  const baseAlpha = palette.alpha ?? 1;
  if (player.invuln > 0) ctx.globalAlpha = baseAlpha * (0.4 + 0.6 * Math.abs(Math.sin(player.invuln * 30)));
  else if (baseAlpha < 1) ctx.globalAlpha = baseAlpha;

  // Dash afterimage: fading horizontal streaks trailing behind the player.
  if (player.dashT > 0) {
    const dProg = player.dashT / DASH_DUR;
    for (let i = 1; i <= 3; i++) {
      const trailA = dProg * (0.3 - i * 0.08);
      if (trailA <= 0) continue;
      ctx.save();
      ctx.globalAlpha = (baseAlpha < 1 ? baseAlpha : 1) * trailA;
      ctx.translate(-facing * i * 18, 0);
      ctx.fillStyle = '#ffe066';
      const hw2 = w / 2, hh2 = h / 2;
      ctx.fillRect(-hw2 * 0.72, -hh2 * 0.22, w * 0.72, h * 0.52);
      ctx.beginPath(); ctx.arc(0, -hh2 * 0.42, hw2 * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (baseAlpha < 1) ctx.globalAlpha = baseAlpha; // re-apply ghost alpha
  }

  // Squash/stretch transform
  let sx = 1, sy = 1, extraRot = 0;
  if (animState === 'slide') {
    sx = 1.22; sy = 0.62; extraRot = -0.30; // flatten + lean forward
  } else if (animState === 'dash') {
    sx = 1.18; sy = 0.88; // slightly wide
  } else if (landSquash > 0) {
    const n = landSquash / 0.18;
    sx = 1 + 0.42 * n;
    sy = 1 - 0.38 * n;
  } else if (animState === 'jump') {
    sx = 0.82; sy = 1.22;
  } else if (animState === 'fall') {
    sx = 1.12; sy = 0.83;
  } else if (animState === 'idle') {
    sy = 1 + Math.sin(animTimer * 3.2) * 0.028;
  }
  if (extraRot) ctx.rotate(extraRot);
  ctx.scale(sx, sy);

  const hw = w / 2;
  const hh = h / 2;

  // --- Legs ---
  const legSwing = animState === 'walk' ? Math.sin(distanceTraveled * 0.048) * 0.55 : 0;
  let leg1A = legSwing, leg2A = -legSwing;
  if (animState === 'slide') {
    // Smooth entry: ramps from neutral to full pose over the first ~0.075s
    const sf = Math.min(1, Math.max(0, 1 - player.slideT / SLIDE_DUR) * 6);
    const wb = Math.sin(animTimer * 22) * 0.06; // subtle alive wobble during slide
    leg1A = lerp(0, -1.05, sf) + wb; // left leg trails back
    leg2A = lerp(0,  1.15, sf) + wb; // right leg kicks forward
  }
  drawLimb(ctx, -hw * 0.38, hh * 0.25, leg1A, palette.leg, 6, hh * 0.48);
  drawLimb(ctx, hw * 0.38, hh * 0.25, leg2A, palette.leg, 6, hh * 0.48);

  // --- Body (shirt) ---
  ctx.fillStyle = palette.body;
  roundRect(ctx, -hw * 0.72, -hh * 0.22, w * 0.72, h * 0.52, 5);
  ctx.fill();
  // Shirt detail (stripe)
  ctx.fillStyle = palette.bodyStripe;
  ctx.fillRect(-hw * 0.72, hh * 0.06, w * 0.72, 4);

  // --- Arms ---
  const armSwing = animState === 'walk' ? -legSwing * 0.85 : 0;
  const armFall = animState === 'fall' ? 0.75 : 0;
  let arm1A = armFall + armSwing, arm2A = armFall - armSwing;
  if (animState === 'slide') {
    const sf = Math.min(1, Math.max(0, 1 - player.slideT / SLIDE_DUR) * 6);
    arm1A = lerp(0,  1.2, sf); // right/front arm sweeps back-down
    arm2A = lerp(0, -0.8, sf); // left/back arm reaches forward-up
  }
  drawLimb(ctx, hw * 0.72, -hh * 0.1, arm1A, palette.limb, 5, hh * 0.38, true);
  drawLimb(ctx, -hw * 0.72, -hh * 0.1, arm2A, palette.limb, 5, hh * 0.38, true);

  // --- Head ---
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(0, -hh * 0.42, hw * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // Ear
  ctx.fillStyle = palette.skin;
  ctx.beginPath();
  ctx.arc(hw * 0.78, -hh * 0.38, 4, 0, Math.PI * 2);
  ctx.fill();

  // Hair
  ctx.fillStyle = palette.hair;
  ctx.beginPath();
  ctx.arc(-hw * 0.08, -hh * 0.78, 7.5, 0, Math.PI * 2);
  ctx.arc(hw * 0.18, -hh * 0.82, 6.5, 0, Math.PI * 2);
  ctx.arc(hw * 0.5, -hh * 0.75, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Hair band
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -hh * 0.42, hw * 0.8, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();

  // Accessory (visor, cap, or crown from active palette)
  if (palette.accessory_type === 'visor') {
    ctx.fillStyle = palette.accessory_color;
    ctx.fillRect(-hw * 0.5, -hh * 0.52, hw * 0.9, hh * 0.14);
  } else if (palette.accessory_type === 'cap') {
    ctx.fillStyle = palette.accessory_color;
    ctx.beginPath();
    ctx.ellipse(hw * 0.08, -hh * 0.82, hw * 0.75, hh * 0.22, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-hw * 0.7, -hh * 0.82, hw * 1.4, hh * 0.06);
  } else if (palette.accessory_type === 'crown') {
    const crownBase = -hh * 1.15; // just above hair
    ctx.fillStyle = palette.accessory_color;
    // Base band
    ctx.fillRect(-hw * 0.7, crownBase, hw * 1.4, 5);
    // Three spikes
    const spikeXs = [-hw * 0.45, 0, hw * 0.45];
    const spikeHs = [9, 13, 9];
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(spikeXs[k] - 4, crownBase);
      ctx.lineTo(spikeXs[k], crownBase - spikeHs[k]);
      ctx.lineTo(spikeXs[k] + 4, crownBase);
      ctx.closePath();
      ctx.fill();
    }
    // Red jewel on center spike
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(0, crownBase - spikeHs[1] + 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes (right eye is front when facing right)
  const eyeY = -hh * 0.42;
  // Whites
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(hw * 0.28, eyeY, 5, 5.5, 0, 0, Math.PI * 2);
  ctx.ellipse(-hw * 0.12, eyeY, 4, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pupils
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(hw * 0.34, eyeY, 2.5, 0, Math.PI * 2);
  ctx.arc(-hw * 0.08, eyeY, 2, 0, Math.PI * 2);
  ctx.fill();
  // Eye shine
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(hw * 0.38, eyeY - 1.5, 1, 0, Math.PI * 2);
  ctx.arc(-hw * 0.05, eyeY - 1.5, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = '#c0624a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hw * 0.1, eyeY + 9, 5, 0.1, Math.PI - 0.1);
  ctx.stroke();

  // Weapon swing / attack
  if (player.swingT > 0 && player.weapon) {
    drawWeaponSwing(ctx, hw, hh, player.weapon, 1 - player.swingT / player.swingDur, palette.limb);
  }

  // Hurt flash — red tint over the body when damaged
  if (player.hurtFlash > 0) {
    ctx.globalAlpha = (player.hurtFlash / 0.3) * 0.6;
    ctx.fillStyle = '#ff2b2b';
    roundRect(ctx, -hw, -hh, w, h, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Shroom spore daze overlay
  if (player.dazeT > 0) {
    const dAlpha = Math.min(0.55, player.dazeT / 1.5) * (0.6 + Math.sin(t * 9) * 0.3);
    ctx.globalAlpha = dAlpha;
    ctx.fillStyle = '#e17055';
    ctx.beginPath(); ctx.arc(0, -hh * 0.1, hw * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Bird wind push overlay
  if (player.windPushT > 0) {
    const wAlpha = Math.min(0.5, player.windPushT / 1.1) * (0.5 + Math.sin(t * 14) * 0.3);
    ctx.globalAlpha = wAlpha;
    ctx.strokeStyle = '#c0d8ff'; ctx.lineWidth = 2;
    for (let wi = 0; wi < 3; wi++) {
      ctx.beginPath();
      ctx.moveTo(player.windPushDir * (hw * 0.4 + wi * 5), -hh * 0.4 + wi * hh * 0.3);
      ctx.lineTo(player.windPushDir * (hw * 1.1 + wi * 5), -hh * 0.4 + wi * hh * 0.3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Double-jump flash outline
  if (djFlash > 0) {
    const flashAlpha = djFlash / 0.28;
    ctx.strokeStyle = `rgba(0,255,229,${flashAlpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -hh * 0.1, hw * 1.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Shield Surge bubble — slowly rotating cyan ring while active
  if (player._shieldT > 0) {
    const sa = Math.min(1, player._shieldT / 3.5);
    ctx.save();
    ctx.rotate(t * 1.4);
    ctx.strokeStyle = `rgba(80,210,255,${sa * 0.9})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -hh * 0.1, hw * 2.1, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `rgba(200,240,255,${sa * 0.45})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -hh * 0.1, hw * 1.85, 0, Math.PI * 2); ctx.stroke();
    // Sparkle dots around the ring
    for (let si = 0; si < 5; si++) {
      const sa2 = (si / 5) * Math.PI * 2;
      ctx.fillStyle = `rgba(200,240,255,${sa * 0.95})`;
      ctx.beginPath();
      ctx.arc(Math.cos(sa2) * hw * 2.0, -hh * 0.1 + Math.sin(sa2) * hw * 2.0, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}

// Draws the equipped weapon mid-swing in front of the player. Called inside the
// player's translated+facing-flipped context, so +x is always "forward".
function drawWeaponSwing(ctx, hw, hh, weapon, prog, limbColor) {
  ctx.save();
  ctx.translate(hw * 0.55, -hh * 0.05);
  const key = weapon.key;
  const reach = weapon.reach || 26;
  const arm = limbColor || '#f0a070';

  // Upgrade levels make the weapon visibly bigger and give it a colored glow —
  // a single uniform scale + shadow keeps every weapon's art in sync with its level.
  const level = weapon.level || 0;
  if (level > 0) {
    ctx.scale(1 + level * 0.15, 1 + level * 0.15);
    ctx.shadowColor = weapon.color;
    ctx.shadowBlur = 3 + level * 4;
  }

  if (weapon.type === 'ranged') {
    switch (key) {
      case 'blaster': {
        // Squat energy pistol + expanding cyan blast ring
        ctx.fillStyle = '#1c1c2e'; ctx.fillRect(0, -4, 20, 8);
        ctx.fillStyle = weapon.color; ctx.fillRect(16, -3, 8, 6);
        if (prog < 0.45) {
          const a = 1 - prog / 0.45;
          ctx.globalAlpha = a * 0.9;
          ctx.strokeStyle = weapon.color; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(27, 0, 4 + prog * 18, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'launcher': {
        // Bow limbs + drawstring pull + arrow
        ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(0, 0, 15, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
        const pull = prog < 0.35 ? lerp(0, -7, prog / 0.35) : lerp(-7, 0, (prog - 0.35) / 0.65);
        ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(1, -13); ctx.lineTo(pull, 0); ctx.lineTo(1, 13); ctx.stroke();
        ctx.fillStyle = weapon.color;
        ctx.fillRect(pull, -2, 20, 4);
        ctx.beginPath(); ctx.moveTo(21, 0); ctx.lineTo(16, -5); ctx.lineTo(16, 5); ctx.closePath(); ctx.fill();
        break;
      }
      case 'knives': {
        // Two spinning knives flying forward
        const spin = prog * Math.PI * 6;
        for (let i = 0; i < 2; i++) {
          ctx.save();
          ctx.translate(8 + i * 14, i * 3 - 1);
          ctx.rotate(spin + i * Math.PI * 0.7);
          ctx.fillStyle = weapon.color; ctx.fillRect(-7, -1.5, 14, 3);
          ctx.fillStyle = '#778'; ctx.fillRect(-7, -1.5, 4, 3);
          ctx.restore();
        }
        break;
      }
      case 'icewand': {
        // Blue staff + diamond crystal tip + expanding frost ring
        ctx.fillStyle = '#2a4a6a'; ctx.fillRect(0, -3, 22, 6);
        ctx.fillStyle = weapon.color;
        ctx.beginPath();
        ctx.moveTo(22, 0); ctx.lineTo(29, -6); ctx.lineTo(34, 0);
        ctx.lineTo(29, 6); ctx.closePath(); ctx.fill();
        if (prog < 0.5) {
          ctx.globalAlpha = (1 - prog * 2) * 0.7;
          ctx.strokeStyle = '#aaeeff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(28, 0, 10 + prog * 22, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'flamestaff': {
        // Dark staff + layered flame blobs
        ctx.fillStyle = '#3a1808'; ctx.fillRect(0, -3, 20, 6);
        ctx.fillStyle = '#8a3010'; ctx.fillRect(17, -4, 7, 8);
        const flicker = Math.sin(prog * 18) * 2.5;
        const colors = ['#ffdd00', '#ff7020', '#ff2800'];
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = Math.max(0, (1 - prog * 0.6) * (0.9 - i * 0.22));
          ctx.fillStyle = colors[i];
          ctx.beginPath();
          ctx.arc(24 + i * 4, flicker * (i === 0 ? 0 : i === 1 ? -0.6 : 0.5), 6 - i * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'stormrod': {
        // Purple rod + forking lightning bolt
        ctx.fillStyle = '#2a1850'; ctx.fillRect(0, -3, 20, 6);
        ctx.fillStyle = weapon.color; ctx.fillRect(16, -4, 8, 8);
        if (prog < 0.6) {
          ctx.globalAlpha = (1 - prog / 0.6) * 0.95;
          ctx.strokeStyle = weapon.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(24, 0); ctx.lineTo(29, -4); ctx.lineTo(33, 2);
          ctx.lineTo(37, -5); ctx.lineTo(40, 0);
          ctx.stroke();
          ctx.lineWidth = 1; ctx.globalAlpha *= 0.5;
          ctx.beginPath(); ctx.moveTo(33, 2); ctx.lineTo(36, 6); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        break;
      }
      default: {
        ctx.fillStyle = '#2a2a33'; ctx.fillRect(0, -3.5, 18, 7);
        ctx.fillStyle = weapon.color; ctx.fillRect(15, -2.5, 7, 5);
        if (prog < 0.55) {
          ctx.globalAlpha = 1 - prog / 0.55;
          ctx.fillStyle = weapon.color;
          ctx.beginPath(); ctx.arc(26, 0, 7, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
    return;
  }

  // ── Melee: each weapon has its own arc range and shape ──
  let angFrom, angTo, trailColor, trailW;
  switch (key) {
    case 'fists':     angFrom = -0.15; angTo =  0.55; trailColor = 'rgba(240,160,112,0.4)'; trailW = 2; break;
    case 'hammer':    angFrom = -1.45; angTo =  0.7;  trailColor = 'rgba(192,138,74,0.45)'; trailW = 5; break;
    case 'spear':     angFrom = -0.12; angTo =  0.18; trailColor = 'rgba(160,184,200,0.4)'; trailW = 2; break;
    case 'excalibur': angFrom = -1.3;  angTo =  1.4;  trailColor = 'rgba(255,215,0,0.55)';  trailW = 3; break;
    default:          angFrom = -1.0;  angTo =  0.9;  trailColor = 'rgba(255,255,255,0.35)'; trailW = 2.5;
  }
  const ang = lerp(angFrom, angTo, prog);
  ctx.rotate(ang);

  ctx.strokeStyle = trailColor; ctx.lineWidth = trailW;
  ctx.beginPath(); ctx.arc(0, 0, reach * 0.85, -0.6, 0.6); ctx.stroke();

  ctx.strokeStyle = arm; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(reach * 0.45, 0); ctx.stroke();
  ctx.translate(reach * 0.45, 0);

  switch (key) {
    case 'fists': {
      // Solid fist with knuckle lines
      ctx.fillStyle = weapon.color;
      ctx.beginPath(); ctx.arc(5, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(1, i * 3); ctx.lineTo(9, i * 3); ctx.stroke();
      }
      break;
    }
    case 'hammer': {
      // Long handle + massive rectangular head
      ctx.fillStyle = '#5a4632'; ctx.fillRect(0, -2.5, reach * 0.42, 5);
      ctx.fillStyle = weapon.color; ctx.fillRect(reach * 0.38, -12, 16, 24);
      ctx.fillStyle = '#7a6040';
      ctx.beginPath(); ctx.arc(reach * 0.38 + 4, -7, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(reach * 0.38 + 4,  7, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'spear': {
      // Long shaft + triangular tip, thrust effect on early prog
      const thrust = prog < 0.4 ? prog / 0.4 : 1 - (prog - 0.4) / 0.6;
      ctx.save(); ctx.translate(thrust * 8, 0);
      ctx.fillStyle = '#7a6a48'; ctx.fillRect(0, -2, reach * 0.7, 4);
      ctx.fillStyle = weapon.color;
      ctx.beginPath();
      ctx.moveTo(reach * 0.7, 0);
      ctx.lineTo(reach * 0.7 + 16, -3.5);
      ctx.lineTo(reach * 0.7 + 16,  3.5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'excalibur': {
      // Wide golden blade with glow on early swing
      if (prog < 0.5) {
        ctx.globalAlpha = (1 - prog * 2) * 0.45;
        ctx.fillStyle = '#ffd700'; ctx.fillRect(-5, -12, reach * 0.9 + 10, 24);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#6a6a80'; ctx.fillRect(-4, -7, 6, 14);
      ctx.fillStyle = weapon.color; ctx.fillRect(2, -3, reach * 0.88, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(3, -1.5, reach * 0.72, 3);
      break;
    }
    default: {
      // Sword / generic blade with crossguard + fuller
      ctx.fillStyle = '#8a8a96'; ctx.fillRect(-3, -5, 5, 10);
      ctx.fillStyle = weapon.color; ctx.fillRect(2, -2.5, reach * 0.75, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(3, -1, reach * 0.62, 2);
    }
  }
  ctx.restore();
}

function drawLimb(ctx, x, y, angle, color, w, length, isArm = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  if (isArm) {
    ctx.fillRect(0, -w / 2, length, w);
  } else {
    ctx.fillRect(-w / 2, 0, w, length);
    // Shoe
    ctx.fillStyle = '#212121';
    ctx.fillRect(-w / 2 - 1, length - 5, w + 4, 7);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
