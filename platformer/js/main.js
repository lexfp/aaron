import { loadPlayerData, playerData, markLevelComplete, getMagnetRadius, getStartLives, isStageComplete, getEquippedWeapon, grantCompletionSkin, SPECIAL_DEFS, ownsSpecial } from './state.js';
import { initInput, consumeJump, consumeEsc, isAttack, clearAll, consumeSpecial } from './input.js';
import { player, initPlayer, updatePlayer, drawPlayer, setStageModifier, getStageModifier } from './player.js';
import {
  generateLevel, drawPlatforms, drawHazards, getPlayerSpawn,
  resetDynamics, updateDynamics, hazardHit, GW, GH,
} from './level.js';
import {
  initEntities, updateEntities, drawEntities, exitDoor,
  updateEnemies, updateProjectiles, drawEnemies, drawProjectiles,
  playerMeleeAttack, spawnProjectile, isBossAlive,
  useHeal, useBomb, useNova, useShield, useChainLightning, useTimeStop, useQuake,
  updatePlayerBombs, drawPlayerBombs,
} from './entities.js';
import { drawBackground, getTheme } from './renderer.js';
import {
  initUI, showScreen, updateHUD, showLevelComplete,
  showStageComplete, buildMainMenu, buildStageSelect, buildLevelSelect, showPauseMenu,
  updateSpecialsHUD,
} from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Seconds of continuous attack-input hold required to trigger a charged (heavy) attack.
const CHARGE_TIME = 0.6;

let currentStage = 1;
let currentLevel = 1;
let levelData = null;
let camX = 0;
let camY = 0;
let lives = 2;
let coinsThisLevel = 0;
let gameTime = 0;
let gameActive = false;
let paused = false;
let prevTimestamp = null;
let deathTimer = 0;
let _lastDt = 0;
let _lastHp = 100;

// UI callbacks object
const callbacks = {
  onPlay() {
    const btn = document.getElementById('btn-play');
    const s = parseInt(btn.dataset.stage) || 1;
    const l = parseInt(btn.dataset.level) || 1;
    startLevel(s, l);
  },
  onStartLevel(s, l) { startLevel(s, l); },
  onResume() {
    paused = false;
    prevTimestamp = null;
    gameActive = true;
  },
  onQuitToMenu() {
    gameActive = false;
    paused = false;
    buildMainMenu(callbacks);
  },
};

function startLevel(stage, level) {
  currentStage = stage;
  currentLevel = level;
  levelData = generateLevel(stage - 1, level - 1);

  setStageModifier(stage - 1);
  const spawn = getPlayerSpawn(levelData);
  initPlayer(spawn.x, spawn.y);
  initEntities(levelData);
  resetDynamics(levelData);

  camX = 0;
  camY = 0;
  coinsThisLevel = 0;
  lives = getStartLives();
  gameTime = 0;
  paused = false;
  deathTimer = 0;
  gameActive = true;
  prevTimestamp = null;

  // Initialize special cooldowns (reset to 0 at level start)
  if (!player.specialCDs) player.specialCDs = {};
  for (const def of SPECIAL_DEFS) {
    player.specialCDs[def.key] = 0;
  }

  callbacks._lastCoins = 0;
  _lastHp = player.hp;

  updateHUD(stage, level, 0, playerData.coins, lives, player.hp, player.maxHp);
  updateSpecialsHUD(player.specialCDs);
  showScreen('game-wrap');
}

function respawnPlayer() {
  setStageModifier(currentStage - 1);
  const spawn = getPlayerSpawn(levelData);
  initPlayer(spawn.x, spawn.y);
  initEntities(levelData); // reset coins for this attempt
  resetDynamics(levelData); // reset moving/crumbling platforms
  camX = 0;
  camY = 0;
  coinsThisLevel = 0;
}

