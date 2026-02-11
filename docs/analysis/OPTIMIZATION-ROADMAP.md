# Powerlevel Optimization Roadmap

**Date:** 2026-02-10  
**Status:** Ready for Implementation  
**Purpose:** Consolidate all performance analysis findings into prioritized implementation phases

---

## Executive Summary

**Total optimization opportunities identified:** 18 distinct optimizations across 5 analysis areas

**Estimated impact:**
- **API calls reduction:** 4% fewer requests (48 → 46 per session)
- **Session duration reduction:** 65% faster (12-18s → 5-7s)
- **Cache I/O reduction:** 84-93% fewer file operations (13-33 → 2)
- **Rate limit consumption:** Not a bottleneck (<1% per session, 99% headroom)

**Critical insight:** **Latency is the bottleneck, not rate limits.** Parallelization provides massive user experience wins (60-75% speedup) with zero rate limit cost.

**Recommended implementation order:**
1. **Phase 1:** Quick wins (parallelization, cache elimination) → 65% faster sessions
2. **Phase 2:** Strategic optimizations (batching, in-memory cache) → Additional 40% faster
3. **Phase 3:** Future-proofing (token usage, monitoring) → Maintainability & observability

---

## Optimization Opportunities Matrix

| # | Optimization | Impact | Complexity | Savings | Source |
|---|-------------|--------|------------|---------|--------|
| 1 | Parallelize external epic syncs | High | Low | 75% faster (6s → 2s) | Task 3 |
| 2 | Parallelize sub-issue creation | High | Medium | 75% faster (2s → 0.5s) | Task 3 |
| 3 | Parallelize project board additions | High | Low | 83% faster (3s → 0.6s) | Task 3 |
| 4 | In-memory cache singleton | High | Low | 84-93% fewer file ops | Task 5 |
| 5 | Eliminate duplicate cache loads | Medium | Low | 1 file read per sync | Task 1 |
| 6 | Optimize external issue fetching | Medium | Low | 2-8 REST requests saved | Task 4 |
| 7 | Cache project field metadata | Low | Low | 3 GraphQL points saved | Task 2, Task 4 |
| 8 | Batch GitHub issue updates (GraphQL) | Medium | Medium | 31 fewer round trips | Task 1 |
| 9 | Batch project board mutations | High | Medium | 31 fewer round trips | Task 2 |
| 10 | Batch sub-issue creation (GraphQL) | Low | High | Latency win, rate limit cost | Task 2 |
| 11 | Batch comment creation | Medium | Low | 4-5 API calls → 1 | Task 2 |
| 12 | Parallelize metadata + issues fetch | Low | Low | 13% faster (0.8s → 0.5s) | Task 3 |
| 13 | Cache git remote detection | Low | Low | 1 subprocess per detection | Task 1 |
| 14 | Reduce verbose console logging | Low | Low | Fewer tokens in context | New |
| 15 | Optimize context passing to skills | Low | Medium | Fewer tokens per invocation | New |
| 16 | Apply retry logic to API calls | Medium | Low | Improved reliability | Task 2 |
| 17 | Add rate limit monitoring | Low | Medium | Observability | Task 4 |
| 18 | TTL-based cache invalidation | Low | Medium | Multi-device support | Task 5 |

---

## Quick Wins (Phase 1)

**Goal:** Reduce session latency by 65% with minimal complexity  
**Estimated time:** 7-10 hours  
**Risk:** Low

### 1. Parallelize External Epic Syncs

- **Impact:** High (75% faster, 6s → 2s for 4 epics)
- **Complexity:** Low
- **Estimated savings:** 4 seconds per session start
- **Implementation effort:** 2 hours
- **Files affected:** `bin/sync-external-epics.js` (lines 32-46)
- **Description:** Convert sequential `for` loop to `Promise.all()` with map. Each external epic sync is fully independent (different repos, no shared state).

**Implementation:**
```javascript
// BEFORE: Sequential loop
for (const sync of syncs) {
  await syncExternalEpic(...);
}

// AFTER: Parallel execution
const syncPromises = syncs.map(sync => syncExternalEpic(...));
const results = await Promise.all(syncPromises);
```

**Prerequisites:** None

---

### 2. Parallelize Sub-Issue Creation

