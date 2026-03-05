---
name: new-machine-setup
description: Use when bootstrapping a new machine — OpenCode is already installed, nothing else is.
---

# New Machine Setup

**Announce:** "I'm using the new-machine-setup skill to set up this machine."

The fastest path is to run the automated setup script. Fall back to manual steps only if the script fails.

---

## Fast Path: Run setup.sh

```bash
git clone git@github.com:castrojo/powerlevel.git /tmp/powerlevel-setup
bash /tmp/powerlevel-setup/setup.sh
```

If this succeeds, skip to Step 7 (verify) and Step 8 (community skills).

---

## Manual Path (if setup.sh fails)

### Step 1: Install prerequisites

```bash
# Fedora / CentOS
sudo dnf install gh

# macOS / Homebrew
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

### Step 2: Authenticate GitHub CLI

```bash
gh auth login --git-protocol ssh
gh auth status  # verify SSH protocol
```

### Step 3: SSH key for GitHub

```bash
ssh -T git@github.com
# Expected: "Hi <user>! You've successfully authenticated..."
# NOTE: ssh -T always exits 1 even on success (GitHub has no shell).
#       Exit code 1 here is correct. If missing or wrong key, the message above won't appear.
# If missing:
ssh-keygen -t ed25519 -C "your@email.com"
gh ssh-key add ~/.ssh/id_ed25519.pub --title "$(hostname)"
```

**Scripted check pattern** (avoids pipefail false failure):
```bash
ssh_out=$(ssh -T git@github.com 2>&1) || true
grep -q "successfully authenticated" <<< "$ssh_out"
```

### Step 4: Clone opencode-config

```bash
USERNAME=$(gh api user --jq .login)
rm -rf ~/.config/opencode
git clone "git@github.com:$USERNAME/opencode-config.git" ~/.config/opencode
```

### Step 5: Install global gitignore

```bash
mkdir -p ~/.config/git
cp ~/.config/opencode/git-config/ignore ~/.config/git/ignore
git config --global core.excludesFile ~/.config/git/ignore
```

### Step 6: Install superpowers

```bash
git clone git@github.com:obra/superpowers.git ~/.config/opencode/superpowers
git -C ~/.config/opencode/superpowers remote set-url --push origin DISABLE

mkdir -p ~/.config/opencode/plugins
ln -sf ~/.config/opencode/superpowers/.opencode/plugins/superpowers.js \
       ~/.config/opencode/plugins/superpowers.js
ln -sf ~/.config/opencode/superpowers/skills \
       ~/.config/opencode/skills/superpowers
```

### Step 7: Install npm dependencies

```bash
cd ~/.config/opencode && npm install
```

---

## Step 7: Verify

```bash
gh auth status
ssh -T git@github.com
head -3 ~/.config/opencode/AGENTS.md
ls ~/.config/opencode/memory/
ls ~/.config/opencode/plugins/superpowers.js
ls ~/.config/opencode/skills/superpowers
git -C ~/.config/opencode/superpowers remote get-url --push origin
# Expected: DISABLE
```

---

## Step 8: Install community skills

Open a new OpenCode session and install via ctrl+p → "install skill":

| Skill | Source |
|---|---|
| `gh-cli` | `github/awesome-copilot` |
| `code-review` | `supercent-io/skills-template` |
| `container-debugging` | `aj-geddes/useful-ai-prompts` |
| `shellcheck-configuration` | `wshobson/agents` |
| `devops-engineer` | `jeffallan/claude-skills` |
| `github-actions-templates` | `wshobson/agents` |
| `git-commit` | `github/awesome-copilot` |
| `bash-linux` | `sickn33/antigravity-awesome-skills` |
| `fedora-linux-triage` | `github/awesome-copilot` |
| `find-skills` | `vercel-labs/skills` |
