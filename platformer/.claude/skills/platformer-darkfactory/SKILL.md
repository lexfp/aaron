---
name: platformer-darkfactory
description: Use when a platformer spec has been committed to platformer/darkfactory/specs/ and a scenarios file has been committed to platformer/tests/scenarios/ — ready to run the Attractor pipeline end-to-end (queue sort, rebase, tool-layer holdout, sequential test-writer + coding agent, evaluation loop, merge to platformer-specs, static-load verification, optional Playwright e2e). Do NOT use for spec authoring (use platformer-spec-generator) or ad-hoc fixes.
---

# platformer-darkfactory — Attractor Pipeline Orchestrator

This skill orchestrates the platformer dark factory pipeline. The orchestrator is a **thin coordinator**: it prepares context, spawns one delegated agent at a time, consumes the agent's structured JSON return, and decides the next step. **Concrete work — file I/O, git, engine invocation, browser verification — happens inside spawned agents, not inline in the orchestrator.**

Adapted from `rivshield-darkfactory`. Key adaptations:

- No AWS / CDK / Lambda. "Deploy" is replaced with a static-load Playwright check against `http://localhost:8123/platformer.html`.
- No Windows Sandbox / agent install verification (Phase E.5 removed).
- No dotnet warm-build. Jest replaces xUnit; engine quick-test gate runs `pnpm --filter platformer exec jest`.
- Integration branch is `platformer-specs` (namespaced — this repo houses multiple sibling projects).
- Holdout enforcement (tool-layer `permissions.deny` + Bash hook + canary) is **identical** in structure.

Holdout is enforced at the **tool layer**: a per-run `platformer/.claude/settings.json` composes `permissions.deny` patterns for `platformer/tests/**`, `platformer/**/scenarios/**`, and `platformer/.claude/**`, plus a `PreToolUse` Bash hook at `platformer/.claude/hooks/deny-tests-in-bash.ps1`. The coding agent runs as a `claude -p` subprocess in `platformer/` so the directory-scoped settings apply.

CI-passing work accumulates on a long-lived `platformer-specs` integration branch. After the queue empties, the orchestrator runs a batched Phase D review where the user approves per-slug promotion to `main`.

---

## Initial setup (one-time, before first run)

### 1. Create the `platformer-specs` integration branch on origin

```powershell
cd C:\Users\ai\Documents\code\aaron
git fetch origin
git switch -c platformer-specs origin/main
git push -u origin platformer-specs
git switch main
```

If `git ls-remote --heads origin platformer-specs` already returns a SHA, skip.

### 2. Verify the Bash-deny hook script exists

```powershell
Test-Path -LiteralPath C:\Users\ai\Documents\code\aaron\platformer\.claude\hooks\deny-tests-in-bash.ps1
```

If missing, see the platformer-darkfactory plan (`platformer/darkfactory-plan.md`). The B.4 holdout-setup agent refuses to proceed if missing.

### 3. Install Playwright (only if any spec has `Kind: e2e` scenarios)

```powershell
cd C:\Users\ai\Documents\code\aaron\platformer
pnpm install
pnpm exec playwright install chromium
```

### 4. Verify auto-resolve allow-list exists

`platformer/darkfactory/attractor/config/auto-resolve.json` is shipped with the repo. Add CI-bot-regenerated paths here as they emerge.

### 5. Verify engine deps

```powershell
cd C:\Users\ai\Documents\code\aaron\platformer\darkfactory\attractor
pnpm install
```

The Phase A.2 agent does this idempotently on every run.

### 6. Verify

```powershell
Test-Path -LiteralPath C:\Users\ai\Documents\code\aaron\platformer\.claude\hooks\deny-tests-in-bash.ps1
Test-Path -LiteralPath C:\Users\ai\Documents\code\aaron\platformer\darkfactory\attractor\config\auto-resolve.json
Test-Path -LiteralPath C:\Users\ai\Documents\code\aaron\platformer\darkfactory\attractor\scripts\emit-outcome.ps1
git ls-remote --heads origin platformer-specs | Out-String
```

All four must succeed before the first run.

---

## Path conventions

Resolve once at the start of every run:

