# AGENTS.md - Powerlevel Architecture

For AI agents working on this codebase.

## Architecture Overview

Powerlevel is a multi-project management dashboard that integrates GitHub Issues with the Superpowers workflow for OpenCode. The system automatically creates GitHub epics from implementation plans and syncs development progress across multiple projects.

### Core Principle
**"Write once, track everywhere"** - Implementation plans become GitHub issues automatically, with no manual intervention required.

## Components

### 1. Plugin Entry Point (`plugin.js`)

Main OpenCode plugin that:
- Initializes on session start
- Verifies GitHub CLI availability
- Detects repository from git remote
- Ensures required labels exist
- Hooks `session.idle` event for sync

**Hook Points:**
- `session.idle` → triggers `landThePlane()` function
- Future: `session.compacted` → re-inject epic context

### 2. Core Libraries (`lib/`)

#### `repo-detector.js`
- Parses git remote origin URL
- Extracts `owner/repo` from both HTTPS and SSH formats
- Generates repo hash for cache directory naming
- Used by all other components to identify current repo

#### `cache-manager.js`
- Stores GitHub state in JSON files
- Cache location: `cache/<repo-hash>/state.json`
- Tracks epics, sub-issues, dirty flags
- Enables rate-limit-friendly operation (local writes, batch GitHub syncs)

**Cache Structure:**
```javascript
{
  repo: { owner, repo, detected_at },
  epics: {
    "123": {
      number, title, state, labels,
      plan_file, created_at, updated_at,
      sub_issues: [124, 125],
      journey: [{timestamp, event, message}],
      dirty: true  // needs sync
    }
  },
  issues: {
    "124": { number, title, state, labels, epic: 123 }
  },
  project_board: { id, number, url },
  last_sync: "2026-02-09T22:00:00Z"
}
```

#### `label-manager.js`
- Defines all labels matching Superpowers workflow
- Creates missing labels via `gh label create`
- Provides label selection helpers for epics and tasks
- Creates dynamic `epic/<number>` labels

**Label Taxonomy:**
- Type: `type/epic`, `type/task`
- Priority: `priority/p0-p3` (or `task/p0-p3` for tasks)
- Status: `status/planning`, `status/in-progress`, `status/review`, `status/done`
- Epic ref: `epic/<number>` (dynamic)

#### `github-cli.js`
- Wraps `gh` CLI commands
- Functions: `createEpic`, `createSubIssue`, `updateIssueBody`, `addComment`, `closeIssue`
- Parses issue numbers from CLI output
- Error handling for rate limits and network issues

#### `parser.js`
- Parses implementation plan markdown files
- Extracts: title (from `# Header`), goal (from `**Goal:**`), tasks (from `## Task N:`)
- Formats epic body for GitHub

### 3. Skills (`skills/`)

#### `epic-creation` 
**Trigger:** Called by `writing-plans` after plan saved

**Process:**
1. Load plan file
2. Parse metadata (title, goal, tasks)
3. Create epic on GitHub with `type/epic` label
4. Create sub-task issues with `type/task` and `epic/<N>` labels
5. Update plan file with epic reference
6. Commit plan file

**Integration:** Modifies `writing-plans` skill at line 101 (epic-creation reference)

#### `land-the-plane`
**Trigger:** Plugin `session.idle` hook, or manual `/gh-sync`

**Process:**
1. Load cache, get dirty epics
2. Batch sync all dirty epics to GitHub
3. Clear dirty flags, update last_sync

**MVP Scope:** Just reports what would sync (full sync post-MVP)

### 4. Helper Script (`bin/create-epic.js`)

Standalone script for testing and manual epic creation:
```bash
node bin/create-epic.js docs/plans/my-plan.md
```

Useful for:
- Testing without OpenCode session
- Batch creating epics from existing plans
- Debugging epic creation logic

## Data Flow

```
User writes plan
     ↓
writing-plans saves plan file
     ↓
epic-creation skill invoked
     ↓
Parse plan → Create epic → Create sub-tasks
     ↓
Update cache (dirty=false)
     ↓
Append epic reference to plan
     ↓
Commit plan file

... later during development ...

subagent completes task
     ↓
Update cache (mark epic dirty=true)
     ↓
(no GitHub API call yet)

... session ends ...

session.idle event
     ↓
land-the-plane skill
     ↓
Batch sync all dirty epics to GitHub
     ↓
Clear dirty flags
```

