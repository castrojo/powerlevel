# Onboarding New Projects to Powerlevel + Superpowers

**Last Updated:** February 10, 2026  
**Reference Implementation:** casestudypilot integration

## Overview

This guide explains how to integrate an existing project with powerlevel (project management) and superpowers (development workflows). After integration, the project will have:

- ✅ Automatic epic creation from implementation plans
- ✅ Centralized project tracking across all your repositories
- ✅ Access to universal development workflows (brainstorming, TDD, debugging, etc.)
- ✅ Automatic progress sync to GitHub project boards
- ✅ Structured labeling and task management

## Prerequisites

Before starting:

1. **Project Requirements:**
   - Git repository on GitHub
   - Existing or new project with development plans
   - GitHub CLI (`gh`) installed and authenticated

2. **Powerlevel Setup:**
   - Powerlevel cloned to `~/.config/opencode/powerlevel/`
   - Plugin configured in your OpenCode installation

3. **Superpowers Setup:**
   - Superpowers skills at `~/.config/opencode/skills/superpowers/`
   - Basic familiarity with superpowers workflow patterns

## Integration Checklist

Use this checklist when onboarding a new project:

### Phase 1: Project Repository Setup

- [ ] **1.1: Create OpenCode configuration in project repo**
  
  Create `.opencode/config.json` in project root:
  ```json
  {
    "plugins": [
      "~/.config/opencode/powerlevel/plugin.js"
    ]
  }
  ```

- [ ] **1.2: Create project metadata file**
  
  Create `<project-name>-config.json` in project root:
  ```json
  {
    "project_name": "my-project",
    "repo": "owner/my-project",
    "active": true,
    "description": "Brief project description",
    "labels": {
      "project": "project/my-project"
    },
    "tech_stack": ["Language", "Framework", "Tool"],
    "primary_agent": "main-agent-name",
    "framework_version": "1.0.0"
  }
  ```

- [ ] **1.3: Verify GitHub CLI authentication**
  
  ```bash
  gh auth status
  gh repo view owner/my-project
  ```

- [ ] **1.4: Test powerlevel plugin loads**
  
  Open OpenCode session in project directory and verify:
  - Plugin initialization messages appear
  - No errors in console
  - Labels created on GitHub repository

### Phase 2: Powerlevel Central Registration

- [ ] **2.1: Create project directory in powerlevel**
  
  ```bash
  mkdir -p ~/.config/opencode/powerlevel/projects/my-project/plans
  ```

- [ ] **2.2: Create project configuration**
  
  Create `~/.config/opencode/powerlevel/projects/my-project/config.json`:
  ```json
  {
    "repo": "owner/my-project",
    "active": true,
    "labels": {
      "project": "project/my-project"
    },
    "description": "Brief project description",
    "tech_stack": ["Language", "Framework"],
    "framework_version": "1.0.0",
    "agents": ["agent1", "agent2"],
    "skills": ["skill1", "skill2"]
  }
  ```

- [ ] **2.3: Create project AGENTS.md reference**
  
  Create `~/.config/opencode/powerlevel/projects/my-project/AGENTS.md`:
  ```markdown
  # My Project - Agent Documentation

  Brief description of project's agent/skill architecture.

  ## Framework Documentation

  **Primary Documentation:** See main repository AGENTS.md or README.md  
  **Repository:** https://github.com/owner/my-project

  ## Quick Reference

  ### Agents
  - **agent-name (vX.Y.Z):** Brief description

  ### Skills
  - skill1, skill2, skill3

  ### CLI Tools
  - command1, command2, command3

  ## Integration Notes

  - Uses powerlevel for epic tracking
  - Leverages superpowers for development workflows
  - Domain-specific patterns: [describe any unique patterns]
  ```

- [ ] **2.4: Link existing plans (optional)**
  
  ```bash
  # Symlink or copy existing plans to powerlevel
  ln -s /path/to/project/docs/plans/*.md \
        ~/.config/opencode/powerlevel/projects/my-project/plans/
  ```

### Phase 3: Migrate Existing Epics

- [ ] **3.1: Audit existing epics**
  
  ```bash
  # List all epics in project
  gh issue list --repo owner/my-project --label "epic" --state all \
    --json number,title,state,url
  ```

