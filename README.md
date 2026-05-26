# Claude Branch Map

A small desktop app that lists your local Claude Code conversations and shows
which Git branch each one corresponds to. Built for the workflow "one ticket =
one Claude conversation + one Git branch", where the branch ↔ conversation
mapping becomes painful to recover after a few weeks.

## Features

- Scans `~/.claude/projects/*/<session-id>.jsonl` to build a session list.
- Maps each session to one or more Git branches using:
  1. **Hook records** (high confidence) — if `~/.claude/branch-hook.jsonl`
     contains entries for that session, those branches are used.
  2. **Timestamp alignment** (fallback) — branches whose first unique commit
     falls inside the session's active window are surfaced.
- Multiple matching branches are shown as multiple badges (no merging,
  no truncation).
- Click "Copy resume" on a row to copy `claude --resume <session-id>` to your
  clipboard, then paste it into a terminal to continue the conversation.

## Branch icon modes (spec §3.3)

Switch between the two definitions of "branch this session created" from the
in-app **Settings** panel:

- **A · Branches created during the session** (default) — the branch's first
  commit lies inside the session window.
- **B · Created and with at least one commit** — same as A, but filters out
  branches that were opened and never committed to.

## Repo source

By default the app treats each session's `cwd` as a Git repo and queries
branches from there. If `cwd` no longer exists, isn't a Git repo, or you want
to map sessions against a different repo, set a **manual repo path override**
in Settings.

## Hook integration (optional, recommended)

Timestamp alignment is the zero-setup default. Installing the PostToolUse hook
gives you precise, high-confidence pairings.

```bash
# macOS / Linux
bash scripts/install-hook.sh

# Windows (PowerShell)
powershell -ExecutionPolicy Bypass -File scripts\install-hook.ps1
```

The installer copies `scripts/branch-hook.*` into `~/.claude/hooks/` and merges
a PostToolUse entry into `~/.claude/settings.json`. Existing entries are kept
intact; re-running the script is safe.

## Development

```bash
npm install
npm run dev          # launches the Electron window with hot reload
npm run build        # type-check + bundle main / preload / renderer
npm run package:win  # bundle + produce Windows NSIS installer in dist/
```

## Windows SmartScreen warning

The Windows installer is **not code-signed** in this MVP. Windows will show
"Microsoft Defender SmartScreen prevented an unrecognized app from starting".
To install:

1. Click **More info** in the SmartScreen dialog.
2. Click **Run anyway**.

Signing the installer is on the roadmap once the tool is validated in real use.

## Limitations

- Resuming Claude conversations is only possible for CLI sessions on the same
  machine. The Claude desktop / mobile / web apps use a different session
  format and cannot be resumed via `claude --resume`.
- macOS / Linux builds are not produced in this MVP. The app code is platform
  agnostic but only the Windows installer is wired up in `electron-builder.yml`.

## Project layout

```
src/
  shared/   # types, jsonl parser, git wrapper, hook reader, matcher
  main/     # Electron main process, IPC handlers, settings, clipboard
  preload/  # contextBridge exposing a typed `window.api`
  renderer/ # React + Vite UI
scripts/    # hook scripts and installers
```
