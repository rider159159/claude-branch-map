# Claude Branch Map

A small desktop app that lists your local Claude Code conversations and shows
which Git branch each one corresponds to. Built for the workflow "one ticket =
one Claude conversation + one Git branch", where the branch ↔ conversation
mapping becomes painful to recover after a few weeks.

> **Privacy:** Everything runs **100% locally**. The app only reads files that
> already exist on your machine (`~/.claude/...` and your Git repos) and runs
> local `git` commands. **No conversation content, file paths, or telemetry is
> ever sent over the network** — there is no backend and no analytics.

## How this differs from a history viewer

Most existing tools are **conversation history viewers** — they render your
`~/.claude` transcripts in a nice chat UI. Claude Branch Map is the other way
around: the **branch ↔ session mapping is the product**, not the chat log.

- It answers "which branch did *this* conversation produce?" and "which
  conversation created *this* branch?" — the questions you hit weeks later.
- It uses a two-tier match: a **PostToolUse hook** for high-confidence pairings,
  falling back to **commit-timestamp alignment** when no hook data exists.
- The goal is fast recovery + one-click `claude --resume`, not browsing.

If you mainly want to read and search past conversations, projects like
[universal-session-viewer](https://github.com/tad-hq/universal-session-viewer)
or [claude-code-history-viewer](https://github.com/jhlee0409/claude-code-history-viewer)
(which inspired this one) are a better fit.

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

## Releasing

Pushing a version tag triggers `.github/workflows/release.yml`, which builds the
Windows installer on CI and attaches it to a **draft** GitHub Release:

```bash
npm version patch        # bumps package.json + creates the tag
git push --follow-tags   # push the commit and the v* tag
```

Review the draft release on GitHub, then publish it. The installer is unsigned
(see below).

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
