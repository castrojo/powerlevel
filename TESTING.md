# Testing Session Title Display Feature

## Test Setup Complete ✅

The session title display feature has been implemented and is ready for live testing!

## What Was Built

### New Files Created:
1. **`lib/epic-detector.js`** - Detects epic from branch name, formats multi-line titles
2. **`lib/session-title-updater.js`** - Updates OpenCode session titles via SDK

### Modified Files:
1. **`plugin.js`** - Added event hooks for `session.created`, `session.idle`, and `session.compacting`

## How It Works

When you start an OpenCode session on a branch named like `epic-100-test-feature`, the plugin will:

1. **Detect the epic number** from the branch name (100)
2. **Load epic details** from cache (title, goal, labels, sub-tasks)
3. **Format a 3-line title**:
   - Line 1: `#100 - Epic Title`
   - Line 2: `[backend, frontend, ui] ▓▓▓▓░░░░ (2/4)`
   - Line 3: `Full description of the epic goal...`
4. **Update the OpenCode session title** to display this info

## Test Results

### ✅ Branch Detection
- Tested with branch `epic-100-test-feature`
- Successfully detected epic number: **100**

### ✅ Epic Loading
- Successfully loaded epic #100 from cache
- Retrieved: title, goal, labels, sub-tasks

### ✅ Title Formatting
**With full data:**
```
#100 - Session Title Epic Display Feature
[backend, frontend, ui] ▓▓▓▓░░░░ (2/4)
Show epic name and description prominently in OpenCode task title with labels and progress bar
```

**With missing data (Cryptarch placeholders):**
```
#999 - Minimal Epic
[Awaiting classification...] ▓▓▓░░░░░ (1/3)
Goal undefined - destiny awaits
```

## How to Test in Real OpenCode

### 1. Ensure you're on an epic branch:
```bash
git checkout epic-100-test-feature
```

### 2. Start OpenCode:
```bash
opencode
```

### 3. Check the title bar:
Look at the top of the OpenCode TUI. You should see the 3-line title:
- GitHub issue # (#100)
- Labels and progress bar
- Epic description

### 4. Test session.idle event:
Wait for the session to go idle (or complete a task). The title should update automatically when tasks are completed.

### 5. Test with different branch names:
```bash
# These should all work:
git checkout epic-123
git checkout epic/456
git checkout feature/epic-789
git checkout 234-some-feature

# These should NOT trigger (no epic title):
git checkout main
git checkout bugfix-something
```

## Supported Branch Patterns

The epic detector supports these branch naming patterns:
- `epic-123`
- `epic/123`
- `feature/epic-123`
- `123-feature-name`

## Features Included

✅ **Multi-line title** - 3 lines with full context  
✅ **GitHub issue # prominent** - Always first element  
✅ **Domain labels** - Shows backend, frontend, api, etc.  
✅ **Visual progress bar** - 8-block bar: `▓▓▓▓░░░░`  
✅ **Task fraction** - Exact count: `(2/4)`  
✅ **Full description** - No truncation (up to 150 chars)  
✅ **Cryptarch placeholders** - Destiny-inspired missing data messages  
✅ **Auto-update on idle** - Refreshes when session goes idle  
✅ **Compaction context** - Re-injects epic info during compaction  

## Troubleshooting

### Title not showing?
- Check you're on a branch with epic number in name
- Check the epic exists in cache: `ls cache/*/state.json`
- Check plugin loaded: look for "✓ Powerlevel plugin initialized"

### Labels not showing?
- Epic must have labels in GitHub
- Check cache has labels: `cat cache/afcc6ad46e886fda/state.json`

### Progress bar not accurate?
- Sub-tasks must be in cache
- Check task states: `closed` = complete, `open` = incomplete

## Next Steps

To see this in action:
1. Start a new OpenCode session in this directory
2. The title should automatically update
3. Try completing a task and watch it update on idle

**Ready to ship! 🚀**
