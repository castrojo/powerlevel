---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch (Powerlevel Override)

**This is a powerlevel-specific override that adds fork detection to the base skill.**

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Present options → Execute choice → Clean up.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## The Process

### Step 1: Verify Tests

**Before presenting options, verify tests pass:**

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If tests fail:**
```
Tests failing (<N> failures). Must fix before completing:

[Show failures]

Cannot proceed with merge/PR until tests pass.
```

Stop. Don't proceed to Step 2.

**If tests pass:** Continue to Step 2.

### Step 2: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 3: Present Options

Present exactly these 4 options:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Don't add explanation** - keep options concise.

### Step 4: Execute Choice

#### Option 1: Merge Locally

```bash
# Switch to base branch
git checkout <base-branch>

# Pull latest
git pull

# Merge feature branch
git merge <feature-branch>

# Verify tests on merged result
<test command>

# If tests pass
git branch -d <feature-branch>
```

Then: Cleanup worktree (Step 5)

#### Option 2: Push and Create PR (WITH FORK DETECTION)

**CRITICAL: This option checks if the repo is a fork and creates PR within the fork, NOT upstream.**

```bash
# Push branch
git push -u origin <feature-branch>

# Check if this is a fork
PARENT_REPO=$(gh repo view --json parent -q '.parent.nameWithOwner' 2>/dev/null)

if [ -n "$PARENT_REPO" ]; then
  # Fork detected - create PR within the fork, NOT upstream
  FORK_REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
  echo "✓ Fork detected: $FORK_REPO (upstream: $PARENT_REPO)"
  echo "✓ Creating PR in $FORK_REPO (NOT upstream)"
  
  gh pr create \
    --repo "$FORK_REPO" \
    --title "<title>" \
    --body "$(cat <<EOF
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>

---
**Note:** This PR is in the fork ($FORK_REPO). To submit upstream to $PARENT_REPO, use the \`preparing-upstream-pr\` skill.
EOF
)"
else
  # Standalone repo - create PR normally
  echo "✓ Standalone repo - creating PR"
  gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
fi
```

Then: Cleanup worktree (Step 5)

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then: Cleanup worktree (Step 5)

### Step 5: Cleanup Worktree

**For Options 1, 2, 4:**

Check if in worktree:
```bash
git worktree list | grep $(git branch --show-current)
```

If yes:
```bash
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.

## Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | ✓ | - | - | ✓ |
| 2. Create PR | - | ✓ | ✓ | - |
| 3. Keep as-is | - | - | ✓ | - |
| 4. Discard | - | - | - | ✓ (force) |

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**Open-ended questions**
- **Problem:** "What should I do next?" → ambiguous
- **Fix:** Present exactly 4 structured options

**Automatic worktree cleanup**
- **Problem:** Remove worktree when might need it (Option 2, 3)
- **Fix:** Only cleanup for Options 1 and 4

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

**Creating PRs to upstream from forks (CRITICAL)**
- **Problem:** Bypass fork-first workflow, open PR to upstream without approval
- **Fix:** Always check for fork, create PR within fork, mention preparing-upstream-pr skill

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request
- **Open PRs directly to upstream repos from forks (use preparing-upstream-pr skill instead)**

**Always:**
- Verify tests before offering options
- Present exactly 4 options
- Get typed confirmation for Option 4
- Clean up worktree for Options 1 & 4 only
- **Create PRs within the fork when working on forked repos**
- **Mention preparing-upstream-pr skill in PR body when fork detected**

## Integration

**Called by:**
- **subagent-driven-development** (Step 7) - After all tasks complete
- **executing-plans** (Step 5) - After all batches complete

**Pairs with:**
- **using-git-worktrees** - Cleans up worktree created by that skill
- **preparing-upstream-pr** - Used after Option 2 when user wants to submit upstream

## Powerlevel-Specific Notes

This skill overrides the base superpowers version to add:
1. Fork detection via `gh repo view --json parent`
2. Automatic PR creation within fork, NOT upstream
3. Clear messaging about fork vs upstream
4. Note in PR body mentioning preparing-upstream-pr skill

This ensures compliance with the castrojo fork-first workflow where:
- All PRs are created in castrojo/* repos first
- Upstream submission requires explicit user request via preparing-upstream-pr skill
