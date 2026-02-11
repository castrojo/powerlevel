# Session Hooks Audit

## Executive Summary

This audit examines the three main hooks in plugin.js to identify opportunities for batching and parallelization. The primary hook (`session.idle`) has significant optimization potential through batching GitHub API calls and parallelizing independent operations.

**Key Findings:**
- **5+ batching opportunities** identified across hooks
- **3+ parallelization opportunities** with high impact
- Estimated **30-50% reduction** in GitHub API calls possible
- Current sequential architecture creates unnecessary latency

---

## Hook 1: session.idle (landThePlane)

**Location:** `plugin.js:331-335` (registration), `plugin.js:167-193` (implementation)

### Current Behavior

The `landThePlane()` function is triggered when the session becomes idle. It performs the following sequential operations:

```
1. checkForCompletedTasks(owner, repo, cwd)
   ↓
   a. Load config (file I/O)
   b. Load cache (file I/O)
   c. Execute git log command (1 subprocess)
   d. For each completed task (N tasks):
      - Search cache for issue
      - Search cache for epic
      - Call recordTaskCompletion (file I/O per task)
   
2. syncDirtyEpics(owner, repo, cache)
   ↓
   a. Load cache (file I/O - duplicate!)
   b. Get dirty epics
   c. For each dirty epic (M epics):
      - Build epic body string
      - Execute gh issue edit (1 API call per epic)
   
3. clearDirtyFlags(cache) + saveCache()
   ↓
   a. Modify cache in memory
   b. Write cache to disk (file I/O)
   
4. listProjects(cwd) + calculatePowerlevel()
   ↓
   a. List directory (file I/O)
   b. For each project directory:
      - Read config.json (file I/O per project)
   c. Calculate active project count
```

**API calls per sync:**
- Git log: 1 subprocess call
- GitHub issue edit: M calls (1 per dirty epic)
- **Total: 1 + M GitHub API calls**

**File I/O operations:**
- Config load: 1
- Cache load: 2 (duplicate!)
- Cache save: 1
- recordTaskCompletion writes: N
- listProjects reads: 1 + P (where P = project count)
- **Total: 5 + N + P file operations**

**Average duration estimate:**
- With 3 dirty epics, 2 completed tasks, 5 projects: ~3-5 seconds
- Network latency dominates (GitHub API calls are sequential)

### Batching Opportunities

#### 1. **Batch GitHub issue updates via GraphQL**
- **Impact:** HIGH
- **Complexity:** MEDIUM
- **Estimated savings:** M-1 API calls (from M calls to 1 call)

**Description:** Instead of M sequential `gh issue edit` calls, use a single GraphQL mutation batch:

```graphql
mutation BatchUpdateIssues {
  issue1: updateIssue(input: {id: "...", body: "..."}) { ... }
  issue2: updateIssue(input: {id: "...", body: "..."}) { ... }
  ...
}
```

**Current code:** `plugin.js:61` - individual `execGh()` calls in loop  
**Alternative:** Use `execGraphQL()` with batched mutation (already available in `github-cli.js:285`)

**Tradeoff:** GraphQL requires issue node IDs (not numbers), so need to fetch IDs first or cache them. Still net savings for >2 epics.

#### 2. **Combine cache operations**
- **Impact:** MEDIUM
- **Complexity:** LOW
- **Estimated savings:** 1 file I/O, 1 redundant cache load

**Description:** `landThePlane()` loads cache twice:
1. Line 175: `loadCache()` in syncDirtyEpics
2. Line 172: indirectly via checkForCompletedTasks → loadCache (line 85)

**Fix:** Load cache once at start of landThePlane, pass to both functions.

**Current code:**
```javascript
await checkForCompletedTasks(owner, repo, cwd);
const cache = loadCache(owner, repo);
await syncDirtyEpics(owner, repo, cache);
```

**Optimized:**
```javascript
const cache = loadCache(owner, repo);
await checkForCompletedTasks(owner, repo, cwd, cache); // pass cache
await syncDirtyEpics(owner, repo, cache);
```

