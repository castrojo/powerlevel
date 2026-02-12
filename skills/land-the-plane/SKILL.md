---
name: land-the-plane
description: Use at session end or when disconnecting - syncs all work to GitHub, ensuring nothing is lost
---

# Land the Plane

## Overview

Sync all work to GitHub before session end. Two things get synced: the powerlevel repo (plans, configs) and completed issues in the current project.

**Announce at start:** "Landing the plane -- syncing work to GitHub."

## The Process

### 1. Sync Powerlevel Repo

Commit and push any uncommitted changes in the powerlevel repo:

```bash
cd ~/.config/opencode/powerlevel
git add -A
git status --short
```

**If there are changes:**

```bash
git commit -m "sync: land-the-plane"
git push
```

**If nothing to commit:** Report "Powerlevel repo is clean."

**If push fails:** Report the error. Do NOT lose the commit -- it will push next session.

### 2. Close Completed Issues

Check recent commits in the current project repo for issue references:

```bash
git log --oneline -20 --format='%s'
```

Look for patterns: `closes #N`, `fixes #N`, `resolves #N`

For each referenced issue, close it on GitHub:

```bash
gh issue close <number> --repo <owner/repo>
```

**Report:** "Closed issues: #N, #M" or "No issues to close."

### 3. Report Summary

```
Powerlevel repo: pushed N changes (or: clean)
Issues closed: #N, #M (or: none)
All work synced to GitHub.
```

## When to Use

- End of session (manual invocation)
- Before switching machines
- When unsure if changes were saved

The plugin's `session.idle` hook does the same thing automatically, but this skill provides an explicit, user-visible sync with reporting.

## Error Handling

| Situation | Action |
|-----------|--------|
| git push fails | Report error, keep local commit |
| gh issue close fails | Report error, continue to next |
| Not in a git repo | Skip step 2, only sync powerlevel repo |
| No gh auth | Report "gh not authenticated", skip issue closing |
