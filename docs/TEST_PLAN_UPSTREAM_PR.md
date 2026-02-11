# Test Plan: Upstream PR Workflow

## Overview

Comprehensive testing strategy for the `preparing-upstream-pr` skill and BP-002 implementation.

## Test Environment Setup

### Prerequisites

```bash
# Ensure tools are installed
gh --version
git --version
jq --version

# Verify gh authentication
gh auth status

# Create test fork (if needed)
gh repo fork ublue-os/bluefin --clone=false
```

### Test Repository Setup

**Option A: Use existing fork**
```bash
cd ~/existing-fork
git checkout -b test-upstream-pr
```

**Option B: Create test fork**
```bash
# Fork a small project for testing
gh repo fork castrojo/test-project --clone=true
cd test-project
git checkout -b test-upstream-pr
```

## Test Cases

### TC-001: Happy Path - Fork with Tests

**Objective:** Verify complete workflow from fork to upstream PR preparation

**Setup:**
```bash
cd ~/fork-with-tests
git checkout -b feature/tc-001-happy-path
# Create 3 commits with AI assistance
git commit -m "wip: add feature" --allow-empty
git commit -m "wip: fix tests" --allow-empty
git commit -m "wip: update docs" --allow-empty
```

**Execution:**
```
User: "send this upstream"
```

**Expected Results:**
- ✅ Agent announces: "I'm using the preparing-upstream-pr skill..."
- ✅ Detects fork: Shows parent repo name
- ✅ Upstream remote exists or is added automatically
- ✅ Test command detected (e.g., "just test")
- ✅ Tests run and pass
- ✅ Model/tool auto-detected (e.g., "Claude Sonnet 4.5 via OpenCode")
- ✅ Upstream conventional commit usage detected (shows count/20)
- ✅ 3 commits squashed into 1
- ✅ Commit message shown with attribution footer
- ✅ Prompt: "Edit commit message? (yes/no)"
- ✅ Push succeeds with `--force-with-lease`
- ✅ Browser opens with PR form
- ✅ Message: "REVIEW CAREFULLY before submitting"
- ❌ PR NOT auto-submitted (verify via `gh pr list`)

**Verification:**
```bash
# Check commit count
git log upstream/main..HEAD --oneline | wc -l
# Should be: 1

# Check commit message format
git log -1 --format="%B"
# Should contain: "Assisted-by: [Model] via [Tool]"

# Check PR not created
gh pr list --head $(git branch --show-current)
# Should be: empty (no PRs)

# Check branch pushed to fork
git branch -vv
# Should show: upstream tracking on origin
```

### TC-002: Not a Fork

**Objective:** Verify error handling for non-fork repositories

**Setup:**
```bash
cd ~/non-fork-repo
git checkout -b feature/tc-002-not-fork
```

**Execution:**
```
User: "send this upstream"
```

**Expected Results:**
- ❌ Error: "This is not a fork. Cannot proceed with upstream PR."
- ❌ Suggests: "Use 'finishing-a-development-branch' Option 2 for same-repo PR."
- ❌ Workflow stops (no squash, no push, no browser)

### TC-003: Tests Fail

**Objective:** Verify workflow stops when tests fail

**Setup:**
```bash
cd ~/fork-with-tests
git checkout -b feature/tc-003-failing-tests
# Commit code that breaks tests (or temporarily break test command)
echo "exit 1" > test.sh && chmod +x test.sh
git commit -am "break tests"
```

**Execution:**
```
User: "send this upstream"
```

**Expected Results:**
- ✅ Test command detected
- ✅ Tests run
- ❌ Tests fail (exit code non-zero)
- ❌ Error: "Tests failed. Fix before upstream submission."
- ❌ Workflow stops (no squash, no push)
- ✅ Instructions provided: "After fixing, run: [test command]"

### TC-004: No Test Command Detected

**Objective:** Verify fallback when test command not found

**Setup:**
```bash
cd ~/fork-no-standard-tests
git checkout -b feature/tc-004-no-tests
# Repository with no package.json, Justfile, Makefile, etc.
```

**Execution:**
```
User: "send this upstream"
```

**Expected Results:**
- ⚠️ Warning: "Could not detect test command."
- ❓ Prompt: "Enter test command (or 'skip' to skip tests): "
- ✅ User enters command or "skip"
- ✅ If command entered: cached in `.opencode/project-config.json`
- ✅ Workflow continues

**Verification:**
```bash
# If test command entered
cat .opencode/project-config.json
# Should contain: {"testCommand": "..."}
```

