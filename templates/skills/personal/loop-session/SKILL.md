---
name: loop-session
description: Use when starting any loop-based work session — orients context, determines work type (workflow improvement vs project), routes to the correct entry skill; implements the ralph wiggum virtuous feedback property
---

# Skill: loop-session

Announce: "Using loop-session to orient and route this loop work session."

This is the entry point for all loop-based work sessions. It applies whether you are:
- Improving the workflow itself (skills, AGENTS.md, templates)
- Working on a project (features, bugs, refactors)

Every loop session produces useful output even when the main task "fails" — a failed run produces KNOWN ISSUES entries and journal notes that make the next run better. This is the ralph wiggum property.

---

## Step 0: Orient

Confirm session-start has already run. If not, invoke it first.

Then pull latest loop state:
```bash
cd ~/.config/opencode && git pull
```

This ensures loop-state.md is current — loop state syncs across machines via GitHub.

---

## Step 1: Determine work type

Use the question tool:

```
question: "What are we looping over today?"
options:
  - "Workflow improvement — audit/fix skills, AGENTS.md, templates" → invoke workflow-improvement-loop
  - "Project work — build, test, ship a feature or fix in a repo" → invoke project-loop
  - "Resume active loop — loop-state.md shows an active loop" → invoke loop-start (resume path)
```

---

## Step 2: Pre-flight check

Before routing, run:

```bash
cat ~/.config/opencode/plans/<REPO>/loop-state.md 2>/dev/null || echo "NO_ACTIVE_LOOP"
ls ~/.config/opencode/plans/<REPO>/ 2>/dev/null | grep -v loop-state | tail -3
```

**If loop-state.md shows an active phase** (not the template placeholder): route to "Resume active loop" regardless of user's selection — confirm with them first.

**If plan files exist**: mention the most recent one; the user may want to continue from it.

---

## Step 3: Route and confirm goal

| Work type | Entry skill | Example goal |
|---|---|---|
| Workflow meta-improvement | `workflow-improvement-loop` | "Audit and improve loop schema and entry skills" |
| Project feature/fix | `project-loop` | "Implement RSS feed in firehose" |
| Resume active loop | `loop-start` | (read from loop-state.md goal field) |

Confirm the loop goal with the user before invoking the entry skill.

Use the question tool:
```
question: "Loop goal confirmed: '<goal>'. Start the <entry_skill> now?"
options:
  - "Yes — launch <entry_skill>"
  - "Refine the goal first"
  - "Stop here — I'll start the loop manually"
```

---

## Design invariants

These apply to every loop session. Read them. They are not optional.

1. **Skills and subagents are the top primitives.** Never do work directly in the parent agent that could be dispatched as a subagent (loop-task does this via Task tool).
2. **Plans + journal = persistent memory.** The plan file is the run-by-run ground truth. The journal captures discoveries and design decisions.
3. **opencode-config syncs across machines via GitHub.** loop-state.md lives there. session-start pulls it. Start a loop on any machine; resume on any other.
4. **devaipod is the local execution environment** for all build/test tasks. CI must use the same image as .devcontainer/devcontainer.json — loop-gate checks this.
5. **Context efficiency is a hard constraint.** Subagent-per-run (loop-task) prevents parent context window exhaustion on multi-run loops.
6. **Failures are data.** A failed run that adds KNOWN ISSUES entries is not wasted — it drives the next run. This is the virtuous feedback loop property.
7. **Skills as byproduct.** Every non-trivial loop must produce or improve at least one personal skill before loop-end is declared complete.

---

## After each use: improve this skill

At the end of every loop-session, answer:
> "Did this skill orient the session correctly? Was routing clear? Did any step miss an edge case?"

If yes: fix this SKILL.md inline before running loop-end. Backport to powerlevel/templates/ if the fix is generic.

This is the evolving prompt property — the skill improves itself each use, making every next session better.
