# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Slope Phasing Bug
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate all three root causes
  - **Scoped PBT Approach**: Scope each sub-property to a concrete failing scenario for reproducibility
  - Sub-property A — Reachability failure: mock a slope mesh at Y=5, call `getFloorHeight` with `pos.y=1.7` (feetY=0); unfixed code returns 5 (surface above head), expected ≤ 0.8 above feetY
  - Sub-property B — No AABB box on slope: add a slope entry `{ mesh, isSlope: true }` (no `box`); call `checkCollision` with a position inside the slope's bounding volume; unfixed code returns `false` (no collision), expected `true`
  - Sub-property C — Steepness guard wrong reference Y: set `camera.position.y = 3.7` (feetY=2.0), call `checkCollision(newPos)` where `newPos.y = 1.7` and slope at new XZ is at Y=2.4; unfixed code compares against `newPos.y - 1.7 = 0` instead of `camera.position.y - 1.7 = 2.0`, producing wrong allow/block decision
  - Sub-property D — Fall-through with overhead slope: two slope meshes stacked — one at Y=2 (floor), one at Y=8 (overhang); player at feetY=0; unfixed `getFloorHeight` returns 8 (wrong — picks highest hit)
  - Run all sub-properties on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "getFloorHeight(pos) returns 5 when feetY=0 and slope is at Y=5")
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Slope and Non-Mountain Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `getFloorHeight` with no slope meshes and flat ground returns 0 on unfixed code
  - Observe: `getFloorHeight` above a box obstacle returns `obs.box.max.y` on unfixed code
  - Observe: `checkCollision` returns `false` immediately when `godMode` or `noClip` is set on unfixed code
  - Observe: `checkCollision` on non-mountain map never enters the slope steepness guard on unfixed code
  - Write property-based test: for all random (x, z) positions with no slope meshes (`slopeMeshes = []`), `getFloorHeight` returns the same value before and after the fix
  - Write property-based test: for all random positions above box obstacles, `getFloorHeight` returns `obs.box.max.y` both before and after the fix
  - Write property-based test: for any map other than `mountain`, `checkCollision` and `getFloorHeight` return identical results before and after the fix
  - Write property-based test: `checkCollision` returns `false` for all positions when `godMode` or `noClip` is true
  - Verify all tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 3. Fix slope phasing on mountain map

  - [x] 3.1 Add reachability filter to slope hit selection in `getFloorHeight` (main.js)
    - In the `downHits` loop, add condition `hitY <= feetY + 0.8` alongside the existing `hitY < ceilingY` check
    - This prevents surfaces above the player's reachable step-up range from being returned as the floor
    - Before: `if (hitY < ceilingY) { if (hitY > floor) floor = hitY; }`
    - After: `if (hitY < ceilingY && hitY <= feetY + 0.8) { if (hitY > floor) floor = hitY; }`
    - _Bug_Condition: isBugCondition(pos) where slopeMeshes ray returns a hit above feetY + 0.8_
    - _Expected_Behavior: getFloorHeight returns a value ≤ feetY + 0.8 for all slope hits_
    - _Preservation: AABB box floor detection path is unchanged; non-mountain maps unaffected_
    - _Requirements: 2.4, 3.1, 3.4_

  - [x] 3.2 Fix steepness guard reference Y in `checkCollision` (main.js)
    - Replace `pMinY` (derived from `newPos.y - 1.7`) with `camera.position.y - 1.7` in the mountain steepness guard
    - Before: `if (floorAtNew > pMinY + 0.6) return true;`
    - After: `const currentFeetY = camera.position.y - 1.7; if (floorAtNew > currentFeetY + 0.6) return true;`
    - _Bug_Condition: isBugCondition(pos) where newPos.y differs from camera.position.y mid-movement_
    - _Expected_Behavior: steepness guard compares slope height against current feet Y, not proposed position Y_
    - _Preservation: godMode/noClip short-circuit is before this code and remains unchanged_
    - _Requirements: 2.3, 3.6_

  - [x] 3.3 Add AABB box to slope mesh entries in `buildMap` mountain branch (map.js)
    - After creating each slope mesh, call `slope.updateMatrixWorld(true)` and add `box: new THREE.Box3().setFromObject(slope)` to the pushed entry
    - Before: `obs.push({ mesh: slope, isSlope: true });`
    - After: `slope.updateMatrixWorld(true); obs.push({ mesh: slope, isSlope: true, box: new THREE.Box3().setFromObject(slope) });`
    - _Bug_Condition: isBugCondition(pos) where slope entry has no `box` and AABB loop skips it_
    - _Expected_Behavior: checkCollision AABB loop detects slope mesh as a collidable obstacle_
    - _Preservation: non-mountain map obstacle entries are unchanged; existing box entries unaffected_
    - _Requirements: 2.1, 2.2, 3.2_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Slope Phasing Bug
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior for all three root causes
    - When this test passes, it confirms all three fixes are correctly applied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Slope and Non-Mountain Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm flat ground, box obstacles, non-mountain maps, and godMode/noClip all behave identically to pre-fix code

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass; ask the user if questions arise
