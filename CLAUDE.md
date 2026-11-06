# CLAUDE.md

Guidance for Claude Code when working in this repository. This file loads into every session, so it holds
only the RULES and a routing table; reference material lives under `docs/` and is read on demand.

## Instructions for Claude

- Understand the request before changing code: read the relevant source and the project's `docs/` file first.
  If something is genuinely ambiguous, take the most reasonable, cheapest-to-undo default, state the assumption
  in the commit message or reply, and keep working. Do not stop to ask the owner or wait for approval; a wrong
  default that is easy to undo costs less than a session that waits.
- Keep this file small (target ≤ 10 KB): rules and routing only. After a significant change (new feature, new
  file, architecture or command change) update the project's `docs/<project>.md`, not this file, unless a
  RULE changed.

## Repository overview

A collection of independent browser games and tools, each in its own directory. There is no monorepo build
system; projects are self-contained. The root `index.html` is a portfolio hub hosted on GitHub Pages.

## Where to read more

| For | Read |
|---|---|
| war_zone gameplay systems (weapons, maps, modes, progression, controls) | `war_zone/FEATURES.md` (authoritative) |
| war_zone UI screen layouts, module table, implementation changelog | `docs/war-zone.md` |
| platformer internals (physics, level generation, enemies, bosses, weapons, specials, HUD) | `docs/platformer.md` |
| attractor (DOT pipeline orchestrator): layers, file layout, handlers, tests, commands | `docs/attractor.md` |
| tic-tac-toe-bot, dog_clicker, cosmicVentures, auto_clicker_extension: commands and architecture | `docs/other-projects.md` |
| platformer darkfactory pipeline | `platformer/darkfactory/DARKFACTORY-INSTRUCTIONS.md`, `platformer/darkfactory-plan.md` |

## Projects and rules

### war_zone/ — 3D tactical shooter (Three.js, ES modules)

- No build step: open `war_zone/war_zone.html` in a browser. Logic is in `war_zone/js/`. Tests: `npm test`
  (jest) and `npm run test:e2e` (playwright) from `war_zone/`.
- Don't rely on console debug statements: the cursor is locked, so use alerts instead.
- `war_zone/FEATURES.md` is the authoritative reference for every game system. Update it every time a war_zone
  feature is added, changed or removed; it must stay in sync with the code. Add a changelog bullet to
  `docs/war-zone.md` as well.
- Update the in-game tutorial every time a new important feature or concept is added.
- Zombie spawn distance must stay under `TERRAIN_LOAD_DIST` (150) or they spawn in empty unloaded chunks.

### platformer/ — 2D platformer (vanilla JS + canvas, ES modules)

- No build step: open `platformer/platformer.html` in a browser. Tests: `npm test` (jest) from `platformer/`;
  `npm run serve` starts a static server on :8123 for playwright.
- The main menu has an intentionally undocumented easter egg reached through one of the toy-box widgets
  (`luckyRun` in `ui.js`). It is deliberately camouflaged in the source (neutral names, encoded strings, no
  comments) so players inspecting the page cannot find it. Do not add comments, rename it descriptively, or
  document the trigger anywhere in the repo.
- Reachability is a hard invariant: every required leap in all 500 generated levels must stay inside the
  player's jump envelope. Changing physics constants, stage modifiers or segment generators requires
  re-validating it. Details in `docs/platformer.md`.

### platformer/attractor/ — DOT-based AI pipeline orchestrator (Node.js ESM)

- Lives at `platformer/attractor/`, not the repo root. `cd platformer/attractor && npm install` once, then
  `npm test` (node:test) and `node attractor.js <pipeline.dot>`.
- Needs `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and/or `GEMINI_API_KEY` in the environment for real runs.

### tic-tac-toe-bot/, dog_clicker/, cosmicVentures/, auto_clicker_extension/

- tic-tac-toe-bot: `game.js` is pure logic with no DOM access; keep DOM work in `ui.js` so Jest tests stay
  DOM-free. `npm test --prefix tic-tac-toe-bot`.
- dog_clicker: Flutter with clean architecture + BLoC; `flutter test` from `dog_clicker/`.
- cosmicVentures/cv-ext and auto_clicker_extension are MV3 Chrome extensions; load unpacked via
  `chrome://extensions` with Developer Mode on.

## Applied learning

When something fails repeatedly, or there is a workaround or easier way, add a one-line bullet (under 15
words) here to save time next session. Project-specific ones are listed under the project above.
