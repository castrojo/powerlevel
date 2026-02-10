# Epic Updater Library

Automatically updates GitHub epics with progress journey entries when tasks are completed.

## Overview

The epic-updater library provides a system for tracking development progress by:
1. Recording journey entries in the local cache
2. Marking epics as "dirty" (needs sync)
3. Syncing dirty epics to GitHub on session end

This enables automatic progress tracking without requiring a GitHub API call on every update.

## Core Functions

### `addJourneyEntry(epicNumber, entry, cwd)`

Adds a journey entry to an epic's cache and marks it as dirty.

**Parameters:**
- `epicNumber` (number): Epic issue number (must be positive integer)
- `entry` (object): Journey entry with:
  - `event` (string, required): Event type (e.g., 'task_complete', 'epic_created')
  - `message` (string, required): Human-readable message
  - `agent` (string, optional): Agent/user who performed the action
  - `metadata` (object, optional): Additional structured data
  - `timestamp` (string, optional): ISO8601 timestamp (defaults to now)
- `cwd` (string): Current working directory

**Example:**
```javascript
import { addJourneyEntry } from './lib/epic-updater.js';

addJourneyEntry(42, {
  event: 'task_started',
  message: '🚀 Task 1 started: Create wiki sync library',
  agent: 'subagent-task1',
  metadata: { taskNumber: 1 }
}, process.cwd());
```

### `recordTaskCompletion(epicNumber, taskNumber, taskTitle, agentInfo, cwd)`

Convenience wrapper for recording task completion with properly formatted message.

**Parameters:**
- `epicNumber` (number): Epic issue number
- `taskNumber` (number): Task number (1-indexed)
- `taskTitle` (string): Task title
- `agentInfo` (object, optional): Agent info with `name` or `id` field
- `cwd` (string): Current working directory

**Example:**
```javascript
import { recordTaskCompletion } from './lib/epic-updater.js';

recordTaskCompletion(
  42, 
  1, 
  'Create wiki sync library',
  { name: 'subagent-task1' },
  process.cwd()
);
```

### `syncEpicToGitHub(epicNumber, cwd)`

Syncs an epic to GitHub by updating the issue body with journey section.

**Parameters:**
- `epicNumber` (number): Epic issue number
- `cwd` (string): Current working directory

**Behavior:**
- Checks `config.tracking.autoUpdateEpics` before syncing
- Only syncs if epic is marked as dirty
- Updates issue body via GitHub API
- Clears dirty flag on success
- Keeps dirty flag set on network errors (for retry)

**Example:**
```javascript
import { syncEpicToGitHub } from './lib/epic-updater.js';

syncEpicToGitHub(42, process.cwd());
```

## Configuration

Epic updates are controlled by the `.opencode/config.json` file:

```json
{
  "tracking": {
    "autoUpdateEpics": true,
    "updateOnTaskComplete": true,
    "commentOnProgress": false
  }
}
```

**Settings:**
- `autoUpdateEpics`: Enable/disable automatic epic syncing (default: true)
- `updateOnTaskComplete`: Enable/disable task completion recording (default: true)
- `commentOnProgress`: Add GitHub comments on progress (default: false)

## Journey Entry Format

Journey entries are stored in the cache with this structure:

```javascript
{
  timestamp: "2026-02-09T10:00:00Z",
  event: "task_complete",
  message: "✅ Task 1 completed: Create wiki sync library",
  agent: "subagent-task1",
  metadata: {
    taskNumber: 1,
    taskTitle: "Create wiki sync library"
  }
}
```

## Epic Body Format

When synced to GitHub, epics include a Progress Journey section:

```markdown
## Goal

Implement automatic synchronization of project documentation to GitHub Wiki.

## Tasks

- [x] Create wiki sync library
- [ ] Add wiki detector for repo
- [ ] Implement auto-sync on session end

## Progress Journey

- **2026-02-09 13:00 UTC** - ✅ Task 1 completed: Create wiki sync library
  - Agent: subagent-task1
- **2026-02-09 11:30 UTC** - 🚀 Task 1 started: Create wiki sync library
  - Agent: subagent-task1
- **2026-02-09 10:00 UTC** - 📝 Epic created from implementation plan
```

Journey entries are sorted newest-first for easy reading.

## Error Handling

### Validation Errors
- Invalid epic number (non-positive integer) → throws Error
- Missing required fields (event, message) → throws Error
- Epic not found in cache → throws Error

### Network Errors
- GitHub API rate limit → keeps dirty flag, logs warning
- Network timeout → keeps dirty flag, logs warning
- Issue not found → throws Error
- Invalid authentication → throws Error

### Security
- All user input is sanitized before GitHub API calls
- Control characters (null bytes, etc.) are removed
- Uses `execFileSync` with array args for shell safety

## Cache Structure

Epics in cache include these fields:

```javascript
{
  number: 42,
  title: "Add GitHub Wiki Integration",
  plan_file: "/path/to/plan.md",
  state: "open",
  labels: ["type/epic", "priority/p1"],
  dirty: true,
  journey: [
    { timestamp: "...", event: "...", message: "..." }
  ],
  sub_issues: [],
  created_at: "2026-02-09T10:00:00Z",
  updated_at: "2026-02-09T13:00:00Z"
}
```

**Key fields:**
- `dirty` (boolean): True if local changes need syncing to GitHub
- `journey` (array): Chronological list of journey entries

## Testing

Run the test suite:

```bash
# Unit tests
node test/epic-updater.test.js

# Manual workflow test
node test/manual-epic-updater-test.js
```

## Integration

Typically called from:
1. **Subagent completion hooks** - Record task completion automatically
2. **Session end hook** - Batch sync all dirty epics to GitHub
3. **Manual commands** - Force sync specific epics

See `plugin.js` and `land-the-plane` skill for integration examples.

## Performance

**Local operations** (no GitHub API):
- `addJourneyEntry()` - ~1-2ms (cache write)
- `recordTaskCompletion()` - ~1-2ms (cache write)

**GitHub API operations:**
- `syncEpicToGitHub()` - ~500-2000ms (network request)

**Strategy:**
- Update cache locally during development (fast)
- Batch sync all dirty epics at session end (efficient)
- Rate limit friendly: 1 API call per dirty epic

## Troubleshooting

**Epic not syncing?**
- Check `config.tracking.autoUpdateEpics` is true
- Verify epic is marked dirty in cache
- Check GitHub CLI authentication: `gh auth status`

**Journey entries not showing?**
- Verify entries added to cache: `loadCache()` and inspect `epic.journey`
- Check if epic was synced successfully (dirty flag cleared)

**Rate limit errors?**
- Epics remain dirty for retry later
- Check rate limit: `gh api rate_limit`
- Reduce sync frequency if hitting limits
