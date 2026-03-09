---
name: loop-start
description: Use when starting a new loop or resuming an interrupted one — checks loop-state.md, resumes or starts fresh, orients context, confirms run count
---

# Skill: loop-start

Announce: "Using loop-start to initialize loop context."

---

## Step 1: Identify current repo

```bash
basename $(git rev-parse --show-toplevel 2>/dev/null) || echo "not-a-git-repo"
```

Record: `REPO=<name>`

---

## Step 2: Check for existing loop state

```bash
cat ~/.config/opencode/plans/<REPO>/loop-state.md 2>/dev/null || echo "NO_STATE"
```

- If file exists **and** `active_phase > 0`: show the resume block, then go to Step 2b:

  ```
  [ LOOP RESUMING ] <REPO> • Phase <active_phase> • Run <run_progress> • Last: <last_action> • Next: <next_action>
  ```

- If file missing **or** `active_phase` is `0`: go to Step 3 (fresh start)

---

## Step 2b: Resume path

Use the question tool:

```
question: "A loop is already in progress for Phase <N> (Run <X>/<Y>). Resume or restart?"
options:
  - "Resume — continue from Phase <N>, Run <X>/<Y>" → skip to Step 4
  - "Restart — archive state and start fresh" → rename loop-state.md to loop-state-<YYYYMMDD>.md, go to Step 3
```

---

## Step 3: Fresh start — create loop-state.md from template

```bash
mkdir -p ~/.config/opencode/plans/<REPO>
cp ~/.config/opencode/loop-state-template.md ~/.config/opencode/plans/<REPO>/loop-state.md
```

---

## Step 4: Orient — surface recent relevant work

```
journal_search(text: "<REPO> loop", limit: 3)
```

Read titles only. If a title is directly relevant to the current work, read that entry's body. Report any relevant findings in one sentence. If nothing relevant: say "No relevant journal entries found."

---

## Step 5: Confirm run count with user

Use the question tool:

```
question: "How many runs for this loop set?"
options:
  - "5 runs (Recommended)"
  - "3 runs"
  - "10 runs"
```

Record `N` from the answer.

---

## Step 6: Update loop-state.md

Set these fields in `~/.config/opencode/plans/<REPO>/loop-state.md`:

```
active_phase: 1
run_progress: 0/<N>
last_action: loop-start complete
next_action: invoke loop-task (Run 1)
```

Use `Edit` or write the file directly — update each field in place.

---

## Step 7: Show ready state and offer to start

```
[ LOOP READY ] <REPO> • Phase 1 • Run 0/<N>
```

Use the question tool:

```
question: "Loop ready. Start Run 1 now?"
options:
  - "Yes — start Run 1 now" → invoke loop-task immediately
  - "Stop here — I'll start the loop later" → stop
```

---

## Cost note

`loop-state.md` is < 20 lines. Reading it costs ~50 tokens. Always worth it — this is what prevents session restart confusion across machines and days.