#### 3. **Batch journey event recording**
- **Impact:** LOW-MEDIUM
- **Complexity:** LOW
- **Estimated savings:** N-1 file writes

**Description:** `recordTaskCompletion()` is called in a loop (line 145) and likely writes to disk each time. Accumulate updates in memory, write once at end.

**Location:** `checkForCompletedTasks` loop (lines 105-150)

### Parallelization Opportunities

#### 1. **Parallelize GitHub issue updates**
- **Impact:** HIGH
- **Complexity:** LOW
- **Estimated savings:** ~75% time reduction for M>2

**Description:** If not using GraphQL batching, at least parallelize individual `gh issue edit` calls using `Promise.all()`.

**Current code:** Sequential loop (lines 45-67)
```javascript
for (const epic of dirtyEpics) {
  execGh(`issue edit ${epic.number} ...`);
}
```

**Optimized:**
```javascript
await Promise.all(dirtyEpics.map(epic => 
  execGh(`issue edit ${epic.number} ...`)
));
```

**Savings:** For 4 epics @ 500ms each: 2000ms → 500ms (75% faster)

#### 2. **Parallelize project config reads**
- **Impact:** LOW
- **Complexity:** LOW
- **Estimated savings:** Minimal (file I/O is fast locally)

**Description:** `listProjects()` reads config.json files sequentially. Could parallelize with `Promise.all()` for many projects.

**Location:** `project-manager.js:18-44`

**Note:** Only worthwhile if >10 projects. Current overhead is negligible.

#### 3. **Run powerlevel calculation during GitHub API calls**
- **Impact:** LOW
- **Complexity:** LOW
- **Estimated savings:** ~100-200ms (hidden latency)

**Description:** `listProjects()` and `calculatePowerlevel()` are independent of GitHub sync. Start them as a Promise while syncing epics, await at end.

**Current code:** Sequential (lines 183-188)
```javascript
await syncDirtyEpics(...);
clearDirtyFlags(cache);
saveCache(...);
const projects = listProjects(cwd);
const powerlevel = calculatePowerlevel(projects);
```

**Optimized:**
```javascript
const [_, projects] = await Promise.all([
  syncDirtyEpics(...),
  listProjects(cwd)
]);
clearDirtyFlags(cache);
saveCache(...);
const powerlevel = calculatePowerlevel(projects);
```

### Summary: session.idle Hook

| Operation | Current | Optimized | Savings |
|-----------|---------|-----------|---------|
| GitHub API calls | M | 1 (batch) or M (parallel) | M-1 calls OR 75% time |
| Cache loads | 2 | 1 | 1 file read |
| Cache writes | N+1 | 1 | N writes |
| Total duration | ~3-5s | ~1-2s | 50-60% faster |

---

## Hook 2: session.created (Epic Detection via ContextProvider)

**Location:** `plugin.js:307-329` (initialization), context via `lib/context-provider.js` and `lib/epic-detector.js`

### Current Behavior

This is NOT a traditional hook registration, but rather initialization-time operations that detect epic context:

```
1. Initialize ContextProvider (line 308)
   ↓
2. Expose context API to session.context (lines 311-320)
   ↓
3. Detect epic context on first access (lazy)
   ↓
   a. detectEpicContext(cwd) in context-provider.js:21
      - Read docs/plans/ directory
      - Read most recent .md file
      - Parse epic number from markdown
      - Detect repo from git remote
      - Return context object
```

**No actual "session.created" hook found in current codebase.**

**File I/O operations:**
- Directory read: 1 (readdirSync)
- File read: 1 (most recent plan)
- Git command: 1 (git remote)
- **Total: 3 operations**

**Average duration estimate:**
- ~10-50ms (all local operations)
- Cached after first access

### Batching Opportunities

#### 1. **Pre-compute epic context during plugin init**
- **Impact:** LOW
- **Complexity:** LOW
- **Estimated savings:** Minimal (epic detection is already fast)

