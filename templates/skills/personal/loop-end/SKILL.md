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

---

Step 0: Early exit if no [GAP] items

If the list above is empty, write a journal entry and stop:
  journal_write(title: "workflow-capture: no gaps — <REPO> loop", body: "No [GAP] items found.", tags: "workflow-capture")

---

Step 1: For each [GAP] item, work through these sub-steps completely before moving to the next:

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
Ask: "Is this fix generic enough for any user bootstrapping from scratch, with no personal refs, no specific repo names?"
- Yes → copy updated SKILL.md to ~/src/powerlevel/templates/skills/personal/<skill>/SKILL.md — stage but do NOT commit yet
- No → opencode-config only

---

Step 2: Commit all edits to opencode-config:

```bash
cd ~/.config/opencode
git add AGENTS.md skills/personal/ memory/
git commit -m "fix(workflow): automated capture from <REPO> loop — <N> improvements

<bullet list of what was fixed>

Assisted-by: [Model Name] via [Tool Name]"
git push
```

---

Step 3: Commit powerlevel backports (only if any approved in Step 1e):

```bash
cd ~/src/powerlevel
git add templates/
git commit -m "feat(templates): backport <N> workflow improvements from <REPO> loop

Assisted-by: [Model Name] via [Tool Name]"
git push
```

---

Step 4: Write journal entry:

journal_write(
  title: "Workflow capture: <REPO> loop — <N> improvements",
  body: "Processed <N> [GAP] items from <REPO> loop. Fixed: <list>. Backported: <list or 'none'>.",
  tags: "workflow-learning, workflow-capture"
)

---

Step 5: Return summary:

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
git add AGENTS.md skills/personal/ plans/ memory/
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

### Final verification: confirm state reset in DB

Invoke `session-end` to complete session housekeeping. Proceed automatically — do not stop or ask.

Then call `get_welcome_banner` last. Its output is the final screen the user sees — nothing follows it.

```
workflow-state_get_welcome_banner(repo: "<REPO>")
```

Output the returned `banner` string verbatim. Do NOT write the banner from memory — call the tool. If the banner shows an active loop, re-run `set_loop_state(repo: "<REPO>", phase: "", run: "0/0", goal: "")` and call the banner tool again.

---

## Why the checklist is strict

If loop state is not reset to empty values in the DB, the next session-start (possibly on a different machine) will show "[ LOOP ACTIVE ]" with stale state. The `set_loop_state` call with empty phase/run/goal is the authoritative reset.

The skills-as-byproduct check prevents the common failure mode of completing work without capturing the knowledge gained. Every loop must leave a better skill behind — that is what makes the next loop faster.