### TC-005: Main Branch Protection

**Objective:** Verify workflow prevents PR from main/master branch

**Setup:**
```bash
cd ~/fork-project
git checkout main
```

**Execution:**
```
User: "send this upstream"
```

**Expected Results:**
- ❌ Error: "Cannot create PR from main/master branch."
- ❌ Suggests: "Create a feature branch first: git checkout -b feature/your-feature"
- ❌ Workflow stops

### TC-006: Conventional Commits Detection

**Objective:** Verify upstream convention detection

**Setup A: Upstream uses conventional commits**
```bash
cd ~/fork-of-conventional-project
git checkout -b feature/tc-006-conventional
```

**Expected Results:**
- ✅ Message: "Upstream uses conventional commits (detected N/20)"
- ✅ Commit title format: `feat: [EDIT_THIS]` or similar

**Setup B: Upstream doesn't use conventional commits**
```bash
cd ~/fork-of-descriptive-project
git checkout -b feature/tc-006-descriptive
```

**Expected Results:**
- ℹ️ Message: "Upstream: descriptive titles (detected N/20 conventional)"
- ✅ Commit title format: `[EDIT_THIS]`

### TC-007: Attribution Auto-Detection

**Objective:** Verify model/tool detection from session

**Execution:**
```
User: "send this upstream"
```

**Expected Results:**
- ✅ Model detected from OpenCode session
- ✅ Tool detected from OpenCode session
- ✅ Attribution footer: `Assisted-by: [Model] via [Tool]`

**If detection fails:**
- ❓ Prompt: "Model name (e.g., Claude Sonnet 4.5): "
- ❓ Prompt: "Tool name (e.g., OpenCode): "

### TC-008: Epic Journey Integration

**Objective:** Verify Powerlevel epic tracking

**Setup:**
```bash
cd ~/powerlevel-tracked-fork
# Ensure epic #123 exists and is linked to current work
git checkout -b feature/tc-008-epic
```

**Execution:**
```
User: "send this upstream"
```

**Expected Results:**
- ✅ Session hook detects skill invocation
- ✅ Epic #123 status updated to `status/review`
- ✅ Journey event added: "Preparing upstream pull request..."
- ✅ Epic marked dirty for sync

**Verification:**
```bash
# Check cache
cat cache/$(md5sum <<< "owner/repo" | cut -d' ' -f1)/state.json | jq '.epics["123"]'
# Should show: status/review, journey event, dirty=true
```

### TC-009: Ambiguous Invocation

**Objective:** Verify agent prompts on unclear phrases

**Execution:**
```
User: "maybe submit this?"
```

**Expected Results:**
- ❓ Prompt: "Did you want to submit this to upstream? (yes/no)"
- ✅ If yes: Workflow proceeds
- ❌ If no: Workflow stops

### TC-010: Force Push Rejection

**Objective:** Verify handling of force push conflicts

**Setup:**
```bash
cd ~/fork-project
git checkout -b feature/tc-010-force-conflict
# Push initial version
git push -u origin feature/tc-010-force-conflict
# Simulate remote change
gh api repos/castrojo/project/git/refs/heads/feature/tc-010-force-conflict \
  -X PATCH -f sha=<different-sha>
```

**Execution:**
```
User: "send this upstream"
```

**Expected Results:**
- ✅ Squash completes
- ❌ Push fails: "Push failed. Someone else may have pushed to your branch."
- ✅ Suggestions provided:
  - `git pull --rebase origin $BRANCH`
  - `git push --force` (less safe)
- ✅ Undo instructions: `git reset --hard origin/$BRANCH`

### TC-011: Undo Squash

**Objective:** Verify undo instructions work

**Setup:**
```bash
cd ~/fork-project
git checkout -b feature/tc-011-undo
# Create multiple commits
for i in {1..3}; do git commit -m "commit $i" --allow-empty; done
# Record original state
ORIGINAL_HEAD=$(git rev-parse HEAD)
```

**Execution:**
```
User: "send this upstream"
# After squash, user decides to undo
```

**Undo:**
```bash
git reset --hard origin/feature/tc-011-undo
```

**Verification:**
```bash
# Check commits restored
git log --oneline | head -3
# Should show: 3 original commits

git rev-parse HEAD
# Should equal: $ORIGINAL_HEAD
```

### TC-012: Curt vs Verbose Commit Messages

**Objective:** Verify commit message quality

