# Platformer Dark Factory — Runbook

Human-facing runbook for the platformer dark factory. The two skills under
`platformer/.claude/skills/` (`platformer-spec-generator` and
`platformer-darkfactory`) own the actual procedure; this file is the
out-of-band reference for one-time setup, troubleshooting, and what to
expect during a run.

See `platformer/darkfactory-plan.md` for the design rationale.

---

## One-time setup

Run once per host before the first dark-factory invocation.

### 1. Create the integration branch

```powershell
cd C:\Users\ai\Documents\code\aaron
git fetch origin
git switch -c platformer-specs origin/main
git push -u origin platformer-specs
git switch main
```

Skip if `git ls-remote --heads origin platformer-specs` already returns a SHA.

### 2. Install platformer tooling deps

```powershell
cd C:\Users\ai\Documents\code\aaron\platformer
npm install            # or pnpm install — jest + jest-environment-jsdom
```

### 3. Install the attractor engine deps

```powershell
cd C:\Users\ai\Documents\code\aaron\platformer\darkfactory\attractor
pnpm install           # or npm install
```

Phase A.2 will redo this idempotently if `node_modules/` is missing, but
the first manual run avoids a long pause inside the first pipeline call.

### 4. (Optional) Install Playwright

Only needed if any spec has `Kind: e2e` scenarios.

```powershell
cd C:\Users\ai\Documents\code\aaron\platformer
pnpm exec playwright install chromium
```

### 5. Verify

```powershell
Test-Path C:\Users\ai\Documents\code\aaron\platformer\.claude\hooks\deny-tests-in-bash.ps1
Test-Path C:\Users\ai\Documents\code\aaron\platformer\darkfactory\attractor\config\auto-resolve.json
Test-Path C:\Users\ai\Documents\code\aaron\platformer\darkfactory\attractor\scripts\emit-outcome.ps1
git ls-remote --heads origin platformer-specs
```

All four should report present / a SHA.

---

## Typical run

1. **Author a spec.**

   In a Claude Code session at this repo root, say *"make a spec for {feature}"*.
   The `platformer-spec-generator` skill fires, asks ≤4 rounds of questions,
   and produces a draft spec + scenarios. After approval the skill creates a
   `spec/{slug}` branch and pushes it.

2. **Run the pipeline.**

   In a new Claude Code session, say *"run the platformer dark factory"*
   (or just *"run the queue"*). The `platformer-darkfactory` skill enumerates
   `origin/spec/*` branches touching `platformer/darkfactory/specs/`,
   topologically sorts them by `## Depends On`, and processes one at a time
   through Phase A → B → C → E.

3. **Phase D review.**

   After the queue empties, the orchestrator surfaces a table of all
   processed slugs and prompts approve/reject per slug. Approved slugs are
   merged from `spec/{slug}` into `main`; their spec files are archived to
   `darkfactory/specs/completed/{slug}.md` on `main`. Rejected slugs stay
   on `platformer-specs` but get a `{slug}.rejected.md` tombstone and are
   excluded from main.

---

## What goes where

| Path | Role |
|---|---|
| `platformer/darkfactory/specs/{slug}.md` | Coding-agent-visible spec |
| `platformer/darkfactory/specs/completed/{slug}.md` | Archived after promotion |
| `platformer/tests/scenarios/{slug}.md` | Evaluator-only holdout |
| `platformer/tests/unit/{slug}.test.js` | Jest tests (written by test-writer agent at run time) |
| `platformer/tests/playwright/dark-factory-{slug}.spec.ts` | Throwaway e2e tests (gitignored) |
| `platformer/.claude/settings.json` | Per-run holdout settings (gitignored, deleted by teardown) |
| `platformer/.claude/hooks/deny-tests-in-bash.ps1` | Shell-side deny hook |
| `platformer/darkfactory/attractor/pipelines/platformer.dot` | Engine pipeline definition |
| `platformer/darkfactory/attractor/scripts/emit-outcome.ps1` | Engine -> orchestrator IPC writer |
| `platformer/darkfactory/attractor/config/auto-resolve.json` | Rebase/merge auto-resolve allow-list |
| `platformer/darkfactory/attractor/checkpoints/` | Per-run IPC files (gitignored) |

