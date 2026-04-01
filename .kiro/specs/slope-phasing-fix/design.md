# Slope Phasing Fix — Bugfix Design

## Overview

Players on the mountain map can walk or fall through sloped geometry as if it were not solid.
The slopes are visually present but their collision is unreliable: the player's Y position is
not correctly snapped to the slope surface, allowing them to phase through it and potentially
fall out of bounds.

Three root causes have been identified, all in `war_zone/js/main.js`:

1. `getFloorHeight` picks the highest slope raycast hit regardless of whether that surface is
   reachable from the player's current feet position.
2. `checkCollision`'s steepness guard calls `getFloorHeight(newPos)` — using the *new* position
   before the player has moved there — so the height comparison is made against the wrong
   reference Y.
3. Slope meshes in the mountain map are pushed into `obs` with `{ mesh, isSlope: true }` but
   **no `box` property**, so `checkCollision`'s AABB loop skips them entirely and all collision
   relies solely on the post-movement floor snap in the game loop.

The fix is confined to `getFloorHeight` and `checkCollision` in `main.js`, with no changes to
`entities.js`, `map.js`, or any other file.

---

## Glossary

- **Bug_Condition (C)**: The set of inputs that trigger the phasing bug — player positions
  whose XZ coordinates fall within a slope mesh's footprint but where `getFloorHeight` returns
  a value that does not reflect the actual slope surface height.
- **Property (P)**: The desired correct behavior — for any position within a slope mesh's XZ
  footprint, `getFloorHeight` SHALL return a floor height ≥ the slope surface at that point,
  and the player SHALL be snapped to that height.
- **Preservation**: Existing behavior for flat ground, box obstacles, jumps, non-mountain maps,
  zombie floor tracking, and cheat modes that must remain unchanged by the fix.
- **`getFloorHeight(pos)`**: Function in `war_zone/js/main.js` that returns the highest valid
  floor Y beneath `pos`, used by the game loop to snap the player to the ground each frame.
- **`checkCollision(newPos)`**: Function in `war_zone/js/main.js` that returns `true` if moving
  the player to `newPos` would cause a collision, blocking horizontal movement.
- **`slopeMeshes`**: Array stored on `gameState` (populated by `buildMap` for the mountain map)
  containing the rotated `THREE.Mesh` objects that represent sloped geometry.
- **`feetY`**: The player's feet Y coordinate, computed as `camera.position.y - 1.7`.
- **step-up tolerance**: The maximum height difference (currently 0.6 m in `checkCollision`,
  0.8 m in `getFloorHeight`) that the player can step up without being blocked.

---

## Bug Details

### Bug Condition

The bug manifests when the player's XZ position overlaps a slope mesh on the mountain map.
`getFloorHeight` casts a ray from Y=200 downward and collects all hits, but then picks the
highest hit without checking whether that surface is actually reachable from the player's
current feet. Simultaneously, `checkCollision`'s steepness guard evaluates the floor height
at the *proposed* new position rather than comparing it against the player's *current* feet,
producing an incorrect allow/block decision. Because slope meshes have no AABB box, the
standard box-collision loop in `checkCollision` never fires for them at all.

**Formal Specification:**
```
FUNCTION isBugCondition(pos)
  INPUT:  pos — THREE.Vector3 representing camera position (feet at pos.y - 1.7)
  OUTPUT: boolean

  feetY        := pos.y - 1.7
  slopeMeshes  := gameState.slopeMeshes

  // Condition A: player is over a slope mesh footprint
  overSlope := EXISTS mesh IN slopeMeshes
                 SUCH THAT xzFootprintContains(mesh, pos.x, pos.z)

  // Condition B: getFloorHeight returns a value that does not reflect the slope surface
  //   (either 0 because the highest hit is above feetY, or wrong because it ignores reachability)
  reportedFloor := getFloorHeight(pos)
  actualSurface := trueSlopeSurfaceY(pos.x, pos.z)   // ground truth via mesh geometry
  floorIsWrong  := ABS(reportedFloor - actualSurface) > 0.05

  RETURN overSlope AND floorIsWrong
END FUNCTION
```

