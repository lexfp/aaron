const SAVE_KEY = 'platformer_save';

const DEFAULT = {
  coins: 0,
  upgrades: { jump: 0, speed: 0, magnet: 0, djBoost: 0, lives: 0 },
  weapons: { fists: true },     // owned weapons (fists always owned)
  equippedWeapon: 'fists',
  skins: { default: true },
  equippedSkin: 'default',
  stagesUnlocked: 1,
  levelProgress: {},
  weaponLevels: { fists: 0, sword: 0, hammer: 0, blaster: 0, launcher: 0, knives: 0, spear: 0, icewand: 0, flamestaff: 0, stormrod: 0, excalibur: 0 },
};

export let playerData = JSON.parse(JSON.stringify(DEFAULT));

export function loadPlayerData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    playerData = { ...DEFAULT, ...saved };
    playerData.upgrades = { ...DEFAULT.upgrades, ...(saved.upgrades || {}) };
    playerData.weapons = { ...DEFAULT.weapons, ...(saved.weapons || {}) };
    playerData.skins = { ...DEFAULT.skins, ...(saved.skins || {}) };
    playerData.equippedSkin = saved.equippedSkin || 'default';
    playerData.weaponLevels = { ...DEFAULT.weaponLevels, ...(saved.weaponLevels || {}) };
    if (!playerData.equippedWeapon || !playerData.weapons[playerData.equippedWeapon]) {
      playerData.equippedWeapon = 'fists';
    }
    if (!SKIN_MAP[playerData.equippedSkin] || (!playerData.skins[playerData.equippedSkin] && playerData.equippedSkin !== 'default')) {
      playerData.equippedSkin = 'default';
    }
    grantCompletionSkin();
  } catch {}
}

export function savePlayerData() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(playerData)); } catch {}
}

export function resetAllProgress() {
  playerData = JSON.parse(JSON.stringify(DEFAULT));
  savePlayerData();
}

export function isLevelComplete(stage, level) {
  return !!playerData.levelProgress[`${stage}-${level}`];
}

export function isStageComplete(stage) {
  for (let l = 1; l <= 50; l++) {
    if (!playerData.levelProgress[`${stage}-${l}`]) return false;
  }
  return true;
}

export function markLevelComplete(stage, level) {
  playerData.levelProgress[`${stage}-${level}`] = true;
  if (isStageComplete(stage) && stage < 10) {
    playerData.stagesUnlocked = Math.max(playerData.stagesUnlocked, stage + 1);
  }
  savePlayerData();
}

export const UPGRADE_DEFS = [
  {
    key: 'jump', label: 'Jump Boost', max: 5,
    costs: [30, 50, 80, 120, 180],
    desc: '+8% jump height per level', icon: '↑',
  },
  {
    key: 'speed', label: 'Speed Boots', max: 5,
    costs: [25, 40, 65, 100, 150],
    desc: '+10% move speed per level', icon: '⚡',
  },
  {
    key: 'magnet', label: 'Coin Magnet', max: 3,
    costs: [50, 100, 200],
    desc: 'Larger coin attraction radius', icon: '◎',
  },
  {
    key: 'djBoost', label: 'DJ Boost', max: 3,
    costs: [40, 80, 160],
    desc: '+10% double-jump force per level', icon: '✦',
  },
  {
    key: 'lives', label: 'Extra Lives', max: 3,
    costs: [80, 160, 320],
    desc: 'Start each level with more lives', icon: '♥',
  },
];

export function getMagnetRadius() {
  const radii = [20, 45, 70, 100];
  return radii[playerData.upgrades.magnet] || 20;
}

export function getStartLives() {
  return 2 + playerData.upgrades.lives;
}

export function getJumpMult() {
  return 1 + playerData.upgrades.jump * 0.08;
}

export function getDJMult() {
  return 1 + playerData.upgrades.djBoost * 0.10;
}

export function getSpeedMult() {
  return 1 + playerData.upgrades.speed * 0.10;
}

export function getLevelCompletedCount(stage) {
  let count = 0;
  for (let l = 1; l <= 50; l++) {
    if (playerData.levelProgress[`${stage}-${l}`]) count++;
  }
  return count;
}