**Test A: Verbose (should be rejected)**
```
feat: add cool new feature

This commit adds a really awesome feature that does X, Y, and Z.
It's really useful because it helps users do A, B, and C.
We implemented it using D and E...
```

**Test B: Curt (should be approved)**
```
feat: add feature X

Implements X using Y algorithm. Handles Z edge case.

Closes #123

Assisted-by: Claude Sonnet 4.5 via OpenCode
```

**Expected:**
- ✅ Agent generates curt message (Test B style)
- ❌ Agent never generates verbose message (Test A style)

## Integration Tests

### IT-001: finishing-a-development-branch Integration

**Objective:** Verify Option 3 invokes preparing-upstream-pr

**Note:** Requires manual update to system skill (see docs/MANUAL_UPDATE_FINISHING_BRANCH.md)

**Execution:**
```
User: "I'm done with this work"
# Agent presents options
User: "3"  # Submit to upstream
```

**Expected Results:**
- ✅ Fork detection runs
- ✅ If fork: preparing-upstream-pr skill invoked
- ❌ If not fork: Error message shown

### IT-002: Session Hook Detection

**Objective:** Verify session hooks detect skill patterns

**Test phrases:**
- "using the preparing-upstream-pr skill"
- "send this upstream"
- "submit to upstream"
- "ready for upstream"
- "create upstream PR"

**Expected for each:**
- ✅ Session hook fires
- ✅ Skill invocation logged
- ✅ Epic status updated (if epic exists)

## Performance Tests

### PT-001: Large Commit History

**Setup:**
```bash
git checkout -b feature/pt-001-large-history
for i in {1..100}; do git commit -m "commit $i" --allow-empty; done
```

**Expected:**
- ✅ Squash completes in <5 seconds
- ✅ Single commit created
- ✅ No memory issues

### PT-002: Slow Test Suite

**Setup:**
```bash
# Mock slow test
echo "sleep 30 && exit 0" > test.sh
```

**Expected:**
- ✅ Tests run to completion (30 seconds)
- ✅ Agent waits for test result
- ✅ Workflow continues after tests pass

## Security Tests

### ST-001: Force Push Safety

**Objective:** Verify `--force-with-lease` prevents data loss

**Expected:**
- ✅ Uses `--force-with-lease` (not `--force`)
- ✅ Rejects push if remote changed
- ✅ Provides safe recovery instructions

### ST-002: No Auto-Submit

**Objective:** Verify PR never auto-submitted

**Expected:**
- ❌ NEVER uses `gh pr create` without `--web`
- ✅ ALWAYS opens browser
- ❌ NEVER creates PR via API call

## Test Execution Matrix

| TC | Fork | Tests | Conventional | Result |
|----|------|-------|--------------|--------|
| TC-001 | ✅ | Pass | ✅ | Success |
| TC-002 | ❌ | N/A | N/A | Error |
| TC-003 | ✅ | Fail | N/A | Stops |
| TC-004 | ✅ | None | N/A | Prompts |
| TC-005 | ✅ | N/A | N/A | Error |
| TC-006A | ✅ | Pass | ✅ | Success |
| TC-006B | ✅ | Pass | ❌ | Success |
| TC-007 | ✅ | Pass | ✅ | Success |
| TC-008 | ✅ | Pass | ✅ | Success + Epic |
| TC-009 | ✅ | Pass | ✅ | Prompts |
| TC-010 | ✅ | Pass | ✅ | Push fails |
| TC-011 | ✅ | Pass | ✅ | Undo works |
| TC-012 | ✅ | Pass | ✅ | Curt message |

## Success Criteria

**All test cases must:**
- ✅ Complete without crashes
- ✅ Show clear error messages on failure
- ✅ Provide recovery instructions
- ❌ NEVER auto-submit PRs

**Critical tests (must pass):**
- TC-001: Happy path works end-to-end
- TC-002: Non-fork detection prevents errors
- TC-003: Test failures stop workflow
- ST-002: No auto-submit (CRITICAL)

## Test Reporting

**Report format:**
```
Test Case: TC-XXX
Status: PASS / FAIL / SKIP
Duration: X seconds
Notes: [Any observations]
Issues: [Link to GitHub issues if failures]
```

## Automated Testing (Future)

**Potential automation:**
- Jest/Vitest tests for detection functions
- Mock `gh` CLI responses
- CI pipeline for regression testing
- Integration with Powerlevel test suite

**Not automatable:**
- Browser opening (manual verification required)
- Interactive prompts (requires human input)
- Session metadata detection (OpenCode-specific)