- **Impact:** High (75% faster for 5+ tasks, 2s → 0.5s)
- **Complexity:** Medium (error handling for individual failures)
- **Estimated savings:** 1.5 seconds per 5-task epic
- **Implementation effort:** 3 hours
- **Files affected:** `bin/create-epic.js` (lines 117-142)
- **Description:** Use `Promise.allSettled()` to create sub-issues concurrently. Individual failures shouldn't block others.

**Implementation:**
```javascript
// BEFORE: Sequential loop
for (const task of tasks) {
  const subIssueNumber = createSubIssue(...);
}

// AFTER: Parallel with error isolation
const promises = tasks.map(task => 
  createSubIssue(...).catch(err => ({ error: err.message }))
);
const results = await Promise.allSettled(promises);
```

**Prerequisites:** None

---

### 3. Parallelize Project Board Additions

- **Impact:** High (83% faster for 5+ sub-issues, 3s → 0.6s)
- **Complexity:** Low
- **Estimated savings:** 2.4 seconds per 5-task epic
- **Implementation effort:** 2 hours
- **Files affected:** `bin/create-epic.js` (lines 236-289)
- **Description:** Add all items to project board concurrently using `Promise.allSettled()`.

**Implementation:**
```javascript
// BEFORE: Sequential loop
for (const subIssue of subIssues) {
  const nodeId = getIssueNodeId(...);
  addIssueToProject(...);
  updateProjectItemField(...);
}

// AFTER: Parallel batch
const promises = subIssues.map(subIssue => addToBoard(subIssue));
await Promise.allSettled(promises);
```

**Prerequisites:** None

---

**Phase 1 Total Impact:**
- **Duration reduction:** 12-18s → 5-7s (65% faster)
- **API calls:** No change (same operations, just concurrent)
- **Rate limit:** 0 additional points consumed

---

## Medium Complexity (Phase 2)

**Goal:** Further reduce latency and improve architecture  
**Estimated time:** 12-18 hours  
**Risk:** Low-Medium

### 4. In-Memory Cache Singleton

- **Impact:** High (84-93% fewer file operations)
- **Complexity:** Low
- **Estimated savings:** 11-31 file operations per session
- **Implementation effort:** 4-6 hours
- **Files affected:** `lib/cache-manager.js`, `plugin.js`, `lib/session-hooks.js`, `lib/epic-updater.js`
- **Description:** Load cache once per session, keep in memory, flush only on session end or critical operations.

**Implementation:**
```javascript
// New: lib/cache-instance.js
class CacheInstance {
  constructor(owner, repo) {
    this.data = null;
    this.dirty = false;
  }
  
  load() {
    if (!this.data) {
      this.data = loadCache(this.owner, this.repo);
    }
    return this.data;
  }
  
  save(force = false) {
    if (this.dirty || force) {
      saveCache(this.owner, this.repo, this.data);
      this.dirty = false;
    }
  }
}
```

**Prerequisites:** None

---

### 5. Eliminate Duplicate Cache Loads

- **Impact:** Medium (1 file read saved per sync)
- **Complexity:** Low
- **Estimated savings:** 1-2ms per operation
- **Implementation effort:** 1 hour
- **Files affected:** `plugin.js` (lines 172-175)
- **Description:** Load cache once at start of `landThePlane()`, pass to both `checkForCompletedTasks()` and `syncDirtyEpics()`.

**Implementation:**
```javascript
// BEFORE
await checkForCompletedTasks(owner, repo, cwd);
const cache = loadCache(owner, repo);
await syncDirtyEpics(owner, repo, cache);

// AFTER
const cache = loadCache(owner, repo);
await checkForCompletedTasks(owner, repo, cwd, cache);
await syncDirtyEpics(owner, repo, cache);
```

**Prerequisites:** Refactor `checkForCompletedTasks()` to accept cache parameter

---

### 6. Optimize External Issue Fetching

- **Impact:** Medium (2-8 REST requests saved per session)
- **Complexity:** Low
- **Estimated savings:** 2 requests per external epic (on average)
- **Implementation effort:** 1 hour
- **Files affected:** `lib/external-tracker.js` (lines 9-26)
- **Description:** Fetch all open issues once, filter in memory instead of 3 sequential label attempts.

