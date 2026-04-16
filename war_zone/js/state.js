// Player data persistence + game state management

function defaultPlayerData() {
    return {
        money: 100,
        missions: 0,
        ownedWeapons: ['fists', 'glock'],
        ownedEquipment: [],
        ownedArmor: [],
        weaponAttachments: {},
        weaponUsage: {},
        equippedLoadout: ['fists', 'glock'],
        equippedArmor: null,
        equippedHelmet: null,
        equippedPants: null,
        equippedBoots: null,
        reserveAmmo: {},
        airstrikes: 0,
        level: 1,
        xp: 0,
        statPoints: 0,
        stats: { health: 0, speed: 0, damage: 0, stamina: 0, staminaRegen: 0, jump: 0, reload: 0 }
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
                ownedArmor: Array.isArray(d.ownedArmor) ? d.ownedArmor : def.ownedArmor,
                reserveAmmo: (typeof d.reserveAmmo === 'object' && d.reserveAmmo !== null) ? d.reserveAmmo : def.reserveAmmo,
                stats: (typeof d.stats === 'object' && d.stats !== null) ? { ...def.stats, ...d.stats } : def.stats
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
    isZoomed: false, godMode: false, noClip: false, flyMode: false, speedMult: 1,
    maxSlots: 4,
    stamina: 100, maxStamina: 100
};

export function resetPlayerState(overrides = {}) {
    Object.assign(playerState, {
        hp: 100, maxHp: 100, armor: 0, maxArmor: 0, damageReduction: 0,
        headshotReduction: 0, weapons: [], currentWeaponIndex: 0,
        weaponStates: {}, isZoomed: false, godMode: false, noClip: false, flyMode: false,
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
    pvpEnemy: null,
    // Airstrike cooldown: timestamp (ms) of last use, resets on new game
    airstrikeLastUsed: null,
    slopeMeshes: [],
    craterPits: [],
    streetLamps: [],     // { mat, phase } entries for flickering city lamps
    warehouseLights: [], // { mat, light, phase } entries for flickering warehouse ceiling lights
    secretPassages: [],  // fortress passage obstacles: { mesh, box, passThrough, isSecretPassage }
    playerFacingYaw: 0,  // player body/camera yaw for shield direction check
    tpShootNDC: null,    // THREE.Vector2 set in 3rd person mode
    tpShootCamera: null, // tpCamera ref set in 3rd person mode
    // Day/night cycle
    dayTime: 0.5,        // 0.0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
    dayNightActive: false,
    sunLight: null,
    ambientLightRef: null,
    fogNearBase: 0,
    fogFarBase: 0,
    // Cave map
    zombieSpawnCavern: null,  // { cx, cz, radius } — set by buildCaveMap, read by spawnZombie
    caveAmbientNode: null     // AudioNode reference for cave ambient sound; null if Web Audio unavailable
};

// --- Leveling ---

export function xpToNextLevel(level) {
    return level * 100;
}

// awardXP is set via callback to avoid circular dep (ui imports state, state would import ui)
let _awardXPImpl = null;
export function setAwardXPImpl(fn) { _awardXPImpl = fn; }

export function awardXP(amount) {
    playerData.xp += amount;
    let didLevelUp = false;
    while (playerData.xp >= xpToNextLevel(playerData.level)) {
        playerData.xp -= xpToNextLevel(playerData.level);
        playerData.level++;
        playerData.statPoints += 5;
        didLevelUp = true;
    }
    savePlayerData();
    if (_awardXPImpl) _awardXPImpl(didLevelUp);
}