// ─── WEAPONS ──────────────────────────────────────────────────────────────
// `damage` = HP removed per hit. `reach` = melee hitbox length in front of the
// player (px). Ranged weapons use `speed` (projectile px/s) and ignore reach.
// `cooldown` = seconds between attacks. `splash` = explosion radius (ranged).
// `effect` = on-hit effect: null | 'burn' | 'freeze' | 'chain' | 'lifesteal'.
export const WEAPON_DEFS = [
  {
    key: 'fists', label: 'Fists', cost: 0, type: 'melee', icon: '👊',
    damage: 1, reach: 22, cooldown: 0.30, knockback: 220, color: '#f0a070',
    desc: 'Your bare hands. Free, but short and weak.',
    effect: null,
  },
  {
    key: 'sword', label: 'Sword', cost: 120, type: 'melee', icon: '🗡️',
    damage: 3, reach: 46, cooldown: 0.24, knockback: 320, color: '#dfe7f2',
    desc: 'Long reach, fast swing. A big upgrade over fists.',
    effect: null,
  },
  {
    key: 'hammer', label: 'War Hammer', cost: 320, type: 'melee', icon: '🔨',
    damage: 8, reach: 36, cooldown: 0.55, knockback: 560, color: '#c08a4a',
    desc: 'Slow but devastating — flattens brutes in one blow.',
    effect: null,
  },
  {
    key: 'blaster', label: 'Blaster', cost: 480, type: 'ranged', icon: '🔫',
    damage: 2, cooldown: 0.30, speed: 600, knockback: 260, color: '#00d2ff', splash: 0,
    desc: 'Fires energy bolts — hit enemies across gaps.',
    effect: null,
  },
  {
    key: 'launcher', label: 'Boom Bow', cost: 850, type: 'ranged', icon: '🏹',
    damage: 6, cooldown: 0.70, speed: 480, knockback: 520, color: '#ffd24a', splash: 70,
    desc: 'Explosive arrows with splash damage. The finisher.',
    effect: null,
  },
  {
    key: 'knives', label: 'Throwing Knives', cost: 200, type: 'ranged', icon: '🔪',
    damage: 2, cooldown: 0.20, speed: 680, knockback: 180, splash: 0, color: '#c0c8d8',
    desc: 'Fast ranged daggers — quick volleys at short range.',
    effect: null,
  },
  {
    key: 'spear', label: 'Spear', cost: 560, type: 'melee', icon: '🔱',
    damage: 6, reach: 62, cooldown: 0.40, knockback: 400, color: '#a0b8c8',
    desc: 'Long-reach melee thrust — keep enemies at arm\'s length.',
    effect: null,
  },
  {
    key: 'icewand', label: 'Ice Wand', cost: 620, type: 'ranged', icon: '🌀',
    damage: 3, cooldown: 0.35, speed: 540, knockback: 220, splash: 0, color: '#7ecff4',
    desc: 'Shoots ice bolts that freeze enemies in place.',
    effect: 'freeze',
  },
  {
    key: 'flamestaff', label: 'Flame Staff', cost: 700, type: 'ranged', icon: '🔥',
    damage: 4, cooldown: 0.38, speed: 520, knockback: 240, splash: 0, color: '#ff6030',
    desc: 'Scorching bolts that leave enemies burning over time.',
    effect: 'burn',
  },
  {
    key: 'stormrod', label: 'Storm Rod', cost: 950, type: 'ranged', icon: '⚡',
    damage: 5, cooldown: 0.45, speed: 580, knockback: 300, splash: 0, color: '#c8aaff',
    desc: 'Electric bolts that chain to nearby enemies.',
    effect: 'chain',
  },
  {
    key: 'excalibur', label: 'Excalibur', cost: 1500, type: 'melee', icon: '⚔️',
    damage: 9, reach: 54, cooldown: 0.32, knockback: 480, color: '#ffd700',
    desc: 'Legendary blade. Slays foes and steals their life force.',
    effect: 'lifesteal',
  },
];

export const WEAPON_MAP = Object.fromEntries(WEAPON_DEFS.map(w => [w.key, w]));