- [ ] **3.2: Add powerlevel labels to epics**
  
  ```bash
  # For each epic, add appropriate labels
  gh issue edit EPIC_NUMBER --repo owner/my-project \
    --add-label "type/epic,project/my-project,status/STATUS"
  
  # Status values: planning, in-progress, review, done
  ```

- [ ] **3.3: Link plans to epic issues**
  
  Ensure each plan file has epic reference at bottom:
  ```markdown
  ---
  
  **Epic:** #NUMBER (https://github.com/owner/my-project/issues/NUMBER)
  ```

- [ ] **3.4: Create powerlevel cache (optional)**
  
  Powerlevel will auto-create cache on first use, but you can manually initialize:
  
  Calculate repo hash:
  ```bash
  cd /path/to/project
  git remote get-url origin | shasum -a 256 | cut -c1-8
  ```
  
  Create `~/.config/opencode/powerlevel/cache/<repo-hash>/state.json`:
  ```json
  {
    "repo": {
      "owner": "owner",
      "repo": "my-project",
      "detected_at": "2026-02-10T12:00:00Z"
    },
    "epics": {
      "EPIC_NUMBER": {
        "number": EPIC_NUMBER,
        "title": "Epic Title",
        "state": "open",
        "labels": ["type/epic", "project/my-project", "status/STATUS"],
        "plan_file": "docs/plans/plan-file.md",
        "created_at": "2026-02-09T00:00:00Z",
        "sub_issues": [],
        "dirty": false
      }
    },
    "last_sync": "2026-02-10T12:00:00Z"
  }
  ```

### Phase 4: Update Project Documentation

- [ ] **4.1: Update project AGENTS.md to reference superpowers**
  
  Add section to project's AGENTS.md:
  ```markdown
  ## Foundation: Superpowers Skills

  This project builds on **superpowers**, a universal skill system for LLM-driven development.

  ### Universal Development Skills

  Located at: `~/.config/opencode/skills/superpowers/`

  **Planning & Design:**
  - `brainstorming`: Design exploration before implementation
  - `writing-plans`: Structured planning for multi-step tasks
  - `executing-plans`: Plan execution with review checkpoints

  **Development Discipline:**
  - `test-driven-development`: Write tests before implementation
  - `systematic-debugging`: Root cause analysis for failures
  - `verification-before-completion`: Run checks before claiming complete

  [Add other relevant superpowers skills...]

  ### When to Use Superpowers vs. Project Skills

  | Situation | Use Superpowers | Use Project Skills |
  |-----------|-----------------|-------------------|
  | Planning new feature | ✅ `writing-plans` | After plan: domain work |
  | Debugging failure | ✅ `systematic-debugging` | Domain knowledge |
  | Implementing feature | ✅ `test-driven-development` | Domain tools |
  | [Add project-specific rows...] | | |

  **Integration:** This project's agents and skills follow superpowers patterns 
  but are specialized for [domain description].
  ```

- [ ] **4.2: Update README.md with integration section**
  
  Add to README.md:
  ```markdown
  ## Integration

  **Powerlevel:** This project uses [powerlevel](https://github.com/castrojo/powerlevel) 
  for project management and epic tracking. Plans in `docs/plans/` are automatically 
  converted to GitHub epics with trackable sub-tasks.

  **Superpowers:** Development workflows leverage 
  [superpowers](https://github.com/anomalyco/opencode) skills for planning, debugging, 
  testing, and verification.

  **Configuration:**
  - Powerlevel plugin: `.opencode/config.json`
  - Superpowers location: `~/.config/opencode/skills/superpowers/`
  - Project tracking: `~/.config/opencode/powerlevel/projects/my-project/`
  ```

- [ ] **4.3: Update CONTRIBUTING.md with workflow guidance**
  
  Add to CONTRIBUTING.md:
  ```markdown
  ## Development Workflow

  This project uses **superpowers** skills for structured development.

  ### Before Starting Work

  1. **Brainstorm:** Use `brainstorming` skill for design exploration
  2. **Plan:** Use `writing-plans` skill → automatic epic creation
  3. **Review Epics:** Check open epics to avoid duplicate work

  ### During Development

  1. **TDD:** Use `test-driven-development` skill
  2. **Debug:** Use `systematic-debugging` skill for failures

  ### Before Committing

  1. **Verify:** Use `verification-before-completion` skill
  2. **Review:** Use `requesting-code-review` skill for PR

  See [powerlevel docs](https://github.com/castrojo/powerlevel) for details.
  ```

