---
name: loop-task
description: Use to execute one loop iteration — dispatches a subagent to do the work, records run summary via MCP, updates DB state, and parks workflow improvements for later
---

Announce: "Using loop-task for Run X of N."

---

## Step 1: Show position and orient

The parent agent (not subagent) shows the progress bar using context already available from loop-start. Do NOT call `get_session_context` at the start of each run — the parent has this context from loop-start orientation.

**Session-resume fallback:** If `get_session_context` returns empty or null for phase/run fields (e.g. after an interrupted session), call `workflow-state_get_run_history(repo: "<REPO>")` to find the last completed run and orient context. Do not block — continue with whatever context is available.

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

If a `plan_id` is known from loop-start context, claim the next task atomically.

Identify the task for this run from:
1. `workflow-state_claim_task(repo: "<REPO>", plan_id: "<plan_id>", agent_id: "<agent_id>")` — atomically claims and marks in_progress the next pending task (safe for parallel subagents)
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

## On completion — MANDATORY MCP call (call before returning)

workflow-state_record_run_complete(
  repo: "<REPO>",
  run_num: <X+1>,
  summary: "<one paragraph: what was done, outcome, key findings>",
  phase: "<current phase string e.g. 'fix 1/2'>",
  goal: "<goal>",
  findings: "<any [GAP] items or blockers, or empty string>",
  plan_id: "<plan_id>",    ← optional: omit if no plan
  task_num: <task_num>,    ← optional: include if plan_id provided
)

## Return a one-paragraph summary of: outcome, key findings, any blockers.
"""
)
```

**Default execution context — devaipod:** Unless the task is pure config/skill/doc editing (no compilation needed), the subagent must run build commands via devaipod:

```
Run: ~/.cargo/bin/devaipod run ~/src/<REPO> --host -c 'just build'
```

Capture stdout/stderr. Devaipod is not optional for build tasks — it is the default.

**Exception — workflow tasks** (skill writing, doc updates, AGENTS.md edits): describe the files to edit and the changes to make. No devaipod needed.

---

### Build-iteration model (project-loop execute phase)

A run in project-loop Phase 2 = one full build-fix cycle. The subagent is expected to attempt the task, observe failures, fix them, and commit — all within one run:

1. Run `just build` via devaipod
2. Observe failures
3. Fix the failures (edit source files directly)
4. Commit the fix
5. Record the run summary (what failed, what was fixed, what remains)

This is **NOT** "observe and defer." The subagent fixes and commits within the same run.

> **Scope note:** The "fix impulse → KNOWN ISSUES" pattern applies only to the **workflow-improvement-loop audit phase** (where the goal is observation without mutation). In project-loop execute phase, fixing inline is correct and expected.

---

Wait for the subagent to return before proceeding.

---

## Step 3: Verify run recorded and loop state updated

After the subagent returns, always verify via DB:

```
get_session_context(repo: "<REPO>")
```

Confirm `run` field shows `<X+1>/<N>`. If it still shows `<X>/<N>`, the subagent's `record_run_complete` call failed — call the atomic tool now in the parent before proceeding:

```
workflow-state_record_run_complete(
  repo: "<REPO>",
  run_num: <X+1>,
  summary: "<summary from subagent>",
  phase: "<phase>",
  goal: "<goal>",
  findings: "<[GAP] items or empty string>",
  plan_id: "<plan_id>",    ← optional: omit if no plan
  task_num: <task_num>,    ← optional: include if plan_id provided
)
```

Use the subagent's return text as the summary. If the subagent returned nothing useful, write a one-line summary of what the run attempted. Leave findings as empty string if no [GAP] items were raised. For `task_num`: use the value from Step 2's claim. If no `plan_id` exists, omit both `plan_id` and `task_num`.

After backfill, re-check with `get_session_context` to confirm `run` now shows `<X+1>/<N>`. This is the hard guarantee that the next session-start sees correct state.

Do not skip this check. A loop stuck at run 0/N means every future session-start shows stale active state.

---

## Step 4: Handle workflow gaps

If a workflow gap or AGENTS.md correction surfaces:

**DO NOT invoke improve-workflow.** It is banned mid-run.

**Primary (MCP):** Note in the `findings` parameter of `append_run_summary` with prefix `[GAP]`:

```
findings: "[GAP] <gap description>"
```

Processed at postflight via the `workflow-capture` subagent (dispatched from `loop-end` Stage 1).

---

## Step 5: Report and auto-proceed

> **N is the maximum number of attempts, not a fixed iteration count.** If the work completes early (e.g. no more pending tasks), invoke loop-gate immediately without exhausting all N runs.

Show:
```
Goal: <goal>
Pipeline: <pipeline_bar> <phase_name> <current>/<total> | Phase runs: <run_bar> <X+1>/<N>
[ RUN <X+1> COMPLETE ] <REPO> • <pass/fail summary from subagent>
```

**Auto-proceed:**
- If X+1 < N and pending_tasks > 0 (or no plan): invoke `loop-task` for the next run immediately.
- If X+1 < N and pending_tasks = 0: skip remaining runs and invoke `loop-gate` immediately, noting early exit.
- If X+1 = N: invoke `loop-gate` immediately.

No confirmation needed. The user can interrupt at any time by typing. **The `question` tool is banned in auto-proceed — auto-proceed is unconditional.**

---

## Banned in loop-task

- Invoking improve-workflow mid-run (park under ## Improvements instead)
- Starting the next run before subagent result is received and plan append verified
- Doing the work directly in the parent agent instead of dispatching a subagent
- Using the question tool for run-to-run navigation (auto-proceed is unconditional)
- Using the question tool for any decision within a run — loop-task runs fully autonomously; all decisions must be made without user input

---

## Container-First Rule

For any build, test, install, lint, or investigation command that does not need to modify host state directly, prefer running it in the session container:

```bash
POD=$(cat /tmp/devaipod-pod-$(basename $PWD))
podman exec ${POD}-workspace bash -c '<command>'
```

stdout is captured directly. Journal significant findings with `journal_write`.

This applies to: `just build`, `just check`, `npm install`, `cargo test`, any upstream repo investigation.

**Does NOT apply to:** git operations, memory/journal writes, skill edits.

---

## Why subagents

Each run dispatches a fresh subagent. The parent only sees the result summary, not the full execution context. This prevents context window exhaustion on long loops and keeps the parent clean for orchestration across the entire series.

---

## MCP recording template

Every subagent dispatched by loop-task MUST call `record_run_complete` on completion.
It is inlined directly into the subagent prompt — never referenced by shorthand.
A subagent starts with fresh context and has no loop skill loaded; shorthand is meaningless to it.

**The full verbatim template is in Step 2** (the `Task(...)` prompt block). Copy it as-is.
The abbreviated signature below is for quick reference only — do NOT use it as the actual prompt:

`workflow-state_record_run_complete(repo, run_num, summary, phase, goal, findings, [plan_id], [task_num])` — findings prefix `[GAP]` for workflow gaps; plan_id and task_num are optional (omit if no plan)
