#!/usr/bin/env bash
# Branch tracking hook for Claude Code (PostToolUse).
# Reads the JSON payload Claude Code passes on stdin, appends one line to
# ~/.claude/branch-hook.jsonl with {sessionId, branch, ts, cwd}.

set -euo pipefail

HOOK_LOG="${CLAUDE_HOME:-$HOME/.claude}/branch-hook.jsonl"
PAYLOAD="$(cat || true)"

session_id=$(printf '%s' "$PAYLOAD" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("session_id") or d.get("sessionId") or "")' 2>/dev/null || true)
cwd=$(printf '%s' "$PAYLOAD" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("cwd") or "")' 2>/dev/null || true)
[ -z "$cwd" ] && cwd="$PWD"

branch=""
if git -C "$cwd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch=$(git -C "$cwd" branch --show-current 2>/dev/null || true)
fi

if [ -z "$session_id" ] || [ -z "$branch" ]; then
  exit 0
fi

ts=$(date +%s000)
mkdir -p "$(dirname "$HOOK_LOG")"
python3 - <<PY >> "$HOOK_LOG"
import json
print(json.dumps({
    "sessionId": "$session_id",
    "branch": "$branch",
    "ts": int("$ts"),
    "cwd": "$cwd",
}))
PY