### Examples

- **Horizontal walk-through**: Player at Y=1.7 (ground level) walks forward onto a slope that
  rises to Y=3. `getFloorHeight` casts from Y=200, finds the slope surface at Y=3, but because
  the highest hit (Y=3) is above `feetY` (Y=0) by more than the 0.8 m tolerance, the current
  code still returns it — however the steepness guard in `checkCollision` uses `getFloorHeight`
  at the *new* XZ position before the player is there, so it compares against the wrong
  reference and may allow or block incorrectly. Result: player phases through.

- **Fall-through**: Player falls from Y=10 toward a slope at Y=4. The downward ray hits the
  slope at Y=4, but the current `getFloorHeight` picks the highest hit without a reachability
  check. If a second slope mesh exists above the player (e.g. an overhanging rock rotated
  outward), its hit at Y=8 is picked instead of Y=4, so `targetFloorY` is set to 9.7 and the
  player is teleported upward — or if no hit is reachable, floor=0 and the player falls through.

- **Steepness guard misfire**: Player stands at Y=3 (feetY=1.3) and tries to step to a
  position where the slope is at Y=2. `checkCollision` calls `getFloorHeight(newPos)` which
  returns 2. It then compares 2 > `pMinY + 0.6` where `pMinY = newPos.y - 1.7`. Because
  `newPos.y` is still the *old* camera Y (1.7 hasn't been updated yet), `pMinY` is wrong and
  the comparison produces an incorrect block.

- **Edge case — no slope nearby**: Player is on flat ground far from any slope mesh.
  `slopeMeshes` ray finds no hits; `getFloorHeight` returns the AABB box floor correctly.
  This case is unaffected and must remain unchanged.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Walking on flat ground (non-slope surfaces) keeps the player grounded at Y = floor + 1.7.
- Box obstacle (crates, walls, buildings) horizontal collision continues to block correctly.
- Jump force, gravity, and landing on both flat and sloped surfaces work as before.
- On non-mountain maps (`slopeMeshes` is empty), `getFloorHeight` and `checkCollision` produce
  identical results to the pre-fix code.
- Zombie floor-tracking raycasts in `entities.js` are not touched and continue to work.
- `godMode` / `noClip` bypass in `checkCollision` continues to short-circuit all checks.

**Scope:**
All inputs where `isBugCondition` returns `false` — i.e. the player is not over a slope mesh,
or `getFloorHeight` already returns the correct surface height — must be completely unaffected.
This includes:
- Any position on the warehouse, desert, city, or forest maps.
- Any position on the mountain map that is not within a slope mesh's XZ footprint.
- Mouse/keyboard input handling, weapon logic, zombie AI, and all other game systems.

---

## Hypothesized Root Cause

1. **`getFloorHeight` ignores reachability of slope hits**: The downward ray from Y=200 finds
   all slope surfaces in the column, but the loop picks the highest `hitY < ceilingY` without
   checking whether `hitY` is within step-up range of the player's current `feetY`. A surface
   that is 5 m above the player's feet should not be returned as the floor.

2. **`checkCollision` steepness guard uses wrong reference Y**: The guard computes
   `pMinY = newPos.y - 1.7` where `newPos` is the *proposed* position (camera Y has not been
   updated yet). It should compare the slope height at the new XZ against the player's
   *current* feet Y (`camera.position.y - 1.7`) to decide if the step is too steep.

3. **Slope meshes have no AABB box**: In `map.js`, slope meshes are added as
   `obs.push({ mesh: slope, isSlope: true })` with no `box` property. The AABB collision loop
   in `checkCollision` only processes entries with `obs.box`, so slope meshes are invisible to
   horizontal collision detection. Adding a `box` (or a radius) to slope entries would give
   them a first-pass collision shape before the floor-snap corrects the Y.

4. **Dual-raycast ceiling check is insufficient**: The upward ray from `feetY + 0.1` finds the
   nearest ceiling, but this only filters hits *above* the ceiling — it does not filter hits
   that are above the player's reachable step-up range. The two checks need to be combined:
   a hit is a valid floor only if `hitY <= feetY + stepUpTolerance`.

---

## Correctness Properties

Property 1: Bug Condition — Slope Surface Detection

_For any_ camera position `pos` where `isBugCondition(pos)` is true (the player is over a
slope mesh footprint and the current code returns the wrong floor height), the fixed
`getFloorHeight` SHALL return a floor height within 0.05 m of the actual slope surface at
`(pos.x, pos.z)`, and the fixed `checkCollision` SHALL correctly allow or block horizontal
movement based on the player's *current* feet Y rather than the proposed position's Y.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation — Non-Slope Input Behavior

_For any_ camera position `pos` where `isBugCondition(pos)` is false (player is not over a
slope mesh, or is on a non-mountain map), the fixed `getFloorHeight` and `checkCollision`
SHALL produce exactly the same return values as the original functions, preserving all
existing floor detection and collision behavior for flat ground, box obstacles, and all
non-mountain maps.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

Assuming the root cause analysis above is correct:

**File**: `war_zone/js/main.js`

**Function**: `getFloorHeight(pos)`

**Specific Changes**:

1. **Add reachability filter to slope hit selection**: After collecting `downHits`, only
   consider a hit as a valid floor if `hitY <= feetY + stepUpTolerance` (e.g. 0.8 m). This
   prevents surfaces above the player's head from being returned as the floor.

   ```
   // Before (buggy):
   if (hitY < ceilingY) {
       if (hitY > floor) floor = hitY;
   }

   // After (fixed):
   const STEP_UP = 0.8;
   if (hitY < ceilingY && hitY <= feetY + STEP_UP) {
       if (hitY > floor) floor = hitY;
   }
   ```

**File**: `war_zone/js/main.js`

**Function**: `checkCollision(newPos)`

**Specific Changes**:

2. **Fix steepness guard reference Y**: Replace `pMinY` (derived from `newPos.y`) with the
   player's *current* feet Y when evaluating slope steepness.

   ```
   // Before (buggy):
   if (gameState.currentMap === 'mountain') {
       const floorAtNew = getFloorHeight(newPos);
       if (floorAtNew > pMinY + 0.6) return true;
   }

   // After (fixed):
   if (gameState.currentMap === 'mountain') {
       const floorAtNew = getFloorHeight(newPos);
       const currentFeetY = camera.position.y - 1.7;
       if (floorAtNew > currentFeetY + 0.6) return true;
   }
   ```

**File**: `war_zone/js/map.js`

**Function**: `buildMap` — mountain map branch

**Specific Changes**:

3. **Add AABB box to slope mesh entries**: After creating each slope mesh, call
   `slope.updateMatrixWorld(true)` and attach a `box` so the standard AABB collision loop
   in `checkCollision` can provide a first-pass horizontal block for slope geometry.

   ```
   // Before (buggy):
   obs.push({ mesh: slope, isSlope: true });

   // After (fixed):
   slope.updateMatrixWorld(true);
   obs.push({ mesh: slope, isSlope: true, box: new THREE.Box3().setFromObject(slope) });
   ```

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that
demonstrate the bug on unfixed code, then verify the fix works correctly and preserves
existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix.
Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that call `getFloorHeight` and `checkCollision` directly with
crafted positions over mock slope meshes. Run these tests on the UNFIXED code to observe
failures and confirm the root causes.

**Test Cases**:
1. **Reachability failure**: Place a slope mesh at Y=5. Call `getFloorHeight` with a position
   where `feetY = 0`. Expect the unfixed code to return 5 (wrong — surface is above the
   player's head). (will fail on unfixed code)
2. **Steepness guard wrong reference**: Player camera at Y=3 (feetY=1.3). Call
   `checkCollision(newPos)` where `newPos.y = 3` and slope at new XZ is at Y=2.5. Expect the
   unfixed code to use `pMinY = newPos.y - 1.7 = 1.3` — which happens to be correct here —
   but when `newPos.y` differs from `camera.position.y` (mid-movement), the comparison is
   wrong. (will fail on unfixed code with crafted mid-movement scenario)
3. **No AABB box on slope**: Add a slope mesh to `obstacles` without a `box`. Call
   `checkCollision` with a position inside the slope's bounding volume. Expect the unfixed
   code to return `false` (no collision detected). (will fail on unfixed code)
4. **Fall-through with overhead slope**: Two slope meshes stacked — one at Y=2 (floor), one
   at Y=8 (overhang). Player at feetY=0. Expect unfixed `getFloorHeight` to return 8 (wrong).
   (will fail on unfixed code)

**Expected Counterexamples**:
- `getFloorHeight` returns a surface height above the player's head instead of the nearest
  reachable floor below.
- `checkCollision` returns `false` for positions inside slope mesh bounding volumes because
  no `box` property exists.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions
produce the expected behavior.

**Pseudocode:**
```
FOR ALL pos WHERE isBugCondition(pos) DO
  fixedFloor := getFloorHeight_fixed(pos)
  actualSurface := trueSlopeSurfaceY(pos.x, pos.z)
  ASSERT ABS(fixedFloor - actualSurface) <= 0.05

  fixedCollision := checkCollision_fixed(pos)
  ASSERT fixedCollision == expectedCollisionResult(pos)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed
functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL pos WHERE NOT isBugCondition(pos) DO
  ASSERT getFloorHeight_original(pos) == getFloorHeight_fixed(pos)
  ASSERT checkCollision_original(pos) == checkCollision_fixed(pos)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain.
- It catches edge cases that manual unit tests might miss.
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on UNFIXED code for flat-ground and box-obstacle positions,
capture the return values, then write property-based tests asserting the fixed code returns
identical values for those same inputs.

**Test Cases**:
1. **Flat ground preservation**: For random (x, z) positions on a flat ground plane with no
   slope meshes, verify `getFloorHeight` returns 0 both before and after the fix.
2. **Box obstacle floor preservation**: For random positions above box obstacles, verify
   `getFloorHeight` returns `obs.box.max.y` both before and after the fix.
3. **Non-mountain map preservation**: For any map other than `mountain` (`slopeMeshes` empty),
   verify `getFloorHeight` and `checkCollision` return identical results before and after fix.
4. **godMode/noClip preservation**: Verify `checkCollision` returns `false` immediately when
   either flag is set, regardless of position.

### Unit Tests

- Test `getFloorHeight` with a single slope mesh: player below the surface → returns surface Y.
- Test `getFloorHeight` with a slope mesh above the player's head → returns 0 (not the overhead surface).
- Test `getFloorHeight` with two stacked slopes → returns the lower reachable one, not the overhead one.
- Test `checkCollision` with a slope mesh entry that has a `box` → returns `true` when inside.
- Test `checkCollision` steepness guard uses `camera.position.y` not `newPos.y` as reference.
- Test `checkCollision` on non-mountain map → slope steepness guard is never evaluated.

### Property-Based Tests

- Generate random positions above slope meshes; verify fixed `getFloorHeight` always returns
  a value ≤ `feetY + 0.8` (reachability invariant).
- Generate random positions on flat ground (no slope meshes); verify `getFloorHeight` returns
  the same value before and after the fix (preservation invariant).
- Generate random positions near box obstacles; verify `checkCollision` returns the same
  result before and after the fix (box collision preservation invariant).
- Generate random positions on non-mountain maps; verify both functions are unchanged.

### Integration Tests

- Load the mountain map, spawn the player at ground level, walk toward a slope, and verify
  the player's Y smoothly follows the slope surface without phasing through.
- Load the mountain map, drop the player from height onto a slope, and verify the player
  lands on the slope surface rather than falling through.
- Load the warehouse map, verify all existing box-obstacle collisions are unaffected.
- Enable `noClip`, walk into a slope mesh, verify the player passes through (cheat preserved).
