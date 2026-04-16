// All game constants: weapons, equipment, attachments, maps

export const DAMAGE_THRESHOLD = 10; // weapon usage count before it becomes damaged and unfiable; repair costs $50

export const WEAPONS = {
    compass: {
        name: 'Compass', type: 'utility', range: 'close', damage: 0, fireRate: 1,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 0, starter: true, reach: 0
    },
    flashlight: {
        name: 'Flashlight', type: 'utility', range: 'close', damage: 0, fireRate: 1,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 0, reach: 0, starter: true
    },
    fists: {
        // Free starter — DPS ~13
        name: 'Fists', type: 'melee', range: 'close', damage: 6, fireRate: 0.45,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 0, starter: true, reach: 2.5
    },
    glock: {
        // Free starter — DPS ~34. Now genuinely better than fists.
        name: 'Glock', type: 'gun', range: 'middle', damage: 12, fireRate: 0.35,
        ammo: 15, maxAmmo: 15, reserveAmmo: 120, reloadTime: 2.0,
        cost: 0, starter: true, makesNoise: true
    },
    revolver: {
        // Budget — high damage per shot, slow. DPS ~43.
        name: 'Revolver', type: 'gun', range: 'middle', damage: 28, fireRate: 0.65,
        ammo: 8, maxAmmo: 8, reserveAmmo: 64, reloadTime: 2.5,
        cost: 750, makesNoise: true
    },
    molotov: {
        name: 'Molotov', type: 'throwable', range: 'middle', damage: 12,
        fireRate: 1.5, ammo: 2, maxAmmo: 2, reserveAmmo: 6, reloadTime: 0,
        cost: 750, fire: true, radius: 5, duration: 6, makesNoise: true
    },
    grenade: {
        name: 'Grenade', type: 'throwable', range: 'middle', damage: 80,
        fireRate: 1.5, ammo: 3, maxAmmo: 3, reserveAmmo: 9, reloadTime: 0,
        cost: 1000, explosive: true, radius: 6, makesNoise: true
    },
    shotgun: {
        // Close-range devastator. Point-blank DPS ~93; mid-range ~17.
        name: 'Shotgun', type: 'gun', range: 'middle', damage: 14, closeDamageBonus: 70,
        fireRate: 0.9, ammo: 6, maxAmmo: 6, reserveAmmo: 36, reloadTime: 2.5,
        cost: 2500, makesNoise: true
    },
    axe: {
        // Budget melee — DPS ~22.
        name: 'Axe', type: 'melee', range: 'close', damage: 14, fireRate: 0.65,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 4000, reach: 2.8
    },
    crossbow: {
        // Silent precision — low DPS but quiet and deadly when zoomed.
        name: 'Crossbow', type: 'gun', range: 'long', damage: 20, zoomedDamage: 80,
        fireRate: 2.2, ammo: 1, maxAmmo: 1, reserveAmmo: 20, reloadTime: 2.0,
        cost: 4750, hasScope: true, makesNoise: false
    },
    knife: {
        // Fast slasher — DPS ~67. Devastating headshots at 90 bonus damage.
        name: 'Knife', type: 'melee', range: 'close', damage: 10, fireRate: 0.15, headshot: 90,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 5000, reach: 2.2
    },
    shield: {
        // Defensive tool — low offense, blocks significant damage. DPS ~11.
        name: 'Shield', type: 'melee', range: 'close', damage: 8, fireRate: 0.75,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 6000, reach: 2.2, damageReduction: 1.0
    },
    smg: {
        // Mid-tier spray weapon — higher ammo count, fast reload. DPS ~63.
        name: 'SMG', type: 'gun', range: 'middle', damage: 5, fireRate: 0.08,
        ammo: 30, maxAmmo: 30, reserveAmmo: 210, reloadTime: 1.6,
        cost: 6000, makesNoise: true
    },
    katana: {
        // Swift samurai blade — DPS ~51. Good reach.
        name: 'Katana', type: 'melee', range: 'close', damage: 18, fireRate: 0.35,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 7500, reach: 3.2
    },
    assault_rifle: {
        // Reliable workhorse — DPS ~67, long range. Needs aim.
        name: 'Assault Rifle', type: 'gun', range: 'long', damage: 6, fireRate: 0.09,
        ammo: 40, maxAmmo: 40, reserveAmmo: 200, reloadTime: 2.0,
        cost: 10000, makesNoise: true
    },
    longsword: {
        // Heavy hitter — DPS ~29, massive reach.
        name: 'Longsword', type: 'melee', range: 'close', damage: 22, fireRate: 0.75,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 10000, reach: 3.8
    },
    chainsaw: {
        // Highest melee DPS ~114. Never stops.
        name: 'Chainsaw', type: 'melee', range: 'close', damage: 8, fireRate: 0.07,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 15000, reach: 2.8, makesNoise: true
    },
    rpg: {
        // Area devastation — DPS irrelevant. Radius 8, damage 150.
        name: 'RPG', type: 'gun', range: 'middle', damage: 150, fireRate: 2.5,
        ammo: 1, maxAmmo: 1, reserveAmmo: 5, reloadTime: 4,
        cost: 25000, explosive: true, radius: 8, makesNoise: true
    },
    sniper: {
        // Extreme range specialist — 150 damage zoomed, 1.2s between shots.
        name: 'Sniper', type: 'gun', range: 'long', damage: 30, zoomedDamage: 150,
        fireRate: 1.2, ammo: 5, maxAmmo: 5, reserveAmmo: 30, reloadTime: 5.0,
        cost: 100000, hasScope: true, makesNoise: true
    },
    minigun: {
        // Unstoppable — DPS ~160. Melts everything.
        name: 'Minigun', type: 'gun', range: 'long', damage: 4, fireRate: 0.025,
        ammo: 900, maxAmmo: 900, reserveAmmo: 2700, reloadTime: 5,
        cost: 110000, makesNoise: true
    },
};

