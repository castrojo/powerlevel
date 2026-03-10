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

**HARD STOP.** Invoke the `session-start` skill NOW if it has not already run this session. Do not read further. Do not pull loop state. Do not invoke `loop-session`. The welcome banner must be displayed and session-start must complete before any loop work begins.

Once session-start is complete, pull latest config:
```bash
cd ~/.config/opencode && git pull
```

---

## Step 1: Determine work type

Auto-detect from DB state and user's opening message:
- `get_session_context` returned non-empty `phase` → route to "Resume active loop" → invoke loop-start
- User's opening message contains "project", "feature", "fix", "build", "ship" → route to `project-loop`
- User's opening message contains "workflow", "audit", "skill", "improve", "template" → route to `workflow-improvement-loop`
- Default → `workflow-improvement-loop`

Announce: "Auto-detected: invoking <skill>." Do not use the question tool.

---

## Step 2: Pre-flight check

Before routing, call:

```
workflow-state_get_loop_state(repo: "<REPO>")
workflow-state_get_session_context(repo: "<REPO>")
```

Do NOT use `cat`, `ls`, or any file read on loop-state.md or plan files — DB tools only.

**If loop state shows an active phase** (non-empty phase field): route to "Resume active loop" regardless of user's selection — route directly, no confirmation.

**If latest_run_summary is non-empty**: mention the last run context; the user may want to continue from it.

---

## Step 3: Route and confirm goal

| Work type | Entry skill | Example goal |
|---|---|---|
| Workflow meta-improvement | `workflow-improvement-loop` | "Audit and improve loop schema and entry skills" |
| Project feature/fix | `project-loop` | "Implement RSS feed in firehose" |
| Resume active loop | `loop-start` | (read from get_session_context goal field) |

Skip confirmation. Invoke the entry skill immediately. Announce: "Routing to <entry_skill> with goal: '<goal>'."

---

## Design invariants

These apply to every loop session. Read them. They are not optional.

1. **Skills and subagents are the top primitives.** Never do work directly in the parent agent that could be dispatched as a subagent (loop-task does this via Task tool).
2. **DB is the loop's state — plan files and loop-state.md DO NOT EXIST on disk.** The workflow-state DB (`get_plan_tasks`, `get_session_context`, `append_run_summary`, `import_plan`, `set_loop_state`) is the run-by-run ground truth. The journal captures discoveries and design decisions. No `.md` files for plans; `import_plan` is the only way task data enters the DB. `loop-state.md` must never be created in any plans/ directory. If you find yourself about to create either, stop: write to the DB instead.
3. **Question tool is unconditionally banned in all loop skills.** loop-session, loop-start, loop-task, loop-gate, loop-end run fully autonomously end-to-end. There is no interactive mode. No conditional exception for "some phases" or "routing decisions." If you find yourself about to use the question tool inside any loop skill, stop and continue without it.
4. **Subagent prompts are self-contained.** Subagents start with fresh context and have no loop skill loaded. The three MCP recording calls (append_run_summary, update_task_status, set_loop_state) must be inlined verbatim in every subagent prompt — never reference "the MCP recording template" as shorthand. A subagent that cannot find the template will silently skip the DB writes, causing every future session-start to show the loop stuck at run 0.
5. **opencode-config syncs across machines via GitHub.** Loop state is stored in the workflow-state DB. session-start calls get_session_context and surfaces the active loop in the welcome banner. Start a loop on any machine; resume on any other.
6. **devaipod is the local execution environment** for all build/test tasks. CI must use the same image as .devcontainer/devcontainer.json — loop-gate checks this.
7. **Context efficiency is a hard constraint.** Subagent-per-run (loop-task) prevents parent context window exhaustion on multi-run loops.
8. **Failures are data (Ralph Wiggum property).** A failed run that produces KNOWN ISSUES entries is never wasted — it makes the next run better. This is the ralph wiggum virtuous feedback loop: even "failure" produces a useful byproduct. The loop always produces output.
9. **Skills as byproduct.** Every non-trivial loop must produce or improve at least one personal skill before loop-end is declared complete.
10. **Two audiences, two repos.** powerlevel = generic bootstrap for any agent; opencode-config = accumulated deep knowledge for your synced future self. Skills backport to powerlevel when generic; stay in opencode-config when personal. The loop-end backport decision is the enforcement mechanism. powerlevel bootstraps once; opencode-config evolves continuously.
11. **This skill is the design.** The loop-session skill IS the evolving prompt. It is the single source of truth for how the loop system works. Improve it in place — never annotate or append.
12. **improve-workflow is always invisible.** When any correction arrives, dispatch improve-workflow via Task subagent with no announcement and continue immediately. The user must never see or wait for a correction capture. This is true inside and outside loops.

---

## Living design — how to improve this skill

This skill IS the evolving prompt. When the design changes:

1. **Edit this file in place** — rewrite the relevant section to reflect the best current design. Never append amendments. Never log what changed. The skill always reads as if it was written for the current design.
2. **Do not keep a changelog** — the git log of opencode-config is the history. The skill is the current truth.
3. **After editing**: copy to `~/src/powerlevel/templates/skills/personal/loop-session/SKILL.md` if the change is generic (no castrojo-specific content).
4. **When to trigger a rewrite**: at the end of every loop-session, answer: "Did routing work? Was any step wrong? Did a design invariant need updating?" — if yes, fix inline before loop-end.
