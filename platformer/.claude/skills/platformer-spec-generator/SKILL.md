---
name: platformer-spec-generator
description: Use when the user asks to make, create, or write a spec for a feature, change, or fix in the platformer/ directory. Triggers on phrases like "make a spec", "create a spec", "write a spec", "spec out", "let's spec", "I want to add", "we need a spec" when working in the platformer project. Adapted from rivshield-spec-generator.
---

# Platformer Spec Generator

## Overview

Produces two artifacts, committed together on a `spec/{slug}` branch, for a platformer feature:

1. `platformer/darkfactory/specs/{slug}.md` — coding-agent-visible spec (Goal through Priority)
2. `platformer/tests/scenarios/{slug}.md` — evaluator-only holdout scenarios (never seen by the coding agent)

**Test files are NOT written by this skill.** All test generation — unit (Jest) and end-to-end (Playwright) — is owned by the platformer-darkfactory pipeline. The spec generator's job ends at producing a spec and its scenarios, and pushing the branch. The pipeline's neutral test-writer agent generates tests at run time from the spec and scenarios.

## Isolation model — important

The platformer dark factory enforces holdout at the **tool layer** via `platformer/.claude/settings.json` `permissions.deny` patterns plus a `PreToolUse` Bash hook at `platformer/.claude/hooks/deny-tests-in-bash.ps1`. The coding agent literally cannot see `platformer/tests/scenarios/`, `platformer/tests/unit/`, or `platformer/tests/playwright/` — this is filesystem-level enforcement, not prompt discipline. The agent runs in a single working tree on the `spec/{slug}` branch as a `claude -p` subprocess inside `platformer/` so the directory-scoped settings actually apply.

Practical rules:

- **Scenarios live in `platformer/tests/scenarios/{slug}.md`** and are never referenced from the spec.
- **The spec file never contains scenario text, "Verify by:" lines, or evaluator language.**
- The neutral test-writer (which DOES have access to both the spec and the scenarios) runs in the main working tree at pipeline run time, writes tests, and commits them to the spec branch. The coding agent, working under the holdout, never sees those test files.

Treat the scenarios file as an evaluator-only artifact. Never name it in the spec text.

## Core design rules

- **Spec schema matches the NLSpec format the Attractor engine validates:** Goal, Requirements, Examples, Edge Cases, Constraints — plus platformer-specific extras (Affected Components, Interface Contracts, etc.).
- **No "Success Criteria / Acceptance Tests" section in the spec.** Scenarios ARE the acceptance tests and live only in `platformer/tests/scenarios/`.
- **Interface Contracts describes what the implementation must touch** — module exports called, localStorage keys read/written, DOM IDs/classes manipulated. Not how the evaluator will verify.
- **Scenarios live in `platformer/tests/scenarios/{slug}.md`** with `Verify by:` pointing at specific source locations. The coding agent is not told this file exists and cannot read it.
- **No test files are written at spec time.**
- **Large features** (touching physics + level-gen + UI + save format simultaneously) are rejected upfront and split into sub-specs.

---

## Step 1 — Gather context

Use what the user already provided. Only ask for what's missing.

**Round 1 — What and why:**
1. What is the feature or change? (1–3 sentences)
2. Why is it needed? (player request / bug / new mechanic / polish)
3. Which subsystem(s) does it touch? (physics, level-gen, rendering, UI, state/save, input)

**Round 2 — Scope and quality:**
4. What does success look like to a player?
5. Hard constraints? (must run at 60fps, no new deps, must work on Firefox + Chromium, must not change save shape)
6. Risk of regressing existing 500 levels / 10 stage themes? (yes/no — guides scenario list)
7. Priority? (nice-to-have / needed soon / blocking)

**Round 3 — Large feature check:**
If the feature simultaneously touches physics + level-gen + UI + save format, stop and ask:

> "This spans too many subsystems for one spec. The pipeline works best with focused specs — one per subsystem. Should I split this into sub-specs, or do you want to keep it as one?"

If the user insists on one spec, proceed but note that the darkfactory skill will reject it at Phase A.

**Round 4 — UI intake (HUD/menu/overlay changes only):**
If the feature adds or changes a visible HUD, menu, shop, or overlay element, invoke the `frontend-design` skill. The dark/gold theme is already established in `platformer/platformer.css` — reuse classes (`.btn`, `.panel`, `.hud-*`) where they exist rather than introducing new ones.

---

## Step 2 — Size the feature

| Size | Signals |
|---|---|
| **Tiny** | Single function in one js file, no new entities, cosmetic or additive UI |
| **Small** | 1–2 files, one subsystem (e.g. add a new upgrade), well-understood |
| **Medium** | New entity type + spawn logic + collision + render path; or new stage theme; or save-format change |
| **Large** | Rejected — split into sub-specs first |

