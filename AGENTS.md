# AGENTS.md - Powerlevel Architecture

For AI agents working on this codebase.

## Architecture Overview

Powerlevel is a central project management dashboard for OpenCode + Superpowers. It tracks multiple projects (each in their own repository) from one central location, creating a unified view of all your work.

### Core Principle
**"One dashboard for all projects"** - Track multiple projects in one place. Your Powerlevel = number of active projects you're managing.

### Design Philosophy: Tracking-Only Dashboard

**CRITICAL:** Powerlevel is **always a tracking-only system**. All epics track work happening in other repositories. Powerlevel never manages the actual work—it only displays unified status snapshots.

**Two Types of Epics:**

1. **Self-tracking epics** (e.g., Epic #4, #5)
   - Track development work on Powerlevel itself
   - Work happens in the Powerlevel repo (castrojo/opencode-superpower-github)
   - Sub-issues represent implementation phases (traditional GitHub sub-issues)

2. **External tracking epics** (e.g., Epic #155)
   - Track work happening in external repositories
   - Work happens in the external repo (e.g., castrojo/casestudypilot)
   - Use **GitHub tasklists** (not sub-issues) to show tracked issues
   - Auto-synced on session start to keep status current
   - Format: `- [ ] [Issue Title](https://github.com/owner/repo/issues/123)`

**Powerlevel Score:**
- Calculated as: `COUNT(epics WHERE status != done)`
- Each active tracking epic = +1 Powerlevel
- Displayed on session start and in profile badge
- Example: 3 active epics = Powerlevel 3

## Project Board Organization Rules

**CRITICAL:** The project board uses a strict hierarchy for status columns:

### Status Column Rules
- **Todo / In Progress / Done** → **EPICS ONLY**
  - Only issues with `type/epic` label can have these statuses
  - Epics represent major initiatives spanning multiple tasks
  - Max 3-5 epics in progress at any time

- **Subissues** → **ALL SUB-ISSUES** (Self-tracking epics only)
  - All issues with a parent relationship MUST be in Subissues column
  - Sub-issues track detailed work items under an epic
  - Max 10-15 sub-issues per epic (create another epic if more needed)
  - **NOTE:** External tracking epics use tasklists, not sub-issues

### Issue Granularity Guidelines
- **Epics:** Major features or initiatives (e.g., "Project Board Integration")
- **Sub-issues:** Consolidated phases or milestones (e.g., "Phase: Core Infrastructure")
- **Tasklist items:** External repo issues (external tracking only)
- **NOT individual functions or files** - group related work into meaningful phases

### Enforcement
When creating or updating issues:
1. Check if issue has `type/epic` label
2. Check if issue has a parent relationship (`.parent` field) OR is external tracking
3. Set status accordingly:
   - Epic + No parent + Not external → Todo/In Progress/Done
   - Has parent → Subissues
   - External tracking epic → Todo/In Progress/Done (no sub-issues)
   - Neither → Add appropriate label/parent first

### External Tracking Architecture

**Tasklist Format (not sub-issues):**
- External tracking epics use GitHub's tasklist markdown syntax
- Each tracked issue appears as: `- [ ] [Issue Title](url)`
- Automatically synced on session start
- Closed external issues show as: `- [x] [Issue Title](url)`

**Sync Behavior:**
- **Frequency:** Once per OpenCode session start (Option B)
- **Fallback:** Manual sync via `/sync-projects` command (future)
- **Label detection:** Tries `type/epic`, then `epic`, then all open issues
- **No mutation:** Never modifies external repositories

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
- `session.created` → sets session title from epic details
- `assistant.message` → detects Superpowers skill invocations
- `file.created` → detects plan file creation
- `experimental.session.compacting` → re-injects epic context after compaction

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
- **New:** `insertEpicReference()` - Inserts epic reference at top of plan (after title, before Claude instruction)
- **New:** `extractPlanFromMessage()` - Extracts plan file path from assistant messages for skill tracking

#### `session-hooks.js`
- Event-driven system for detecting Superpowers skill invocations
- Hooks into OpenCode session events (`assistant.message`, `file.created`)
- Detects skill patterns: `executing-plans`, `finishing-a-development-branch`, `subagent-driven-development`
- Automatically updates epic status and journey when skills are invoked
- Links skill invocations to epics via plan file references

**Key functions:**
- `detectSkillInvocation()` - Pattern-matches skill announcements in messages
- `registerSessionHooks()` - Registers event listeners on session object
- `handleExecutingPlans()` - Sets epic to `status/in-progress`, records journey event
- `handleFinishingBranch()` - Sets epic to `status/review`, records journey event
- `findEpicByPlanFile()` - Maps plan file to epic in cache
- `findActiveEpic()` - Finds most recently updated in-progress epic

#### `config-loader.js`
- Loads configuration from `.opencode/config.json` or `.github-tracker.json`
- Validates configuration structure and values
- Provides configuration sections:
  - **`projectBoard`** - Project board integration settings
  - **`superpowersIntegration`** - Skill tracking and epic update behavior
  - **`tracking`** - Auto-update and comment behavior
  - **`wiki`** - Wiki sync settings
- Supports environment variable overrides for project board config

#### `project-board-detector.js`
- Auto-detects GitHub Project Boards for a user/org
- Caches project board metadata (id, number, title, url)
- Functions: `detectProjectBoard()`, `getProjectBoard()`

#### `project-item-manager.js`
- Adds issues to GitHub Project Boards via GraphQL API
- Sets project field values (Priority, Status)
- Handles rate limiting and retries

#### `project-field-manager.js`
- Reads project field metadata from GitHub
- Maps label values to project field values
- Caches field schemas for efficient updates

## Superpowers Integration

### Event-Driven Tracking

Powerlevel integrates with the Superpowers workflow through OpenCode session event hooks. When skills are invoked, the system automatically:

1. **Detects skill invocations** - Pattern-matches skill announcements in assistant messages
2. **Links to epics** - Associates skill usage with relevant epic issues via plan file references
3. **Updates epic status** - Transitions epics through workflow states (planning → in-progress → review → done)
4. **Records journey events** - Tracks skill invocations and progress milestones in epic metadata
5. **Batches GitHub updates** - Marks epics as "dirty" and syncs changes when session ends

### Skill Detection Patterns

The following skills are automatically detected and tracked:

| Skill | Pattern | Epic Update | Status Transition |
|-------|---------|-------------|-------------------|
| `executing-plans` | "using the executing-plans skill" | Finds epic by plan file reference | planning → in-progress |
| `finishing-a-development-branch` | "using the finishing-a-development-branch skill" | Finds most recently active epic | in-progress → review |
| `subagent-driven-development` | "using the subagent-driven-development skill" | Finds epic by plan file reference | (no status change) |
| `writing-plans` | "using the writing-plans skill" | Triggers epic-creation skill | → planning |

### Epic Reference Format

When epics are created, a reference block is inserted at the top of the plan file (after the title, before Claude instructions):

```markdown
# Feature Implementation Plan

> **Epic Issue:** #123
> **Sub-Tasks:** #124, #125, #126

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build something cool
```

This format:
- Makes epic references immediately visible
- Doesn't interfere with Claude instructions
- Provides quick links to GitHub issues
- Follows markdown blockquote convention

### Journey Events

Each epic tracks a "journey" of events in its cache metadata:

```javascript
{
  "journey": [
    {
      "timestamp": "2026-02-10T14:30:00Z",
      "event": "epic_created",
      "message": "Epic created from implementation plan"
    },
    {
      "timestamp": "2026-02-10T15:00:00Z",
      "event": "skill_invocation",
      "skill": "executing-plans",
      "message": "Started executing implementation plan"
    },
    {
      "timestamp": "2026-02-10T16:45:00Z",
      "event": "task_completed",
      "task_number": 1,
      "agent": "subagent-task-1"
    },
    {
      "timestamp": "2026-02-10T18:00:00Z",
      "event": "skill_invocation",
      "skill": "finishing-a-development-branch",
      "message": "Started finishing development branch"
    }
  ]
}
```

These events are synced to GitHub as epic comments during `landThePlane()`.

### Configuration

Configuration is loaded from `.opencode/config.json` or `.github-tracker.json`:

```json
{
  "projectBoard": {
    "enabled": true,
    "number": null,
    "autoCreate": true
  },
  "superpowersIntegration": {
    "enabled": true,
    "trackSkillUsage": true,
    "updateEpicOnSkillInvocation": true
  },
  "tracking": {
    "autoUpdateEpics": true,
    "updateOnTaskComplete": true,
    "commentOnProgress": false
  },
  "wiki": {
    "autoSync": false,
    "syncOnCommit": false,
    "includeSkills": true,
    "includeDocs": true
  }
}
```

**Configuration sections:**

- **`projectBoard`** - GitHub Project Board integration
  - `enabled` - Enable/disable project board integration
  - `number` - Specific project board number (null = auto-detect first board)
  - `autoCreate` - Auto-create project board if none exists

- **`superpowersIntegration`** - Skill tracking and epic updates
  - `enabled` - Enable/disable session hook integration
  - `trackSkillUsage` - Record skill invocations in epic journey
  - `updateEpicOnSkillInvocation` - Auto-update epic status when skills are invoked

- **`tracking`** - Progress tracking behavior
  - `autoUpdateEpics` - Enable automatic epic updates
  - `updateOnTaskComplete` - Update epics when tasks are completed via commits
  - `commentOnProgress` - Post GitHub comments on progress milestones

- **`wiki`** - Wiki sync settings
  - `autoSync` - Automatically sync skills/docs to wiki
  - `syncOnCommit` - Sync on every commit
  - `includeSkills` - Include skill documentation in sync
  - `includeDocs` - Include other documentation in sync

**Environment variable overrides:**

```bash
export GITHUB_TRACKER_PROJECT_ENABLED=false
export GITHUB_TRACKER_PROJECT_NUMBER=2
export GITHUB_TRACKER_PROJECT_AUTO_CREATE=true
```

### Integration Examples

**Example 1: executing-plans triggers epic status update**

```
User: Implement the feature using the plan
Assistant: I'm using the executing-plans skill to implement docs/plans/2026-02-10-feature.md
          ↓
session-hooks detects "using the executing-plans skill"
          ↓
Extracts plan file: docs/plans/2026-02-10-feature.md
          ↓
Finds epic #123 in cache (plan_file matches)
          ↓
Updates epic.labels: status/planning → status/in-progress
          ↓
Adds journey event: { event: 'skill_invocation', skill: 'executing-plans' }
          ↓
Marks epic.dirty = true
          ↓
(Synced to GitHub when session ends)
```

**Example 2: Project board population**

```
Epic created #123
          ↓
Sub-tasks created #124, #125, #126
          ↓
Project board detector finds board #1
          ↓
Add epic #123 to project board
  - Set Priority field: P1 - High (from priority/p1 label)
  - Set Status field: Todo (from status/planning label)
          ↓
Add sub-tasks #124, #125, #126 to project board
  - Each gets Priority and Status fields set
          ↓
All items visible in GitHub Projects board
```

**Example 3: finishing-a-development-branch triggers review status**

```
User: I'm done, let's wrap this up
Assistant: I'm using the finishing-a-development-branch skill to complete this work
          ↓
session-hooks detects "using the finishing-a-development-branch skill"
          ↓
Finds active epic (most recently updated in-progress epic)
          ↓
Updates epic.labels: status/in-progress → status/review
          ↓
Adds journey event: { event: 'skill_invocation', skill: 'finishing-a-development-branch' }
          ↓
Marks epic.dirty = true
          ↓
(Synced to GitHub when session ends)
```

### Session Hook Registration

The plugin registers session hooks during initialization (plugin.js:485):

```javascript
registerSessionHooks(session, owner, repo, cwd);
```

This sets up listeners for:
- `assistant.message` - Detect skill invocations
- `file.created` - Detect plan file creation

The hooks run in the background without blocking the session or requiring user interaction.

### Project Board Integration

When project board integration is enabled:

1. **Detection** - First available project board is auto-detected (or specific number from config)
2. **Caching** - Board metadata (id, number, title, url) is cached locally
3. **Field mapping** - Label values are mapped to project field values:
   - `priority/p0` → Priority: P0 - Critical
   - `status/in-progress` → Status: In Progress
4. **Adding items** - Epics and sub-issues are added to the board via GraphQL API
5. **Updating fields** - Field values are set based on issue labels
6. **Rate limiting** - Requests are batched and retried with exponential backoff

**GraphQL mutations used:**
- `addProjectV2ItemById` - Add issue to project board
- `updateProjectV2ItemFieldValue` - Set field values (Priority, Status)

### Error Handling

**Session hook errors:**
- Skill pattern doesn't match → Silent (no action taken)
- Epic not found for plan file → Log warning, continue
- Cache write fails → Log error, don't crash session

**Project board errors:**
- Board not found → Log warning, skip project board integration
- GraphQL API error → Log error, retry with backoff (3 attempts)
- Rate limit exceeded → Wait and retry, fail gracefully after 3 attempts
- Field not found → Log warning, skip field update (add item without field)

**Configuration errors:**
- Config file not found → Use defaults
- Invalid JSON → Throw error, fail plugin initialization
- Invalid values → Throw validation error with descriptive message

## 3. Skills (`skills/`)

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
Insert epic reference at top of plan (after title, before Claude instruction)
     ↓
Commit plan file
     ↓
Add epic and sub-issues to project board (if configured)

... later during development ...

User invokes executing-plans skill
     ↓
session-hooks detects skill pattern in assistant.message event
     ↓
Finds epic by plan file reference
     ↓
Updates epic status to in-progress
     ↓
Records journey event
     ↓
Marks epic dirty=true in cache
     ↓
(no GitHub API call yet)

... work continues ...

subagent completes task
     ↓
Task completion detected from commits
     ↓
Update cache (mark epic dirty=true)
     ↓
(no GitHub API call yet)

... session ends ...

session.idle event
     ↓
land-the-plane function
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

## Logging

The plugin uses OpenCode SDK logging instead of console output to prevent spillover into the user's console:

```javascript
await client.app.log({
  body: { 
    service: 'powerlevel', 
    level: 'info',  // or 'error', 'warn', 'debug'
    message: 'Your message here' 
  }
});
```

**Library Function Pattern:**

All library functions accept an optional `client` parameter:

```javascript
export function someFunction(requiredParam, optionalParam, client = null) {
  // If client provided, log via SDK
  if (client) {
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: 'Operation started' }
    });
  }
  
  // ... function logic ...
  
  try {
    // ... operations ...
  } catch (error) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'error', message: `Error: ${error.message}` }
      });
    }
    throw error;
  }
}
```

**Log Level Mapping:**
- `console.log()` → `level: 'info'`
- `console.error()` → `level: 'error'`
- `console.warn()` → `level: 'warn'`
- `console.debug()` → `level: 'debug'`

**Exceptions (console still used):**
- Early initialization errors (before plugin fully loads) - `plugin.js` lines 57, 576, 583
- User-facing prompts (onboarding instructions) - `lib/onboarding-check.js` `promptOnboarding()`

All logs use service name **"powerlevel"** for filtering in OpenCode's log viewer.

**Display Format:**
The Powerlevel score is displayed as: `Powerlevel 🔶 N - Managing <word> active projects`

Example: `Powerlevel 🔶 11 - Managing eleven active projects`

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

1. **Bidirectional Sync** - GitHub → Cache (sync changes made directly on GitHub back to local cache)
2. **Real-time Updates** - Webhooks for live sync
3. **PR Integration** - Auto-link PRs to epics when branch names match
4. **Auto-assign** - Assign epic to plan author automatically
5. **Milestone linking** - Link epics to GitHub milestones
6. **Epic templates** - Custom epic body formats per repo

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

---

## Best Practices System

### Overview

Powerlevel maintains a centralized set of best practices that apply to ALL tracked projects. These practices ensure consistency, quality, and maintainability across the ecosystem.

**Philosophy:** Best practices are stored as markdown documents in this repository and distributed via stable GitHub raw URLs. Tracked projects reference these practices in their `AGENTS.md` files, creating a chain of discovery.

### For AI Agents: Onboarding to Powerlevel

**If you are working on a project managed by Powerlevel:**

1. **Check the project's `AGENTS.md`** - It will have a "Managed by Powerlevel" section
2. **Follow the link** to the best practices index: https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/README.md
3. **Review all applicable best practices** - Each practice specifies what types of projects it applies to
4. **Apply MUST requirements strictly** - These are lint-enforced and non-negotiable
5. **Follow SHOULD recommendations** - Use judgment based on project context

### Available Best Practices

#### BP-001: GitHub Issue Form Validation

**URL:** https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/github-issue-form-validation.md

**Applies to:** Any project using GitHub issue forms (`.github/ISSUE_TEMPLATE/*.yml`)

**Summary:** YAML syntax rules and GitHub-specific validation requirements for issue form templates. Covers string quoting, ID constraints, uniqueness requirements, and required keys.

**Enforcement:** Lint check via `yq` (YAML parser)

**Key Rules:**
- All values must be quoted strings (even `"yes"` and `"no"`)
- IDs must be alphanumeric with hyphens/underscores only
- Labels and IDs must be unique within a form
- Required keys: `name`, `description`, `body`
- No empty strings where values required

### URL Pattern

All best practices use this stable URL pattern:

```
https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/{topic}.md
```

**Benefits:**
- No git clone required (just HTTP fetch)
- Cached by GitHub CDN
- Works from any environment
- No authentication needed (public repo)

### Adding New Best Practices

See `docs/best-practices/README.md` for instructions on adding new best practices.

**Process:**
1. Create markdown file in `docs/best-practices/{topic}.md`
2. Assign next BP number (BP-002, BP-003, etc.)
3. Update `docs/best-practices/README.md` index
4. Update this section with new practice summary
5. Commit: `docs: add BP-XXX {topic}`

### Tracked Projects Distribution

When a project is onboarded to Powerlevel (via `bin/onboard-project.js`), it receives an `AGENTS.md` file with:

1. **Powerlevel Managed Section** (HTML-commented to prevent accidental edits)
   - Link to best practices index
   - Quick links to individual practices
   - Project tracking information

2. **Project-Specific Context** (customizable by project team)
   - Architecture notes
   - Development workflow
   - Testing instructions
   - Deployment process

This creates a discovery chain:
```
Agent starts in tracked project
     ↓
Reads project's AGENTS.md
     ↓
Follows link to Powerlevel best practices
     ↓
Fetches applicable best practice docs via raw URLs
     ↓
Applies standards to project work
```

### No Wiki Sync Complexity

**Design Decision:** Best practices are NOT synced to project wikis. The wiki sync system (`lib/wiki-manager.js`) remains for Superpowers skills, but best practices use simpler GitHub raw URL distribution.

**Rationale:**
- Best practices are compact reference docs (not large interactive skills)
- Raw URLs are simpler than git clone/sync
- No cache management needed
- Immediate HTTP fetch from GitHub CDN
- Easier to maintain and update

### Enforcement Levels

Best practices use three enforcement levels:

1. **MUST** - Strict requirement, lint-enforced, non-negotiable
   - Example: "Values MUST be quoted strings in YAML"
   - Enforced via automated lint checks

2. **SHOULD** - Strong recommendation, use judgment
   - Example: "Dropdown options SHOULD have descriptive labels"
   - Apply based on project context

3. **MAY** - Optional suggestion, team preference
   - Example: "Issue forms MAY include markdown informational sections"
   - Purely advisory

**For agents:** Focus on MUST requirements first, then SHOULD recommendations. MAY suggestions are optional.

### Configuration Integration

Best practices respect project configuration in `.opencode/config.json`:

```json
{
  "bestPractices": {
    "enabled": true,
    "enforce": "strict",  // "strict" | "warn" | "off"
    "exclude": []  // BP numbers to skip (e.g., ["BP-001"])
  }
}
```

**Default behavior:** All best practices enabled in strict mode unless project opts out.

### Future Enhancements

Planned improvements (post-MVP):

1. **BP-002: Commit Message Conventions** - Consistent commit style across projects
2. **BP-003: PR Template Standards** - Required sections for pull requests
3. **BP-004: Documentation Structure** - Standard docs/ layout
4. **CI Validation** - GitHub Actions to enforce MUST requirements automatically
5. **VS Code Extension** - Inline hints for best practice violations
6. **Dashboard Compliance View** - Show which tracked projects follow which practices
