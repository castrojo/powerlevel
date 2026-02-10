# External Project Tracking System

**Goal:** Enable Powerlevel to track work happening in external repositories by creating "project mirror" epics on the central dashboard. Each tracked project contributes +1 to your Powerlevel score.

## Core Principle

**Powerlevel is always tracking-only.** All epics track work happening in other repositories. The external repos manage their own work; Powerlevel displays a unified status snapshot across all projects.

## Design

### Architecture

**Tracking Epic** = External project representation
- One epic per external project (e.g., "Track: projectbluefin/common")
- Lives in Powerlevel repo (`castrojo/opencode-superpower-github`)
- Label: `type/epic`, `project/<name>`, `status/in-progress`
- Status column: "In Progress" (always, since project is ongoing)
- Each tracking epic adds +1 to Powerlevel score

**Sub-issues** = Open epics from external project
- Each sub-issue represents an open epic in the external project's board
- Title: Same as external epic title (no [External] prefix needed)
- Body: Link to external epic, description, current status
- Status column: "Subissues" (per board organization rules)
- Closed when external epic closes

**Powerlevel Score** = Count of active tracking epics
- Formula: `COUNT(epics WHERE NOT status/done)`
- Displayed in README badge, session start message
- Each active project = +1 Powerlevel

### Sync Mechanism

**Auto-sync on session start:**
1. Plugin hook on `session.created` event
2. Load cache, find all tracking epics
3. For each tracking epic:
   - Extract external repo from epic metadata
   - Fetch open epics from external project board (via `gh` CLI)
   - Compare with current sub-issues
   - Create new sub-issues for new external epics
   - Close sub-issues when external epics complete
   - Update sub-issue bodies with latest status
4. Calculate and display Powerlevel score

### Tracking Epic Format

**Title:** `Track: projectbluefin/common`

**Body:**
```markdown
**External Project:** https://github.com/projectbluefin/common
**Project Board:** https://github.com/orgs/projectbluefin/projects/1

This epic tracks open work in the projectbluefin/common repository.

Sub-issues below represent open epics from their project board. They are auto-synced on session start.

**Last Sync:** 2026-02-10 14:30:00 UTC
**Open Epics:** 5
```

**Labels:** `type/epic`, `project/bluefin`, `status/in-progress`

### Sub-issue Format

**Title:** Epic title from external project (e.g., "Add Bluefin desktop variant")

**Body:**
```markdown
**External Epic:** projectbluefin/common#45
**Link:** https://github.com/projectbluefin/common/issues/45
**Status:** In Progress
**Priority:** High

<!-- External epic description synced below -->
[Description from external epic]

---
*This issue is auto-synced from external project. Do not edit manually.*
```

**Labels:** `epic/<parent-number>`, `project/bluefin`

## Data Flow

```
session.created event
    ↓
Load cache for current repo
    ↓
Find all tracking epics (type/epic, not status/done)
    ↓
For each tracking epic:
  - Extract external repo from epic body
  - Run: gh project item-list --owner <owner> --format json
  - Filter for open epics (type/epic + status != done)
  - Compare with current sub-issues in cache
  - Create new sub-issues for new external epics
  - Close sub-issues for completed external epics
  - Update sub-issue bodies with latest status
  - Update "Last Sync" timestamp in tracking epic body
    ↓
Calculate Powerlevel score (count active epics)
    ↓
Display: "🚀 Powerlevel: 5 active projects"
    ↓
Cache updated, ready for session
```

## Configuration

**`.opencode/config.json`**

```json
{
  "externalTracking": {
    "enabled": true,
    "autoSync": true,
    "syncOnSessionStart": true,
    "trackedProjects": [
      {
        "repo": "projectbluefin/common",
        "label": "project/bluefin",
        "projectBoard": 1
      },
      {
        "repo": "castrojo/homebrew-tap",
        "label": "project/homebrew-tap",
        "projectBoard": null
      }
    ]
  },
  "powerlevel": {
    "displayOnSessionStart": true,
    "badgeEnabled": true,
    "badgeUrl": "https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/castrojo/castrojo/main/powerlevel.json"
  }
}
```

### Configuration Options

**`externalTracking`**
- `enabled` (boolean) - Enable/disable external project tracking
- `autoSync` (boolean) - Automatically sync on session start
- `syncOnSessionStart` (boolean) - Sync when OpenCode session starts
- `trackedProjects` (array) - List of external projects to track
  - `repo` (string) - GitHub repo in `owner/repo` format
  - `label` (string) - Project label for this repo's issues
  - `projectBoard` (number|null) - Project board number (null = auto-detect)

