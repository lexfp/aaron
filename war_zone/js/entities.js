// Zombie and PvP enemy spawning, AI, and updates

import * as THREE from 'three';
import { WEAPONS, MAPS } from './data.js';
import { playerData, playerState, savePlayerData, gameState, awardXP } from './state.js';
import { scene, camera, obstacles, moveSpeed } from './engine.js';
import { playGunshot } from './audio.js';
import { addKillFeed, updateHUD, showRoundOverlay } from './ui.js';
import { dropWeapon } from './weapons.js';
import { damagePlayer, checkPvPEnd } from './combat.js';
import { checkAchievements } from './achievements.js';

// --- Zombies ---

const SQUAD_ADJ  = ['Rotting','Crimson','Plague','Shadow','Feral','Hollow','Dread','Vile','Rotten','Undead'];
const SQUAD_NOUN = ['Horde','Pack','Tide','Surge','Swarm','Brood','Mob','Siege','Band','Drift'];
function generateSquadName() {
    return SQUAD_ADJ[Math.floor(Math.random() * SQUAD_ADJ.length)]
         + ' ' + SQUAD_NOUN[Math.floor(Math.random() * SQUAD_NOUN.length)];
}

function addSquadNameSprite(zombie, name) {
    if (zombie.nameSprite) zombie.mesh.remove(zombie.nameSprite);
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 48;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 48);
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6600';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.strokeText(name, 128, 36);
    ctx.fillText(name, 128, 36);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    const bs = zombie.isApex ? 4.5 : (zombie.isGiga ? 4.05 : (zombie.isBoss ? 2.5 : 0.9));
    sprite.scale.set(3, 0.6, 1);
    sprite.position.y = bs * 2.2 + 0.5;
    zombie.mesh.add(sprite);
    zombie.nameSprite = sprite;
}

const _ROLE_SLOTS = ['flanker_l', 'flanker_l', 'flanker_r', 'flanker_r', 'charger', 'charger', 'support', 'support', 'support'];

function assignSquad(zombie) {
    const pos = zombie.mesh.position;
    const squads = gameState.hiveMind.squads;

    if (zombie.isBoss) {
        const squad = {
            id: gameState.hiveMind._nextSquadId++,
            name: generateSquadName(),
            members: [zombie],
            state: 'assembling',
            leaderId: zombie.mesh.uuid,
            commanderId: null,
            executeTimer: 0
        };
        zombie.squadId = squad.id;
        zombie.squadRole = 'leader';
        addSquadNameSprite(zombie, squad.name);
        squads.push(squad);

        // Auto-assign to a nearby commander that has room
        for (const z of gameState.zombieEntities) {
            if ((z.isGiga || z.isApex) && !z.dead && z.commandedSquads) {
                const limit = z.isApex ? 10 : 5;
                if (z.commandedSquads.length < limit) {
                    const ddx = z.mesh.position.x - pos.x;
                    const ddz = z.mesh.position.z - pos.z;
                    if (Math.sqrt(ddx * ddx + ddz * ddz) <= 80) {
                        z.commandedSquads.push(squad.id);
                        squad.commanderId = z.mesh.uuid;
                        break;
                    }
                }
            }
        }
    } else {
        // Regular zombie: join nearest squad with a boss leader and room
        let best = null, bestDist = Infinity;
        for (const squad of squads) {
            if (!squad.leaderId || squad.members.length >= 10) continue;
            const leaderZ = squad.members.find(m => m.squadRole === 'leader');
            if (!leaderZ || leaderZ.dead) continue;
            const ddx = leaderZ.mesh.position.x - pos.x;
            const ddz = leaderZ.mesh.position.z - pos.z;
            const d = Math.sqrt(ddx * ddx + ddz * ddz);
            if (d <= 30 && d < bestDist) { best = squad; bestDist = d; }
        }
        if (best) {
            const roleIndex = best.members.length - 1;
            zombie.squadRole = _ROLE_SLOTS[Math.min(roleIndex, _ROLE_SLOTS.length - 1)];
            zombie.squadId = best.id;
            best.members.push(zombie);
            addSquadNameSprite(zombie, best.name);
        }
    }
}

function assignCommander(zombie) {
    const limit = zombie.isApex ? 10 : 5;
    zombie.commandedSquads = [];
    for (const squad of gameState.hiveMind.squads) {
        if (!squad.commanderId && zombie.commandedSquads.length < limit) {
            squad.commanderId = zombie.mesh.uuid;
            zombie.commandedSquads.push(squad.id);
        }
    }
}

