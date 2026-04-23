import { playerData, savePlayerData } from './state.js';
import { WEAPONS } from './data.js';

const PURCHASABLE_WEAPONS = Object.keys(WEAPONS).filter(
    k => WEAPONS[k].cost > 0 && !['compass', 'flashlight'].includes(k)
);

export const ACHIEVEMENTS = [
    // --- Kills ---
    {
        id: 'first_blood', name: 'First Blood', desc: 'Kill your first zombie', reward: 500,
        check: pd => pd.totalZombieKills >= 1,
    },
    {
        id: 'zombie_slayer', name: 'Zombie Slayer', desc: 'Kill 50 zombies', reward: 5000,
        check: pd => pd.totalZombieKills >= 50,
        progress: pd => ({ current: pd.totalZombieKills, max: 50 }),
    },
    {
        id: 'zombie_veteran', name: 'Zombie Veteran', desc: 'Kill 500 zombies', reward: 30000,
        check: pd => pd.totalZombieKills >= 500,
        progress: pd => ({ current: pd.totalZombieKills, max: 500 }),
    },
    {
        id: 'zombie_god', name: 'Zombie God', desc: 'Kill 5,000 zombies', reward: 200000,
        check: pd => pd.totalZombieKills >= 5000,
        progress: pd => ({ current: pd.totalZombieKills, max: 5000 }),
    },
    // --- Rescue ---
    {
        id: 'rescue_rookie', name: 'Rescue Rookie', desc: 'Complete your first rescue mission', reward: 1000,
        check: pd => pd.totalRescueCompletions >= 1,
    },
    {
        id: 'hostage_hero', name: 'Hostage Hero', desc: 'Complete 10 rescue missions', reward: 5000,
        check: pd => pd.totalRescueCompletions >= 10,
        progress: pd => ({ current: pd.totalRescueCompletions, max: 10 }),
    },
    {
        id: 'speed_runner', name: 'Speed Runner', desc: 'Beat rescue in under 3 minutes', reward: 2000,
        check: pd => pd.bestRescueTime !== null && pd.bestRescueTime <= 180,
    },
    {
        id: 'lightning_run', name: 'Lightning Run', desc: 'Beat rescue in under 90 seconds', reward: 5000,
        check: pd => pd.bestRescueTime !== null && pd.bestRescueTime <= 90,
    },
    // --- PvP ---
    {
        id: 'arena_warrior', name: 'Arena Warrior', desc: 'Win your first PvP match', reward: 500,
        check: pd => pd.totalPvpWins >= 1,
    },
    {
        id: 'arena_champion', name: 'Arena Champion', desc: 'Win 10 PvP matches', reward: 3000,
        check: pd => pd.totalPvpWins >= 10,
        progress: pd => ({ current: pd.totalPvpWins, max: 10 }),
    },
    // --- Zombie Session ---
    {
        id: 'wave_crasher', name: 'Wave Crasher', desc: 'Kill 50 zombies in one session', reward: 1000,
        check: pd => pd.bestZombieSession >= 50,
        progress: pd => ({ current: pd.bestZombieSession, max: 50 }),
    },
    {
        id: 'wave_master', name: 'Wave Master', desc: 'Kill 150 zombies in one session', reward: 5000,
        check: pd => pd.bestZombieSession >= 150,
        progress: pd => ({ current: pd.bestZombieSession, max: 150 }),
    },
    // --- Combat ---
    {
        id: 'headhunter', name: 'Headhunter', desc: 'Land 50 headshot kills', reward: 1000,
        check: pd => pd.totalHeadshotKills >= 50,
        progress: pd => ({ current: pd.totalHeadshotKills, max: 50 }),
    },
    {
        id: 'untouchable', name: 'Untouchable', desc: 'Win a mission without taking damage', reward: 2000,
        check: pd => pd.flawlessRuns >= 1,
    },
    {
        id: 'demolitions', name: 'Demolitions Expert', desc: 'Get 25 explosive kills', reward: 1500,
        check: pd => pd.totalExplosiveKills >= 25,
        progress: pd => ({ current: pd.totalExplosiveKills, max: 25 }),
    },
    {
        id: 'airstrike_cmd', name: 'Airstrike Commander', desc: 'Call 5 airstrikes', reward: 1000,
        check: pd => pd.totalAirstrikes >= 5,
        progress: pd => ({ current: pd.totalAirstrikes, max: 5 }),
    },
    {
        id: 'apex_hunter', name: 'Apex Hunter', desc: 'Kill an Apex Zombie', reward: 1500,
        check: pd => pd.apexKills >= 1,
    },
    {
        id: 'giga_slayer', name: 'Giga Slayer', desc: 'Kill a Giga Zombie', reward: 2000,
        check: pd => pd.gigaKills >= 1,
    },
    // --- Progression ---
    {
        id: 'arms_dealer', name: 'Arms Dealer', desc: 'Own every weapon', reward: 5000,
        check: pd => PURCHASABLE_WEAPONS.every(k => pd.ownedWeapons.includes(k)),
        progress: pd => ({ current: PURCHASABLE_WEAPONS.filter(k => pd.ownedWeapons.includes(k)).length, max: PURCHASABLE_WEAPONS.length }),
    },
    {
        id: 'field_medic', name: 'Field Medic', desc: 'Use 20 med kits', reward: 500,
        check: pd => pd.totalMedkitsUsed >= 20,
        progress: pd => ({ current: pd.totalMedkitsUsed, max: 20 }),
    },
];

