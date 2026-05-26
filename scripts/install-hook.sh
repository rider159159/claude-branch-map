#!/usr/bin/env bash
# Installs the branch-tracking hook into Claude Code's settings.json (macOS / Linux).
#
# Idempotent: re-running won't add a duplicate entry. It will:
#   1) Copy scripts/branch-hook.sh into ~/.claude/hooks/branch-hook.sh
#   2) Make it executable
#   3) Merge a PostToolUse hook entry into ~/.claude/settings.json
#
# Usage: bash scripts/install-hook.sh

set -euo pipefail

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
HOOKS_DIR="$CLAUDE_HOME/hooks"
HOOK_SCRIPT="$HOOKS_DIR/branch-hook.sh"
SETTINGS_FILE="$CLAUDE_HOME/settings.json"
SRC_HOOK="$(cd "$(dirname "$0")" && pwd)/branch-hook.sh"

mkdir -p "$HOOKS_DIR"
cp "$SRC_HOOK" "$HOOK_SCRIPT"
chmod +x "$HOOK_SCRIPT"
echo "Installed hook script to $HOOK_SCRIPT"

python3 - "$SETTINGS_FILE" "$HOOK_SCRIPT" <<'PY'
import json, os, sys

settings_path, hook_cmd = sys.argv[1], sys.argv[2]
data = {}
if os.path.exists(settings_path):
    with open(settings_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"warning: {settings_path} is not valid JSON, leaving file untouched and aborting.")
            sys.exit(1)

hooks = data.setdefault('hooks', {})
post_tool = hooks.setdefault('PostToolUse', [])

def has_hook(entries, cmd):
    for entry in entries:
        for h in entry.get('hooks', []):
            if h.get('command') == cmd:
                return True
    return False

if has_hook(post_tool, hook_cmd):
    print("Hook already registered, nothing to do.")
else:
    post_tool.append({
        "matcher": "*",
        "hooks": [
            {"type": "command", "command": hook_cmd}
        ],
    })
    os.makedirs(os.path.dirname(settings_path), exist_ok=True)
    with open(settings_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f"Updated {settings_path}")
PY

echo "Done. Restart any active Claude Code session to pick up the new hook."
