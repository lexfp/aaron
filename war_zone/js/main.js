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
    showRoundOverlay, buildCheats, showCheatMenu, hideCheatMenu
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
            const dx = newPos.x - obs.mesh.position.x;
            const dz = newPos.z - obs.mesh.position.z;
            if (Math.sqrt(dx * dx + dz * dz) < obs.radius + playerCylRadius) return true;
        }
    }
    return false;
}

const downRaycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0));

function getFloorHeight(pos) {
    let floor = 0;

    // Check AABB boxes first
    for (const obs of obstacles) {
        if (obs.box) {
            if (pos.x >= obs.box.min.x - 0.3 && pos.x <= obs.box.max.x + 0.3 &&
                pos.z >= obs.box.min.z - 0.3 && pos.z <= obs.box.max.z + 0.3) {
                const obsTop = obs.box.max.y;
                const feetY = pos.y - 1.7;
                if (obsTop > floor && feetY >= obsTop - 0.8) floor = obsTop;
            }
        }
    }

    // Check perfectly accurate sloped meshes via vertical Raycast
    const slopeMeshes = obstacles.filter(o => o.isSlope).map(o => o.mesh);
    if (slopeMeshes.length > 0) {
        downRaycaster.set(new THREE.Vector3(pos.x, pos.y + 1.5, pos.z), new THREE.Vector3(0, -1, 0));
        const hits = downRaycaster.intersectObjects(slopeMeshes);
        if (hits.length > 0) {
            const hitY = hits[0].point.y;
            // Only step up onto slopes if we aren't clipping into a sheer massive cliff
            if (hitY > floor && hitY < pos.y + 1.5) floor = hitY;
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
    const initialWeapons = playerData.equippedLoadout.slice(0, maxSlots);
    if (mode === 'rescue' && !initialWeapons.includes('compass')) {
        if (initialWeapons.length === 5) initialWeapons[4] = 'compass';
        else initialWeapons.push('compass');
    }

    resetPlayerState({
        weapons: initialWeapons,
        maxSlots
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
        playerState.armor = eq.armor;
        playerState.maxArmor = eq.armor;
        playerState.damageReduction = eq.damageReduction;
    }
    if (playerData.equippedHelmet) {
        const eq = EQUIPMENT[playerData.equippedHelmet];
        playerState.armor += eq.armor;
        playerState.headshotReduction = eq.headshotReduction;
    }
    for (const id of playerData.ownedEquipment) {
        const eq = EQUIPMENT[id];
        if (eq.hpRestore) playerState.hp = Math.min(playerState.maxHp, playerState.hp + eq.hpRestore);
        if (eq.hpBoost) { playerState.maxHp += eq.hpBoost; playerState.hp += eq.hpBoost; }
    }
    playerData.ownedEquipment = [];

    camera.position.set(0, 1.7, 0);
    scene.add(camera);
    createWeaponModel(playerState.weapons[0]);
    renderWeaponSlots();

    gameState.zombieEntities = [];
    gameState.droppedWeapons = [];
    gameState.fireZones = [];

    if (mode === 'zombie') {
        gameState.wave = 1;
        gameState.zombiesAlive = 0;
        gameState.zombiesToSpawn = 5;
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
    gameState.zombieEntities = [];
    gameState.droppedWeapons = [];
    gameState.fireZones = [];
    gameState.ammoPickups = [];
    gameState.pvpEnemy = null;
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
        if (keys.space && canJump) { velocity.y = jumpForce; setCanJump(false); }

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

        camera.position.y += velocity.y * dt;

        let targetFloorY = getFloorHeight(camera.position) + 1.7;

        if (camera.position.y < targetFloorY) {
            if (velocity.y < -15) {
                damagePlayer(Math.floor((-velocity.y - 15) * 1.5));
            }
            camera.position.y = targetFloorY;
            velocity.y = 0;
            setCanJump(true);
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
        if (gameState.pickupSpawnTimer > 60) {
            const size = MAPS[gameState.currentMap].size;
            spawnSinglePickup(size);
            gameState.pickupSpawnTimer = 0;
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
                    const dx = targetPos.x - camera.position.x;
                    const dz = targetPos.z - camera.position.z;
                    const angleToTarget = Math.atan2(dx, dz);
                    const needle = weaponModel.getObjectByName("needle");
                    if (needle) {
                        needle.rotation.y = angleToTarget - camera.rotation.y + Math.PI;
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
document.getElementById('btn-cheat').addEventListener('click', () => showCheatMenu(CHEATS));

window.showCheatMenu = () => showCheatMenu(CHEATS);

setupInput(CHEATS, resumeGame);
updateHomeStats();
animate();
