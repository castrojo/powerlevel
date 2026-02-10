# Task Completion Detector

Automatically detects task completions from git commit messages and updates GitHub epics.

## How It Works

### Detection Flow

```
Developer commits code
    ↓
Commit message: "feat: add login closes #101"
    ↓
session.idle event triggered
    ↓
Plugin checks commits since last check
    ↓
Detects "closes #101" pattern
    ↓
Maps issue #101 to epic task
    ↓
Records completion in cache (dirty flag)
    ↓
Syncs to GitHub (updates epic body)
```

## Commit Message Patterns

The detector recognizes these keywords (case-insensitive):

- `closes #N` - Closes the issue/task
- `fixes #N` - Fixes the issue/task
- `resolves #N` - Resolves the issue/task
- `completes #N` - Completes the issue/task

### Examples

```bash
# ✅ Detected
git commit -m "feat: add login closes #101"
git commit -m "fix: bug in parser fixes #102"
git commit -m "feat: new feature completes #103"
git commit -m "Closes #104 and updates docs"

# ❌ Not detected
git commit -m "feat: add login"
git commit -m "related to #101 but not closing"
git commit -m "see issue #101 for details"
```

## API Reference

### `detectTaskFromCommit(message)`

Parses a commit message for task completion patterns.

**Parameters:**
- `message` (string) - Commit message to parse

**Returns:**
- `{issueNumber: number, keyword: string}` - Parsed task info
- `null` - If no completion pattern found

**Example:**
```javascript
const result = detectTaskFromCommit('closes #123');
// => { issueNumber: 123, keyword: 'closes' }
```

### `getRecentCommits(since, cwd)`

Retrieves commits since a given timestamp.

**Parameters:**
- `since` (string) - ISO timestamp string (e.g., "2026-02-09T12:00:00Z")
- `cwd` (string) - Current working directory

**Returns:**
- Array of commit objects: `[{hash, message, timestamp}, ...]`
- Empty array if no commits or error

**Example:**
```javascript
const commits = getRecentCommits('2026-02-09T12:00:00Z', '/path/to/repo');
// => [
//   { hash: 'abc123...', message: 'feat: ...', timestamp: '2026-02-09T13:00:00Z' },
//   ...
// ]
```

### `findCompletedTasks(since, cwd)`

Finds all completed tasks from commits since a timestamp.

**Parameters:**
- `since` (string) - ISO timestamp string
- `cwd` (string) - Current working directory

**Returns:**
- Array of completed task objects: `[{issueNumber, keyword, commit}, ...]`

**Example:**
```javascript
const tasks = findCompletedTasks('2026-02-09T12:00:00Z', process.cwd());
// => [
//   {
//     issueNumber: 101,
//     keyword: 'closes',
//     commit: { hash: 'abc123...', message: '...', timestamp: '...' }
//   }
// ]
```

## Plugin Integration

The task completion detector is automatically integrated into the plugin's `session.idle` hook.

### Configuration

Enable/disable in `.opencode/config.json`:

```json
{
  "tracking": {
    "updateOnTaskComplete": true
  }
}
```

### Workflow

1. **Session idle** - Triggered when OpenCode session becomes idle
2. **Check commits** - Scans commits since last check (default: 1 hour ago)
3. **Detect patterns** - Parses commit messages for "closes #N" patterns
4. **Map to epics** - Looks up issue in cache, finds parent epic
5. **Record completion** - Calls `recordTaskCompletion()` with agent info
6. **Update cache** - Marks epic dirty and stores completion
7. **Sync to GitHub** - Updates epic body with journey entry

### Logging

The plugin logs all detection activity:

```
Checking for completed tasks since 2026-02-09T12:00:00Z...
Found 2 completed task(s):
  - Issue #101 (closes) in commit abc1234
    ✅ Recorded task 1 completion for epic #100
  - Issue #102 (fixes) in commit def5678
    ✅ Recorded task 2 completion for epic #100
```

## Error Handling

### Issue Not in Cache

If a commit references an issue not tracked in the cache:

```
⚠️  Issue #999 not found in cache (may not be a task from an epic)
```

This is normal for:
- Non-epic issues
- Issues from other repositories
- Manually created issues without epic association

### Missing Task Number

If issue title doesn't match "Task N: Title" format:

```
⚠️  Could not extract task number from issue title: Some random title
```

### Recording Failure

If `recordTaskCompletion()` throws an error:

```
✗ Failed to record completion: Epic #100 not found in cache
```

## Cache Structure

The plugin stores tracking state in cache:

```json
{
  "last_task_check": "2026-02-09T15:30:00Z",
  "epics": [
    {
      "number": 100,
      "journey": [
        {
          "timestamp": "2026-02-09T15:00:00Z",
          "event": "task_complete",
          "message": "✅ Task 1 completed: Add login",
          "agent": "git-commit-abc1234",
          "metadata": { "taskNumber": 1, "taskTitle": "Add login" }
        }
      ],
      "dirty": true
    }
  ]
}
```

## Testing

Run tests with:

```bash
node test/task-completion-detector.test.js
node test/plugin-integration.test.js
```

### Test Coverage

- **Unit tests** (13 tests):
  - Pattern detection (all keywords, case insensitivity)
  - Commit retrieval (since timestamp, empty results)
  - Task finding (multiple matches, no matches)
  - Error handling (non-git directories)

- **Integration tests** (3 tests):
  - End-to-end task detection and mapping
  - Multiple task completions
  - No false positives

## Performance

- **Commit scanning**: O(n) where n = commits since last check
- **Pattern matching**: O(1) per commit (regex)
- **Cache lookup**: O(m) where m = issues in cache
- **Epic mapping**: O(e) where e = epics in cache

Typical performance:
- 10 commits/hour: <10ms detection time
- 100 commits/hour: <50ms detection time
- 1000 commits/hour: <200ms detection time

## Future Enhancements

1. **Batch detection** - Process multiple commits in parallel
2. **Smart caching** - Index issues by number for O(1) lookup
3. **Custom patterns** - Allow user-defined keywords in config
4. **Branch filtering** - Only scan main/master branch
5. **Auto-close issues** - Optionally close GitHub issues on detection
