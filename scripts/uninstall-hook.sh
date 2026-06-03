#!/usr/bin/env bash
# Removes the branch-tracking hook from Claude Code's settings.json (macOS / Linux).
#
# Idempotent: re-running when nothing is installed is a no-op. It will:
#   1) Remove the PostToolUse entry pointing at ~/.claude/hooks/branch-hook.sh
#   2) Delete the installed hook script
#   3) Optionally delete the accumulated branch-hook.jsonl log (pass --purge-log)
#
# Usage:
#   bash scripts/uninstall-hook.sh              # remove hook + script, keep the log
#   bash scripts/uninstall-hook.sh --purge-log  # also delete branch-hook.jsonl

set -euo pipefail

PURGE_LOG=false
for arg in "$@"; do
  case "$arg" in
    --purge-log) PURGE_LOG=true ;;
    *) echo "unknown argument: $arg" >&2; exit 1 ;;
  esac
done

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
HOOKS_DIR="$CLAUDE_HOME/hooks"
HOOK_SCRIPT="$HOOKS_DIR/branch-hook.sh"
SETTINGS_FILE="$CLAUDE_HOME/settings.json"
HOOK_LOG="$CLAUDE_HOME/branch-hook.jsonl"

# 1) Remove the matching PostToolUse entry from settings.json.
if [ -f "$SETTINGS_FILE" ]; then
  python3 - "$SETTINGS_FILE" "$HOOK_SCRIPT" <<'PY'
import json, os, sys

settings_path, hook_cmd = sys.argv[1], sys.argv[2]
with open(settings_path, 'r', encoding='utf-8') as f:
    try:
        data = json.load(f)
    except json.JSONDecodeError:
        print(f"warning: {settings_path} is not valid JSON, leaving file untouched and aborting.")
        sys.exit(1)

hooks = data.get('hooks')
post_tool = hooks.get('PostToolUse') if isinstance(hooks, dict) else None
if not isinstance(post_tool, list):
    print("No PostToolUse hooks registered, nothing to remove from settings.")
    sys.exit(0)

def references_hook(entry):
    return any(h.get('command') == hook_cmd for h in entry.get('hooks', []))

kept = [entry for entry in post_tool if not references_hook(entry)]

if len(kept) == len(post_tool):
    print("Branch hook not found in settings, nothing to remove.")
    sys.exit(0)

if kept:
    hooks['PostToolUse'] = kept
else:
    # Drop the now-empty PostToolUse key, and the hooks object if it became empty.
    del hooks['PostToolUse']
    if not hooks:
        del data['hooks']

with open(settings_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(f"Removed branch hook from {settings_path}")
PY
else
  echo "No settings.json at $SETTINGS_FILE, skipping."
fi

# 2) Delete the installed hook script.
if [ -f "$HOOK_SCRIPT" ]; then
  rm -f "$HOOK_SCRIPT"
  echo "Removed hook script $HOOK_SCRIPT"
else
  echo "No hook script at $HOOK_SCRIPT, skipping."
fi

# 3) Optionally purge the accumulated log.
if [ "$PURGE_LOG" = true ]; then
  if [ -f "$HOOK_LOG" ]; then
    rm -f "$HOOK_LOG"
    echo "Removed log $HOOK_LOG"
  else
    echo "No log at $HOOK_LOG, skipping."
  fi
else
  echo "Kept $HOOK_LOG (pass --purge-log to delete it)."
fi

echo "Done. Restart any active Claude Code session to drop the hook."