**`powerlevel`**
- `displayOnSessionStart` (boolean) - Show Powerlevel score when session starts
- `badgeEnabled` (boolean) - Generate badge JSON for GitHub profile
- `badgeUrl` (string) - URL where badge JSON is hosted

## Implementation Tasks

### Task 1: Core External Tracker Library

**File:** `lib/external-tracker.js`

**Functions:**
- `syncExternalProject(owner, repo, epicNumber, projectBoard)` - Sync one external project
- `syncAllTrackedProjects(cache)` - Sync all tracking epics
- `fetchExternalEpics(owner, repo, projectBoard)` - Get open epics from external board
- `createSubIssueForExternalEpic(externalEpic, parentEpic)` - Create tracking sub-issue
- `closeSubIssueForCompletedEpic(subIssue)` - Close sub-issue when external epic done
- `updateTrackingEpicMetadata(epicNumber, metadata)` - Update "Last Sync" timestamp

**Dependencies:**
- `github-cli.js` - For GitHub API calls
- `cache-manager.js` - For local state management
- `label-manager.js` - For label operations

**Key Logic:**
```javascript
async function syncExternalProject(owner, repo, epicNumber, projectBoard) {
  // 1. Fetch open epics from external project
  const externalEpics = await fetchExternalEpics(owner, repo, projectBoard);
  
  // 2. Load current sub-issues from cache
  const cache = await loadCache(owner, repo);
  const epic = cache.epics[epicNumber];
  const currentSubIssues = epic.sub_issues.map(n => cache.issues[n]);
  
  // 3. Find new epics (in external, not in cache)
  const externalEpicNumbers = externalEpics.map(e => e.number);
  const currentEpicNumbers = currentSubIssues.map(s => s.externalEpicNumber);
  const newEpics = externalEpics.filter(e => !currentEpicNumbers.includes(e.number));
  
  // 4. Find completed epics (in cache, not in external)
  const completedSubIssues = currentSubIssues.filter(s => 
    !externalEpicNumbers.includes(s.externalEpicNumber)
  );
  
  // 5. Create sub-issues for new epics
  for (const externalEpic of newEpics) {
    await createSubIssueForExternalEpic(externalEpic, epic);
  }
  
  // 6. Close sub-issues for completed epics
  for (const subIssue of completedSubIssues) {
    await closeSubIssueForCompletedEpic(subIssue);
  }
  
  // 7. Update tracking epic metadata
  await updateTrackingEpicMetadata(epicNumber, {
    lastSync: new Date().toISOString(),
    openEpics: externalEpics.length
  });
}
```

### Task 2: Powerlevel Calculator

**File:** `lib/powerlevel-calculator.js`

**Functions:**
- `calculatePowerlevel(cache)` - Count active tracking epics
- `generatePowerlevelBadge(powerlevel)` - Generate shields.io badge JSON
- `displayPowerlevelMessage(powerlevel)` - Format session start message
- `updatePowerlevelBadge(powerlevel, outputPath)` - Write badge JSON to file

**Key Logic:**
```javascript
function calculatePowerlevel(cache) {
  return Object.values(cache.epics).filter(epic => 
    epic.labels.includes('type/epic') &&
    !epic.labels.includes('status/done')
  ).length;
}

function generatePowerlevelBadge(powerlevel) {
  return {
    schemaVersion: 1,
    label: "Powerlevel",
    message: powerlevel.toString(),
    color: powerlevel >= 5 ? "brightgreen" : powerlevel >= 3 ? "green" : "blue"
  };
}

function displayPowerlevelMessage(powerlevel) {
  const emoji = powerlevel >= 5 ? "🔥" : powerlevel >= 3 ? "🚀" : "⚡";
  return `${emoji} Powerlevel: ${powerlevel} active project${powerlevel !== 1 ? 's' : ''}`;
}
```

### Task 3: Add External Project Command

**File:** `bin/add-external-project.js`

**Usage:**
```bash
node bin/add-external-project.js projectbluefin/common --project-board 1
node bin/add-external-project.js castrojo/homebrew-tap
```

**Logic:**
1. Parse `owner/repo` from CLI args
2. Detect or use provided project board number
3. Create tracking epic with proper format
4. Add to config.json `trackedProjects` array
5. Run initial sync to populate sub-issues
6. Update cache with new tracking epic

