# Installs the branch-tracking hook into Claude Code's settings.json (Windows).
# Usage:  powershell -ExecutionPolicy Bypass -File scripts\install-hook.ps1

$ErrorActionPreference = 'Stop'

$claudeHome = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $env:USERPROFILE '.claude' }
$hooksDir   = Join-Path $claudeHome 'hooks'
$dest       = Join-Path $hooksDir 'branch-hook.ps1'
$src        = Join-Path $PSScriptRoot 'branch-hook.ps1'
$settingsPath = Join-Path $claudeHome 'settings.json'

New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null
Copy-Item -Path $src -Destination $dest -Force
Write-Host "Installed hook script to $dest"

$cmd = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$dest`""

$settings = @{}
if (Test-Path $settingsPath) {
    try {
        $settings = Get-Content -Raw -Path $settingsPath | ConvertFrom-Json -AsHashtable
    } catch {
        Write-Error "Failed to read existing settings.json — aborting to avoid clobbering it."
        exit 1
    }
}

if (-not $settings.ContainsKey('hooks')) { $settings['hooks'] = @{} }
if (-not $settings['hooks'].ContainsKey('PostToolUse')) { $settings['hooks']['PostToolUse'] = @() }

$existing = $settings['hooks']['PostToolUse']
$already = $false
foreach ($entry in $existing) {
    if ($entry.hooks) {
        foreach ($h in $entry.hooks) {
            if ($h.command -eq $cmd) { $already = $true }
        }
    }
}

if ($already) {
    Write-Host "Hook already registered, nothing to do."
} else {
    $settings['hooks']['PostToolUse'] += @{
        matcher = '*'
        hooks   = @(@{ type = 'command'; command = $cmd })
    }
    New-Item -ItemType Directory -Path (Split-Path $settingsPath) -Force | Out-Null
    $settings | ConvertTo-Json -Depth 10 | Set-Content -Path $settingsPath -Encoding UTF8
    Write-Host "Updated $settingsPath"
}

Write-Host "Done. Restart any active Claude Code session to pick up the new hook."