export function spawnZombie(isBoss, isGiga = false, speedOverride = null, isApex = false) {
    const mapSize = MAPS[gameState.currentMap].size;
    const angle = Math.random() * Math.PI * 2;
    let spawnX, spawnZ;
    if (gameState.mode === 'rescue' && gameState.extractionZone) {
        const d = 8 + Math.random() * 20;
        spawnX = gameState.extractionZone.x + Math.cos(angle) * d;
        spawnZ = gameState.extractionZone.z + Math.sin(angle) * d;
    } else if (gameState.currentMap === 'hallway' && gameState.hallwayZombieSpawnZ != null) {
        // Hallway: always spawn at the far (north) end, random X within corridor width
        spawnX = (Math.random() - 0.5) * 4;
        spawnZ = gameState.hallwayZombieSpawnZ + (Math.random() - 0.5) * 2;
    } else if (gameState.currentMap === 'cave' && gameState.mode === 'zombie' && gameState.zombieSpawnCavern) {
        const sc = gameState.zombieSpawnCavern;
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnDist = Math.random() * (sc.radius - 1.0);
        spawnX = sc.cx + Math.cos(spawnAngle) * spawnDist;
        spawnZ = sc.cz + Math.sin(spawnAngle) * spawnDist;
        const distFromOrigin = Math.hypot(spawnX, spawnZ);
        if (distFromOrigin > 130) {
            const scale = 130 / distFromOrigin;
            spawnX *= scale;
            spawnZ *= scale;
        }
    } else {
        // Spawn within loaded chunk range (50–130 units) so terrain/obstacles exist
        const px = camera.position.x, pz = camera.position.z;
        const bound = mapSize * 0.9;
        spawnX = null;
        for (let t = 0; t < 20; t++) {
            const a = Math.random() * Math.PI * 2;
            const d = 50 + Math.random() * 80;
            const sx = px + Math.cos(a) * d;
            const sz = pz + Math.sin(a) * d;
            if (Math.abs(sx) <= bound && Math.abs(sz) <= bound) {
                spawnX = sx; spawnZ = sz; break;
            }
        }
        if (spawnX === null) {
            spawnX = px + Math.cos(angle) * 90;
            spawnZ = pz + Math.sin(angle) * 90;
        }
    }

    let hp, damage, dropMoney, weaponId = null;
    const bodySize = isApex ? 4.5 : (isGiga ? 4.05 : (isBoss ? 2.5 : 0.9));
    let armoredEnemy = false;

    if (isApex) {
        const lvl = playerData.level;
        hp = 1000 + (lvl - 1) * 200;
        damage = 50 + (lvl - 1) * 10;
        dropMoney = 100 + (lvl - 1) * 25;
    } else if (isGiga) {
        hp = 1000; damage = 50; dropMoney = 75;
    } else if (isBoss) {
        hp = 100; damage = 20; dropMoney = 10;
        const r = Math.random() * 100;
        if (r < 0.01) weaponId = pickRandomWeapon('long');
        else if (r < 5.01) weaponId = pickRandomWeapon('middle');
        else if (r < 15.01) weaponId = pickRandomWeapon('close');
    } else if (gameState.mode === 'rescue') {
        // Rescue mode hostiles: only 50% are armed
        hp = 40; damage = 8; dropMoney = 3;
        if (Math.random() < 0.5) {
            const rr = Math.random();
            if (rr < 0.3) weaponId = pickRandomWeapon('long');
            else if (rr < 0.65) weaponId = pickRandomWeapon('middle');
            else weaponId = pickRandomWeapon('close');
        }
        if (Math.random() < 0.4) armoredEnemy = true;
    } else {
        hp = 25; damage = 5; dropMoney = 1;
        if (Math.random() * 100 < 5) weaponId = pickRandomWeapon('close');
    }

    const group = new THREE.Group();
    const skinColor = isApex ? 0xcc5500 : (isGiga ? 0x220011 : (isBoss ? 0x880044 : [0x445533, 0x3a5530, 0x504a38, 0x3d4a33][Math.floor(Math.random() * 4)]));
    const bodyMat = new THREE.MeshStandardMaterial({ color: skinColor });

    const shirtColors = [0x8B0000, 0x2F4F4F, 0x4B3621, 0x556B2F, 0x8B4513, 0x36454F, 0x702963, 0x1C1C1C, 0x3B5998, 0xA0522D];
    const pantColors = [0x191970, 0x2F2F2F, 0x3B3B3B, 0x4A4A4A, 0x2E2E1F, 0x3D3D1F];
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColors[Math.floor(Math.random() * shirtColors.length)] });
    const pantMat = new THREE.MeshStandardMaterial({ color: pantColors[Math.floor(Math.random() * pantColors.length)] });

    // Body parts: [0]=body, [1]=head, [2]=leftArm, [3]=rightArm, [4]=leftLeg, [5]=rightLeg
    const body = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.6, bodySize, bodySize * 0.4), shirtMat);
    body.position.y = bodySize * 0.8; body.castShadow = true; group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(bodySize * 0.25, 8, 8), bodyMat);
    head.position.y = bodySize * 1.5; head.castShadow = true; group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: isApex ? 0xffdd00 : 0xff0000 });
    const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMat);
    eye1.position.set(0.1, 0.05, bodySize * 0.22); head.add(eye1);
    const eye2 = eye1.clone(); eye2.position.x = -0.1; head.add(eye2);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.05), mouthMat);
    mouth.position.set(0, -0.1, bodySize * 0.24);
    mouth.rotation.z = (Math.random() - 0.5) * 0.4;
    head.add(mouth);

    // Left arm — shoulder pivot + elbow joint
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-bodySize * 0.4, bodySize * 1.05, 0);
    const leftUpperArm = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.15, bodySize * 0.42, bodySize * 0.15), shirtMat);
    leftUpperArm.position.y = -bodySize * 0.21; leftUpperArm.castShadow = true; leftArmGroup.add(leftUpperArm);
    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.position.y = -bodySize * 0.42;
    const leftForearmMesh = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.13, bodySize * 0.35, bodySize * 0.13), bodyMat);
    leftForearmMesh.position.y = -bodySize * 0.175; leftForearmMesh.castShadow = true; leftForearmGroup.add(leftForearmMesh);
    leftArmGroup.add(leftForearmGroup); group.add(leftArmGroup);

    // Right arm — shoulder pivot + elbow joint
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(bodySize * 0.4, bodySize * 1.05, 0);
    const rightUpperArm = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.15, bodySize * 0.42, bodySize * 0.15), shirtMat);
    rightUpperArm.position.y = -bodySize * 0.21; rightUpperArm.castShadow = true; rightArmGroup.add(rightUpperArm);
    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.position.y = -bodySize * 0.42;
    const rightForearmMesh = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.13, bodySize * 0.35, bodySize * 0.13), bodyMat);
    rightForearmMesh.position.y = -bodySize * 0.175; rightForearmMesh.castShadow = true; rightForearmGroup.add(rightForearmMesh);
    rightArmGroup.add(rightForearmGroup); group.add(rightArmGroup);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.18, bodySize * 0.5, bodySize * 0.18), pantMat);
    leftLeg.position.set(-bodySize * 0.15, bodySize * 0.25, 0); group.add(leftLeg);
    const rightLeg = leftLeg.clone(); rightLeg.position.x = bodySize * 0.15; group.add(rightLeg);

    // Apex crown of fire spikes
    if (isApex) {
        const crownMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff5500, emissiveIntensity: 0.7 });
        for (let s = 0; s < 6; s++) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(bodySize * 0.05, bodySize * 0.32, 5), crownMat);
            const sAngle = (s / 6) * Math.PI * 2;
            spike.position.set(Math.cos(sAngle) * bodySize * 0.22, bodySize * 1.82, Math.sin(sAngle) * bodySize * 0.22);
            group.add(spike);
        }
    }

    // Random accessories
    const rAcc = Math.random();
    if (rAcc < 0.3) {
        const hatColors = [0x1C1C1C, 0x8B4513, 0x2F4F4F, 0x800000];
        const hat = new THREE.Mesh(
            new THREE.CylinderGeometry(bodySize * 0.28, bodySize * 0.3, bodySize * 0.12, 8),
            new THREE.MeshStandardMaterial({ color: hatColors[Math.floor(Math.random() * hatColors.length)] })
        );
        hat.position.y = bodySize * 1.75; group.add(hat);
    } else if (rAcc < 0.5) {
        const tie = new THREE.Mesh(
            new THREE.BoxGeometry(bodySize * 0.06, bodySize * 0.4, bodySize * 0.02),
            new THREE.MeshStandardMaterial({ color: 0xaa0000 })
        );
        tie.position.set(0, bodySize * 0.7, bodySize * 0.21); group.add(tie);
    }

    // Armor visual for rescue hostiles
    if (armoredEnemy) {
        const armorMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.6, roughness: 0.4 });
        const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.65, bodySize * 0.55, bodySize * 0.12), armorMat);
        chestPlate.position.set(0, bodySize * 0.9, bodySize * 0.16); group.add(chestPlate);
        const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(bodySize * 0.12, 6, 6), armorMat);
        shoulderL.position.set(-bodySize * 0.42, bodySize * 1.1, 0); group.add(shoulderL);
        const shoulderR = shoulderL.clone(); shoulderR.position.x = bodySize * 0.42; group.add(shoulderR);
    }

    // Visible weapon mesh on armed zombies (attached to right arm position)
    if (weaponId) {
        const wDef = WEAPONS[weaponId];
        const wpnMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
        let wpnMesh;
        if (wDef.type === 'gun') {
            // Gun body pointing forward (along Z axis)
            wpnMesh = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.1, bodySize * 0.1, bodySize * 0.55), wpnMat);
            wpnMesh.position.set(bodySize * 0.5, bodySize * 0.85, bodySize * 0.35);
        } else if (wDef.type === 'melee') {
            wpnMesh = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.06, bodySize * 0.7, bodySize * 0.06),
                new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8 }));
            wpnMesh.position.set(bodySize * 0.52, bodySize * 0.9, bodySize * 0.1);
            wpnMesh.rotation.x = -0.5;
        }
        if (wpnMesh) { wpnMesh.castShadow = true; group.add(wpnMesh); }
    }

    // Ensure we don't spawn inside a bounding box — nudge outward along spawn angle
    // (skip for hallway — nudging would push zombies through the end wall)
    const spawnRadius = isApex ? 1.8 : (isGiga ? 1.5 : (isBoss ? 0.7 : 0.5));
    if (gameState.currentMap !== 'hallway') {
        for (let attempts = 0; attempts < 10; attempts++) {
            if (!checkZombieCollision(new THREE.Vector3(spawnX, 1, spawnZ), spawnRadius)) break;
            spawnX += Math.cos(angle) * 2;
            spawnZ += Math.sin(angle) * 2;
        }
    }

    // For hallway, place directly on floor — raycaster would hit boundary walls or ceiling
    let spawnY = 0;
    if (gameState.currentMap !== 'hallway') {
        const _zRay = new THREE.Raycaster(new THREE.Vector3(spawnX, 200, spawnZ), new THREE.Vector3(0, -1, 0));
        const _zMeshes = obstacles.filter(o => o.mesh && !o.passThrough && !o.noStep).map(o => o.mesh).concat(gameState.slopeMeshes || []);
        const _zHits = _zRay.intersectObjects(_zMeshes);
        spawnY = _zHits.length > 0 ? _zHits[0].point.y : 0;
    }
    group.position.set(spawnX, spawnY, spawnZ);

    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 64, 16);
    const tex = new THREE.CanvasTexture(canvas);
    const hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    hpSprite.scale.set(1, 0.25, 1);
    hpSprite.position.y = bodySize * 2.2;
    group.add(hpSprite);

    scene.add(group);

    const _apexLvl = playerData.level;
    const _apexSpeedCap = Math.min(15, moveSpeed * playerState.speedMult + 2);
    const defaultSpeed = isApex ? Math.min(_apexSpeedCap, 8.0 + (_apexLvl - 1) * 0.4) : (isGiga ? 7.0 : (isBoss ? 2.5 : (gameState.mode === 'rescue' ? 4.0 : 3.5)));
    gameState.zombieEntities.push({
        mesh: group, hp, maxHp: hp, damage, dropMoney, isBoss, isGiga, isApex,
        weaponId, speed: speedOverride != null ? speedOverride : defaultSpeed,
        attackCooldown: 0, lastNoiseCheck: 0, attracted: gameState.currentMap === 'hallway', dead: false,
        hpCtx: ctx, hpTex: tex,
        zombieRadius: isApex ? 1.8 : (isGiga ? 1.5 : (isBoss ? 0.7 : 0.5)),
        attackDist: isApex ? 5 : (isGiga ? 4 : 2),
        damageReduction: armoredEnemy ? 0.35 : 0,
        aiState: 'charge', aiTimer: 0,
        flankAngle: (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 4 + Math.random() * Math.PI / 4),
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        stuckTimer: 0, prevHp: hp,
        wanderAngle: Math.random() * Math.PI * 2, wanderTimer: 0
    });
    const _newZombie = gameState.zombieEntities[gameState.zombieEntities.length - 1];
    if (isGiga || isApex) {
        assignCommander(_newZombie);
    } else {
        assignSquad(_newZombie);
    }
    gameState.zombiesAlive++;
}