function onPlayerDeath() {
  lives--;
  if (lives <= 0) {
    // Game over — restart from level start
    lives = getStartLives();
    respawnPlayer();
  } else {
    respawnPlayer();
  }
  _lastHp = player.hp;
  updateHUD(currentStage, currentLevel, coinsThisLevel, playerData.coins, lives, player.hp, player.maxHp);
}

function onLevelComplete() {
  gameActive = false;
  markLevelComplete(currentStage, currentLevel);
  grantCompletionSkin();

  callbacks._lastCoins = coinsThisLevel;

  const stageJustDone = isStageComplete(currentStage);
  if (stageJustDone && currentLevel === 50) {
    showStageComplete(currentStage, callbacks);
  } else {
    showLevelComplete(currentStage, currentLevel, coinsThisLevel, playerData.coins, callbacks);
  }
}

// How far below the screen top the player is allowed to rise before the camera
// starts scrolling up to keep them in view.
const TOP_DEADZONE = 150;

function updateCamera(dt) {
  const targetX = player.x + player.w / 2 - GW / 2;
  const maxCam = Math.max(0, levelData.width - GW);
  const clampedTarget = Math.max(0, Math.min(targetX, maxCam));
  camX += (clampedTarget - camX) * Math.min(dt * 9, 1);

  // Vertical follow: camY stays at 0 (floor anchored to the bottom) during normal
  // play, and only goes negative — scrolling up to reveal sky — when the player
  // rises above the top dead-zone (e.g. low-gravity Space, springy jumps).
  const targetY = Math.min(0, player.y - TOP_DEADZONE);
  camY += (targetY - camY) * Math.min(dt * 12, 1);
  // Hard guarantee the player can never cross the top edge, even on a fast rise.
  camY = Math.min(camY, player.y - 8);
}

