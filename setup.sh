#!/usr/bin/env bash
set -euo pipefail

POWERLEVEL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.config/opencode"
SUPERPOWERS_DIR="$CONFIG_DIR/superpowers"

echo "=== OpenCode Workflow Setup ==="
echo ""

# --- Detect username ---
if ! USERNAME=$(gh api user --jq .login 2>/dev/null); then
  echo "ERROR: GitHub CLI not authenticated. Run: gh auth login --git-protocol ssh"
  exit 1
fi
echo "GitHub user: $USERNAME"

# --- Check SSH ---
if ! ssh -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
  echo "ERROR: SSH key not configured for GitHub."
  echo "  ssh-keygen -t ed25519 -C your@email.com"
  echo "  gh ssh-key add ~/.ssh/id_ed25519.pub --title \"\$(hostname)\""
  exit 1
fi

# --- Check npm ---
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm not found. Install Node.js: https://nodejs.org"
  exit 1
fi

echo "Prerequisites: OK"
echo ""

# --- Backup existing config ---
if [[ -d "$CONFIG_DIR" ]]; then
  BACKUP_DIR="${CONFIG_DIR}.$(date +%Y%m%d%H%M%S).bak"
  echo "Backing up existing $CONFIG_DIR to $BACKUP_DIR"
  mv "$CONFIG_DIR" "$BACKUP_DIR"
fi

# --- Create private opencode-config repo ---
REPO="$USERNAME/opencode-config"
REPO_EXISTS=false

if gh repo view "$REPO" &>/dev/null 2>&1; then
  echo "Repo $REPO already exists — skipping creation and seed"
  REPO_EXISTS=true
else
  echo "Creating private repo: $REPO"
  gh repo create "$REPO" --private --clone=false
fi

# --- Seed repo from templates (only on fresh repo) ---
if [[ "$REPO_EXISTS" == "false" ]]; then
  STAGING=$(mktemp -d)
  trap 'rm -rf "$STAGING"' EXIT

  cp -r "$POWERLEVEL_DIR/templates/." "$STAGING/"

  # Replace YOUR_USERNAME placeholder
  find "$STAGING" -type f | while read -r f; do
    sed -i "s/YOUR_USERNAME/$USERNAME/g" "$f"
  done

  # Init and push to opencode-config
  cd "$STAGING"
  git init -b main
  git add .
  git commit -m "chore(config): initial workflow setup from castrojo/powerlevel

Assisted-by: agent via OpenCode"
  git remote add origin "git@github.com:$REPO.git"
  git push -u origin main
  cd - >/dev/null
fi

# --- Clone config to ~/.config/opencode ---
echo "Cloning $REPO → $CONFIG_DIR"
git clone "git@github.com:$REPO.git" "$CONFIG_DIR"

# --- Clone superpowers (read-only) ---
echo "Cloning obra/superpowers (read-only)"
git clone git@github.com:obra/superpowers.git "$SUPERPOWERS_DIR"
git -C "$SUPERPOWERS_DIR" remote set-url --push origin DISABLE

# Verify push is disabled
PUSH_URL=$(git -C "$SUPERPOWERS_DIR" remote get-url --push origin)
if [[ "$PUSH_URL" != "DISABLE" ]]; then
  echo "ERROR: Failed to disable superpowers push URL"
  exit 1
fi

# --- Symlinks ---
mkdir -p "$CONFIG_DIR/plugins"
ln -sf "$SUPERPOWERS_DIR/.opencode/plugins/superpowers.js" \
       "$CONFIG_DIR/plugins/superpowers.js"
ln -sf "$SUPERPOWERS_DIR/skills" \
       "$CONFIG_DIR/skills/superpowers"

# --- npm install ---
echo "Installing npm dependencies"
cd "$CONFIG_DIR" && npm install --silent
cd - >/dev/null

# --- Global gitignore ---
mkdir -p "$HOME/.config/git"
cp "$CONFIG_DIR/git-config/ignore" "$HOME/.config/git/ignore"
git config --global core.excludesFile "$HOME/.config/git/ignore"

# --- Verify ---
echo ""
echo "=== Verification ==="
ok() { echo "  [OK] $1"; }
fail() { echo "  [FAIL] $1"; FAILED=1; }
FAILED=0

[[ -f "$CONFIG_DIR/AGENTS.md" ]]                          && ok "AGENTS.md present"          || fail "AGENTS.md missing"
[[ -f "$CONFIG_DIR/opencode.json" ]]                      && ok "opencode.json present"       || fail "opencode.json missing"
[[ -d "$CONFIG_DIR/memory" ]]                             && ok "memory/ present"             || fail "memory/ missing"
[[ -L "$CONFIG_DIR/plugins/superpowers.js" ]]             && ok "superpowers plugin symlink"  || fail "superpowers plugin symlink missing"
[[ -L "$CONFIG_DIR/skills/superpowers" ]]                 && ok "superpowers skills symlink"  || fail "superpowers skills symlink missing"
[[ -d "$CONFIG_DIR/node_modules" ]]                       && ok "npm dependencies installed"  || fail "npm install failed"
[[ "$(git config --global core.excludesFile)" != "" ]]    && ok "global gitignore set"        || fail "global gitignore not set"
[[ "$(git -C "$SUPERPOWERS_DIR" remote get-url --push origin)" == "DISABLE" ]] \
                                                          && ok "superpowers push disabled"   || fail "superpowers push NOT disabled"

echo ""
if [[ "$FAILED" -eq 0 ]]; then
  echo "Setup complete."
else
  echo "Setup finished with errors. Fix the items above before continuing."
  exit 1
fi

echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Open a new OpenCode session in ~/.config/opencode/"
echo "2. Say: 'session-start'"
echo "3. Install community skills (ctrl+p → install skill):"
echo "     find-skills          from vercel-labs/skills       (search skills.sh for more — install first)"
echo "     gh-cli               from github/awesome-copilot"
echo "     code-review          from supercent-io/skills-template"
echo "     container-debugging  from aj-geddes/useful-ai-prompts"
echo "     shellcheck-config    from wshobson/agents"
echo "     devops-engineer      from jeffallan/claude-skills"
echo "     github-actions       from wshobson/agents"
echo "     git-commit           from github/awesome-copilot"
echo "     bash-linux           from sickn33/antigravity-awesome-skills"
echo "     fedora-linux-triage  from github/awesome-copilot"
echo ""
echo "   Once find-skills is installed: npx skills find <query>"
echo ""
echo "4. Your config repo: git@github.com:$REPO.git"
echo "   Sync across machines: cd ~/.config/opencode && git pull"