**Implementation:**
```javascript
// BEFORE: 3 label attempts (1-3 API calls)
try { issues = gh issue list --label type/epic }
catch { issues = gh issue list --label epic }
catch { issues = gh issue list }

// AFTER: 1 fetch, in-memory filter (1 API call)
issues = gh issue list
epicIssues = issues.filter(i => i.labels.includes('type/epic') || i.labels.includes('epic'))
```

**Prerequisites:** None

---

### 7. Cache Project Field Metadata

- **Impact:** Low (3 GraphQL points saved per session)
- **Complexity:** Low
- **Estimated savings:** 1 GraphQL query per epic (50% reduction)
- **Implementation effort:** 1 hour
- **Files affected:** `lib/project-field-manager.js` (lines 6-34)
- **Description:** Cache project field schema in memory (Map) with session-lifetime TTL.

**Implementation:**
```javascript
const fieldCache = new Map();

export function getProjectFields(owner, projectNumber, useCache = true) {
  const key = `${owner}:${projectNumber}`;
  if (useCache && fieldCache.has(key)) {
    return fieldCache.get(key);
  }
  
  const fields = execGraphQL(query);
  fieldCache.set(key, fields);
  return fields;
}
```

**Prerequisites:** None

---

### 8. Batch Project Board Mutations

- **Impact:** High (31 fewer network round trips per epic)
- **Complexity:** Medium
- **Estimated savings:** 3-5 seconds per epic (latency, not rate limit)
- **Implementation effort:** 8 hours
- **Files affected:** `lib/project-item-manager.js`
- **Description:** Use GraphQL aliased mutations to batch all project board operations into 2 requests (1 for adds, 1 for field updates).

**Implementation:**
```javascript
// BEFORE: 33 sequential requests (epic + 10 sub-issues)
// 11 addItem + 22 updateField = 33 requests

// AFTER: 2 batched requests
// 1 batch add (11 aliased mutations)
// 1 batch update (22 aliased mutations)

mutation {
  item0: addProjectV2ItemById(input: {...}) { item { id } }
  item1: addProjectV2ItemById(input: {...}) { item { id } }
  // ... 9 more
}
```

**Prerequisites:** 
- Implement `batchAddItemsToProject()`
- Implement `batchUpdateItemFields()`
- Implement `batchGetIssueNodeIds()`

---

### 9. Batch Comment Creation (Journey Sync)

- **Impact:** Medium (4-5 comments → 1 request)
- **Complexity:** Low
- **Estimated savings:** 4 API calls per epic with journey events
- **Implementation effort:** 2 hours
- **Files affected:** `lib/land-the-plane.js` (hypothetical, not yet implemented)
- **Description:** When syncing journey events as GitHub comments, batch into single GraphQL mutation.

**Implementation:**
```javascript
mutation {
  c1: addComment(input: {subjectId: "...", body: "..."}) { ... }
  c2: addComment(input: {subjectId: "...", body: "..."}) { ... }
  c3: addComment(input: {subjectId: "...", body: "..."}) { ... }
}
```

**Prerequisites:** Journey sync feature must be implemented first

---

### 10. Apply Retry Logic to API Calls

- **Impact:** Medium (improved reliability, no performance gain)
- **Complexity:** Low
- **Estimated savings:** Graceful handling of transient rate limit/network errors
- **Implementation effort:** 2 hours
- **Files affected:** `lib/project-item-manager.js`, `lib/github-cli.js`
- **Description:** Apply existing `retryWithBackoff()` function (lines 6-20) to all GraphQL operations.

**Implementation:**
```javascript
// Already exists but unused!
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('rate limit') && i < maxRetries - 1) {
        await sleep(baseDelay * Math.pow(2, i));
      } else {
        throw error;
      }
    }
  }
}
```

**Prerequisites:** None

---

**Phase 2 Total Impact:**
- **Duration reduction:** 5-7s → 3-4s (additional 40% faster)
- **API calls:** 48 → 46 per session (4% reduction)
- **File I/O:** 13-33 → 2 operations per session (84-93% reduction)

---

## Strategic Investments (Phase 3)

**Goal:** Future-proofing, observability, and token optimization  
**Estimated time:** 8-12 hours  
**Risk:** Low