export function spawnHostage(mapSize) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3366cc });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xd4a574 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.4), bodyMat);
    body.position.y = 0.8; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), headMat);
    head.position.y = 1.5; group.add(head);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a237e });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2), legMat);
    legL.position.set(-0.14, 0.25, 0); group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.2), legMat);
    legR.position.set(0.14, 0.25, 0); group.add(legR);

    // Facial features
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    eyeL.position.set(-0.09, 1.53, 0.23); group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
    eyeR.position.set(0.09, 1.53, 0.23); group.add(eyeR);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x882222 });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), mouthMat);
    mouth.position.set(0, 1.4, 0.24); group.add(mouth);

    // On mountain map keep hostage within the navigable flat-ish zone; elsewhere use full range.
    const isMountain = gameState.currentMap === 'mountain';
    const spawnRange = isMountain ? mapSize * 0.25 : mapSize * 0.8;
    // Use a 3 m clear radius so the player can physically walk up to the hostage.
    const clearRadius = 3.0;
    let spawnX = (Math.random() - 0.5) * spawnRange * 2;
    let spawnZ = (Math.random() - 0.5) * spawnRange * 2;
    for (let attempts = 0; attempts < 100; attempts++) {
        if (!checkZombieCollision(new THREE.Vector3(spawnX, 1, spawnZ), clearRadius)) break;
        spawnX = (Math.random() - 0.5) * spawnRange * 2;
        spawnZ = (Math.random() - 0.5) * spawnRange * 2;
    }
    // Snap Y to actual terrain surface so the hostage isn't buried in a slope.
    const _hRay = new THREE.Raycaster(new THREE.Vector3(spawnX, 200, spawnZ), new THREE.Vector3(0, -1, 0));
    const _hMeshes = obstacles.filter(o => o.mesh).map(o => o.mesh).concat(gameState.slopeMeshes || []);
    const _hHits = _hRay.intersectObjects(_hMeshes);
    const spawnY = _hHits.length > 0 ? _hHits[0].point.y : 0;
    group.position.set(spawnX, spawnY, spawnZ);

    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00aaff'; ctx.font = '20px Arial'; ctx.textAlign = "center"; ctx.fillText('HOSTAGE (E)', 64, 24);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    sprite.position.y = 2.2; sprite.scale.set(1.5, 0.35, 1);
    group.add(sprite);

    scene.add(group);
    gameState.hostage = { mesh: group, rescued: false };
}

function pickRandomWeapon(range) {
    const options = Object.entries(WEAPONS).filter(([id, w]) => w.range === range && w.type !== 'utility');
    if (options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)][0];
}

const WEAPON_RANGE_UNITS = { close: 8, middle: 25, long: 50 };

// Reusable raycasters and vectors to avoid per-frame allocations
const _losRay = new THREE.Raycaster();
const _losDir = new THREE.Vector3();
const _floorRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
const _floorOrigin = new THREE.Vector3();
const _collPos = new THREE.Vector3(); // reusable for checkZombieCollision calls

let _losMeshes = [];
let _losMeshesLen = -1;
function hasLineOfSight(from, to) {
    if (obstacles.length !== _losMeshesLen) {
        _losMeshes = obstacles.filter(o => o.mesh).map(o => o.mesh);
        _losMeshesLen = obstacles.length;
    }
    _losDir.subVectors(to, from).normalize();
    _losRay.set(from, _losDir);
    const distToTarget = from.distanceTo(to);
    const hits = _losRay.intersectObjects(_losMeshes, true);
    if (hits.length === 0) return true;
    return hits[0].distance > distToTarget - 0.5;
}

