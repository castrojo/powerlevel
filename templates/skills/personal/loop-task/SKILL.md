---
name: loop-task
description: Use to execute one loop iteration — runs one unit of work, writes a blocking journal entry, updates loop-state.md, and parks any workflow improvements for later
---

Announce: "Using loop-task for Run X of N."

---

## Step 1: Identify current position

Read current run number from loop-state.md:
```bash
grep "run_progress" ~/.config/opencode/plans/<REPO>/loop-state.md
```
Parse X and N. This is Run X+1.

---

## Step 2: Execute the work

**For build/validation tasks** (when the loop goal involves building or testing code):
```bash
~/.cargo/bin/devaipod run ~/src/<REPO> --host -c 'just build'
```

**For workflow tasks** (when the loop goal involves writing skills, updating docs, etc.):
Execute as described in the active plan or the user's instruction for this run. Do the work directly.

Record: what ran, what succeeded, what failed, any observations.

---

## Step 3: journal_write — BLOCKING

This write must complete before any other action. Run X+1 does not start until this is written.

```
journal_write(
  title: "<REPO> Loop Run <X+1> — <YYYY-MM-DD>",
  body: "<what ran, what passed, what failed, observations, timing if relevant>",
  tags: "workflow-learning, <REPO>"
)
```

If the session ends before this write: the run is not documented and must be re-run. The blocking requirement exists precisely to prevent this.

---

## Step 4: Update loop-state.md

Update these fields:
- run_progress: <X+1>/<N>
- last_action: journal_write Run <X+1>
- next_action: invoke loop-task Run <X+2> (or "invoke loop-gate" if X+1 = N)

```bash
# Read current loop-state.md, update the three fields, write back
```

---

## Step 5: Handle workflow gaps (BANNED list)

If a workflow gap, missing skill step, or AGENTS.md correction is noticed:

**DO NOT invoke improve-workflow.** It is banned mid-run.

Instead, append under ## Systemic improvements in loop-state.md:
```bash
echo "- [ ] <gap description>" >> ~/.config/opencode/plans/<REPO>/loop-state.md
```

These will be processed at loop-gate and loop-end.

If a notable non-workflow finding (gotcha, design decision, tool behavior): invoke capture-discovery.

---

## Step 6: Report and suggest next action

Show:
```
[ RUN <X+1> COMPLETE ] <REPO> • Run <X+1>/<N> • <pass/fail summary>
```

If X+1 < N:
> "Run <X+1> complete. Invoke loop-task for Run <X+2>, or loop-gate to advance phase early."

If X+1 = N:
> "All <N> runs complete. Invoke loop-gate to review findings and advance to the next phase."

---

## Banned in loop-task

- Invoking improve-workflow (park under ## Systemic improvements instead)
- Invoking capture-loop (retired — this skill replaces it)
- Starting the next run before journal_write is confirmed written
- Fixing code/skills/AGENTS.md inline during a run (observation only; fixes happen at loop-gate/loop-end)
