---
name: epic-creation
description: Use after writing-plans saves a plan file to create a GitHub epic issue with sub-task issues
---

# Epic Creation

## Overview

Automatically create GitHub epic issues from implementation plans. Extracts plan metadata (title, goal, tasks) and generates an epic issue with linked sub-task issues for tracking implementation progress.

**Announce at start:** "I'm using the epic-creation skill to create the GitHub epic."

**Context:** This should be run immediately after the writing-plans skill saves a plan file.

## When to Use

Use this skill when:
- You've just completed writing an implementation plan
- The plan file is saved to `docs/plans/YYYY-MM-DD-<feature-name>.md`
- You need to create a GitHub epic to track implementation

**Do NOT use this skill when:**
- Plan file doesn't exist yet
- You're just brainstorming (use brainstorming skill first)
- No GitHub repository is configured

## The Process

### Step 1: Load Plan File

Read the plan file from `docs/plans/` directory:

```bash
# Plan file location
docs/plans/YYYY-MM-DD-<feature-name>.md
```

**Verify:**
- File exists and is readable
- File follows writing-plans format
- Contains required metadata

### Step 2: Extract Plan Metadata

Parse the plan file to extract:

**Epic metadata:**
- **Title:** First H1 heading (without "Implementation Plan")
- **Goal:** Content of "**Goal:**" line
- **Architecture:** Content of "**Architecture:**" section
- **Tech Stack:** Content of "**Tech Stack:**" line

**Task metadata:**
- **Task titles:** Each H3 heading (`### Task N: [Title]`)
- **Task files:** Files listed under each task
- **Task steps:** Numbered steps within each task

**Example extraction:**
```markdown
# Feature Name Implementation Plan
→ Epic title: "Feature Name"

**Goal:** Build a thing that does X
→ Epic goal: "Build a thing that does X"

### Task 1: Component Name
→ Sub-issue title: "Task 1: Component Name"
```

### Step 3: Create Epic on GitHub

Create the parent epic issue using `gh` CLI:

```bash
gh issue create \
  --title "Epic: [Feature Name]" \
  --body "$(cat <<'EOF'
## Goal
[Goal from plan]

## Architecture
[Architecture from plan]

## Tech Stack
[Tech Stack from plan]

## Implementation Plan
See full plan: `docs/plans/YYYY-MM-DD-<feature-name>.md`

## Tasks
- [ ] Task 1: [Title] (#issue-number)
- [ ] Task 2: [Title] (#issue-number)
- [ ] Task 3: [Title] (#issue-number)

---
*This epic was auto-generated from the implementation plan.*
EOF
)" \
  --label "epic"
```

**Capture:**
- Epic issue number (e.g., `#123`)
- Epic URL

### Step 4: Create Sub-Task Issues

For each task in the plan, create a child issue:

```bash
gh issue create \
  --title "Task N: [Task Title]" \
  --body "$(cat <<'EOF'
## Parent Epic
#[epic-number]

## Files
[Files section from task]

## Steps
[Steps from task - formatted as checklist]

---
*Part of implementation plan: `docs/plans/YYYY-MM-DD-<feature-name>.md`*
EOF
)" \
  --label "task"
```

**For each sub-task:**
- Link to parent epic (`#[epic-number]`)
- Include files to modify/create
- Convert steps to GitHub checklist format
- Add "task" label

**Update epic with sub-task numbers:**
After creating all sub-tasks, edit the epic body to add sub-task issue numbers.

### Step 5: Update Plan with Epic Reference

Add epic reference to the top of the plan file:

```markdown
# Feature Name Implementation Plan

> **Epic Issue:** #123
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]
```

**Insert location:** Between the H1 heading and the Claude instruction.

### Step 6: Commit Plan Update

Commit the updated plan file with epic reference:

```bash
git add docs/plans/YYYY-MM-DD-<feature-name>.md
git commit -m "docs: link epic #123 to implementation plan"
```

**Announce completion:**
```
✅ Plan saved: docs/plans/<filename>.md
✅ Epic issue created: #<number>
✅ Sub-task issues created: #<n1>, #<n2>, #<n3>
```

## Integration with Other Skills

**Before epic-creation:**
1. **brainstorming** - Validate the idea and create design doc
2. **using-git-worktrees** - Create isolated workspace
3. **writing-plans** - Write detailed implementation plan

**After epic-creation:**
1. **executing-plans** - Execute the plan in parallel session
2. **subagent-driven-development** - Execute with subagents in current session

## Error Handling

**Plan file not found:**
```
❌ Error: Plan file not found at docs/plans/<filename>.md
Please ensure the writing-plans skill saved the file successfully.
```

**GitHub authentication failed:**
```
❌ Error: GitHub CLI not authenticated
Run: gh auth login
```

**Missing required metadata:**
```
❌ Error: Plan file missing required metadata
Required: Goal, Architecture, Tech Stack
Please update the plan file and try again.
```

**Issue creation failed:**
```
❌ Error: Failed to create epic issue
Check GitHub permissions and repository settings.
```

## Example Workflow

**Complete flow:**

```markdown
User: "Create epic for the metrics export feature"