---
name: loop-task
description: Use to execute one loop iteration — runs one unit of work, writes a blocking journal entry, updates loop-state.md, and parks any workflow improvements for later
---

Announce: "Using loop-task for Run X of N."

---

## Step 1: Identify current position

Read current state from loop-state.md:
```bash
grep -E "run_progress|loop_goal|total_phases|active_phase" ~/.config/opencode/plans/<REPO>/loop-state.md
```
Parse X and N from `run_progress`. Record `loop_goal`, `total_phases`, and `active_phase` for use in status blocks. This is Run X+1.

---

## Step 2: Execute the work

**For build/validation tasks** (when the loop goal involves building or testing code):
```bash
~/.cargo/bin/devaipod run ~/src/<REPO> --host -c 'just build'
```

**For workflow tasks** (when the loop goal involves writing skills, updating docs, etc.):
Execute as described in the active plan or the user's instruction for this run. Do the work directly.

**Improvement propagation rule:** When a run establishes a new pattern or convention (e.g., "use question tool for user interaction"), apply that pattern to ALL remaining interaction points across ALL affected skills in that same run — not just the point that was called out. Do not wait for the user to identify each instance. Scan forward and apply the convention completely before closing the run.

Record: what ran, what succeeded, what failed, any observations.

---

## Step 3: Append run summary to plan file — BLOCKING

Find the active plan file:
```bash
ls ~/.config/opencode/plans/<REPO>/ | grep -vE "loop-state|project-notes" | sort | tail -1
```

Append a run block to it. This write must complete before the next run starts.

```markdown
## Run <X+1> — <YYYY-MM-DD>

- What ran: <description of work done>
- Outcome: <pass / fail / partial — one line>
- Findings: <any observations worth noting, or "none">
```

If no plan file exists: append to loop-state.md under a `## Run log` section instead.

If a notable non-workflow finding (gotcha, design decision, tool behavior): invoke `capture-discovery` immediately after appending. Journal entries are for cross-session, cross-project recall — not for run tracking.

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

## Step 6: Report and offer next action via question tool

Show:
```
Loop goal: <loop_goal>
[ RUN <X+1> COMPLETE ] <REPO> • Phase <active_phase>/<total_phases> • Run <X+1>/<N> • <pass/fail summary>
```

Use the question tool to ask what to do next:

**If X+1 < N:**
```
question: "Run <X+1> complete. What next?"
options:
  - "Run <X+2> now" → invoke loop-task immediately
  - "Advance phase early (loop-gate)" → invoke loop-gate immediately
  - "Stop here — I'll continue later" → stop
```

**If X+1 = N:**
```
question: "All <N> runs complete. Advance to gate?"
options:
  - "Yes — run loop-gate now" → invoke loop-gate immediately
  - "Stop here — I'll run loop-gate later" → stop
```

---

## Banned in loop-task

- Invoking improve-workflow (park under ## Systemic improvements instead)
- Invoking capture-loop (retired — this skill replaces it)
- Starting the next run before journal_write is confirmed written
- Fixing code/skills/AGENTS.md inline during a run (observation only; fixes happen at loop-gate/loop-end)
- Using plain text to ask the user to type a skill name or command — always use the question tool for user interaction points in skills