```powershell
$repoRoot      = (git rev-parse --show-toplevel) -replace '/', '\'
$projectRoot   = Join-Path $repoRoot 'platformer'
$attractorDir  = Join-Path $projectRoot 'darkfactory\attractor'
$checkpointDir = Join-Path $attractorDir 'checkpoints'
$settingsPath  = Join-Path $projectRoot '.claude\settings.json'
$specsDir      = Join-Path $projectRoot 'darkfactory\specs'
$scenariosDir  = Join-Path $projectRoot 'tests\scenarios'
$integrationBranch = 'platformer-specs'
```

**Standard error guard** — spawned agents use this after every git / pnpm call:

```powershell
if ($LASTEXITCODE -ne 0) { throw "command 'X' failed with exit code $LASTEXITCODE" }
```

---

## IPC contract — orchestrator <-> engine

| Channel | Direction | Written by / Read by | Content |
|---|---|---|---|
| `checkpoints/last-outcome.json` | engine -> orchestrator | Written by `emit-outcome.ps1` (engine) at every terminal path; read by the evaluator agent once per iteration | `{ engine_outcome, triage_feedback?, validation_errors?, emitted_at_utc }` (UTF-8 no BOM) |
| `checkpoints/outcome-verdict.txt` | triage codergen -> emit_outcome tool | Written by the triage LLM node; consumed within the same engine run | Single-token verdict |
| `checkpoints/triage-feedback.txt` | triage codergen -> emit_outcome tool | Written by the triage LLM node; consumed within the same engine run | Plain-English feedback body |

---

## Delegated agents — catalog

| Agent | Trigger | Inputs | Return | Failure semantics |
|---|---|---|---|---|
| **integration-verify** | Phase A start | `$repoRoot`, integration branch name | `{ ok, head_sha }` | Hard fail — abort with pointer to setup step 1 |
| **phase-A-setup** | Phase A, after integration-verify | `$projectRoot`, `$slug`, spec path | `{ ok, checks[], warnings[] }` | Hard fail — abort |
| **rebase agent** | Phase B.1 | `$repoRoot`, `$slug` | `{ ok, head_sha }` | Conflict — abort |
| **test-writer** | Phase B.3 (BEFORE holdout setup) | `$projectRoot`, `$slug`, spec path, scenarios path | `{ ok, files_written, head_sha, files[] }` | Test files written uncommitted to working tree, protected by holdout |
| **holdout-setup** | Phase B.4 | `$projectRoot`, `$slug`, spec path | `{ ok, settings_path, deny_relaxed, extra_denies }` | Hard fail — abort |
| **coding-agent supervisor** | Phase B.5 | `$projectRoot`, `$slug`, spec path, prior triage_feedback, transcript_path | `{ ok, transcript_path, pre_sha, post_sha, files_changed[] }` | Hard fail — `$infraIter += 1` |
| **audit** | After each coding-agent supervisor return | `transcript_path` | `{ deny_hits, samples[], selftest_failed }` | Never fails the iteration |
| **evaluator** | After audit each iteration | `$projectRoot`, `$slug`, `$attractorDir` | parsed `last-outcome.json` | Hard fail — abort. Scenario-strip wrapped in `try/finally` inline. |
| **scope-gate** | After evaluator returns NEEDS_REWORK | spec path, triage_feedback | `{ verdict: IN_SCOPE\|OUT_OF_SCOPE\|HALLUCINATION, in_scope[], out_of_scope[], rationale }` | Verdict drives branch |
| **investigator** | B.5.4a after 2 consecutive same-shape NEEDS_REWORK | `$projectRoot`, `$slug`, `$checkpointDir`, last two triage_feedback blobs | `{ verdict: "INFRA"\|"PRODUCT", summary, suspect_files[] }` | Read-only |
| **phase-C push** | Before and after merge | `$repoRoot`, target ref | `{ ok, fetched, rebased, conflict }` | Conflict — hard fail |
| **phase-C merge-to-specs** | C.2 | `$repoRoot`, `$slug`, integration branch | `{ ok, was_resync, merge_sha?, cherry_picked_shas[] }` | Re-sync conflict — hard fail |
| **phase-C verify-static-load** | C.4 (replaces deploy) | `$projectRoot` | `{ ok, page_loaded, runtime_errors[], duration_ms }` | Boot failure — log and `continue` to next slug |
| **doc-update** | After C.4 success | `$repoRoot`, `$slug`, spec path | `{ ok, docs_changed[] }` | Soft fail — warning |
| **archive** | Promotion step 4 | `$repoRoot`, `$slug` | `{ ok, archived[] }` | Hard fail — abort |
| **scenario-enumerator** | Phase E.2 start | `$projectRoot`, `$slug`, scenarios path | `{ ok, scenarios: [{ index, kind, given, when, then, verify_by }] }` | Hard fail — abort E.2 |
| **scenario-setup** | Phase E.2, BEFORE scenario-test, per `kind: e2e` scenario | `$projectRoot`, `$slug`, scenario object, targetUrl=`http://localhost:8123/platformer.html` | `{ ok, mechanism, fixtures_created[], teardown_hints[], notes }` | Soft fail — diagnose-fix sees `setup_failed=true` |
| **scenario-test** | Phase E.2, AFTER scenario-setup succeeds | `$projectRoot`, `$slug`, scenario object, targetUrl | `{ ok, verdict: "PASS"\|"FAIL", screenshots[], console_excerpts[], notes }` | `verdict=FAIL` triggers diagnose-fix |
| **scenario-diagnose-fix** | Phase E.2, after any FAIL/setup_failed | `$projectRoot`, `$slug`, scenario object, last setup, last test, round number, prior diagnoses[] | `{ fixable, category, root_cause, files_changed[], commit_sha?, requires_static_reload, abandon_reason? }` | `fixable=false` -> scenario marked needs-human |

