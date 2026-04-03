// Shooting, damage calculation, throwables, explosions, fire zones

import * as THREE from 'three';
import { WEAPONS, EQUIPMENT } from './data.js';
import { playerData, playerState, savePlayerData, gameState, awardXP } from './state.js';
import { scene, camera, controls, raycaster, setWeaponSwingTime, obstacles } from './engine.js';
import { playSound, playGunshot, playHit, playExplosion, playPickup } from './audio.js';
import { updateHUD, addKillFeed, showRoundOverlay, updateConsumablesPanel } from './ui.js';

function refreshConsumablesIfOpen() {
    const panel = document.getElementById('consumables-panel');
    if (panel && panel.style.display === 'flex') updateConsumablesPanel();
}
import { getCurrentWeapon, hasSilencer, hasScope, reload, toggleZoom } from './weapons.js';
import { killZombie, attractZombies, spawnPvPEnemy } from './entities.js';
import { cb } from './callbacks.js';

function setShootRay() {
    const ndc = gameState.tpShootNDC;
    const cam = gameState.tpShootCamera;
    if (ndc && cam) {
        raycaster.setFromCamera(ndc, cam);
    } else {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    }
}

export function shoot() {
    const { id, def, state } = getCurrentWeapon();
    const now = performance.now() / 1000;

    if (state.reloading || now - state.lastFired < def.fireRate) return;

    if (def.type === 'melee') {
        state.lastFired = now;
        setWeaponSwingTime(0.2);
        playSound(200, 0.05, 'triangle', 0.1);
        setShootRay();
        const hits = raycaster.intersectObjects(getEnemyMeshes(), true);
        if (hits.length > 0 && hits[0].distance < (def.reach || 1.5)) {
            applyDamageToEnemy(hits[0], calculateDamage(def, hits[0]));
        }
        return;
    }

    if (def.type === 'throwable') {
        if (state.ammo <= 0) { if (state.reserveAmmo > 0) reload(); return; }
        state.ammo--;
        state.lastFired = now;
        throwProjectile(def);
        updateHUD();
        return;
    }

    // Gun
    if (state.ammo <= 0) {
        if (state.reserveAmmo > 0) {
            if (def.explosive && def.maxAmmo === 1) {
                state.ammo = 1;
                state.reserveAmmo--;
            } else {
                reload();
                return;
            }
        } else {
            return;
        }
    } else {
        state.ammo--;
    }
    state.lastFired = now;
    setWeaponSwingTime(0.1);

    if (def.makesNoise && !hasSilencer(id)) attractZombies(camera.position, 50);
    if (hasSilencer(id)) playSound(100, 0.05, 'sine', 0.05);
    else playGunshot();

    setShootRay();
    const colliders = [...getEnemyMeshes(), ...obstacles.filter(o => o.mesh).map(o => o.mesh)];
    const hits = raycaster.intersectObjects(colliders, true);
    const startPoint = camera.position.clone().add(new THREE.Vector3(0.1, -0.2, -0.5).applyQuaternion(camera.quaternion));

    if (def.explosive) {
        let hitPos = hits.length > 0 ? hits[0].point : camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(100));
        createExplosion(hitPos, def.radius || 5, def.damage);
        createTracer(startPoint, hitPos);
        createMuzzleFlash();
    } else {
        if (hits.length > 0) {
            const hitEnemy = findEntityFromHit(hits[0]);
            if (hitEnemy) applyDamageToEnemy(hits[0], calculateDamage(def, hits[0]));
            createTracer(startPoint, hits[0].point);
        } else {
            createTracer(startPoint, camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(100)));
        }
        createMuzzleFlash();
    }

    if ((id === 'sniper' || id === 'crossbow') && playerState.isZoomed) {
        setTimeout(toggleZoom, 200);
    }

    updateHUD();
}

function getEnemyMeshes() {
    const meshes = [];
    for (const z of gameState.zombieEntities) { if (z.hp > 0) meshes.push(z.mesh); }
    if (gameState.pvpEnemy?.hp > 0) meshes.push(gameState.pvpEnemy.mesh);
    return meshes;
}

function calculateDamage(def, hit) {
    let dmg = def.damage * (1 + (playerData.stats?.damage || 0) * 0.02);
    const isZoomed = playerState.isZoomed;
    if (isZoomed && def.zoomedDamage) dmg = def.zoomedDamage;

    const wid = playerState.weapons[playerState.currentWeaponIndex];
    if (isZoomed && hasScope(wid) && !def.hasScope) dmg += 20;
    if (def.closeDamageBonus && hit.distance < 5) dmg += def.closeDamageBonus;
    if (def.range === 'middle' && (hit.distance > 20 || hit.distance < 2)) dmg *= 0.9;

    const hitEntity = findEntityFromHit(hit);
    if (hitEntity) {
        const localY = hit.point.y - hitEntity.mesh.position.y;
        const entityHeight = hitEntity.isBoss ? 2.2 : 1.8;
        if (localY > entityHeight * 0.75) {
            const hasActiveScope = def.hasScope || hasScope(wid);
            dmg += (hasActiveScope && isZoomed) ? 40 : 10;
            addKillFeed('HEADSHOT!', '#ff4444');
        } else if (localY > entityHeight * 0.5 && (hit.point.x - hitEntity.mesh.position.x) > 0.2) {
            dmg = Math.max(0, dmg - 5);
        }
    }
    return Math.floor(dmg);
}