export const EQUIPMENT = {
    // Helmets
    light_helmet: { name: 'Light Helmet', type: 'head', armor: 40, cost: 1500, headshotReduction: 0.4 },
    chainmail_helmet: { name: 'Chainmail Helmet', type: 'head', armor: 70, cost: 11000, headshotReduction: 0.6 },
    heavy_helmet: { name: 'Heavy Helmet', type: 'head', armor: 100, cost: 30000, headshotReduction: 0.85 },
    // Breastplates
    light_armor: { name: 'Light Breastplate', type: 'armor', armor: 100, cost: 4500, damageReduction: 0.3 },
    chainmail_breastplate: { name: 'Chainmail Breastplate', type: 'armor', armor: 175, cost: 27500, damageReduction: 0.45 },
    heavy_armor: { name: 'Heavy Breastplate', type: 'armor', armor: 250, cost: 50000, damageReduction: 0.6 },
    // Pants
    light_pants: { name: 'Light Pants', type: 'pants', armor: 50, cost: 1500, damageReduction: 0.15 },
    chainmail_pants: { name: 'Chainmail Pants', type: 'pants', armor: 90, cost: 10000, damageReduction: 0.25 },
    heavy_pants: { name: 'Heavy Pants', type: 'pants', armor: 130, cost: 20000, damageReduction: 0.35 },
    // Boots
    light_boots: { name: 'Light Boots', type: 'boots', armor: 30, cost: 1125, damageReduction: 0.1 },
    chainmail_boots: { name: 'Chainmail Boots', type: 'boots', armor: 60, cost: 7500, damageReduction: 0.2 },
    heavy_boots: { name: 'Heavy Boots', type: 'boots', armor: 90, cost: 12000, damageReduction: 0.3 },
    // Consumables
    med_kit: { name: 'Med Kit', type: 'consumable', hpRestore: 50, cost: 500 },
    adrenaline: { name: 'Adrenaline', type: 'consumable', hpBoost: 25, cost: 750, tempHP: true },
    airstrike: { name: 'Airstrike Targeter', type: 'consumable', airstrikes: 1, cost: 5000 }
};

export const ATTACHMENTS = {
    silencer: { name: 'Silencer', cost: 500, effect: 'silent', description: 'Eliminates gun noise' },
    scope: { name: 'Scope', cost: 800, effect: 'scope', description: '+20 damage when zoomed', bonusDamage: 20 }
};

export const MAPS = {
    warehouse: {
        name: 'Warehouse', description: 'Pitch-dark industrial labyrinth. Every shadow hides a threat.',
        size: 120, color: 0x3a3a3a, wallColor: 0x505050, ambientLight: 0.22
    },
    desert: {
        name: 'Desert Outpost', description: 'Burning sun, zero mercy. Open ground and deadly sightlines.',
        size: 480, color: 0xc8a840, wallColor: 0x8b7332, ambientLight: 0.88
    },
    city: {
        name: 'City Ruins', description: 'Shattered skyline and ash-grey streets. Something lurks in every ruin.',
        size: 480, color: 0x555555, wallColor: 0x777777, ambientLight: 0.08
    },
    forest: {
        name: 'Dark Forest', description: 'The trees close in. By the time you hear them, it\'s too late.',
        size: 480, color: 0x263d18, wallColor: 0x344f22, ambientLight: 0.14
    },
    mountain: {
        name: 'Rocky Mountains', description: 'Brutal peaks, no cover. High ground is everything.',
        size: 480, color: 0x4e4e4e, wallColor: 0x3c3c3c, ambientLight: 0.55
    },
    fortress: {
        name: 'Fortress', description: 'A crumbling stone fortress. Thick walls hide more than they reveal.',
        size: 250, color: 0x887868, wallColor: 0x5a4a3c, ambientLight: 0.35
    },
    hallway: {
        name: 'The Hallway', description: 'One long corridor. You spawn at one end. They come from the other.',
        size: 200, color: 0x2a2a2a, wallColor: 0x444444, ambientLight: 3.6
    },
    cave: {
        name: 'Cave',
        description: 'A dripping underground labyrinth. Tight tunnels, glowing crystals, and nowhere to run.',
        size: 200,
        color: 0x3a3a3a,      // dark stone floor, range 0x2a2a2a–0x4a4a4a
        wallColor: 0x252525,  // near-black rock walls, range 0x1a1a1a–0x3a3a3a
        ambientLight: 0.08
    }
};
