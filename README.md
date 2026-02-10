# Powerlevel

A multi-project management dashboard for OpenCode + Superpowers. Track all your active projects in one place. Your Powerlevel = number of projects you're managing.

**Dashboard:** [Powerlevel N](https://github.com/users/castrojo/projects/1) (where N = your current level)

## What It Does

Powerlevel transforms Superpowers implementation plans into GitHub Project boards that track multiple code repositories from a central management hub.

When you create an implementation plan:
- Creates a GitHub epic issue with `type/epic` label
- Creates sub-task issues for each task with `type/task` labels
- Tags issues with `project/name` labels for filtering
- Links everything to your central Powerlevel dashboard
- Syncs progress automatically at session end

**Central Hub:** This repo holds all project plans and configurations. Your actual code lives in separate repositories.

## Installation

1. **Clone this repository:**
```bash
cd ~/.config/opencode
git clone https://github.com/castrojo/powerlevel.git
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

5. **Create your Powerlevel dashboard:**
```bash
node ~/.config/opencode/powerlevel/bin/create-dashboard.js
```

## Getting Started

See [Getting Started Guide](docs/getting-started.md) for detailed setup and usage.

## Managing Multiple Projects

### Add a New Project

1. Create project directory:
```bash
mkdir -p projects/my-awesome-app
```

2. Add project config:
```json
{
  "name": "my-awesome-app",
  "repo": "github.com/you/my-awesome-app",
  "description": "An awesome application"
}
```

3. Create your first plan and watch Powerlevel create the epic automatically!

### Project Structure

```
powerlevel/
├── projects/
│   ├── my-awesome-app/
│   │   ├── config.json
│   │   ├── plans/
│   │   │   └── 2026-02-09-add-feature.md
│   │   └── AGENTS.md (optional)
│   └── another-project/
│       └── ...
├── skills/
│   ├── epic-creation/
│   └── land-the-plane/
└── lib/
    ├── project-manager.js
    └── ...
```

## How It Works

### Automatic Epic Creation

When you complete a plan with `writing-plans`:

```markdown
# Your Feature Implementation Plan

**Goal:** Add dark mode support

## Task 1: Create toggle component
...
```

Powerlevel automatically:
- Creates epic issue `#123` with labels: `type/epic`, `project/my-app`
- Creates sub-tasks `#124`, `#125` with labels: `type/task`, `epic/123`, `project/my-app`
- Updates plan file with epic reference
- Adds issues to your Powerlevel dashboard

### Manual Epic Creation

```bash
node bin/create-epic.js projects/my-app/plans/my-plan.md
```

### Session End Sync

Powerlevel automatically syncs progress when your session ends using the `land-the-plane` skill.

## Labels

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

**Project:**
- `project/name` - Links issue to specific project

**Epic Reference:**
- `epic/123` - Links task to parent epic #123

## Troubleshooting

**"gh: command not found"**
- Install GitHub CLI: https://cli.github.com/

**"Failed to detect GitHub repository"**
- Powerlevel works from the central repo, but creates issues in project repos
- Ensure project config has correct `repo` field

**Labels not created**
- Check GitHub CLI authentication: `gh auth status`
- Verify repo access: `gh repo view`

**Epic creation fails**
- Ensure plan has proper structure (# Title, **Goal:**, ## Task N:)
- Check API rate limits: `gh api rate_limit`

## Migration from opencode-superpower-github

See [Migration Guide](docs/migration.md) for upgrading from the previous version.

## Support

Report issues: https://github.com/castrojo/powerlevel/issues

## License

Apache 2.0 - See LICENSE file