### Task 4: Manual Sync Command

**File:** `bin/sync-external-projects.js`

**Usage:**
```bash
node bin/sync-external-projects.js                    # Sync all
node bin/sync-external-projects.js projectbluefin/common  # Sync one
```

**Logic:**
1. Load config, get tracked projects
2. If specific repo provided, sync only that one
3. Otherwise sync all tracked projects
4. Display summary of changes (new epics, closed epics)

### Task 5: Plugin Integration

**File:** `plugin.js`

**Changes:**
1. Add `session.created` hook to trigger auto-sync
2. Calculate and display Powerlevel on session start
3. Load external tracking config from `.opencode/config.json`
4. Call `syncAllTrackedProjects()` if enabled

**Hook Implementation:**
```javascript
session.on('created', async () => {
  const config = await loadConfig(cwd);
  
  if (config.externalTracking?.enabled && config.externalTracking?.syncOnSessionStart) {
    console.log('🔄 Syncing external projects...');
    const cache = await loadCache(owner, repo);
    await syncAllTrackedProjects(cache, config.externalTracking.trackedProjects);
  }
  
  if (config.powerlevel?.displayOnSessionStart) {
    const cache = await loadCache(owner, repo);
    const powerlevel = calculatePowerlevel(cache);
    console.log(displayPowerlevelMessage(powerlevel));
  }
});
```

### Task 6: Powerlevel Badge Generation

**File:** `bin/generate-powerlevel-badge.js`

**Usage:**
```bash
node bin/generate-powerlevel-badge.js --output ~/castrojo/powerlevel.json
```

**Logic:**
1. Calculate current Powerlevel score
2. Generate shields.io badge JSON
3. Write to output file (typically in GitHub profile repo)
4. User commits and pushes to make badge live

**Badge Display:**
In GitHub profile README.md:
```markdown
![Powerlevel](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/castrojo/castrojo/main/powerlevel.json)
```

### Task 7: Documentation Updates

**Files to Update:**

**`README.md`**
- Add "External Project Tracking" section
- Document `add-external-project.js` and `sync-external-projects.js` commands
- Add Powerlevel badge to header
- Explain Powerlevel scoring system

**`AGENTS.md`**
- Add "External Project Tracking" architecture section
- Document tracking epic format
- Explain sync mechanism and data flow
- Codify tracking-only design principle

**`docs/EXTERNAL-TRACKING.md`** (new file)
- Comprehensive guide to external project tracking
- Configuration examples
- Troubleshooting sync issues
- Best practices for tracking multiple projects

## Testing Strategy

### Manual Testing
1. Add projectbluefin/common as tracked project
2. Verify tracking epic created with proper format
3. Verify sub-issues created for open external epics
4. Close an external epic, verify sub-issue closes on next sync
5. Open new external epic, verify sub-issue created on next sync
6. Verify Powerlevel calculation is correct

### Error Handling
- External repo not found → Log error, skip sync
- Project board not accessible → Fall back to repo issues
- Rate limit exceeded → Wait and retry, log warning
- Sub-issue creation fails → Log error, continue with others
- Cache corruption → Rebuild from GitHub

## Security & Performance

**Security:**
- Use existing `gh` CLI authentication (no new tokens)
- Respect GitHub permissions (read-only access to external repos)
- Never modify external repo issues

**Performance:**
- Sync only on session start (not continuous polling)
- Cache external epic data locally
- Batch GitHub API calls to minimize rate limit impact
- Skip sync if last sync was < 5 minutes ago

**Rate Limits:**
- Fetch external epics: 1 API call per project
- Create sub-issue: 1 API call per new epic
- Close sub-issue: 1 API call per completed epic
- Typical sync: 3-10 API calls per project

## Success Criteria

✅ Can add external projects via CLI command
✅ Tracking epics created with proper format and labels
✅ Sub-issues auto-created for open external epics
✅ Sub-issues auto-closed when external epics complete
✅ Powerlevel score calculated correctly
✅ Powerlevel badge generated and displayed
✅ Session start displays current Powerlevel
✅ Manual sync command works for all or specific projects
✅ Documentation updated with tracking-only design principle

## Future Enhancements

- **Webhook support** - Real-time updates instead of session-start sync
- **Aggregate metrics** - Total issues across all projects, velocity tracking
- **Project health indicators** - Stale epics, overdue issues
- **Multi-board support** - Track multiple boards per project
- **Custom sync frequency** - Configurable sync intervals
