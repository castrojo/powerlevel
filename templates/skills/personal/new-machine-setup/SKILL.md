---
name: new-machine-setup
description: Use when bootstrapping a new machine — OpenCode is already installed, nothing else is
---

# New Machine Setup

**Announce at start:** "I'm using the new-machine-setup skill to set up this machine."

**Starting assumption:** OpenCode is installed. Nothing else.

---

## Step 1: Install prerequisites

```bash
# Fedora / CentOS Stream
sudo dnf install gh

# Or via Homebrew (Linux)
brew install gh
```

Install `just`:
```bash
mkdir -p ~/.local/bin
wget -qO- "https://github.com/casey/just/releases/download/1.34.0/just-1.34.0-x86_64-unknown-linux-musl.tar.gz" \
  | tar --no-same-owner -C ~/.local/bin -xz just
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"
```

Verify:
```bash
just --version
```

---

## Step 2: Authenticate GitHub CLI

```bash
gh auth login
gh auth status
```

Ensure git operations protocol is set to SSH:
```bash
gh auth status | grep protocol
# Expected: Git operations protocol: ssh
```

If not SSH, reconfigure:
```bash
gh auth login --git-protocol ssh
```

---

## Step 3: SSH key for GitHub

**This must complete before cloning any repo.**

Verify existing key:
```bash
ssh -T git@github.com
# Expected: "Hi YOUR_USERNAME! You've successfully authenticated..."
# NOTE: ssh -T always exits 1 even on success (GitHub has no shell).
#       Exit code 1 here is correct. The message above is what matters.
```

If missing, generate and add:
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
gh ssh-key add ~/.ssh/id_ed25519.pub --title "$(hostname)"
ssh -T git@github.com
```

**Scripted check pattern** (avoids pipefail false failure):
```bash
ssh_out=$(ssh -T git@github.com 2>&1) || true
grep -q "successfully authenticated" <<< "$ssh_out"
```

---

## Step 4: Clone opencode-config

If `~/.config/opencode` already exists from OpenCode's first-run init:
```bash
rm -rf ~/.config/opencode
```

Clone:
```bash
git clone git@github.com:YOUR_USERNAME/opencode-config.git ~/.config/opencode
```

Verify remotes:
```bash
git -C ~/.config/opencode remote -v
# Expected:
# origin  git@github.com:YOUR_USERNAME/opencode-config.git (fetch)
# origin  git@github.com:YOUR_USERNAME/opencode-config.git (push)
```

Verify:
```bash
head -3 ~/.config/opencode/AGENTS.md
ls ~/.config/opencode/memory/
```

**Automatically restored by this clone:**
- `AGENTS.md` — global workflow rules
- `opencode.json` — **global** config: providers, plugins (`opencode-agent-memory`). Per-project MCPs live in each repo's own `opencode.json` — verified at `onboarding-a-repository` time, not here.
- `memory/persona.md`, `memory/human.md` — trained agent context, ready immediately
- `agent-memory.json` — journal enabled, custom tags configured
- `agents/` — installed skill files
- `skills/personal/` — personal skills (new-machine-setup, onboarding-a-repository)
- `plans/` — project reference docs
- `git-config/ignore` — global gitignore source file (installed in Step 4b)

---

## Step 4b: Install global gitignore

The clone includes `git-config/ignore` — a global gitignore that excludes `.worktrees` (and any future entries) from every repo on this machine without needing per-repo `.gitignore` commits.

```bash
mkdir -p ~/.config/git
cp ~/.config/opencode/git-config/ignore ~/.config/git/ignore
git config --global core.excludesFile ~/.config/git/ignore
```

Verify:

```bash
git config --global core.excludesFile
# Expected: /var/home/<user>/.config/git/ignore
cat ~/.config/git/ignore
# Expected: .worktrees  (and any other entries)
```

This step is idempotent — safe to re-run. If `~/.config/git/ignore` already exists, `cp` will update it with any new entries added to `opencode-config`.

> To add new global excludes in future sessions: edit `~/.config/opencode/git-config/ignore`, re-run `cp`, and commit `git-config/ignore` to `opencode-config`.

---

## Step 5: Install superpowers

Clone from the personal fork — this carries workflow improvements on top of upstream:

```bash
git clone git@github.com:YOUR_USERNAME/superpowers.git ~/.config/opencode/superpowers
cd ~/.config/opencode/superpowers
git remote add upstream git@github.com:obra/superpowers.git
git remote set-url --push upstream DISABLE
```

**CRITICAL — verify push is disabled before proceeding:**
```bash
git -C ~/.config/opencode/superpowers remote -v
# Expected:
# origin    git@github.com:YOUR_USERNAME/superpowers.git (fetch)
# origin    git@github.com:YOUR_USERNAME/superpowers.git (push)
# upstream  git@github.com:obra/superpowers.git (fetch)
# upstream  DISABLE (push)
```

If push is not `DISABLE`, stop and fix it. **Never push or propose a PR to `obra/superpowers`.**

Check personal commits are present on top of upstream:
```bash
git -C ~/.config/opencode/superpowers log --oneline upstream/main..main
# Expected: 3+ personal workflow commits (plan path, confirmation gate, etc.)
# If empty: your personal improvements are missing — check the fork
```

To sync after upstream releases a new version:
```bash
git -C ~/.config/opencode/superpowers fetch upstream
git -C ~/.config/opencode/superpowers rebase upstream/main
git -C ~/.config/opencode/superpowers push origin main --force-with-lease
```

Create plugin symlink:
```bash
mkdir -p ~/.config/opencode/plugins
ln -s ~/.config/opencode/superpowers/.opencode/plugins/superpowers.js \
      ~/.config/opencode/plugins/superpowers.js
