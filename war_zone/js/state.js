// Player data persistence + game state management

function defaultPlayerData() {
    return {
        money: 100,
        missions: 0,
        ownedWeapons: ['fists', 'glock'],
        ownedEquipment: [],
        weaponAttachments: {},
        weaponUsage: {},
        equippedLoadout: ['fists', 'glock'],
        equippedArmor: null,
        equippedHelmet: null,
        equippedPants: null,
        equippedBoots: null,
        reserveAmmo: {},
        airstrikes: 0
    };
}

function loadPlayerData() {
    try {
        const d = JSON.parse(localStorage.getItem('shooter_save'));
        if (d && typeof d === 'object') {
            const def = defaultPlayerData();
            return {
                ...def, ...d,
                ownedWeapons: Array.isArray(d.ownedWeapons) ? d.ownedWeapons : def.ownedWeapons,
                ownedEquipment: Array.isArray(d.ownedEquipment) ? d.ownedEquipment : def.ownedEquipment,
                weaponAttachments: (typeof d.weaponAttachments === 'object' && d.weaponAttachments !== null) ? d.weaponAttachments : def.weaponAttachments,
                weaponUsage: (typeof d.weaponUsage === 'object' && d.weaponUsage !== null) ? d.weaponUsage : def.weaponUsage,
                equippedLoadout: Array.isArray(d.equippedLoadout) ? d.equippedLoadout : def.equippedLoadout,
                reserveAmmo: (typeof d.reserveAmmo === 'object' && d.reserveAmmo !== null) ? d.reserveAmmo : def.reserveAmmo
            };
        }
    } catch (e) { }
    return defaultPlayerData();
}

export const playerData = loadPlayerData();

export function savePlayerData() {
    localStorage.setItem('shooter_save', JSON.stringify(playerData));
}

export const playerState = {
    hp: 100, maxHp: 100, armor: 0, maxArmor: 0, damageReduction: 0,
    headshotReduction: 0,
    weapons: [], currentWeaponIndex: 0,
    weaponStates: {},
    isZoomed: false, godMode: false, noClip: false, speedMult: 1,
    maxSlots: 4,
    stamina: 100, maxStamina: 100
};

export function resetPlayerState(overrides = {}) {
    Object.assign(playerState, {
        hp: 100, maxHp: 100, armor: 0, maxArmor: 0, damageReduction: 0,
        headshotReduction: 0, weapons: [], currentWeaponIndex: 0,
        weaponStates: {}, isZoomed: false, godMode: false, noClip: false,
        speedMult: 1, maxSlots: 4, stamina: 100, maxStamina: 100, ...overrides
    });
}

export const gameState = {
    mode: null,       // 'zombie' or 'pvp'
    pendingMode: null,
    currentMap: null,
    active: false,
    paused: false,
    // Zombie
    wave: 1,
    zombiesAlive: 0,
    zombiesToSpawn: 0,
    zombieSpawnTimer: 0,
    zombieEntities: [],
    ammoPickups: [],
    droppedWeapons: [],
    fireZones: [],
    // PvP
    pvpRound: 1,
    pvpPlayerScore: 0,
    pvpEnemyScore: 0,
    pvpEnemy: null
};
