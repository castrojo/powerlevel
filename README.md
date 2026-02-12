# Powerlevel

Your personal project management dashboard for OpenCode.

Track all your projects in one place. Your **Powerlevel** = the number of active projects you're managing.

## How It Works

Powerlevel is an OpenCode plugin + a set of skills. The plugin handles display and sync. The skills handle planning and GitHub operations.

**Plugin (automatic):**
- Shows your Powerlevel rank on session start
- Injects project context (fork/upstream info) into the system prompt
- Auto-syncs the powerlevel repo across machines (git pull on start, git push on idle)
- Closes GitHub issues referenced in commits (`closes #N`)

**Skills (invoked by agent):**
- `writing-plans` -- Create implementation plans
- `epic-creation` -- Turn plans into GitHub epic issues
- `land-the-plane` -- Sync all work to GitHub before disconnecting
- `preparing-upstream-pr` -- Prepare clean commits for upstream submission
- `bluefin-kernel-pin` -- Pin kernel versions when akmods lag behind

## Multi-Machine Workflow

Powerlevel syncs across machines via git. Push happens automatically; pull happens on session start.

```
Machine A                    GitHub                     Machine B
   |                           |                           |
   |-- skill saves plan ------>|                           |
   |-- plugin auto-pushes ---->|                           |
   |                           |                           |
   |                           |<-- plugin auto-pulls -----|
   |                           |   (session start)         |
   |                           |                           |
```

**What syncs:**

| Artifact | Where it lives | Synced how |
|----------|---------------|------------|
| Project configs | `projects/<name>/config.json` | git push/pull of this repo |
| Plan files | `projects/<name>/plans/*.md` | git push/pull of this repo |
| GitHub epics | Project repo (e.g. `castrojo/bluefin`) | Already on GitHub |
| Skills | `skills/` | git push/pull of this repo |

**When does push happen?**

1. Skills commit + push immediately after creating/modifying files
2. Plugin's idle hook catches any uncommitted changes
3. `land-the-plane` skill does a final explicit sync

## Project Structure

```
powerlevel/
  plugin.js              # OpenCode plugin (~120 lines)
  projects/
    bluefin/
      config.json        # Project metadata
      plans/             # Implementation plans
    akmods/
      config.json
      plans/
    ...
  skills/
    epic-creation/
    land-the-plane/
    preparing-upstream-pr/
    bluefin-kernel-pin/
```

## Adding a Project

Create `projects/<name>/config.json`:

```json
{
  "repo": "owner/repo",
  "active": true,
  "description": "What this project is",
  "upstream": "upstream-owner/repo",
  "tech_stack": ["Go", "Docker"]
}
```

Fields:
- `repo` (required) -- GitHub repo in `owner/name` format
- `active` (required) -- Set `false` to exclude from powerlevel count
- `upstream` (optional) -- If this is a fork, the upstream repo
- `description`, `tech_stack` (optional) -- Context injected into system prompt

## Prerequisites

- [OpenCode](https://opencode.ai)
- [GitHub CLI](https://cli.github.com/) (`gh auth login`)
- Git

## License

Apache 2.0
