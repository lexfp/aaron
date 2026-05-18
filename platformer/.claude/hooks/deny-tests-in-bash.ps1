#!/usr/bin/env pwsh
# Holdout hook for the platformer dark factory.
# Adapted from rivshield/.claude/hooks/deny-tests-in-bash.ps1 — same defense-in-depth
# patterns, scoped to platformer/tests/** and platformer/**/scenarios/**.
# Blocks shell-side reads/writes of holdout paths and git plumbing that could leak them.
$ErrorActionPreference = 'Stop'
try {
    $payload = [Console]::In.ReadToEnd()
    if (-not $payload) { exit 0 }
    $obj = $payload | ConvertFrom-Json
    $cmd = "$($obj.tool_input.command)"
    if (-not $cmd) { exit 0 }
    $norm = $cmd -replace '\\','/'
    $denyPatterns = @(
        # Scenarios — single broad pattern catches every read or write of any scenarios path.
        '(?i)\bscenarios/',

        # Tests writes (broad, by write verb)
        '(?i)\b(set-content|sc|out-file|add-content|ac|copy-item|cp|move-item|mv)\b[^|;&]*\btests/',
        '(?i)>\s*tests/',

        # Tests reads via shell (defense-in-depth; tool-layer Read deny is primary)
        '(?i)\b(cat|type|gc|get-content|head|tail|less|more|findstr|select-string|sls|grep|rg|awk|sed)\b[^|;&]*\btests/',
        '(?i)<\s*tests/',
        '(?i)\b(ls|dir|gci|get-childitem)\b[^|;&]*\btests/',
        '(?i)\b(invoke-item|ii|notepad|code)\b[^|;&]*\btests/',
        '(?i)\[System\.IO\.(File|Directory)\]::[^\r\n]*\btests/',

        # Git plumbing reads of tests/
        '(?i)\bgit\s+(-[A-Za-z]\S*\s+|--\S+\s+)*?(show|log|cat-file|diff|blame|grep|archive|ls-files|ls-tree|for-each-ref|update-index|rev-list)\b[^|;&]*\btests/',
        '(?i)\bgit\s+(-[A-Za-z]\S*\s+|--\S+\s+)*?(show|log|cat-file|diff|blame)\b[^|;&]*-p\b[^|;&]*\btests/',

        # Git escape hatches — stash/reflog/fsck close plumbing-based discovery channels.
        '(?i)\bgit\s+worktree\s+add\b',
        '(?i)\bstash@\{',
        '(?i)\bgit\s+log\b[^|;&]*\s-g\b',
        '(?i)\bgit\s+log\b[^|;&]*--walk-reflogs\b',
        '(?i)\bgit\s+stash\b',
        '(?i)\bgit\s+reflog\b',
        '(?i)\bgit\s+fsck\b',
        '(?i)\bgit\s+(apply|checkout)\b[^|;&]*\btests/'
    )
    foreach ($p in $denyPatterns) {
        if ($norm -match $p) {
            [Console]::Error.WriteLine("HOLDOUT: Bash command blocked by deny-tests-in-bash hook (matched /$p/). Command: $cmd")
            exit 2
        }
    }
    exit 0
} catch {
    [Console]::Error.WriteLine("deny-tests-in-bash hook error: $($_.Exception.Message). Failing closed.")
    exit 2
}