// --- Toast ---

let _toastCount = 0;

function showAchievementToast(name, reward) {
    const hud = document.getElementById('hud');
    if (!hud) return;

    const toast = document.createElement('div');
    const offset = Math.min(_toastCount, 3) * 90;
    _toastCount++;

    toast.style.cssText = `
        position:absolute; top:${16 + offset}px; right:16px;
        background:rgba(0,0,0,0.88); border:2px solid #ffaa00;
        border-radius:8px; padding:10px 16px; color:#fff;
        font-family:monospace; font-size:13px; line-height:1.5;
        z-index:500; pointer-events:none; text-align:right;
        opacity:1; transition:opacity 0.6s;
        box-shadow:0 0 12px rgba(255,170,0,0.4);
    `;
    toast.innerHTML = `<span style="color:#ffaa00;font-weight:700;">🏆 Achievement Unlocked</span><br>${name}<br><span style="color:#00ff88">+$${reward.toLocaleString()}</span>`;
    hud.appendChild(toast);

    setTimeout(() => { toast.style.opacity = '0'; }, 3400);
    setTimeout(() => { toast.remove(); _toastCount = Math.max(0, _toastCount - 1); }, 4000);
}

// --- Check ---

export function checkAchievements() {
    for (const a of ACHIEVEMENTS) {
        if (playerData.achievements[a.id]) continue;
        if (!a.check(playerData)) continue;
        playerData.achievements[a.id] = true;
        playerData.money += a.reward;
        playerData.totalMoneyEarned = (playerData.totalMoneyEarned || 0) + a.reward;
        savePlayerData();
        showAchievementToast(a.name, a.reward);
    }
}

// --- Overlay UI ---

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildOverlayContent() {
    const unlocked = ACHIEVEMENTS.filter(a => playerData.achievements[a.id]).length;
    const total = ACHIEVEMENTS.length;

    let html = `
        <h2 style="color:#ffaa00;margin:0 0 6px;font-size:1.4rem;text-align:center;letter-spacing:2px;">ACHIEVEMENTS</h2>
        <div style="text-align:center;color:#aaa;font-size:13px;margin-bottom:8px;">${unlocked} / ${total} Unlocked</div>
    `;

    if (playerData.bestRescueTime !== null) {
        html += `<div style="text-align:center;color:#88ccff;font-size:13px;margin-bottom:14px;">Best Rescue Time: <strong>${formatTime(playerData.bestRescueTime)}</strong></div>`;
    }

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';

    for (const a of ACHIEVEMENTS) {
        const done = !!playerData.achievements[a.id];
        const prog = a.progress ? a.progress(playerData) : null;
        const border = done ? '#ffaa00' : '#444';
        const nameColor = done ? '#fff' : '#777';
        const descColor = done ? '#aaa' : '#555';
        const rewardColor = done ? '#00ff88' : '#555';
        const icon = done ? '✓' : '🔒';

        let progressHTML = '';
        if (prog) {
            const pct = Math.min(100, Math.round((prog.current / prog.max) * 100));
            const cur = Math.min(prog.current, prog.max);
            progressHTML = `
                <div style="margin-top:6px;font-size:11px;color:#888;">${cur.toLocaleString()} / ${prog.max.toLocaleString()}</div>
                <div style="height:3px;background:#222;border-radius:2px;margin-top:3px;">
                    <div style="height:100%;width:${pct}%;background:${done ? '#ffaa00' : '#555'};border-radius:2px;"></div>
                </div>
            `;
        }

        html += `
            <div style="border:1px solid ${border};border-radius:8px;padding:10px 12px;background:rgba(0,0,0,0.4);">
                <div style="font-size:13px;font-weight:700;color:${nameColor};">${icon} ${a.name}</div>
                <div style="font-size:11px;color:${descColor};margin-top:3px;">${a.desc}</div>
                ${progressHTML}
                <div style="font-size:11px;color:${rewardColor};margin-top:5px;">Reward: $${a.reward.toLocaleString()}</div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

export function openAchievementsScreen() {
    const overlay = document.getElementById('achievements-overlay');
    if (!overlay) return;
    const panel = overlay.querySelector('.ach-panel');
    if (panel) panel.innerHTML = buildOverlayContent();
    overlay.style.display = 'flex';
}

export function initAchievementsUI() {
    const overlay = document.getElementById('achievements-overlay');
    if (!overlay) return;

    overlay.innerHTML = `
        <div class="ach-panel" style="background:linear-gradient(135deg,#0a0a1a,#1a1a2e);border:1px solid #444;border-radius:14px;padding:32px 40px;max-width:700px;width:92%;max-height:84vh;overflow-y:auto;"></div>
    `;

    const panel = overlay.querySelector('.ach-panel');
    panel.innerHTML = buildOverlayContent();

    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.style.display = 'none';
    });
}