function findEntityFromHit(hit) {
    for (const z of gameState.zombieEntities) {
        if (z.hp <= 0) continue;
        let parent = hit.object;
        while (parent) { if (parent === z.mesh) return z; parent = parent.parent; }
    }
    if (gameState.pvpEnemy?.hp > 0) {
        let parent = hit.object;
        while (parent) { if (parent === gameState.pvpEnemy.mesh) return gameState.pvpEnemy; parent = parent.parent; }
    }
    return null;
}

function applyDamageToEnemy(hit, dmg) {
    const entity = findEntityFromHit(hit);
    if (!entity) return;
    if (entity.damageReduction) dmg = Math.max(1, Math.floor(dmg * (1 - entity.damageReduction)));
    entity.hp -= dmg;
    playHit();
    showDamageNumber(hit.point, dmg);

    if (entity.hp <= 0) {
        if (gameState.mode === 'zombie' || gameState.mode === 'rescue') {
            const idx = gameState.zombieEntities.indexOf(entity);
            if (idx >= 0) killZombie(entity, idx);
        } else if (gameState.mode === 'pvp') {
            gameState.pvpPlayerScore++;
            addKillFeed('Enemy eliminated!', '#00ff88');
            document.getElementById('wave-hud').textContent =
                `Round ${gameState.pvpRound} | ${gameState.pvpPlayerScore}-${gameState.pvpEnemyScore}`;
            awardXP(30);
            checkPvPEnd();
        }
    }
}

export function damagePlayer(amount, attackerPos = null) {
    if (playerState.godMode) return;
    const { def } = getCurrentWeapon();
    
    let bypassShield = false;
    if (def.damageReduction && attackerPos) {
        const playerForward = new THREE.Vector3();
        camera.getWorldDirection(playerForward);
        playerForward.y = 0;
        playerForward.normalize();

        const toAttacker = new THREE.Vector3().subVectors(attackerPos, camera.position);
        toAttacker.y = 0;
        toAttacker.normalize();

        const dot = playerForward.dot(toAttacker);
        if (dot < -0.2) bypassShield = true; // Attacker is behind the player
    }

    if (def.damageReduction && !bypassShield) amount *= (1 - def.damageReduction);
    amount *= (1 - playerState.damageReduction);

    if (playerState.armor > 0) {
        const absorbed = Math.min(playerState.armor, amount * 0.5);
        playerState.armor -= absorbed;
        amount -= absorbed;
    }
    playerState.hp = Math.max(0, playerState.hp - Math.floor(amount));

    const overlay = document.getElementById('damage-overlay');
    overlay.style.opacity = '0.6';
    setTimeout(() => overlay.style.opacity = '0', 150);
    playSound(100, 0.1, 'sawtooth', 0.1);
    updateHUD();

    if (playerState.hp <= 0) gameOver();
}

export function useMedkit() {
    const idx = playerData.ownedEquipment.indexOf('med_kit');
    if (idx < 0) return false;
    const eq = EQUIPMENT.med_kit;
    playerState.hp = Math.min(playerState.maxHp, playerState.hp + eq.hpRestore);
    playerData.ownedEquipment.splice(idx, 1);
    savePlayerData();
    playPickup();
    updateHUD();
    refreshConsumablesIfOpen();
    return true;
}

export function useAdrenaline() {
    const idx = playerData.ownedEquipment.indexOf('adrenaline');
    if (idx < 0) return false;
    const eq = EQUIPMENT.adrenaline;
    playerState.maxHp += eq.hpBoost;
    playerState.hp += eq.hpBoost;
    playerData.ownedEquipment.splice(idx, 1);
    savePlayerData();
    playPickup();
    updateHUD();
    refreshConsumablesIfOpen();
    return true;
}

// --- Throwables & Explosions ---

function throwProjectile(def) {
    setShootRay();
    const colliders = [...getEnemyMeshes(), ...obstacles.filter(o => o.mesh).map(o => o.mesh)];
    const hits = raycaster.intersectObjects(colliders, true);

    let explodePos;
    if (hits.length > 0 && hits[0].distance < 30) {
        explodePos = hits[0].point;
    } else {
        explodePos = camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(30));
    }

    if (def.explosive) createExplosion(explodePos, def.radius, def.damage);
    if (def.fire) createFireZone(explodePos, def.radius, def.damage, def.duration);
}

