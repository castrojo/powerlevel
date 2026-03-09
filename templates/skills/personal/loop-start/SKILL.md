---
name: loop-start
description: Use when starting a new loop or resuming an interrupted one — checks DB for active loop state, resumes or starts fresh, orients context, confirms run count and loop goal
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

**Primary:** Call the workflow-state MCP tool:

```
get_session_context(repo: "<REPO>")
```

Parse the JSON response:
- `phase` — current phase string (e.g. `"fix 1/2"`)
- `run` — run progress (e.g. `"2/3"`)
- `goal` — loop goal text
- `pending_tasks` — count of pending plan tasks (replaces counting tasks in plan file)

**Decision logic**:

- If `phase` is non-empty **and** phase current > 0 (i.e. not the template placeholder `0`): show the resume block, then go to Step 2b:

  ```
  Goal: <goal>
  Pending tasks: <pending_tasks>
  [ LOOP RESUMING ] <REPO> • <phase> • Run <run> • Next: loop-task
  ```

- If `phase` is empty or is the template placeholder: go to Step 3 (fresh start)

---

## Step 2b: Resume path

Use the question tool:

```
question: "Loop in progress for <REPO>: '<goal>' (<phase>, Run <run>). Resume or restart?"
options:
  - "Resume — continue from <phase>, Run <X>/<Y>" → skip to Step 4
  - "Restart — archive state and start fresh" → MCP path: state will be overwritten in Step 6 — no file to rename, go to Step 3.
```

---

## Step 3: Fresh start

**No action needed** — state is initialized in Step 6 via `set_loop_state`. Proceed to Step 3b.

---

## Step 3b: Seed plan tasks (if plan-based loop)

If this loop tracks a specific plan, seed the plan tasks into the DB now so `get_plan_tasks` works during runs:

```
import_plan(repo: "<REPO>", plan_id: "<plan_id>", tasks: [
  {"task_num": 1, "description": "<task 1>"},
  {"task_num": 2, "description": "<task 2>"},
  ...
])
```

**Skip if:** no `plan_id` exists for this loop, or `get_plan_tasks(repo, plan_id)` already returns results (tasks already seeded).

Proceed to Step 4.

---

## Step 4: Orient — surface recent relevant work

`get_session_context` (Step 2) already returns `latest_run_summary` — the most recent run summary from the DB. Report it in one sentence to orient context. No additional lookups needed. The DB is the single source of truth for loop run history.

**Token efficiency note:** `get_session_context` returns loop state + pending task count + latest run summary in one call (~100 tokens). `journal_search` loads N full entries unnecessarily. Always prefer the DB.

---

## Step 4b: Set execution mode

Use the question tool:

```
question: "Execution mode for this loop?"
options:
  - "Autonomous — all decisions upfront, no mid-loop gates (Recommended)" → set MODE=autonomous
  - "Interactive — confirm at each phase gate" → set MODE=interactive
```

Record `MODE`. When MODE=autonomous: loop-gate Step 7 and loop-end Stage 1 question gates are skipped automatically.

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

## Step 5b: Set loop goal

Use the question tool:

```
question: "Describe this loop's goal in one sentence."
options:
  - (custom — user types their own)
```

Record as `LOOP_GOAL`.

---

## Step 5c: Set phase names

Use the question tool:

```
question: "What are the phases for this loop? (comma-separated)"
options:
  - "fix,backport  (workflow improvement — Recommended for workflow-improvement-loop)"
  - "plan,execute,ship  (project work — Recommended for project-loop)"
  - "audit,fix,backport  (full workflow improvement with audit phase)"
```

Record as `PHASE_NAMES`. Derive `TOTAL_PHASES` from the count of comma-separated values.

---

## Step 5d: Subagent strategy for Phase 1

Evaluate: does the first phase involve auditing or investigating **5 or more independent components**?

- **Yes (5+ components):** Use parallel subagent dispatch (via `dispatching-parallel-agents`) in Phase 1 runs. Note this in `append_run_summary` findings for the phase.
- **No (< 5 components):** Sequential loop-task runs. No subagents needed.

This is a cost/efficiency decision — parallel subagents cut audit time but add overhead for small scopes.

---

## Step 6: Update loop state

```
set_loop_state(
  repo: "<REPO>",
  phase: "<first_phase_name> 1/<TOTAL_PHASES>",
  run: "0/<N>",
  goal: "<LOOP_GOAL>"
)
```

---

## Step 7: Show ready state and offer to start

```
Goal: <LOOP_GOAL>
Pipeline: <phase bar> | Phase runs: ░░░░░ 0/<N>
[ LOOP READY ] <REPO> • Next: loop-task (Run 1)
```

**Progress bar format:**

Split `PHASE_NAMES` on commas. Map to filled/empty blocks:
- Completed phases: `▓`
- Current phase (first): `▓` with phase name
- Future phases: `░`

Example for phases="fix,backport", 2 total:
```
Goal: Improve loop system
Pipeline: ▓░ fix 1/2 | Phase runs: ░░░░░ 0/5
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

`get_session_context` returns loop state + pending task count + latest run summary in a single DB round-trip (~100 tokens). This replaces loading `loop-state.md` (~20 tokens) **and** scanning the plan file for pending tasks (potentially hundreds of tokens on large plans). Always call MCP first; fall back to the file read only if MCP is unavailable.
