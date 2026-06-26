const { test, expect } = require('@playwright/test');
const { freshStart, getPlayerData, selectMode } = require('./harness');

test.describe('Homepage & menus', () => {
    test('homepage shows correct default stats', async ({ page }) => {
        await freshStart(page);

        await expect(page.locator('#home-money')).toHaveText('$100');
        await expect(page.locator('#home-level')).toHaveText('1');
        await expect(page.locator('#home-missions')).toHaveText('0');
    });

    test('playerData defaults match displayed values', async ({ page }) => {
        await freshStart(page);
        const data = await getPlayerData(page);

        expect(data.money).toBe(100);
        expect(data.level).toBe(1);
        expect(data.missions).toBe(0);
        expect(data.ownedWeapons).toContain('fists');
        expect(data.ownedWeapons).toContain('glock');
    });

    test('zombie mode button opens map screen', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');

        await expect(page.locator('#map-screen')).toBeVisible();
        await expect(page.locator('#ms-mode-badge')).toContainText(/zombie/i);
    });

    test('rescue mode button shows a warning or starts game', async ({ page }) => {
        // Rescue bypasses the map screen. Below level 10 it shows a warning overlay;
        // at level 10+ it goes straight to the game. Either is a valid response.
        await freshStart(page);
        await page.click('#btn-rescue');
        const warningVisible = await page.locator('#rescue-warning-overlay').isVisible();
        const gameStarted = await page.evaluate(() => window.__wz.gameState.active);
        expect(warningVisible || gameStarted).toBe(true);
    });

    test('back button on map screen returns to homepage', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-zombie');
        await page.click('.ms-back-btn');

        await expect(page.locator('#homepage')).toBeVisible();
    });

    test('achievements overlay opens', async ({ page }) => {
        await freshStart(page);
        await page.evaluate(() => window._openAchievements && window._openAchievements());
        await expect(page.locator('#achievements-overlay')).toBeVisible();
    });
});
