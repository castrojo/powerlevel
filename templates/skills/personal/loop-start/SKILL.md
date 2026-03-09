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

**Fallback** (if MCP unavailable or returns an error):

```bash
cat ~/.config/opencode/plans/<REPO>/loop-state.md 2>/dev/null || echo "NO_STATE"
```

Parse `phase:` field from the file. Format is `<name> <current>/<total>`.

**Decision logic** (same for both MCP and file fallback):

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
  - "Restart — archive state and start fresh" → MCP path: state will be overwritten in Step 6 — no file to rename, go to Step 3. Fallback: rename loop-state.md to loop-state-<YYYYMMDD>.md, go to Step 3.
```

---

## Step 3: Fresh start

**MCP path (primary):** No action needed — state is initialized in Step 6 via `set_loop_state`. Proceed to Step 4.

**Fallback only (if MCP unavailable):**

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

**Primary:** Call the workflow-state MCP tool:

```
set_loop_state(
  repo: "<REPO>",
  phase: "<first_phase_name> 1/<TOTAL_PHASES>",
  run: "0/<N>",
  goal: "<LOOP_GOAL>"
)
```

**Fallback** (if MCP unavailable):

Write these fields to `~/.config/opencode/plans/<REPO>/loop-state.md`:

```
phase: <first_phase_name> 1/<TOTAL_PHASES>
run: 0/<N>
goal: <LOOP_GOAL>
```

Use `Edit` to update each field in place. The `## Improvements` section stays unchanged.

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
