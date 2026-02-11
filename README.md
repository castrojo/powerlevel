# Powerlevel

**Your personal project management dashboard for OpenCode + Superpowers**

Track all your projects in one central place. Each project you manage contributes to your Powerlevel - the total number of active projects across your repositories.

**Project Board:** [Superpowers Development](https://github.com/users/castrojo/projects/1)

## What It Does

Powerlevel provides a central command center for managing multiple projects with Superpowers:

- **Central Dashboard**: One project board showing all tracked projects
- **Multi-Project Tracking**: Each project lives in its own repo, tracked here
- **Automatic Epic Creation**: Plans become GitHub issues automatically
- **Progress Sync**: Updates flow from projects to your central board
- **Powerlevel Score**: See total active projects and completion metrics

Your **Powerlevel** = the number of active projects you're managing. Simple as that.

## Installation

1. **Clone this repository:**
```bash
cd ~/.config/opencode
git clone https://github.com/YOUR_USERNAME/powerlevel.git
```

2. **Install the plugin:**

Add to your `~/.config/opencode/opencode.json`:
```json
{
  "plugin": [
    "~/.config/opencode/powerlevel/plugin.js"
  ]
}
```

3. **Symlink the skills:**
```bash
mkdir -p ~/.config/opencode/skills
ln -s ~/.config/opencode/powerlevel/skills ~/.config/opencode/skills/powerlevel
```

4. **Verify GitHub CLI:**
```bash
gh auth status
```

## Multi-Machine Setup

Setting up Powerlevel on additional machines? See the **[Machine Setup Guide](docs/MACHINE-SETUP.md)**.

**Key Points:**
- GitHub is the single source of truth
- Never copy the `cache/` directory between machines
- Cache auto-regenerates from GitHub on first run
- Follow the guide for step-by-step instructions and troubleshooting

---

## How to Use

### Onboarding a New Project

Powerlevel provides a **single-command automated onboarding** that handles everything:

```bash
# Basic usage
node bin/auto-onboard.js owner/repo

# With options
node bin/auto-onboard.js castrojo/myproject \
  --force \
  --description="My awesome project" \
  --tech-stack="Node.js,React,PostgreSQL"
```

**What it does:**
1. ✅ Clones the repository (if needed)
2. ✅ Creates `.opencode/config.json` with Powerlevel configuration
3. ✅ Adds `superpowers` remote pointing to Powerlevel
4. ✅ Creates `AGENTS.md` with best practices links
5. ✅ Creates `docs/SUPERPOWERS.md` documentation
6. ✅ Creates project config in `projects/repo-name/config.json`
7. ✅ Commits all changes to the target repository

**Available Options:**
- `--force` - Skip confirmation prompts
- `--workspace=PATH` - Clone to specific directory (default: `../repo-name`)
- `--description=TEXT` - Project description for tracking
- `--tech-stack=A,B,C` - Technology stack (comma-separated)
- `--skip-config` - Skip creating Powerlevel project config
- `--help` - Show detailed help

**Example Workflow:**
```bash
# Onboard a documentation project
cd ~/src/powerlevel
node bin/auto-onboard.js castrojo/documentation --force

# Result:
# - Repository cloned to ~/src/documentation
# - Onboarding files committed
# - Project config created in projects/documentation/
# - Ready to track!
```

**After Onboarding:**
1. Use OpenCode with Superpowers normally in your project
2. Share common patterns in `docs/best-practices/`
3. Projects automatically sync with Powerlevel on session start

### Automatic Epic Creation

When you complete a plan using `writing-plans`, Powerlevel automatically:
- Creates an epic issue in the central Powerlevel repo
- Creates sub-task issues for each task
- Links everything with `project/name` labels
- Adds to the Powerlevel dashboard
- Updates your Powerlevel score

### Manual Epic Creation

Create an epic from any plan file:
```bash
node ~/.config/opencode/powerlevel/bin/create-epic.js projects/my-app/plans/my-plan.md
```

### Session End Sync

When your session ends, the plugin automatically syncs all progress to GitHub.

You can also manually sync:
```bash
# Available via session.idle event
```

### Epic Context Detection

When working in a project with plan files, Powerlevel automatically detects and displays the current epic:

**At OpenCode startup:**
```
📌 Current Epic: #21 - OpenCode Epic Header Display
   Plan: docs/plans/2026-02-10-opencode-epic-header-display.md
   URL: https://github.com/castrojo/casestudypilot/issues/21
```

**Programmatic access:**
```javascript
// In OpenCode JavaScript console or other plugins
const epic = session.context.getEpic();
console.log(epic.display);  // "Epic #21: OpenCode Epic Header Display"
console.log(epic.url);       // "https://github.com/..."
console.log(epic.raw);       // Full context object
```

**How it works:**
- Scans `docs/plans/*.md` for `**Epic Issue:** #N` references
- Uses most recent plan file (by filename)
- Falls back to git branch name (patterns: `epic-123`, `epic/123`, `feature/epic-123`)
- Caches results for performance
- Cache invalidates when plan files change

## Labels

The plugin creates these labels automatically:

**Type:**
- `type/epic` - Large feature with multiple tasks
- `type/task` - Individual task from a plan

**Priority:**
- `priority/p0` - Critical
- `priority/p1` - High
- `priority/p2` - Normal
- `priority/p3` - Low

**Status:**
- `status/planning` - Plan created, not started
- `status/in-progress` - Currently being worked on
- `status/review` - Ready for review
- `status/done` - Complete

**Project Reference:**
- `project/my-app` - Links issue to specific project

**Epic Reference:**
- `epic/123` - Links task to parent epic #123

## Project Board Integration

Epics and sub-issues are automatically added to your GitHub Project Board with proper field mapping.

### Features

- Auto-detects your first project board
- Maps labels to project fields:
  - `priority/p0-p3` → Priority field
  - `status/*` → Status field
- Adds both epics and sub-issues to the board
- Gracefully handles missing project boards or fields

### Configuration

**Environment Variables:**
```bash
# Disable project board integration
export GITHUB_TRACKER_PROJECT_ENABLED=false

# Use specific project number
export GITHUB_TRACKER_PROJECT_NUMBER=2
```

**Config File** (`.github-tracker.json`):
```json
{
  "projectBoard": {
    "enabled": true,
    "projectNumber": 1,
    "fieldMapping": {
      "priority": "Priority",
      "status": "Status"
    }
  }
}
```

### Field Mapping

The following label-to-field mappings are applied automatically:

| Label | Project Field | Project Value |
|-------|---------------|---------------|
| `priority/p0` | Priority | P0 - Critical |
| `priority/p1` | Priority | P1 - High |
| `priority/p2` | Priority | P2 - Normal |
| `priority/p3` | Priority | P3 - Low |
| `status/planning` | Status | Todo |
| `status/in-progress` | Status | In Progress |
| `status/review` | Status | In Progress |
| `status/done` | Status | Done |

## Troubleshooting

**"gh: command not found"**
- Install GitHub CLI: https://cli.github.com/

**"Failed to detect GitHub repository"**
- Powerlevel tracks projects via the `projects/` directory
- Ensure you have project configs in `projects/` directory
- Run: `ls projects/`

**Labels not created**
- Check GitHub CLI authentication: `gh auth status`
- Verify repo access: `gh repo view`

**Epic creation fails**
- Ensure plan file has proper structure (# Title, **Goal:** section, ## Task N: headers)
- Check GitHub API rate limits: `gh api rate_limit`

## Support

Report issues: https://github.com/YOUR_USERNAME/powerlevel/issues

## License

Apache 2.0 - See LICENSE file
