// Keyboard, mouse, and pointer lock input handling

import { keys, controls } from './engine.js';
import { gameState, playerState, playerData, savePlayerData } from './state.js';
import { switchWeapon, reload, dropCurrentWeapon, toggleZoom, pickupWeapon } from './weapons.js';
import { shoot, callAirstrike, useMedkit, useAdrenaline } from './combat.js';
import { addKillFeed, updateConsumablesPanel } from './ui.js';
import { camera } from './engine.js';
import { WEAPONS } from './data.js';

let cheatOpen = false;
let mouseDown = false;

export function setupInput(CHEATS, resumeGameFn) {
    document.addEventListener('keydown', (e) => {
        if (e.key === '`' || e.key === '~') {
            if (gameState.active) {
                cheatOpen = !cheatOpen;
                const el = document.getElementById('cheat-console');
                el.style.display = cheatOpen ? 'block' : 'none';
                if (cheatOpen) document.getElementById('cheat-input').focus();
            }
            return;
        }
        if (cheatOpen) return;

        const key = e.key.toLowerCase();
        if (key in keys) keys[key] = true;
        if (key === 'shift') keys.shift = true;
        if (key === ' ') { keys.space = true; e.preventDefault(); }
        if (e.key === 'Tab') e.preventDefault();
        if (!gameState.active) return;

        if (key >= '1' && key <= '9') switchWeapon(parseInt(key) - 1);
        if (key === 'r') dropCurrentWeapon();
        if (key === 'g') reload();
        if (key === 'e') {
            if (!tryPickup()) {
                const panel = document.getElementById('consumables-panel');
                const isVisible = panel.style.display === 'flex';
                updateConsumablesPanel();
                panel.style.display = isVisible ? 'none' : 'flex';
            }
        }
        if (key === 'escape') {
            if (gameState.paused) {
                resumeGameFn();
            } else {
                gameState.paused = true;
                document.getElementById('pause-menu').style.display = 'flex';
                controls.unlock();
            }
        }
        if (key === 'q') {
            if (!useMedkit()) switchWeapon(playerState.currentWeaponIndex - 1);
        }
        if (key === 'y') useAdrenaline();
        if (key === 'c') switchWeapon(playerState.currentWeaponIndex + 1);
        if (key === 'f') {
            if (playerData.airstrikes > 0) {
                const AIRSTRIKE_COOLDOWN = 5 * 60 * 1000;
                const now = performance.now();
                const elapsed = gameState.airstrikeLastUsed !== null ? now - gameState.airstrikeLastUsed : Infinity;
                if (elapsed >= AIRSTRIKE_COOLDOWN) {
                    playerData.airstrikes--;
                    savePlayerData();
                    gameState.airstrikeLastUsed = now;
                    callAirstrike();
                    updateConsumablesPanel();
                } else {
                    const remaining = Math.ceil((AIRSTRIKE_COOLDOWN - elapsed) / 1000);
                    addKillFeed(`Airstrike on cooldown: ${remaining}s`);
                }
            }
        }
        if (key === 'z') toggleZoom();
        if (e.key === 'Tab') {
            e.preventDefault();
            if (gameState.active && (controls.isLocked || window._isThirdPerson?.())) {
                window._toggleThirdPerson && window._toggleThirdPerson();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key in keys) keys[key] = false;
        if (key === 'shift') keys.shift = false;
        if (key === ' ') keys.space = false;
    });

    // Cheat input
    document.getElementById('cheat-input').addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
            const cmd = e.target.value.toLowerCase().trim();
            if (CHEATS[cmd]) CHEATS[cmd]();
            e.target.value = '';
            cheatOpen = false;
            document.getElementById('cheat-console').style.display = 'none';
            e.target.blur();
            // Re-engage pointer lock (may have been released when input was focused)
            if (gameState.active) resumeGameFn();
        }
    });

    // Mouse
    document.addEventListener('mousedown', (e) => {
        const active = gameState.active && (controls.isLocked || window._isThirdPerson?.());
        if (e.button === 0) { mouseDown = true; if (active) shoot(); }
        if (e.button === 2 && !window._isThirdPerson?.()) { if (active) toggleZoom(); }
    });
    document.addEventListener('mouseup', (e) => {
        if (e.button === 0) mouseDown = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('wheel', (e) => {
        if (!gameState.active || (!controls.isLocked && !window._isThirdPerson?.())) return;
        switchWeapon(playerState.currentWeaponIndex + (e.deltaY > 0 ? 1 : -1));
    });

    // Pointer lock
    controls.addEventListener('lock', () => {
        if (gameState.paused) {
            gameState.paused = false;
            document.getElementById('pause-menu').style.display = 'none';
        }
    });
    controls.addEventListener('unlock', () => {
        if (gameState.active && !gameState.paused && !window._isThirdPerson?.()) {
            gameState.paused = true;
            document.getElementById('pause-menu').style.display = 'flex';
        }
    });
}

function tryPickup() {
    if (gameState.mode === 'rescue' && gameState.hostage && !gameState.hostage.rescued) {
        if (camera.position.distanceTo(gameState.hostage.mesh.position) < 5) {
            // Hostage rescue handled by weapons.js callback; returning true suppresses consumables panel
            return true;
        }
    }
    for (const dw of gameState.droppedWeapons) {
        if (camera.position.distanceTo(dw.mesh.position) < 3) {
            pickupWeapon(dw);
            return true;
        }
    }
    return false;
}

export function checkInteractionPrompt() {
    let showPrompt = false;

    if (gameState.mode === 'rescue' && gameState.hostage && !gameState.hostage.rescued) {
        if (camera.position.distanceTo(gameState.hostage.mesh.position) < 5) {
            document.getElementById('interaction-prompt').textContent = `Press [E] to Rescue Hostage`;
            showPrompt = true;
        }
    }

    if (!showPrompt) {
        for (const dw of gameState.droppedWeapons) {
            if (camera.position.distanceTo(dw.mesh.position) < 3) {
                document.getElementById('interaction-prompt').textContent =
                    `Press [E] to pick up ${WEAPONS[dw.weaponId].name}`;
                showPrompt = true;
                break;
            }
        }
    }

    document.getElementById('interaction-prompt').style.display = showPrompt ? 'block' : 'none';
}

export function isMouseDown() { return mouseDown; }