### 11. Parallelize Metadata + Issues Fetch (track-project.js)

- **Impact:** Low (13% faster, 0.8s → 0.5s)
- **Complexity:** Low
- **Estimated savings:** 300ms per project tracking setup
- **Implementation effort:** 30 minutes
- **Files affected:** `bin/track-project.js` (lines 348-420)
- **Description:** Fetch repo metadata and external issues in parallel.

**Prerequisites:** None

---

### 12. Cache Git Remote Detection

- **Impact:** Low (1 subprocess call saved per detection)
- **Complexity:** Low
- **Estimated savings:** ~50ms per operation
- **Implementation effort:** 30 minutes
- **Files affected:** `lib/epic-detector.js` (line 124)
- **Description:** Cache `git remote` output in ContextProvider since repo doesn't change during session.

**Prerequisites:** None

---

### 13. Reduce Verbose Console Logging

- **Impact:** Low (fewer tokens in OpenCode context)
- **Complexity:** Low
- **Estimated savings:** 500-1000 tokens per epic creation
- **Implementation effort:** 2 hours
- **Files affected:** `bin/create-epic.js`, `bin/track-project.js`, `plugin.js`
- **Description:** Replace verbose console.log() with concise progress indicators. Move detailed output to `--verbose` flag.

**Current verbosity examples:**
```javascript
// bin/create-epic.js: 30+ console.log statements
console.log('═'.repeat(60));
console.log('Creating epic on GitHub...');
console.log(`  Title: ${plan.title}`);
console.log(`  Priority: ${plan.priority}`);
// ... etc
```

**Proposed:**
```javascript
// Concise by default
console.log('✓ Created epic #123 with 5 sub-issues');

// Verbose mode (--verbose flag)
if (args.verbose) {
  console.log(`  Title: ${plan.title}`);
  console.log(`  Priority: ${plan.priority}`);
}
```

**Token savings:**
- Current epic creation output: ~1000 tokens
- Proposed epic creation output: ~100 tokens
- **90% reduction in context bloat**

**Prerequisites:** Add `--verbose` flag parser to bin scripts

---

### 14. Optimize Context Passing to Skills

- **Impact:** Low (fewer tokens per skill invocation)
- **Complexity:** Medium
- **Estimated savings:** 200-500 tokens per skill invocation
- **Implementation effort:** 4 hours
- **Files affected:** `plugin.js`, `lib/context-provider.js`, `lib/session-hooks.js`
- **Description:** When passing epic context to OpenCode session, provide minimal necessary data instead of full cache.

**Current approach:**
```javascript
// plugin.js:316 - Passes full context object
session.context.getEpic = () => ({
  display: contextProvider.getDisplayString(cwd),
  url: contextProvider.getEpicUrl(cwd),
  raw: contextProvider.getContext(cwd)  // Full epic object
});
```

**Proposed:**
```javascript
// Only pass essential fields
session.context.getEpic = () => ({
  display: contextProvider.getDisplayString(cwd),
  url: contextProvider.getEpicUrl(cwd),
  raw: {
    epicNumber: context.epicNumber,
    epicTitle: context.epicTitle,
    planFile: context.planFile,
    repo: context.repo
    // Omit: full cache, sub_issues array, journey array
  }
});
```

**Token savings:**
- Current context: ~500 tokens (includes cache arrays)
- Proposed context: ~100 tokens (minimal fields)
- **80% reduction per context reference**

**Prerequisites:** Audit all `session.context.getEpic()` usage to ensure minimal context is sufficient

---

### 15. Add Rate Limit Monitoring

- **Impact:** Low (observability, no performance gain)
- **Complexity:** Medium
- **Estimated savings:** Early warning when approaching limits
- **Implementation effort:** 3 hours
- **Files affected:** `lib/github-cli.js`, `plugin.js`
- **Description:** Check rate limit before expensive operations, log warnings when <100 requests remaining.

**Implementation:**
```javascript
export function checkRateLimit() {
  const result = execGh('api rate_limit --jq .rate');
  return JSON.parse(result);
}

// In landThePlane()
const rateLimit = checkRateLimit();
if (rateLimit.remaining < 100) {
  console.warn(`⚠ Low rate limit: ${rateLimit.remaining}/5000`);
  console.warn(`Resets: ${new Date(rateLimit.reset * 1000)}`);
}
```

