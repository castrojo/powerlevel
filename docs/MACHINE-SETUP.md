# Setting Up Powerlevel on a New Machine

**Quick Start:** If you just want the commands, see [TL;DR Setup](#tldr-setup) below.

## Overview

Powerlevel is designed with **GitHub as the single source of truth**. When you set up on a new machine, the local cache automatically rebuilds from GitHub Issues API - you never need to copy cache files between machines.

**Key Architecture Principles:**

1. **GitHub Issues = Authoritative State** - All epics, sub-issues, labels, and status live in GitHub
2. **Local Cache = Optimization Layer** - Temporary storage for rate-limiting and batch operations
3. **Cache Auto-Regenerates** - Missing or stale cache rebuilds from GitHub on session start
4. **Never Copy Cache** - Cache is machine-specific and repo-specific

**What This Guide Covers:**

- Prerequisites and environment setup
- Step-by-step installation instructions
- Understanding cache behavior and sync mechanisms
- Cross-machine workflow best practices
- Verification checklist
- Troubleshooting common issues

---

## Prerequisites

Before installing Powerlevel on your new machine, ensure:

- [ ] **OpenCode is installed** - Version 0.5.0 or higher
- [ ] **GitHub CLI authenticated** - Run `gh auth status` to verify
- [ ] **Git access configured** - SSH keys or HTTPS credentials set up
- [ ] **Node.js installed** (optional) - Only needed for running scripts like `bin/auto-onboard.js`

**Pre-flight Check Commands:**

```bash
# Verify OpenCode installed
opencode --version

# Verify GitHub CLI authenticated
gh auth status

# Verify git configured
git config --global user.name
git config --global user.email
```

Expected output: All commands succeed without errors.

---

## TL;DR Setup

**Copy-paste command sequence for experienced users:**

```bash
# 1. Clone Powerlevel repository
cd ~/.config/opencode
git clone https://github.com/castrojo/powerlevel.git

# 2. Verify skills directory exists
mkdir -p ~/.config/opencode/skills

# 3. Symlink skills
ln -s ~/.config/opencode/powerlevel/skills ~/.config/opencode/skills/powerlevel

# 4. Verify GitHub CLI authenticated
gh auth status

# 5. Add plugin to opencode.json (requires manual edit - see below)
# Edit ~/.config/opencode/opencode.json and add:
#   "plugin": ["~/.config/opencode/powerlevel/plugin.js"]
```

**Manual Step Required:** Edit `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "~/.config/opencode/powerlevel/plugin.js"
  ]
}
```

**Verification:** Start OpenCode in any directory - you should see the Powerlevel score display.

---

## Detailed Installation Steps

### Step 1: Clone the Repository

Navigate to your OpenCode configuration directory and clone Powerlevel:

```bash
cd ~/.config/opencode
git clone https://github.com/castrojo/powerlevel.git
```

**What this does:** Downloads the Powerlevel plugin, skills, and configuration to your machine.

**Expected output:**
```
Cloning into 'powerlevel'...
remote: Enumerating objects: 450, done.
remote: Counting objects: 100% (450/450), done.
...
```

**Verification:** `ls ~/.config/opencode/powerlevel/plugin.js` should show the plugin file.

---

### Step 2: Create Skills Directory

Ensure the OpenCode skills directory exists:

```bash
mkdir -p ~/.config/opencode/skills
```

**What this does:** Creates the directory where OpenCode looks for skill definitions.

**Note:** If the directory already exists, this command is safe (no-op).

---

### Step 3: Symlink Skills

Create a symbolic link so OpenCode can discover Powerlevel skills:

```bash
ln -s ~/.config/opencode/powerlevel/skills ~/.config/opencode/skills/powerlevel
```

**What this does:** Links `powerlevel/skills/` to `skills/powerlevel/` so OpenCode finds the skill definitions.

**Verification:**
```bash
ls -la ~/.config/opencode/skills/powerlevel
```

Expected output: Shows symlink pointing to `../powerlevel/skills`

**Troubleshooting:** If you see "File exists", the symlink is already created.

---

### Step 4: Configure Plugin

Edit your OpenCode configuration file to load the Powerlevel plugin:

```bash
# Open in your preferred editor
nano ~/.config/opencode/opencode.json
# or
code ~/.config/opencode/opencode.json
```

**Add the plugin entry:**

```json
{
  "plugin": [
    "~/.config/opencode/powerlevel/plugin.js"
  ]
}
```

**If you have other plugins:**

```json
{
  "plugin": [
    "~/.config/opencode/some-other-plugin.js",
    "~/.config/opencode/powerlevel/plugin.js"
  ]
}
```

**What this does:** Tells OpenCode to load Powerlevel on startup.

**Verification:** Check JSON syntax is valid:
```bash
cat ~/.config/opencode/opencode.json | jq
```

Expected: Pretty-printed JSON (validates syntax)

---

### Step 5: Verify GitHub CLI Authentication

Ensure GitHub CLI is authenticated and has repository access:

```bash
gh auth status
```

**Expected output:**
```
github.com
  ✓ Logged in to github.com as YOUR_USERNAME (oauth_token)
  ✓ Git operations for github.com configured to use ssh protocol.
```

**If not authenticated:**
```bash
gh auth login
```

Follow the interactive prompts to authenticate.

---

### Step 6: First Run - Cache Auto-Generation

Start OpenCode in any directory (or a tracked project):

```bash
cd ~/src/your-project
opencode
```

**What happens on first run:**

1. **Plugin loads** → Detects repository from `git remote`
2. **Cache check** → Sees no local cache exists
3. **GitHub sync** → Fetches all issues, epics, labels from GitHub
4. **Cache rebuild** → Creates fresh local cache in `cache/<repo-hash>/state.json`
5. **Ready to work** → Displays Powerlevel score

**Expected output:**
```
Powerlevel 🔶 3 - Managing three active projects
```

**Verification:**
```bash
ls ~/.config/opencode/powerlevel/cache/
```

Expected: Directory(ies) with hash names (one per tracked repo)

---

## 🚨 CRITICAL: Cache Management

### Never Copy Cache Between Machines

**The `cache/` directory should NEVER be copied between machines.**

**Why:**
- Cache is **ephemeral** - temporary state with dirty flags and timestamps
- Cache is **repo-specific** - hash-based directories tied to specific repositories
- Cache is **machine-local** - different machines may work on different projects
- Cache **auto-regenerates** - plugin rebuilds from GitHub when cache is missing

### What Gets Synced vs. What Doesn't

| Category | Item | Cross-Machine Sync | Storage Location |
|----------|------|-------------------|------------------|
| ✅ **Synced** | Epics & sub-issues | Via GitHub Issues API | GitHub cloud |
| ✅ **Synced** | Project configs | Via git | `projects/*/config.json` |
| ✅ **Synced** | Labels & status | Via GitHub Labels API | GitHub cloud |
| ✅ **Synced** | Project board state | Via GitHub Projects API | GitHub cloud |
| ✅ **Synced** | Best practices docs | Via git | `docs/best-practices/*.md` |
| ✅ **Synced** | Journey events | Via GitHub Comments | GitHub cloud |
| ❌ **Local-only** | Cache directory | No sync (regenerates) | `cache/<hash>/state.json` |
| ❌ **Local-only** | Dirty flags | No sync (ephemeral) | Cache metadata |
| ❌ **Local-only** | Cache timestamps | No sync (machine-specific) | Cache metadata |

### Architecture Flow

```
GitHub Issues (Single Source of Truth)
        ↓
   Plugin reads on session start
        ↓
   Local cache (temporary optimization)
        ↓
   Work happens locally (changes marked dirty)
        ↓
   Plugin writes back on session end
        ↓
GitHub Issues (updated, ready for next machine)
```

### Configuration Files to Copy

**✅ DO copy these (git-tracked files):**

```bash
# Project tracking configurations
projects/*/config.json

# Plugin settings in tracked repositories
path/to/your-repo/.opencode/config.json

# Best practice documents
docs/best-practices/*.md
```

**❌ DO NOT copy these:**

```bash
# Cache directory (auto-regenerates)
cache/

# Node modules (reinstall via npm)
node_modules/

# Worktrees (create fresh)
.worktrees/
```

---

## First Run Behavior

When you start OpenCode on a new machine for the first time, here's what happens:

### Initialization Sequence

1. **Repository Detection**
   - Plugin examines `git remote` in current directory
   - Extracts `owner/repo` from origin URL
   - Generates repo hash for cache directory naming

2. **Cache Detection**
   - Checks for existing cache at `cache/<repo-hash>/state.json`
   - If missing → Proceed to GitHub sync
   - If exists → Load cache and check staleness

3. **GitHub Synchronization**
   - Fetches all issues with `type/epic` label via `gh` CLI
   - Fetches sub-issues and tracked items
   - Loads project board metadata
   - Pulls external tracking epic data (for `project/*` labeled epics)

4. **Cache Rebuild**
   - Writes fetched GitHub state to local cache
   - Sets all dirty flags to `false` (clean state)
   - Records sync timestamp

5. **Session Start**
   - Displays Powerlevel score: `Powerlevel 🔶 N - Managing X active projects`
   - Shows current epic if working in project with plans
   - Ready for work

### Verification Commands

**After first run, verify setup worked:**

```bash
# 1. Verify plugin loaded
ls ~/.config/opencode/powerlevel/plugin.js
# Expected: File exists

# 2. Verify skills symlink
ls -la ~/.config/opencode/skills/powerlevel
# Expected: Symlink → ../powerlevel/skills

# 3. Verify GitHub CLI authenticated
gh auth status
# Expected: ✓ Logged in

# 4. Verify cache created
ls ~/.config/opencode/powerlevel/cache/
# Expected: Directory with hash name(s)

# 5. Verify cache contents
cat ~/.config/opencode/powerlevel/cache/*/state.json | jq '.epics | length'
# Expected: Number of epics (0 or more)

# 6. Verify epics match GitHub
gh issue list --repo castrojo/powerlevel --label type/epic
# Expected: List matches cache count
```

---

## Cross-Machine Workflow

### Best Practices for Multiple Machines

**Powerlevel is designed for seamless multi-machine workflows:**

1. **End sessions cleanly on Machine A**
   - Session ends → `landThePlane()` function triggers
   - All dirty epics synced to GitHub in batch
   - Dirty flags cleared
   - GitHub now has latest state

2. **Start session on Machine B**
   - Plugin loads → Detects repo → Checks cache
   - Fetches latest state from GitHub
   - Cache updated to match GitHub
   - Ready to work with current state

3. **Never work on same epic simultaneously**
   - No concurrent edit detection yet
   - Work on different epics across machines
   - Or coordinate to work on one machine at a time

4. **Force cache rebuild if needed**
   - If state seems stale or out of sync
   - Delete cache: `rm -rf ~/.config/opencode/powerlevel/cache/`
   - Restart OpenCode → Cache rebuilds from GitHub

### Sync Mechanisms

**Session End Sync (`landThePlane()` function):**
- Triggered by `session.idle` event
- Batches all dirty epics
- Updates GitHub via `gh` CLI
- Clears dirty flags
- Updates `last_sync` timestamp

**Session Start Sync:**
- Loads cache if exists
- Checks staleness (future: timestamps)
- Fetches from GitHub if cache missing
- External tracking epics auto-sync (for `project/*` labels)

**External Project Tracking:**
- Epics with `project/*` labels sync from external repos
- Fetches open issues from external repo via GitHub CLI
- Updates tasklist in epic body
- Runs automatically on session start

### Example Workflow

**Scenario:** Working on Epic #42 across two machines

**On Laptop A:**
```bash
# Morning work
cd ~/src/myproject
opencode
# Work on Epic #42, make progress
# End session → Changes sync to GitHub
```

**On Laptop B (evening):**
```bash
# Evening work
cd ~/src/myproject
opencode
# Plugin loads → Fetches Epic #42 updates from GitHub
# See morning progress reflected
# Continue work
# End session → Changes sync to GitHub
```

**Back on Laptop A (next day):**
```bash
# Next morning
cd ~/src/myproject
opencode
# Plugin loads → Fetches Epic #42 updates from GitHub
# See evening progress reflected
```

**Key Point:** GitHub always has the latest state. Each machine pulls from GitHub on start, pushes on end.

---

## Troubleshooting

### Cache Out of Sync

**Symptom:** Epic state doesn't match GitHub Issues

**Solution:**
```bash
# Force cache rebuild
rm -rf ~/.config/opencode/powerlevel/cache/
# Restart OpenCode → Cache regenerates from GitHub
cd ~/src/your-project
opencode
```

**Why this works:** Cache is ephemeral. Deleting forces fresh fetch from GitHub.

---

### Plugin Not Loading

**Symptom:** No Powerlevel score displayed on session start

**Solution 1 - Check opencode.json syntax:**
```bash
cat ~/.config/opencode/opencode.json | jq
```

Expected: Valid JSON output
If error: Fix JSON syntax (missing comma, bracket, etc.)

**Solution 2 - Verify plugin path:**
```bash
ls ~/.config/opencode/powerlevel/plugin.js
```

Expected: File exists
If missing: Re-clone repository

**Solution 3 - Check OpenCode logs:**
```bash
# Check for plugin loading errors
# (Log location varies by OpenCode version)
```

---

### Skills Not Found

**Symptom:** Superpowers skills not available in OpenCode

**Solution:**
```bash
# Verify symlink exists
ls -la ~/.config/opencode/skills/powerlevel

# If missing, create symlink
ln -s ~/.config/opencode/powerlevel/skills ~/.config/opencode/skills/powerlevel

# Restart OpenCode
```

---

### GitHub CLI Errors

**Symptom:** `gh: command not found` or authentication errors

**Solution 1 - Install GitHub CLI:**

**macOS:**
```bash
brew install gh
```

**Linux:**
```bash
# See: https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

**Solution 2 - Authenticate:**
```bash
gh auth login
```

Follow prompts to authenticate via browser or token.

**Solution 3 - Verify authentication:**
```bash
gh auth status
```

Expected: ✓ Logged in to github.com

---

### Rate Limit Exceeded

**Symptom:** Errors about GitHub API rate limits

**Solution:**
- GitHub CLI authenticated users get 5000 requests/hour
- Wait for rate limit reset (shown in error message)
- Powerlevel batches operations to minimize API calls
- Cache reduces need for frequent API requests

**Check rate limit status:**
```bash
gh api rate_limit
```

---

### Epics Not Syncing

**Symptom:** Changes made on Machine A not visible on Machine B

**Diagnosis:**
```bash
# On Machine A - Check if changes synced
gh issue view <epic-number> --repo castrojo/powerlevel

# On Machine B - Check if cache stale
cat ~/.config/opencode/powerlevel/cache/*/state.json | jq '.last_sync'
```

**Solution:**
- Ensure session ended cleanly on Machine A
- Delete cache on Machine B and restart OpenCode
- Check GitHub directly to verify issue state

---

### Permission Denied Errors

**Symptom:** Cannot write to cache directory

**Solution:**
```bash
# Check directory permissions
ls -la ~/.config/opencode/powerlevel/

# Fix permissions if needed
chmod -R u+rw ~/.config/opencode/powerlevel/cache/

# Ensure directory is not owned by root
# (Should be owned by your user)
```

---

## Verification Checklist

After completing setup, verify everything works:

### ✅ Installation Verification

- [ ] **Plugin file exists:**
  ```bash
  ls ~/.config/opencode/powerlevel/plugin.js
  ```
  Expected: File found

- [ ] **Skills symlink valid:**
  ```bash
  ls -la ~/.config/opencode/skills/powerlevel
  ```
  Expected: Symlink → `../powerlevel/skills`

- [ ] **OpenCode config valid:**
  ```bash
  cat ~/.config/opencode/opencode.json | jq '.plugin'
  ```
  Expected: Array includes `"~/.config/opencode/powerlevel/plugin.js"`

- [ ] **GitHub CLI authenticated:**
  ```bash
  gh auth status
  ```
  Expected: ✓ Logged in to github.com

### ✅ Runtime Verification

- [ ] **Plugin loads on session start:**
  ```bash
  cd ~/src/any-project
  opencode
  ```
  Expected: See "Powerlevel 🔶 N - Managing X active projects"

- [ ] **Cache directory created:**
  ```bash
  ls ~/.config/opencode/powerlevel/cache/
  ```
  Expected: Directory with hash name(s)

- [ ] **Cache contains valid data:**
  ```bash
  cat ~/.config/opencode/powerlevel/cache/*/state.json | jq
  ```
  Expected: Valid JSON with `epics`, `issues`, `project_board` keys

### ✅ Sync Verification

- [ ] **Epics match GitHub:**
  ```bash
  # Count epics in cache
  cat ~/.config/opencode/powerlevel/cache/*/state.json | jq '.epics | length'
  
  # Count epics in GitHub
  gh issue list --repo castrojo/powerlevel --label type/epic | wc -l
  ```
  Expected: Counts match (approximately - may differ by 1-2 if actively working)

- [ ] **Project board detected:**
  ```bash
  cat ~/.config/opencode/powerlevel/cache/*/state.json | jq '.project_board'
  ```
  Expected: Object with `id`, `number`, `title`, `url` (or `null` if no project board)

### ✅ Cross-Machine Verification

If you have access to multiple machines:

- [ ] **Create test epic on Machine A:**
  ```bash
  # On Machine A
  gh issue create --repo castrojo/powerlevel \
    --title "Test Epic - Machine Sync" \
    --label type/epic \
    --body "Testing cross-machine sync"
  ```

- [ ] **Verify appears on Machine B:**
  ```bash
  # On Machine B
  # Delete cache to force fresh fetch
  rm -rf ~/.config/opencode/powerlevel/cache/
  
  # Start OpenCode
  cd ~/src/any-project
  opencode
  
  # Check cache
  cat ~/.config/opencode/powerlevel/cache/*/state.json | jq '.epics[] | select(.title | contains("Test Epic"))'
  ```
  Expected: Test epic appears in cache

- [ ] **Clean up test epic:**
  ```bash
  gh issue close <epic-number> --repo castrojo/powerlevel
  ```

---

## Architecture Reference

For deeper technical understanding, see:

- **[AGENTS.md](../AGENTS.md)** - Complete architecture documentation for AI agents
- **[lib/cache-manager.js](../lib/cache-manager.js)** - Cache implementation details
- **[lib/external-tracker.js](../lib/external-tracker.js)** - External project sync mechanisms
- **[plugin.js](../plugin.js)** - Plugin entry point and session hooks

### Key Components

**Plugin Initialization (`plugin.js:485`):**
- Loads on OpenCode session start
- Detects repository from git remote
- Ensures labels exist
- Registers session hooks

**Cache Manager (`lib/cache-manager.js`):**
- Loads/saves cache to `cache/<repo-hash>/state.json`
- Tracks epics, sub-issues, dirty flags
- Enables rate-limit-friendly batch operations

**External Tracker (`lib/external-tracker.js`):**
- Syncs external project tracking epics
- Fetches issues from external repos
- Updates tasklists in epic bodies
- Runs on session start for `project/*` labeled epics

**Session Hooks (`lib/session-hooks.js`):**
- Detects Superpowers skill invocations
- Updates epic status when skills used
- Records journey events
- Marks epics dirty for batch sync

**Land the Plane (`skills/land-the-plane/`):**
- Triggered by `session.idle` event
- Batches all dirty epics
- Syncs to GitHub via `gh` CLI
- Clears dirty flags

### Data Flow

```
User writes plan
     ↓
writing-plans saves plan file
     ↓
epic-creation skill invoked
     ↓
Parse plan → Create epic → Create sub-tasks
     ↓
Update cache (dirty=false, just synced)
     ↓
Insert epic reference in plan
     ↓
Add to project board (if configured)
     ↓
... work happens ...
     ↓
executing-plans skill detected
     ↓
Epic status updated to in-progress
     ↓
Mark epic dirty=true (needs sync)
     ↓
... more work ...
     ↓
Session ends → session.idle event
     ↓
landThePlane() batches dirty epics
     ↓
Sync to GitHub via gh CLI
     ↓
Clear dirty flags
     ↓
GitHub has latest state (ready for next machine)
```

---

## Summary

**Key Takeaways:**

1. ✅ **GitHub is the single source of truth** - Always authoritative
2. ✅ **Cache auto-regenerates** - Never copy between machines
3. ✅ **Plugin handles sync automatically** - Session start pulls, session end pushes
4. ✅ **Configuration files are git-tracked** - Safe to have on multiple machines
5. ✅ **Force rebuild if stale** - Delete cache, restart OpenCode

**Setup is complete when:**
- Plugin loads on session start
- Powerlevel score displays correctly
- Cache directory exists and contains valid data
- Epics in cache match GitHub Issues

**For help:**
- See [Troubleshooting](#troubleshooting) section above
- Check [AGENTS.md](../AGENTS.md) for architecture details
- Report issues: https://github.com/castrojo/powerlevel/issues

---

**Last Updated:** 2026-02-10
