# Design Document: Cave Map Redesign

## Overview

This redesign updates the cave map's visual style, size, and layout while preserving all original functional requirements (multi-cavern layout, tunnel connectivity, zombie spawn cavern, collision, ambient audio, all three game mode compatibility).

The key changes:
- **Size:** 90 (down from 200)
- **Layout:** One central entrance cavern + two wings (left warm, right dark) — four caverns total
- **Aesthetic:** Warm orange/sandy natural cave in the forward chambers; cold dark crystal cave in the deep right wing
- **Exit:** Walkable opening from the central cavern into a small outdoor area with night sky
- **Lighting:** Torches replace crystals as primary light source in the forward chambers; crystals remain in the deep wing

All requirements from `.kiro/specs/cave-map/requirements.md` remain in effect. This document supersedes the visual and size properties in the original design doc (`.kiro/specs/cave-map/design.md`) while leaving all structural/gameplay properties unchanged.

---

## Layout

### Caverns (4 total — satisfies Req 2.2)

| Cavern | Role | Radius | Position (approx) | Light source |
|--------|------|--------|-------------------|--------------|
| Central | Entrance / player spawn | ~18 | (0, 0) | 3 torches |
| Left wing | Side chamber | ~12 | (-40, -12) | 1 torch |
| Right shallow | Transition zone | ~11 | (40, -12) | 1 torch + 1 crystal |
| Right deep | Zombie spawn cavern | ~12 | (55, -52) | Crystals only |

Positions are hardcoded in `buildCaveMap` (not randomly placed) so the two-wing layout is always the same. The seeded RNG (`mulberry32(0xCA1E1234)`) is used only for fine-grained visual variation — rock segment widths, stalactite sizes, formation scatter. Implementation must verify that no two caverns overlap and that each tunnel has a clear passage length of ≥ 10 units between the cavern edges.

### Tunnels (3 total — MST, no loops)

- Central → Left wing
- Central → Right shallow
- Right shallow → Right deep

All caverns are reachable from any other cavern (satisfies Req 2.3–2.4). No extra loops added (original had optional extra edges; removed to keep layout clean at the smaller size).

### Exit Opening

A gap is left in the back wall arc of the central cavern (angle ~π, facing -z direction, ~40° wide). This leads into a small outdoor area:

- **Dimensions:** ~22×22 units
- **Ceiling:** None — open to sky (no ceiling mesh in this zone)
- **Floor:** Continues with same sandy material
- **Boundary:** Rocky wall segments around the outdoor perimeter prevent escape
- **Atmosphere:** Scene background `0x050510`, one `PointLight(0xaabbff, 1.2, 80)` positioned high and far back to simulate a bright star

Players can walk freely through the opening and explore the outdoor area but cannot exit the map boundary.

---

## Visual Style

### Color Palette

| Zone | Floor | Walls | Ceiling | Stalactites |
|------|-------|-------|---------|-------------|
| Central + left wing | `0xb89060` (sandy tan) | `0x8B4513` / `0xA0522D` (warm sienna) | `0x5a2800` (dark warm brown) | `0x7a4020` |
| Right shallow | `0x6a5040` | `0x5a3820` | `0x3a2010` | `0x5a3820` |
| Right deep | `0x2a2522` | `0x1e1c18` | `0x111111` | `0x2e2a26` |

The transition from warm to cold happens at the right-shallow cavern, which blends both palettes.

### Ceiling Height

**8 units** (down from 12). Lower ceiling makes the cave feel more intimate and matches the reference image.

### Stalactites / Stalagmites

- Present in all caverns; color follows the zone palette above
- Collision rules unchanged: base radius > 0.8 → registered as obstacle (Req 4.2)
- Player spawn clear zone: 6-unit radius around the central cavern center

### Cave Pool

One decorative pool placed in the left wing cavern (semi-transparent blue-grey `PlaneGeometry`, y=0.02). Satisfies Req 2.8.

---

## Lighting

### Torch Fixtures

