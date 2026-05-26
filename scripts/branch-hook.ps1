# Branch tracking hook for Claude Code (PostToolUse) on Windows.
# Reads the JSON payload from stdin and appends one line to %USERPROFILE%\.claude\branch-hook.jsonl.

$ErrorActionPreference = 'SilentlyContinue'

$claudeHome = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $env:USERPROFILE '.claude' }
$logPath = Join-Path $claudeHome 'branch-hook.jsonl'

$payloadRaw = [Console]::In.ReadToEnd()
if (-not $payloadRaw) { exit 0 }

try {
    $payload = $payloadRaw | ConvertFrom-Json
} catch {
    exit 0
}

$sessionId = $payload.session_id
if (-not $sessionId) { $sessionId = $payload.sessionId }
$cwd = $payload.cwd
if (-not $cwd) { $cwd = (Get-Location).Path }

$branch = ''
Push-Location $cwd
try {
    $isRepo = git rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -eq 0 -and $isRepo -eq 'true') {
        $branch = (git branch --show-current 2>$null).Trim()
    }
} finally {
    Pop-Location
}

if (-not $sessionId -or -not $branch) { exit 0 }

$record = [ordered]@{
    sessionId = $sessionId
    branch    = $branch
    ts        = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
    cwd       = $cwd
} | ConvertTo-Json -Compress

New-Item -ItemType Directory -Path (Split-Path $logPath) -Force | Out-Null
Add-Content -Path $logPath -Value $record -Encoding UTF8
