---
name: session-end
description: Use at the end of every session — prompts for any unsaved discoveries, commits config changes to castrojo/opencode-config, and runs worktree hygiene in repos worked in during the session.
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
    { label: "Capture-mode rule gap", description: "AGENTS.md was missing the rule about no inline fixes during multi-run loops — triggered a correction this session" },
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

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

---

## Step 3b: Check for suspended loop

```
REPO=$(basename $(git rev-parse --show-toplevel 2>/dev/null) 2>/dev/null || echo "")
if [ -n "$REPO" ]; then
  get_loop_state(repo: "$REPO")
fi
```

Check if the `phase` field returned is non-empty to determine if a loop is active.

If phase is non-empty (loop is mid-phase):
- Inform the user: "Loop is suspended mid-phase on <REPO> (Phase <phase>, Run <run>). It will resume when you invoke session-start + loop-task on any machine."

If phase is empty or call returns no active state: skip, no action needed.

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

Finally, call `get_session_summary()` and output the `rendered_box` field verbatim. Do not paraphrase or reformat — this is the last thing the user sees.

Session is closed.
