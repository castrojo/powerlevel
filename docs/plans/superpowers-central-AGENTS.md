# Superpowers Central AGENTS.md (Draft)

This file shows what the top-level `AGENTS.md` should contain in the future `castrojo/superpowers` repository.

---

# Superpowers - Central Agent Context

**For AI Agents Working Across Projects**

This repository provides centralized skills, patterns, and opinions for managing multiple projects with the Superpowers workflow.

## What is Superpowers?

Superpowers is a coordination layer that:
- Provides **reusable skills** for common workflows (epic creation, planning, etc.)
- Defines **central opinions** on labeling, planning, and project management
- Aggregates **plans from multiple projects** for visibility
- Publishes **skill documentation via wiki** for AI agent access

## How Project Repos Use Superpowers

### Project Structure
Each project repo has:
```
my-project/
├── .opencode/
│   ├── plans/                    # Implementation plans
│   ├── AGENTS.md                 # (Optional) Project-specific context
│   └── config.json               # (Optional) Superpowers config
```

### Integration is Transparent
When users run `superpowers create-epic`, the tool:
1. Creates issues in **the project repo** (not superpowers)
2. Adds items to **the project's board** (not superpowers)
3. Auto-syncs plans to `castrojo/superpowers` (transparent)
4. Fetches skill docs from superpowers wiki (transparent)

**Projects maintain their own issues and boards** - superpowers just coordinates.

## Available Skills

All skills live in `skills/` directory and are reusable across projects:

### Epic Creation (`skills/epic-creation/`)
- Parses implementation plans
- Creates GitHub epic + task issues
- Updates plan with issue references
- Adds items to project board
- Auto-syncs to superpowers

**Usage in projects**: AI agents load this skill when creating epics

### Writing Plans (`skills/writing-plans/`)
- Templates for implementation plans
- Best practices for plan structure
- Guidelines for task breakdown

### Land the Plane (`skills/land-the-plane/`)
- Creates PRs from implementation branches
- Links PRs to epics
- Generates PR descriptions from commits

## Central Opinions

### Labeling Strategy
All projects using superpowers should use consistent labels:

**Type Labels**:
- `type/epic` - Parent issue for an implementation plan
- `type/task` - Individual task from a plan

**Priority Labels**:
- `priority/p0` - Critical (drop everything)
- `priority/p1` - High (this sprint)
- `priority/p2` - Normal (planned)
- `priority/p3` - Low (backlog)

**Status Labels**:
- `status/planning` - Not started
- `status/in-progress` - Active work
- `status/review` - Ready for review
- `status/done` - Completed

**Epic Labels** (dynamic):
- `epic/123` - Links task to parent epic #123

### Plan Structure
Implementation plans should follow this format:

```markdown
# Plan Title

**Date**: YYYY-MM-DD
**Priority**: p0-p3

## Goal
[One paragraph describing what and why]

## Tasks
- Task 1: [Description]
- Task 2: [Description]
...
```

See `templates/plan-template.md` for full template.

### Workflow
1. Write plan in `.opencode/plans/`
2. Run `superpowers create-epic <plan-file>`
3. Epic + tasks created in project repo
4. Work tracked on project board
5. Plan auto-synced to superpowers (transparent)

## Project-Specific Context

Each project can add specific context in `.opencode/AGENTS.md`:
- Tech stack details
- Architecture patterns
- Domain-specific terminology
- Team conventions

Example:
```markdown
# My Project - Agent Context

## Superpowers Integration
See: https://github.com/castrojo/superpowers/blob/main/AGENTS.md

## Project-Specific
- Stack: Node.js + React
- Architecture: Microservices
- [...]
```

## Wiki Structure

The wiki contains published skill documentation for AI agents:

- **Home** - Overview and navigation
- **Skills/** - Skill documentation (SKILL.md files)
- **Best-Practices/** - Planning, labeling, patterns
- **Architecture/** - How superpowers works

## For Maintainers

### Adding New Skills
1. Create `skills/new-skill/SKILL.md`
2. Create `skills/new-skill/AGENTS.md` (architecture)
3. Test in a project
4. Publish to wiki via GitHub Actions

### Syncing Plans
Plans sync automatically when users run `superpowers create-epic`.

Backend: `git subtree push --prefix=.opencode superpowers main:projects/<name>`

### Publishing Wiki
Wiki auto-publishes from `skills/` and `docs/` via GitHub Actions.

Manual: `./scripts/publish-wiki.sh`

## References

- **Skills Directory**: `skills/`
- **Best Practices**: `docs/best-practices/`
- **Architecture**: `docs/architecture/`
- **Wiki**: https://github.com/castrojo/superpowers/wiki
- **NPM Package**: `@castrojo/superpowers`

---

**This file provides central context that all projects can reference without duplication.**
