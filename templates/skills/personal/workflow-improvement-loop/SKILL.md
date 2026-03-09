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

```bash
ls ~/.config/opencode/skills/personal/
ls ~/src/powerlevel/templates/skills/personal/
```

For each skill, classify:
| Skill | In personal | In templates | Should be in templates? |
|---|---|---|---|

A skill belongs in powerlevel templates if it is **generic** — useful to any user who bootstraps from powerlevel, with no castrojo-specific references (no Bluefin, no specific repo names, no personal usernames).

Flag any skill in templates that:
- References castrojo, Bluefin, bluefin-lts, ublue-os, projectbluefin, or any personal repo
- Contains hardcoded paths specific to the author's machine

### Step 2: Audit the trigger table

Read `~/.config/opencode/AGENTS.md` (Personal Skills table).
Read `~/src/powerlevel/templates/AGENTS.md` (same table).

For each row: verify the skill file exists and the description matches what the skill actually does.
Flag: missing files, stale descriptions, skills that exist but aren't in the table.

### Step 3: Check loop-state-template.md schema

```bash
cat ~/.config/opencode/loop-state-template.md
```

Verify required fields are present: `phase`, `run`, `goal`.
Also verify the `## Improvements` section exists.

### Step 4: Parallel subagent audit (optional, for large audits)

If auditing more than 5 skills, dispatch parallel subagents via `dispatching-parallel-agents`:
- Agent A: audit loop-* skills for internal consistency
- Agent B: audit session-start/session-end for completeness
- Agent C: diff personal skills vs templates to find divergence

This cuts audit time significantly compared to serial reading.

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

### Execution pattern

Each run targets one of:
- A single skill update (one SKILL.md file)
- A new skill (create one SKILL.md)
- An AGENTS.md change (global or project)
- A templates cleanup (remove/add one file from powerlevel/templates/)

**No devaipod.** Workflow improvement is pure agent work: read files, identify gaps, edit, verify with `grep` or `cat` if needed.

### Per-run discipline (via loop-task)

1. Execute the fix
2. Append run summary to active plan file (BLOCKING — per loop-task Step 3)
3. If notable discovery: invoke `capture-discovery`
4. Update loop-state.md (loop-task Step 4)
5. Report via question tool (loop-task Step 6)

### Banned in Phase 2

- `improve-workflow` calls mid-run — park under ## Systemic improvements in loop-state.md
- Fixing more than one component per run — one run, one component, one plan append
- Skipping the plan-file append — it IS the run record

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
for f in templates/skills/personal/*/SKILL.md; do
  grep -q "^name:" "$f" || echo "MISSING name: in $f"
  grep -q "^description:" "$f" || echo "MISSING description: in $f"
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
git add AGENTS.md skills/personal/ plans/ loop-state-template.md memory/
git commit -m "chore(config): workflow improvement loop complete

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

**End of Phase 3.** Invoke `loop-end` to run the state integrity checklist and reset loop-state.md.

---

## After each use: improve this skill

At the end of every workflow-improvement-loop session, answer:

> "Did this skill miss anything? Was any step unclear, wrong, or absent?"

If yes: fix this SKILL.md inline before running loop-end. The skill improves itself via the
same backport mechanism — if the fix is generic, copy to powerlevel/templates/ too.

This is the "evolving prompt" property: each use produces a better skill for the next use.

---

## Cross-machine note

`loop-state.md` lives in `~/.config/opencode/plans/<repo>/` and syncs via `opencode-config`.
Start Phase 1 on one machine, continue Phase 2 on another — `session-start` will show:
```
Goal: Audit and improve workflow skills
Pipeline: ▓▓░ fix 2/3 | Phase runs: ▓░░ 1/3
```
No context is lost between machines as long as `session-start` runs `cd ~/.config/opencode && git pull` first.
