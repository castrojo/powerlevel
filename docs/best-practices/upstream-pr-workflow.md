# BP-002: Upstream Pull Request Workflow

**Status:** Active  
**Enforcement:** Agent-Guided  
**Applies To:** Fork-based contribution workflows

## Overview

Guidelines for submitting clean, single-commit pull requests from fork to upstream.

**Core Principle:** "Pristine PRs from sloppy forks"

Work freely in your fork with AI assistance, then prepare a polished single commit for upstream submission.

## Remote Convention

All fork workflows use this standard:

- `origin` = Your fork (e.g., castrojo/project)
- `upstream` = Original project (e.g., org/project)

## Requirements

### MUST Requirements

1. **Single Commit:** Squash all work into one clean commit before submission
2. **Attribution:** Include `Assisted-by: [Model] via [Tool]` in commit footer
3. **Tests Pass:** Run full test suite and verify pass before push
4. **Manual Submission:** Browser opens with PR form, human reviews and manually submits

### SHOULD Requirements

1. **Conventional Commits:** Use if upstream project uses them (auto-detected)
2. **Curt Summaries:** Technical, direct, time-respecting commit messages
3. **Issue References:** Link related issues in commit body with `Closes #N`

### MAY Requirements

1. **Branch Naming:** Follow upstream conventions (if documented)
2. **PR Template:** Fill additional fields if upstream provides template

## Workflow Steps

### 1. Verify Fork Setup

Ensure remotes are correctly configured:

```bash
git remote -v

# Expected output:
# origin    git@github.com:castrojo/project.git
# upstream  git@github.com:org/project.git
```

If `upstream` remote is missing, agent will auto-detect parent repo and add it.

### 2. Run Tests

Agent auto-detects test command using this priority order:

1. `package.json` → `npm test`
2. `Justfile` → `just test` or `just check`
3. `Makefile` → `make test`
4. `pytest.ini` or `pyproject.toml` → `pytest`
5. `go.mod` → `go test ./...`
6. `Cargo.toml` → `cargo test`

If no test command detected, agent prompts for command or skip option.

**Tests must pass before proceeding.** No exceptions.

### 3. Detect Conventions

**Conventional Commits Detection:**

Agent samples 20 most recent merged PRs from upstream. If 10+ use conventional commit format, agent enforces it for your PR.

**Format detected:**
- `feat(scope): description` - New feature
- `fix(scope): description` - Bug fix
- `docs(scope): description` - Documentation
- `refactor(scope): description` - Code refactoring
- `test(scope): description` - Test changes
- `chore(scope): description` - Maintenance

If upstream doesn't use conventional commits, use descriptive title.

### 4. Squash Commits

All commits on your branch are squashed into a single commit.

**Commit Message Format:**

```
type(scope): brief technical description

Curt summary of changes. No verbose explanations.

Closes #123

Assisted-by: Claude Sonnet 4.5 via OpenCode
```

**Examples:**

✅ **Good (curt, technical):**
```
feat(api): add user authentication endpoint

Implements JWT-based auth with refresh tokens.
Adds middleware for token validation.

Closes #45

Assisted-by: Claude Sonnet 4.5 via OpenCode
```

❌ **Bad (verbose):**
```
feat(api): add user authentication endpoint

This commit adds a really cool new user authentication system
that we've been working on. It uses JWT tokens which are great
for security and also includes refresh tokens so users don't
have to log in all the time. The middleware checks if the token
is valid before allowing access to protected routes...

Closes #45

Assisted-by: Claude Sonnet 4.5 via OpenCode
```

### 5. Push to Fork

Agent pushes squashed commit to your fork using `--force-with-lease` (safe force push).

```bash
git push -u origin feature-branch --force-with-lease
```

### 6. Open Browser for Manual Submission

**CRITICAL SAFETY GATE:**

Agent opens browser with GitHub PR creation form pre-filled:
- Title from commit message
- Body from commit description
- Head: your-fork:branch
- Base: upstream:main

**Agent NEVER submits the PR automatically.**

You review, edit, and manually click "Create Pull Request."

### 7. Post-Submission

After manual submission, your local branch remains unchanged. You can:
- Continue working in the branch
- Delete the branch locally
- Create additional PRs from the same branch

## Auto-Detection Logic

