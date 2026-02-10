# OpenCode Superpower: GitHub

Automatically sync your Superpowers workflow with GitHub Issues. Creates epics from implementation plans and tracks progress through development.

**Project Board:** [Superpowers Development](https://github.com/users/castrojo/projects/1)

## What It Does

When you create an implementation plan with Superpowers, this plugin automatically:
- Creates a GitHub epic issue
- Creates sub-task issues for each task in your plan
- Links everything together with labels and references
- Syncs progress at the end of your session

## Installation

1. **Clone this repository:**
```bash
cd ~/.config/opencode
git clone https://github.com/YOUR_USERNAME/opencode-superpower-github.git
```

2. **Install the plugin:**

Add to your `~/.config/opencode/opencode.json`:
```json
{
  "plugin": [
    "~/.config/opencode/opencode-superpower-github/plugin.js"
  ]
}
```

3. **Symlink the skills:**
```bash
mkdir -p ~/.config/opencode/skills
ln -s ~/.config/opencode/opencode-superpower-github/skills ~/.config/opencode/skills/github-tracker
```

4. **Verify GitHub CLI:**
```bash
gh auth status
```

## How to Use

### Automatic Epic Creation

When you complete a plan using `writing-plans`, the plugin automatically creates a GitHub epic:

```markdown
# Your Feature Implementation Plan

**Goal:** Add dark mode support to the app

## Task 1: Create toggle component
...
```

This becomes:
- Epic issue `#123` with label `type/epic`
- Sub-tasks `#124`, `#125`, etc. with labels `type/task` and `epic/123`
- Your plan file updated with `**Epic Issue:** #123`

### Manual Epic Creation

Create an epic from any plan file:
```bash
node ~/.config/opencode/opencode-superpower-github/bin/create-epic.js docs/plans/my-plan.md
```

### Session End Sync

When your session ends, the plugin automatically syncs all progress to GitHub using the `land-the-plane` skill.

You can also manually sync:
```bash
# Will be available as /gh-sync command (post-MVP)
```

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
- Ensure you're in a git repository
- Verify git remote origin is set to a GitHub URL
- Run: `git remote -v`

**Labels not created**
- Check GitHub CLI authentication: `gh auth status`
- Verify repo access: `gh repo view`

**Epic creation fails**
- Ensure plan file has proper structure (# Title, **Goal:** section, ## Task N: headers)
- Check GitHub API rate limits: `gh api rate_limit`

## Support

Report issues: https://github.com/YOUR_USERNAME/opencode-superpower-github/issues

## License

Apache 2.0 - See LICENSE file
