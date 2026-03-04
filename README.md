# castrojo's OpenCode Setup

A structured AI agent workflow built on [OpenCode](https://opencode.ai). Point your agent at this repo and it sets up the full environment — persistent memory, a searchable journal, workflow discipline skills, and safe rails around git operations.

---

## What's Included

| Component | What it does |
|---|---|
| [OpenCode](https://opencode.ai) | AI coding agent (required) |
| [opencode-agent-memory](https://github.com/opencode-ai/opencode-agent-memory) | Persistent memory blocks + append-only journal across sessions |
| [obra/superpowers](https://github.com/obra/superpowers) | Core workflow discipline skills (brainstorm → plan → execute, TDD, debugging, PR protocol) |
| Personal skills | Session hygiene, repo onboarding, discovery capture, workflow self-correction |
| `templates/` | Starting config for your private `opencode-config` repo |

---

## What You Get

- **Memory that persists** — the agent knows your preferences, your project context, and what it discovered last session
- **A searchable journal** — discoveries, gotchas, and design decisions accumulate and surface automatically
- **Workflow discipline** — structured stages for feature work (brainstorm → plan → execute) with mandatory stops between them
- **Session hygiene** — every session starts with context verification and ends with config sync
- **Git rails** — SSH-only remotes, upstream push protection, conventional commits enforced

## Tradeoffs

**Works well:**
- Context genuinely survives across sessions — the agent doesn't re-ask things already established
- Guardrails prevent destructive git actions (force pushes, silent upstream PRs)
- Journal ROI grows over time as discoveries accumulate

**Costs:**
- Overhead on simple tasks — the machinery exists for complex work, it's noise on trivial requests
- Requires maintenance — skills and AGENTS.md drift if you don't run `improve-workflow` consistently
- OpenCode-specific — not portable to other agents without significant adaptation

---

## How to Get It

**Prerequisites:** [OpenCode](https://opencode.ai/install), [GitHub CLI](https://cli.github.com/) authenticated with SSH, `git`, `npm`

Tell your agent:

> "Set up my OpenCode workflow. Read the AGENTS.md in castrojo/powerlevel and run setup.sh."

The agent will:
1. Detect your GitHub username
2. Create a private `opencode-config` repo in your account
3. Clone [obra/superpowers](https://github.com/obra/superpowers) as read-only (push disabled — no accidental upstream PRs)
4. Wire up symlinks, install npm dependencies, configure global gitignore
5. Open a new session and walk you through filling in your preferences

Your config lives in `yourname/opencode-config`. powerlevel stays here as a reference.

---

## After Setup

Open a new OpenCode session in `~/.config/opencode/` and say "session-start". The agent orients itself, verifies the setup, and you're ready to work.

For each new project: tell your agent "onboard this repository" and it runs the `onboarding-a-repository` skill — sets up remotes, plans directory, and project memory block.

---

## Syncing Across Machines

```bash
# On any new machine after setup
cd ~/.config/opencode && git pull

# After any session that changes config
cd ~/.config/opencode
git add . && git commit -m "chore(config): sync" && git push
```