export function killZombie(z, idx, isExplosive = false) {
    if (z.dead) return;
    z.dead = true; z.hp = 0;
    if (gameState.mode === 'zombie') {
        gameState.zombieTotalKills = (gameState.zombieTotalKills || 0) + 1;
        gameState.zombieKillCredit = (gameState.zombieKillCredit || 0) + 1;
        if (gameState.zombieKillCredit >= 2) {
            gameState.zombieKillCredit -= 2;
            gameState.zombiesToSpawn += 3;
        }
        document.getElementById('wave-hud').textContent = `Kills: ${gameState.zombieTotalKills}`;
        const sessionKills = gameState.zombieTotalKills;
        if (sessionKills > (playerData.bestZombieSession || 0)) playerData.bestZombieSession = sessionKills;
    }
    playerData.totalZombieKills = (playerData.totalZombieKills || 0) + 1;
    playerData.totalMoneyEarned = (playerData.totalMoneyEarned || 0) + z.dropMoney;
    if (isExplosive) playerData.totalExplosiveKills = (playerData.totalExplosiveKills || 0) + 1;
    if (z.isApex) playerData.apexKills = (playerData.apexKills || 0) + 1;
    if (z.isGiga) playerData.gigaKills = (playerData.gigaKills || 0) + 1;
    playerData.money += z.dropMoney;
    if (z.hpSprite) { z.mesh.remove(z.hpSprite); z.hpSprite = null; }
    if (z.weaponId) dropWeapon(z.weaponId, z.mesh.position.clone());

    if (Math.random() < 0.03) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
        mesh.position.copy(z.mesh.position);
        mesh.position.y = 0.25;
        scene.add(mesh);
        gameState.ammoPickups.push({ mesh, collected: false, isMedkit: true });
    }

    const killLabel = z.isApex ? 'APEX ZOMBIE SLAIN!' : (z.isGiga ? 'GIGA ZOMBIE SLAIN!' : (z.isBoss ? 'Boss Zombie' : 'Zombie'));
    const killColor = z.isApex ? '#ffaa00' : (z.isGiga ? '#ff00ff' : '#fff');
    addKillFeed(killLabel, killColor);
    const xp = z.isApex ? (300 + (playerData.level - 1) * 50) : (z.isGiga ? 200 : z.isBoss ? 50 : (gameState.mode === 'rescue' ? 15 : 10));
    awardXP(xp);
    savePlayerData();
    checkAchievements();
}

function checkZombieCollision(pos, radius) {
    const pMinY = pos.y;
    const pMaxY = pos.y + 1.8;

    for (const obs of obstacles) {
        if (obs.isSlope || obs.isRimRubble) continue;
        if (obs.box) {
            const b = obs.box;
            // Quick XZ distance cull before full AABB test
            const cx = (b.min.x + b.max.x) * 0.5;
            const cz = (b.min.z + b.max.z) * 0.5;
            const dx = pos.x - cx, dz = pos.z - cz;
            const hw = (b.max.x - b.min.x) * 0.5 + radius + 1;
            const hd = (b.max.z - b.min.z) * 0.5 + radius + 1;
            if (dx * dx > hw * hw || dz * dz > hd * hd) continue;
            if (pos.x + radius > b.min.x && pos.x - radius < b.max.x &&
                pos.z + radius > b.min.z && pos.z - radius < b.max.z) {
                if (pMinY < b.max.y && pMaxY > b.min.y) return true;
            }
        } else if (obs.radius) {
            const dx = pos.x - obs.mesh.position.x;
            const dz = pos.z - obs.mesh.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < obs.radius + radius) return true;
        }
    }
    return false;
}

/** Try many headings around desired angle; pick one that clears obstacles and gets closest to the player. */
function computeZombieSteer(cx, cz, px, pz, baseAngle, radius, step) {
    const toPx = px - cx;
    const toPz = pz - cz;
    const dist0 = Math.hypot(toPx, toPz);
    if (dist0 < 0.01) return { mx: 0, mz: 0 };

    const idealSin = Math.sin(baseAngle);
    const idealCos = Math.cos(baseAngle);
    const stepVec = new THREE.Vector3();

    const tryStep = (scale) => {
        let bestMx = 0, bestMz = 0, bestScore = -1e9;
        for (const off of ZOMBIE_STEER_OFFSETS) {
            const ang = baseAngle + off;
            const mx = Math.sin(ang) * step * scale;
            const mz = Math.cos(ang) * step * scale;
            const nx = cx + mx, nz = cz + mz;
            stepVec.set(nx, 1, nz);
            if (checkZombieCollision(stepVec, radius)) continue;

            const nd = Math.hypot(px - nx, pz - nz);
            const closer = dist0 - nd;
            const mag = Math.hypot(mx, mz) || 1;
            const align = (idealSin * mx + idealCos * mz) / mag;
            const score = closer * 5 + align * step * scale;
            if (score > bestScore) {
                bestScore = score;
                bestMx = mx;
                bestMz = mz;
            }
        }
        if (bestScore > -1e8) return { mx: bestMx, mz: bestMz };
        return null;
    };

    let out = tryStep(1);
    if (!out) out = tryStep(0.55);
    if (!out) out = tryStep(0.3);
    return out || { mx: 0, mz: 0 };
}

/** Radians: straight at target first, then shallow dodges, then 90° for sliding along walls. */
const ZOMBIE_STEER_OFFSETS = [
    0,
    0.3, -0.3, 0.55, -0.55, 0.85, -0.85,
    1.15, -1.15, 1.45, -1.45,
    Math.PI / 2, -Math.PI / 2,
    1.8, -1.8, 2.15, -2.15,
    Math.PI * 0.72, -Math.PI * 0.72,
    Math.PI * 0.85, -Math.PI * 0.85,
];

