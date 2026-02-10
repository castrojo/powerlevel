# Projects

This directory contains all projects tracked by Powerlevel. Each project has its own subdirectory with plans and configuration.

## Adding a New Project

1. Create a directory for your project:
```bash
mkdir -p projects/my-project/plans
```

2. Create a config file:
```json
// projects/my-project/config.json
{
  "repo": "username/my-project",
  "active": true,
  "labels": {
    "project": "project/my-project"
  }
}
```

3. Create your first plan in `projects/my-project/plans/`

4. Run `writing-plans` skill to create the plan

5. Epic will be automatically created with `project/my-project` label

## Project Structure

```
projects/
├── my-project/
│   ├── config.json          # Project configuration
│   ├── AGENTS.md            # Project-specific agent context (optional)
│   └── plans/               # Implementation plans
│       └── 2026-02-09-feature.md
```

## Powerlevel Score

Your Powerlevel is the number of active projects in this directory. Each project with `"active": true` (or unset) contributes to your score.

**Example:** 6 active projects = Powerlevel 6
