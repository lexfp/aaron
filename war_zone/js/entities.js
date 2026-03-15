// Zombie and PvP enemy spawning, AI, and updates

import * as THREE from 'three';
import { WEAPONS, MAPS } from './data.js';
import { playerData, playerState, savePlayerData, gameState } from './state.js';
import { scene, camera, obstacles } from './engine.js';
import { playGunshot } from './audio.js';
import { addKillFeed, updateHUD, showRoundOverlay } from './ui.js';
import { dropWeapon } from './weapons.js';
import { damagePlayer, checkPvPEnd } from './combat.js';

// --- Zombies ---

export function spawnZombie(isBoss) {
    const mapSize = MAPS[gameState.currentMap].size;
    const angle = Math.random() * Math.PI * 2;
    const dist = mapSize * 0.7 + Math.random() * mapSize * 0.2;

    let hp, damage, dropMoney, weaponId = null;
    const bodySize = isBoss ? 1.2 : 0.9;

    if (isBoss) {
        hp = 75; damage = 20; dropMoney = 10;
        const r = Math.random() * 100;
        if (r < 0.01) weaponId = pickRandomWeapon('long');
        else if (r < 5.01) weaponId = pickRandomWeapon('middle');
        else if (r < 15.01) weaponId = pickRandomWeapon('close');
    } else {
        hp = 25; damage = 5; dropMoney = 1;
        if (Math.random() * 100 < 5) weaponId = pickRandomWeapon('close');
    }

    const group = new THREE.Group();
    const skinColor = isBoss ? 0x880044 : [0x445533, 0x3a5530, 0x504a38, 0x3d4a33][Math.floor(Math.random() * 4)];
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

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.15, bodySize * 0.7, bodySize * 0.15), shirtMat);
    leftArm.position.set(-bodySize * 0.4, bodySize * 0.7, 0); group.add(leftArm);
    const rightArm = leftArm.clone(); rightArm.position.x = bodySize * 0.4; group.add(rightArm);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.18, bodySize * 0.5, bodySize * 0.18), pantMat);
    leftLeg.position.set(-bodySize * 0.15, bodySize * 0.25, 0); group.add(leftLeg);
    const rightLeg = leftLeg.clone(); rightLeg.position.x = bodySize * 0.15; group.add(rightLeg);

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

    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    scene.add(group);

    gameState.zombieEntities.push({
        mesh: group, hp, maxHp: hp, damage, dropMoney, isBoss,
        weaponId, speed: isBoss ? 2.5 : 3.5, attackCooldown: 0,
        lastNoiseCheck: 0, attracted: false
    });
    gameState.zombiesAlive++;
}

function pickRandomWeapon(range) {
    const options = Object.entries(WEAPONS).filter(([id, w]) => w.range === range);
    if (options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)][0];
}

export function killZombie(z, idx) {
    scene.remove(z.mesh);
    playerData.money += z.dropMoney;
    if (z.weaponId) dropWeapon(z.weaponId, z.mesh.position.clone());
    gameState.zombieEntities.splice(idx, 1);
    gameState.zombiesAlive--;
    addKillFeed(z.isBoss ? 'Boss Zombie' : 'Zombie');
    savePlayerData();
}

function checkZombieCollision(pos, radius) {
    for (const obs of obstacles) {
        if (obs.box) {
            const expanded = obs.box.clone().expandByScalar(radius);
            if (expanded.containsPoint(new THREE.Vector3(pos.x, obs.box.min.y + 0.5, pos.z))) return true;
        }
        if (obs.radius) {
            const dx = pos.x - obs.mesh.position.x;
            const dz = pos.z - obs.mesh.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < obs.radius + radius) return true;
        }
    }
    return false;
}

