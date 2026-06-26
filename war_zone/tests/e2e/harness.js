/**
 * Playwright helpers for Warzone.
 *
 * All game state reads go through window.__wz, which is set in main.js
 * after the ES module boots: window.__wz = { playerState, playerData, gameState }.
 *
 * Because three.js and pointer-lock require a real browser context, these
 * helpers always run inside page.evaluate() — never in Node.
 */

/**
 * Wait until the game module has fully booted:
 * - window.__wz is set (state bridge)
 * - window.__wzReady is true (all event listeners attached, after animate() starts)
 */
async function waitForBoot(page) {
    await page.waitForFunction(() => window.__wzReady === true, { timeout: 20_000 });
}

/** Read a snapshot of playerState from the live JS object. */
function getPlayerState(page) {
    return page.evaluate(() => {
        const s = window.__wz.playerState;
        return {
            hp: s.hp,
            maxHp: s.maxHp,
            armor: s.armor,
            godMode: s.godMode,
            noClip: s.noClip,
            flyMode: s.flyMode,
            stamina: s.stamina,
        };
    });
}

/** Read a snapshot of gameState from the live JS object. */
function getGameState(page) {
    return page.evaluate(() => {
        const g = window.__wz.gameState;
        return {
            mode: g.mode,
            active: g.active,
            paused: g.paused,
            wave: g.wave,
            zombiesAlive: g.zombiesAlive,
            pvpRound: g.pvpRound,
            pvpPlayerScore: g.pvpPlayerScore,
            currentMap: g.currentMap,
        };
    });
}

/** Read a snapshot of persistent playerData (money, level, missions, …). */
function getPlayerData(page) {
    return page.evaluate(() => {
        const d = window.__wz.playerData;
        return {
            money: d.money,
            level: d.level,
            xp: d.xp,
            missions: d.missions,
            ownedWeapons: [...d.ownedWeapons],
            equippedLoadout: [...d.equippedLoadout],
        };
    });
}

/**
 * Navigate to the homepage and wait for the game to boot.
 * Clears localStorage first so every test starts with a clean save.
 */
async function freshStart(page) {
    await page.goto('/war_zone/war_zone.html');
    await page.evaluate(() => {
        localStorage.removeItem('shooter_save');
        // Mark tutorial as seen so the overlay doesn't block homepage clicks
        localStorage.setItem('warzone_tutorial_seen', '1');
    });
    await page.reload();
    await waitForBoot(page);
    await page.waitForSelector('#homepage', { state: 'visible' });
}

/**
 * Click a game-mode button and wait for the map selection screen.
 * modeButtonId: 'btn-zombie' | 'btn-rescue' | 'btn-pvp'
 */
async function selectMode(page, modeButtonId) {
    await page.click(`#${modeButtonId}`);
    await page.waitForSelector('#map-screen', { state: 'visible' });
}

/**
 * On the map screen, click the first map in the list then click Deploy.
 * Waits for the canvas to become the active surface (homepage hidden).
 */
async function deployFirstMap(page) {
    await page.locator('#ms-list .ms-item').first().click();
    await page.click('#ms-deploy-btn');
    await page.waitForSelector('#homepage', { state: 'hidden' });
    await page.waitForFunction(() => window.__wz.gameState.active === true, { timeout: 10_000 });
}

module.exports = { waitForBoot, getPlayerState, getGameState, getPlayerData, freshStart, selectMode, deployFirstMap };
