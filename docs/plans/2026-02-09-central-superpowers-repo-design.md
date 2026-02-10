# Central Superpowers Repository Design

**Date:** 2026-02-09  
**Status:** Brainstorming  
**Priority:** p2

## Goal

Create a single "superpowers" repository that acts as a central command center for managing multiple projects. Each project gets its own directory with plans and agent documentation, while Superpowers skill documentation lives in the GitHub Wiki. This separates implementation details (wiki) from specs/decisions (issues).

## Problem Statement

Currently, each project repo contains:
- Project-specific code and AGENTS.md
- Superpowers skill documentation (clutters project repos)
- Implementation plans in `.opencode/plans/`
- GitHub issues for tracking work

**Issues:**
1. Superpowers skill docs (e.g., `skills/epic-creation/AGENTS.md`) pollute project repos
2. Each project reinvents labeling strategies and best practices
3. Hard to see all work across multiple projects in one place
4. Plans and specs get buried in individual project repos

## Vision

### Central Repository: `castrojo/superpowers`

One repository to manage all projects with Superpowers:
- **Project directories** contain plans and project-specific agent docs
- **Wiki** contains Superpowers skill documentation and best practices
- **GitHub Issues** track work across all projects (with label namespacing)
- **Templates** for plans, agent docs, and common patterns

### Separation of Concerns

**Issues (Human-Focused):**
- Epic issues with high-level goals and specs
- Task issues with specific acceptance criteria
- Decisions and requirements that humans need to approve

**Wiki (AI-Focused):**
- Superpowers skill documentation (how each skill works)
- Implementation patterns and best practices
- Architecture documentation for the Superpowers system
- Living documentation that evolves with the skills

**Project Repos:**
- Source code
- Project-specific AGENTS.md
- Development activity (commits, PRs, code reviews)

## Repository Structure

```
castrojo/superpowers/
├── README.md                    # Onboarding guide
├── projects/
│   ├── opencode-superpower-github/
│   │   ├── plans/               # Implementation plans
│   │   │   └── 2026-02-09-github-tracker-mvp.md
│   │   ├── AGENTS.md            # Project-specific agent docs
│   │   └── config.json          # Project metadata (repo URL, epic labels)
│   ├── my-web-app/
│   │   ├── plans/
│   │   ├── AGENTS.md
│   │   └── config.json
│   └── another-project/
│       └── ...
├── templates/                   # Reusable templates
│   ├── plan-template.md
│   ├── agents-template.md
│   └── config-template.json
├── docs/                        # Non-wiki documentation
│   ├── onboarding.md
│   └── best-practices/
│       ├── labeling-strategy.md
│       └── planning-guidelines.md
└── lib/                         # Shared tooling
    ├── github-cli.js
    ├── epic-creator.js
    └── ...
```

## Wiki Structure

```
Home                             # Central index and navigation
├── Getting-Started              # How to use this repo
└── Onboarding                   # Adding a new project

Skills/                          # Superpowers skill documentation
├── Epic-Creation                # skills/epic-creation/AGENTS.md content
├── Land-The-Plane               # skills/land-the-plane/AGENTS.md content
├── Writing-Plans
└── ...

Best-Practices/                  # Shared knowledge
├── Label-Strategy               # How to label issues across projects
├── Planning-Guidelines          # How to write good plans
├── Commit-Conventions           # Git commit best practices
└── Agent-Documentation          # How to write AGENTS.md

Architecture/                    # Technical reference
├── Epic-Creation-Flow           # How epics are created
├── Cache-System                 # How caching works
└── GitHub-Integration           # How we integrate with GitHub
```

## Workflow

### Adding a New Project

1. Create `projects/my-project/` directory
2. Add `config.json` with repo URL and settings
3. Create initial `AGENTS.md` for project-specific context
4. Create first plan in `projects/my-project/plans/`
5. Run epic creation tool to create GitHub issues

### Creating an Epic

1. Write plan in `projects/my-project/plans/YYYY-MM-DD-feature.md`
2. Run: `node lib/create-epic.js projects/my-project/plans/YYYY-MM-DD-feature.md`
3. Epic and task issues created on GitHub with labels like `project/my-project`
4. Plan file updated with epic reference

### Working on a Project

1. Reference wiki for Superpowers skill documentation
2. Check GitHub issues for current work (filter by `project/my-project`)
3. Work in the actual project repository
4. Update plans in this repo as needed
5. Sync progress to GitHub issues

## Label Strategy

### Project Namespacing
- `project/opencode-superpower-github` - Issues for this project
- `project/my-web-app` - Issues for another project
- `project/*` - Searchable/filterable across all projects

### Type Labels (Existing)
- `type/epic` - Parent issue for a plan
- `type/task` - Individual task from a plan

### Priority Labels (Existing)
- `priority/p0` - Critical
- `priority/p1` - High
- `priority/p2` - Normal
- `priority/p3` - Low

### Status Labels (Existing)
- `status/planning` - Not started
- `status/in-progress` - Active work
- `status/review` - Ready for review
- `status/done` - Complete

## Benefits

### For Humans
- **Single dashboard**: All projects visible in one issue tracker
- **Clean project repos**: No Superpowers clutter in project codebases
- **Discoverable best practices**: Wiki contains shared knowledge
- **Consistent patterns**: Templates and conventions across all projects

### For AI Agents
- **Centralized skill docs**: Wiki contains all Superpowers documentation
- **Project context**: AGENTS.md in projects/ directory provides project-specific context
- **Clear separation**: Issues = specs, Wiki = implementation, Repos = code
- **Scalable**: Add new projects without duplicating infrastructure

## Open Questions

1. **Wiki automation**: How do we sync skill documentation from OpenCode config to wiki?
2. **Cross-project dependencies**: How to handle tasks that span multiple projects?
3. **Archive strategy**: When to archive old plans and closed epics?
4. **Permission model**: Who can create projects vs. who can edit plans?
5. **Search**: How to make wiki content searchable (needs 500+ stars + restricted editing)?

## Next Steps

1. Research GitHub Wiki API/CLI capabilities
2. Design wiki sync automation
3. Create migration plan for existing project (opencode-superpower-github)
4. Build onboarding documentation
5. Create epic for implementation

## References

- GitHub Wiki Docs: https://docs.github.com/en/communities/documenting-your-project-with-wikis
- Current opencode-superpower-github repo: https://github.com/castrojo/opencode-superpower-github


---

**Epic:** #4 (https://github.com/castrojo/opencode-superpower-github/issues/4)
