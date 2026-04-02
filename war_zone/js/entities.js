// Zombie and PvP enemy spawning, AI, and updates

import * as THREE from 'three';
import { WEAPONS, MAPS } from './data.js';
import { playerData, playerState, savePlayerData, gameState, awardXP } from './state.js';
import { scene, camera, obstacles } from './engine.js';
import { playGunshot } from './audio.js';
import { addKillFeed, updateHUD, showRoundOverlay } from './ui.js';
import { dropWeapon } from './weapons.js';
import { damagePlayer, checkPvPEnd } from './combat.js';

// --- Zombies ---

export function spawnZombie(isBoss, isGiga = false, speedOverride = null) {
    const mapSize = MAPS[gameState.currentMap].size;
    let centerX, centerZ, dist;
    if (gameState.mode === 'rescue' && gameState.extractionZone) {
        centerX = gameState.extractionZone.x;
        centerZ = gameState.extractionZone.z;
        dist = 8 + Math.random() * 20;
    } else {
        centerX = 0;
        centerZ = 0;
        dist = mapSize * 0.7 + Math.random() * mapSize * 0.2;
    }
    const angle = Math.random() * Math.PI * 2;

    let hp, damage, dropMoney, weaponId = null;
    const bodySize = isGiga ? 4.05 : (isBoss ? 2.5 : 0.9);
    let armoredEnemy = false;

    if (isGiga) {
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
    const skinColor = isGiga ? 0x220011 : (isBoss ? 0x880044 : [0x445533, 0x3a5530, 0x504a38, 0x3d4a33][Math.floor(Math.random() * 4)]);
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

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), eyeMat);
    eye1.position.set(0.1, 0.05, bodySize * 0.22); head.add(eye1);
    const eye2 = eye1.clone(); eye2.position.x = -0.1; head.add(eye2);
    const mouthMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.05), mouthMat);
    mouth.position.set(0, -0.1, bodySize * 0.24);
    mouth.rotation.z = (Math.random() - 0.5) * 0.4;
    head.add(mouth);

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
            wpnMesh = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.12, bodySize * 0.12, bodySize * 0.55), wpnMat);
            wpnMesh.position.set(bodySize * 0.5, bodySize * 0.7, bodySize * 0.25);
            wpnMesh.rotation.x = -0.3;
        } else if (wDef.type === 'melee') {
            wpnMesh = new THREE.Mesh(new THREE.BoxGeometry(bodySize * 0.06, bodySize * 0.7, bodySize * 0.06),
                new THREE.MeshStandardMaterial({ color: 0xbbbbbb, metalness: 0.8 }));
            wpnMesh.position.set(bodySize * 0.52, bodySize * 0.9, bodySize * 0.1);
            wpnMesh.rotation.x = -0.5;
        }
        if (wpnMesh) { wpnMesh.castShadow = true; group.add(wpnMesh); }
    }

    let spawnX = centerX + Math.cos(angle) * dist;
    let spawnZ = centerZ + Math.sin(angle) * dist;

    // Ensure we don't spawn inside a bounding box
    const spawnRadius = isGiga ? 1.5 : (isBoss ? 0.7 : 0.5);
    for (let attempts = 0; attempts < 10; attempts++) {
        if (!checkZombieCollision(new THREE.Vector3(spawnX, 1, spawnZ), spawnRadius)) break;
        dist += 2;
        spawnX = centerX + Math.cos(angle) * dist;
        spawnZ = centerZ + Math.sin(angle) * dist;
    }

    group.position.set(spawnX, 0, spawnZ);

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

    const defaultSpeed = isGiga ? 7.0 : (isBoss ? 2.5 : (gameState.mode === 'rescue' ? 4.0 : 3.5));
    gameState.zombieEntities.push({
        mesh: group, hp, maxHp: hp, damage, dropMoney, isBoss, isGiga,
        weaponId, speed: speedOverride != null ? speedOverride : defaultSpeed,
        attackCooldown: 0, lastNoiseCheck: 0, attracted: false, dead: false,
        hpCtx: ctx, hpTex: tex,
        zombieRadius: isGiga ? 1.5 : (isBoss ? 0.7 : 0.5),
        attackDist: isGiga ? 4 : 2,
        damageReduction: armoredEnemy ? 0.35 : 0,
        aiState: 'charge', aiTimer: 0,
        flankAngle: (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 4 + Math.random() * Math.PI / 4),
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        stuckTimer: 0, prevHp: hp,
        wanderAngle: Math.random() * Math.PI * 2, wanderTimer: 0
    });
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

    let spawnX = (Math.random() - 0.5) * mapSize * 0.8;
    let spawnZ = (Math.random() - 0.5) * mapSize * 0.8;
    for (let attempts = 0; attempts < 25; attempts++) {
        if (!checkZombieCollision(new THREE.Vector3(spawnX, 1, spawnZ), 0.5)) break;
        spawnX = (Math.random() - 0.5) * mapSize * 0.8;
        spawnZ = (Math.random() - 0.5) * mapSize * 0.8;
    }
    group.position.set(spawnX, 0, spawnZ);

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
    const options = Object.entries(WEAPONS).filter(([id, w]) => w.range === range);
    if (options.length === 0) return null;
    return options[Math.floor(Math.random() * options.length)][0];
}

