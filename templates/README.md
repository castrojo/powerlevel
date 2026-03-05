# opencode-config

Personal [OpenCode](https://opencode.ai) workflow configuration, plans, and project reference docs.

This repo is the single source of truth for the AI agent setup across all machines.
Clone it first on any new machine before doing any development work.

---

## New Machine Setup

### 1. Prerequisites

Install the following before cloning this repo:

**OpenCode** (AI coding agent):
```bash
curl -fsSL https://opencode.ai/install | bash
```

**GitHub CLI** (`gh`) — needed for PR workflow:
```bash
# Fedora/CentOS
sudo dnf install gh

# Or via Homebrew (Linux)
brew install gh

# Authenticate after install
gh auth login
```

**just** (command runner — required for bluefin-lts and other projects):
```bash
mkdir -p ~/.local/bin
wget -qO- "https://github.com/casey/just/releases/download/1.34.0/just-1.34.0-x86_64-unknown-linux-musl.tar.gz" \
  | tar --no-same-owner -C ~/.local/bin -xz just
export PATH="$HOME/.local/bin:$PATH"  # add to ~/.bashrc or ~/.zshrc
```

**SSH key configured for GitHub**:
```bash
# Verify
ssh -T git@github.com
# Expected: "Hi castrojo! You've successfully authenticated..."
```

---

### 2. Clone this repo

```bash
git clone git@github.com:castrojo/opencode-config.git ~/.config/opencode
```

### 3. Install superpowers

Clone directly from upstream — no fork, no branch management:

```bash
git clone https://github.com/obra/superpowers.git ~/.config/opencode/superpowers
```

Create the required symlinks:

```bash
mkdir -p ~/.config/opencode/plugins ~/.config/opencode/skills
ln -s ~/.config/opencode/superpowers/.opencode/plugins/superpowers.js \
      ~/.config/opencode/plugins/superpowers.js
ln -s ~/.config/opencode/superpowers/skills \
      ~/.config/opencode/skills/superpowers
```

To update superpowers on any machine: `cd ~/.config/opencode/superpowers && git pull`

### 4. Install npm dependencies and skills

```bash
cd ~/.config/opencode && npm install
```

Use OpenCode's skill installer to reinstall installed skills (`~/.agents/skills/`).

Personal skills (`skills/personal/`) are already present from the clone in step 2.

**For the complete checklist with exact commands, use the `new-machine-setup` skill** in an OpenCode session.

### 5. Verify

```bash
ls ~/.config/opencode/plans/
head -5 ~/.config/opencode/AGENTS.md
ls ~/.config/opencode/skills/personal/
```

---

## What is Synced

| File | Purpose |
|---|---|
| `AGENTS.md` | Global workflow rules — always in context for every session |
| `opencode.json` | OpenCode config — MCP servers, providers |
| `memory/persona.md` | Agent persona — trained context, loaded at startup |
| `memory/human.md` | Human preferences — trained context, loaded at startup |
| `agent-memory.json` | Journal config (tags, enabled flag) |
| `agents/` | Installed skill files and skill-lock |
| `skills/personal/` | Personal skills (new-machine-setup, onboarding-a-repository) |
| `plans/` | Per-project reference docs and implementation plans |
| `plans/git-workflow.md` | Portable git/fork workflow reference |

---

## What is NOT Synced

| File | Reason |
|---|---|
| `superpowers/` | Plain upstream clone — `git pull` to update, never modify |
| `skills/superpowers` | Symlink to superpowers clone — recreate from step 3 above |
| `plugins/` | Symlinks — recreate from step 3 above |
| `journal/` | Runtime state — session entries and embeddings |
| `node_modules/` | `npm install` recreates this |
| `settings.json` | OpenCode runtime state |

---

## Keeping in Sync

After any session that modifies config files:

```bash
cd ~/.config/opencode
git add AGENTS.md opencode.json memory/ agent-memory.json plans/ skills/personal/ agents/
git commit -m "chore(config): sync session changes"
git push
```

On a new machine, pull before starting work:

```bash
cd ~/.config/opencode && git pull
```

---

## Per-Project Setup

### bluefin-lts

```bash
# Clone upstream
git clone git@github.com:ublue-os/bluefin-lts.git ~/src/bluefin-lts
cd ~/src/bluefin-lts

# Normalize remote layout (legacy exception — cloned before fork existed)
git remote rename castrojo origin 2>/dev/null || true
git remote remove upstream 2>/dev/null || true
git remote rename origin upstream 2>/dev/null || true
git remote add origin git@github.com:castrojo/bluefin-lts.git

# Verify
git remote -v
# origin    git@github.com:castrojo/bluefin-lts.git (fetch/push)
# upstream  git@github.com:ublue-os/bluefin-lts.git (fetch/push)

# Set tracking branches
git fetch upstream
git branch --set-upstream-to=upstream/main main
git branch --set-upstream-to=upstream/lts lts

# Validate build tooling works
just --list
just check
```

Reference docs: `plans/bluefin-lts/`

### Any other repo (standard flow)

```bash
git clone git@github.com:castrojo/<repo>.git ~/src/<repo>
cd ~/src/<repo>
git remote add upstream git@github.com:<upstream-org>/<repo>.git
git fetch upstream
git branch --set-upstream-to=upstream/main main
```

Then **use the `onboarding-a-repository` skill** in an OpenCode session. It handles remote verification, plans directory, fork AGENTS.md creation, project memory block, and validation baseline.

Full workflow reference: `plans/git-workflow.md`
