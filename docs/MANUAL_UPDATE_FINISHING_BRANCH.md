# Manual Update Required: finishing-a-development-branch Skill

## Location

**File:** `/var/home/jorge/.config/opencode/skills/superpowers/finishing-a-development-branch/SKILL.md`

**This is a system-level Superpowers skill** that needs manual update to integrate with the new `preparing-upstream-pr` skill.

## Required Changes

### Change 1: Update Step 3 Options (Line ~78)

**Current:**
```markdown
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
```

**Update to:**
```markdown
### Step 3: Present Options

Present exactly these 5 options:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request (same repo)
3. Submit to upstream (for forks)
4. Keep the branch as-is (I'll handle it later)
5. Discard this work

Which option?
```
```

### Change 2: Add Option 3 Handler (After Line ~151)

**Insert after "Option 2: Push and Create PR" section:**

```markdown
#### Option 3: Submit to Upstream

**Check if fork:**
```bash
PARENT_REPO=$(gh repo view --json parent -q '.parent.nameWithOwner')

if [ -n "$PARENT_REPO" ]; then
  echo "✅ Fork detected: $PARENT_REPO"
  echo "Using preparing-upstream-pr skill..."
  # Use preparing-upstream-pr skill
else
  echo "❌ This is not a fork."
  echo "Use Option 2 for same-repo PR instead."
  exit 1
fi
```

**Invoke `preparing-upstream-pr` skill.**

The skill will:
- Squash all commits into one
- Add attribution footer
- Run tests
- Push to fork
- Open browser for manual PR submission

Then: Ask user if PR was submitted successfully before cleanup.

If user confirms submission:
- Cleanup worktree (Step 5)
- Branch remains on fork for PR tracking
```

### Change 3: Update Quick Reference Table (Line ~201)

**Current:**
```markdown
| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | ✓ | - | - | ✓ |
| 2. Create PR | - | ✓ | ✓ | - |
| 3. Keep as-is | - | - | ✓ | - |
| 4. Discard | - | - | - | ✓ (force) |
```

**Update to:**
```markdown
| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | ✓ | - | - | ✓ |
| 2. Create PR (same repo) | - | ✓ | ✓ | - |
| 3. Submit upstream | - | ✓ (fork) | ✓ | - |
| 4. Keep as-is | - | - | ✓ | - |
| 5. Discard | - | - | - | ✓ (force) |
```

### Change 4: Update Integration Section (End of file)

**Add to "Pairs with:" section:**

```markdown
**Pairs with:**
- **using-git-worktrees** - Cleans up worktree created by that skill
- **preparing-upstream-pr** - Option 3 invokes this skill for fork → upstream workflow
```

## Why Manual Update Required

The `finishing-a-development-branch` skill is located in:
```
/var/home/jorge/.config/opencode/skills/superpowers/
```

This is the **system-level Superpowers skills directory**, not the Powerlevel project directory. 

Modifying system skills requires:
1. Proper permissions (user config directory)
2. Testing across all projects that use Superpowers
3. Coordination with Superpowers maintainers (if applicable)

## Testing After Update

Once updated, test the integration:

1. **Fork workflow:**
   ```bash
   cd ~/fork-project
   git checkout -b feature/test
   # Make commits
   "I'm done with this work"
   # Choose Option 3: Submit to upstream
   # Verify: preparing-upstream-pr skill invoked
   ```

2. **Non-fork workflow:**
   ```bash
   cd ~/regular-project
   git checkout -b feature/test
   # Make commits
   "I'm done with this work"
   # Choose Option 2: Create PR (same repo)
   # Verify: Regular PR flow works
   ```

3. **Fork detection in Option 3:**
   ```bash
   cd ~/regular-project
   # Choose Option 3: Submit to upstream
   # Verify: Error message "This is not a fork"
   ```

## Alternative: Skip System Skill Update

If you prefer NOT to modify the system skill, the workflow still works:

**Users can directly invoke the skill:**
```
"send this upstream"  # Triggers preparing-upstream-pr directly
```

**Powerlevel session hooks will still:**
- Detect skill invocation
- Update epic status
- Track journey events

The only difference: Option 3 won't appear in `finishing-a-development-branch` menu.

## Implementation Status

- ✅ **Powerlevel integration complete** - All Powerlevel-side code ready
- ⏸️ **Superpowers skill update pending** - Manual update required (optional)

The `preparing-upstream-pr` skill is **fully functional** and can be invoked directly without the `finishing-a-development-branch` integration.