function createExplosion(pos, radius, damage) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.7 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), mat);
    mesh.position.copy(pos);
    scene.add(mesh);
    playExplosion();

    for (const z of gameState.zombieEntities) {
        if (z.hp > 0 && z.mesh.position.distanceTo(pos) < radius) {
            z.hp -= damage;
            if (z.hp <= 0) { const idx = gameState.zombieEntities.indexOf(z); if (idx >= 0) killZombie(z, idx); }
        }
    }
    if (gameState.pvpEnemy?.hp > 0 && gameState.pvpEnemy.mesh.position.distanceTo(pos) < radius) {
        gameState.pvpEnemy.hp -= damage;
    }
    if (camera.position.distanceTo(pos) < radius) damagePlayer(damage * 0.5, pos);

    let t = 0;
    const fadeInt = setInterval(() => {
        t += 0.05;
        mesh.scale.setScalar(1 + t * 2);
        mat.opacity -= 0.05;
        if (mat.opacity <= 0) { scene.remove(mesh); clearInterval(fadeInt); }
    }, 30);
}

function createFireZone(pos, radius, dps, duration) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.4 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.3, 16), mat);
    mesh.position.copy(pos);
    mesh.position.y = 0.15;
    scene.add(mesh);
    gameState.fireZones.push({ position: pos, radius, dps, mesh, endTime: performance.now() / 1000 + duration });
}

export function updateFireZones(dt) {
    const now = performance.now() / 1000;
    for (let i = gameState.fireZones.length - 1; i >= 0; i--) {
        const fz = gameState.fireZones[i];
        if (now > fz.endTime) { scene.remove(fz.mesh); gameState.fireZones.splice(i, 1); continue; }
        fz.mesh.material.opacity = 0.3 + Math.sin(now * 10) * 0.15;
        if (camera.position.distanceTo(fz.position) < fz.radius) damagePlayer(fz.dps * dt, fz.position);
    }
}

function createMuzzleFlash() {
    const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    flash.position.set(0.15, -0.1, -0.65);
    camera.add(flash);
    setTimeout(() => camera.remove(flash), 50);
}

function createTracer(start, end) {
    const material = new THREE.LineBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
    const points = [start, end];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    setTimeout(() => scene.remove(line), 50);
}

function showDamageNumber(pos, dmg) {
    const div = document.createElement('div');
    div.style.color = '#ffaa00';
    div.textContent = `-${dmg}`;
    document.getElementById('kill-feed').appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

// --- PvP End ---

export function checkPvPEnd() {
    if (gameState.pvpPlayerScore >= 3) {
        playerData.money += 200;
        savePlayerData();
        showRoundOverlay('YOU WIN!', '+$200', 3000);
        setTimeout(() => cb.quitToMenu(), 3500);
    } else if (gameState.pvpEnemyScore >= 3) {
        showRoundOverlay('YOU LOSE', '', 3000);
        setTimeout(() => cb.quitToMenu(), 3500);
    } else {
        gameState.pvpRound++;
        showRoundOverlay('Round ' + gameState.pvpRound, `${gameState.pvpPlayerScore} - ${gameState.pvpEnemyScore}`, 2000);
        setTimeout(() => {
            camera.position.set(0, 1.7, 0);
            spawnPvPEnemy();
            playerState.hp = playerState.maxHp;
            updateHUD();
        }, 2500);
    }
}

// --- Game Over ---

function gameOver() {
    gameState.active = false;
    controls.unlock();

    playerData.missions++;
    for (const wid of playerState.weapons) {
        if (wid === 'fists') continue;
        if (!playerData.weaponUsage[wid]) playerData.weaponUsage[wid] = 0;
        playerData.weaponUsage[wid]++;
    }
    savePlayerData();
    showRoundOverlay('GAME OVER', `Wave ${gameState.wave} | $${playerData.money}`, 0, true);
}

export function callAirstrike() {
    const pos = camera.position.clone();
    playSound(40, 2.0, 'sawtooth', 0.5);
    showRoundOverlay('AIRSTRIKE INBOUND', 'Take cover!', 1500);

    setTimeout(() => {
        playExplosion();
        const flash = document.createElement('div');
        flash.style.position = 'fixed'; flash.style.inset = '0';
        flash.style.backgroundColor = '#ffffff'; flash.style.zIndex = '999';
        flash.style.opacity = '1'; flash.style.pointerEvents = 'none';
        flash.style.transition = 'opacity 1s';
        document.body.appendChild(flash);
        setTimeout(() => flash.style.opacity = '0', 50);
        setTimeout(() => flash.remove(), 1050);

        const radius = 100;
        for (let i = gameState.zombieEntities.length - 1; i >= 0; i--) {
            const z = gameState.zombieEntities[i];
            if (z.mesh.position.distanceTo(pos) < radius) {
                if (z.isGiga) {
                    z.hp -= z.maxHp * 0.9;
                } else {
                    z.hp -= 10000;
                }
                if (z.hp <= 0) killZombie(z, i);
            }
        }
        if (gameState.pvpEnemy?.hp > 0 && gameState.pvpEnemy.mesh.position.distanceTo(pos) < radius) {
            gameState.pvpEnemy.hp -= 10000;
            applyDamageToEnemy({ object: gameState.pvpEnemy.mesh }, 10000);
        }
    }, 1500);
}