---

## Holdout model — what it does and how to verify

The coding agent runs as a `claude -p` subprocess in `platformer/`. The
`platformer/.claude/settings.json` written at Phase B.4 (composed by the
holdout-setup agent) carries:

- `permissions.deny`: `Read(platformer/tests/**)`, `Read(platformer/**/scenarios/**)`, `Read(platformer/.claude/**)`, and matching `Edit`/`Write` patterns.
- A `PreToolUse: Bash` hook that runs `platformer/.claude/hooks/deny-tests-in-bash.ps1` on every shell command and exits 2 if the command mentions `tests/`, `scenarios/`, or any git plumbing path that could leak hidden content.

Every coding-agent prompt requires a `HOLDOUT-SELFTEST: PASS` canary line.
The audit agent (B.5.2) scans the flattened transcript for that line. If it
is missing, the orchestrator surfaces a fatal "holdout broken" error and
aborts the entire pipeline (not just the slug). This is intentional — a
silently-broken holdout cascades for every subsequent slug.

---

## Troubleshooting

### "Queue stalled — all remaining specs have unresolved dependencies."

A spec's `## Depends On` references a slug that hasn't yet merged to
`main`. Either merge the dependency first (`platformer/darkfactory/specs/completed/{dep}.md`
must exist on `origin/main`) or remove the dependency from the spec.

### "untracked test files from a prior crashed run detected"

A previous run crashed between B.3 (test-writer wrote files) and either
B.5.4 SUCCESS (tests-committer) or B.6 (`git clean`). Run:

```powershell
git clean -fdx -- platformer/tests/
```

Then re-invoke the skill — the resume protocol picks up from B.1.

### "HOLDOUT: Bash command blocked by deny-tests-in-bash hook"

Expected during normal operation when the coding agent tries to inspect
`tests/`. If you see this from a legitimate orchestrator-side command,
add a more specific allow path to `auto-resolve.json` or revise the
command to not mention `tests/` literally.

### Phase C.4 static-load fails

Look at `platformer/darkfactory/attractor/checkpoints/ci.stderr.log` for
Playwright errors. Common causes:
- Port 8123 already bound — kill the stale process.
- `platformer.html` references a module that throws on import. Open the
  page manually with `npm run serve` and read the browser console.

### "REWORK_EXHAUSTED" after 5 iterations

The coding agent kept producing implementations that failed the engine's
scenario evaluator on the same scenarios. Read `triage-feedback.txt` in
checkpoints — the investigator agent's verdict (PRODUCT vs INFRA) tells
you whether the spec needs revision or the engine itself is broken.

---

## Manual cleanup (if needed)

```powershell
# Reset a slug back to a clean B.1 state without losing the spec/scenarios:
cd C:\Users\ai\Documents\code\aaron
git switch spec/{slug}
git clean -fdx -- platformer/tests/
Remove-Item platformer/.claude/settings.json -ErrorAction SilentlyContinue
Remove-Item platformer/darkfactory/attractor/checkpoints/last-outcome.json -ErrorAction SilentlyContinue
Remove-Item platformer/darkfactory/attractor/checkpoints/triage-feedback.txt -ErrorAction SilentlyContinue
Remove-Item platformer/darkfactory/attractor/checkpoints/outcome-verdict.txt -ErrorAction SilentlyContinue
```

---

## First-milestone validation

A good first spec to round-trip the entire pipeline:

> "Player can press `R` to instantly restart the current level without losing collected upgrades."

It touches `platformer/js/input.js`, `platformer/js/main.js`, possibly
`platformer/js/state.js`. Two scenarios (both `Kind: code`):
1. R while alive resets `player.x/y` and clears in-flight particles; upgrades persist.
2. R while on the level-complete overlay does nothing (must-NOT-happen).

If this round-trips green you've validated the entire B → C → D pipeline
without needing Playwright e2e.
