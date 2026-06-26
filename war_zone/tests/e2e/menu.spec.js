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

    test('rescue mode button opens map screen', async ({ page }) => {
        await freshStart(page);
        await selectMode(page, 'btn-rescue');

        await expect(page.locator('#map-screen')).toBeVisible();
        await expect(page.locator('#ms-mode-badge')).toContainText(/rescue/i);
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
