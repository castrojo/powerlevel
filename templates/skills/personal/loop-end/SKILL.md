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

Dispatch a self-contained subagent to process all [GAP] items.
Pass the repo name, loop goal, and the [GAP] item list inline in the prompt — the subagent is fully self-contained and does not load any external skill.

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

## Your task: process every [GAP] item without asking for confirmation.

### Step 0: Early exit if no [GAP] items
If the list above is empty, write a journal entry and stop:
  journal_write(title: "workflow-capture: no gaps — <REPO> loop", body: "No [GAP] items found.", tags: "workflow-capture")

### Step 1: For each [GAP] item, work through these sub-steps completely before moving to the next:

**1a — Classify target file:**
| Gap type | File |
|---|---|
| Skill missing a step or wrong guidance | ~/.config/opencode/skills/personal/<skill>/SKILL.md |
| Cross-cutting convention (git, PR, commit, session) | ~/.config/opencode/AGENTS.md |
| Project-specific pattern | Project AGENTS.md in repo root |
| Agent behavioral style or human preference | ~/.config/opencode/memory/persona.md or human.md |

**1b — Read current content (DB-first, NO file reads):**
- Skill edit → workflow-state_search_skill(skill_name: "<skill>", query: "<gap topic>")
- AGENTS.md edit → workflow-state_search_rules(query: "<gap topic>", domain: "<domain>")
- If DB returns nothing: run the seeder `go run ~/.config/opencode/mcp/state/seed/skills/main.go` — NEVER fall back to reading files

**1c — Apply surgical edit:**
Use the Edit tool. Do NOT rewrite the file. Add only what is missing or fix only what is wrong. 1–3 sentences maximum.

**1d — DB sync is automatic:**
The post-commit hook in opencode-config runs the seeder on every commit that touches a SKILL.md. No manual upsert_skill_section calls needed.

**1e — Decide powerlevel backport:**
Ask: "Is this fix generic enough for any user bootstrapping from scratch, with no personal refs, no specific repo names, no Bluefin/Flatpak specifics?"

**Two-audiences principle:**
- **powerlevel** (`~/src/powerlevel/templates/`) — infrastructure bootstrap for any agent. Must be fully generic: no castrojo refs, no personal usernames, no specific repo names, no Bluefin/Flatpak specifics.
- **opencode-config** (`~/.config/opencode/`) — accumulated deep knowledge for the author's synced future self. This is where gotchas, patterns, design decisions, and castrojo-specific state live.

Decision rule: "Would this be useful to anyone bootstrapping from scratch?" If yes → powerlevel. If it contains personal context, specific repo patterns, or Bluefin/Flatpak knowledge → opencode-config only. Note: powerlevel doesn't need updating every session — it bootstraps the initial setup; opencode-config is the living document.

- Yes → copy updated SKILL.md to ~/src/powerlevel/templates/skills/personal/<skill>/SKILL.md — stage but do NOT commit yet (batch in Step 3)
- No → opencode-config only

### Step 2: Commit all edits to opencode-config (always, if any edits were made):
```bash
cd ~/.config/opencode
git add AGENTS.md skills/personal/ memory/
git commit -m "fix(workflow): automated capture from <REPO> loop — <N> improvements

<bullet list of what was fixed>

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

### Step 3: Commit powerlevel backports (only if any backports were approved in Step 1e):
```bash
cd ~/src/powerlevel
git add templates/
git commit -m "feat(templates): backport <N> workflow improvements from <REPO> loop

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```
If no backports: skip this step.

### Step 4: Write journal entry:
journal_write(
  title: "Workflow capture: <REPO> loop — <N> improvements",
  body: "Processed <N> [GAP] items from <REPO> loop. Fixed: <list>. Backported: <list or 'none'>.",
  tags: "workflow-learning, workflow-capture"
)

### Step 5: Return summary:
Return a one-paragraph summary: N items processed, which files were edited, N backported to powerlevel, commit hash(es).
"""
)
```

