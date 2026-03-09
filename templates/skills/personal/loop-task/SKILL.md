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

**Fallback** (if MCP unavailable):

```bash
cat ~/.config/opencode/plans/<REPO>/loop-state.md
```

Parse `phase:`, `run:`, `goal:` from the file.

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
1. **Primary (MCP):** If `plan_id` is known, call `get_plan_tasks(repo: "<REPO>", plan_id: "<plan_id>", status: "pending")` — take the lowest `task_num` result as the next task.
2. **Fallback:** Find the active plan file: `ls ~/.config/opencode/plans/<REPO>/ | grep -vE "loop-state|project-notes" | sort | tail -1`
3. The user's instruction for this run if no plan exists

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

## On completion, record the run summary via MCP (primary):

  append_run_summary(
    repo: "<REPO>",
    run_num: <X+1>,
    summary: "<one-paragraph outcome summary>",
    findings: "<bullet-point observations, or empty>",
    plan_id: "<plan_id if applicable>",
    phase: "<phase name>"
  )

  update_task_status(
    repo: "<REPO>",
    plan_id: "<plan_id>",
    task_num: <N>,
    status: "done",
    notes: "<completion notes or empty>"
  )

  set_loop_state(
    repo: "<REPO>",
    phase: "<phase>",
    run: "<X+1>/<N>",
    goal: "<goal>"
  )

## Fallback (if MCP unavailable): append this block to ~/.config/opencode/plans/<REPO>/<plan-file>.md:

### Run <X+1> — <YYYY-MM-DD>
- What ran: <what you did>
- Outcome: pass / fail — <root cause if fail>
- Findings: <observations, or "none">
[If failed, also add:]
- KNOWN ISSUES:
  - [ ] <specific issue to fix next run>

## And update ~/.config/opencode/plans/<REPO>/loop-state.md:
Change `run: <X>/<N>` to `run: <X+1>/<N>`

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

Confirm `run` field shows `<X+1>/<N>`. If it still shows `<X>/<N>`, call the MCP tools now:

```
set_loop_state(repo: "<REPO>", phase: "<phase>", run: "<X+1>/<N>", goal: "<goal>")
append_run_summary(repo: "<REPO>", run_num: <X+1>, summary: "<summary from subagent>")
```

**Fallback (file):**

```bash
tail -8 ~/.config/opencode/plans/<REPO>/<plan-file>.md
grep "^run:" ~/.config/opencode/plans/<REPO>/loop-state.md
```

If either is missing: do it now before proceeding.

---

## Step 4: Handle workflow gaps

If a workflow gap or AGENTS.md correction surfaces:

**DO NOT invoke improve-workflow.** It is banned mid-run.

**Primary (MCP):** Note in the `findings` parameter of `append_run_summary` with prefix `[GAP]`:

```
findings: "[GAP] <gap description>"
```

**Fallback (file):** Append under ## Improvements in loop-state.md:

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
