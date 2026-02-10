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

## How to Use

### Setting Up a Project

1. Create a project directory:
```bash
mkdir -p projects/my-awesome-app
```

2. Add project config:
```json
// projects/my-awesome-app/config.json
{
  "repo": "username/my-awesome-app",
  "active": true,
  "labels": {
    "project": "project/my-awesome-app"
  }
}
```

3. Create your first plan in `projects/my-awesome-app/plans/`

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
