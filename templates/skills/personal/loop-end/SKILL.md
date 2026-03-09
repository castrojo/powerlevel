---
name: loop-end
description: Use to close a completed loop — backport approved improvements to powerlevel, run state integrity checklist, reset loop-state.md so the next loop on any machine starts cleanly
---

Announce: "Using loop-end to close the loop."

---

## Stage 0: Orient and declare

**Primary (MCP):**

```
get_session_context(repo: "<REPO>")
```

Parse `phase` and `goal` from the JSON response.

**Fallback (file):**

```bash
cat ~/.config/opencode/plans/<REPO>/loop-state.md
```

Parse `phase:` and `goal:`.

Show:
```
Goal: <goal>
Pipeline: <all phases ▓> | All phases complete
[ LOOP END ] <REPO> • Closing loop
```

---

## Stage 1: Backport review

### Step 1: Read improvements

**Primary (psql):** There is no `get_run_history` MCP tool. Query `run_history` directly:

```bash
podman exec $(podman ps --filter name=opencode-state-db -q) psql -U workflow -d workflow_state \
  -c "SELECT findings FROM run_history WHERE repo='<REPO>' ORDER BY created_at" \
  | grep '\[GAP\]'
```

Any line with `[GAP]` prefix is a workflow improvement candidate.

**Fallback (file):**

```bash
grep '\[GAP\]' ~/.config/opencode/plans/<REPO>/loop-state.md 2>/dev/null
cat ~/.config/opencode/plans/<REPO>/loop-state.md
```

Extract all items under ## Improvements.

If no items: skip to Stage 2.

### Step 2: Collect decisions for all items

For each item, use the question tool — do NOT copy files yet:

```
question: "Systemic improvement: '<item description>'. Backport this to powerlevel templates?"
options:
  - "Yes — approve for backport" → mark approved
  - "No — opencode-config only" → skip
```

Collect a list: `approved = [<item1>, <item2>, ...]`

### Step 3: Copy all approved items and commit once

After all decisions are collected:

For each approved item (skill changes):
```bash
# Example: if the improvement is to loop-start/SKILL.md
cp ~/.config/opencode/skills/personal/loop-start/SKILL.md \
   ~/src/powerlevel/templates/skills/personal/loop-start/SKILL.md
```

After ALL copies:
```bash
cd ~/src/powerlevel
git add templates/
git commit -m "feat(templates): backport workflow improvements from <REPO> loop

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

If no items approved for backport: skip the powerlevel commit entirely.

---

## Stage 2: State integrity checklist

Every item is required. Do not declare loop complete until all are checked.

### Checklist

**[ ] Plan file has run blocks for all N runs**

**Primary (MCP):** Export the plan and write to the plan file:

```
export_plan(repo: "<REPO>", plan_id: "<plan_id>")
```

Write the returned markdown to `~/.config/opencode/plans/<REPO>/<active-plan-file>.md`. This replaces the run count check — the export includes all tasks with their status and notes, which serves as the permanent record.

**Fallback (file):**

```bash
grep "^## Run " ~/.config/opencode/plans/<REPO>/<active-plan-file>.md | wc -l
```

Count must equal N (the run count set at loop-start).
If any run blocks are missing: append them now from session context before proceeding.

**[ ] Plan file has findings block appended**
Check ~/.config/opencode/plans/<REPO>/ for the active plan file.
If no findings block exists: append one now:
```markdown
## Loop findings — <YYYY-MM-DD>

- Runs completed: <N>/<N>
- Systemic improvements: <list or "none">
- Backported to powerlevel: <list or "none">
```

**[ ] Skills-as-byproduct check**

First, detect loop type:

**Primary (MCP):** Check run_history for loop-skill keywords in findings/summaries:

```bash
podman exec $(podman ps --filter name=opencode-state-db -q) \
  psql -U workflow -d workflow_state \
  -c "SELECT COUNT(*) FROM run_history WHERE repo='<REPO>' AND (summary ILIKE '%loop%' OR summary ILIKE '%skill%' OR findings ILIKE '%loop%');"
```

**Fallback (file):**

```bash
# Check if this was a workflow-improvement or loop-session run
grep -l "workflow-improvement-loop\|loop-session\|loop-task\|loop-gate\|loop-start\|loop-end" \
  ~/.config/opencode/plans/<REPO>/<active-plan-file>.md 2>/dev/null | wc -l
```

**If count > 0 (plan references loop/workflow skills):** this is a workflow improvement loop — the work itself IS skill edits. Auto-pass this check. Show:

```
[ BYPRODUCT CHECK ] Auto-pass: workflow improvement loop — skill edits are the work.
```

**If count = 0 (project work):** check DB for recent skill_sections updates:

**Primary (MCP):**

```bash
podman exec $(podman ps --filter name=opencode-state-db -q) \
  psql -U workflow -d workflow_state \
  -c "SELECT skill, MAX(updated_at) FROM skill_sections WHERE updated_at > NOW() - INTERVAL '24 hours' GROUP BY skill ORDER BY MAX(updated_at) DESC;"
```

If output is empty AND the loop produced non-trivial work: surface this via the question tool.

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

**[ ] powerlevel committed AND pushed** (only if backport happened)
Already done in Stage 1 Step 3 if applicable. Verify:
```bash
git -C ~/src/powerlevel status --short
```
Must be clean if a backport occurred.

**[ ] loop state reset to clean template**

**Primary (MCP):**

```
set_loop_state(repo: "<REPO>", phase: "", run: "0/0", goal: "")
```

**Fallback (file):**

```bash
cp ~/.config/opencode/loop-state-template.md ~/.config/opencode/plans/<REPO>/loop-state.md
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
- Systemic improvements processed
- Skills created or updated (if any)
- Backports (if any)
- All state committed and pushed

---

## Why the checklist is strict

If loop-state.md is not reset to the clean template, the next session-start (possibly on a different machine) will show "[ LOOP ACTIVE ]" with stale state.

Push (not just commit) is mandatory because loop-state.md lives in opencode-config for cross-machine sync. A local-only commit defeats the purpose.

The skills-as-byproduct check prevents the common failure mode of completing work without capturing the knowledge gained. Every loop must leave a better skill behind — that is what makes the next loop faster.