- [ ] **4.4: Document version/integration in changelog**
  
  Add entry to project changelog:
  ```markdown
  ## vX.Y.Z (Date)

  **Integration Updates:**
  - Integrated with powerlevel project management dashboard
  - Added superpowers skill system as development foundation
  - Automatic epic creation from plans
  - Progress tracking with session sync
  - Migrated existing epics to powerlevel system
  ```

### Phase 5: Test Integration

- [ ] **5.1: Test epic creation workflow**
  
  ```
  1. User: "Create a plan for [new feature]"
  2. Agent invokes brainstorming skill
  3. Agent invokes writing-plans skill
     → Plan saved to docs/plans/YYYY-MM-DD-feature-name.md
  4. Powerlevel epic-creation triggered automatically
     → Epic created on GitHub
     → Sub-task issues created
     → Plan file updated with epic reference
  ```

- [ ] **5.2: Test progress sync**
  
  ```
  1. Agent completes a task
  2. Agent marks task done in cache (dirty=true)
  3. Session ends or manual sync
  4. Powerlevel land-the-plane syncs progress
     → Task issue closed
     → Epic issue updated
  ```

- [ ] **5.3: Verify labels and tracking**
  
  ```bash
  # Check epic labels
  gh issue list --repo owner/my-project --label "type/epic,project/my-project"
  
  # Check task labels
  gh issue list --repo owner/my-project --label "type/task,project/my-project"
  
  # Verify status labels accurate
  gh issue list --repo owner/my-project --label "status/in-progress"
  ```

- [ ] **5.4: Test superpowers workflows**
  
  ```
  User: "Debug why [feature] isn't working"
  Agent: Invokes systematic-debugging skill
    → Hypothesis → Test → Root Cause → Fix
  ```

### Phase 6: Create Integration Verification Document

- [ ] **6.1: Create verification checklist in project**
  
  Create `docs/integration-verification.md` in project repository:
  ```markdown
  # Integration Verification Checklist

  ## Powerlevel Plugin
  - [ ] `.opencode/config.json` exists and loads powerlevel plugin
  - [ ] `gh auth status` shows authentication
  - [ ] Powerlevel labels exist on GitHub
  - [ ] Project registered in powerlevel central repo
  - [ ] Cache directory exists

  ## Superpowers Skills
  - [ ] Superpowers directory exists
  - [ ] Key skills present and invokable
  - [ ] AGENTS.md references superpowers

  ## Epic Creation
  - [ ] Epic creation skill works manually
  - [ ] writing-plans triggers epic-creation automatically
  - [ ] Plan files updated with epic references
  - [ ] Sub-task issues created

  ## Progress Sync
  - [ ] land-the-plane skill works
  - [ ] session.idle hook triggers sync
  - [ ] Epic issues updated with progress

  ## Documentation
  - [ ] README documents integration
  - [ ] AGENTS.md references superpowers
  - [ ] CONTRIBUTING explains workflows
  - [ ] Verification checklist exists

  ## End-to-End Test
  [Include project-specific test workflow]
  ```

## Common Patterns by Project Type

### Python CLI Tool Projects

**Example:** casestudypilot

**Special Considerations:**
- CLI validation commands (exit codes 0/1/2)
- pytest integration with verification-before-completion
- Docker/container workflow support

**Superpowers Priority:**
1. `test-driven-development` - Essential for CLI tools
2. `verification-before-completion` - Run CLI validations
3. `systematic-debugging` - Test failures and exit codes

### Web Application Projects

**Special Considerations:**
- Frontend/backend skill separation
- API endpoint testing
- UI/UX workflow integration

**Superpowers Priority:**
1. `brainstorming` - Design exploration critical
2. `test-driven-development` - Unit + integration tests
3. `verification-before-completion` - Build + test suite

### Library/Framework Projects

**Special Considerations:**
- API design and versioning
- Documentation generation
- Breaking change management

**Superpowers Priority:**
1. `brainstorming` - API design decisions
2. `test-driven-development` - Public API coverage
3. `requesting-code-review` - API review critical

