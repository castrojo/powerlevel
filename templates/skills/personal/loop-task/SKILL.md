---
name: loop-task
description: Use to execute one loop iteration — dispatches a subagent to do the work, records run summary via MCP, updates DB state, and parks workflow improvements for later
---

Announce: "Using loop-task for Run X of N."

---

## Step 1: Show position and orient

**Primary:** Call the workflow-state MCP tool:

```
get_session_context(repo: "<REPO>")
```

Parse the JSON response:
- `phase` → `<name> <current>/<total>`
- `run` → `<X>/<N>` (X = runs done, this run is X+1)
- `goal` → loop goal text
- `pending_tasks` → pending task count

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

If a `plan_id` is known from loop-start context, fire `get_plan_tasks` in parallel with the `get_session_context` call in Step 1 — they have no dependencies on each other. Do not wait for `get_session_context` to complete before issuing `get_plan_tasks`.

Identify the task for this run from:
1. `workflow-state_get_plan_tasks(repo: "<REPO>", plan_id: "<plan_id>", status: "pending")` — claim the next pending task
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

## On completion
Record per loop-task MCP recording template: append_run_summary + update_task_status + set_loop_state.

## Return a one-paragraph summary of: outcome, key findings, any blockers.
"""
)
```

**For build/validation tasks**: include `Run: ~/.cargo/bin/devaipod run ~/src/<REPO> --host -c 'just build'` and capture output.

**For workflow tasks** (skill writing, doc updates): describe the files to edit and the changes to make. No devaipod needed.

Wait for the subagent to return before proceeding.

---

## Step 3: Verify run recorded and loop state updated

After the subagent returns:

**Primary (MCP):**

```
get_session_context(repo: "<REPO>")
```

In autonomous mode, if the subagent already called `set_loop_state`, skip this verification step and proceed directly to Step 4.

Confirm `run` field shows `<X+1>/<N>`. If it still shows `<X>/<N>`, call the MCP tools now:

```
set_loop_state(repo: "<REPO>", phase: "<phase>", run: "<X+1>/<N>", goal: "<goal>")
append_run_summary(repo: "<REPO>", run_num: <X+1>, summary: "<summary from subagent>")
```

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

Show:
```
Goal: <goal>
Pipeline: <pipeline_bar> <phase_name> <current>/<total> | Phase runs: <run_bar> <X+1>/<N>
[ RUN <X+1> COMPLETE ] <REPO> • <pass/fail summary from subagent>
```

**Auto-proceed:**
- If X+1 < N: invoke `loop-task` for the next run immediately.
- If X+1 = N: invoke `loop-gate` immediately.

No confirmation needed. The user can interrupt at any time by typing.

---

## Banned in loop-task

- Invoking improve-workflow mid-run (park under ## Improvements instead)
- Starting the next run before subagent result is received and plan append verified
- Doing the work directly in the parent agent instead of dispatching a subagent
- Using the question tool for run-to-run navigation (auto-proceed is unconditional)

---

## Why subagents

Each run dispatches a fresh subagent. The parent only sees the result summary, not the full execution context. This prevents context window exhaustion on long loops and keeps the parent clean for orchestration across the entire series.

---

## MCP recording template

Every subagent dispatched by loop-task MUST call these three MCP tools on completion:

1. `append_run_summary(repo, run_num, summary, findings, plan_id, phase)`
2. `update_task_status(repo, plan_id, task_num, status, notes)` — omit if no plan
3. `set_loop_state(repo, phase, run, goal)`

In the subagent prompt, reference this as: "Record completion per the loop-task MCP recording template."
This replaces the full 25-line block that was previously inlined in every prompt.