export const WEAPON_UPGRADE_MAX = 3;

export function ownsWeapon(key) {
  return key === 'fists' || !!playerData.weapons[key];
}

export function buyWeapon(key) {
  const w = WEAPON_MAP[key];
  if (!w || ownsWeapon(key) || playerData.coins < w.cost) return false;
  playerData.coins -= w.cost;
  playerData.weapons[key] = true;
  savePlayerData();
  return true;
}

export function equipWeapon(key) {
  if (!ownsWeapon(key)) return false;
  playerData.equippedWeapon = key;
  savePlayerData();
  return true;
}

export function getEquippedWeapon() {
  const base = WEAPON_MAP[playerData.equippedWeapon] || WEAPON_MAP.fists;
  const level = (playerData.weaponLevels && playerData.weaponLevels[base.key]) || 0;
  if (level === 0) return base;
  // Build an upgraded copy — do NOT mutate WEAPON_DEFS.
  // Each upgrade level multiplies damage by 1.25 (rounded, min 1 above base).
  let dmg = base.damage;
  for (let i = 0; i < level; i++) dmg *= 1.25;
  const scaledDamage = Math.max(base.damage + 1, Math.round(dmg));
  // Each upgrade level multiplies cooldown by 0.9.
  let cd = base.cooldown;
  for (let i = 0; i < level; i++) cd *= 0.9;
  // Return a new object with upgraded fields — WEAPON_DEFS entries are never touched.
  return { ...base, damage: scaledDamage, cooldown: cd };
}

// Returns the coin cost for the next upgrade level of the given weapon key,
// or null if the weapon is unowned, already at max, or not found.
export function getWeaponUpgradeCost(key) {
  const w = WEAPON_MAP[key];
  if (!w || !ownsWeapon(key)) return null;
  const level = (playerData.weaponLevels && playerData.weaponLevels[key]) || 0;
  if (level >= WEAPON_UPGRADE_MAX) return null;
  // Cost tiers derived from base weapon cost.
  if (level === 0) return Math.floor(w.cost * 0.3) + 50;
  if (level === 1) return Math.floor(w.cost * 0.5) + 100;
  if (level === 2) return Math.floor(w.cost * 0.8) + 200;
  return null;
}

// Deducts coins and increments the weapon's upgrade level.
// Returns true on success, false if unowned / at max / insufficient coins.
export function upgradeWeapon(key) {
  if (!ownsWeapon(key)) return false;
  const cost = getWeaponUpgradeCost(key);
  if (cost === null) return false;
  if (playerData.coins < cost) return false;
  playerData.coins -= cost;
  if (!playerData.weaponLevels) playerData.weaponLevels = {};
  if (!playerData.weaponLevels[key]) playerData.weaponLevels[key] = 0;
  playerData.weaponLevels[key] += 1;
  savePlayerData();
  return true;
}