export function updateZombies(dt) {
    const playerPos = camera.position;

    // Spawn
    if (gameState.zombiesToSpawn > 0) {
        gameState.zombieSpawnTimer -= dt;
        if (gameState.zombieSpawnTimer <= 0) {
            spawnZombie(gameState.wave >= 3 && Math.random() < 0.15 + gameState.wave * 0.02);
            gameState.zombiesToSpawn--;
            gameState.zombieSpawnTimer = 0.5;
        }
    }

    // Wave complete
    if (gameState.zombiesAlive <= 0 && gameState.zombiesToSpawn <= 0) {
        gameState.wave++;
        gameState.zombiesToSpawn = 5 + gameState.wave * 3;
        document.getElementById('wave-hud').textContent = 'Wave ' + gameState.wave;
        showRoundOverlay('Wave ' + gameState.wave, 'Incoming!', 2000);
    }

    for (let i = gameState.zombieEntities.length - 1; i >= 0; i--) {
        const z = gameState.zombieEntities[i];
        if (z.hp <= 0) continue;

        const dx = playerPos.x - z.mesh.position.x;
        const dz = playerPos.z - z.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Movement with collision sliding
        if (dist > 1.5) {
            const moveX = (dx / dist) * z.speed * dt;
            const moveZ = (dz / dist) * z.speed * dt;
            const zombieRadius = z.isBoss ? 0.7 : 0.5;
            const newPos = z.mesh.position.clone();
            newPos.x += moveX; newPos.z += moveZ;

            if (!checkZombieCollision(newPos, zombieRadius)) {
                z.mesh.position.x = newPos.x; z.mesh.position.z = newPos.z;
            } else {
                const posX = z.mesh.position.clone(); posX.x += moveX;
                if (!checkZombieCollision(posX, zombieRadius)) z.mesh.position.x = posX.x;
                const posZ = z.mesh.position.clone(); posZ.z += moveZ;
                if (!checkZombieCollision(posZ, zombieRadius)) z.mesh.position.z = posZ.z;
            }
            z.mesh.rotation.y = Math.atan2(dx, dz);
        }

        // Walk animation
        const walkPhase = Date.now() * 0.006 + i * 1.7;
        z.mesh.children[2].rotation.x = Math.sin(walkPhase) * 0.6;
        z.mesh.children[3].rotation.x = Math.sin(walkPhase + Math.PI) * 0.6;
        z.mesh.children[2].rotation.z = 0.15;
        z.mesh.children[3].rotation.z = -0.15;
        z.mesh.children[4].rotation.x = Math.sin(walkPhase + Math.PI) * 0.5;
        z.mesh.children[5].rotation.x = Math.sin(walkPhase) * 0.5;
        z.mesh.children[0].rotation.z = Math.sin(walkPhase * 0.5) * 0.05;
        z.mesh.children[1].rotation.z = Math.sin(walkPhase * 0.7) * 0.1;

        // Attack
        if (dist < 2) {
            z.attackCooldown -= dt;
            if (z.attackCooldown <= 0) {
                damagePlayer(z.damage);
                z.attackCooldown = 1;
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
            z.attracted = true;
            z.speed *= 1.1;
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

    group.position.set(
        (Math.random() - 0.5) * mapSize * 0.8, 0,
        (Math.random() - 0.5) * mapSize * 0.8
    );
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
        e.mesh.position.x += (dx / dist) * e.speed * dt;
        e.mesh.position.z += (dz / dist) * e.speed * dt;
    } else if (dist < 4) {
        e.mesh.position.x -= (dx / dist) * e.speed * 0.5 * dt;
        e.mesh.position.z -= (dz / dist) * e.speed * 0.5 * dt;
    }
    const perpX = -dz / dist, perpZ = dx / dist;
    e.mesh.position.x += perpX * e.strafeDir * e.speed * 0.5 * dt;
    e.mesh.position.z += perpZ * e.strafeDir * e.speed * 0.5 * dt;

    // Clamp to map
    const size = MAPS[gameState.currentMap].size * 0.95;
    e.mesh.position.x = Math.max(-size, Math.min(size, e.mesh.position.x));
    e.mesh.position.z = Math.max(-size, Math.min(size, e.mesh.position.z));

    // Shoot
    e.shootCooldown -= dt;
    if (e.shootCooldown <= 0 && dist < 30) {
        if (Math.random() < 0.3) damagePlayer(e.damage);
        e.shootCooldown = 0.5 + Math.random() * 0.5;
        playGunshot();
    }

    // Arm animation
    e.mesh.children[2].rotation.x = Math.sin(Date.now() * 0.003) * 0.2;
    e.mesh.children[3].rotation.x = Math.sin(Date.now() * 0.003 + Math.PI) * 0.2;
}
