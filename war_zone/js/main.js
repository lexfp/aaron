// Main entry point: game loop, start/quit, collision, initialization

import * as THREE from 'three';
import { WEAPONS, EQUIPMENT, MAPS } from './data.js';
import { playerData, playerState, resetPlayerState, savePlayerData, gameState } from './state.js';
import { playPickup } from './audio.js';
import {
    scene, camera, renderer, controls, velocity, direction, keys,
    canJump, setCanJump, obstacles, moveSpeed, sprintMult, jumpForce, gravity,
    weaponModel, weaponSwingTime, setWeaponSwingTime
} from './engine.js';
import { buildMap, spawnSinglePickup, spawnExtractionZone } from './map.js';
import {
    showScreen, updateHomeStats, showShop, showLoadout,
    renderMapScreen, updateHUD, renderWeaponSlots,
    showRoundOverlay, buildCheats, initTutorial
} from './ui.js';
import { createWeaponModel, getCurrentWeapon, switchWeapon, updateReload, refillAllAmmo } from './weapons.js';
import { spawnPvPEnemy, updatePvPEnemy, killZombie, spawnZombie, updateZombies, spawnHostage } from './entities.js';
import { shoot, updateFireZones, checkPvPEnd, damagePlayer } from './combat.js';
import { setupInput, checkInteractionPrompt, isMouseDown } from './input.js';
import { register } from './callbacks.js';

// --- Register callbacks to break circular deps ---

register('quitToMenu', () => quitToMenu());
register('refillAllAmmo', () => refillAllAmmo());
register('killAllEnemies', () => killAllEnemies());

// --- Cheats ---

const CHEATS = buildCheats();

function killAllEnemies() {
    for (let i = gameState.zombieEntities.length - 1; i >= 0; i--) {
        killZombie(gameState.zombieEntities[i], i);
    }
    if (gameState.pvpEnemy) {
        gameState.pvpEnemy.hp = 0;
        gameState.pvpPlayerScore++;
        checkPvPEnd();
    }
}

// --- Collision ---

function checkCollision(newPos) {
    if (playerState.godMode || playerState.noClip) return false;
    const size = gameState.currentMap ? MAPS[gameState.currentMap].size * 0.95 : 50;
    if (Math.abs(newPos.x) > size || Math.abs(newPos.z) > size) return true;

    const playerCylRadius = 0.3;
    const pMinY = newPos.y - 1.7;
    const pMaxY = newPos.y + 0.2;

    for (const obs of obstacles) {
        if (obs.passThrough) continue;
        if (obs.isSlope) continue; // slopes use steepness guard + floor snap, not AABB
        if (obs.box) {
            const b = obs.box;
            if (newPos.x + playerCylRadius > b.min.x && newPos.x - playerCylRadius < b.max.x &&
                newPos.z + playerCylRadius > b.min.z && newPos.z - playerCylRadius < b.max.z) {
                if (pMinY < b.max.y && pMaxY > b.min.y) {
                    if (pMinY >= b.max.y - 0.4) continue; // Allow stepping up heights up to 0.4
                    return true;
                }
            }
        }
        if (obs.radius) {
            // Skip radius collision if player is above this obstacle (e.g. standing on top of trunk)
            if (obs.box && pMinY >= obs.box.max.y - 0.1) continue;
            const dx = newPos.x - obs.mesh.position.x;
            const dz = newPos.z - obs.mesh.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < obs.radius + playerCylRadius) return true;
        }
    }

    // Slope steepness/height check + side-entry block for mountain map
    if (gameState.currentMap === 'mountain') {
        const floorAtNew = getFloorHeight(newPos);
        const currentFeetY = camera.position.y - 1.7;
        if (floorAtNew > currentFeetY + 0.6) return true;

        for (const obs of obstacles) {
            if (!obs.isSlope || !obs.box) continue;
            const b = obs.box;
            if (newPos.x + playerCylRadius > b.min.x && newPos.x - playerCylRadius < b.max.x &&
                newPos.z + playerCylRadius > b.min.z && newPos.z - playerCylRadius < b.max.z) {
                if (pMinY < b.max.y && pMaxY > b.min.y) {
                    if (pMinY >= b.max.y - 0.8) continue;
                    return true;
                }
            }
        }
    }

    for (const pit of (gameState.craterPits || [])) {
        if (pMinY >= -0.05) continue;
        const dx = newPos.x - pit.cx;
        const dz = newPos.z - pit.cz;
        const distSq = dx * dx + dz * dz;
        if (distSq > pit.r * pit.r) continue;
        const wallR = pit.r * 0.88 - playerCylRadius;
        if (distSq > wallR * wallR) return true;
    }

    return false;
}

const downRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));
const upRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 1, 0));

function getFloorHeight(pos) {
    // Default ground is y=0. Inside a crater pit the ground is lower.
    let floor = 0;
    for (const pit of (gameState.craterPits || [])) {
        const dx = pos.x - pit.cx, dz = pos.z - pit.cz;
        if (dx * dx + dz * dz < pit.r * pit.r) { floor = -pit.depth; break; }
    }
    const feetY = pos.y - 1.7;

    // Check AABB boxes first (skip slope entries — they're handled by raycast below)
    for (const obs of obstacles) {
        if (obs.passThrough || obs.isSlope) continue;
        if (obs.box) {
            // No lateral tolerance: only snap up to a box top when the player center is
            // actually inside its XZ footprint. A tolerance here combined with the vertical
            // snap would teleport the player on top of any obstacle they walk into from the
            // side whose top is below feetY + 0.8 (anything ~0.4–0.8 m tall).
            if (pos.x > obs.box.min.x && pos.x < obs.box.max.x &&
                pos.z > obs.box.min.z && pos.z < obs.box.max.z) {
                const obsTop = obs.box.max.y;
                if (obsTop > floor && feetY >= obsTop - 0.8) floor = obsTop;
            }
        }
    }

    // Check perfectly accurate sloped meshes via Dual Vertical Raycast
    const slopeMeshes = gameState.slopeMeshes || [];
    if (slopeMeshes.length > 0) {
        // 1. Cast from high up down to find any potential floors
        downRaycaster.set(new THREE.Vector3(pos.x, 200, pos.z), new THREE.Vector3(0, -1, 0));
        const downHits = downRaycaster.intersectObjects(slopeMeshes);

        // 2. Cast from feet up to find if there is a ceiling above us
        upRaycaster.set(new THREE.Vector3(pos.x, feetY + 0.1, pos.z), new THREE.Vector3(0, 1, 0));
        const upHits = upRaycaster.intersectObjects(slopeMeshes);
        const ceilingY = upHits.length > 0 ? upHits[0].point.y : Infinity;

        if (downHits.length > 0) {
            // Pick the highest floor that is NOT above our head or blocked by a ceiling
            for (const hit of downHits) {
                const hitY = hit.point.y;
                // A surface is only a floor if:
                // - It's below any ceiling we just hit
                // - It's within a reasonable 'anti-phasing' range above our feet (e.g. 5m) OR below our feet
                if (hitY < ceilingY && hitY <= feetY + 0.8) {
                    if (hitY > floor) floor = hitY;
                }
            }
        }
    }

    return floor;
}

// --- Start Game ---

