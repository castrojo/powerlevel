# AGENTS.md - Preparing Upstream PR Skill

## Purpose

Guide agents through preparing pristine single-commit pull requests from fork to upstream projects.

## For AI Agents Working with This Skill

When a user says any variation of "send this upstream", "submit to upstream", "create upstream PR", or "ready for upstream", you MUST invoke this skill.

## Critical Rules

### 1. NEVER Auto-Submit PR

**THE IRON LAW:** The skill MUST stop at opening the browser. NEVER submit the PR via API.

```bash
# ✅ CORRECT - Opens browser for manual review
gh pr create --web

# ❌ WRONG - Auto-submits PR
gh pr create
```

**Why:** User must manually review and submit. This is non-negotiable.

### 2. Always Squash to One Commit

All work on the branch MUST be squashed into a single commit before pushing to fork.

**No exceptions.** Even if commits are already "clean."

### 3. Curt, Technical Summaries

Commit messages MUST be brief and technical.

**Bad (verbose):**
```
This commit adds a new feature that allows users to do X.
It's really useful because it solves problem Y.
We implemented it using technology Z...
```

**Good (curt):**
```
Implements X using Y algorithm. Handles Z edge case.
```

### 4. Auto-Detect Everything

**Don't prompt unless detection fails:**

- Test commands: Check package.json, Justfile, Makefile, pytest.ini, go.mod, Cargo.toml
- Model/Tool: Read from OpenCode session metadata
- Conventional commits: Sample 20 recent PRs from upstream

**Prompt only when:**
- Test command not found in common patterns
- Model/tool not in session metadata
- User explicitly asked to skip auto-detection

### 5. Prompt on Ambiguous Invocation

If user's phrase is unclear, confirm intent:

```
User: "maybe send this?"
Agent: "Did you want to submit this to upstream? (yes/no)"
```

**Clear invocations (no prompt needed):**
- "send this upstream"
- "submit to upstream"
- "create upstream PR"
- "ready for upstream"

## Workflow Verification Checklist

**Before squashing:**
- [ ] Verified this is a fork (has parent repo)
- [ ] Verified not on main/master branch
- [ ] Detected or prompted for test command
- [ ] Tests pass (or explicitly skipped with warning)
- [ ] Upstream remote exists (or added automatically)

**After squashing:**
- [ ] Single commit exists
- [ ] Commit message is curt and technical
- [ ] Attribution footer present: `Assisted-by: [Model] via [Tool]`
- [ ] User confirmed or edited commit message

**After push:**
- [ ] Push succeeded with `--force-with-lease`
- [ ] Browser opened with `gh pr create --web`
- [ ] Clear messaging: "REVIEW CAREFULLY before submitting"
- [ ] Undo instructions provided

**Never:**
- [ ] Skip test verification (unless user explicitly skips)
- [ ] Auto-submit PR
- [ ] Use verbose commit messages
- [ ] Forget attribution footer

## Common Agent Mistakes

### Mistake 1: Verbose Summaries

**Problem:** Agent writes long explanatory commit messages.

**Fix:** Keep summaries to 1-3 technical sentences. No storytelling.

### Mistake 2: Skipping Test Verification

**Problem:** Agent assumes tests will pass without running them.

**Fix:** Always run tests before proceeding. Use `verification-before-completion` principles.

### Mistake 3: Auto-Submitting PR

**Problem:** Agent uses `gh pr create` without `--web` flag.

**Fix:** ALWAYS include `--web` flag. ALWAYS print "manual gate" messaging.

### Mistake 4: Not Handling Detection Failures

**Problem:** Agent fails silently when test command not found.

**Fix:** Prompt user for test command, cache the response.

### Mistake 5: Guessing User Intent

**Problem:** Agent assumes ambiguous phrases mean "submit upstream."

**Fix:** When uncertain, prompt: "Did you want to submit this to upstream?"

## Detection Logic Details

### Test Command Detection

Check files in this order:

1. **package.json** with `scripts.test` → `npm test`
2. **Justfile** with `test:` recipe → `just test`
3. **Justfile** with `check:` recipe → `just check`
4. **Makefile** with `test:` target → `make test`
5. **pytest.ini** or **pyproject.toml** → `pytest`
6. **go.mod** → `go test ./...`
7. **Cargo.toml** → `cargo test`

If none found: Prompt user, cache in `.opencode/project-config.json`

### Model/Tool Detection

**Preferred:** Read from OpenCode session metadata

```javascript
const model = session.model || "UNKNOWN";
const tool = session.tool || "OpenCode";
```

**Fallback:** Environment variables
```bash
MODEL_NAME="${OPENCODE_MODEL:-UNKNOWN}"
TOOL_NAME="${OPENCODE_TOOL:-OpenCode}"
```

**Last resort:** Prompt user

### Conventional Commits Detection

```bash
# Sample 20 recent merged PRs
MATCHES=$(gh pr list --repo $PARENT_REPO --state merged --limit 20 --json title | \
  jq -r '.[].title' | \
  grep -cE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: ')

# If 10+ matches (50%+), enforce conventional commits
if [ "$MATCHES" -ge 10 ]; then
  USE_CONVENTIONAL=true
fi
```

## Integration with Powerlevel

### Session Hooks