// ─── SKINS ────────────────────────────────────────────────────────────────
export const SKIN_DEFS = [
  {
    key: 'default', label: 'Classic', icon: '🧑', cost: 0, unlock: null,
    desc: 'The original look.',
    palette: { body: '#2980b9', bodyStripe: '#1a6fa8', limb: '#f0a070', leg: '#1a252f', skin: '#f5cba7', hair: '#5d4037' },
  },
  {
    key: 'ninja', label: 'Ninja', icon: '🥷', cost: 150, unlock: null,
    desc: 'Dark and stealthy.',
    palette: { body: '#1a1a2e', bodyStripe: '#16213e', limb: '#4a4a6a', leg: '#0f0f1a', skin: '#c49a6c', hair: '#1a1a1a', accessory_type: 'visor', accessory_color: '#e94560' },
  },
  {
    key: 'pirate', label: 'Pirate', icon: '🏴‍☠️', cost: 200, unlock: null,
    desc: 'Sail the high seas.',
    palette: { body: '#8b1a1a', bodyStripe: '#6b1414', limb: '#d4a574', leg: '#2c1810', skin: '#e8c49a', hair: '#2c1810', accessory_type: 'cap', accessory_color: '#1a1a1a' },
  },
  {
    key: 'robot', label: 'Robot', icon: '🤖', cost: 250, unlock: null,
    desc: 'Cold chrome chassis.',
    palette: { body: '#607d8b', bodyStripe: '#455a64', limb: '#78909c', leg: '#37474f', skin: '#b0bec5', hair: '#546e7a' },
  },
  {
    key: 'wizard', label: 'Wizard', icon: '🧙', cost: 300, unlock: null,
    desc: 'Ancient arcane robes.',
    palette: { body: '#4a0e8f', bodyStripe: '#380a6d', limb: '#c39bd3', leg: '#2d0958', skin: '#fad7a0', hair: '#e8d5b7', accessory_type: 'cap', accessory_color: '#4a0e8f' },
  },
  {
    key: 'ghost', label: 'Ghost', icon: '👻', cost: 350, unlock: null,
    desc: 'Hauntingly translucent.',
    palette: { body: '#e8eaf6', bodyStripe: '#c5cae9', limb: '#e3e8f0', leg: '#9fa8da', skin: '#f5f5f5', hair: '#b0bec5' },
  },
  {
    key: 'desert', label: 'Desert Fox', icon: '🦊', cost: 400, unlock: null,
    desc: 'Sandy survival gear.',
    palette: { body: '#d4a017', bodyStripe: '#b8860b', limb: '#c49a6c', leg: '#5d4e37', skin: '#f0c896', hair: '#8b6914' },
  },
  {
    key: 'ocean', label: 'Deep Diver', icon: '🌊', cost: 500, unlock: null,
    desc: 'Built for the deep.',
    palette: { body: '#006994', bodyStripe: '#005273', limb: '#4fc3f7', leg: '#004d70', skin: '#b3e5fc', hair: '#0277bd', accessory_type: 'visor', accessory_color: '#00e5ff' },
  },
  {
    key: 'champion', label: 'Champion', icon: '🏆', cost: 0, unlock: 'all-stages',
    desc: 'Awarded for beating all 10 stages.',
    palette: { body: '#f9c74f', bodyStripe: '#f0a800', limb: '#ffd166', leg: '#b5860e', skin: '#fae0a0', hair: '#c87f00', accessory_type: 'crown', accessory_color: '#f4a100' },
  },
  {
    key: 'shadowrunner', label: 'Shadow Runner', icon: '🌑', cost: 0, unlock: { stage: 8 },
    desc: 'Earned by completing Stage 8.',
    palette: { body: '#1b1b2f', bodyStripe: '#15152a', limb: '#4a3f6b', leg: '#0d0d1a', skin: '#8b7355', hair: '#2c2c2c', accessory_type: 'visor', accessory_color: '#7c4dff' },
  },
];

export const SKIN_MAP = Object.fromEntries(SKIN_DEFS.map(s => [s.key, s]));

export function ownsSkin(key) {
  if (key === 'default') return true;
  if (playerData.skins[key]) return true;
  const def = SKIN_MAP[key];
  if (def && def.unlock && def.unlock.stage) return isStageComplete(def.unlock.stage);
  return false;
}

export function buySkin(key) {
  const s = SKIN_MAP[key];
  if (!s) return false;
  if (s.unlock && s.unlock.stage) return false; // progression skin — not coin-purchasable
  if (ownsSkin(key)) return false;
  if (playerData.coins < s.cost) return false;
  playerData.coins -= s.cost;
  playerData.skins[key] = true;
  savePlayerData();
  return true;
}

export function equipSkin(key) {
  if (!ownsSkin(key)) return false;
  playerData.equippedSkin = key;
  savePlayerData();
  return true;
}

export function getEquippedSkin() {
  const key = playerData.equippedSkin;
  const def = SKIN_MAP[key];
  if (def && ownsSkin(key)) return def;
  return SKIN_MAP['default'];
}

export function isGameComplete() {
  return playerData.stagesUnlocked >= 10;
}

export function grantCompletionSkin() {
  if (!isGameComplete()) return false;
  if (ownsSkin('champion')) return false;
  playerData.skins['champion'] = true;
  savePlayerData();
  return true;
}