function startGame(mode, mapId) {
    gameState.mode = mode || 'zombie';
    gameState.currentMap = mapId in MAPS ? mapId : 'warehouse';

    if (!playerData.equippedLoadout?.length) playerData.equippedLoadout = ['fists'];

    ['homepage', 'shop-screen', 'loadout-screen', 'map-screen'].forEach(s =>
        document.getElementById(s).style.display = 'none'
    );
    document.getElementById('hud').style.display = 'block';

    buildMap(mapId);

    const maxSlots = mode === 'rescue' ? 5 : (mode === 'pvp' ? 3 : 4);
    let initialWeapons = playerData.equippedLoadout.slice(0, maxSlots);
    if (mode === 'rescue') {
        initialWeapons = initialWeapons.filter(w => w !== 'shield');
        if (!initialWeapons.includes('compass')) {
            if (initialWeapons.length === 5) initialWeapons[4] = 'compass';
            else initialWeapons.push('compass');
        }
    }

    const bonusHp = (playerData.stats?.health || 0) * 5;
    resetPlayerState({
        weapons: initialWeapons,
        maxSlots,
        hp: 100 + bonusHp,
        maxHp: 100 + bonusHp,
        speedMult: 1 + (playerData.stats?.speed || 0) * 0.02
    });

    for (const wid of playerState.weapons) {
        const w = WEAPONS[wid];
        playerState.weaponStates[wid] = {
            ammo: w.maxAmmo, reserveAmmo: w.reserveAmmo,
            lastFired: 0, reloading: false, reloadStart: 0
        };
    }

    if (playerData.equippedArmor) {
        const eq = EQUIPMENT[playerData.equippedArmor];
        playerState.armor += eq.armor;
        playerState.maxArmor += eq.armor;
        playerState.damageReduction += eq.damageReduction || 0;
    }
    if (playerData.equippedHelmet) {
        const eq = EQUIPMENT[playerData.equippedHelmet];
        playerState.armor += eq.armor;
        playerState.maxArmor += eq.armor;
        playerState.headshotReduction = eq.headshotReduction || 0;
    }
    if (playerData.equippedPants) {
        const eq = EQUIPMENT[playerData.equippedPants];
        if (eq) {
            playerState.armor += eq.armor || 0;
            playerState.maxArmor += eq.armor || 0;
            playerState.damageReduction = Math.min(0.9, playerState.damageReduction + (eq.damageReduction || 0));
        }
    }
    if (playerData.equippedBoots) {
        const eq = EQUIPMENT[playerData.equippedBoots];
        if (eq) {
            playerState.armor += eq.armor || 0;
            playerState.maxArmor += eq.armor || 0;
            playerState.damageReduction = Math.min(0.9, playerState.damageReduction + (eq.damageReduction || 0));
        }
    }
    // Med kits and adrenaline are used in-game via Q/Y; don't consume at match start

    camera.position.set(0, 1.7, 0);
    scene.add(camera);
    createWeaponModel(playerState.weapons[0]);
    renderWeaponSlots();

    gameState.zombieEntities = [];
    gameState.droppedWeapons = [];
    gameState.fireZones = [];
    gameState.pickupSpawnTimer = 0;
    gameState.medkitSpawnTimer = 180;

    gameState.airstrikeLastUsed = null;

    if (mode === 'zombie') {
        gameState.wave = 1;
        gameState.zombiesAlive = 0;
        gameState.zombiesToSpawn = 450;
        gameState.zombieSpawnTimer = 0;
        document.getElementById('wave-hud').style.display = 'block';
        document.getElementById('wave-hud').textContent = 'Wave 1';
    } else if (mode === 'rescue') {
        spawnHostage(MAPS[mapId].size);
        gameState.zombiesAlive = 0;
        gameState.zombiesToSpawn = 80;
        gameState.zombieSpawnTimer = 0;
        document.getElementById('wave-hud').style.display = 'block';
        document.getElementById('wave-hud').textContent = 'Find the Hostage!';
    } else if (mode === 'pvp') {
        gameState.pvpRound = 1;
        gameState.pvpPlayerScore = 0;
        gameState.pvpEnemyScore = 0;
        document.getElementById('wave-hud').style.display = 'block';
        document.getElementById('wave-hud').textContent = 'Round 1 | 0-0';
        spawnPvPEnemy();
    }

    gameState.active = true;
    gameState.paused = false;
    updateHUD();
    controls.lock();
}
window.startGame = startGame;

// --- Quit / Resume ---

function quitToMenu() {
    gameState.active = false;
    gameState.paused = false;
    controls.unlock();
    document.getElementById('hud').style.display = 'none';
    document.getElementById('pause-menu').style.display = 'none';
    document.getElementById('round-overlay').style.display = 'none';
    document.getElementById('consumables-panel').style.display = 'none';
    gameState.zombieEntities = [];
    gameState.droppedWeapons = [];
    gameState.fireZones = [];
    gameState.ammoPickups = [];
    gameState.pvpEnemy = null;
    gameState.craterPits = [];
    showScreen('homepage');
}
window.quitToMenu = quitToMenu;

function resumeGame() {
    gameState.paused = false;
    document.getElementById('pause-menu').style.display = 'none';
    controls.lock();
}
window.resumeGame = resumeGame;

window.returnToMenu = function () {
    document.getElementById('round-overlay').style.display = 'none';
    quitToMenu();
};

// --- Game Loop ---

