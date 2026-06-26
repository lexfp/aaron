const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    use: {
        baseURL: 'http://127.0.0.1:9876',
        headless: true,
        viewport: { width: 1280, height: 720 },
    },
    webServer: {
        command: 'python3 -m http.server 9876 --bind 127.0.0.1 --directory ..',
        url: 'http://127.0.0.1:9876',
        reuseExistingServer: !process.env.CI,
        timeout: 10_000,
    },
});
