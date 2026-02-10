# Getting Started with Powerlevel

## What is Powerlevel?

Powerlevel is a multi-project management dashboard for OpenCode + Superpowers. Your Powerlevel = number of active projects you're managing.

## Installation

See [README.md](../README.md#installation) for installation steps.

## Creating Your First Project

1. Copy the template:
```bash
cd ~/.config/opencode/powerlevel
cp -r projects/.template projects/my-app
```

2. Edit the config:
```json
{
  "name": "my-app",
  "repo": "github.com/you/my-app",
  "description": "My awesome application"
}
```

3. Create your first plan in `projects/my-app/plans/`

4. When you save the plan, Powerlevel automatically creates GitHub issues!

## Your Dashboard

Create your dashboard:
```bash
node ~/.config/opencode/powerlevel/bin/create-dashboard.js
```

This creates a GitHub Project board titled "Powerlevel N" where N is your current level.

## How It Works

- Each project directory = +1 to your Powerlevel
- Implementation plans → GitHub epics automatically
- Issues are tagged with `project/name` labels for filtering
- Track everything from one central dashboard
