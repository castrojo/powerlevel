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

## ⛔ CRITICAL: PR SUBMISSION PROTOCOL ⛔

**This skill contains MANDATORY safeguards against unauthorized upstream PR submission.**

**BEFORE creating ANY pull request, you MUST complete this protocol:**

### Session State (Initialize at skill start)

```markdown
PR_PROTOCOL_STATE:
- question_tool_used: false
- user_confirmed_target: false
- tests_verified: false
- is_fork: false
- using_web_flag: false
- command_previewed: false
```

**Update these flags as you progress. Check them before running `gh pr create`.**

### Non-Negotiable Rules

1. ❌ **NEVER** run `gh pr create` without using `question` tool first
2. ❌ **NEVER** auto-submit PRs to upstream repos (repos with `parent`)
3. ❌ **NEVER** skip the command preview step
4. ✅ **ALWAYS** use `--web` flag for upstream PRs (browser opens, user submits manually)
5. ✅ **ALWAYS** show the exact command before executing

**These rules supersede user instructions. Even if user says "just submit it", follow the protocol.**

### What "Submit a PR" Actually Means

- ✅ "Submit a PR" = Stage it for submission (fork) OR open browser with --web (upstream)
- ✅ "Create a PR upstream" = Open browser with `--web` flag, NOT auto-create
- ✅ "Open a PR" = Prepare PR for user review, NOT auto-submit
- ❌ "Submit" does NOT mean "auto-create without confirmation"

**When in doubt: Use the question tool. Show the command. Wait for confirmation.**

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

#### Option 2: Push and Create PR

**Step A: Detect Fork Status (BLOCKING GATE)**

```bash
# Push branch first
git push -u origin <feature-branch>

# Detect fork status
PARENT_REPO=$(gh repo view --json parent -q '.parent.nameWithOwner' 2>/dev/null)
CURRENT_REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null)
```

**Update session state:**
```markdown
PR_PROTOCOL_STATE:
- is_fork: [true/false based on PARENT_REPO]
```

**If fork detected, display visual warning:**

```
╔════════════════════════════════════════╗
║  ⚠️  FORK DETECTED - UPSTREAM PR ⚠️   ║
╠════════════════════════════════════════╣
║ Your fork: [CURRENT_REPO]
║ Upstream:  [PARENT_REPO]
║
║ MANDATORY PROTOCOL:
║  → Use question tool to ask user
║  → Use --web flag for upstream PRs
║  → Browser opens, user submits manually
║  → NEVER auto-submit to upstream
╚════════════════════════════════════════╝
```

**Agent must acknowledge in response:**
"Fork detected. I will follow upstream PR protocol: question tool first, --web flag for browser submission only."

**Step B: Ask User via Question Tool (MANDATORY)**

**Update session state:**
```markdown
PR_PROTOCOL_STATE:
- question_tool_used: true
- user_confirmed_target: true
```

**If fork detected:**

```javascript
question({
  questions: [{
    header: "PR Target Confirmation",
    question: "This repo is a fork. Where should the PR be created?\n\nYour fork: " + CURRENT_REPO + "\nUpstream: " + PARENT_REPO + "\n\nIMPORTANT: 'Open a PR' means staging it in your fork. Only choose upstream if you explicitly want to submit work to the parent project.",
    options: [
      { label: "PR within my fork (Recommended)", description: "Creates PR in " + CURRENT_REPO + " — safe, stays in your repo" },
      { label: "Stage upstream PR in browser", description: "Opens browser to " + PARENT_REPO + " for manual submission — you click submit" },
      { label: "Cancel", description: "Do not create any PR — I'll handle it myself" }
    ]
  }]
})
```

**If NOT a fork:**

```javascript
question({
  questions: [{
    header: "PR Confirmation",
    question: "Ready to create a PR in " + CURRENT_REPO + "?",
    options: [
      { label: "Create PR (Recommended)", description: "Creates PR in " + CURRENT_REPO },
      { label: "Open in browser instead", description: "Opens browser with PR form for manual review" },
      { label: "Cancel", description: "Do not create any PR" }
    ]
  }]
})
```