function updateSquads() {
    const squads = gameState.hiveMind.squads;
    const playerPos = camera.position;

    // Clear commandedSquads on dead commanders to free their squads
    for (const z of gameState.zombieEntities) {
        if ((z.isGiga || z.isApex) && z.dead && z.commandedSquads && z.commandedSquads.length > 0) {
            for (const squadId of z.commandedSquads) {
                const sq = squads.find(s => s.id === squadId);
                if (sq) sq.commanderId = null;
            }
            z.commandedSquads = [];
        }
    }

    for (let si = squads.length - 1; si >= 0; si--) {
        const squad = squads[si];

        // Prune dead members
        squad.members = squad.members.filter(m => !m.dead);

        if (squad.members.length === 0) {
            squads.splice(si, 1);
            continue;
        }

        // Promote new leader if current one died
        let currentLeader = squad.members.find(m => m.squadRole === 'leader');
        if (!currentLeader) {
            squad.members[0].squadRole = 'leader';
            squad.leaderId = squad.members[0].mesh.uuid;
            currentLeader = squad.members[0];
        }

        // Try to merge a 1-member squad into another
        if (squad.members.length === 1) {
            const loner = squad.members[0];
            let merged = false;
            for (const other of squads) {
                if (other === squad || other.members.length >= 10 || !other.leaderId) continue;
                const ref = other.members[0];
                if (!ref || ref.dead) continue;
                const ddx = ref.mesh.position.x - loner.mesh.position.x;
                const ddz = ref.mesh.position.z - loner.mesh.position.z;
                if (Math.sqrt(ddx * ddx + ddz * ddz) < 50) {
                    const roleIndex = other.members.length - 1;
                    loner.squadRole = _ROLE_SLOTS[Math.min(roleIndex, _ROLE_SLOTS.length - 1)];
                    loner.squadId = other.id;
                    other.members.push(loner);
                    addSquadNameSprite(loner, other.name);
                    squads.splice(si, 1);
                    merged = true;
                    break;
                }
            }
            if (merged) continue;
        }

        // State machine
        const leaderPos = currentLeader.mesh.position;
        const leaderDist = Math.sqrt(
            (playerPos.x - leaderPos.x) ** 2 + (playerPos.z - leaderPos.z) ** 2
        );

        if (squad.state === 'assembling') {
            if (squad.members.some(m => m.attracted)) {
                squad.members.forEach(m => { m.attracted = true; });
                squad.state = 'approaching';
            }
            // Dynamic recruitment: every 2s pull in nearby squadless zombies
            squad._recruitTimer = (squad._recruitTimer || 0) + 1;
            if (squad._recruitTimer >= 120 && squad.members.length < 10) {
                squad._recruitTimer = 0;
                for (const z of gameState.zombieEntities) {
                    if (squad.members.length >= 10) break;
                    if (z.dead || z.squadId !== undefined || z.isBoss || z.isGiga || z.isApex) continue;
                    let near = false;
                    for (const m of squad.members) {
                        const ddx = z.mesh.position.x - m.mesh.position.x;
                        const ddz = z.mesh.position.z - m.mesh.position.z;
                        if (ddx * ddx + ddz * ddz <= 3600) { near = true; break; } // 60 units
                    }
                    if (near) {
                        const roleIndex = squad.members.length - 1;
                        z.squadRole = _ROLE_SLOTS[Math.min(roleIndex, _ROLE_SLOTS.length - 1)];
                        z.squadId = squad.id;
                        squad.members.push(z);
                        addSquadNameSprite(z, squad.name);
                    }
                }
            }
        } else if (squad.state === 'approaching') {
            if (leaderDist < 18) {
                squad.state = 'executing';
                squad.members.forEach(m => {
                    m.mesh.traverse(c => { if (c.material) c.material.emissiveIntensity = 1.5; });
                    setTimeout(() => m.mesh.traverse(c => { if (c.material) c.material.emissiveIntensity = 0; }), 500);
                });
            }
        } else if (squad.state === 'executing') {
            const allFar = squad.members.every(m => {
                const ddx = playerPos.x - m.mesh.position.x;
                const ddz = playerPos.z - m.mesh.position.z;
                return Math.sqrt(ddx * ddx + ddz * ddz) > 30;
            });
            if (allFar) squad.state = 'approaching';
        }

        // Set squad move angles for executing members
        if (squad.state === 'executing') {
            const ldx = playerPos.x - leaderPos.x;
            const ldz = playerPos.z - leaderPos.z;
            const playerAngle = Math.atan2(ldx, ldz);
            for (const m of squad.members) {
                if (m.dead) continue;
                switch (m.squadRole) {
                    case 'leader':
                    case 'charger':
                        m._squadMoveAngle = playerAngle;
                        break;
                    case 'flanker_l':
                        m._squadMoveAngle = playerAngle + Math.PI / 2;
                        break;
                    case 'flanker_r':
                        m._squadMoveAngle = playerAngle - Math.PI / 2;
                        break;
                    case 'support': {
                        const sdx = playerPos.x - m.mesh.position.x;
                        const sdz = playerPos.z - m.mesh.position.z;
                        if (Math.sqrt(sdx * sdx + sdz * sdz) > 25) {
                            m._holdPosition = true;
                        } else {
                            m._squadMoveAngle = playerAngle;
                        }
                        break;
                    }
                }
            }
        }
    }

    // Commander broadcast: when Giga/Apex engages player, activate all commanded squads
    for (const z of gameState.zombieEntities) {
        if (!(z.isGiga || z.isApex) || z.dead || !z.attracted || !z.commandedSquads) continue;
        let didBroadcast = false;
        for (const squadId of z.commandedSquads) {
            const sq = squads.find(s => s.id === squadId);
            if (sq && sq.state === 'assembling') {
                sq.members.forEach(m => { m.attracted = true; });
                sq.state = 'approaching';
                didBroadcast = true;
            }
        }
        if (didBroadcast && !z._broadcastPulsed) {
            z._broadcastPulsed = true;
            z.mesh.traverse(c => { if (c.material) c.material.emissiveIntensity = 3.0; });
            const resetIntensity = z.isApex ? 0.7 : 0;
            setTimeout(() => {
                z.mesh.traverse(c => { if (c.material) c.material.emissiveIntensity = resetIntensity; });
                z._broadcastPulsed = false;
            }, 1000);
        }
    }
}