const WEAPON_RANGE_UNITS = { close: 8, middle: 25, long: 50 };

function hasLineOfSight(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from).normalize();
    const ray = new THREE.Raycaster(from, dir);
    const distToTarget = from.distanceTo(to);
    const obsMeshes = obstacles.filter(o => o.mesh).map(o => o.mesh);
    const hits = ray.intersectObjects(obsMeshes, true);
    if (hits.length === 0) return true;
    return hits[0].distance > distToTarget - 0.5;
}

export function killZombie(z, idx) {
    if (z.dead) return;
    z.dead = true; z.hp = 0;
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

    addKillFeed(z.isGiga ? 'GIGA ZOMBIE SLAIN!' : (z.isBoss ? 'Boss Zombie' : 'Zombie'), z.isGiga ? '#ff00ff' : '#fff');
    const xp = z.isGiga ? 200 : z.isBoss ? 50 : (gameState.mode === 'rescue' ? 15 : 10);
    awardXP(xp);
    savePlayerData();
}

function checkZombieCollision(pos, radius) {
    const pMinY = pos.y;
    const pMaxY = pos.y + 1.8;

    for (const obs of obstacles) {
        if (obs.box) {
            const b = obs.box;
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

export function updateZombies(dt) {
    const playerPos = camera.position;

    // Spawn
    if (gameState.zombiesToSpawn > 0) {
        gameState.zombieSpawnTimer -= dt;
        if (gameState.zombieSpawnTimer <= 0) {
            const gigaChance = gameState.mode === 'zombie' ? (gameState.wave - 1) * 0.01 : 0;
            const isGiga = Math.random() < gigaChance;
            const isBoss = !isGiga && gameState.wave >= 3 && Math.random() < 0.15 + gameState.wave * 0.02;
            spawnZombie(isBoss, isGiga);
            gameState.zombiesToSpawn--;
            gameState.zombieSpawnTimer = gameState.mode === 'rescue' ? 0.15 : (gameState.mode === 'zombie' ? 0.32 : 0.5);
        }
    }

    // Wave complete (zombie invasion only — rescue uses a fixed horde count)
    if (gameState.mode === 'zombie' && gameState.zombiesAlive <= 0 && gameState.zombiesToSpawn <= 0) {
        gameState.wave++;
        gameState.zombiesToSpawn = (70 + gameState.wave * 45) * 15;
        document.getElementById('wave-hud').textContent = 'Wave ' + gameState.wave;
        showRoundOverlay('Wave ' + gameState.wave, 'Incoming!', 2000);
    }

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

        let stopDist = z.isGiga ? 3.5 : 1.5;
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

        // Gravity & Raycast Floor Tracking
        const zRay = new THREE.Raycaster(new THREE.Vector3(z.mesh.position.x, z.mesh.position.y + 2, z.mesh.position.z), new THREE.Vector3(0, -1, 0));
        const zHits = zRay.intersectObjects(obstacles.filter(o => o.mesh).map(o => o.mesh));
        if (zHits.length > 0 && zHits[0].distance < 4) {
            z.mesh.position.y += (zHits[0].point.y - z.mesh.position.y) * dt * 10;
        } else if (zHits.length > 0) {
            z.mesh.position.y -= 15 * dt;
            if (z.mesh.position.y < zHits[0].point.y) z.mesh.position.y = zHits[0].point.y;
        } else {
            z.mesh.position.y -= 15 * dt;
            if (z.mesh.position.y < 0) z.mesh.position.y = 0;
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

        // Auto-attract if player is very close or in line of sight
        if (gameState.mode === 'zombie' && !z.attracted) {
            if (dist < 4) {
                z.attracted = true;
                z.speed *= 1.5;
            } else if (dist < 20) {
                const eyePos = new THREE.Vector3(z.mesh.position.x, z.mesh.position.y + 1.5, z.mesh.position.z);
                if (hasLineOfSight(eyePos, playerPos)) {
                    z.attracted = true;
                    z.speed *= 1.5;
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
            if (!checkZombieCollision(new THREE.Vector3(nx, z.mesh.position.y, nz), wanderZR)) {
                z.mesh.position.x = nx;
                z.mesh.position.z = nz;
            } else {
                z.wanderAngle += Math.PI * (0.5 + Math.random() * 0.5);
            }
            z.mesh.rotation.y = z.wanderAngle;
        } else if (dist > stopDist) {
            const zombieRadius = z.zombieRadius || (z.isBoss ? 0.7 : 0.5);
            let moveAngle = Math.atan2(dx, dz);

            if (z.aiState === 'flank') {
                const blendFactor = Math.min(1, dist / 16);
                moveAngle += z.flankAngle * blendFactor;
            } else if (z.aiState === 'strafe') {
                const perpAngle = moveAngle + Math.PI / 2 * z.strafeDir;
                const blendFactor = dist > 11 ? 0.22 : 0.42;
                moveAngle = moveAngle * (1 - blendFactor) + perpAngle * blendFactor;
            }

            const step = z.speed * dt;
            const steer = computeZombieSteer(
                z.mesh.position.x, z.mesh.position.z,
                playerPos.x, playerPos.z,
                moveAngle, zombieRadius, step
            );
            z.mesh.position.x += steer.mx;
            z.mesh.position.z += steer.mz;

            // Dead-end escape: briefly sidestep along walls if fully blocked
            const movedSq = steer.mx * steer.mx + steer.mz * steer.mz;
            if (movedSq < 1e-10) {
                z.stuckTimer = (z.stuckTimer || 0) + dt;
                if (z.stuckTimer > 0.2) {
                    z.flankAngle = (Math.random() > 0.5 ? 1 : -1) * (Math.PI / 2 + Math.random() * 0.35);
                    z.aiState = 'flank';
                    z.aiTimer = 0.4;
                    z.stuckTimer = 0;
                }
            } else {
                z.stuckTimer = 0;
            }

            z.mesh.rotation.y = Math.atan2(dx, dz);
        }

        // Anim
        const walkPhase = Date.now() * 0.006 + i * 1.7;
        const isInCombat = !isWandering && canReachPlayer && dist < attackDist;

        if (isInCombat && useWeapon && wDef.type === 'gun') {
            z.mesh.children[2].rotation.x = -0.4;
            z.mesh.children[3].rotation.x = -0.5;
            z.mesh.children[2].rotation.z = 0.1;
            z.mesh.children[3].rotation.z = -0.1;
        } else if (isInCombat && z.attackCooldown <= 0) {
            const punchPhase = (Date.now() * 0.015) % (Math.PI * 2);
            z.mesh.children[2].rotation.x = -Math.PI * 0.55 * Math.max(0, Math.sin(punchPhase));
            z.mesh.children[3].rotation.x = -Math.PI * 0.55 * Math.max(0, Math.sin(punchPhase + Math.PI));
            z.mesh.children[2].rotation.z = 0.1;
            z.mesh.children[3].rotation.z = -0.1;
        } else {
            z.mesh.children[2].rotation.x = Math.sin(walkPhase) * 0.6;
            z.mesh.children[3].rotation.x = Math.sin(walkPhase + Math.PI) * 0.6;
            z.mesh.children[2].rotation.z = 0.15;
            z.mesh.children[3].rotation.z = -0.15;
        }

        z.mesh.children[4].rotation.x = Math.sin(walkPhase + Math.PI) * 0.5;
        z.mesh.children[5].rotation.x = Math.sin(walkPhase) * 0.5;
        z.mesh.children[0].rotation.z = Math.sin(walkPhase * 0.5) * 0.05;
        z.mesh.children[1].rotation.z = Math.sin(walkPhase * 0.7) * 0.1;

        if (z.hpCtx) {
            z.hpCtx.clearRect(0, 0, 64, 16);
            z.hpCtx.fillStyle = '#ff0000';
            z.hpCtx.fillRect(0, 0, 64 * (z.hp / z.maxHp), 16);
            z.hpTex.needsUpdate = true;
        }

        // Attack (melee or ranged) — wandering zombies don't attack
        if (!isWandering && canReachPlayer && dist < attackDist) {
            z.attackCooldown -= dt;
            if (z.attackCooldown <= 0) {
                if (useWeapon && wDef.type === 'gun') {
                    const eyePos = new THREE.Vector3(z.mesh.position.x, z.mesh.position.y + 1.5, z.mesh.position.z);
                    const playerTarget = camera.position.clone();
                    if (hasLineOfSight(eyePos, playerTarget)) {
                        damagePlayer(Math.floor(weaponDamage * (0.8 + Math.random() * 0.4)));
                        playGunshot();
                        z.attackCooldown = 1 / (wDef.fireRate || 0.5);
                    }
                } else {
                    damagePlayer(weaponDamage);
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

    const eRay = new THREE.Raycaster(new THREE.Vector3(e.mesh.position.x, e.mesh.position.y + 2, e.mesh.position.z), new THREE.Vector3(0, -1, 0));
    const eHits = eRay.intersectObjects(obstacles.filter(o => o.mesh).map(o => o.mesh));
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
        if (Math.random() < 0.3) damagePlayer(e.damage);
        e.shootCooldown = 0.5 + Math.random() * 0.5;
        playGunshot();
    }

    // Arm animation
    e.mesh.children[2].rotation.x = Math.sin(Date.now() * 0.003) * 0.2;
    e.mesh.children[3].rotation.x = Math.sin(Date.now() * 0.003 + Math.PI) * 0.2;
}
