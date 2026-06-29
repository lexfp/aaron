# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: game-state.spec.js >> Game state after starting a match >> god mode is off by default
- Location: tests/e2e/game-state.spec.js:34:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForSelector: Target crashed 
Call log:
  - waiting for locator('#homepage') to be hidden

```

# Test source

```ts
  1   | /**
  2   |  * Playwright helpers for Warzone.
  3   |  *
  4   |  * All game state reads go through window.__wz, which is set in main.js
  5   |  * after the ES module boots: window.__wz = { playerState, playerData, gameState }.
  6   |  *
  7   |  * Because three.js and pointer-lock require a real browser context, these
  8   |  * helpers always run inside page.evaluate() — never in Node.
  9   |  */
  10  | 
  11  | /**
  12  |  * Wait until the game module has fully booted:
  13  |  * - window.__wz is set (state bridge)
  14  |  * - window.__wzReady is true (all event listeners attached, after animate() starts)
  15  |  */
  16  | async function waitForBoot(page) {
  17  |     await page.waitForFunction(() => window.__wzReady === true, { timeout: 20_000 });
  18  | }
  19  | 
  20  | /** Read a snapshot of playerState from the live JS object. */
  21  | function getPlayerState(page) {
  22  |     return page.evaluate(() => {
  23  |         const s = window.__wz.playerState;
  24  |         return {
  25  |             hp: s.hp,
  26  |             maxHp: s.maxHp,
  27  |             armor: s.armor,
  28  |             godMode: s.godMode,
  29  |             noClip: s.noClip,
  30  |             flyMode: s.flyMode,
  31  |             stamina: s.stamina,
  32  |         };
  33  |     });
  34  | }
  35  | 
  36  | /** Read a snapshot of gameState from the live JS object. */
  37  | function getGameState(page) {
  38  |     return page.evaluate(() => {
  39  |         const g = window.__wz.gameState;
  40  |         return {
  41  |             mode: g.mode,
  42  |             active: g.active,
  43  |             paused: g.paused,
  44  |             wave: g.wave,
  45  |             zombiesAlive: g.zombiesAlive,
  46  |             pvpRound: g.pvpRound,
  47  |             pvpPlayerScore: g.pvpPlayerScore,
  48  |             currentMap: g.currentMap,
  49  |         };
  50  |     });
  51  | }
  52  | 
  53  | /** Read a snapshot of persistent playerData (money, level, missions, …). */
  54  | function getPlayerData(page) {
  55  |     return page.evaluate(() => {
  56  |         const d = window.__wz.playerData;
  57  |         return {
  58  |             money: d.money,
  59  |             level: d.level,
  60  |             xp: d.xp,
  61  |             missions: d.missions,
  62  |             ownedWeapons: [...d.ownedWeapons],
  63  |             equippedLoadout: [...d.equippedLoadout],
  64  |         };
  65  |     });
  66  | }
  67  | 
  68  | /**
  69  |  * Navigate to the homepage and wait for the game to boot.
  70  |  * Clears localStorage first so every test starts with a clean save.
  71  |  */
  72  | async function freshStart(page) {
  73  |     await page.goto('/war_zone/war_zone.html');
  74  |     await page.evaluate(() => {
  75  |         localStorage.removeItem('shooter_save');
  76  |         // Mark tutorial as seen so the overlay doesn't block homepage clicks
  77  |         localStorage.setItem('warzone_tutorial_seen', '1');
  78  |     });
  79  |     await page.reload();
  80  |     await waitForBoot(page);
  81  |     await page.waitForSelector('#homepage', { state: 'visible' });
  82  | }
  83  | 
  84  | /**
  85  |  * Click a game-mode button and wait for the map selection screen.
  86  |  * modeButtonId: 'btn-zombie' | 'btn-rescue' | 'btn-pvp'
  87  |  */
  88  | async function selectMode(page, modeButtonId) {
  89  |     await page.click(`#${modeButtonId}`);
  90  |     await page.waitForSelector('#map-screen', { state: 'visible' });
  91  | }
  92  | 
  93  | /**
  94  |  * On the map screen, click the first map in the list then click Deploy.
  95  |  * Waits for the canvas to become the active surface (homepage hidden).
  96  |  */
  97  | async function deployFirstMap(page) {
  98  |     await page.locator('#ms-list .ms-item').first().click();
  99  |     await page.click('#ms-deploy-btn');
> 100 |     await page.waitForSelector('#homepage', { state: 'hidden' });
      |                ^ Error: page.waitForSelector: Target crashed 
  101 |     await page.waitForFunction(() => window.__wz.gameState.active === true, { timeout: 10_000 });
  102 | }
  103 | 
  104 | module.exports = { waitForBoot, getPlayerState, getGameState, getPlayerData, freshStart, selectMode, deployFirstMap };
  105 | 
```