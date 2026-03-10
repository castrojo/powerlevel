---
name: loop-gate
description: Use after all loop-task runs complete — shows progress, parks [GAP] items for postflight capture, commits, and auto-advances the phase transition
---

Announce: "Using loop-gate to confirm phase transition."

---

## Step 1: Read current state + count [GAP] items

**Run in parallel (no dependency between these two calls):**

```
get_session_context(repo: "<REPO>")
get_run_history(repo: "<REPO>", phase: "<current_phase_name>", filter: "[GAP]")
```

From `get_session_context` parse:
- `phase` → `<name> <current>/<total>` → current_phase_name, N (current), total_phases
- `run` → `<X>/<Y>` → X, Y
- `goal` → loop goal text

Show current position:
```
Goal: <goal>
Pipeline: <pipeline_bar> <current_phase_name> <N>/<total_phases> | Phase runs: <run_bar> <X>/<Y>
[ LOOP GATE ] <REPO> • Phase <current_phase_name> complete
```

---

## Step 2: Show progress summary

List what was accomplished this phase using the results already fetched in Step 1:
- Runs completed: X/Y
- Systemic improvements found: count of [GAP] items from the parallel `get_run_history` call above

---

## Step 3: Check DB for workflow gaps — MANDATORY

This step catches stale references, retired tool names, and broken cross-references that accumulate over time.

**Primary (MCP):** Verify all skills present in the DB using `list_skills()`. Skill presence is verified by the DB — `search_skill` returns null for missing skills; no disk scan needed.

```
list_skills()
```

**If any expected skill is absent from DB:** park as a `[GAP]` item — run the seeder to re-populate:
```
append_run_summary(repo: "<REPO>", run_num: 0, findings: "[GAP] skill missing from DB: <skill_name> — run seeder", phase: "<current_phase_name>")
```

**If all skills present:** note "skills DB clean" and continue.

---

## Step 4: CI parity — human judgment only

CI parity is the developer's responsibility and is not a bot-executable check.

Automated bash parsing of `.devcontainer/devcontainer.json` always passes silently when the file is absent and provides near-zero signal — it is removed.

**Instead:** if you observed a devcontainer image mismatch during any run this phase, note it as a `[GAP]` item:

```
append_run_summary(
  repo: "<REPO>",
  run_num: 0,
  findings: "[GAP] CI parity: devcontainer image differs from CI — align them",
  phase: "<current_phase_name>"
)
```

If no mismatch was observed, skip this step entirely. This is not a blocking gate condition.

---

## Step 5: Workflow improvements

`[GAP]` items recorded during this phase are processed autonomously at postflight
by the `workflow-capture` subagent (dispatched from `loop-end` Stage 1).

No action needed here. Continue to Step 6.

---

## Step 6: Commit opencode-config (catch-all)

After all parked items are queued (catch-all for any uncommitted changes):
```bash
git -C ~/.config/opencode status --short
```

If any uncommitted changes remain:
```bash
cd ~/.config/opencode
git add AGENTS.md opencode.json memory/ agent-memory.json skills/personal/ agents/ plans/ devaipod.toml
git commit -m "chore(config): loop-gate sync — Phase <current_phase_name> complete

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

---

## Step 7: Advance phase — auto

Auto-advance to Step 8. No confirmation needed. The loop is always autonomous — no stop, no gate, no user prompt.

---

## Step 8: Advance phase

**Primary (MCP):** Determine Y (run count for next phase):

Derive Y from `get_plan_tasks(repo: "<REPO>", plan_id: "<plan_id>", status: "pending")` — count tasks in the next phase. Never use a default run count like 5 — a banner showing "0/5" is actively misleading.

**Primary (MCP):** Update DB state — advance phase name and reset run count.

**CRITICAL: Always call `set_loop_state` before invoking `loop-end`, even when Y=0.** Skipping this call leaves the DB in a stale mid-phase state and causes the next session's banner to show the wrong phase.

```
set_loop_state(
  repo: "<REPO>",
  phase: "<next_phase_name> <N+1>/<total_phases>",
  run: "0/<Y>",   ← use 0/0 when Y=0 (no pending tasks)
  goal: "<goal>"
)
```

Show:
```
Goal: <goal>
Pipeline: <updated pipeline_bar> <next_phase_name> <N+1>/<total_phases> | Phase runs: ░░░░░ 0/<Y>
[ GATE PASSED ] <REPO> • Now in phase: <next_phase_name> • Next: loop-task Run 1
```

Auto-invoke the next action immediately:
- Y > 0 (non-final phase with pending tasks) → invoke `loop-task Run 1`
- Y = 0 or final phase → invoke `loop-end`