```

Create skills symlink:
```bash
ln -s ~/.config/opencode/superpowers/skills \
      ~/.config/opencode/skills/superpowers
```

Verify:
```bash
ls -l ~/.config/opencode/plugins/superpowers.js
ls -l ~/.config/opencode/skills/superpowers
```

---

## Step 6: Install npm dependencies

```bash
cd ~/.config/opencode && npm install
```

This restores `@opencode-ai/plugin`, `jsonc-parser`, and `zod`.

---

## Step 6b: Install devaipod

```bash
# Rust must be installed first (brew install rust)
cargo install --git https://github.com/cgwalters/devaipod
~/.cargo/bin/devaipod --version --host
ln -sf ~/.config/opencode/devaipod.toml ~/.config/devaipod.toml
```

### Podman secrets (machine-local, never committed)

```bash
~/.cargo/bin/devaipod init --host
# When prompted:
# - Dotfiles/homegit: skip
# - GitHub token: `gh auth token` output
# - Other tokens: skip

# Verify secret name is gh_token:
podman secret ls

# If name differs from gh_token, recreate:
# podman secret rm <wrong-name>
# gh auth token | podman secret create gh_token -
```

---

## Step 6c: Set up workflow-state DB and MCP server

The workflow-state MCP provides persistent loop state, task tracking, and skill/rule search
across all sessions. It requires a PostgreSQL container (quadlet) and a Go binary.

### Install PostgreSQL quadlet

```bash
mkdir -p ~/.config/containers/systemd
cp ~/.config/opencode/mcp/state/opencode-state-db.container ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user enable --now opencode-state-db
```

Verify it's running:
```bash
systemctl --user is-active opencode-state-db
# Expected: active
```

### Build the MCP binary

```bash
cd ~/.config/opencode/mcp/state
go build -o opencode-state-mcp .
cd -
```

Verify:
```bash
ls ~/.config/opencode/mcp/state/opencode-state-mcp
# Expected: file present
```

### Seed the DB

Run once after the DB starts (populates rules and skill sections):

```bash
cd ~/.config/opencode/mcp/state
go run ./seed/rules
go run ./seed/skills
cd -
```

### Verify MCP is working

```bash
systemctl --user is-active opencode-state-db && echo "DB: ok"
ls ~/.config/opencode/mcp/state/opencode-state-mcp && echo "Binary: ok"
```

The `session-start` skill checks MCP health at the start of every session. If the binary or
DB is missing, it reports it. Fix it here before starting any project work.

---

## Step 7: Reinstall skills

Use the OpenCode skill installer to reinstall all skills into `~/.agents/skills/`:

| Skill | Source |
|---|---|
| `gh-cli` | `github/awesome-copilot` |
| `find-skills` | `vercel-labs/skills` |
| `code-review` | `supercent-io/skills-template` |
| `github-actions-templates` | `wshobson/agents` |
| `centos-linux-triage` | `github/awesome-copilot` |
| `fedora-linux-triage` | `github/awesome-copilot` |
| `shellcheck-configuration` | `wshobson/agents` |
| `container-debugging` | `aj-geddes/useful-ai-prompts` |
| `devops-engineer` | `jeffallan/claude-skills` |
| `git-commit` | `github/awesome-copilot` |
| `bash-linux` | `sickn33/antigravity-awesome-skills` |

Superpowers skills (`~/.config/opencode/skills/superpowers/`) are restored by the symlink in step 5 — no reinstall needed.
Personal skills (`~/.config/opencode/skills/personal/`) are restored by the opencode-config clone in step 4 — no reinstall needed.

> **Note on `gh-cli`:** The installed skill at `~/.agents/skills/gh-cli/` is the full 40KB reference manual.
> The personal override at `~/.config/opencode/skills/personal/gh-cli/` is a focused ~150-line version
> covering daily workflow operations. The personal version takes precedence (loaded first by the skills
> system). After reinstall, the personal override is unaffected — it lives in a different directory.

---

## Step 8: Verify

```bash
gh auth status                                      # GitHub CLI authenticated, SSH protocol
just --version                                      # just available
ssh -T git@github.com                               # SSH key working (exits 1 on success — normal)
head -3 ~/.config/opencode/AGENTS.md               # global rules present
ls ~/.config/opencode/memory/                       # memory blocks present
cat ~/.config/opencode/agent-memory.json            # journal config present
git config --global core.excludesFile               # global gitignore path set
cat ~/.config/git/ignore                            # .worktrees entry present
ls ~/.config/opencode/plugins/superpowers.js        # superpowers plugin symlink
ls ~/.config/opencode/skills/superpowers            # superpowers skills symlink
ls ~/.config/opencode/skills/personal/              # personal skills present
ls ~/.agents/skills/                                # installed skills present
~/.cargo/bin/devaipod --version --host             # devaipod installed
ls ~/.config/devaipod.toml                         # devaipod config symlink present
podman secret ls | grep gh_token                   # gh_token secret present
systemctl --user is-active opencode-state-db        # DB running (active)
ls ~/.config/opencode/mcp/state/opencode-state-mcp  # MCP binary present