**Description:** Currently, epic detection is lazy (on first `getContext()` call). Could pre-compute during plugin initialization to populate cache immediately.

**Current code:** Lazy detection in `context-provider.js:16-24`

**Benefit:** Mostly about UX (epic displayed immediately) rather than performance.

#### 2. **Cache git remote detection**
- **Impact:** LOW
- **Complexity:** LOW
- **Estimated savings:** 1 subprocess call per detection

**Description:** `detectRepo()` calls git remote every time. Cache result in ContextProvider.

**Location:** `epic-detector.js:124`

**Tradeoff:** Repo doesn't change during session, so this is safe to cache.

### Parallelization Opportunities

#### 1. **Parallelize plan file scanning**
- **Impact:** LOW
- **Complexity:** MEDIUM
- **Estimated savings:** Minimal for typical use cases

**Description:** If many plan files exist, could read them in parallel to find epic references. Currently reads only most recent.

**Location:** `epic-detector.js:48-81`

**Note:** Current implementation only reads 1 file (most recent), so no parallelism needed. Only relevant if logic changes to scan multiple files.

### Summary: Epic Detection (session.created equivalent)

| Operation | Current | Potential Optimization | Impact |
|-----------|---------|------------------------|--------|
| File reads | 1 plan file | Same (only need most recent) | None |
| Git commands | 1 per detection | Cached | LOW |
| Duration | ~10-50ms | ~5-10ms (with caching) | LOW |

**Verdict:** Epic detection is already efficient. Not a priority for optimization.

---

## Hook 3: experimental.session.compacting

**Location:** NOT FOUND in current codebase

### Current Behavior

**No `session.compacting` hook is implemented in the current version of plugin.js.**

This hook was mentioned in the task description but does not exist in the codebase as of this audit.

### Expected Behavior (if implemented)

Based on the task description, this hook would:
1. Detect when OpenCode compacts the session context
2. Re-inject epic context so it's not lost during compaction
3. Potentially reconstruct context from cache

### Batching Opportunities

**N/A** - Hook not implemented

### Parallelization Opportunities

**N/A** - Hook not implemented

### Recommendation

