---
name: session-end
description: Use at the end of every session — prompts for any unsaved discoveries, commits config changes to opencode-config, and runs worktree hygiene in repos worked in during the session.
---

# Session End

Run this before closing OpenCode. Takes under 2 minutes.

**Announce:** "Using session-end to close out the session."

---

## Step 1: Prompt for unsaved discoveries

Scan the session context and surface 4–5 candidate discoveries, prioritized by:
1. **Workflow corrections** — rule gaps or bans that were triggered (highest value: prevents future token waste)
2. **Build/CI patterns** — Justfile, container, or pipeline gotchas confirmed this session
3. **Design decisions** — architecture or tool choices made and reasoned through
4. **Tool behavior** — non-obvious behavior of devaipod, podman, gh, opencode, etc.
5. **Gotchas** — anything that caused a wrong turn or retry

Use the `question` tool with those candidates as options (1–2 sentence description each), plus a "Nothing to capture" option. Set `multiple: true` so the user can select any combination.

Example:
```
question([{
  question: "Which of these are worth capturing in the journal?",
  header: "Unsaved discoveries",
  multiple: true,
  options: [
    { label: "Rule gap found", description: "AGENTS.md was missing a rule that was triggered — corrected this session" },
    { label: "Justfile self-contained rule", description: "just build must include npm install — confirmed gap and fixed" },
    { label: "Nothing to capture", description: "All findings are already journaled" }
  ]
}])
```

For each selected item (excluding "Nothing to capture"): invoke `capture-discovery`.
If "Nothing to capture" is selected or all are already journaled: proceed to Step 2.

---

## Step 1b: Run container-harvest (if devaipod was used)

If this session dispatched work to a container via `podman exec devaipod-...-workspace`:

- Follow the `container-harvest` skill to journal significant findings and check for output files
- Then continue to Step 2

---

## Step 2: Check config changes

```bash
git -C ~/.config/opencode status --short
```

If the output is empty: skip to Step 4 (no commit needed).

If files are modified or untracked, show the diff summary:

```bash
git -C ~/.config/opencode diff --stat
```

---

## Step 3: Commit config changes

```bash
cd ~/.config/opencode
git add AGENTS.md opencode.json memory/ agent-memory.json skills/personal/ agents/ plans/ devaipod.toml
git commit -m "chore(config): sync session changes

Assisted-by: <Model> via <Tool>"
git push
```

---

## Step 3b: Check for suspended loop

```bash
REPO=$(basename $(git rev-parse --show-toplevel 2>/dev/null) 2>/dev/null || echo "")
if [ -n "$REPO" ]; then
  grep "^active_phase:" ~/.config/opencode/plans/${REPO}/loop-state.md 2>/dev/null || true
fi
```

If active_phase > 0 (loop is mid-phase):
- Include loop-state.md in the git add in Step 3 (it may have new ## Systemic improvements entries)
- Inform the user: "Loop is suspended mid-phase on <REPO> (Phase <N>, Run <X>/<Y>). It will resume when you invoke session-start + loop-task on any machine."

If active_phase is 0 or file missing: skip, no action needed.

---

## Step 4: Worktree hygiene

For each repo worked in this session:

```bash
git worktree prune   # removes stale refs for deleted worktree directories
git worktree list    # verify only active worktrees remain
```

If any worktree path is outside the repo root (`.worktrees/<branch>` is the correct location), it was created under the old global convention — remove it:

```bash
git worktree remove <path>      # if the branch work is done
git worktree remove --force <path>   # if truly stale
```

---

## Step 4b: Tear down container pod

```bash
REPONAME=$(basename $(git rev-parse --show-toplevel 2>/dev/null) 2>/dev/null)
POD=$(cat /tmp/devaipod-pod-${REPONAME} 2>/dev/null)

if [ -n "$POD" ]; then
  ~/.cargo/bin/devaipod delete $POD --host
  rm /tmp/devaipod-pod-${REPONAME}
  echo "Pod $POD deleted"
else
  echo "No pod found for this session — skipping teardown"
fi
```

---

## Step 5: Done

Report to the user:
- Whether config was committed (or "no changes")
- Which repos had worktree hygiene run
- Any discoveries captured

Session is closed.
