// Keyboard, mouse, and pointer lock input handling

import { keys, controls } from './engine.js';
import { gameState, playerState, playerData, savePlayerData } from './state.js';
import { switchWeapon, reload, dropCurrentWeapon, toggleZoom, pickupWeapon } from './weapons.js';
import { shoot, callAirstrike, useMedkit, useAdrenaline } from './combat.js';
import { addKillFeed, updateConsumablesPanel } from './ui.js';
import { camera } from './engine.js';
import { WEAPONS, keybinds } from './data.js';

function keyLabel(val) {
    if (val === ' ') return 'Space';
    if (val === 'shift') return 'Shift';
    if (val === 'tab') return 'Tab';
    if (val === 'enter') return 'Enter';
    return val.toUpperCase();
}

let chatOpen = false;
let cheatUnlocked = false;
let adminPromptOpen = false;
const ADMIN_CODE = 'zone';
let mouseDown = false;

export function setupInput(CHEATS, resumeGameFn) {
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === keybinds.chat || e.key === '~') {
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
        if (window._keybindsMenuOpen) return;

        const key = e.key.toLowerCase();
        if (key === keybinds.moveForward) keys.w = true;
        if (key === keybinds.moveBack) keys.s = true;
        if (key === keybinds.moveLeft) keys.a = true;
        if (key === keybinds.moveRight) keys.d = true;
        if (key === keybinds.sprint) keys.shift = true;
        if (key === keybinds.interact) keys.e = true;
        if (key === keybinds.jump) { keys.space = true; if (!window._spaceHeld) { window._spacePressTime = performance.now(); window._spaceHeld = true; } e.preventDefault(); }
        if (key === keybinds.thirdPerson) e.preventDefault();
        if (!gameState.active) return;

        if (key >= '1' && key <= '9') switchWeapon(parseInt(key) - 1);
        if (key === keybinds.dropWeapon) dropCurrentWeapon();
        if (key === keybinds.reload) reload();
        if (key === keybinds.interact) {
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
        if (key === keybinds.medkit) {
            if (!useMedkit()) switchWeapon(playerState.currentWeaponIndex - 1);
        }
        if (key === keybinds.adrenaline) useAdrenaline();
        if (key === keybinds.cycleWeapon) switchWeapon(playerState.currentWeaponIndex + 1);
        if (key === keybinds.airstrike) {
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
        if (key === keybinds.zoom) toggleZoom();
        if (key === keybinds.thirdPerson) {
            if (gameState.active && (controls.isLocked || window._isThirdPerson?.())) {
                window._toggleThirdPerson && window._toggleThirdPerson();
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key === keybinds.moveForward) keys.w = false;
        if (key === keybinds.moveBack) keys.s = false;
        if (key === keybinds.moveLeft) keys.a = false;
        if (key === keybinds.moveRight) keys.d = false;
        if (key === keybinds.sprint) keys.shift = false;
        if (key === keybinds.interact) keys.e = false;
        if (key === keybinds.jump) {
            keys.space = false;
            window._spaceHeld = false;
            window._spaceUpTime = performance.now();
            window._spaceReleasedCount = (window._spaceReleasedCount || 0) + 1;
            window._spaceHeldMs = performance.now() - (window._spacePressTime || performance.now());
        }
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
                        // Close chat, then show custom overlay (avoids native prompt pointer-lock timing issues)
                        chatOpen = false;
                        document.getElementById('cheat-console').style.display = 'none';
                        adminPromptOpen = true;
                        const overlay = document.getElementById('admin-overlay');
                        const codeInput = document.getElementById('admin-code-input');
                        overlay.style.display = 'block';
                        codeInput.value = '';
                        codeInput.focus();
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

    // Admin code overlay
    document.getElementById('admin-code-input').addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || e.key === 'Enter') {
            const code = e.key === 'Enter' ? e.target.value.trim() : null;
            document.getElementById('admin-overlay').style.display = 'none';
            adminPromptOpen = false;
            if (code === ADMIN_CODE) {
                cheatUnlocked = true;
                showCheatFeedback('Cheat access granted. Type `cheatName to use cheats.');
            } else if (code !== null) {
                showCheatFeedback('Wrong code.');
            }
            if (gameState.active && !window._isThirdPerson?.()) resumeGameFn();
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
            document.getElementById('interaction-prompt').textContent = `Press [${keyLabel(keybinds.interact)}] to open ${passage.label || 'passage'}`;
            showPrompt = true;
            break;
        }
    }

    if (!showPrompt && gameState.mode === 'rescue' && gameState.hostage && !gameState.hostage.rescued) {
        if (camera.position.distanceTo(gameState.hostage.mesh.position) < 5) {
            document.getElementById('interaction-prompt').textContent = `Press [${keyLabel(keybinds.interact)}] to Rescue Hostage`;
            showPrompt = true;
        }
    }

    if (!showPrompt) {
        for (const dw of gameState.droppedWeapons) {
            if (camera.position.distanceTo(dw.mesh.position) < 3) {
                document.getElementById('interaction-prompt').textContent =
                    `Press [${keyLabel(keybinds.interact)}] to pick up ${WEAPONS[dw.weaponId].name}`;
                showPrompt = true;
                break;
            }
        }
    }

    document.getElementById('interaction-prompt').style.display = showPrompt ? 'block' : 'none';
}

export function isMouseDown() { return mouseDown; }
