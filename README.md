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

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/castrojo/powerlevel/main/bin/setup-machine.sh)
```

**Prerequisites:** OpenCode, GitHub CLI (`gh auth login`), Git, `jq`

**Multi-machine setup:** See [Machine Setup Guide](docs/MACHINE-SETUP.md)

## Workflow

Powerlevel automatically tracks your work as you use OpenCode with Superpowers.

### Example: Building a New Feature

**1. Create a plan**
```bash
# In your project repo
cd ~/src/my-app
opencode

# Ask agent: "Create a plan for adding user authentication"
# Agent uses writing-plans skill → Creates docs/plans/2026-02-10-add-auth.md
```

**2. Epic auto-created**
- Powerlevel detects plan file
- Creates Epic #45 in Powerlevel repo with sub-issues
- Adds to GitHub Project Board
- Your Powerlevel score increases by 1

**3. Execute work**
```bash
# Agent uses executing-plans skill
# → Epic status: Planning → In Progress
# → Sub-issues update as tasks complete
```

**4. Review and complete**
```bash
# Agent uses finishing-a-development-branch skill
# → Epic status: In Progress → Review
# → Commits pushed, PR created

# Once merged:
# → Epic closed
# → Your Powerlevel score decreases by 1
```

**Your Powerlevel = number of active epics across all tracked projects.**

### Tracking External Projects

Track work in other repositories from your central Powerlevel dashboard:

```bash
cd ~/src/powerlevel
node bin/track-project.js owner/upstream-repo --auto
```

Creates tracking epic that syncs upstream issues automatically on session start.

## How to Use

### Onboarding a New Project

Onboard a new project to track it in your Powerlevel dashboard:

```bash
# Basic usage
node bin/auto-onboard.js owner/repo

# With options
node bin/auto-onboard.js castrojo/myproject \
  --force \
  --description="My awesome project" \
  --tech-stack="Node.js,React,PostgreSQL"
```

**Options:**
- `--force` - Skip confirmation prompts
- `--workspace=PATH` - Clone to specific directory (default: `../repo-name`)
- `--description=TEXT` - Project description
- `--tech-stack=A,B,C` - Technology stack (comma-separated)
- `--skip-config` - Skip creating project config
- `--help` - Show detailed help

### Commands

**Manual epic creation:**
```bash
node ~/.config/opencode/powerlevel/bin/create-epic.js docs/plans/my-plan.md
```

**View current epic context:**
Powerlevel automatically detects and displays your current epic at session start by scanning `docs/plans/*.md` for epic references.

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

Epics and sub-issues are automatically added to your GitHub Project Board with field mapping for Priority and Status.

**Features:**
- Auto-detects your first project board
- Maps `priority/p0-p3` labels → Priority field
- Maps `status/*` labels → Status field

**Configuration:** Set `GITHUB_TRACKER_PROJECT_ENABLED=false` to disable, or `GITHUB_TRACKER_PROJECT_NUMBER=N` to use a specific board. See [AGENTS.md](AGENTS.md) for full configuration options.

## Performance

Powerlevel has been analyzed for batching and parallelization opportunities to optimize efficiency and reduce API costs.

**Key findings:**
- 18 optimization opportunities identified
- Estimated 4% reduction in API calls
- Estimated 65% reduction in session duration (Phase 1)
- Estimated 84-93% reduction in cache I/O (Phase 2)

**See:** [Optimization Roadmap](docs/analysis/OPTIMIZATION-ROADMAP.md) for detailed analysis and implementation phases.

**Upcoming optimizations:**
- 📋 Phase 1: Parallelize external epic syncs, sub-issue creation, project board additions
- 📋 Phase 2: In-memory cache singleton, batch GraphQL mutations, optimize external fetching
- 📋 Phase 3: Token usage optimization, rate limit monitoring, TTL-based cache invalidation

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
