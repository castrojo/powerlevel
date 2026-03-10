---
name: workflow-improvement-loop
description: Use when starting a workflow improvement session — audits skills/AGENTS.md/templates, fixes gaps, backports to powerlevel. This skill IS the evolving prompt; it improves each time it's used.
---

# Skill: workflow-improvement-loop

Announce: "Using workflow-improvement-loop to start a structured workflow improvement session."

This skill drives a 3-phase loop over your personal workflow:
- **Phase 1 (Audit):** Inventory all components, identify gaps
- **Phase 2 (Fix):** Apply fixes directly — no devaipod, pure agent work
- **Phase 3 (Backport):** Sync approved fixes to powerlevel/templates/, run CI lint, commit both repos

Invoke `loop-start` first if no loop is active.
Suggested goal: "Audit and improve [specific aspect] of workflow"

---

## Phase 1: Audit

**Goal:** Find gaps, inconsistencies, and misplaced content. No fixes yet.

### Step 1: Inventory personal skills

```
workflow-state_list_skills()
```

Cross-reference against powerlevel templates by listing that directory:

```bash
ls ~/src/powerlevel/templates/skills/personal/  # cross-repo comparison only — not workflow state
```

For each skill, classify:
| Skill | In personal | In templates | Should be in templates? |
|---|---|---|---|

A skill belongs in powerlevel templates if it is **generic** — useful to any user who bootstraps from powerlevel, with no castrojo-specific references (no Bluefin, no specific repo names, no personal usernames).

Flag any skill in templates that:
- References castrojo, Bluefin, bluefin-lts, ublue-os, projectbluefin, or any personal repo
- Contains hardcoded paths specific to the author's machine

### Step 2: Audit the trigger table

Use `workflow-state_search_rules(query: "personal skills trigger table")` to surface the skill table. No file read needed.

For each row: verify the skill file exists and the description matches what the skill actually does.
Flag: missing files, stale descriptions, skills that exist but aren't in the table.

### Step 3: Verify loop state schema

**Primary (MCP):** Call `get_session_context(repo: "<REPO>")` and confirm the response contains `phase`, `run`, and `goal` fields. If the call fails or returns an error, add a `[GAP]`: "workflow-state MCP unavailable — schema cannot be verified".

**Fallback only (if MCP unavailable):**

Use `workflow-state_search_skill(skill: "loop-start", query: "loop state fields")` to verify required fields. No file read.

Verify required fields are present: `phase`, `run`, `goal`. Also verify the `## Improvements` section exists.

### Step 4: Inline audit

Run all checks inline in the parent agent — no subagents. Subagents cost ~3-4k tokens of context overhead each; these are simple DB lookups that cost ~100 tokens apiece.

**Skills to audit:** loop-start, loop-task, loop-gate, loop-end, loop-session, session-start, workflow-improvement-loop

For each skill, run these checks in sequence:

**Check 1: Disk-read violations**
```
workflow-state_search_skill(skill_name: X, query: "cat skill read disk Skill tool SKILL.md")
```
Flag any section referencing: `cat SKILL.md`, `cp SKILL.md`, `grep SKILL.md`, `skill(`, `Skill tool`, `Read tool on SKILL.md`

**Check 2: Question tool in loop skills**
```
workflow-state_search_skill(skill_name: X, query: "question tool confirmation stop wait")
```
For loop skills (loop-task, loop-gate, loop-end, loop-session, loop-start): flag any section with question tool usage not clearly in a non-loop context.

**Check 3: Non-atomic task claims (loop-task only)**
```
workflow-state_search_skill(skill_name: "loop-task", query: "get_plan_tasks claim task")
```
Flag if `get_plan_tasks` + manual status update is used instead of `claim_task`.

**Check 4: Missing auto-proceed / question tool ban**
```
workflow-state_search_skill(skill_name: X, query: "auto-proceed question tool banned")
```
Flag loop skills missing explicit bans on the question tool and explicit auto-proceed language.

**AGENTS.md holistic analysis (optional):** If contradictions in AGENTS.md are suspected, dispatch **one** subagent (not five) with scope: "AGENTS.md contradiction analysis only." This is the only case where a subagent is appropriate in Phase 1 — because it requires reading a large file holistically, not just targeted DB lookups.

Compile all inline findings, then proceed to Step 5.

### Step 5: Compile findings

Produce a numbered findings list:
```
1. <finding> — <impact: high/medium/low>
2. ...
```

Sort by impact. Findings with impact=high go first in Phase 2.