export function updateZombies(dt) {
    const playerPos = camera.position;

    // Spawn
    if (gameState.zombiesToSpawn > 0) {
        gameState.zombieSpawnTimer -= dt;
        if (gameState.zombieSpawnTimer <= 0) {
            const kills = gameState.zombieTotalKills || 0;
            const rawGigaChance = gameState.mode === 'zombie' ? Math.floor(kills / 20) * 0.01 : 0;
            const guaranteedGigas = Math.floor(rawGigaChance);
            const extraGigaChance = rawGigaChance - guaranteedGigas;
            const gigaCount = guaranteedGigas + (Math.random() < extraGigaChance ? 1 : 0);
            const apexChance = (gameState.mode === 'zombie' && playerData.level >= 3 && kills >= 35) ? Math.min(0.05, (playerData.level - 2) * 0.005) : 0;
            if (gigaCount > 0 && Math.random() < apexChance) {
                spawnZombie(false, false, null, true);
            } else if (gigaCount > 0) {
                for (let g = 0; g < gigaCount; g++) spawnZombie(false, true);
            } else {
                let isBoss = kills >= 20 && Math.random() < Math.min(0.3, 0.08 + kills * 0.003);
                if (!isBoss && gameState.mode === 'zombie' && gameState.hiveMind.squads.length < 2) isBoss = true;
                spawnZombie(isBoss, false);
            }
            gameState.zombiesToSpawn--;
            gameState.zombieSpawnTimer = gameState.mode === 'rescue' ? 0.15 : (gameState.mode === 'zombie' ? 0.32 : 0.5);
        }
    }

    // No wave system in zombie mode — 3 new zombies spawn per 2 kills (handled in killZombie)

    updateSquads();

    // Cache obstacle meshes across frames — only rebuild when obstacle count changes
    if (!updateZombies._rayMeshes || updateZombies._rayMeshLen !== obstacles.length) {
        updateZombies._rayMeshes = obstacles.filter(o => o.mesh).map(o => o.mesh)
            .concat(gameState.slopeMeshes || []);
        updateZombies._rayMeshLen = obstacles.length;
    }
    const zRayMeshes = updateZombies._rayMeshes;

    // Night scaling: dayFactor=1 at noon, 0 at midnight. Up to +50% speed and +40% damage at night.
    const dayFactor = Math.max(0, Math.sin(gameState.dayTime * Math.PI * 2 - Math.PI / 2));
    const nightFactor = 1 - dayFactor;
    const nightSpeedMult = 1 + nightFactor * 0.5;
    const nightDamageMult = 1 + nightFactor * 0.4;

    for (let i = gameState.zombieEntities.length - 1; i >= 0; i--) {
        const z = gameState.zombieEntities[i];
        if (z.dead) {
            z.mesh.rotation.x -= dt * 3;
            if (z.mesh.rotation.x <= -Math.PI / 2) {
                z.mesh.position.y -= dt * 2;
                if (z.mesh.position.y < -1) {
                    scene.remove(z.mesh);
                    gameState.zombieEntities.splice(i, 1);
                    gameState.zombiesAlive--;
                }
            }
            continue;
        }

        const dx = playerPos.x - z.mesh.position.x;
        const dz = playerPos.z - z.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const vertDist = Math.abs(playerPos.y - z.mesh.position.y);
        const canReachPlayer = vertDist < 2.5;

        let stopDist = z.isApex ? 4.0 : (z.isGiga ? 3.5 : 1.5);
        let attackDist = z.attackDist || 2;
        let weaponDamage = z.damage;
        const wDef = (z.weaponId && WEAPONS[z.weaponId]) ? WEAPONS[z.weaponId] : null;
        const useWeapon = wDef && (wDef.type === 'gun' || wDef.type === 'melee');
        if (useWeapon) {
            if (wDef.type === 'gun') {
                stopDist = WEAPON_RANGE_UNITS[wDef.range] || 25;
                attackDist = stopDist;
                weaponDamage = wDef.damage;
            } else if (wDef.type === 'melee') {
                stopDist = wDef.reach || 2;
                attackDist = stopDist;
                weaponDamage = wDef.damage;
            }
        }
        if (playerState.weapons[playerState.currentWeaponIndex] === 'shield') stopDist = Math.max(stopDist, 2.5);

        // Gravity & Raycast Floor Tracking — throttled: each zombie updates every 3 frames
        if (!z._floorFrame) z._floorFrame = i % 3;
        z._floorFrame = (z._floorFrame + 1) % 3;
        if (z._floorFrame === 0) {
            // Start ray well above zombie so it works even if partially underground
            _floorOrigin.set(z.mesh.position.x, z.mesh.position.y + 6, z.mesh.position.z);
            _floorRay.set(_floorOrigin, _floorRay.ray.direction);
            const zHits = _floorRay.intersectObjects(zRayMeshes);
            z._cachedFloorY = zHits.length > 0 ? zHits[0].point.y : 0;
        }
        // Apply floor snap / jump physics
        const cachedFloor = z._cachedFloorY ?? 0;
        if (z._airborne) {
            z.vy -= 30 * dt;
            z.mesh.position.y += z.vy * dt;
            if (z.mesh.position.y <= cachedFloor) {
                z.mesh.position.y = cachedFloor;
                z.vy = 0;
                z._airborne = false;
            }
        } else {
            if (z.mesh.position.y > cachedFloor + 0.05) {
                z.mesh.position.y -= 15 * dt;
                if (z.mesh.position.y < cachedFloor) z.mesh.position.y = cachedFloor;
            } else {
                z.mesh.position.y += (cachedFloor - z.mesh.position.y) * Math.min(1, dt * 10);
            }
        }
        if (z.mesh.position.y < cachedFloor) z.mesh.position.y = cachedFloor;

        // Apex zombie in rescue mode: proactively jump over mountains/slopes ahead
        if (z.isApex && gameState.mode === 'rescue' && !z._airborne) {
            z._apexJumpTimer = (z._apexJumpTimer || 0) - dt;
            if (z._apexJumpTimer <= 0) {
                z._apexJumpTimer = 0.25; // check 4× per second
                const toPlayerX = playerPos.x - z.mesh.position.x;
                const toPlayerZ = playerPos.z - z.mesh.position.z;
                const toDist = Math.sqrt(toPlayerX * toPlayerX + toPlayerZ * toPlayerZ);
                if (toDist > 2) {
                    const dirX = toPlayerX / toDist;
                    const dirZ = toPlayerZ / toDist;
                    const slopeMeshes = gameState.slopeMeshes || [];
                    const _apexRay = new THREE.Raycaster();
                    let maxAheadFloor = cachedFloor;
                    for (const lookAhead of [3, 6, 9]) {
                        const sx = z.mesh.position.x + dirX * lookAhead;
                        const sz = z.mesh.position.z + dirZ * lookAhead;
                        _apexRay.set(new THREE.Vector3(sx, z.mesh.position.y + 20, sz), new THREE.Vector3(0, -1, 0));
                        const hits = _apexRay.intersectObjects(slopeMeshes);
                        if (hits.length > 0) maxAheadFloor = Math.max(maxAheadFloor, hits[0].point.y);
                    }
                    const riseNeeded = maxAheadFloor - z.mesh.position.y;
                    if (riseNeeded > 1.0) {
                        // Jump high enough to clear the peak with 1.5 unit clearance
                        z.vy = Math.sqrt(2 * 30 * (riseNeeded + 1.5));
                        z._airborne = true;
                        z._apexJumpTimer = 1.0; // cooldown after jumping
                    }
                }
            }
        }

        // AI state — always player-focused (no "cover" toward buildings)
        z.aiTimer -= dt;
        if (z.aiTimer <= 0) {
            const r = Math.random();
            if (r < 0.1 && dist > 14) {
                z.aiState = 'flank';
                z.flankAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 6 + Math.random() * Math.PI / 10);
            } else if (r < 0.1 && dist > 5 && dist < 14) {
                z.aiState = 'strafe';
                z.strafeDir = Math.random() > 0.5 ? 1 : -1;
            } else {
                z.aiState = 'charge';
            }
            z.aiTimer = 0.7 + Math.random() * 1.2;
            z.prevHp = z.hp;
        }

        // Auto-attract if player is very close or in line of sight (throttled)
        if (gameState.mode === 'zombie' && !z.attracted) {
            if (dist < 4) {
                z.attracted = true;
                z.speed *= 1.5;
            } else if (dist < 20) {
                z._losTimer = (z._losTimer || 0) + 1;
                if (z._losTimer >= 10) {
                    z._losTimer = 0;
                    const eyePos = new THREE.Vector3(z.mesh.position.x, z.mesh.position.y + 1.5, z.mesh.position.z);
                    if (hasLineOfSight(eyePos, playerPos)) {
                        z.attracted = true;
                        z.speed *= 1.5;
                    }
                }
            }
        }

        // Movement: wander if not attracted (zombie mode), else chase player
        const isWandering = gameState.mode === 'zombie' && !z.attracted;
        if (isWandering) {
            z.wanderTimer -= dt;
            if (z.wanderTimer <= 0) {
                z.wanderAngle += (Math.random() - 0.5) * Math.PI;
                z.wanderTimer = 1.5 + Math.random() * 2;
            }
            const wanderSpeed = z.speed * 0.3;
            const wanderZR = z.zombieRadius || (z.isBoss ? 0.7 : 0.5);
            const nx = z.mesh.position.x + Math.sin(z.wanderAngle) * wanderSpeed * dt;
            const nz = z.mesh.position.z + Math.cos(z.wanderAngle) * wanderSpeed * dt;
            if (!checkZombieCollision(_collPos.set(nx, z.mesh.position.y, nz), wanderZR)) {
                z.mesh.position.x = nx;
                z.mesh.position.z = nz;
            } else {
                z.wanderAngle += Math.PI * (0.5 + Math.random() * 0.5);
            }
            z.mesh.rotation.y = z.wanderAngle;
        } else if (dist > stopDist && !z._holdPosition) {
            const zombieRadius = z.zombieRadius || (z.isBoss ? 0.7 : 0.5);
            let moveAngle = Math.atan2(dx, dz);

            const hasSquadAngle = z._squadMoveAngle !== undefined;
            if (hasSquadAngle) {
                moveAngle = z._squadMoveAngle;
                if (z.squadRole === 'charger') z.aiState = 'charge';
                delete z._squadMoveAngle;
            }

            if (!hasSquadAngle) {
                if (z.aiState === 'flank') {
                    const blendFactor = Math.min(1, dist / 16);
                    moveAngle += z.flankAngle * blendFactor;
                } else if (z.aiState === 'strafe') {
                    const perpAngle = moveAngle + Math.PI / 2 * z.strafeDir;
                    const blendFactor = dist > 11 ? 0.22 : 0.42;
                    moveAngle = moveAngle * (1 - blendFactor) + perpAngle * blendFactor;
                }
            }

            const step = z.speed * nightSpeedMult * dt;

            if (z._airborne) {
                // Airborne — move freely toward player, no horizontal collision check
                z.mesh.position.x += Math.sin(moveAngle) * step;
                z.mesh.position.z += Math.cos(moveAngle) * step;
            } else {
                const steer = computeZombieSteer(
                    z.mesh.position.x, z.mesh.position.z,
                    playerPos.x, playerPos.z,
                    moveAngle, zombieRadius, step
                );
                z.mesh.position.x += steer.mx;
                z.mesh.position.z += steer.mz;

                // Dead-end escape: jump if obstacle is low enough, else flank
                const movedSq = steer.mx * steer.mx + steer.mz * steer.mz;
                if (movedSq < 1e-10) {
                    z.stuckTimer = (z.stuckTimer || 0) + dt;
                    if (z.stuckTimer > 0.15) {
                        const checkX = z.mesh.position.x + Math.sin(moveAngle) * 1.5;
                        const checkZ = z.mesh.position.z + Math.cos(moveAngle) * 1.5;
                        const zombieFeet = z.mesh.position.y;
                        let blockTop = -1;
                        for (const obs of obstacles) {
                            if (obs.isSlope || obs.isRimRubble || !obs.box) continue;
                            const b = obs.box;
                            if (checkX + zombieRadius > b.min.x && checkX - zombieRadius < b.max.x &&
                                checkZ + zombieRadius > b.min.z && checkZ - zombieRadius < b.max.z &&
                                b.max.y > zombieFeet && b.min.y < zombieFeet + 2.5) {
                                blockTop = Math.max(blockTop, b.max.y);
                            }
                        }
                        if (blockTop > zombieFeet && blockTop - zombieFeet <= 2.5) {
                            const clearH = blockTop - zombieFeet + 0.5;
                            z.vy = Math.sqrt(2 * 30 * clearH);
                            z._airborne = true;
                            z.stuckTimer = 0;
                        } else if (z.stuckTimer > 0.2) {
                            z.flankAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2 + Math.random() * 0.35);
                            z.aiState = 'flank';
                            z.aiTimer = 0.4;
                            z.stuckTimer = 0;
                        }
                    }
                } else {
                    z.stuckTimer = 0;
                }
            }

            z.mesh.rotation.y = Math.atan2(dx, dz);
        }
        if (z._holdPosition) z._holdPosition = false;

        // Anim
        const walkPhase = Date.now() * 0.006 + i * 1.7;
        const isInCombat = !isWandering && canReachPlayer && dist < attackDist;
        const lArm = z.mesh.children[2]; // shoulder group
        const rArm = z.mesh.children[3];
        const lFore = lArm.children[1];  // elbow group
        const rFore = rArm.children[1];

        if (isInCombat && useWeapon && wDef.type === 'gun') {
            // Right arm aims forward, left arm raised as support — both elbows bent
            lArm.rotation.x = -0.4; lArm.rotation.z = 0.3; lArm.rotation.y = 0;
            rArm.rotation.x = -1.1; rArm.rotation.z = -0.12; rArm.rotation.y = 0;
            lFore.rotation.x = 0.55; // support elbow bent inward
            rFore.rotation.x = 0.15; // trigger elbow nearly straight
            z.mesh.children[0].rotation.z = 0;
            z.mesh.children[0].rotation.x = -0.1;
            z.mesh.children[1].rotation.x = 0;
        } else if (isInCombat && (!useWeapon || (wDef && wDef.type === 'melee'))) {
            const punchPhase = (Date.now() * 0.008) % (Math.PI * 2);
            const punchA = Math.sin(punchPhase);
            const punchB = Math.sin(punchPhase + Math.PI);
            // Shoulders alternate hard forward punches
            lArm.rotation.x = -Math.PI * 0.8 * Math.max(0, punchA) - 0.2;
            rArm.rotation.x = -Math.PI * 0.8 * Math.max(0, punchB) - 0.2;
            lArm.rotation.y = 0; rArm.rotation.y = 0;
            // Elbows: extend on forward punch, bend sharply on backswing
            lFore.rotation.x = 0.35 + 0.5 * Math.max(0, -punchA);
            rFore.rotation.x = 0.35 + 0.5 * Math.max(0, -punchB);
            // Arms flare outward on backswing
            lArm.rotation.z = 0.18 + 0.3 * Math.max(0, -punchA);
            rArm.rotation.z = -0.18 - 0.3 * Math.max(0, -punchB);
            // Body rocks and lunges
            z.mesh.children[0].rotation.z = Math.sin(punchPhase) * 0.2;
            z.mesh.children[0].rotation.x = -0.15 + Math.abs(Math.sin(punchPhase)) * 0.25;
            z.mesh.children[1].rotation.x = 0.2 + Math.abs(Math.sin(punchPhase)) * 0.3;
        } else {
            // Walk — arms slightly raised forward (classic zombie reach), elbows naturally bent
            const forwardLift = isWandering ? 0.05 : 0.3;
            lArm.rotation.x = -forwardLift + Math.sin(walkPhase) * 0.55;
            rArm.rotation.x = -forwardLift + Math.sin(walkPhase + Math.PI) * 0.55;
            lArm.rotation.z = 0.18; rArm.rotation.z = -0.18;
            lArm.rotation.y = 0; rArm.rotation.y = 0;
            // Elbow bends on the backswing, relaxes on the forward swing
            lFore.rotation.x = 0.2 + Math.max(0, -Math.sin(walkPhase)) * 0.25;
            rFore.rotation.x = 0.2 + Math.max(0, -Math.sin(walkPhase + Math.PI)) * 0.25;
            z.mesh.children[0].rotation.z = Math.sin(walkPhase * 0.5) * 0.05;
            z.mesh.children[0].rotation.x = 0;
            z.mesh.children[1].rotation.x = 0;
        }

        z.mesh.children[4].rotation.x = Math.sin(walkPhase + Math.PI) * 0.5;
        z.mesh.children[5].rotation.x = Math.sin(walkPhase) * 0.5;
        if (!isInCombat || (useWeapon && wDef && wDef.type === 'gun')) {
            z.mesh.children[0].rotation.z = Math.sin(walkPhase * 0.5) * 0.05;
            z.mesh.children[1].rotation.z = Math.sin(walkPhase * 0.7) * 0.1;
        }

        if (z.hpCtx && z.hp !== z._lastRenderedHp) {
            z._lastRenderedHp = z.hp;
            z.hpCtx.clearRect(0, 0, 64, 16);
            z.hpCtx.fillStyle = '#ff0000';
            z.hpCtx.fillRect(0, 0, 64 * (z.hp / z.maxHp), 16);
            z.hpTex.needsUpdate = true;
        }

        // Attack (melee or ranged) — wandering zombies don't attack
        if (!isWandering && canReachPlayer && dist < attackDist) {
            z.attackCooldown -= dt;
            if (z.attackCooldown <= 0) {
                const eyePos = new THREE.Vector3(z.mesh.position.x, z.mesh.position.y + 1.5, z.mesh.position.z);
                if (useWeapon && wDef.type === 'gun') {
                    if (hasLineOfSight(eyePos, camera.position)) {
                        damagePlayer(Math.floor(weaponDamage * nightDamageMult * (0.8 + Math.random() * 0.4)), z.mesh.position);
                        playGunshot();
                        z.attackCooldown = 1 / (wDef.fireRate || 0.5);
                    }
                } else {
                    if (hasLineOfSight(eyePos, camera.position)) {
                        damagePlayer(Math.floor(weaponDamage * nightDamageMult), z.mesh.position);
                    }
                    z.attackCooldown = useWeapon && wDef.type === 'melee' ? (1 / (wDef.fireRate || 0.5)) : 1;
                }
            }
        }

        // Fire zone damage
        for (const fz of gameState.fireZones) {
            if (z.mesh.position.distanceTo(fz.position) < fz.radius) {
                z.hp -= fz.dps * dt;
                if (z.hp <= 0) { killZombie(z, i); break; }
            }
        }
    }
}

