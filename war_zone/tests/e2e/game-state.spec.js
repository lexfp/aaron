const { test, expect } = require('@playwright/test');
const { freshStart, selectMode, deployFirstMap, getPlayerState, getGameState } = require('./harness');

test.describe('Game state after starting a match', () => {
    test('gameState.active becomes true after deploying zombie mode', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');
        await deployFirstMap(page);

        const gs = await getGameState(page);
        expect(gs.active).toBe(true);
        expect(gs.mode).toBe('zombie');
    });

    test('playerState.hp starts at 100', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');
        await deployFirstMap(page);

        const ps = await getPlayerState(page);
        expect(ps.hp).toBe(100);
        expect(ps.maxHp).toBe(100);
    });

    test('playerState.stamina starts at 100', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');
        await deployFirstMap(page);

        const ps = await getPlayerState(page);
        expect(ps.stamina).toBe(100);
    });

    test('god mode is off by default', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');
        await deployFirstMap(page);

        const ps = await getPlayerState(page);
        expect(ps.godMode).toBe(false);
        expect(ps.noClip).toBe(false);
        expect(ps.flyMode).toBe(false);
    });

    test('zombie wave starts at 1', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');
        await deployFirstMap(page);

        const gs = await getGameState(page);
        expect(gs.wave).toBe(1);
    });

    test('currentMap is set after deploying', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');
        await deployFirstMap(page);

        const gs = await getGameState(page);
        expect(gs.currentMap).toBeTruthy();
    });
});

test.describe('HUD DOM elements after starting a match', () => {
    test('HUD elements exist in DOM after game starts', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');
        await deployFirstMap(page);

        const hudCount = await page.locator('[id*="hud"]').count();
        expect(hudCount).toBeGreaterThan(0);
    });
});