### Model and Tool Detection

Agent attempts to detect from OpenCode session metadata:
- Model name: e.g., "Claude Sonnet 4.5", "GPT-4"
- Tool name: e.g., "OpenCode", "Cursor", "GitHub Copilot"

If detection fails, agent prompts for manual input.

### Test Command Detection

Pattern matching checks for common test configurations:

| File | Command |
|------|---------|
| package.json with test script | npm test |
| Justfile with test: recipe | just test |
| Justfile with check: recipe | just check |
| Makefile with test: target | make test |
| pytest.ini or pyproject.toml | pytest |
| go.mod | go test ./... |
| Cargo.toml | cargo test |

Agent caches detected command in `.opencode/project-config.json` for future use.

### Conventional Commit Detection

```bash
# Sample 20 recent PRs
gh pr list --repo upstream/project --state merged --limit 20 --json title

# Count conventional commit matches
grep -cE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: '

# If 10+ matches → enforce conventional commits
```

## Manual Gate Enforcement

**Why the manual gate exists:**

1. **Final review catch-all** - Catch any issues before upstream sees them
2. **Title/description refinement** - Polish wording, add context
3. **Issue linking** - Verify correct issue references
4. **Human accountability** - You own the PR, not the AI

**The agent will:**
- ✅ Open browser with pre-filled PR form
- ✅ Display message: "Review carefully before submitting"
- ✅ Wait for your manual submission

**The agent will NEVER:**
- ❌ Submit the PR via API
- ❌ Use `gh pr create` without `--web` flag
- ❌ Bypass your review

## Recovery and Undo

### Undo Squash

If you need to restore original commits after squash:

```bash
# Reset to remote branch state (before squash)
git reset --hard origin/your-branch

# Or if you didn't push before squash
git reflog
git reset --hard HEAD@{N}  # Where N is pre-squash state
```

### Abandoned PR

If you decide not to submit the PR:

```bash
# Just close the browser tab
# Your branch remains unchanged locally
# No cleanup needed unless you want to delete branch
```

## Integration with Powerlevel

When this workflow is invoked in a tracked project:

1. **Epic Detection:** If work relates to an epic, status updates to `status/review`
2. **Journey Tracking:** Skill invocation recorded in epic journey
3. **Session Hooks:** Powerlevel tracks PR preparation milestone

## Common Mistakes

### ❌ Verbose Commit Messages

**Wrong:**
```
feat: add really cool new feature

This commit adds a brand new feature that does X, Y, and Z.
It's really useful because...
```

**Right:**
```
feat: add feature X

Implements X with Y algorithm. Handles Z edge case.
```

### ❌ Skipping Tests

**Never skip test verification** - even if "it should work."

### ❌ Auto-Submitting PR

**No shortcuts on the manual gate** - always review in browser.

### ❌ Multiple Commits

**Always squash into one** - even if commits are "clean."

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub PR Best Practices](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests)
- [Git Force Push Safety](https://git-scm.com/docs/git-push#Documentation/git-push.txt---force-with-leaseltrefnamegt)

## Examples

### Complete Workflow Example

```bash
# Starting state: 5 commits on feature branch in fork
git log --oneline
# a1b2c3d wip: fix bug
# d4e5f6g wip: add tests
# g7h8i9j wip: update docs
# j0k1l2m wip: refactor
# m3n4o5p feat: initial implementation

# User triggers workflow
"send this upstream"

# Agent workflow:
✅ Fork detected: upstream = ublue-os/bluefin
✅ Running tests: just test
✅ Tests pass (34/34)
✅ Upstream uses conventional commits
✅ Auto-detected: Claude Sonnet 4.5 via OpenCode
📦 Squashing 5 commits...
📝 Commit message:

feat(system): add automatic update notifications

Implements desktop notifications for system updates.
Uses systemd timer for daily checks.

Closes #234

Assisted-by: Claude Sonnet 4.5 via OpenCode

❓ Edit commit message? (yes/no): no
✅ Pushed to fork: origin/feature-update-notifications
🌐 Browser opened with PR form
🛑 REVIEW CAREFULLY before submitting

# User reviews in browser, clicks "Create Pull Request"
# Done!
```

## Changelog

- 2026-02-10: Initial version (BP-002)
