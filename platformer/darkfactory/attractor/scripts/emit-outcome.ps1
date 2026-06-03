#!/usr/bin/env pwsh
# emit-outcome.ps1
# Final tool node in the platformer.dot pipeline. Reads outcome-verdict.txt
# and triage-feedback.txt from the checkpoint dir (written upstream by the
# triage codergen LLM nodes) and atomically writes last-outcome.json.
#
# Contract (read by the orchestrator's evaluator agent):
# {
#   "engine_outcome":   "SUCCESS" | "NEEDS_REWORK" | "INFRA_FAULT" | "SPEC_INVALID" | "REBASE_NEEDED",
#   "triage_feedback":  "<plain-English body>" | null,
#   "validation_errors": [ "..." ] | null,
#   "emitted_at_utc":   "<ISO-8601 UTC>"
# }
#
# Writes UTF-8 no BOM, atomically (write to .tmp, then Move-Item).
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$CheckpointDir,
    [string]$VerdictFile     = 'outcome-verdict.txt',
    [string]$FeedbackFile    = 'triage-feedback.txt',
    [string]$ValidationFile  = 'validation-errors.json',
    [string]$OutFile         = 'last-outcome.json'
)

$ErrorActionPreference = 'Stop'

function Read-IfExists($path) {
    if (Test-Path -LiteralPath $path) {
        return (Get-Content -LiteralPath $path -Raw -Encoding utf8).Trim()
    }
    return $null
}

$verdictPath    = Join-Path $CheckpointDir $VerdictFile
$feedbackPath   = Join-Path $CheckpointDir $FeedbackFile
$validationPath = Join-Path $CheckpointDir $ValidationFile
$outPath        = Join-Path $CheckpointDir $OutFile
$tmpPath        = "$outPath.tmp"

$verdict = Read-IfExists $verdictPath
if (-not $verdict) {
    # Engine reached emit_outcome with no verdict written upstream — treat as infra fault.
    $verdict = 'INFRA_FAULT'
}

$allowed = @('SUCCESS','NEEDS_REWORK','INFRA_FAULT','SPEC_INVALID','REBASE_NEEDED')
if ($allowed -notcontains $verdict) {
    Write-Warning "emit-outcome: unrecognized verdict '$verdict'; coercing to INFRA_FAULT"
    $verdict = 'INFRA_FAULT'
}

$feedback = $null
if ($verdict -eq 'NEEDS_REWORK' -or $verdict -eq 'INFRA_FAULT') {
    $feedback = Read-IfExists $feedbackPath
}

$validationErrors = $null
if (Test-Path -LiteralPath $validationPath) {
    try {
        $validationErrors = Get-Content -LiteralPath $validationPath -Raw -Encoding utf8 | ConvertFrom-Json
    } catch {
        Write-Warning "emit-outcome: validation-errors.json present but unparseable: $($_.Exception.Message)"
    }
}

$payload = [ordered]@{
    engine_outcome    = $verdict
    triage_feedback   = $feedback
    validation_errors = $validationErrors
    emitted_at_utc    = (Get-Date).ToUniversalTime().ToString('o')
}

$json = $payload | ConvertTo-Json -Depth 8

# UTF-8 no BOM atomic write.
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($tmpPath, $json, $utf8NoBom)
Move-Item -LiteralPath $tmpPath -Destination $outPath -Force

Write-Output "emit-outcome: wrote $outPath (verdict=$verdict)"
