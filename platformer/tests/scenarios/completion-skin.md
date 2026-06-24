# Scenarios: Completion Skin

## Scenario 1 — Grant on game completion
Kind: code
Given: `playerData.stagesUnlocked` is 10 and `playerData.skins` has no `champion` key.
When:  `grantCompletionSkin()` is called.
Then:  it returns `true`, `playerData.skins['champion']` is `true`, and `savePlayerData()` is invoked once.
Verify by: Read `grantCompletionSkin` in `platformer/js/state.js` and confirm the `isGameComplete() && !ownsSkin('champion')` branch sets `playerData.skins['champion'] = true`, calls `savePlayerData()`, and returns `true`.

## Scenario 2 — No grant before completion
Kind: code
Given: `playerData.stagesUnlocked` is 9 and `playerData.skins` has no `champion` key.
When:  `grantCompletionSkin()` is called.
Then:  it returns `false`, `playerData.skins` still has no `champion` key, and `savePlayerData()` is not called.
Verify by: Read `isGameComplete` and `grantCompletionSkin` in `platformer/js/state.js` and confirm `stagesUnlocked < 10` yields `false` and short-circuits before any mutation or save.

## Scenario 3 — Idempotent when already owned
Kind: code
Given: `playerData.stagesUnlocked` is 10 and `playerData.skins['champion']` is already `true`.
When:  `grantCompletionSkin()` is called.
Then:  it returns `false` and `savePlayerData()` is not called.
Verify by: Read `grantCompletionSkin` in `platformer/js/state.js` and confirm the `!ownsSkin('champion')` guard prevents re-granting and avoids calling `savePlayerData()`.

## Scenario 4 — Must NOT auto-equip
Kind: code
Given: `playerData.stagesUnlocked` is 10, `playerData.equippedSkin` is `'default'`, `champion` not owned.
When:  `grantCompletionSkin()` is called.
Then:  `playerData.equippedSkin` remains `'default'` and `equipSkin` is never invoked.
Verify by: Read `grantCompletionSkin` in `platformer/js/state.js` and confirm it contains no call to `equipSkin` and no assignment to `playerData.equippedSkin`.

## Scenario 5 — Must NOT mutate SKIN_DEFS
Kind: code
Given: the `champion` entry exists in `SKIN_DEFS`.
When:  `grantCompletionSkin()` newly grants the skin.
Then:  only `playerData.skins` is mutated; `SKIN_DEFS` and `SKIN_MAP` are unchanged.
Verify by: Read `grantCompletionSkin` in `platformer/js/state.js` and confirm the only assignment target is `playerData.skins['champion']`, with no writes to `SKIN_DEFS` or `SKIN_MAP`.

## Scenario 6 — Retroactive grant on load
Kind: code
Given: a saved `playerData` with `stagesUnlocked` of 10 and no `champion` skin, predating this feature.
When:  `loadPlayerData()` runs.
Then:  after merging the save, `grantCompletionSkin()` is called and `playerData.skins['champion']` becomes `true`.
Verify by: Read `loadPlayerData` in `platformer/js/state.js` and confirm `grantCompletionSkin()` is called after the save-merge step.

## Scenario 7 — Grant fires on 10th-stage level completion
Kind: code
Given: completing the final level that finishes the 10th stage in the game loop.
When:  the stage-complete flow runs `markLevelComplete(...)`.
Then:  `grantCompletionSkin()` is called immediately afterward.
Verify by: Read the stage-complete flow in `platformer/js/main.js` and confirm a `grantCompletionSkin()` call directly follows the `markLevelComplete(...)` call.

## Scenario 8 — Champion entry definition
Kind: code
Given: the `SKIN_DEFS` array in `state.js`.
When:  the `champion` entry is inspected.
Then:  it has `key: 'champion'`, `label: 'Champion'`, `desc: 'Awarded for beating all 10 stages.'`, `cost: 0`, `unlock: 'all-stages'`, and `palette: { body: '#f9c74f', accessory_type: 'crown', accessory_color: '#f4a100' }`.
Verify by: Read `SKIN_DEFS` in `platformer/js/state.js` and confirm the `champion` entry matches all listed field values.