export function attractZombies(pos, radius) {
    for (const z of gameState.zombieEntities) {
        if (z.hp > 0 && z.mesh.position.distanceTo(pos) < radius) {
            if (!z.attracted) {
                z.attracted = true;
                z.speed *= 1.5;
            }
        }
    }
}

// --- PvP Enemy ---

export function spawnPvPEnemy() {
    if (gameState.pvpEnemy?.mesh) scene.remove(gameState.pvpEnemy.mesh);

    const mapSize = MAPS[gameState.currentMap].size;
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0xcc4444 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.4), mat);
    body.position.y = 1; body.castShadow = true; group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), mat);
    head.position.y = 1.7; head.castShadow = true; group.add(head);

    const armMat = new THREE.MeshStandardMaterial({ color: 0xaa3333 });
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.15), armMat);
    lArm.position.set(-0.4, 0.9, 0); group.add(lArm);
    const rArm = lArm.clone(); rArm.position.x = 0.4; group.add(rArm);

    let spawnX = (Math.random() - 0.5) * mapSize * 0.8;
    let spawnZ = (Math.random() - 0.5) * mapSize * 0.8;
    let spawnY = 0;
    const spawnRay = new THREE.Raycaster(new THREE.Vector3(spawnX, 100, spawnZ), new THREE.Vector3(0, -1, 0));
    const hits = spawnRay.intersectObjects(obstacles.filter(o => o.mesh).map(o => o.mesh));
    if (hits.length > 0) spawnY = hits[0].point.y;

    group.position.set(spawnX, spawnY, spawnZ);
    scene.add(group);

    gameState.pvpEnemy = {
        mesh: group, hp: 100, maxHp: 100,
        speed: 4, damage: 5, attackCooldown: 0,
        strafeDir: 1, strafeTimer: 0, shootCooldown: 0
    };
}

