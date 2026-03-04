---
name: session-end
description: Use at the end of every session — prompts for any unsaved discoveries, commits config changes, and runs worktree hygiene.
---

# Session End

Run before closing OpenCode.

**Announce:** "Using session-end to close out the session."

---

## Step 1: Prompt for unsaved discoveries

Ask:
> "Before closing: were there any discoveries this session that aren't yet in a journal entry?"

If yes: invoke `capture-discovery` for each before continuing.

---

## Step 2: Check config changes

```bash
git -C ~/.config/opencode status --short
```

If empty: skip to Step 4.

---

## Step 3: Commit config changes

```bash
cd ~/.config/opencode
git add AGENTS.md opencode.json memory/ agent-memory.json skills/personal/ agents/ plans/
git commit -m "chore(config): sync session changes

Assisted-by: <Model> via OpenCode"
git push
```

---

## Step 4: Worktree hygiene

For each repo worked in this session:

```bash
git worktree prune
git worktree list
```

Remove any stale worktrees outside `.worktrees/<branch>`.

---

## Step 5: Done

Report: config committed or "no changes", which repos had worktree hygiene, any discoveries captured.