All agents spawn via the in-session `Agent` tool with a structured prompt and explicit "return EXACTLY this JSON on stdout" contract. The coding-agent supervisor is the exception: it is an `Agent` subagent that launches `claude -p` as its OWN subprocess in `$projectRoot`, so the directory-scoped `.claude/settings.json` applies.

### Inline vs delegated boundary

Anything mutating the working tree or local git state runs inline. Anything performing I/O against external systems (engine subprocess, headless browser, GitHub) is delegated.

Inline:
- **tests-committer** (B.5.4 SUCCESS branch) — git add/commit of working-tree test files.
- **C.2 merge-to-specs** — `git merge --no-ff spec/{slug}` plus auto-resolve.
- **B.5.3 scenario-strip** — removes `<!--ATTRACTOR-SCENARIO-INJECT-->` from the spec; `try/finally` around the evaluator call.
- **B.6 holdout teardown** — deletes `platformer/.claude/settings.json`, cleans untracked test files.
- **E.2.0 throwaway-spec cleanup** — `git clean -fdx -- platformer/tests/playwright/dark-factory-*.spec.ts` on every E.2 exit path.

---

## Queue Mode — Step 1: Sort the queue

Enumerate `origin/spec/*` branches that have a spec file under `platformer/darkfactory/specs/`:

```powershell
git fetch origin
if ($LASTEXITCODE -ne 0) { throw "git fetch failed" }

$queue = @()
git branch -r --list 'origin/spec/*' | ForEach-Object {
    $branch = $_.Trim() -replace '^origin/', ''
    $slug = $branch -replace '^spec/', ''
    # Filter to platformer specs only.
    git cat-file -e "origin/$branch:platformer/darkfactory/specs/$slug.md" 2>$null
    if ($LASTEXITCODE -ne 0) { return }
    # Already merged to main?
    $null = git merge-base --is-ancestor "origin/$branch" origin/main
    if ($LASTEXITCODE -ne 0) { $queue += $slug }
}
```

Topologically sort by `## Depends On`. A dependency is "merged" if `platformer/darkfactory/specs/completed/{dep-slug}.md` exists on `origin/main`.

**Blocked cycle:** surface "Queue stalled — resolve manually." and stop.
**Empty queue:** "Queue is empty — no unmerged platformer spec branches found on origin."

---

## Queue Loop — one spec at a time

For each `{slug}` in sorted order:

