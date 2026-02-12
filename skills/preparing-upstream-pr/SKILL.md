---
name: preparing-upstream-pr
description: Use when user wants to submit work to upstream - squashes commits, adds attribution, verifies tests, pushes to fork, opens browser for manual submission
---

# Preparing Upstream Pull Request

## Overview

Prepare single clean commit for upstream submission from fork.

**Core principle:** Squash → Verify → Push → Browser → Manual submit

**Announce at start:** "I'm using the preparing-upstream-pr skill to prepare your upstream pull request."

## ⛔ CRITICAL: UPSTREAM PR PROTOCOL ⛔

**This skill prepares PRs for upstream submission. It NEVER auto-submits.**

### Session State (Initialize now)

```markdown
UPSTREAM_PR_STATE:
- fork_verified: false
- tests_verified: false
- commits_squashed: false
- command_previewed: false
- using_web_flag: false
```

### Non-Negotiable Rules

1. ❌ **NEVER** run `gh pr create` without `--web` flag
2. ❌ **NEVER** auto-submit PRs to upstream
3. ✅ **ALWAYS** open browser for manual submission
4. ✅ **ALWAYS** show command preview before executing
5. ✅ **ALWAYS** verify all session state flags before proceeding

**These rules supersede everything. Even if user says "just submit it now".**

### What This Skill Does

- ✅ Prepares clean commit with attribution
- ✅ Pushes to YOUR fork
- ✅ Opens browser with PR form pre-filled
- ❌ Does NOT click "Create Pull Request" for you
- ❌ Does NOT auto-submit to upstream

**Manual gate: User must click "Create Pull Request" in browser.**

## Prerequisites Check

**Before starting, verify fork setup:**

```bash
# Check remotes
git remote -v

# Must see origin pointing to your fork
# Example:
# origin    git@github.com:castrojo/project.git (fetch)
# origin    git@github.com:castrojo/project.git (push)
```

**Check if this is a fork:**

```bash
PARENT_REPO=$(gh repo view --json parent -q '.parent.nameWithOwner')

if [ -z "$PARENT_REPO" ]; then
  echo "❌ This is not a fork. Cannot proceed with upstream PR."
  echo "Use 'finishing-a-development-branch' Option 2 for same-repo PR."
  exit 1
fi

echo "✅ Fork detected: upstream = $PARENT_REPO"
```

**Ensure upstream remote exists:**

```bash
if ! git remote | grep -q "^upstream$"; then
  echo "Adding upstream remote: $PARENT_REPO"
  UPSTREAM_URL=$(gh repo view $PARENT_REPO --json sshUrl -q '.sshUrl')
  git remote add upstream $UPSTREAM_URL
fi

# CRITICAL: Always fetch upstream/main before any branch operations
git fetch upstream main --depth 1
```

**CRITICAL: Verify branch base is upstream/main, not origin/main:**

If the feature branch was created from `origin/main` instead of `upstream/main`, the PR will contain unrelated commits (merge commits from fork sync, shallow clone artifacts, fork-only files). This is the #1 cause of dirty upstream PRs.

```bash
# Check if current branch diverged from upstream/main
MERGE_BASE=$(git merge-base HEAD upstream/main 2>/dev/null)
UPSTREAM_TIP=$(git rev-parse upstream/main)

if [ "$MERGE_BASE" != "$UPSTREAM_TIP" ]; then
  echo "⚠️ Branch is not based on upstream/main."
  echo "   Creating clean branch from upstream/main and cherry-picking changes..."

  CURRENT_BRANCH=$(git branch --show-current)
  COMMITS=$(git log --oneline upstream/main..HEAD --reverse --format="%H" | grep -v "^$(git log --merges --format="%H" upstream/main..HEAD)")

  git checkout -B "${CURRENT_BRANCH}-clean" upstream/main
  for COMMIT in $COMMITS; do
    git cherry-pick "$COMMIT" || git cherry-pick --abort
  done

  git branch -D "$CURRENT_BRANCH"
  git branch -m "$CURRENT_BRANCH"
  echo "✅ Rebased onto upstream/main"
fi
```

## Step 1: Verify Current Branch

```bash
CURRENT_BRANCH=$(git branch --show-current)

# Ensure not on main/master
if [[ "$CURRENT_BRANCH" =~ ^(main|master)$ ]]; then
  echo "❌ Cannot create PR from main/master branch."
  echo "Create a feature branch first: git checkout -b feature/your-feature"
  exit 1
fi

echo "✅ Current branch: $CURRENT_BRANCH"
```