### Agent/Skill Framework Projects

**Example:** casestudypilot (has agent framework)

**Special Considerations:**
- Meta development (agents that modify agents)
- Three-layer architecture (agent/skill/CLI)
- LLM skill documentation patterns

**Superpowers Priority:**
1. `writing-skills` - Creating new LLM skills
2. `brainstorming` - Agent workflow design
3. `verification-before-completion` - Agent testing

## Troubleshooting

### Plugin Doesn't Load

**Symptom:** No powerlevel initialization messages

**Checks:**
```bash
# Verify config exists
cat .opencode/config.json

# Verify plugin file exists
ls ~/.config/opencode/powerlevel/plugin.js

# Check OpenCode logs for errors
```

**Fix:** Ensure path to plugin.js is correct and plugin.js has no syntax errors

### Epic Creation Fails

**Symptom:** Plan created but no epic on GitHub

**Checks:**
```bash
# Verify epic-creation skill exists
ls ~/.config/opencode/powerlevel/skills/epic-creation/SKILL.md

# Test manual epic creation
cd ~/.config/opencode/powerlevel
node bin/create-epic.js /path/to/plan.md

# Check GitHub authentication
gh auth status
```

**Fix:** Ensure gh CLI authenticated, plan file has proper structure (# Title, ## Task N:)

### Labels Not Created

**Symptom:** Epic/task labels missing on GitHub

**Checks:**
```bash
# List labels
gh label list --repo owner/project

# Check powerlevel initialization
# (Should create labels on first plugin load)
```

**Fix:** Manually create labels or re-run plugin initialization:
```bash
# Recreate labels using powerlevel lib
node -e "require('~/.config/opencode/powerlevel/lib/label-manager.js').ensureLabelsExist('owner/project')"
```

### Progress Not Syncing

**Symptom:** Epic issues not updated after session

**Checks:**
```bash
# Verify cache exists
ls ~/.config/opencode/powerlevel/cache/*/state.json

# Check cache has dirty epics
cat ~/.config/opencode/powerlevel/cache/*/state.json | jq '.epics | map(select(.dirty == true))'

# Verify land-the-plane skill exists
ls ~/.config/opencode/powerlevel/skills/land-the-plane/SKILL.md
```

**Fix:** Manually invoke land-the-plane skill or check session.idle hook configuration

### Superpowers Skills Not Found

**Symptom:** Agent can't invoke brainstorming, writing-plans, etc.

**Checks:**
```bash
# Verify superpowers directory
ls ~/.config/opencode/skills/superpowers/

# Check OpenCode can find skills
# (OpenCode should auto-discover skills in this location)
```

**Fix:** Ensure superpowers installed at correct location, symlink if needed

## Reference Implementations

### CaseStudyPilot (Complete Integration)

**Repository:** https://github.com/castrojo/casestudypilot

**Architecture:** Three-layer agent/skill/CLI framework

**Integration Features:**
- ✅ Powerlevel epic tracking
- ✅ Superpowers workflow integration
- ✅ Domain agents (case-study-agent, people-agent)
- ✅ Domain skills (transcript-analysis, case-study-generation)
- ✅ CLI validation tools with exit codes
- ✅ Fail-fast validation architecture

**Key Files to Reference:**
- `AGENTS.md` - Superpowers integration example
- `.github/agents/case-study-agent.md` - Development workflow notes
- `CONTRIBUTING.md` - Superpowers usage guidelines
- `docs/integration-verification.md` - Verification checklist

**Lessons Learned:**
1. Layer documentation hierarchically (superpowers → framework → domain)
2. Use "When to Use" tables to clarify superpowers vs. domain skills
3. Add development workflow notes to domain agents
4. Create verification checklist early in integration
5. Migrate existing epics to powerlevel labels for continuity

## Support

**Questions?** Create an issue in:
- Powerlevel: https://github.com/castrojo/powerlevel/issues
- Superpowers: https://github.com/anomalyco/opencode/issues

**Examples:** See `projects/` directory in powerlevel repository for complete examples.

---

**Document Version:** 1.0  
**Reference Implementation:** casestudypilot (v2.4.0)  
**Last Updated:** February 10, 2026