1. Run **Phase A**.
2. Run **Phase B**. On non-SUCCESS terminal outcome (rework-exhausted, `INFRA_FAULT`, `REBASE_NEEDED`, `SPEC_INVALID`): run B.6 teardown, log locally, `continue`.
3. Run **Phase C**. On C.4 static-load failure: log and `continue`.
4. Run **Phase E**. **E.2 is gating** for any scenarios with `Kind: e2e`. Up to **10 rounds per scenario** of setup -> test -> diagnose-fix (-> static-reload if the fix changed code). A scenario that the diagnose-fix agent marks `fixable=false`, or that exhausts 10 rounds, becomes a scenario-failure and surfaces in Phase D for human review. At the end of E.2, emit a `ci: e2e {slug} pass|fail|skip` empty-tree commit on `platformer-specs`.
5. Loop to next slug.

When the queue is exhausted, transition to **Phase D (batched)**.

---

## Phase A — Sanity checks (no side effects)

### A.0 — Branch precondition (inline)

```powershell
git fetch origin "spec/$slug"
if ($LASTEXITCODE -ne 0) { throw "A.0: fetch of spec/$slug failed" }
git switch "spec/$slug"
if ($LASTEXITCODE -ne 0) { throw "A.0: could not switch to spec/$slug" }
git pull --ff-only origin "spec/$slug"
if ($LASTEXITCODE -ne 0) { Write-Warning "A.0: ff-only pull failed (continuing — B.1 rebase will reconcile)" }
```

### A.1 — integration-verify agent

Verifies `origin/platformer-specs` exists. Hard fail -> abort with pointer to setup step 1.

### A.2 — phase-A-setup agent

Performs every remaining Phase A check:

1. **Engine deps idempotent install:**
   ```powershell
   if (-not (Test-Path -LiteralPath (Join-Path $attractorDir 'node_modules'))) {
       Push-Location $attractorDir
       pnpm install
       if ($LASTEXITCODE -ne 0) { Pop-Location; throw "pnpm install failed" }
       Pop-Location
   }
   ```

2. **Spec file complete.** Every required section present and non-empty: Goal, Requirements, Examples, Edge Cases, Constraints, Affected Components, Interface Contracts, Out of Scope, Priority. Any literal that must match exactly (DOM IDs, localStorage keys, button labels) MUST be backtick-quoted under Interface Contracts.

3. **Affected Components must be paths, not bare names.** Each bullet must start with `platformer/`. Bare names break scope-gate and holdout-setup parsing.

4. **Scenarios file exists and non-empty.** `(Get-Item platformer/tests/scenarios/{slug}.md).Length -gt 0`. Do NOT read contents.

5. **Reject Large features.** If `## Affected Components` simultaneously lists paths under `platformer/js/player.js` (physics), `platformer/js/level.js` (level-gen), `platformer/js/ui.js` (UI), AND `platformer/js/state.js` (save format) — stop, tell user to split.

6. **Spec file must not contain the scenario-inject sentinel** (leftover from a crashed run):
   ```powershell
   if ((Get-Content -Raw $specPath) -match '<!--ATTRACTOR-SCENARIO-INJECT-->') {
       throw "spec $slug still contains scenario-inject sentinel — evaluator strip did not run; aborting."
   }
   ```

7. **Clean checkpoint dir.** Remove `last-outcome.json`, `outcome-verdict.txt`, `triage-feedback.txt`.

8. **Stale settings.json teardown.**
   ```powershell
   if (Test-Path -LiteralPath $settingsPath) { Remove-Item -LiteralPath $settingsPath -Force }
   ```

9. **Detect orphan untracked test files from a prior crashed run.**
   ```powershell
   $orphans = git status --porcelain -- platformer/tests/ | Where-Object { $_ -match '^\?\?' }
   if ($orphans) {
       throw "A.2: untracked test files from a prior crashed run detected. Run 'git clean -fdx -- platformer/tests/' to discard, then re-run."
   }
   ```

10. **Jest config smoke** — catches broken Jest config before the test-writer agent runs:
    ```powershell
    Push-Location $projectRoot
    try {
        pnpm exec jest --listTests --passWithNoTests | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "jest --listTests failed — Jest config broken" }
    } finally { Pop-Location }
    ```

11. **Hook script present:**
    ```powershell
    $hook = Join-Path $projectRoot '.claude\hooks\deny-tests-in-bash.ps1'
    if (-not (Test-Path -LiteralPath $hook)) {
        throw "Holdout hook missing at $hook. Run platformer/darkfactory-plan.md setup step 2."
    }
    ```