Dispatch via Task tool and immediately continue to Stage 2 without waiting. Do NOT wait for the subagent result. Never announce the workflow-capture dispatch to the user — it runs silently in the background.

---

## Stage 2: State integrity checklist

Every item is required. Do not declare loop complete until all are checked.

### Checklist

**[ ] All plan tasks are done or skipped in DB**

**Primary (MCP):**

```
get_plan_tasks(repo: "<REPO>", plan_id: "<plan_id>", status: "pending")
```

If any tasks are still `pending` or `in_progress`: list them in the output, mark them `skipped` in the DB, and continue. The loop end is authoritative — leftover tasks are deferred to the next loop, not a blocker.

**For any task marked skipped:** call `workflow-state_append_run_summary` with a findings entry: `[GAP] Task <N> skipped: <reason>`. This ensures skipped work is visible to the next session and processed by the workflow-capture subagent.

**[ ] Skills-as-byproduct check**

First, detect loop type:

**Primary:** Check the `goal` field from `get_session_context` (already in-context from Stage 0). If `goal` contains any of: `workflow`, `loop`, `skill`, `audit` — this is a workflow improvement loop. Auto-pass this check. No DB query needed.

**Fallback** (if goal is ambiguous):

Check `latest_run_summary` (already returned by Stage 0's `get_session_context`) for keywords: "loop", "skill", "workflow". If found, auto-pass.

**Note:** Context from Stage 0 `get_session_context` is still valid — do not re-fetch.

**If auto-pass:** Show:

```
[ BYPRODUCT CHECK ] Auto-pass: workflow improvement loop — skill edits are the work.
```

**If goal is project work (not workflow/skill/audit):** Show:

```
[ BYPRODUCT CHECK ] Project loop — confirm at least one skill was updated or created this loop.
```

Proceed without blocking. The AGENTS.md rule (every non-trivial task must produce/improve a skill) is enforced by discipline, not by a gate here.

**[ ] opencode-config committed AND pushed**
```bash
git -C ~/.config/opencode status --short
```
If anything uncommitted:
```bash
cd ~/.config/opencode
git add AGENTS.md opencode.json memory/ agent-memory.json skills/personal/ agents/ plans/ devaipod.toml
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

**[ ] Record final run summary before reset**

If `get_session_context` was not called recently (e.g., Stage 0 context is stale), call it now to get the current run number:

```
get_session_context(repo: "<REPO>")
```

Then record the final run completion:

```
workflow-state_append_run_summary(
  repo: "<REPO>",
  run_num: <current_run_from_get_session_context>,
  summary: "Loop complete. All phases finished. Final state: <brief summary of what was accomplished this loop>.",
  phase: "<current_phase>"
)
```

This ensures the final run is visible in DB history. Without this call, the last run is invisible to future sessions and `get_run_history` will not reflect it.

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

### Final verification: confirm state reset in DB

Invoke `session-end` to complete session housekeeping. Proceed automatically — do not stop or ask.

Then call `get_welcome_banner` last. Its output is the final screen the user sees — nothing follows it.

```
workflow-state_get_welcome_banner(repo: "<REPO>")
```

Output the returned `banner` string verbatim. Do NOT write the banner from memory — call the tool. If the banner shows an active loop after `record_run_complete` completed successfully, this is a bug — do NOT silently correct it with another `set_loop_state` call. Instead surface it as a [GAP] in a journal entry: `journal_write(title: "loop-end [GAP]: banner shows active loop after reset", ...)`. Silent correction masks failures.

---

## Why the checklist is strict

If loop state is not reset to empty values in the DB, the next session-start (possibly on a different machine) will show "[ LOOP ACTIVE ]" with stale state. The `set_loop_state` call with empty phase/run/goal is the authoritative reset.

The skills-as-byproduct check prevents the common failure mode of completing work without capturing the knowledge gained. Every loop must leave a better skill behind — that is what makes the next loop faster.
