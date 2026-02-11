#!/usr/bin/env bash
# One-command Powerlevel + Superpowers installer
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/castrojo/powerlevel/main/bin/setup-machine.sh)
set -euo pipefail

echo "🚀 Starting Powerlevel + Superpowers installation..."
echo ""

# Prerequisites check (fail fast)
echo "📋 Checking prerequisites..."
command -v opencode >/dev/null || { echo "❌ OpenCode not installed"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "❌ GitHub CLI not authenticated. Run: gh auth login"; exit 1; }
command -v git >/dev/null || { echo "❌ Git not installed"; exit 1; }
command -v jq >/dev/null || { echo "❌ jq not installed. Install with: brew install jq (macOS) or apt install jq (Linux)"; exit 1; }
echo "✅ All prerequisites satisfied"
echo ""

# Install Superpowers
SUPERPOWERS_DIR="$HOME/.config/opencode/superpowers"
echo "🔧 Installing Superpowers..."
if [ -d "$SUPERPOWERS_DIR" ]; then
  echo "⚠️  Superpowers already exists at $SUPERPOWERS_DIR - skipping clone"
  cd "$SUPERPOWERS_DIR" && git pull origin main --quiet || echo "⚠️  Could not update Superpowers (continuing)"
else
  git clone https://github.com/obra/superpowers.git "$SUPERPOWERS_DIR" --quiet
  echo "✅ Cloned Superpowers"
fi

# Create OpenCode directories if needed
mkdir -p "$HOME/.config/opencode/plugins"
mkdir -p "$HOME/.config/opencode/skills"

# Symlink Superpowers plugin
SUPERPOWERS_PLUGIN_SRC="$SUPERPOWERS_DIR/.opencode/plugins/superpowers.js"
SUPERPOWERS_PLUGIN_DEST="$HOME/.config/opencode/plugins/superpowers.js"
if [ -L "$SUPERPOWERS_PLUGIN_DEST" ] || [ -f "$SUPERPOWERS_PLUGIN_DEST" ]; then
  rm -f "$SUPERPOWERS_PLUGIN_DEST"
fi
ln -s "$SUPERPOWERS_PLUGIN_SRC" "$SUPERPOWERS_PLUGIN_DEST"
echo "✅ Symlinked Superpowers plugin"

# Symlink Superpowers skills
SUPERPOWERS_SKILLS_SRC="$SUPERPOWERS_DIR/skills"
SUPERPOWERS_SKILLS_DEST="$HOME/.config/opencode/skills/superpowers"
if [ -L "$SUPERPOWERS_SKILLS_DEST" ] || [ -d "$SUPERPOWERS_SKILLS_DEST" ]; then
  rm -rf "$SUPERPOWERS_SKILLS_DEST"
fi
ln -s "$SUPERPOWERS_SKILLS_SRC" "$SUPERPOWERS_SKILLS_DEST"
echo "✅ Symlinked Superpowers skills"
echo ""

# Install Powerlevel
POWERLEVEL_DIR="$HOME/.config/opencode/powerlevel"
echo "🔧 Installing Powerlevel..."
if [ -d "$POWERLEVEL_DIR" ]; then
  echo "⚠️  Powerlevel already exists at $POWERLEVEL_DIR - skipping clone"
  cd "$POWERLEVEL_DIR" && git pull origin main --quiet || echo "⚠️  Could not update Powerlevel (continuing)"
else
  git clone https://github.com/castrojo/powerlevel.git "$POWERLEVEL_DIR" --quiet
  echo "✅ Cloned Powerlevel"
fi

# Symlink Powerlevel skills
POWERLEVEL_SKILLS_SRC="$POWERLEVEL_DIR/skills"
POWERLEVEL_SKILLS_DEST="$HOME/.config/opencode/skills/powerlevel"
if [ -L "$POWERLEVEL_SKILLS_DEST" ] || [ -d "$POWERLEVEL_SKILLS_DEST" ]; then
  rm -rf "$POWERLEVEL_SKILLS_DEST"
fi
ln -s "$POWERLEVEL_SKILLS_SRC" "$POWERLEVEL_SKILLS_DEST"
echo "✅ Symlinked Powerlevel skills"
echo ""

# Configure opencode.json
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json"
echo "⚙️  Configuring opencode.json..."

# Create config file with empty plugin array if it doesn't exist
if [ ! -f "$OPENCODE_CONFIG" ]; then
  echo '{"plugin":[]}' > "$OPENCODE_CONFIG"
  echo "✅ Created opencode.json"
fi

# Add Powerlevel plugin to config using jq
POWERLEVEL_PLUGIN="$HOME/.config/opencode/powerlevel/plugin.js"
TMP_CONFIG=$(mktemp)

jq --arg plugin "$POWERLEVEL_PLUGIN" '
  # Ensure plugin key exists as array
  if .plugin == null then .plugin = [] 
  elif (.plugin | type) != "array" then .plugin = [.plugin] 
  else . end |
  # Add plugin if not already present
  if (.plugin | index($plugin)) == null then
    .plugin += [$plugin]
  else . end
' "$OPENCODE_CONFIG" > "$TMP_CONFIG"

mv "$TMP_CONFIG" "$OPENCODE_CONFIG"
echo "✅ Added Powerlevel plugin to opencode.json"

# Add Superpowers plugin to config using jq
SUPERPOWERS_PLUGIN="$HOME/.config/opencode/plugins/superpowers.js"
TMP_CONFIG=$(mktemp)

jq --arg plugin "$SUPERPOWERS_PLUGIN" '
  # Ensure plugin key exists as array
  if .plugin == null then .plugin = [] 
  elif (.plugin | type) != "array" then .plugin = [.plugin] 
  else . end |
  # Add plugin if not already present
  if (.plugin | index($plugin)) == null then
    .plugin += [$plugin]
  else . end
' "$OPENCODE_CONFIG" > "$TMP_CONFIG"

mv "$TMP_CONFIG" "$OPENCODE_CONFIG"
echo "✅ Added Superpowers plugin to opencode.json"
echo ""

# Success message
echo "🎉 Installation complete!"
echo ""
echo "Installed components:"
echo "  • Superpowers: $SUPERPOWERS_DIR"
echo "  • Powerlevel: $POWERLEVEL_DIR"
echo "  • Plugins registered in opencode.json:"
echo "    - Powerlevel plugin"
echo "    - Superpowers plugin"
echo "  • Skills symlinks: ~/.config/opencode/skills/"
echo ""
echo "Next steps:"
echo "  1. Restart OpenCode to load plugins"
echo "  2. Navigate to a git repository"
echo "  3. Start coding with Superpowers + Powerlevel!"