12. **Playwright availability** (warning only — only needed for `Kind: e2e` scenarios):
    ```powershell
    $pwVer = & pnpm exec playwright --version 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $pwVer) {
        $warnings += "Playwright not installed — any Kind:e2e scenarios will fail Phase E. Run 'pnpm exec playwright install chromium'."
    }
    ```

Return: `{ ok: true, checks: [...], warnings: [...] }`. Orchestrator surfaces warnings and proceeds; hard-throws abort.

---

## Phase B — Run the Pipeline

Single working tree, sequential agents. The orchestrator drives the retry loop.

### B.1 — Rebase agent

Spawn rebase agent with `$repoRoot`, `$slug`. Rebases `spec/{slug}` onto `origin/main`. Auto-resolves conflicts on `take_theirs_on_rebase` paths from `auto-resolve.json`. Any other conflict — abort.

### B.2 — Initial branch state captured

`$preCodingSha = git rev-parse HEAD`. Stored for B.5 diff.

### B.3 — Test-writer agent

Spawn BEFORE holdout setup. Has access to both spec and scenarios. Writes Jest tests to `platformer/tests/unit/` and (if any scenario is `Kind: e2e`) Playwright tests to `platformer/tests/playwright/dark-factory-{slug}.spec.ts`. **Writes uncommitted** — files sit in the working tree, protected by the holdout in B.4.

Return shape:
```json
{ "ok": true, "files_written": 3, "files": ["platformer/tests/unit/{slug}.test.js", "..."] }
```

### B.4 — Holdout-setup agent

Writes `platformer/.claude/settings.json`:

```json
{
  "permissions": {
    "deny": [
      "Read(platformer/tests/**)",
      "Read(platformer/**/scenarios/**)",
      "Read(platformer/.claude/**)",
      "Edit(platformer/tests/**)",
      "Write(platformer/tests/**)"
    ]
  },
  "hooks": {
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{ "type": "command", "command": "pwsh -File platformer/.claude/hooks/deny-tests-in-bash.ps1" }]
    }]
  }
}
```

`deny_relaxed` carve-outs are derived from the spec's `## Affected Components` so the coding agent can read what it needs. Hard fail if hook script missing.

### B.5 — Coding-agent supervisor loop

The orchestrator drives the rework loop. Iteration counter `$reworkIter = 0`, infra counter `$infraIter = 0`. Limits: `MAX_REWORK = 5`, `MAX_INFRA = 2`.

Each iteration:

**B.5.1 — Spawn coding-agent supervisor.**
Inputs include any prior `triage_feedback`. Supervisor launches `claude -p --verbose --output-format stream-json` inside `$projectRoot` with the spec as input, captures the JSONL stream to `transcript_path`, flattens to text. **Required canary**: every spawned coding-agent prompt MUST instruct the agent to log a line `HOLDOUT-SELFTEST: PASS` after attempting (and being denied) a read of `platformer/tests/scenarios/`. Without this canary the audit cannot diagnose holdout failures.

**B.5.2 — Audit agent.** Scans flattened transcript for `HOLDOUT-SELFTEST: PASS` line and denial markers (`denied by your permission settings`, `<tool_use_error>`). Returns `{ deny_hits, samples[], selftest_failed }`. `selftest_failed=true` -> orchestrator surfaces fatal "holdout broken" and aborts the whole pipeline (not just this slug).

**B.5.3 — Evaluator agent (with inline scenario-strip).**
```powershell
# Inline: inject scenarios into spec
$scenariosBody = Get-Content -Raw (Join-Path $scenariosDir "$slug.md")
$injectionMarker = "`n<!--ATTRACTOR-SCENARIO-INJECT-->`n## Scenarios`n$scenariosBody`n<!--/ATTRACTOR-SCENARIO-INJECT-->`n"
$specBody = Get-Content -Raw $specPath
Set-Content -LiteralPath $specPath -Value ($specBody + $injectionMarker) -NoNewline -Encoding utf8NoBOM