**Scenario count minimums:** Tiny — at least 2 scenarios. Small/Medium — at least 4.

---

## Step 3 — Identify affected components

| Described area | File(s) — use full path in spec |
|---|---|
| Player physics, jump, double-jump, coyote/buffer | `platformer/js/player.js`, `platformer/js/input.js` |
| Coins, doors, particles, enemies | `platformer/js/entities.js` |
| Procedural level generation, collision resolution | `platformer/js/level.js` |
| Stage themes, parallax backgrounds | `platformer/js/renderer.js` |
| Save data, upgrades, coins, progress | `platformer/js/state.js` (localStorage key `platformer-save`) |
| HUD, shop, menus, screen management | `platformer/js/ui.js`, `platformer/platformer.css`, `platformer/platformer.html` |
| Game loop, level lifecycle, screen transitions | `platformer/js/main.js` |

**Spec rule:** `## Affected Components` bullets must be repo-relative **paths**, not bare names. The scope-gate, snapshot gate, and holdout-setup all parse these as path prefixes — bare names break all three.

---

## Step 4 — Draft the spec (coding-agent-visible)

**Delegate drafting to an Opus subagent with maximum thinking budget.** Steps 1–3 happen in the main conversation. Once context is gathered, dispatch a single `Agent` call to draft the spec, draft the scenarios, and run the self-review gate. Then present the returned drafts to the user.

Use the `Agent` tool with:

- `subagent_type: "general-purpose"`
- `model: "opus"`
- `description`: short label, e.g. `"Draft platformer spec + scenarios"`
- `prompt`: must begin with the word **`ultrathink`** on its own line. The rest of the prompt must include:
  - Feature title, slug, and all context from Steps 1–3.
  - The full spec template, scenario template, design rules, and self-review gate from this skill (copy them in).
  - The isolation rule: spec file must NOT contain scenarios, "Verify by:" lines, or any reference to `tests/scenarios/`.
  - Instructions to run the self-review gate before returning, and to revise until it passes.
  - Required return format: two clearly delimited markdown blocks — `SPEC:` containing the full `platformer/darkfactory/specs/{slug}.md` content, `SCENARIOS:` containing the full `platformer/tests/scenarios/{slug}.md` content. No commentary outside those blocks.

The subagent only drafts. File writes and commits happen in Step 7.

---

### Spec template (pass this to the subagent)

```markdown
# SPEC: {Short Feature Title}

## Goal
{One sentence: "[Actor] can [action] so that [benefit]."}

## Requirements
{Numbered list of concrete, testable, observable facts.}
1. ...

## Examples
{2–3 concrete input/output examples with realistic values.}
Example 1 — {name}
  Input: ...
  Expected output: ...

## Edge Cases
{Unusual inputs or conditions the implementation must handle without crashing.}
- ...

## Constraints
{Architecture rules, must-NOT-happen, perf/timing limits.}
- ...

## Affected Components
{One bullet per component — must be a repo-relative PATH, not a bare name.}
- platformer/js/player.js — adds restartLevel() helper
- platformer/js/input.js — handles 'r' key

## Interface Contracts
{What module exports are called, what localStorage keys are read/written, what DOM IDs/classes are touched.}
- `state.playerData.upgrades` — read; not mutated
- `localStorage["platformer-save"]` — JSON shape `{ coins, upgrades, stage, level }`; field set unchanged
- `entities.spawnCoin(level, rng)` — called from `level.generate`

## Out of Scope
{What this spec deliberately does NOT include.}

## Depends On
{Bare spec slugs (NOT branch names) this feature requires merged first; one per line. The queue processor looks these up as `origin/spec/{slug}` branches:
- other-feature-slug
Empty if self-contained.}

## UI Design
{Only if HUD/menu/overlay changes. Omit for pure-logic specs.}

## Security Considerations
{Usually "None" — static browser game with no auth. Note any save-tampering or XSS considerations.}

## Open Questions
{"None" or unresolved items.}

## Priority
{Nice-to-have | Needed soon | Blocking — brief reason}
```

---

## Self-review gate (run before presenting to user)

- **Placeholder check:** No requirement contains TBD, TODO, "as appropriate", "etc."
- **Schema check:** All required sections present and non-empty: Goal, Requirements, Examples, Edge Cases, Constraints, Affected Components, Interface Contracts.
- **Goal format check:** Single sentence in "[Actor] can [action] so that [benefit]" form.
- **Requirements quality check:** Each is a single observable fact a developer could write a test for. Not "the system should handle X" — "when X, the system returns Y."
- **Examples check:** At least 2 examples with realistic values.
- **Edge cases check:** At least 2 edge cases covering boundary conditions or failure modes from Constraints.
- **Affected Components path-grammar check:** Every bullet starts with `platformer/`. No bare component names like "physics" or "ui".
- **Interface Contracts check:** No evaluator language ("verify by reading X"). Only what the implementation touches.
- **No Success Criteria / Acceptance Tests section.**
- **Ambiguity check:** If any requirement could be interpreted two ways, pick one and state it.
- **must-NOT-happen check:** At least one scenario in the scenarios file maps to a Constraint and verifies prohibited behavior.
- **Depends On check:** If this spec calls exports from another unmerged spec, list its slug. Otherwise leave empty.