**Prerequisites:** None

---

### 16. TTL-Based Cache Invalidation

- **Impact:** Low (multi-device workflow support)
- **Complexity:** Medium
- **Estimated savings:** Prevents stale cache for external modifications
- **Implementation effort:** 3-4 hours
- **Files affected:** `lib/cache-manager.js`
- **Description:** Add `metadata.cached_at` and `metadata.ttl_seconds` to cache, reload from GitHub when expired.

**Implementation:**
```javascript
{
  "epics": [...],
  "metadata": {
    "cached_at": "2026-02-10T20:00:00Z",
    "ttl_seconds": 3600
  }
}

// On loadCache()
if (Date.now() - cache.metadata.cached_at > cache.metadata.ttl_seconds * 1000) {
  cache = reloadFromGitHub(owner, repo);
}
```

**Prerequisites:** None

---

**Phase 3 Total Impact:**
- **Token usage:** 1000-1500 tokens saved per epic creation
- **Observability:** Rate limit monitoring, cache freshness
- **Multi-device support:** Cache invalidation for concurrent workflows

---

## Implementation Considerations

### Testing Strategy

**Unit tests:**
- Test batch functions independently (mock GitHub API responses)
- Test error handling for partial failures in `Promise.allSettled()`
- Test cache singleton isolation (multiple repos)

**Integration tests:**
- End-to-end epic creation with parallelization
- Session end sync with in-memory cache
- External project sync with batched fetches

**Performance benchmarks:**
```bash
# Baseline (before optimizations)
time node bin/create-epic.js test-plan-10-tasks.md

# After Phase 1 (parallelization)
time node bin/create-epic.js test-plan-10-tasks.md

# After Phase 2 (batching + cache)
time node bin/create-epic.js test-plan-10-tasks.md
```

**Expected improvements:**
- Baseline: 5-8 seconds
- Phase 1: 2-3 seconds (60% faster)
- Phase 2: 1-2 seconds (75% faster)

---

### Rollback Plan

**Feature flags:**
```json
{
  "experimental": {
    "parallelExecution": true,
    "inMemoryCache": true,
    "batchedGraphQL": true
  }
}
```

**Graceful degradation:**
- If GraphQL batch fails → Fall back to sequential gh CLI calls
- If in-memory cache crashes → Reload from disk (existing behavior)
- If parallel execution errors → Log and continue (Promise.allSettled pattern)

**Rollback steps:**
1. Set feature flag to `false` in `.opencode/config.json`
2. Restart OpenCode session
3. Previous behavior restored (no code changes required)

---

### Monitoring

**Metrics to track:**
- Session start duration (plugin initialization)
- Epic creation duration (bin/create-epic.js)
- Session end duration (landThePlane)
- API calls per session (REST + GraphQL)
- Cache hit rate (reads avoided)
- File I/O count per session

**Instrumentation points:**
```javascript
console.time('epic-creation');
// ... epic creation logic
console.timeEnd('epic-creation');

console.log(`API calls: ${apiCallCount} REST, ${graphqlPoints} GraphQL`);
console.log(`Cache: ${cacheHits} hits, ${cacheMisses} misses`);
```

**Success criteria:**
- Phase 1: Session latency reduced by 50%+
- Phase 2: File I/O reduced by 80%+
- Phase 3: Token usage reduced by 50%+

---

## Deferred/Not Recommended

These optimizations were considered but deferred due to complexity vs. benefit trade-offs:

### 1. Batch Sub-Issue Creation via GraphQL (Task 2, Opportunity 4)

**Why deferred:**
- **Rate limit cost:** Migrating from REST to GraphQL increases point consumption by 10 per epic
- **Latency gain:** Only 1-2 seconds saved (already achieved via parallelization with 0 rate limit cost)
- **Complexity:** High (requires CLI → GraphQL migration, token handling)