When this skill is invoked, Powerlevel session hooks:

1. Detect skill invocation pattern
2. Find active epic (if exists)
3. Update epic status to `status/review`
4. Add journey event: "Preparing upstream pull request"
5. Mark epic as dirty for sync

### Epic Detection

Check for epic references in:
- Recent commit messages (search for `epic #N`)
- Plan files referenced in commits
- Epic labels in cache

## Error Handling

### Not a Fork

```bash
if [ -z "$PARENT_REPO" ]; then
  echo "❌ This is not a fork. Cannot proceed with upstream PR."
  echo "Use 'finishing-a-development-branch' Option 2 for same-repo PR."
  exit 1
fi
```

### Tests Fail

```bash
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Fix before upstream submission."
  echo "After fixing, run: $TEST_CMD"
  exit 1
fi
```

### On Main/Master Branch

```bash
if [[ "$CURRENT_BRANCH" =~ ^(main|master)$ ]]; then
  echo "❌ Cannot create PR from main/master branch."
  echo "Create a feature branch first: git checkout -b feature/your-feature"
  exit 1
fi
```

### Force Push Rejected

```bash
if [ $? -ne 0 ]; then
  echo "❌ Push failed. Someone else may have pushed to your branch."
  echo "Try: git pull --rebase origin $CURRENT_BRANCH"
  echo "Or: git push --force (less safe)"
  echo ""
  echo "To undo squash: git reset --hard origin/$CURRENT_BRANCH"
  exit 1
fi
```

## Success Criteria for Agents

**Agent completes this skill successfully when:**

✅ **All prerequisites verified:**
- Fork detected
- Not on main/master
- Upstream remote exists

✅ **Tests handled properly:**
- Test command detected or prompted
- Tests run and pass (or explicitly skipped)

✅ **Squashing executed correctly:**
- Single commit created
- Commit message is curt and technical
- Attribution footer present

✅ **Push successful:**
- Used `--force-with-lease`
- Push completed without errors

✅ **Manual gate enforced:**
- Browser opened with `gh pr create --web`
- Clear messaging about manual review
- Undo instructions provided

✅ **NO auto-submission:**
- PR not created via API
- User must manually click submit

## Red Flags - When to Stop and Ask

**STOP executing immediately if:**

1. **Parent repo not detected** - Might not be a fork
2. **Tests fail repeatedly** - Code issue needs fixing
3. **Force push keeps rejecting** - Conflict with remote
4. **User says "wait" or "stop"** - Always respect user control

**Don't force through these situations.** Ask for help.

## Code Review Notes for Skill Maintainers

**When reviewing changes to this skill:**

1. Verify `--web` flag present in all `gh pr create` calls
2. Check that test verification is not skipped without warning
3. Ensure commit message format enforces curt style
4. Confirm attribution footer is always added
5. Validate error handling for all detection failures

**Test scenarios:**
- Fork with tests
- Fork without tests
- Non-fork repo (should error)
- Main branch (should error)
- Test failures (should stop)
- Multiple conventional commit patterns

## Related Skills

**This skill integrates with:**

- **finishing-a-development-branch** - Calls this skill as Option 3
- **verification-before-completion** - Principles used for test verification
- **epic-journey-update** - Called via session hooks if epic exists

**This skill is called by:**

- User direct invocation: "send this upstream"
- finishing-a-development-branch Option 3: "Submit to upstream"

## Architecture Notes

### File Structure

```
skills/preparing-upstream-pr/
├── SKILL.md       # Main skill instructions (you are here)
└── AGENTS.md      # Agent-specific guidance (this file)
```

### Skill Metadata

```yaml
name: preparing-upstream-pr
description: Use when user wants to submit work to upstream - squashes commits, adds attribution, verifies tests, pushes to fork, opens browser for manual submission
```

### Detection Patterns

Registered in `lib/session-hooks.js`:

```javascript
'preparing-upstream-pr': [
  /using the preparing-upstream-pr skill/i,
  /send.*upstream/i,
  /submit.*upstream/i,
  /ready for upstream/i,
  /create upstream pr/i,
  /upstream pull request/i
]
```

## Future Enhancements

**Planned improvements:**

1. **PR Template Support** - Auto-fill from `.github/PULL_REQUEST_TEMPLATE.md`
2. **Multi-Remote Detection** - Handle multiple upstreams
3. **Branch Naming Validation** - Check against upstream conventions
4. **Commit Message Linting** - Validate conventional commit format
5. **Automated Testing** - Run test suite in CI before opening browser

## Debugging

**If skill behavior is unexpected:**

1. Check if fork is properly detected:
   ```bash
   gh repo view --json parent -q '.parent.nameWithOwner'
   ```

2. Verify upstream remote:
   ```bash
   git remote -v | grep upstream
   ```

3. Check test command detection:
   ```bash
   cat .opencode/project-config.json
   ```

4. Verify session metadata availability (for model/tool detection)

5. Check if `gh` CLI is authenticated:
   ```bash
   gh auth status
   ```

## Questions for Skill Users

**If you encounter issues:**

1. Did the browser open with the PR form?
2. Was the commit message curt and technical?
3. Did tests run before squashing?
4. Was attribution footer included?
5. Did the agent try to auto-submit?

**Report issues:** Include answers to above questions.