# Verify opencode-config remote layout
git -C ~/.config/opencode remote get-url origin
# Expected: git@github.com:YOUR_USERNAME/opencode-config.git

# Verify superpowers remote layout
git -C ~/.config/opencode/superpowers remote -v
# Expected: origin → YOUR_USERNAME/superpowers, upstream → obra/superpowers (push DISABLED)

# Verify personal workflow commits are present on superpowers fork
git -C ~/.config/opencode/superpowers log --oneline upstream/main..main
# Expected: 3+ personal commits — if empty, the personal fork is missing improvements
```

All checks must pass before starting any development work, **including** the workflow-state DB and MCP binary.

---

## Architecture

| Path | How it gets there | Managed by |
|---|---|---|
| `AGENTS.md` | `git clone opencode-config` | `YOUR_USERNAME/opencode-config` |
| `opencode.json` | `git clone opencode-config` | `YOUR_USERNAME/opencode-config` |
| `memory/` | `git clone opencode-config` | `YOUR_USERNAME/opencode-config` |
| `agent-memory.json` | `git clone opencode-config` | `YOUR_USERNAME/opencode-config` |
| `agents/` | `git clone opencode-config` | `YOUR_USERNAME/opencode-config` |
| `plans/` | `git clone opencode-config` | `YOUR_USERNAME/opencode-config` |
| `skills/personal/` | `git clone opencode-config` | `YOUR_USERNAME/opencode-config` |
| `git-config/ignore` | `git clone opencode-config` | `YOUR_USERNAME/opencode-config` |
| `~/.config/git/ignore` | `cp git-config/ignore` (step 4b) | update source + re-cp |
| `superpowers/` | `git clone YOUR_USERNAME/superpowers` | `git fetch upstream && rebase` |
| `plugins/` | symlink (step 5) | recreate manually |
| `skills/superpowers` | symlink (step 5) | recreate manually |
| `journal/` | runtime state | never tracked |
| `node_modules/` | `npm install` | never tracked |
| `~/.agents/skills/` | OpenCode skill installer | reinstall from table above |
| `.worktrees/<branch>/` | created per-session per-repo | **machine-local — never tracked, never synced** |
| Per-repo `opencode.json` | In each project repo | Per-project MCPs; verified at `onboarding-a-repository` |

---

After setup, use the `onboarding-a-repository` skill for each repo.
