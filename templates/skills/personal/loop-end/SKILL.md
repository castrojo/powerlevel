---
name: loop-end
description: Use to close a completed loop — dispatch workflow-capture subagent at postflight, run state integrity checklist, reset loop state in DB so the next loop on any machine starts cleanly
---

Announce: "Using loop-end to close the loop."

---

## Stage 0: Orient and declare

**Primary (MCP):**

```
get_session_context(repo: "<REPO>")
```

Parse `phase` and `goal` from the JSON response.

Show:
```
Goal: <goal>
Pipeline: <all phases ▓> | All phases complete
[ LOOP END ] <REPO> • Closing loop
```

---

## Stage 1: Dispatch workflow-capture subagent

### Step 1: Check for [GAP] items

**Primary (MCP):**

```
get_run_history(repo: "<REPO>", filter: "[GAP]")
```

If no items: skip to Stage 2. Note "No workflow gaps this loop."

### Step 2: Dispatch autonomous subagent

Dispatch a subagent with the full content of the `workflow-capture` skill as the prompt.
Pass the repo name, loop goal, and the list of [GAP] items as context.

> **Note:** The invocation form below is conceptual pseudocode. In OpenCode, dispatch a
> subagent via the Task tool with subagent_type: "general". The prompt content below is
> definitive — adapt the invocation syntax to what OpenCode exposes at execution time.

```
Task(
  description: "Postflight workflow capture: process [GAP] items from <REPO> loop",
  subagent_type: "general",
  prompt: """
You are the autonomous workflow-capture subagent for the <REPO> loop.

Loop goal: <goal>
Repo: <REPO>

The following [GAP] items were recorded during this loop:
<paste [GAP] items from run history>

Follow the workflow-capture skill instructions exactly:
1. For each item: classify target file, read current content (DB-first via search_skill or search_rules; fallback Read only if DB returns nothing), apply surgical edit, sync DB, decide powerlevel backport
2. One opencode-config commit covering all edits
3. One powerlevel commit if any backports
4. One journal entry summarizing all fixes
5. Return a summary: N items, N backported, commit hash(es)

workflow-capture skill: <load workflow-capture skill content via Skill tool or paste inline>
"""
)
```

Wait for the subagent to return before proceeding.

**If subagent fails or returns an error:** fall back to the original per-item question tool workflow:
for each [GAP] item, use the question tool to present it and invoke `improve-workflow` interactively.

### Step 3: Show result

Display the subagent's summary. Then proceed to Stage 2.

---

## Stage 2: State integrity checklist

Every item is required. Do not declare loop complete until all are checked.

### Checklist

**[ ] All plan tasks are done or skipped in DB**

**Primary (MCP):**

```
get_plan_tasks(repo: "<REPO>", plan_id: "<plan_id>", status: "pending")
```

If any tasks are still `pending` or `in_progress`: surface them and ask the user whether to close anyway or complete them first. The DB is the permanent record — no file write needed.

**[ ] Skills-as-byproduct check**

First, detect loop type:

**Primary:** Check the `goal` field from `get_session_context` (already in-context from Stage 0). If `goal` contains any of: `workflow`, `loop`, `skill`, `audit` — this is a workflow improvement loop. Auto-pass this check. No DB query needed.

**Fallback** (if goal is ambiguous):

```
get_session_context(repo: "<REPO>")
```

Check `latest_run_summary` for keywords: "loop", "skill", "workflow". If found, auto-pass.

**If auto-pass:** Show:

```
[ BYPRODUCT CHECK ] Auto-pass: workflow improvement loop — skill edits are the work.
```

**If count = 0 (project work):** check DB for recent skill_sections updates:

**Primary (MCP):**

```
get_recent_skill_updates(since: "24 hours")
```

If the returned list is empty AND the loop produced non-trivial work: surface this via the question tool.

Use the question tool:
```
question: "No skills were updated this loop. Is that intentional?"
options:
  - "Yes — this was a trivial/administrative loop" → continue
  - "No — identify a skill to create or improve now" → identify and update the skill before proceeding
```

This enforces AGENTS.md rule: "any task that involves a non-obvious process must produce or improve at least one personal skill before the task is marked complete."

**[ ] opencode-config committed AND pushed**
```bash
git -C ~/.config/opencode status --short
```
If anything uncommitted:
```bash
cd ~/.config/opencode
git add AGENTS.md skills/personal/ plans/ loop-state-template.md memory/
git commit -m "chore(config): loop-end sync — <REPO> loop complete

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```
Verify push succeeded. "Committed" without push is not enough — cross-machine sync requires push.

**[ ] powerlevel committed AND pushed** (only if workflow-capture subagent backported items)
Already done by the subagent in Stage 1 Step 2 if applicable. Verify:
```bash
git -C ~/src/powerlevel status --short
```
Must be clean if a backport occurred.

**[ ] loop state reset to clean template**

**Primary (MCP):**

```
set_loop_state(repo: "<REPO>", phase: "", run: "0/0", goal: "")
```

Then commit and push this reset as part of the opencode-config commit above (or as a separate commit if the above already ran).

---

## Step 4: Declare complete

Show:
```
[ LOOP COMPLETE ] <REPO> • All phases done • State reset • Pushed to origin

Next loop-start will find a clean slate on any machine.
```

Tell the user what was accomplished:
- Runs completed
- Postflight workflow capture dispatched: [N] improvements processed (or "none")
- Skills created or updated (if any)
- Backports (if any)
- All state committed and pushed

---

## Why the checklist is strict

If loop state is not reset to empty values in the DB, the next session-start (possibly on a different machine) will show "[ LOOP ACTIVE ]" with stale state. The `set_loop_state` call with empty phase/run/goal is the authoritative reset.

The skills-as-byproduct check prevents the common failure mode of completing work without capturing the knowledge gained. Every loop must leave a better skill behind — that is what makes the next loop faster.
