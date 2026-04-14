// Keyboard, mouse, and pointer lock input handling

import { keys, controls } from './engine.js';
import { gameState, playerState, playerData, savePlayerData } from './state.js';
import { switchWeapon, reload, dropCurrentWeapon, toggleZoom, pickupWeapon } from './weapons.js';
import { shoot, callAirstrike, useMedkit, useAdrenaline } from './combat.js';
import { addKillFeed, updateConsumablesPanel } from './ui.js';
import { camera } from './engine.js';
import { WEAPONS } from './data.js';

let chatOpen = false;
let cheatUnlocked = false;
let adminPromptOpen = false;
const ADMIN_CODE = 'zone';
let mouseDown = false;

export function setupInput(CHEATS, resumeGameFn) {
    document.addEventListener('keydown', (e) => {
        if (e.key === '`' || e.key === '~') {
            if (gameState.active) {
                chatOpen = !chatOpen;
                const el = document.getElementById('cheat-console');
                const input = document.getElementById('cheat-input');
                el.style.display = chatOpen ? 'block' : 'none';
                if (chatOpen) {
                    input.value = '';
                    input.className = cheatUnlocked ? 'cheat-mode' : '';
                    input.placeholder = cheatUnlocked
                        ? 'Chat or `cheatName to use cheats'
                        : 'Say something... (type `admin for cheats)';
                    input.focus();
                }
            }
            return;
        }
        if (chatOpen) return;

        const key = e.key.toLowerCase();
        if (key in keys) keys[key] = true;
        if (key === 'shift') keys.shift = true;
        if (key === ' ') { keys.space = true; e.preventDefault(); }
        if (e.key === 'Tab') e.preventDefault();
        if (!gameState.active) return;

        if (key >= '1' && key <= '9') switchWeapon(parseInt(key) - 1);
        if (key === 'x') dropCurrentWeapon();
        if (key === 'r') reload();
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

    // Chat / cheat input
    document.getElementById('cheat-input').addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Tab') {
            e.preventDefault();
            if (gameState.active) window._toggleThirdPerson && window._toggleThirdPerson();
            return;
        }
        if (e.key === 'Escape') {
            closeChatInput(resumeGameFn);
            return;
        }
        if (e.key === 'Enter') {
            const raw = e.target.value.trim();
            if (raw) {
                if (raw.startsWith('`')) {
                    const cmd = raw.slice(1).toLowerCase().trim();
                    if (cmd === 'admin') {
                        closeChatInput(resumeGameFn);
                        adminPromptOpen = true;
                        const code = prompt('Enter access code:');
                        adminPromptOpen = false;
                        if (code === ADMIN_CODE) {
                            cheatUnlocked = true;
                            showCheatFeedback('Cheat access granted. Type `cheatName to use cheats.');
                        } else if (code !== null) {
                            showCheatFeedback('Wrong code.');
                        }
                    } else if (cheatUnlocked) {
                        if (CHEATS[cmd]) {
                            CHEATS[cmd]();
                        } else {
                            showCheatFeedback(`Unknown cheat: ${cmd}`);
                        }
                        closeChatInput(resumeGameFn);
                    } else {
                        showCheatFeedback('No cheat access. Type `admin first.');
                        closeChatInput(resumeGameFn);
                    }
                } else {
                    showChatBubble(raw);
                    closeChatInput(resumeGameFn);
                }
            } else {
                closeChatInput(resumeGameFn);
            }
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
        if (gameState.active && !gameState.paused && !chatOpen && !adminPromptOpen && !window._isThirdPerson?.()) {
            gameState.paused = true;
            document.getElementById('pause-menu').style.display = 'flex';
        }
    });
}

function closeChatInput(resumeGameFn) {
    chatOpen = false;
    const el = document.getElementById('cheat-console');
    el.style.display = 'none';
    document.getElementById('cheat-input').blur();
    if (gameState.active && !window._isThirdPerson?.()) resumeGameFn();
}

let _chatBubbleTimer = null;
function showChatBubble(text) {
    const el = document.getElementById('chat-bubble');
    el.textContent = text;
    el.style.display = 'block';
    if (_chatBubbleTimer) clearTimeout(_chatBubbleTimer);
    _chatBubbleTimer = setTimeout(() => { el.style.display = 'none'; }, 5000);
}

let _cheatFeedbackTimer = null;
function showCheatFeedback(msg) {
    const el = document.getElementById('cheat-msg');
    el.textContent = msg;
    el.style.display = 'block';
    if (_cheatFeedbackTimer) clearTimeout(_cheatFeedbackTimer);
    _cheatFeedbackTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function tryPickup() {
    for (const passage of gameState.secretPassages) {
        if (passage.passThrough) continue;
        const dx = camera.position.x - passage.mesh.position.x;
        const dz = camera.position.z - passage.mesh.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 4) {
            passage.mesh.visible = false;
            passage.passThrough = true;
            setTimeout(() => { passage.mesh.visible = true; passage.passThrough = false; }, 3000);
            return true;
        }
    }
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

    for (const passage of gameState.secretPassages) {
        if (passage.passThrough) continue;
        const dx = camera.position.x - passage.mesh.position.x;
        const dz = camera.position.z - passage.mesh.position.z;
        if (Math.sqrt(dx * dx + dz * dz) < 4) {
            document.getElementById('interaction-prompt').textContent = 'Press [E] to open passage';
            showPrompt = true;
            break;
        }
    }

    if (!showPrompt && gameState.mode === 'rescue' && gameState.hostage && !gameState.hostage.rescued) {
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
