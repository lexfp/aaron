const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    use: {
        baseURL: 'http://localhost:8080',
        headless: true,
        viewport: { width: 1280, height: 720 },
    },
    webServer: {
        command: 'npx serve . --listen 8080 --no-clipboard',
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
        timeout: 10_000,
    },
});
