---
name: loop-task
description: Use to execute one loop iteration — dispatches a subagent to do the work, appends run summary to plan, updates loop-state.md, and parks workflow improvements for later
---

Announce: "Using loop-task for Run X of N."

---

## Step 1: Show position and orient

Read current state from loop-state.md:
```bash
cat ~/.config/opencode/plans/<REPO>/loop-state.md
```

Parse:
- `phase: <name> <current>/<total>` → name, current phase number, total phases
- `run: <X>/<N>` → X (runs done), N (total runs this phase). This run is X+1.
- `goal: <text>` → loop goal

**Show progress at the start of every response (before any work):**

```
Goal: <goal>
Pipeline: <pipeline_bar> <phase_name> <current>/<total> | Phase runs: <run_bar> <X+1>/<N>
Next: <what this run will do>
```

Build `pipeline_bar`: one block per phase. Phases at or before current: `▓`. Phases after: `░`.
Build `run_bar`: `▓` for done runs, `░` for remaining.

Example (phase=execute 2/3, run 2/5):
```
Goal: Add RSS feed to firehose
Pipeline: ▓▓░ execute 2/3 | Phase runs: ▓▓░░░ 2/5
Next: implement feed parser
```

---

## Step 2: Determine task and dispatch subagent

Identify the task for this run from:
1. The active plan file (find latest: `ls ~/.config/opencode/plans/<REPO>/ | grep -vE "loop-state|project-notes" | sort | tail -1`)
2. The user's instruction for this run if no plan exists

**Dispatch via Task tool** (subagent type: `general`):

```
Task(
  description: "Loop Run <X+1>: <task description>",
  subagent_type: "general",
  prompt: """
You are executing Run <X+1>/<N> of a loop in the <REPO> repo.

Loop goal: <goal>
This run's task: <task description>

Working directory: ~/src/<REPO>

## Your task
<specific instructions — what to build, what files to change, what commands to run>

## On completion, append this block to ~/.config/opencode/plans/<REPO>/<plan-file>.md:

### Run <X+1> — <YYYY-MM-DD>
- What ran: <what you did>
- Outcome: pass / fail — <root cause if fail>
- Findings: <observations, or "none">
[If failed, also add:]
- KNOWN ISSUES:
  - [ ] <specific issue to fix next run>

## Then update ~/.config/opencode/plans/<REPO>/loop-state.md:
Change `run: <X>/<N>` to `run: <X+1>/<N>`

## Return a one-paragraph summary of: outcome, key findings, any blockers.
"""
)
```

**For build/validation tasks**: include `Run: ~/.cargo/bin/devaipod run ~/src/<REPO> --host -c 'just build'` and capture output.

**For workflow tasks** (skill writing, doc updates): describe the files to edit and the changes to make. No devaipod needed.

Wait for the subagent to return before proceeding.

---

## Step 3: Verify plan append and loop-state update

After the subagent returns:

```bash
tail -8 ~/.config/opencode/plans/<REPO>/<plan-file>.md
grep "^run:" ~/.config/opencode/plans/<REPO>/loop-state.md
```

If either is missing: do it now before proceeding.

---

## Step 4: Handle workflow gaps

If a workflow gap or AGENTS.md correction surfaces:

**DO NOT invoke improve-workflow.** It is banned mid-run.

Append under ## Improvements in loop-state.md:
```bash
echo "- [ ] <gap description>" >> ~/.config/opencode/plans/<REPO>/loop-state.md
```

Processed at loop-gate and loop-end.

---

## Step 5: Report and offer next action via question tool

Show:
```
Goal: <goal>
Pipeline: <pipeline_bar> <phase_name> <current>/<total> | Phase runs: <run_bar> <X+1>/<N>
[ RUN <X+1> COMPLETE ] <REPO> • <pass/fail summary from subagent>
```

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

- Invoking improve-workflow mid-run (park under ## Improvements instead)
- Starting the next run before subagent result is received and plan append verified
- Doing the work directly in the parent agent instead of dispatching a subagent
- Using plain text to ask the user for input — always use the question tool

---

## Why subagents

Each run dispatches a fresh subagent. The parent only sees the result summary, not the full execution context. This prevents context window exhaustion on long loops and keeps the parent clean for orchestration across the entire series.