## Caching Strategy

**Why cache?**
- Minimize GitHub API calls (rate limits: 5000/hour)
- Enable fast local operations
- Batch updates for efficiency

**When to cache:**
- Epic creation → cache immediately (after GitHub create)
- Sub-task creation → cache immediately
- Progress updates → cache only (mark dirty)
- Session end → flush dirty to GitHub

**Dirty Flag Lifecycle:**
```
Epic created → dirty=false (just synced)
Task updated → dirty=true (needs sync)
Session ends → dirty=false (after sync)
```

## Error Handling

### GitHub CLI Errors
- **Not authenticated:** Prompt user to run `gh auth login`
- **Rate limit:** Batch operations, show rate limit status
- **Network error:** Retry with exponential backoff
- **Issue creation fails:** Log error, continue with other operations

### Cache Errors
- **Corrupt JSON:** Backup corrupt file, recreate empty cache
- **Missing directory:** Create cache directory on demand
- **Permission denied:** Log error, operate in read-only mode

### Parse Errors
- **Invalid plan format:** Log warning, extract what's possible
- **No tasks found:** Create epic anyway with warning comment
- **Missing goal:** Use filename as goal

## Extension Points

### Adding New Skills

1. Create `skills/new-skill/SKILL.md`
2. Create `skills/new-skill/AGENTS.md` (this file)
3. Update skill to use cache-manager and github-cli libs
4. Hook into appropriate workflow point

### Adding New Labels

1. Update `LABELS` in `label-manager.js`
2. Re-run `ensureLabelsExist()` (happens automatically on plugin init)

### Custom Epic Body Format

Modify `formatEpicBody()` in `parser.js`

## Development Workflow

**Setup:**
```bash
git clone <repo>
cd opencode-superpower-github
npm install
```

**Test:**
```bash
# Test epic creation
node bin/create-epic.js test-plan.md

# Test with OpenCode
# 1. Symlink plugin
# 2. Create plan
# 3. Observe epic creation
```

**Commit:**
- Follow Conventional Commits: `feat:`, `fix:`, `docs:`
- Reference issues: `feat: add journey updates (#15)`

## Future Enhancements (Post-MVP)

1. **Journey Updates** - Track commits → update epic body
2. **Project Board** - Visual tracking
3. **Task State Transitions** - Auto-update labels during work
4. **PR Integration** - Link PRs to epics
5. **Bidirectional Sync** - GitHub → Cache
6. **Real-time Updates** - Webhooks for live sync

## Testing Strategy

**Unit Tests** (future):
- `repo-detector`: mock git commands
- `parser`: test plan parsing edge cases
- `cache-manager`: test cache operations
- `label-manager`: test label creation

**Integration Tests** (future):
- Full epic creation flow
- Session end sync
- Error recovery

**Manual Testing** (MVP):
- Create plan → verify epic created
- Session end → verify cache cleared
- Multiple repos → verify cache isolation

## Performance Considerations

**Cache Size:**
- Typical: 1-10 KB per repo
- Large projects: 100-500 KB (1000+ issues)
- Cleanup: Archive old epics after merge

**API Rate Limits:**
- 5000 requests/hour (authenticated)
- Epic creation: ~1 + N requests (N = # of tasks)
- Batch sync: 1 request per dirty epic
- Strategy: Cache locally, sync in batches

## Security

**Credentials:**
- Uses `gh` CLI authentication (no token storage)
- Respects GitHub permissions (can only modify repos user has access to)

**Cache Contents:**
- No sensitive data stored
- Cache is local-only
- Safe to commit (gitignored by default)

## Debugging

**Enable verbose logging:**
```javascript
// In plugin.js
const DEBUG = true;
```

**Check cache state:**
```bash
cat cache/<repo-hash>/state.json | jq
```

**Verify gh CLI:**
```bash
gh auth status
gh api rate_limit
gh repo view
```

**Common issues:**
- Cache out of sync → Delete cache, recreate from GitHub
- Duplicate epics → Check plan file for existing epic reference
- Labels missing → Re-run `ensureLabelsExist()`