## Step 2: Detect and Run Tests

**Auto-detect test command:**

```bash
function detect_test_command() {
  # Check package.json
  if [ -f "package.json" ]; then
    if jq -e '.scripts.test' package.json > /dev/null 2>&1; then
      echo "npm test"
      return
    fi
  fi
  
  # Check Justfile
  if [ -f "Justfile" ]; then
    if grep -q "^test:" Justfile; then
      echo "just test"
      return
    elif grep -q "^check:" Justfile; then
      echo "just check"
      return
    fi
  fi
  
  # Check Makefile
  if [ -f "Makefile" ]; then
    if grep -q "^test:" Makefile; then
      echo "make test"
      return
    fi
  fi
  
  # Check Python
  if [ -f "pytest.ini" ] || [ -f "pyproject.toml" ]; then
    echo "pytest"
    return
  fi
  
  # Check Go
  if [ -f "go.mod" ]; then
    echo "go test ./..."
    return
  fi
  
  # Check Rust
  if [ -f "Cargo.toml" ]; then
    echo "cargo test"
    return
  fi
  
  echo "UNKNOWN"
}

TEST_CMD=$(detect_test_command)

if [ "$TEST_CMD" == "UNKNOWN" ]; then
  echo "⚠️ Could not detect test command."
  echo "Common options: npm test, just test, make test, pytest, cargo test, go test ./..."
  read -p "Enter test command (or 'skip' to skip tests): " TEST_CMD
  
  # Cache for future use
  if [ "$TEST_CMD" != "skip" ]; then
    mkdir -p .opencode
    echo "{\"testCommand\": \"$TEST_CMD\"}" > .opencode/project-config.json
  fi
fi
```

**Run tests (use verification-before-completion principles):**

```bash
if [ "$TEST_CMD" != "skip" ]; then
  echo "Running tests: $TEST_CMD"
  $TEST_CMD
  
  if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Fix before upstream submission."
    echo ""
    echo "After fixing, run: $TEST_CMD"
    exit 1
  fi
  echo "✅ Tests pass"
else
  echo "⚠️ Tests skipped (not recommended for upstream PRs)"
fi
```

## Step 3: Auto-Detect Model and Tool

**Detect from OpenCode session:**

```bash
# Note: This is pseudo-code. Actual implementation uses OpenCode SDK.
# In practice, the agent has access to session metadata via the SDK.

# Fallback for shell scripts:
MODEL_NAME="${OPENCODE_MODEL:-Claude Sonnet 4.5}"
TOOL_NAME="${OPENCODE_TOOL:-OpenCode}"

# If still unknown, prompt
if [ "$MODEL_NAME" == "UNKNOWN" ]; then
  echo "⚠️ Could not auto-detect model/tool."
  read -p "Model name (e.g., Claude Sonnet 4.5): " MODEL_NAME
  read -p "Tool name (e.g., OpenCode): " TOOL_NAME
fi

echo "Attribution: $MODEL_NAME via $TOOL_NAME"
```

**For agents:** Use OpenCode SDK to get session metadata:
- `session.model` → Model name
- `session.tool` → Tool name
- Fallback to environment variables or prompt

## Step 4: Detect Conventional Commit Usage

```bash
echo "Checking upstream commit conventions..."

UPSTREAM_CONVENTIONAL=$(gh pr list \
  --repo $PARENT_REPO \
  --state merged \
  --limit 20 \
  --json title \
  -q '.[].title' | \
  grep -cE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: ' || echo 0)

if [ "$UPSTREAM_CONVENTIONAL" -ge 10 ]; then
  USE_CONVENTIONAL=true
  echo "✅ Upstream uses conventional commits (detected $UPSTREAM_CONVENTIONAL/20)"
else
  USE_CONVENTIONAL=false
  echo "ℹ️ Upstream: descriptive titles (detected $UPSTREAM_CONVENTIONAL/20 conventional)"
fi
```

## Step 5: Squash Commits

**CRITICAL: Curt, technical summaries only.**

