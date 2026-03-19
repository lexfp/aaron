// Keyboard, mouse, and pointer lock input handling

import { keys, controls } from './engine.js';
import { gameState, playerState, playerData, savePlayerData } from './state.js';
import { switchWeapon, reload, dropCurrentWeapon, toggleZoom, pickupWeapon } from './weapons.js';
import { shoot, callAirstrike } from './combat.js';
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
        if (!gameState.active) return;

        if (key >= '1' && key <= '9') switchWeapon(parseInt(key) - 1);
        if (key === 'r') reload();
        if (key === 'g') dropCurrentWeapon();
        if (key === 'e') tryPickup();
        if (key === 'escape') {
            if (gameState.paused) {
                resumeGameFn();
            } else {
                gameState.paused = true;
                document.getElementById('pause-menu').style.display = 'flex';
                controls.unlock();
            }
        }
        if (key === 'q') switchWeapon(playerState.currentWeaponIndex - 1);
        if (key === 'f') {
            if (playerData.airstrikes > 0) {
                playerData.airstrikes--;
                savePlayerData();
                callAirstrike();
            } else {
                switchWeapon(playerState.currentWeaponIndex + 1);
            }
        }
        if (key === 'z') toggleZoom();
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
        }
    });

    // Mouse
    document.addEventListener('mousedown', (e) => {
        if (e.button === 0) { mouseDown = true; if (gameState.active && controls.isLocked) shoot(); }
        if (e.button === 2) { if (gameState.active && controls.isLocked) toggleZoom(); }
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('wheel', (e) => {
        if (!gameState.active || !controls.isLocked) return;
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
        if (gameState.active && !gameState.paused) {
            gameState.paused = true;
            document.getElementById('pause-menu').style.display = 'flex';
        }
    });
}

function tryPickup() {
    for (const dw of gameState.droppedWeapons) {
        if (camera.position.distanceTo(dw.mesh.position) < 3) {
            pickupWeapon(dw);
            return;
        }
    }
}

export function checkInteractionPrompt() {
    let showPrompt = false;
    for (const dw of gameState.droppedWeapons) {
        if (camera.position.distanceTo(dw.mesh.position) < 3) {
            document.getElementById('interaction-prompt').textContent =
                `Press [E] to pick up ${WEAPONS[dw.weaponId].name}`;
            showPrompt = true;
            break;
        }
    }
    document.getElementById('interaction-prompt').style.display = showPrompt ? 'block' : 'none';
}

export function isMouseDown() { return mouseDown; }
