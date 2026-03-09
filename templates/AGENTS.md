# Global Agent Rules

These rules apply in every repository. Project-level `AGENTS.md` files are additive — they
add project-specific context but do not override these rules.

---

## Session Hygiene

**Start of every session:**

```bash
cd ~/.config/opencode && git pull
```

Then invoke the `session-start` skill before any other work. If the user's first message is a task rather than `session-start`, still call `get_welcome_banner(repo: "<REPO>")` and output the `banner` field verbatim as the first thing in your response, then proceed with the task.

**End of every session:** invoke the `session-end` skill.

---

## MCP Servers

The `workflow-state` MCP provides loop state, task tracking, and skill/rule search. It
is always present on every machine (installed by setup.sh or new-machine-setup). Every
session uses it automatically through the `session-start` skill.

| You are about to... | Use this tool |
|---|---|
| Look up a workflow rule | `workflow-state_search_rules` |
| Look up a skill section | `workflow-state_search_skill` |
| Check loop state or last run | `workflow-state_get_session_context` |
| Check pending plan tasks | `workflow-state_get_plan_tasks` |

**Read workflow state via DB tools only. Never `cat` loop-state.md or plan files.**

```bash
# Health check (run if session-start reports MCP issues)
systemctl --user is-active opencode-state-db
ls ~/.config/opencode/mcp/state/opencode-state-mcp
```

---

## Personal Skills

| Skill | When |
|---|---|
| `session-start` | Start of every session, before any work |
| `session-end` | End of every session |
| `capture-discovery` | When you figure out how something works or find a gotcha |
| `improve-workflow` | When the user corrects you or a skill/rule is wrong |
| `onboarding-a-repository` | First time working in a new repo |
| `loop-session` | When starting any loop work session — orients context, asks what type (workflow meta vs project work), routes to workflow-improvement-loop or project-loop |
| `loop-start` | Before any N-run loop series — initialize or resume loop state via DB, orient context via get_session_context, confirm run count; also use when the user says "start a loop" |
| `loop-task` | Each individual run — executes work, records run summary via append_run_summary, updates loop state via set_loop_state |
| `loop-gate` | After all runs in a phase — process systemic improvements, commit, gate phase transition |
| `loop-end` | After final phase — backport review, state integrity checklist, reset loop state in DB so the next loop on any machine starts cleanly |
| `workflow-improvement-loop` | Use when starting a workflow improvement session — audits skills/AGENTS.md/templates, fixes gaps, backports to powerlevel |
| `project-loop` | Use when starting project work (features, bugs, refactors) — wraps brainstorm→plan→execute→ship pipeline with loop-task iterations; devaipod is the execution environment |

---

## Feature Workflow

Non-trivial work follows three stages with mandatory stops between them:

**Simple task fast path:** Single-file edits, content updates, and fixes with unambiguous scope — completable in 1–3 edits with no design decisions — skip all stages and execute directly. The three-stage workflow applies only when there are design decisions to make.

```
Stage 1: Brainstorm  →  STOP, confirm  →  Stage 2: Plan  →  STOP, confirm  →  Stage 3: Execute
```

- **Brainstorm**: load the `brainstorming` skill. Explore intent, constraints, options. No code.
- **Plan**: load the `writing-plans` skill. Write a task-by-task plan to `~/.config/opencode/plans/<repo>/`. No code.
- **Execute**: load the `executing-plans` skill. Mandatory review + confirm before touching any file.

Skipping stages or merging them is banned.

Plans live in `~/.config/opencode/plans/<repo-name>/` — never inside git repos.

---

## Justfile Convention

Every project must have a `Justfile` with at minimum:

- `just build` — full build pipeline (must work clean, no pre-installed deps assumed)
- `just serve` — start server and open browser

Key rules:
- `set shell := ["bash", "-euo", "pipefail", "-c"]` at the top
- `just serve` pattern: `xdg-open <url> & sleep 1 && <server-cmd>` — all on one line
- Never proxy raw tool commands in docs — always use `just`
- `just build` must run `npm install` / equivalent as first step

---

## Commit Convention

```
type(scope): description

Assisted-by: <Model> via <Tool>
```

Types: `feat`, `fix`, `docs`, `ci`, `chore`, `refactor`

---

## Git Rules

- Always use SSH URLs: `git@github.com:org/repo.git` — never HTTPS
- Remote naming: `origin` = your fork (push here), `upstream` = source (fetch only, never push)
- Work branches: `feat/`, `fix/`, `chore/` — never commit directly to `main`

---

## PR Protocol

- Never `gh pr create` to upstream without `--web` — user clicks Submit manually
- Squash to one clean commit before any upstream PR
- Never push to the `upstream` remote
- Wait for automated review before merging

---

## Context Discipline

- Before any investigation or non-trivial task: `journal_search(text: "<topic>", limit: 3)`
- When you make a discovery: invoke `capture-discovery` immediately, not at session end
- When corrected: invoke `improve-workflow` immediately, fix the file, commit, journal — before continuing

---

## Banned

- `gh pr create` to upstream without `--web`
- Pushing to the `upstream` remote
- HTTPS remote URLs
- Multi-commit history in upstream PRs
- Committing plans, session notes, or AGENTS.md into project repos
- Claiming work is done without running verification commands
- **Reading workflow state from files** — Never use `cat`, `head`, `tail`, `grep`, `sed`, `awk`, the `Read` tool, or any file or shell operation to read `loop-state.md`, plan files, skill sections, or workflow rules. Use DB tools exclusively: `workflow-state_get_session_context`, `workflow-state_get_plan_tasks`, `workflow-state_search_skill`, `workflow-state_search_rules`. File reads are only permitted when editing source files (AGENTS.md, SKILL.md, Justfile, code) or reading `opencode.json` for MCP/provider discovery — never for workflow state orientation or lookup.