```bash
git fetch upstream main
UPSTREAM_BASE=upstream/main
COMMIT_COUNT=$(git rev-list --count $UPSTREAM_BASE..HEAD)

if [ "$COMMIT_COUNT" -eq 0 ]; then
  echo "❌ No commits to squash (already synced with upstream)"
  exit 1
fi

echo "📦 Squashing $COMMIT_COUNT commits into one clean commit..."

# Get first commit subject for summary
FIRST_COMMIT_SUBJECT=$(git log --format="%s" $UPSTREAM_BASE..HEAD | tail -1)

# Determine title format based on upstream convention
if [ "$USE_CONVENTIONAL" == "true" ]; then
  # Extract type from first commit if present, else use "feat"
  if echo "$FIRST_COMMIT_SUBJECT" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: '; then
    COMMIT_TITLE=$(echo "$FIRST_COMMIT_SUBJECT" | sed 's/:.*/: [EDIT_THIS]/')
  else
    COMMIT_TITLE="feat: [EDIT_THIS]"
  fi
else
  COMMIT_TITLE="[EDIT_THIS]"
fi

# Create curt commit message
cat > /tmp/squashed-commit.txt <<EOF
$COMMIT_TITLE

Summary of $COMMIT_COUNT commits.

Closes #

Assisted-by: $MODEL_NAME via $TOOL_NAME
EOF

# Perform squash
git reset --soft $UPSTREAM_BASE
git commit -F /tmp/squashed-commit.txt

echo ""
echo "📝 Squashed commit message:"
echo "---"
git log -1 --format="%B"
echo "---"
echo ""
read -p "Edit commit message? (yes/no): " EDIT_MSG

if [ "$EDIT_MSG" == "yes" ]; then
  git commit --amend
fi

echo "✅ Commits squashed into one"
```

**Important notes for agents:**
- Replace `[EDIT_THIS]` with actual description based on changes
- Keep summary curt and technical (2-3 lines max)
- Update issue number in `Closes #` line
- Preserve attribution footer exactly

## Step 6: Push to Fork

```bash
echo "Pushing squashed commit to fork..."

git push -u origin $CURRENT_BRANCH --force-with-lease

if [ $? -ne 0 ]; then
  echo "❌ Push failed. Check git output above."
  echo ""
  echo "To undo squash: git reset --hard origin/$CURRENT_BRANCH"
  exit 1
fi

echo "✅ Pushed to fork: origin/$CURRENT_BRANCH"
```

## Step 7: Pre-Flight Checklist and Command Preview

**Update session state:**
```markdown
UPSTREAM_PR_STATE:
- fork_verified: ✅ true
- tests_verified: ✅ true (or skipped with warning)
- commits_squashed: ✅ true
- command_previewed: [pending]
- using_web_flag: [pending]
```

**Display Pre-Flight Checklist:**

```markdown
Upstream PR Pre-Flight Checklist:
✅ Fork verified: origin → $PARENT_REPO
✅ Tests passed: [result]
✅ Commits squashed: 1 clean commit
✅ Attribution added: Assisted-by footer present
✅ Branch pushed: origin/$CURRENT_BRANCH
→ Ready for browser submission (--web flag)

All checks complete. Preparing command preview...
```

**Show exact command that will execute:**

```bash
FORK_OWNER=$(git remote get-url origin | sed -E 's/.*[:/]([^/]+)\/[^/]+\.git/\1/')
COMMIT_TITLE=$(git log -1 --format="%s")
COMMIT_BODY=$(git log -1 --format="%b")

echo "═══════════════════════════════════════════"
echo "COMMAND PREVIEW - Upstream PR Staging"
echo "═══════════════════════════════════════════"
echo ""
echo "Target: $PARENT_REPO"
echo "Source: $FORK_OWNER:$CURRENT_BRANCH"
echo ""
echo "Title: $COMMIT_TITLE"
echo ""
echo "Body (first 10 lines):"
echo "$COMMIT_BODY" | head -10
echo ""
echo "Command:"
echo "  gh pr create \\"
echo "    --repo $PARENT_REPO \\"
echo "    --head $FORK_OWNER:$CURRENT_BRANCH \\"
echo "    --title \"$COMMIT_TITLE\" \\"
echo "    --body \"...\" \\"
echo "    --web"
echo ""
echo "═══════════════════════════════════════════"
echo "⚠️  This will OPEN YOUR BROWSER"
echo "⚠️  PR will NOT be auto-submitted"
echo "⚠️  You will MANUALLY click 'Create Pull Request'"
echo "═══════════════════════════════════════════"
echo ""
```