**Verdict:** Parallelization (Phase 1, #2) provides same latency benefit with zero rate limit cost and lower complexity.

---

### 2. Incremental JSON Patch (Task 5, Opportunity 3)

**Why deferred:**
- **Current cache sizes:** <50 KB (negligible serialization time)
- **Complexity:** High (diffing algorithm, patch reconstruction, error recovery)
- **Benefit:** Only relevant when cache exceeds 100 KB regularly

**Revisit when:** Average cache size > 100 KB or write latency > 50ms

---

### 3. Async Cache with Locking (Task 5, Opportunity 4)

**Why deferred:**
- **Minimal performance gain:** File I/O already <5ms (sync is fast enough)
- **Complexity:** High (async/await refactor, mutex management, breaking change)
- **Non-blocking benefit:** Only matters during plugin init (negligible UX impact)

**Verdict:** Keep synchronous I/O for simplicity.

---

### 4. Debounce Cache Invalidation (Task 1, Hook 4)

**Why deferred:**
- **Low impact:** Cache repopulation is already fast (~10ms)
- **Complexity:** Medium (timer management, edge cases)
- **Risk:** Adds complexity for minimal benefit

**Revisit when:** User reports issues with rapid file changes causing performance problems.

---

### 5. Parallelize Project Config Reads (Task 1, Hook 1)

**Why deferred:**
- **Low impact:** Only worthwhile for >10 projects (most users have 1-5)
- **Benefit:** Negligible (~10ms saved)

**Revisit when:** Average user tracks >10 projects simultaneously.

---

### 6. Pre-compute Epic Context During Plugin Init (Task 1, Hook 2)

**Why deferred:**
- **Current approach:** Lazy loading is already fast (~10-50ms)
- **Benefit:** Mostly UX (epic displayed 50ms earlier), not performance

**Verdict:** Not worth complexity. Lazy loading is fine.

---

## Appendices

### Appendix A: Impact Calculation Methodology

**Latency measurements:**
- Baseline: Measured via `time node bin/script.js` for typical workloads
- Parallelization: Calculated as `max(operation_times)` vs `sum(operation_times)`
- Example: 4 epics @ 2s each: Sequential = 8s, Parallel = 2s (75% faster)

**API call savings:**
- Counted by analyzing call sites in code
- Verified via GitHub API rate limit endpoint (`gh api rate_limit`)
- Example: 10 sub-issues = 10 sequential `gh issue create` calls

**File I/O reduction:**
- Counted via static code analysis (`grep loadCache`, `grep saveCache`)
- Typical session: 8 reads + 5 writes = 13 operations
- In-memory cache: 1 read + 1 write = 2 operations (84% reduction)

**Token usage estimation:**
- Measured via character count in console.log output
- Approximate token ratio: 4 characters = 1 token
- Example: 1000-character output = 250 tokens

---

### Appendix B: References

**Analysis documents:**
- [Session Hooks Audit](session-hooks-audit.md) - Task 1
- [Library Batching Audit](library-batching-audit.md) - Task 2
- [Scripts Parallelization Audit](scripts-parallelization-audit.md) - Task 3
- [Rate Limit Analysis](rate-limit-analysis.md) - Task 4
- [Cache Optimization Analysis](cache-optimization-analysis.md) - Task 5

**External documentation:**
- [GitHub GraphQL API](https://docs.github.com/en/graphql)
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)
- [Node.js Promise.allSettled()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled)

---

## Self-Review

**Completeness:**
- ✅ Incorporated all 5 analysis documents (Tasks 1-5)
- ✅ Extracted 18 distinct optimization opportunities
- ✅ Analyzed token usage patterns in codebase
- ✅ Grouped into 3 implementation phases with clear dependencies

**Quality:**
- ✅ Prioritization justified by impact/complexity matrix
- ✅ Impact estimates are specific and measurable
- ✅ Implementation considerations are comprehensive (testing, rollback, monitoring)
- ✅ Deferred optimizations documented with clear rationale

**Discipline:**
- ✅ Focused on synthesis (consolidated findings from 5 docs)
- ✅ Recommendations are clear and actionable with time estimates
- ✅ Document is well-structured and easy to navigate
- ✅ Critical insight emphasized: Latency > Rate Limits

**Key Findings:**
- **Parallelization is the biggest win:** 65% faster with zero rate limit cost
- **In-memory cache eliminates 84-93% of file I/O:** Simple architecture improvement
- **Token optimization underexplored:** Verbose logging and full context passing waste tokens
- **Rate limit is not a bottleneck:** <1% consumption per session, focus on latency instead

---

**End of Roadmap**