export function updatePvPEnemy(dt) {
    const e = gameState.pvpEnemy;
    if (!e || e.hp <= 0) return;

    const playerPos = camera.position;
    const dx = playerPos.x - e.mesh.position.x;
    const dz = playerPos.z - e.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    e.mesh.rotation.y = Math.atan2(dx, dz);

    // Strafe timing
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
        e.strafeDir = Math.random() > 0.5 ? 1 : -1;
        e.strafeTimer = 1 + Math.random() * 2;
    }

    // Movement
    if (dist > 8) {
        const nx = e.mesh.position.x + (dx / dist) * e.speed * dt;
        const nz = e.mesh.position.z + (dz / dist) * e.speed * dt;
        if (!checkZombieCollision(_collPos.set(nx, e.mesh.position.y, nz), 0.4)) {
            e.mesh.position.x = nx;
            e.mesh.position.z = nz;
        }
    } else if (dist < 4) {
        const nx = e.mesh.position.x - (dx / dist) * e.speed * 0.5 * dt;
        const nz = e.mesh.position.z - (dz / dist) * e.speed * 0.5 * dt;
        if (!checkZombieCollision(_collPos.set(nx, e.mesh.position.y, nz), 0.4)) {
            e.mesh.position.x = nx;
            e.mesh.position.z = nz;
        }
    }
    const perpX = -dz / dist, perpZ = dx / dist;
    const sx = e.mesh.position.x + perpX * e.strafeDir * e.speed * 0.5 * dt;
    const sz = e.mesh.position.z + perpZ * e.strafeDir * e.speed * 0.5 * dt;
    if (!checkZombieCollision(_collPos.set(sx, e.mesh.position.y, sz), 0.4)) {
        e.mesh.position.x = sx;
        e.mesh.position.z = sz;
    }

    // Clamp to map
    const size = MAPS[gameState.currentMap].size * 0.95;
    e.mesh.position.x = Math.max(-size, Math.min(size, e.mesh.position.x));
    e.mesh.position.z = Math.max(-size, Math.min(size, e.mesh.position.z));

    const eRay = new THREE.Raycaster(new THREE.Vector3(e.mesh.position.x, e.mesh.position.y + 2, e.mesh.position.z), new THREE.Vector3(0, -1, 0));
    const eHits = eRay.intersectObjects([
        ...obstacles.filter(o => o.mesh).map(o => o.mesh),
        ...(gameState.slopeMeshes || [])
    ]);
    if (eHits.length > 0 && eHits[0].distance < 4) {
        e.mesh.position.y += (eHits[0].point.y - e.mesh.position.y) * dt * 10;
    } else if (eHits.length > 0) {
        e.mesh.position.y -= 15 * dt;
        if (e.mesh.position.y < eHits[0].point.y) e.mesh.position.y = eHits[0].point.y;
    } else {
        e.mesh.position.y -= 15 * dt;
        if (e.mesh.position.y < 0) e.mesh.position.y = 0;
    }

    // Shoot
    e.shootCooldown -= dt;
    if (e.shootCooldown <= 0 && dist < 30) {
        if (Math.random() < 0.3) damagePlayer(e.damage, e.mesh.position);
        e.shootCooldown = 0.5 + Math.random() * 0.5;
        playGunshot();
    }

    // Arm animation
    e.mesh.children[2].rotation.x = Math.sin(Date.now() * 0.003) * 0.2;
    e.mesh.children[3].rotation.x = Math.sin(Date.now() * 0.003 + Math.PI) * 0.2;
}