try {
    # Spawn evaluator agent — invokes engine on injected spec.
    $outcome = Invoke-Agent -name 'evaluator' -inputs @{ projectRoot=$projectRoot; slug=$slug; attractorDir=$attractorDir }
} finally {
    # Strip on every exit path.
    $current = Get-Content -Raw $specPath
    $stripped = $current -replace '(?s)\r?\n<!--ATTRACTOR-SCENARIO-INJECT-->.*?<!--/ATTRACTOR-SCENARIO-INJECT-->\r?\n', ''
    Set-Content -LiteralPath $specPath -Value $stripped -NoNewline -Encoding utf8NoBOM
}
```

Engine runs `platformer.dot` pipeline:
1. quick_test_gate: `pnpm exec jest --runInBand` in `$projectRoot`.
2. scenario_evaluator: reads source files referenced by `Verify by:` in each `Kind: code` scenario, emits PASS/FAIL.
3. ci_gate: lint (if configured) + jest re-run.
4. emit_outcome via `emit-outcome.ps1` -> `checkpoints/last-outcome.json`.

**B.5.4 — Branch on `engine_outcome`:**

- **SUCCESS** — Inline tests-committer:
  ```powershell
  git add platformer/tests/
  git commit -m "test: add tests for $slug"
  if ($LASTEXITCODE -ne 0) { Write-Warning "no test files to commit (test-writer wrote nothing)" }
  ```
  Then continue to Phase C.

- **NEEDS_REWORK** — Spawn **scope-gate**. Verdict `OUT_OF_SCOPE` or `HALLUCINATION` -> orchestrator exits B.5 with rework-exhausted (the triage feedback is bad-faith). Verdict `IN_SCOPE` -> increment `$reworkIter`. If `$reworkIter >= MAX_REWORK` -> exit `REWORK_EXHAUSTED`. Else loop to B.5.1 with the new `triage_feedback`.

- **NEEDS_REWORK** twice with same-shape feedback -> **B.5.4a investigator**. `verdict=INFRA` -> exit `INFRA_FAULT`. `verdict=PRODUCT` -> continue rework loop.

- **INFRA_FAULT** — `$infraIter += 1`. If `>= MAX_INFRA` -> exit. Else retry once.

- **SPEC_INVALID / REBASE_NEEDED** — exit immediately.

### B.6 — Teardown (inline, on every B exit path)

```powershell
Remove-Item -LiteralPath $settingsPath -ErrorAction SilentlyContinue
git clean -fdx -- platformer/tests/ 2>$null  # discards any uncommitted test-writer output
```

---

## Phase C — Push, merge to platformer-specs, static-load verify

### C.1 — Push spec branch

Spawn phase-C push agent: `git push -f origin spec/{slug}` (rebased).

### C.2 — Merge spec to platformer-specs (inline)

```powershell
git switch $integrationBranch
git pull --ff-only origin $integrationBranch
# Idempotency check — is this slug already merged?
$existingMerge = git log --oneline --grep="^ci: merge $slug$" origin/$integrationBranch
if ($existingMerge) {
    # Re-sync mode: cherry-pick only new fix(e2e): commits since last merge.
    # See full rivshield SKILL §C.2 for the re-sync logic.
} else {
    git merge --no-ff "spec/$slug" -m "ci: merge $slug"
    if ($LASTEXITCODE -ne 0) {
        # Auto-resolve against take_specs list from auto-resolve.json
        $config = Get-Content -Raw (Join-Path $attractorDir 'config/auto-resolve.json') | ConvertFrom-Json
        $takeSpecs = $config.take_specs
        $conflicted = git diff --name-only --diff-filter=U
        $remaining = $conflicted | Where-Object { $_ -notin $takeSpecs }
        if ($remaining) { git merge --abort; throw "C.2 merge conflict on non-auto-resolvable paths: $($remaining -join ', ')" }
        foreach ($f in $conflicted) { git checkout --ours -- $f; git add -- $f }
        git commit --no-edit
    }
}
```

### C.3 — Push platformer-specs

`git push origin platformer-specs`.

### C.4 — Verify static load (replaces deploy)

Spawn **phase-C verify-static-load** agent. It:

1. Starts `python -m http.server 8123 --directory platformer` (or `npx serve platformer -p 8123`) as background process.
2. Runs an inline Playwright check: open `http://localhost:8123/platformer.html`, wait for `DOMContentLoaded`, wait 5s, assert no uncaught errors and `window.gameState` (or another well-known global) exists.
3. Tears down the server.
4. Returns `{ ok, page_loaded, runtime_errors[], duration_ms }`.

