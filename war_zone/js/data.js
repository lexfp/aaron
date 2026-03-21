// All game constants: weapons, equipment, attachments, maps

export const WEAPONS = {
    compass: {
        name: 'Compass', type: 'utility', range: 'close', damage: 0, fireRate: 1,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 0, starter: true, reach: 0
    },
    fists: {
        name: 'Fists', type: 'melee', range: 'close', damage: 3, fireRate: 0.5,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 0, starter: true, reach: 1.7
    },
    glock: {
        name: 'Glock', type: 'gun', range: 'middle', damage: 2, fireRate: 0.5,
        ammo: 10, maxAmmo: 10, reserveAmmo: 100, reloadTime: 3,
        cost: 0, starter: true, makesNoise: true
    },
    sniper: {
        name: 'Sniper', type: 'gun', range: 'long', damage: 15, zoomedDamage: 75,
        fireRate: 1, ammo: 5, maxAmmo: 5, reserveAmmo: 30, reloadTime: 7,
        cost: 20000, hasScope: true, makesNoise: true
    },
    assault_rifle: {
        name: 'Assault Rifle', type: 'gun', range: 'long', damage: 2, fireRate: 0.1,
        ammo: 40, maxAmmo: 40, reserveAmmo: 200, reloadTime: 2.5,
        cost: 2000, makesNoise: true
    },
    crossbow: {
        name: 'Crossbow', type: 'gun', range: 'long', damage: 5, zoomedDamage: 40,
        fireRate: 2, ammo: 1, maxAmmo: 1, reserveAmmo: 20, reloadTime: 2,
        cost: 950, hasScope: true, makesNoise: false
    },
    revolver: {
        name: 'Revolver', type: 'gun', range: 'middle', damage: 15, fireRate: 0.6,
        ammo: 6, maxAmmo: 6, reserveAmmo: 60, reloadTime: 2.5,
        cost: 150, makesNoise: true
    },
    shotgun: {
        name: 'Shotgun', type: 'gun', range: 'middle', damage: 10, closeDamageBonus: 50,
        fireRate: 0.8, ammo: 5, maxAmmo: 5, reserveAmmo: 40, reloadTime: 3,
        cost: 500, makesNoise: true
    },
    axe: {
        name: 'Axe', type: 'melee', range: 'close', damage: 5, fireRate: 0.7,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 800, reach: 2.5
    },
    knife: {
        name: 'Knife', type: 'melee', range: 'close', damage: 5, fireRate: 0.1, headshot: 60,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 1000, reach: 2.2
    },
    katana: {
        name: 'Katana', type: 'melee', range: 'close', damage: 8, fireRate: 0.4,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 1500, reach: 3.0
    },
    longsword: {
        name: 'Longsword', type: 'melee', range: 'close', damage: 10, fireRate: 0.8,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 2000, reach: 3.5
    },
    chainsaw: {
        name: 'Chainsaw', type: 'melee', range: 'close', damage: 4, fireRate: 0.1,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 3000, reach: 2.8, makesNoise: true
    },
    shield: {
        name: 'Shield', type: 'melee', range: 'close', damage: 1, fireRate: 0.8,
        ammo: Infinity, maxAmmo: Infinity, reserveAmmo: Infinity, reloadTime: 0,
        cost: 1200, reach: 2.0, damageReduction: 1.0
    },
    minigun: {
        name: 'Minigun', type: 'gun', range: 'long', damage: 1, fireRate: 0.03,
        ammo: 900, maxAmmo: 900, reserveAmmo: 2700, reloadTime: 5,
        cost: 12000, makesNoise: true
    },
    grenade: {
        name: 'Grenade', type: 'throwable', range: 'middle', damage: 60,
        fireRate: 1.5, ammo: 3, maxAmmo: 3, reserveAmmo: 9, reloadTime: 0,
        cost: 200, explosive: true, radius: 5, makesNoise: true
    },
    molotov: {
        name: 'Molotov', type: 'throwable', range: 'middle', damage: 8,
        fireRate: 1.5, ammo: 2, maxAmmo: 2, reserveAmmo: 6, reloadTime: 0,
        cost: 150, fire: true, radius: 4, duration: 5, makesNoise: true
    },
    rpg: {
        name: 'RPG', type: 'gun', range: 'middle', damage: 100, fireRate: 2.5,
        ammo: 1, maxAmmo: 1, reserveAmmo: 5, reloadTime: 4,
        cost: 5000, explosive: true, radius: 6, makesNoise: true
    }
};

export const EQUIPMENT = {
    light_armor: { name: 'Light Armor', type: 'armor', armor: 25, cost: 300, damageReduction: 0.1 },
    heavy_armor: { name: 'Heavy Armor', type: 'armor', armor: 75, cost: 800, damageReduction: 0.25 },
    helmet: { name: 'Helmet', type: 'head', armor: 20, cost: 200, headshotReduction: 0.5 },
    med_kit: { name: 'Med Kit', type: 'consumable', hpRestore: 50, cost: 100 },
    adrenaline: { name: 'Adrenaline', type: 'consumable', hpBoost: 25, cost: 250, tempHP: true },
    airstrike: { name: 'Airstrike Targeter', type: 'consumable', airstrikes: 1, cost: 200 }
};

export const ATTACHMENTS = {
    silencer: { name: 'Silencer', cost: 500, effect: 'silent', description: 'Eliminates gun noise' },
    scope: { name: 'Scope', cost: 800, effect: 'scope', description: '+20 damage when zoomed', bonusDamage: 20 }
};

export const MAPS = {
    warehouse: {
        name: 'Warehouse', description: 'Close quarters combat in a dark warehouse',
        size: 120, color: 0x444444, wallColor: 0x555555, ambientLight: 0.3
    },
    desert: {
        name: 'Desert Outpost', description: 'Open terrain with scattered cover',
        size: 200, color: 0xc2a645, wallColor: 0x8b7332, ambientLight: 0.8
    },
    city: {
        name: 'City Ruins', description: 'Urban combat with buildings and streets',
        size: 160, color: 0x666666, wallColor: 0x888888, ambientLight: 0.5
    },
    forest: {
        name: 'Dark Forest', description: 'Dense forest with limited visibility',
        size: 220, color: 0x2d5a1e, wallColor: 0x3d6a2e, ambientLight: 0.2
    },
    mountain: {
        name: 'Rocky Mountains', description: 'Uneven terrain with valleys and peaks',
        size: 300, color: 0x555555, wallColor: 0x444444, ambientLight: 0.5
    }
};