If any check fails, fix and re-run. Do not present until clean.

---

## Step 5 — Draft scenarios (evaluator-only)

Scenarios are drafted by the same Opus subagent in Step 4 and returned in the `SCENARIOS:` block.

```markdown
# Scenarios: {Feature Title}

## Scenario 1 — {short name}
Kind: code   # or e2e — code = evaluator reads source; e2e = Playwright drives the browser in Phase E
Given: {precondition — system state}
When:  {trigger}
Then:  {specific, measurable outcome}
Verify by: {specific file and method to read — e.g. "Read player.update() in platformer/js/player.js and confirm it consults input.justPressed('r')"}

## Scenario 2 — ...
```

**Scenario rules:**
- `Kind:` is required. `code` scenarios are graded by the engine's scenario evaluator (reads source). `e2e` scenarios are driven by Playwright in Phase E.
- `Verify by:` is required on every scenario. For `code` scenarios it must name a specific file and method. For `e2e` scenarios it describes the observable browser behavior (canvas pixel test, DOM state, console assertion).
- At least one scenario must verify a must-NOT-happen case (maps to a Constraint).
- Each scenario is self-contained — states its own preconditions.
- Tiny: at least 2 scenarios. Small/Medium: at least 4.

**Scenario self-review:**
- Every Then clause is measurable: specific return value, visible DOM state, log entry, timing bound. No "works correctly" or "behaves as expected."
- No scenario language leaks into the spec file.

> **Engine note:** The Attractor pipeline reads scenarios from the **spec file's `## Scenarios` section** at run time. The darkfactory skill injects `platformer/tests/scenarios/{slug}.md` into the spec before invoking the engine and strips it after, so the spec on disk is canonical (no Scenarios section) outside of a pipeline run. Do **not** paste scenarios into the spec file at spec-authoring time — that would leak the holdout to the coding agent.

---

## Step 6 — Present for approval

Show:
1. Full spec draft (`platformer/darkfactory/specs/{slug}.md` content)
2. Scenarios draft (`platformer/tests/scenarios/{slug}.md` content)

Wait for explicit approval. Revise and re-show if requested.

**Do not write any files before the user approves.**

---

## Step 7 — Save and commit

Once approved:

1. Derive `{slug}` from the feature title (lowercase, hyphens, no special characters).
2. **Create the spec branch before writing any files:**

   ```powershell
   git checkout -b spec/{slug}
   ```

   If a branch named `spec/{slug}` already exists, append a numeric suffix: `spec/{slug}-2`, etc.

   **Also check for spec-file collision on `origin/main`:**

   ```powershell
   git fetch origin
   git show "origin/main:platformer/darkfactory/specs/{slug}.md" 2>$null | Out-Null
   if ($LASTEXITCODE -eq 0) {
       # File exists on origin/main — slug collision. Increment suffix and re-check.
   }
   ```

3. Write `platformer/darkfactory/specs/{slug}.md`.
4. Write `platformer/tests/scenarios/{slug}.md`.
5. Commit both files together:

   ```powershell
   git add platformer/darkfactory/specs/{slug}.md platformer/tests/scenarios/{slug}.md
   git commit -m "spec: add {Feature Title}"
   ```

6. Push the branch:

   ```powershell
   git push -u origin spec/{slug}
   ```

7. Switch back to the prior branch:

   ```powershell
   git checkout -
   ```

8. Report: "Spec branch `spec/{slug}` created and pushed. The platformer-darkfactory queue will pick it up automatically when you run queue mode."

---

## Common Mistakes

- **"Success Criteria / Acceptance Tests" section in the spec** — remove it. Scenarios live in `platformer/tests/scenarios/`.
- **Scenarios in the spec file** — never. Only in `platformer/tests/scenarios/{slug}.md`.
- **Writing test files in this skill** — never. The dark factory's test-writer agent generates tests at pipeline run time.
- **Interface Contracts with evaluator language** — "Read player.js and verify..." belongs in the scenario's `Verify by:` field.
- **`Verify by:` that says "run the system"** — for `code` scenarios the evaluator reads source. For `e2e` scenarios Playwright drives the browser — be specific about what it asserts.
- **Missing `Verify by:` or `Kind:` on a scenario** — both required.
- **Affected Components with bare names** — must be repo-relative paths starting with `platformer/`.
- **Silently overwriting an existing spec slug** — always check for collision.
- **Leaving Depends On empty when a real dependency exists.**