A failed static-load = same outcome class as a failed Rivshield deploy: log, `continue` to next slug, no `ci: merge` retained on `platformer-specs` (the merge itself is reverted: `git revert HEAD --no-edit && git push origin platformer-specs`).

### C.5 — Doc-update (soft)

Spawn doc-update agent. Updates `aaron/CLAUDE.md`'s `### platformer/` section if a feature merits mention. Soft fail -> warning only.

---

## Phase D — Batched human review

After the queue empties, surface a table:

| slug | engine_outcome | static_load | e2e (n_passed / n_total) | choice |
|---|---|---|---|---|

For each row the user picks:
- **approve** -> queued for Promotion.
- **reject** -> tombstone `platformer/darkfactory/specs/{slug}.rejected.md` committed to `platformer-specs`; work stays merged but excluded from main.
- **Q&A** -> interactive clarification, then re-prompt.

---

## Promotion — approved specs to main

For each approved slug in original queue order:

```powershell
git switch main
git pull --ff-only origin main
git merge --no-ff "spec/$slug" -m "merge spec: $slug"
if ($LASTEXITCODE -ne 0) { throw "Promotion conflict on $slug — resolve manually" }
# Archive
git mv "platformer/darkfactory/specs/$slug.md" "platformer/darkfactory/specs/completed/$slug.md"
git commit -m "archive: $slug"
git push origin main
```

Run **archive** agent to verify the move on disk.

---

## Phase E — Post-deploy verification

Skipped if no scenarios in `platformer/tests/scenarios/{slug}.md` have `Kind: e2e`. Otherwise:

### E.2 — Per-scenario loop (gating)

For each `Kind: e2e` scenario (returned by **scenario-enumerator** agent):

```
round = 0
while round < 10:
    setup_result = scenario-setup(scenario, targetUrl='http://localhost:8123/platformer.html')
    if setup_result.ok:
        test_result = scenario-test(scenario, targetUrl)
        if test_result.verdict == 'PASS': mark PASS, break
        diagnose = scenario-diagnose-fix(scenario, setup_result, test_result, round, prior_diagnoses)
    else:
        diagnose = scenario-diagnose-fix(scenario, setup_result, null, round, prior_diagnoses)
    if not diagnose.fixable: mark NEEDS_HUMAN, break
    if diagnose.requires_static_reload:
        # Re-run C.4 static-load verify before next round.
        verify-static-load()
    round += 1
else:
    mark FAILED
```

The orchestrator emits a single empty-tree commit at the end of E.2:
```powershell
git commit --allow-empty -m "ci: e2e $slug pass|fail|skip"
git push origin platformer-specs
```

This commit is the load-bearing record Phase D consults.

---

## Resume protocol

On re-invocation, before running anything, check for mid-queue state:

**Priority 1 — orphan test files.** If `git status --porcelain -- platformer/tests/` shows untracked files AND `platformer/.claude/settings.json` is missing -> a prior run crashed before B.5 success or teardown. Run `git clean -fdx -- platformer/tests/` and continue from B.1 for the current branch.

**Priority 2 — stale settings.json.** If `platformer/.claude/settings.json` exists -> a prior run crashed mid-B.5. Delete it, run `git clean -fdx -- platformer/tests/`, and continue from B.1.

**Priority 3 — mid-rebase / mid-merge.** Detect with `git status`. Surface to user; do not auto-resolve.

**Priority 4 — partial queue.** Compare `origin/spec/*` branches against `ci: merge $slug` commits on `origin/platformer-specs` to derive what's already done. Resume queue at next un-processed slug.

---

## Differences from rivshield-darkfactory (quick reference)

| Removed | Replaced with |
|---|---|
| `phase-C deploy` (AWS CDK) | `phase-C verify-static-load` (Playwright against `localhost:8123`) |
| Phase E.5 (Windows Sandbox agent install) | nothing — removed entirely |
| Hyper-V snapshot rebuild gate | nothing — removed |
| Dashboard build smoke | Jest config smoke |
| dotnet warm test build | nothing — removed |
| Backdoor-OTP wrapper | nothing — no auth surface |
| `specs` integration branch | `platformer-specs` (namespaced) |

Everything else — holdout model, scope-gate, investigator, scenario gating, batched Phase D, promotion archive — is preserved.