Each torch consists of:
- A dark wood cylinder (`CylinderGeometry(0.08, 0.08, 1.2, 6)`, color `0x4a2800`) slightly angled against the wall at y≈2.5
- A flame cone (`ConeGeometry(0.15, 0.5, 6)`) with emissive orange material (`color: 0xff8800, emissive: 0xff4400, emissiveIntensity: 1.0`)
- A `PointLight(0xff7700, 3.0, 20)` at the flame position

Torch placement:
- Central cavern: 3 torches on the left/side walls (matching reference image — two clustered on the left, one further back)
- Left wing: 1 torch
- Right shallow: 1 torch

### Crystal Formations (satisfies Req 2.7, 3.3)

- **Right shallow:** 1 cluster (blue `0x4488ff`)
- **Right deep:** 5+ clusters distributed across the cavern floor and walls — colors from the existing crystal palette (`0x4488ff`, `0x44ffaa`, `0x22ddff`, `0x66aaff`, `0x33ffcc`, `0x88aaff`)
- Each cluster: 2–4 spires (ConeGeometry or OctahedronGeometry) + one `PointLight(color, 1.5, 20–30)` (satisfies Req 3.3)
- Total crystal PointLights ≥ 6 (satisfies Req 2.7)

### Global Lighting

- `AmbientLight(0xffffff, 0.08)` — unchanged (Req 1.7)
- Directional fill: intensity 0.05, positioned overhead (Req 3.4)
- `gameState.dayNightActive = false` (Req 3.5)
- Scene fog: `near=15, far=60` (Req 3.1) — unchanged

---

## Structural Changes to `data.js`

```js
cave: {
  name: 'Cave',
  description: 'A natural cave with a warm torch-lit entrance, two branching wings, and something cold glowing in the deep.',
  size: 90,                  // was 200
  color: 0xb89060,           // was 0x3a3a3a — sandy tan for central/left
  wallColor: 0x8B4513,       // was 0x252525 — warm sienna
  ambientLight: 0.08         // unchanged
}
```

Note: The `color` and `wallColor` values in `data.js` are used for the central cavern and left wing. The right wing caverns use their own hardcoded material colors inside `buildCaveMap`.

---

## Changes to `buildCaveMap` (map.js)

The `generateCaveLayout` function is no longer called by `buildCaveMap`. The four cavern positions and tunnel connections are hardcoded constants, ensuring the two-wing layout is always as designed. The seeded RNG (`mulberry32(0xCA1E1234)`) is used only for visual variation — rock segment dimensions, stalactite sizes, crystal scatter positions.

Key changes vs. original:
1. `CAVE_HEIGHT` constant: `8` (was `12`)
2. Wall segment colors follow zone palette instead of single `rockMat`/`rockMat2`
3. Exit gap added in central cavern back wall arc
4. Outdoor area constructed: no ceiling mesh, boundary walls, star light
5. Torch meshes + PointLights added (3 central, 1 left, 1 right-shallow)
6. Crystal formations restricted to right-shallow (1) and right-deep (5+)
7. Cave pool moved to left wing cavern

`generateCaveLayout` is preserved as an exported function (tests reference it) but `buildCaveMap` no longer calls it.

---

## gameState / entities.js

No changes required. `gameState.zombieSpawnCavern` is set to the right-deep cavern's `{cx, cz, radius}`. `spawnZombie` in `entities.js` is unchanged — it already reads from `zombieSpawnCavern`.

---

## Preserved Requirements

| Requirement | Status |
|-------------|--------|
| Req 1: Map data entry | Size changes to 90; colors updated; all other fields preserved |
| Req 2: Cave construction | 4 caverns, MST tunnels, stalactites, stalagmites, ≥6 crystal clusters, cave pool — all satisfied |
| Req 3: Lighting | Fog unchanged, crystals still have PointLights in blue-green spectrum, no day/night |
| Req 4: Collision/navigation | All obstacle registration rules unchanged; tunnel min 4w × 5h preserved |
| Req 5: Ambient audio | Unchanged |
| Req 6: Zombie spawn cavern | Right-deep cavern designated; radius ~14 fits 10+ spawns |
| Req 7: Game mode compatibility | All three modes supported; open floor space in all caverns |
| Req 8: Map selection | No change needed |