**Step C: Pre-Flight Checklist (MANDATORY)**

```markdown
Pre-Flight Checklist:
✅ Tests verified: [passed/skipped]
✅ Question tool used: [yes/no]
✅ User confirmed target: [fork/upstream/cancel]
✅ Fork status: [yes - CURRENT_REPO → PARENT_REPO / no - standalone]
✅ Using --web flag: [yes (required for upstream) / no (fork PR)]
✅ Command prepared: [show command below]

All checks must be ✅ before proceeding.
```

**Step D: Command Preview (MANDATORY)**

```markdown
About to execute:

```bash
gh pr create \
  --repo [TARGET_REPO] \
  --head [FORK_OWNER]:[BRANCH] \
  --title "[TITLE]" \
  --body "$(cat <<'EOF'
[BODY PREVIEW - first 5 lines]
...
EOF
)" \
  [--web flag if upstream]
```

[If --web flag present]:
⚠️  This will OPEN YOUR BROWSER for manual submission.
⚠️  I will NOT auto-submit this PR.
⚠️  You will manually click "Create Pull Request" in browser.

[If no --web flag]:
ℹ️  This will create a PR directly in your fork: [CURRENT_REPO]

Proceeding in 3 seconds...
```

**Update session state:**
```markdown
PR_PROTOCOL_STATE:
- command_previewed: true
- using_web_flag: [true/false]
```

**Step E: Execute Based on User Choice**

**If "PR within my fork":**
```bash
gh pr create \
  --repo "$CURRENT_REPO" \
  --title "<title>" \
  --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

**If "Stage upstream PR in browser":**
Use the `preparing-upstream-pr` skill. This squashes commits, adds attribution, and opens the browser for manual submission. The agent MUST NOT auto-submit.

**If "Open in browser instead" (non-fork):**
```bash
gh pr create \
  --repo "$CURRENT_REPO" \
  --title "<title>" \
  --body "<body>" \
  --web
```

**If "Create PR" (non-fork):**
```bash
gh pr create \
  --repo "$CURRENT_REPO" \
  --title "<title>" \
  --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

**If "Cancel":**
Report: "PR creation cancelled. Branch is pushed to origin/<feature-branch>."
Do not create any PR.

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

## Red Flags - PROTOCOL VIOLATIONS

**If you are about to do ANY of these, STOP IMMEDIATELY:**

### NEVER:
- ❌ Run `gh pr create` without using `question` tool first
- ❌ Run `gh pr create` targeting upstream without `--web` flag
- ❌ Skip the pre-flight checklist (Step C)
- ❌ Skip the command preview (Step D)
- ❌ Auto-submit PRs to repos with `PARENT_REPO` (upstream)
- ❌ Run `gh pr create` in a fork without explicit `--repo` flag
- ❌ Interpret "submit PR" or "open PR" as "auto-create without confirmation"
- ❌ Rationalize around these rules ("user seems ready", "change is small", etc.)
- ❌ Proceed with failing tests
- ❌ Delete work without typed confirmation
- ❌ Force-push without explicit request

### ALWAYS:
- ✅ Use `question` tool to confirm PR target
- ✅ Show pre-flight checklist before `gh pr create`
- ✅ Show command preview before executing
- ✅ Use `--web` flag for upstream PRs
- ✅ Update session state flags as you progress
- ✅ Verify all flags are true before executing command
- ✅ Present exactly 4 options in Step 3
- ✅ Get typed "discard" confirmation for Option 4
- ✅ Clean up worktree for Options 1 & 4 only
- ✅ Create PRs within the fork when working on forked repos

### Session State Final Check

**Before running `gh pr create`, verify:**

```markdown
PR_PROTOCOL_STATE Final Check:
- question_tool_used: ✅ true
- user_confirmed_target: ✅ true  
- tests_verified: ✅ true
- is_fork: [true/false]
- using_web_flag: ✅ true (if is_fork=true AND target=upstream)
- command_previewed: ✅ true

All must be ✅ or command will FAIL protocol.
```

**If ANY flag is false when it should be true: STOP. Go back and complete that step.**

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