**Update session state:**
```markdown
UPSTREAM_PR_STATE:
- command_previewed: ✅ true
- using_web_flag: ✅ true
```

## Step 8: Execute Browser Staging

**CRITICAL: DO NOT AUTO-SUBMIT.**

```bash
echo "Opening browser for PR staging..."

gh pr create \
  --repo $PARENT_REPO \
  --head $FORK_OWNER:$CURRENT_BRANCH \
  --title "$COMMIT_TITLE" \
  --body "$COMMIT_BODY" \
  --web

echo ""
echo "🌐 Browser opened with PR form"
echo "🛑 REVIEW CAREFULLY before submitting"
echo "📋 Update title (remove [EDIT_THIS]), fill issue numbers, add details"
echo "✋ MANUALLY click 'Create Pull Request' when ready"
```

## Step 9: Post-Browser Instructions

```
✅ Upstream PR workflow complete.

Next steps (MANUAL):
1. Review PR form in browser
2. Edit title and description as needed
3. Link issues (update Closes # line)
4. Add reviewers if applicable
5. Click "Create Pull Request"

Your branch remains unchanged locally.

To undo squash (if needed):
  git reset --hard origin/$CURRENT_BRANCH

Or restore from reflog:
  git reflog
  git reset --hard HEAD@{N}
```

## Integration Points

**Calls these skills:**
- Uses `verification-before-completion` principles for test verification
- May invoke `epic-journey-update` if work relates to an epic (via session hooks)

**Called by:**
- `finishing-a-development-branch` skill (Option 3: Submit to upstream)

**Session Hooks:**
- Powerlevel tracks this skill invocation in epic journey
- Updates epic status to `status/review` when invoked

## Common Mistakes to Avoid

### ❌ Verbose Commit Messages

**Don't write:**
```
feat: add cool new feature

This commit adds a really awesome feature that does X, Y, and Z.
It's really useful because it helps users do A, B, and C.
We implemented it using D and E, which are great technologies...
```

**Write:**
```
feat: add feature X

Implements X using Y algorithm. Handles Z edge case.

Closes #123

Assisted-by: Claude Sonnet 4.5 via OpenCode
```

### ❌ Skipping Test Verification

Never skip tests, even if you're confident the code works. Tests must pass.

### ❌ Auto-Submitting PR

NEVER use `gh pr create` without the `--web` flag. Browser must open for manual review.

### ❌ Forgetting Attribution

Every commit MUST include the `Assisted-by:` footer. No exceptions.

### ❌ Multiple Commits

Always squash into ONE commit, even if the commits are already "clean."

## Red Flags - STOP

**If you encounter these, STOP and ask for help:**
- Tests fail repeatedly
- Parent repo not detected (not a fork)
- Upstream remote cannot be added
- Force push fails with lease rejection (someone else pushed)
- Git reflog shows unexpected state

## Quick Reference

| Step | Action | Command |
|------|--------|---------|
| 1 | Verify branch | `git branch --show-current` |
| 2 | Detect tests | Pattern match common files |
| 3 | Run tests | Auto-detected or prompted |
| 4 | Detect model/tool | OpenCode SDK or prompt |
| 5 | Check conventions | Sample 20 PRs from upstream |
| 6 | Squash commits | `git reset --soft && git commit` |
| 7 | Push to fork | `git push --force-with-lease` |
| 8 | Open browser | `gh pr create --web` |

## Troubleshooting

**"Not a fork" error:**
- Use `finishing-a-development-branch` Option 2 instead
- This skill is only for fork → upstream workflow

**Tests not detected:**
- Manually specify test command when prompted
- Agent caches command for future use

**Force push rejected:**
- Someone else pushed to your branch
- Use `git pull --rebase origin $BRANCH` then retry
- Or use `git push --force` (less safe)

**Commit message still has [EDIT_THIS]:**
- Agent should replace this before pushing
- If not replaced, manually edit: `git commit --amend`

## Success Criteria

**Before completing this skill:**
- ✅ Tests pass (or explicitly skipped with warning)
- ✅ Single commit exists on branch
- ✅ Commit includes attribution footer
- ✅ Commit pushed to fork successfully
- ✅ Browser opened with PR form
- ❌ PR NOT auto-submitted

**Agent communication:**
- ✅ Clear status updates at each step
- ✅ Explicit "manual gate" messaging
- ✅ Undo instructions provided
- ❌ Never implies PR was submitted automatically