let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const dt = Math.min((time - prevTime) / 1000, 0.033);
    prevTime = time;

    if (gameState.active && !gameState.paused && controls.isLocked) {
        direction.z = Number(keys.w) - Number(keys.s);
        direction.x = Number(keys.d) - Number(keys.a);
        direction.normalize();

        let isSprinting = false;
        if (keys.shift && playerState.stamina > 0 && (direction.x !== 0 || direction.z !== 0)) {
            isSprinting = true;
            playerState.stamina -= dt * 20;
            if (playerState.stamina < 0) playerState.stamina = 0;
        } else if (!keys.shift) {
            playerState.stamina += dt * 10;
            if (playerState.stamina > playerState.maxStamina) playerState.stamina = playerState.maxStamina;
        }

        const speed = moveSpeed * (isSprinting ? sprintMult : 1) * playerState.speedMult;
        velocity.x -= velocity.x * 10.0 * dt;
        velocity.z -= velocity.z * 10.0 * dt;
        velocity.y -= gravity * dt;
        if (direction.z !== 0) velocity.z -= direction.z * speed * dt * 15;
        if (direction.x !== 0) velocity.x -= direction.x * speed * dt * 15;
        if (keys.space) {
            if (canJump) {
                velocity.y = jumpForce;
                setCanJump(false);
            } else if (gameState.currentMap === 'forest') {
                // Tree scaling: holding Space near a trunk climbs it
                const nearTrunk = obstacles.some(o => o.isTrunk &&
                    Math.abs(o.mesh.position.x - camera.position.x) < 1.1 &&
                    Math.abs(o.mesh.position.z - camera.position.z) < 1.1);
                if (nearTrunk) velocity.y = 5;
            }
        }

        const rightDir = new THREE.Vector3();
        const forwardDir = new THREE.Vector3();
        camera.getWorldDirection(forwardDir);
        forwardDir.y = 0; forwardDir.normalize();
        rightDir.crossVectors(forwardDir, camera.up).normalize();

        const moveVec = new THREE.Vector3();
        moveVec.addScaledVector(rightDir, -velocity.x * dt);
        moveVec.addScaledVector(forwardDir, -velocity.z * dt);

        const origX = camera.position.x;
        camera.position.x += moveVec.x;
        if (checkCollision(camera.position)) camera.position.x = origX;

        const origZ = camera.position.z;
        camera.position.z += moveVec.z;
        if (checkCollision(camera.position)) camera.position.z = origZ;

        // Side-entry slope check: raycast in move direction from game loop where moveVec is known
        if (gameState.currentMap === 'mountain') {
            const slopeMeshes = gameState.slopeMeshes || [];
            const moveDist = Math.sqrt(moveVec.x * moveVec.x + moveVec.z * moveVec.z);
            if (slopeMeshes.length > 0 && moveDist > 0.0001) {
                const dirX = moveVec.x / moveDist;
                const dirZ = moveVec.z / moveDist;
                const ox = camera.position.x - dirX * 0.5;
                const oz = camera.position.z - dirZ * 0.5;
                const checkDist = moveDist + 0.35;
                const feetY = camera.position.y - 1.7;
                const floorAhead = getFloorHeight(camera.position); // already moved to new pos
                // Only block side entry if the floor ahead is NOT a walkable surface
                // (i.e. the player isn't stepping up onto a slope top)
                const canStepUp = floorAhead <= feetY + 0.6;
                if (!canStepUp) {
                    // Already handled by steepness guard in checkCollision
                } else {
                    const heights = [feetY + 0.15, camera.position.y - 0.85, camera.position.y - 0.2];
                    let blocked = false;
                    for (const ry of heights) {
                        if (blocked) break;
                        const ray = new THREE.Raycaster(
                            new THREE.Vector3(ox, ry, oz),
                            new THREE.Vector3(dirX, 0, dirZ)
                        );
                        const hits = ray.intersectObjects(slopeMeshes);
                        for (const hit of hits) {
                            if (hit.distance > checkDist) break;
                            if (hit.face) {
                                const wn = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                                // Only block on faces that are more vertical than horizontal
                                // AND where the hit point is above the player's step-up range
                                if (Math.abs(wn.y) > 0.7) continue;
                                if (hit.point.y <= feetY + 0.6) continue; // reachable as floor
                            }
                            blocked = true;
                            break;
                        }
                    }
                    if (blocked) {
                        camera.position.x = origX;
                        camera.position.z = origZ;
                    }
                }
            }
        }

        // After horizontal move, check if we've walked into the side of a slope:
        // if the floor at the new position is more than 0.6m above our feet, push back.
        if (gameState.currentMap === 'mountain') {
            const feetY = camera.position.y - 1.7;
            const floorHere = getFloorHeight(camera.position);
            if (floorHere > feetY + 0.6) {
                camera.position.x = origX;
                camera.position.z = origZ;
            }
        }

        const prevCamY = camera.position.y;
        camera.position.y += velocity.y * dt;

        // CCD: if falling on mountain map, sweep the full vertical path for slope surfaces
        // so the player can't phase through them when moving fast
        if (gameState.currentMap === 'mountain' && velocity.y < 0) {
            const prevFeetY = prevCamY - 1.7;
            const newFeetY = camera.position.y - 1.7;
            // Cast from previous camera Y (not feet) to cover the full swept path
            downRaycaster.set(
                new THREE.Vector3(camera.position.x, prevCamY, camera.position.z),
                new THREE.Vector3(0, -1, 0)
            );
            const sweepHits = downRaycaster.intersectObjects(gameState.slopeMeshes || []);
            for (const hit of sweepHits) {
                // Surface was crossed: it was above new feet but below old feet
                if (hit.point.y >= newFeetY && hit.point.y < prevFeetY) {
                    camera.position.y = hit.point.y + 1.7;
                    velocity.y = 0;
                    setCanJump(true);
                    break;
                }
            }
        }

        let targetFloorY = getFloorHeight(camera.position) + 1.7;

        if (camera.position.y < targetFloorY) {
            if (velocity.y < -15) {
                damagePlayer(Math.floor((-velocity.y - 15) * 1.5));
            }
            camera.position.y = targetFloorY;
            velocity.y = 0;
            setCanJump(true);
        }

        // Camera wall clip prevention: cast short rays in 4 horizontal directions
        // and push camera back if it's too close to any obstacle face.
        {
            const PUSH_DIST = 0.3;
            const camDirs = [
                new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
                new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
            ];
            const camObsMeshes = obstacles.filter(o => o.mesh && !o.passThrough).map(o => o.mesh);
            for (const dir of camDirs) {
                const r = new THREE.Raycaster(camera.position, dir, 0, PUSH_DIST);
                const hits = r.intersectObjects(camObsMeshes);
                if (hits.length > 0) {
                    const push = PUSH_DIST - hits[0].distance;
                    camera.position.x -= dir.x * push;
                    camera.position.z -= dir.z * push;
                }
            }
        }

        const { def } = getCurrentWeapon();
        if (isMouseDown() && def.fireRate <= 0.15) shoot();

        updateReload();
        updateFireZones(dt);

        if (gameState.mode === 'zombie' || gameState.mode === 'rescue') updateZombies(dt);
        else if (gameState.mode === 'pvp') updatePvPEnemy(dt);

        if (gameState.mode === 'rescue') {
            if (gameState.hostage && !gameState.hostage.rescued) {
                if (camera.position.distanceTo(gameState.hostage.mesh.position) < 4 && keys.e) {
                    gameState.hostage.rescued = true;
                    scene.remove(gameState.hostage.mesh);
                    spawnExtractionZone(MAPS[gameState.currentMap].size);
                    for (let i = 0; i < 3; i++) spawnZombie(false, true, 7.0);
                    document.getElementById('wave-hud').textContent = 'Get to Extraction (Green Pillar)!';
                    gameState.zombiesToSpawn += 100;
                    playPickup();
                }
            } else if (gameState.extractionZone) {
                const ex = gameState.extractionZone;
                const dist = Math.sqrt(Math.pow(camera.position.x - ex.x, 2) + Math.pow(camera.position.z - ex.z, 2));
                if (dist < 5 && gameState.active) {
                    gameState.active = false;
                    controls.unlock();
                    playerData.missions++;
                    playerData.money += 3000;
                    savePlayerData();
                    showRoundOverlay('MISSION ACCOMPLISHED', 'Hostage Extracted! +$3000', 0, true);
                }
            }
        }

        gameState.pickupSpawnTimer = (gameState.pickupSpawnTimer || 0) + dt;
        if (gameState.pickupSpawnTimer > 90) {
            const size = MAPS[gameState.currentMap].size;
            // Ammo crates spawn regularly; medkits much less often (separate slower timer)
            spawnSinglePickup(size, false);
            gameState.pickupSpawnTimer = 0;
        }
        gameState.medkitSpawnTimer = (gameState.medkitSpawnTimer || 120) - dt;
        if (gameState.medkitSpawnTimer <= 0) {
            spawnSinglePickup(MAPS[gameState.currentMap].size, true);
            gameState.medkitSpawnTimer = 150 + Math.random() * 60;
        }

        // Cactus damage (desert map)
        if (gameState.currentMap === 'desert') {
            for (const obs of obstacles) {
                if (!obs.isCactus) continue;
                const cdx = camera.position.x - obs.mesh.position.x;
                const cdz = camera.position.z - obs.mesh.position.z;
                if (Math.sqrt(cdx * cdx + cdz * cdz) < (obs.radius || 0.5) + 0.35) {
                    damagePlayer(5 * dt);
                    break;
                }
            }
        }

        for (const pickup of gameState.ammoPickups) {
            if (pickup.collected) continue;
            pickup.mesh.rotation.y += dt * 2;
            if (camera.position.distanceTo(pickup.mesh.position) < 2) {
                pickup.collected = true;
                scene.remove(pickup.mesh);
                if (pickup.isMedkit) {
                    playerState.hp = Math.min(playerState.maxHp, playerState.hp + 50);
                    playPickup();
                    updateHUD();
                } else {
                    const state = playerState.weaponStates[playerState.weapons[playerState.currentWeaponIndex]];
                    if (state) { state.reserveAmmo += 20; playPickup(); updateHUD(); }
                }
            }
        }

        for (const dw of gameState.droppedWeapons) dw.mesh.rotation.y += dt * 1.5;
        checkInteractionPrompt();

        if (weaponModel) {
            const currentWep = playerState.weapons[playerState.currentWeaponIndex];
            if (currentWep === 'compass') {
                const targetPos = (gameState.hostage && !gameState.hostage.rescued) ?
                    gameState.hostage.mesh.position :
                    (gameState.extractionZone ? new THREE.Vector3(gameState.extractionZone.x, camera.position.y, gameState.extractionZone.z) : null);

                if (targetPos) {
                    const needle = weaponModel.getObjectByName("needle");
                    if (needle) {
                        const dirToTarget = new THREE.Vector3(
                            targetPos.x - camera.position.x,
                            0,
                            targetPos.z - camera.position.z
                        ).normalize();
                        camera.updateMatrixWorld();
                        const invMatrix = new THREE.Matrix4().copy(camera.matrixWorld).invert();
                        const localDir = dirToTarget.transformDirection(invMatrix);
                        needle.rotation.y = Math.atan2(localDir.x, localDir.z);
                    }
                }
            }

            const bobSpeed = keys.shift ? 12 : 8;
            const bobAmt = keys.shift ? 0.015 : 0.008;
            if (direction.x !== 0 || direction.z !== 0) {
                weaponModel.position.y = Math.sin(time * 0.001 * bobSpeed) * bobAmt;
                weaponModel.position.x = Math.cos(time * 0.001 * bobSpeed * 0.5) * bobAmt * 0.5;
            }
            if (weaponSwingTime > 0) {
                setWeaponSwingTime(weaponSwingTime - dt);
                weaponModel.rotation.x = -weaponSwingTime * 3;
            } else {
                weaponModel.rotation.x = 0;
            }
        }
        updateHUD();
    }
    renderer.render(scene, camera);
}

// --- Initialize ---

renderMapScreen(startGame);

document.getElementById('btn-zombie').addEventListener('click', () => { gameState.pendingMode = 'zombie'; showScreen('map-screen'); });
document.getElementById('btn-rescue').addEventListener('click', () => { startGame('rescue', 'mountain'); });
document.getElementById('btn-pvp').addEventListener('click', () => { gameState.pendingMode = 'pvp'; showScreen('map-screen'); });
document.getElementById('btn-shop').addEventListener('click', showShop);
document.getElementById('btn-loadout').addEventListener('click', showLoadout);
setupInput(CHEATS, resumeGame);
updateHomeStats();
initTutorial();
animate();