If/when this hook is implemented:
- Pre-compute epic context during plugin init (see Hook 2, Opportunity #1)
- Cache context object to avoid re-reading files
- Use ContextProvider's existing cache mechanism

---

## Hook 4: session.on('file:change') - Discovered During Audit

**Location:** `plugin.js:338-344`

### Current Behavior

Additional hook discovered during audit (not in original task description):

```
1. Listen for file:change events (line 339)
   ↓
2. Check if path includes 'docs/plans/' (line 340)
   ↓
3. Call contextProvider.invalidateCache(cwd) (line 341)
```

**Operations:**
- String match: 1 (lightweight)
- Cache invalidation: 1 (Map.delete)
- **Total: O(1) operations**

**Average duration:** <1ms (trivial)

### Batching Opportunities

#### 1. **Debounce cache invalidation**
- **Impact:** LOW
- **Complexity:** MEDIUM
- **Estimated savings:** Reduce invalidations during rapid file changes

**Description:** If user rapidly edits plan file, cache is invalidated multiple times. Debounce invalidation to wait for editing to finish.

**Tradeoff:** Adds complexity, minimal benefit (cache repopulation is fast).

### Parallelization Opportunities

**None** - Operation is already O(1) and non-blocking.

### Summary: file:change Hook

**Verdict:** No optimization needed. Already optimal for its purpose.

---

## Additional Discovery: syncExternalProjects Hook

**Location:** `plugin.js:201-245` (function), `plugin.js:283` (called during init)

### Current Behavior

This function runs during plugin initialization (session start) to sync external tracking epics:

```
1. loadCache(owner, repo) (line 203)
   ↓
2. listProjects(cwd) (line 204)
   ↓
3. For each epic in cache.epics (line 209):
   ↓
   a. Check if external tracking epic (line 210)
   b. Find project config (lines 211-220)
   c. syncExternalEpic() - GitHub API call (lines 224-230)
      - fetchExternalIssues() - 1-3 API calls per epic
      - generateExternalEpicBody()
      - updateIssueBody() - 1 API call per epic
   d. Update cache (line 234)
   ↓
4. saveCache() (line 240)
```

**API calls per sync:**
- fetchExternalIssues: 1-3 calls per epic (tries multiple label patterns)
- updateIssueBody: 1 call per epic
- **Total: (2-4) × E calls** (where E = # external tracking epics)

**Average duration estimate:**
- With 3 external epics: ~3-6 seconds

### Batching Opportunities

#### 1. **Batch issue list fetches**
- **Impact:** HIGH
- **Complexity:** MEDIUM
- **Estimated savings:** 2E GitHub API calls (from 3E to E)

**Description:** `fetchExternalIssues()` tries 3 label patterns sequentially:
1. `--label type/epic`
2. `--label epic`
3. All open issues (no label filter)

Instead, fetch all open issues once, filter in memory for epic labels.

**Location:** `external-tracker.js:9-26`

**Current:** 3 API calls, return first non-empty
**Optimized:** 1 API call, return filtered results

#### 2. **Batch issue body updates via GraphQL**
- **Impact:** HIGH
- **Complexity:** MEDIUM
- **Estimated savings:** E-1 API calls

**Description:** Similar to Hook 1, Opportunity #1. Use GraphQL mutation batch to update multiple epic bodies in one request.

**Location:** `external-tracker.js:115`

### Parallelization Opportunities

#### 1. **Parallelize external epic syncs**
- **Impact:** HIGH
- **Complexity:** LOW
- **Estimated savings:** ~75% time reduction for E>2

**Description:** Each external epic sync is independent. Use `Promise.all()` to sync all epics concurrently.

**Current code:** Sequential loop (lines 209-237)
```javascript
for (const epic of cache.epics) {
  if (isExternalTrackingEpic(epic)) {
    await syncExternalEpic(...);
  }
}
```

**Optimized:**
```javascript
const externalEpics = cache.epics.filter(isExternalTrackingEpic);
const syncPromises = externalEpics.map(epic => 
  syncExternalEpic(...)
);
await Promise.all(syncPromises);
```

**Savings:** For 3 external epics @ 2s each: 6s → 2s (67% faster)

### Summary: syncExternalProjects

| Operation | Current | Optimized | Savings |
|-----------|---------|-----------|---------|
| GitHub API calls | (2-4) × E | 2 × E (batch fetch) | 50% calls |
| Duration (3 epics) | ~6s | ~2s | 67% faster |

---

## Overall Recommendations

### High-Priority Optimizations

1. **Parallelize GitHub operations** (Hook 1, Hook 5)
   - Impact: HIGH
   - Complexity: LOW
   - Estimated savings: 60-75% time reduction

2. **Batch GitHub API calls via GraphQL** (Hook 1, Hook 5)
   - Impact: HIGH
   - Complexity: MEDIUM
   - Estimated savings: M-1 calls (epic updates), 2E calls (issue fetches)

3. **Eliminate duplicate cache loads** (Hook 1)
   - Impact: MEDIUM
   - Complexity: LOW
   - Estimated savings: 1 file read per sync

### Medium-Priority Optimizations

4. **Batch cache writes** (Hook 1)
   - Impact: MEDIUM
   - Complexity: LOW
   - Estimated savings: N file writes

5. **Cache git remote detection** (Hook 2)
   - Impact: LOW
   - Complexity: LOW
   - Estimated savings: 1 subprocess call per detection

### Low-Priority (Nice-to-Have)

6. **Debounce cache invalidation** (Hook 4)
   - Impact: LOW
   - Complexity: MEDIUM
   - Skip unless user reports issues with rapid file changes

7. **Parallelize project config reads** (Hook 1)
   - Impact: LOW
   - Complexity: LOW
   - Only worthwhile for >10 projects

---

## Performance Projections

### Baseline (Current)
- **session.idle:** ~3-5s (3 dirty epics, 2 tasks, 5 projects)
- **syncExternalProjects:** ~6s (3 external epics)
- **Total session end latency:** ~9-11s

### Optimized (High-priority changes only)
- **session.idle:** ~1-2s (parallelized + single cache load)
- **syncExternalProjects:** ~2s (parallelized)
- **Total session end latency:** ~3-4s

**Net improvement: 60-65% faster session end**

### Fully Optimized (All recommendations)
- **session.idle:** ~1s (GraphQL batch + parallel + cached)
- **syncExternalProjects:** ~1.5s (GraphQL batch + parallel)
- **Total session end latency:** ~2.5s

**Net improvement: 70-75% faster session end**

---

## Implementation Priority

### Phase 1: Quick Wins (Week 1)
- [x] Parallelize epic syncs (Hook 1, Hook 5)
- [x] Eliminate duplicate cache load (Hook 1)
- [x] Batch cache writes (Hook 1)

**Expected impact:** 50% faster

### Phase 2: GraphQL Batching (Week 2-3)
- [ ] Implement GraphQL batch mutations
- [ ] Add issue node ID caching
- [ ] Batch external issue fetches

**Expected impact:** Additional 15-20% faster

### Phase 3: Polish (Week 4)
- [ ] Cache git remote detection
- [ ] Debounce cache invalidation (if needed)
- [ ] Add performance metrics/logging

**Expected impact:** Additional 5-10% faster

---

## Appendix: Function Call Chains

### landThePlane() Call Chain

```
landThePlane (plugin.js:167)
├── checkForCompletedTasks (plugin.js:76)
│   ├── loadConfig (config-loader.js)
│   ├── loadCache (cache-manager.js:27)
│   ├── findCompletedTasks (task-completion-detector.js:84)
│   │   └── getRecentCommits (task-completion-detector.js:36)
│   │       └── execSync('git log ...') [SUBPROCESS]
│   ├── recordTaskCompletion (epic-updater.js) [N times]
│   └── saveCache (cache-manager.js:57)
├── loadCache (cache-manager.js:27) [DUPLICATE!]
├── syncDirtyEpics (plugin.js:33)
│   ├── getDirtyEpics (cache-manager.js:149)
│   └── execGh('issue edit ...') [M times, SEQUENTIAL]
├── clearDirtyFlags (cache-manager.js:158)
├── saveCache (cache-manager.js:57)
├── listProjects (project-manager.js:10)
│   └── readFileSync (config.json) [P times]
└── calculatePowerlevel (project-manager.js:54)
```

### syncExternalProjects() Call Chain

```
syncExternalProjects (plugin.js:201)
├── loadCache (cache-manager.js:27)
├── listProjects (project-manager.js:10)
├── [For each epic] syncExternalEpic (external-tracker.js:105) [SEQUENTIAL]
│   ├── fetchExternalIssues (external-tracker.js:9)
│   │   ├── execGh('issue list --label type/epic') [API CALL]
│   │   ├── execGh('issue list --label epic') [API CALL if first fails]
│   │   └── execGh('issue list') [API CALL if both fail]
│   ├── generateExternalEpicBody (external-tracker.js:75)
│   └── updateIssueBody (github-cli.js:138)
│       └── execGh('issue edit ... --body-file') [API CALL]
└── saveCache (cache-manager.js:57)
```

---

## Audit Metadata

**Date:** 2026-02-10  
**Auditor:** AI Agent (OpenCode + Claude Sonnet 4.5)  
**Codebase Version:** powerlevel @ main branch  
**Files Analyzed:**
- `plugin.js` (358 lines)
- `lib/cache-manager.js` (256 lines)
- `lib/github-cli.js` (312 lines)
- `lib/external-tracker.js` (183 lines)
- `lib/epic-detector.js` (232 lines)
- `lib/context-provider.js` (61 lines)
- `lib/task-completion-detector.js` (111 lines)
- `lib/project-manager.js` (69 lines)

**Total Lines Analyzed:** 1,582 lines
