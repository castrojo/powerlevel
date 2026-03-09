# Global Agent Rules

These rules apply in every repository. Project-level `AGENTS.md` files are additive — they
add project-specific context but do not override these rules.

---

## Session Hygiene

**Start of every session:**

```bash
cd ~/.config/opencode && git pull
```

Then invoke the `session-start` skill before any other work.

**End of every session:** invoke the `session-end` skill.

---

## Personal Skills

| Skill | When |
|---|---|
| `session-start` | Start of every session, before any work |
| `session-end` | End of every session |
| `capture-discovery` | When you figure out how something works or find a gotcha |
| `improve-workflow` | When the user corrects you or a skill/rule is wrong |
| `onboarding-a-repository` | First time working in a new repo |
| `loop-start` | Before any N-run loop series — initialize or resume loop-state.md, orient context, confirm run count; also use when the user says "start a loop" |
| `loop-task` | Each individual run — executes work, appends run summary to plan file, updates loop-state.md |
| `loop-gate` | After all runs in a phase — process systemic improvements, commit, gate phase transition |
| `loop-end` | After final phase — backport review, state integrity checklist, reset loop-state.md |
| `workflow-improvement-loop` | Use when starting a workflow improvement session — audits skills/AGENTS.md/templates, fixes gaps, backports to powerlevel |
| `project-loop` | Use when starting project work (features, bugs, refactors) — wraps brainstorm→plan→execute→ship pipeline with loop-task iterations; devaipod is the execution environment |

---

## Feature Workflow

Non-trivial work follows three stages with mandatory stops between them:

```
Stage 1: Brainstorm  →  STOP, confirm  →  Stage 2: Plan  →  STOP, confirm  →  Stage 3: Execute
```

- **Brainstorm**: load the `brainstorming` skill. Explore intent, constraints, options. No code.
- **Plan**: load the `writing-plans` skill. Write a task-by-task plan to `~/.config/opencode/plans/<repo>/`. No code.
- **Execute**: load the `executing-plans` skill. Mandatory review + confirm before touching any file.

Skipping stages or merging them is banned.

Plans live in `~/.config/opencode/plans/<repo-name>/` — never inside git repos.

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
