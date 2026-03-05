# castrojo's OpenCode Setup
__ This is designed to up your powerlevel ...__ 

A structured AI agent workflow built on [OpenCode](https://opencode.ai).

Point your agent at this repo and it sets up the full environment — persistent memory, a searchable journal, workflow discipline skills, and safe rails around git operations - no need to fork this repo, the intent is for you to get started and move on. 

- Designed to use superpowers skills and expand on them by building a knowledge base of the projects you work on without polluting the project repos themselves with AI working state. "Let's start on a new feauture" or similar language will walk you through the process.
- Tracks all your personal and system level skills and maintains them in the opencode config directory and synced in your private opencode-config repo. Hide your shame. 
- Keeps project-level context outside of the project github repo for memory and context.
- Designed to PR to upstream projects in the cleanest possible manner so your coworkers don't hate you. 

We keep project specific state seperate from workflow state! Congrats, you've turned github into a real slow and crappy database. But it works. 


---

## What's Included

| Component | What it does |
|---|---|
| [OpenCode](https://opencode.ai) | AI coding agent (required) |
| [opencode-agent-memory](https://github.com/opencode-ai/opencode-agent-memory) | Persistent memory blocks + append-only journal across sessions |
| [devaipod](https://github.com/cgwalters/devaipod) | Container-based agent isolation for build/test loops (optional but recommended) |
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

Adapt the personas to your liking: 

- https://github.com/castrojo/powerlevel/blob/main/templates/memory/human.md
- https://github.com/castrojo/powerlevel/blob/main/templates/memory/persona.md

## Tradeoffs

**Works well:**
- Straightforward, just use it and help it document your preferences and learn your projects, there's an onboarding projects skill. Ideally the more you use it the better it gets.
- Context genuinely survives across sessions — the agent doesn't re-ask things already established
- Guardrails prevent destructive git actions (force pushes, silent upstream PRs)
- Journal ROI grows over time as discoveries accumulate

**Costs:**
- Overhead on simple tasks — the machinery exists for complex work, it's noise on trivial requests - I just use normal copilot for tasks like this. This is for long term maintenance. 
- Requires maintenance — skills and AGENTS.md drift if you don't run `improve-workflow` consistently
- OpenCode-specific — not portable to other agents without significant adaptation

---

> [!TIP]
> **Multi-Model Review:** Use Gemini or another model on your plans in your GitHub private `opencode-config` repo to get second opinions. This helps catch architectural gaps or "pattern mistakes" that a single model might miss. Setup the free gemini code review or run it locally. 

---

## Review Workflow

To have a senior agent review your work or to see previous architectural guidance, tell your agent:
> "Go through Gemini's recommendations in templates/plans/."

The Senior Reviewer (Gemini CLI) documents decisions and identifies "pattern mistakes" in `templates/plans/`. Implementation agents MUST follow these plans to ensure architectural integrity.

---

## How to Get It

**Prerequisites:** [OpenCode](https://opencode.ai/install), [GitHub CLI](https://cli.github.com/) authenticated with SSH, `git`, `npm`, Rust/cargo (for devaipod - optional)

Tell your agent:

> "Set up my OpenCode workflow. Read the AGENTS.md in castrojo/powerlevel and run setup.sh."

The agent will:
1. Detect your GitHub username
2. Create a private `opencode-config` repo in your account
3. Clone [obra/superpowers](https://github.com/obra/superpowers) as read-only (push disabled — no accidental upstream PRs)
4. Wire up symlinks, install npm dependencies, configure global gitignore

Then **in a new OpenCode session**, press `ctrl+p` and install these community skills:

| Skill | What it does | Source |
|---|---|---|
| `find-skills` | **Search [skills.sh](https://skills.sh) to discover and install more skills** — install this first | `vercel-labs/skills` |
| `gh-cli` | GitHub CLI operations (PRs, issues, releases) | `github/awesome-copilot` |
| `code-review` | Thorough code review workflow | `supercent-io/skills-template` |
| `container-debugging` | Debug Docker/Podman containers | `aj-geddes/useful-ai-prompts` |
| `shellcheck-configuration` | Shell script static analysis | `wshobson/agents` |
| `devops-engineer` | CI/CD, Docker, Kubernetes, cloud | `jeffallan/claude-skills` |
| `github-actions-templates` | GitHub Actions workflow templates | `wshobson/agents` |
| `git-commit` | Conventional commit generation | `github/awesome-copilot` |
| `bash-linux` | Bash/Linux terminal patterns | `sickn33/antigravity-awesome-skills` |
| `fedora-linux-triage` | Fedora/dnf/systemd/SELinux triage | `github/awesome-copilot` |

Once `find-skills` is installed, the agent can run `npx skills find <query>` to search for more skills at any time.

Your config lives in `yourname/opencode-config`. powerlevel stays here as a reference.

---

## After Setup

Open a new OpenCode session in `~/.config/opencode/` and say "session-start". The agent orients itself, verifies the setup, and you're ready to work.

For each new project: tell your agent "onboard this repository" and it runs the `onboarding-a-repository` skill — sets up remotes, plans directory, and project memory block.

### Optional: Install devaipod

For container-isolated build/test loops (recommended for complex projects):

```bash
# Install Rust if not already present
brew install rust  # or curl https://sh.rustup.rs -sSf | sh

# Install devaipod
cargo install --git https://github.com/cgwalters/devaipod

# Link config
ln -sf ~/.config/opencode/devaipod.toml ~/.config/devaipod.toml

# Initialize podman secrets (GitHub token for private repos)
~/.cargo/bin/devaipod init --host
# When prompted: use `gh auth token` output for GitHub token

# Verify
~/.cargo/bin/devaipod --version --host
podman secret ls | grep gh_token
```

**What devaipod provides:**
- Isolated container environment for build/test loops
- Automatic injection of your OpenCode config (AGENTS.md, skills, memory)
- Podman secrets management for credentials (never committed to repos)
- Host-mode execution via `devaipod run ~/src/<repo> --host -c 'command'`

See `~/.config/opencode/skills/personal/new-machine-setup` (Step 6b) for full details.

---

## Syncing Across Machines

```bash
# On any new machine after setup
cd ~/.config/opencode && git pull

# After any session that changes config
cd ~/.config/opencode
git add . && git commit -m "chore(config): sync" && git push
```