function checkExit() {
  if (!exitDoor) return false;
  const { x, y, w, h } = exitDoor;
  return (
    player.x < x + w && player.x + player.w > x &&
    player.y < y + h && player.y + player.h > y
  );
}

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  if (!prevTimestamp) { prevTimestamp = timestamp; return; }
  const dt = Math.min((timestamp - prevTimestamp) / 1000, 0.033);
  prevTimestamp = timestamp;
  _lastDt = dt;

  // ESC to pause/unpause
  if (consumeEsc()) {
    if (gameActive && !paused) {
      paused = true;
      gameActive = false;
      showPauseMenu();
      return;
    }
  }

  if (!gameActive || paused) return;

  gameTime += dt;

  // Handle death timer
  if (deathTimer > 0) {
    deathTimer -= dt;
    if (deathTimer <= 0) onPlayerDeath();
    renderFrame();
    return;
  }

  // Update game logic
  updateDynamics(dt, levelData);
  const jumpPressed = consumeJump();
  updatePlayer(dt, levelData.platforms, jumpPressed);
  updateCamera(dt);

  // Combat: attack first so a kill removes the enemy before contact is checked.
  // Track charge: accumulate time the attack key is held while CD is ready.
  if (isAttack() && !player.dead) {
    if (player.attackCD <= 0) {
      player._charge += dt;
    }
  } else {
    player._charge = 0; // reset when attack input released or not pressed
  }

  if (isAttack() && player.attackCD <= 0 && !player.dead) {
    const weapon = getEquippedWeapon();
    player.weapon = weapon;
    const charged = player._charge >= CHARGE_TIME;
    if (weapon.type === 'ranged') spawnProjectile(player, weapon, charged);
    else playerMeleeAttack(player, weapon, charged);
    player.attackCD = weapon.cooldown;
    const SWING_DURS = { fists: 0.11, hammer: 0.32, spear: 0.13, excalibur: 0.22 };
    player.swingT = SWING_DURS[weapon.key] || (weapon.type === 'ranged' ? 0.20 : 0.16);
    player._charge = 0; // reset after attack fires
  }
  updateProjectiles(dt, levelData.platforms);

  // Special attacks: tick cooldowns, then fire on Q/E/R press
  let specialHUDDirty = false;
  for (let i = 0; i < SPECIAL_DEFS.length; i++) {
    const def = SPECIAL_DEFS[i];
    if (player.specialCDs[def.key] > 0) {
      player.specialCDs[def.key] = Math.max(0, player.specialCDs[def.key] - dt);
      specialHUDDirty = true;
    }
    if (consumeSpecial(i) && ownsSpecial(def.key) && player.specialCDs[def.key] <= 0 && !player.dead) {
      if (def.key === 'heal') useHeal(player);
      else if (def.key === 'bomb') useBomb(player);
      else if (def.key === 'nova') useNova(player);
      else if (def.key === 'shield') useShield(player);
      else if (def.key === 'lightning') useChainLightning(player);
      else if (def.key === 'timestop') useTimeStop(player);
      else if (def.key === 'quake') useQuake(player);
      player.specialCDs[def.key] = def.cooldown;
      specialHUDDirty = true;
    }
  }
  if (specialHUDDirty) updateSpecialsHUD(player.specialCDs);
  updatePlayerBombs(dt, levelData.platforms);

  const enemyRes = updateEnemies(dt, levelData.platforms, player);

  const collected = updateEntities(dt, player, getMagnetRadius());
  if (collected > 0) {
    coinsThisLevel += collected;
    playerData.coins += collected;
    callbacks._lastCoins = coinsThisLevel;
    updateHUD(currentStage, currentLevel, coinsThisLevel, playerData.coins, lives, player.hp, player.maxHp);
  }

  // Refresh the HP bar whenever it changes (e.g. took an enemy hit).
  if (player.hp !== _lastHp) {
    _lastHp = player.hp;
    updateHUD(currentStage, currentLevel, coinsThisLevel, playerData.coins, lives, player.hp, player.maxHp);
  }

  // Check death (fell off bottom, touched a hazard, or hit by an enemy)
  if (player.y > GH + 100 || hazardHit(player, levelData.hazards) || enemyRes.playerHit) {
    deathTimer = 0.35;
  }

  // Check exit (locked while a stage boss is alive)
  if (checkExit() && !isBossAlive()) {
    onLevelComplete();
    return;
  }

  renderFrame();
}

function renderFrame() {
  ctx.clearRect(0, 0, GW, GH);

  // Background (screen space)
  drawBackground(ctx, GW, GH, camX, currentStage, gameTime);

  // World space
  ctx.save();
  ctx.translate(-Math.round(camX), -Math.round(camY));

  drawPlatforms(ctx, levelData.platforms, currentStage, gameTime);
  drawHazards(ctx, levelData.hazards, currentStage);
  drawEntities(ctx, camX, currentStage, gameTime);
  drawEnemies(ctx, camX, GW, gameTime, player, _lastDt);
  drawPlayer(ctx, gameTime);
  drawProjectiles(ctx, camX, GW);
  drawPlayerBombs(ctx, camX, GW);

  ctx.restore();

  // Cave twist: limited visibility — darken everything except a glow around the player.
  if (getStageModifier().dark) {
    const sx = player.x - camX + player.w / 2;
    const sy = player.y - camY + player.h / 2;
    const vg = ctx.createRadialGradient(sx, sy, 45, sx, sy, 240);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.7, 'rgba(0,0,0,0.55)');
    vg.addColorStop(1, 'rgba(0,0,0,0.93)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, GW, GH);
  }

  // Death flash overlay
  if (deathTimer > 0) {
    ctx.fillStyle = `rgba(255,50,50,${deathTimer / 0.35 * 0.45})`;
    ctx.fillRect(0, 0, GW, GH);
  }
}

// Bootstrap
loadPlayerData();
initInput();

initUI(callbacks);

buildMainMenu(callbacks);
showScreen('main-menu');

requestAnimationFrame(gameLoop);
