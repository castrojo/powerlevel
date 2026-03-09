# castrojo's OpenCode Setup

A structured [OpenCode](https://opencode.ai) workflow for developers who work across multiple repositories and sessions. Point your agent at this repo and it bootstraps persistent memory, a searchable journal, workflow discipline skills, a PostgreSQL-backed state database, and container-isolated build loops — all tracked in a private git repo you own.

This repo is a bootstrapper. You clone it once, run `setup.sh`, then move on. Your config lives in `yourname/opencode-config`.

---

## What's Included

| Component | What it does |
|---|---|
| [OpenCode](https://opencode.ai) | AI coding agent (required) |
| [opencode-agent-memory](https://github.com/opencode-ai/opencode-agent-memory) | Persistent memory blocks + append-only journal across sessions |
| workflow-state MCP (Go + PostgreSQL) | Loop state, task tracking, skill/rule search — all sessions, all projects, queryable via MCP tools |
| [devaipod](https://github.com/cgwalters/devaipod) | Container-isolated build/test loops; credentials via podman secrets |
| [obra/superpowers](https://github.com/obra/superpowers) | Workflow discipline skills (brainstorm → plan → execute, TDD, debugging, PR protocol) |
| Personal skills | Session hygiene, repo onboarding, discovery capture, loop system, workflow self-correction |
| `templates/` | Seeds your private `opencode-config` repo with AGENTS.md, opencode.json (MCP config pre-wired), memory stubs, devaipod config |

---

## What You Get

- **Persistent memory** — the agent knows your preferences, project context, and what it discovered last session; memory blocks survive across machines via git sync and a postgres database run as part of the local dev stack. 
  - **Searchable journal** — discoveries, gotchas, and design decisions accumulate automatically and surface via semantic search before related tasks
  - **Token efficiency**: Querying the DB via MCP tools returns only the relevant rows/fields needed for the current task, rather than loading entire plan files or journal logs into context. Targeted SQL/MCP queries = fewer tokens consumed per session.
  -  Without the DB, the agent would need entire files injected into context to find relevant state. The MCP query returns only what's needed.
- **Workflow discipline** — structured stages for feature work (brainstorm → plan → execute) with mandatory stops between them; plans live outside repos, never committed
- **Loop system** — N-run iteration loops with plan import, per-task state, and run summaries stored in PostgreSQL; resumable across machines
- **Container isolation** — every build/test loop runs in a fresh devaipod container; OpenCode config injected via bind_home; credentials via podman secrets, never committed
- **Automatic devcontainer setup** — project onboarding includes a fitness assessment (standard vs privileged container) and commits `.devcontainer/devcontainer.json` to your fork
- **Session hygiene** — `session-start` verifies MCP health, memory block, and active plans; `session-end` commits config and syncs across machines
- **Git rails** — SSH-only remotes, upstream push protection, conventional commits, fork discipline enforced by skills

Adapt the default personas to your preferences:
- [`templates/memory/human.md`](templates/memory/human.md)
- [`templates/memory/persona.md`](templates/memory/persona.md)

---

## Architecture

```
~/.config/opencode/                  ← git-tracked in yourname/opencode-config
  AGENTS.md                          ← global workflow rules (injected every session)
  opencode.json                      ← plugins + workflow-state MCP config
  memory/persona.md                  ← agent behavioral style
  memory/human.md                    ← your preferences and conventions
  agent-memory.json                  ← journal config (tags, retention)
  skills/personal/                   ← your personal skills
  skills/superpowers/                ← symlink → superpowers/ (read-only)
  superpowers/                       ← obra/superpowers clone (push DISABLED)
  plugins/superpowers.js             ← symlink → superpowers plugin
  mcp/state/
    opencode-state-mcp               ← Go MCP binary (built by setup.sh)
    opencode-state-db.container      ← systemd quadlet for PostgreSQL
    seed/                            ← DB seed scripts (rules, skills)
  devaipod.toml                      ← devaipod config (bind_home paths)
  plans/                             ← project notes and plans (not in any repo)

~/.local/share/opencode-state-db/    ← PostgreSQL data (machine-local, never synced)
~/.config/containers/systemd/        ← opencode-state-db.container (quadlet)
```

The MCP server runs as a local process in each OpenCode session. The PostgreSQL database runs as a systemd user service (quadlet). Neither is required to be synced — only the binary and quadlet file are tracked in `opencode-config`.

---

## Prerequisites

**Required:**
- [OpenCode](https://opencode.ai/install)
- [GitHub CLI](https://cli.github.com/) authenticated with SSH (`gh auth login --git-protocol ssh`)
- `git`
- `npm` — for the opencode-agent-memory plugin
- `go` — for building the workflow-state MCP binary
- `podman` — for the PostgreSQL quadlet (workflow-state DB)

**Optional:**
- `cargo` / Rust — for devaipod; setup.sh installs it if cargo is present, skips with a notice if not

---

## How to Get It

Tell your agent:

> "Set up my OpenCode workflow. Read the AGENTS.md in castrojo/powerlevel and run setup.sh."

What the script does:
1. Verifies GitHub CLI auth, SSH key, npm, podman, and go
2. Creates a private `opencode-config` repo in your GitHub account, seeded from `templates/`
3. Clones `obra/superpowers` as read-only (push URL set to `DISABLE` — no accidental upstream PRs)
4. Builds the workflow-state MCP binary (`go build`)
5. Installs the PostgreSQL quadlet (`opencode-state-db.container`), starts the DB, seeds rules and skill sections
6. Installs devaipod if cargo is available; wires devaipod config symlink
7. Wires plugin and skills symlinks, installs npm dependencies, configures global gitignore

If the script fails, read the error — it reports exactly which prerequisite or step failed.

---

## After Setup

**1. Open a new OpenCode session** in `~/.config/opencode/` and say `session-start`. The agent orients itself, verifies MCP health, and surfaces any active plans.

**2. Install community skills** — in a new OpenCode session, press `ctrl+p` and install:

| Skill | What it does | Source |
|---|---|---|
| `find-skills` | Search [skills.sh](https://skills.sh) for more skills — install first | `vercel-labs/skills` |
| `gh-cli` | GitHub CLI operations (PRs, issues, releases) | `github/awesome-copilot` |
| `code-review` | Thorough code review workflow | `supercent-io/skills-template` |
| `container-debugging` | Debug Docker/Podman containers | `aj-geddes/useful-ai-prompts` |
| `shellcheck-configuration` | Shell script static analysis | `wshobson/agents` |
| `devops-engineer` | CI/CD, Docker, Kubernetes, cloud | `jeffallan/claude-skills` |
| `github-actions-templates` | GitHub Actions workflow templates | `wshobson/agents` |
| `git-commit` | Conventional commit generation | `github/awesome-copilot` |
| `bash-linux` | Bash/Linux terminal patterns | `sickn33/antigravity-awesome-skills` |
| `fedora-linux-triage` | Fedora/dnf/systemd/SELinux triage | `github/awesome-copilot` |

Once `find-skills` is installed: `npx skills find <query>` searches for more.

**3. For each new project:** tell your agent "onboard this repository". It runs the `onboarding-a-repository` skill — verifies remote layout, sets up plans directory, runs a devaipod fitness assessment, creates `.devcontainer/devcontainer.json`, bootstraps loop state in the DB, and writes an initial journal entry.

**4. Initialize devaipod secrets** (one-time per machine, if devaipod was installed):
```bash
~/.cargo/bin/devaipod init --host
# When prompted for GitHub token: gh auth token
```

---

## Syncing Across Machines

```bash
# On any new machine after setup.sh
cd ~/.config/opencode && git pull

# After any session that changes config
cd ~/.config/opencode
git add . && git commit -m "chore(config): sync" && git push
```

The workflow-state DB (`~/.local/share/opencode-state-db/`) is machine-local and rebuilds from the seed scripts on each machine. Per-task status and run summaries stored in PostgreSQL are also machine-local — the plan markdown files in `~/.config/opencode/plans/` are what get synced via git and serve as the durable record across machines.

---

## Tradeoffs

**Works well:**
- Context genuinely survives across sessions — preferences, project state, and past discoveries are available from the first message
- Loop system tracks N-run iteration series with task state in PostgreSQL; run summaries accumulate in the plan file and are resumable across machines
- Container isolation via devaipod prevents environment drift — each build/test loop gets a clean container with injected config
- Journal ROI grows over time as discoveries accumulate and surface automatically before related tasks

**Costs / Reality check:**
- More moving parts than a simple config file: PostgreSQL quadlet + Go binary + podman + devaipod; `setup.sh` handles installation but more components means more that can break
- Overhead on simple tasks — this machinery exists for complex, long-running work across multiple sessions; it adds friction to one-off scripts
- OpenCode-specific — the skills, memory blocks, and MCP tools are not portable to other AI agents without significant rework
- Requires active maintenance — skills and AGENTS.md drift if you don't invoke `improve-workflow` when the agent gets something wrong

---

> [!TIP]
> **Multi-Model Review:** Use Gemini or another model to review architectural plans in your private `opencode-config` repo. A second model catches pattern mistakes that a single model misses. The free Gemini Code Assist GitHub app auto-reviews PRs on your repos with no setup required.
