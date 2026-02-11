# Setting Up Powerlevel on a New Machine

## One-Command Installation

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/castrojo/powerlevel/main/bin/setup-machine.sh)
```

**That's it.** Start OpenCode and Powerlevel is ready.

---

## What It Does

The automated installer:

1. Checks prerequisites (OpenCode, GitHub CLI, git, jq)
2. Clones and configures Superpowers (dependency)
3. Clones and configures Powerlevel
4. Registers plugins automatically in `opencode.json`
5. Creates skill symlinks
6. Verifies installation

**Idempotent:** Safe to re-run anytime. Won't duplicate entries or break existing setup.

---

## Prerequisites

Before running the installer, ensure:

- **OpenCode** installed ([opencode.ai](https://opencode.ai))
- **GitHub CLI** authenticated (`gh auth login`)
- **Git** installed
- **jq** installed (`brew install jq` / `apt install jq`)

The installer will check for these and provide instructions if missing.

---

## Multi-Machine Workflow

**Key principle:** GitHub Issues API is the single source of truth.

### Cache Behavior

- **Never copy `cache/` directory** between machines
- Cache auto-regenerates from GitHub when missing/stale
- Session start: pulls latest from GitHub
- Session end: pushes changes to GitHub

### Setup on New Machine

```bash
# Run installer
bash <(curl -fsSL https://raw.githubusercontent.com/castrojo/powerlevel/main/bin/setup-machine.sh)

# Start OpenCode in any tracked project
cd ~/src/your-project
opencode
```

Cache rebuilds automatically from GitHub on first run.

### Cross-Machine Workflow

**Machine A (morning):**
```bash
cd ~/src/myproject
opencode
# Work on Epic #42 → Changes marked dirty locally
# End session → Plugin syncs to GitHub
```

**Machine B (evening):**
```bash
cd ~/src/myproject
opencode
# Plugin loads → Fetches Epic #42 updates from GitHub
# Continue work → End session → Sync to GitHub
```

GitHub always has the latest state.

---

## Troubleshooting

**Script fails: "OpenCode not found"**
```bash
# Install OpenCode first
open https://opencode.ai
```

**Script fails: "gh not authenticated"**
```bash
gh auth login
```

**Script fails: "jq not found"**
```bash
brew install jq        # macOS
sudo apt install jq    # Ubuntu/Debian
```

**Powerlevel score not showing**
```bash
# Verify installation
ls ~/.config/opencode/powerlevel/plugin.js
cat ~/.config/opencode/opencode.json | jq .plugin

# Re-run installer
bash <(curl -fsSL https://raw.githubusercontent.com/castrojo/powerlevel/main/bin/setup-machine.sh)
```

**Cache out of sync**
```bash
# Force cache rebuild
rm -rf ~/.config/opencode/powerlevel/cache/
# Restart OpenCode → Cache regenerates from GitHub
cd ~/src/your-project
opencode
```

**Uninstall**
```bash
rm -rf ~/.config/opencode/superpowers
rm -rf ~/.config/opencode/powerlevel
rm ~/.config/opencode/plugins/superpowers.js
rm ~/.config/opencode/skills/{superpowers,powerlevel}
# Edit opencode.json to remove plugin entry
```

---

## Architecture

**System components:**
- **Superpowers** (dependency) - Core workflow skills at `~/.config/opencode/superpowers/`
- **Powerlevel** (this project) - Project tracking at `~/.config/opencode/powerlevel/`

**Cache behavior:**
- Location: `~/.config/opencode/powerlevel/cache/<repo-hash>/state.json`
- Purpose: Rate-limit optimization
- Source of truth: GitHub Issues API (always)
- Auto-regenerates when missing/stale

**See:** `AGENTS.md` for detailed architecture documentation.

---

**Last Updated:** 2026-02-10
