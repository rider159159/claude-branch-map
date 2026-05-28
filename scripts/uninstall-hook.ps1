# Removes the branch-tracking hook from Claude Code's settings.json (Windows).
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\uninstall-hook.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\uninstall-hook.ps1 -PurgeLog

param(
    [switch]$PurgeLog
)

$ErrorActionPreference = 'Stop'

$claudeHome   = if ($env:CLAUDE_HOME) { $env:CLAUDE_HOME } else { Join-Path $env:USERPROFILE '.claude' }
$hooksDir     = Join-Path $claudeHome 'hooks'
$dest         = Join-Path $hooksDir 'branch-hook.ps1'
$settingsPath = Join-Path $claudeHome 'settings.json'
$hookLog      = Join-Path $claudeHome 'branch-hook.jsonl'

# The command string is exactly what install-hook.ps1 registered.
$cmd = "powershell -NoProfile -ExecutionPolicy Bypass -File `"$dest`""

# 1) Remove the matching PostToolUse entry from settings.json.
if (Test-Path $settingsPath) {
    try {
        $settings = Get-Content -Raw -Path $settingsPath | ConvertFrom-Json -AsHashtable
    } catch {
        Write-Error "Failed to read existing settings.json — aborting to avoid clobbering it."
        exit 1
    }

    $postTool = $null
    if ($settings.ContainsKey('hooks') -and ($settings['hooks'] -is [hashtable]) -and $settings['hooks'].ContainsKey('PostToolUse')) {
        # Wrap so .Count and foreach behave when there's a single entry.
        $postTool = @($settings['hooks']['PostToolUse'])
    }

    if (-not $postTool) {
        Write-Host "No PostToolUse hooks registered, nothing to remove from settings."
    } else {
        $kept = @()
        foreach ($entry in $postTool) {
            $references = $false
            if ($entry.hooks) {
                foreach ($h in $entry.hooks) {
                    if ($h.command -eq $cmd) { $references = $true }
                }
            }
            if (-not $references) { $kept += $entry }
        }

        if ($kept.Count -eq $postTool.Count) {
            Write-Host "Branch hook not found in settings, nothing to remove."
        } else {
            if ($kept.Count -gt 0) {
                $settings['hooks']['PostToolUse'] = $kept
            } else {
                $settings['hooks'].Remove('PostToolUse') | Out-Null
                if ($settings['hooks'].Count -eq 0) { $settings.Remove('hooks') | Out-Null }
            }
            # @{} | ConvertTo-Json yields nothing on PS 5.1; emit literal {} so the file stays valid JSON.
            if ($settings.Count -eq 0) {
                Set-Content -Path $settingsPath -Value '{}' -Encoding UTF8
            } else {
                $settings | ConvertTo-Json -Depth 10 | Set-Content -Path $settingsPath -Encoding UTF8
            }
            Write-Host "Removed branch hook from $settingsPath"
        }
    }
} else {
    Write-Host "No settings.json at $settingsPath, skipping."
}

# 2) Delete the installed hook script.
if (Test-Path $dest) {
    Remove-Item -Path $dest -Force
    Write-Host "Removed hook script $dest"
} else {
    Write-Host "No hook script at $dest, skipping."
}

# 3) Optionally purge the accumulated log.
if ($PurgeLog) {
    if (Test-Path $hookLog) {
        Remove-Item -Path $hookLog -Force
        Write-Host "Removed log $hookLog"
    } else {
        Write-Host "No log at $hookLog, skipping."
    }
} else {
    Write-Host "Kept $hookLog (pass -PurgeLog to delete it)."
}

Write-Host "Done. Restart any active Claude Code session to drop the hook."