**End of Phase 1.** Do not fix anything. Surface the findings list and use `loop-gate` to advance to Phase 2.

---

## Phase 2: Fix

**Goal:** Apply fixes. Each loop-task run = one component.

> **NOTE — Phase 2 (fix) is a task-splitter phase, NOT a build phase:**
> - Tasks are: edit SKILL.md files, update DB via `upsert_skill_section`, commit
> - There is **NO devaipod build step**, NO `just build`, NO compilation
> - Loop iterations map to individual skill fix tasks
> - Treat each run as: read skill → apply surgical edit → upsert to DB → commit

### Execution pattern

Each run targets one of:
- A single skill update (one SKILL.md file)
- A new skill (create one SKILL.md)
- An AGENTS.md change (global or project)
- A templates cleanup (remove/add one file from powerlevel/templates/)

**No devaipod.** Workflow improvement is pure agent work: edit files, commit to opencode-config (the post-commit hook seeds the DB automatically). Verify with `workflow-state_search_skill()` after the commit to confirm the change is reflected.

### Per-run discipline (via loop-task)

1. Execute the fix
2. Record run summary via MCP: `append_run_summary(repo, run_num, summary, findings, phase)`
3. If notable discovery: invoke `capture-discovery`
4. Update DB state via MCP: `set_loop_state(repo, phase, run, goal)`
5. Auto-proceed to next run via loop-task Step 5.

### Banned in Phase 2

- `improve-workflow` calls mid-run — park via `append_run_summary(findings: '[GAP] <description>', run_num: 0, phase: "<current_phase_name>")`
- Fixing more than one component per run — one run, one component, one `append_run_summary`
- Skipping the `append_run_summary` call — it IS the run record

**End of Phase 2.** Use `loop-gate` to advance to Phase 3.

---

## Phase 3: Backport

**Goal:** Sync approved fixes from opencode-config to powerlevel/templates/. Validate both. Push.

### Step 1: Decide what to backport (via loop-end Stage 1)

For each fix applied in Phase 2, answer: does this belong in the public template?

Generic = yes. castrojo-specific = no.

### Step 2: Copy approved skills

```bash
# Example:
cp ~/.config/opencode/skills/personal/loop-start/SKILL.md \
   ~/src/powerlevel/templates/skills/personal/loop-start/SKILL.md
```

### Step 3: Run CI lint

```bash
# In powerlevel:
cd ~/src/powerlevel
# Run the lint workflow locally if available, or manually verify:
# NOTE: bash grep on local SKILL.md files is ALLOWED in this step ONLY — these are
# actual template source files being validated for:
#   (1) required frontmatter presence (name:, description:)
#   (2) personal reference cleanliness (no castrojo, jorge, bluefin-lts, ublue-os, etc.)
# This carve-out does NOT extend to loop-state.md, plan files, or skill DB lookups.
for f in templates/skills/personal/*/SKILL.md; do
  grep -q "^name:" "$f" || echo "MISSING name: in $f"
  grep -q "^description:" "$f" || echo "MISSING description: in $f"
  grep -qiE "castrojo|jorge|bluefin-lts|ublue-os|projectbluefin" "$f" && echo "PERSONAL REF in $f"
done
echo "Lint complete"
```

### Step 4: Commit both repos

```bash
# powerlevel
cd ~/src/powerlevel
git add templates/
git diff --cached --stat
git commit -m "feat(templates): backport workflow improvements

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push

# opencode-config
cd ~/.config/opencode
git add AGENTS.md skills/personal/ plans/ memory/
git commit -m "chore(config): workflow improvement loop complete

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

**End of Phase 3.** Invoke `loop-end` to run the state integrity checklist and reset loop state in DB.

---

## After each use: improve this skill

At the end of every workflow-improvement-loop session, answer:

> "Did this skill miss anything? Was any step unclear, wrong, or absent?"

If yes: fix this SKILL.md inline before running loop-end. The skill improves itself via the
same backport mechanism — if the fix is generic, copy to powerlevel/templates/ too.

This is the "evolving prompt" property: each use produces a better skill for the next use.

---

## Cross-machine note

Loop state lives in the workflow-state DB. `get_session_context` returns current state in a single round-trip. Start Phase 1 on one machine, continue Phase 2 on another — `session-start` will show:
```
Goal: Audit and improve workflow skills
Pipeline: ▓▓░ fix 2/3 | Phase runs: ▓░░ 1/3
```
No context is lost between machines as long as the DB is running (`systemctl --user is-active opencode-state-db`).
