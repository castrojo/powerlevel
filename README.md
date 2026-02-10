# Powerlevel

![Powerlevel](https://img.shields.io/badge/Powerlevel-7%20~%20Iron%20Lord-brightgreen)

**Your personal project management dashboard for OpenCode + Superpowers**

Track all your projects in one central place. Each project you manage contributes to your Powerlevel - the total number of active projects across your repositories.

**Project Board:** [Superpowers Development](https://github.com/users/castrojo/projects/1)

## Design Philosophy

**Powerlevel is tracking-only.** All epics track work happening in other repositories. Powerlevel never manages the actual work—it only displays a unified status snapshot across all your projects. Your Powerlevel score = the number of active projects you're currently managing.

### Destiny Ranks

As you take on more projects, you ascend through Destiny-inspired ranks. Every 5 projects unlocks a new tier:

| Powerlevel | Rank | Description |
|------------|------|-------------|
| 1-5 | **Guardian** | You've taken your first steps into a larger world |
| 6-10 | **Iron Lord** | Forged in fire, tempered by challenge |
| 11-15 | **Vanguard** | Leading the charge against entropy |
| 16-20 | **Awoken Paladin** | Dancing between Light and Dark |
| 21-25 | **Ascendant** | Your will shapes reality itself |
| 26-30 | **Disciple** | The architecture of creation bends to you |
| 31-35 | **Dredgen** | Master of the space between triumph and ruin |
| 36-40 | **The Lucent** | Even death is but a tool in your arsenal |
| 41-45 | **Witness** | You perceive the Final Shape |
| 46-50 | **Paracausal** | Beyond Light and Darkness, beyond fate itself |

Your project board title automatically updates to show your current rank: "Powerlevel 5 ~ Guardian"

## What It Does

Powerlevel provides a central command center for managing multiple projects with Superpowers:

- **Central Dashboard**: One project board showing all tracked projects
- **Multi-Project Tracking**: Each project lives in its own repo, tracked here
- **Automatic Epic Creation**: Plans become GitHub issues automatically
- **Progress Sync**: Updates flow from projects to your central board
- **Powerlevel Score**: See total active projects and completion metrics
- **Wiki Sync**: Share skills and docs across projects via GitHub wikis
- **Context Discovery**: AI agents automatically access skills and patterns

Your **Powerlevel** = the number of active projects you're managing. Simple as that.

## Features

### Epic Tracking
- **Automatic GitHub epic creation** from implementation plans
- **Sub-task tracking** with epic references  
- **Journey updates** when tasks complete
- **Cache-based sync** for offline work with batch GitHub updates
- **Skill invocation tracking** - Detects when Superpowers skills are used
- **Auto status updates** - Epics transition from planning → in-progress → review automatically
- **Epic references in plans** - Quick links inserted at top of plan files

### Wiki Sync
- **Sync skills and documentation** to project wikis
- **Automatic wiki fetch** on session start (when enabled)
- **Manual sync** via command line or `/wiki-sync` command
- **Centralized knowledge base** accessible to agents and humans
- 📖 See [Wiki Sync Documentation](docs/WIKI-SYNC.md)

### Agent Context Discovery
- **AI agents discover skills** and patterns from superpowers repo
- **Local caching** for fast access with TTL-based refresh
- **Automatic context refresh** on session start
- **Multiple context sources**: superpowers wiki, project wiki, local docs, implementation plans
- 🤖 See [Agent Context Documentation](docs/AGENT-CONTEXT.md)

### Superpowers Integration
- **Event-driven skill tracking** - Automatically detects when Superpowers skills are invoked
- **Epic status automation** - Transitions epics through workflow states based on skill usage
- **Journey tracking** - Records skill invocations and milestones in epic metadata
- **Smart plan linking** - Associates skill usage with relevant epics via plan file references
- **Project board integration** - Automatically populates GitHub Project Boards with epics and tasks
- **Field mapping** - Maps label values (priority, status) to project board fields
- 🚀 See [Superpowers Integration](docs/SUPERPOWERS-INTEGRATION.md) (coming soon)

### External Project Tracking
- **Multi-repository tracking** - Track work happening in external repos from one dashboard
- **Auto-sync on session start** - Sub-issues mirror open epics from external project boards
- **Powerlevel score** - Each tracked project contributes +1 to your Powerlevel
- **Tracking-only design** - Work happens in external repos, Powerlevel displays status
- **Two tracking modes:**
  - **Self-tracking epics** - Track Powerlevel development itself
  - **External tracking epics** - Track work in other repositories (e.g., projectbluefin/common)
- 📊 See [External Tracking Guide](docs/plans/2026-02-10-external-project-tracking.md)

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

## Quick Start

### Onboard Your Project

From your project repository, run:

```bash
node bin/onboard-project.js
```

This will:
- Add the superpowers git remote to your project
- Create default configuration in `.opencode/config.json`
- Set up documentation stub in `docs/SUPERPOWERS.md`
- Enable context discovery for AI agents

### Sync Skills to Wiki

After onboarding, sync skills and docs to your project's GitHub wiki:

```bash
# One-time: Enable wiki in GitHub repo settings
# Then run:
node bin/sync-wiki.js
```

This makes skills and documentation accessible via your project's wiki.

### Create Your First Epic

Write an implementation plan, then create an epic from it:

```bash
# Create plan (use writing-plans skill in OpenCode)
# Then create epic:
node bin/create-epic.js .opencode/plans/my-plan.md
```

This creates a GitHub epic issue with sub-tasks automatically.

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

## Configuration

Configuration is stored in `.opencode/config.json`:

```json
{
  "superpowers": {
    "enabled": true,
    "remote": "superpowers",
    "repoUrl": "git@github.com:castrojo/superpowers.git",
    "autoOnboard": false,
    "wikiSync": true
  },
  "projectBoard": {
    "enabled": true,
    "number": null,
    "autoCreate": true
  },
  "superpowersIntegration": {
    "enabled": true,
    "trackSkillUsage": true,
    "updateEpicOnSkillInvocation": true
  },
  "wiki": {
    "autoSync": false,
    "syncOnCommit": false,
    "includeSkills": true,
    "includeDocs": true
  },
  "tracking": {
    "autoUpdateEpics": true,
    "updateOnTaskComplete": true,
    "commentOnProgress": false
  }
}
```

### Configuration Options

**`projectBoard`** - GitHub Project Board integration
- `enabled` (boolean) - Enable/disable project board integration
- `number` (number|null) - Specific project board number (null = auto-detect first board)
- `autoCreate` (boolean) - Auto-create project board if none exists

**`superpowersIntegration`** - Skill tracking and epic updates
- `enabled` (boolean) - Enable/disable session hook integration
- `trackSkillUsage` (boolean) - Record skill invocations in epic journey
- `updateEpicOnSkillInvocation` (boolean) - Auto-update epic status when skills are invoked

**`tracking`** - Progress tracking behavior
- `autoUpdateEpics` (boolean) - Enable automatic epic updates
- `updateOnTaskComplete` (boolean) - Update epics when tasks are completed via commits
- `commentOnProgress` (boolean) - Post GitHub comments on progress milestones

**Environment variable overrides:**
```bash
export GITHUB_TRACKER_PROJECT_ENABLED=false
export GITHUB_TRACKER_PROJECT_NUMBER=2
export GITHUB_TRACKER_PROJECT_AUTO_CREATE=true
```

See [Wiki Sync docs](docs/WIKI-SYNC.md) and [Agent Context docs](docs/AGENT-CONTEXT.md) for detailed configuration options.

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

**Wiki sync issues**
- Enable wiki in GitHub repository settings
- Verify superpowers remote: `git remote -v | grep superpowers`
- See [Wiki Sync troubleshooting](docs/WIKI-SYNC.md#troubleshooting)

**Context discovery not working**
- Run onboarding: `node bin/onboard-project.js`
- Check config: `cat .opencode/config.json`
- See [Agent Context troubleshooting](docs/AGENT-CONTEXT.md#troubleshooting)

**Project board issues in wrong status columns**
- Run enforcement script: `node bin/enforce-board-rules.js`
- This ensures epics stay in Todo/In Progress/Done and sub-issues stay in Subissues

## Maintenance Scripts

**Enforce project board organization rules:**
```bash
node bin/enforce-board-rules.js
```
Validates and fixes project board status columns according to these rules:
- **Todo/In Progress/Done** - Epics only (`type/epic` label)
- **Subissues** - All sub-issues (issues with parent relationships)

Run this after bulk operations or if the board organization gets messy.

## Documentation

- [Wiki Sync System](docs/WIKI-SYNC.md) - Syncing skills and docs to wikis
- [Agent Context Discovery](docs/AGENT-CONTEXT.md) - How agents discover and use context
- [AGENTS.md](AGENTS.md) - Architecture guide for AI agents working on this codebase

## Support

Report issues: https://github.com/YOUR_USERNAME/powerlevel/issues

## License

Apache 2.0 - See LICENSE file
