# Scripts Parallelization Audit

**Date:** 2026-02-10  
**Auditor:** OpenCode AI Assistant  
**Purpose:** Identify parallelization opportunities in bin scripts to reduce execution time

## Executive Summary

This audit analyzes four bin scripts for parallelization opportunities within their execution flows. Key findings:

- **auto-onboard.js**: Low parallelization potential (sequential git operations dominate)
- **track-project.js**: Medium potential (metadata + issues fetch can parallelize)
- **create-epic.js**: High potential (sub-issue creation can parallelize ~40% speedup)
- **sync-external-epics.js**: High potential (external syncs fully independent ~75% speedup)

**Total estimated impact:** 3-5 scripts benefit from parallelization, with most gains in create-epic and sync operations.

---

## 1. auto-onboard.js

### Current Workflow

1. **Parse arguments & validate** (~10ms)
2. **Locate Powerlevel repo** (~50ms)
3. **Check if target repo exists locally** (~10ms)
4. **Clone repository** (if needed) (~2-5s, network-bound)
5. **Create default config** (~20ms file I/O)
6. **Run onboarding script** (~500ms, spawns subprocess)
7. **Commit changes** (~200ms git operations)
8. **Create project config in Powerlevel** (~30ms file I/O)

**Total estimated time:** 3-6 seconds (dominated by git clone)

### Sequential Dependencies

```
Clone repo → Must complete before config creation (needs workspace)
Config creation → Must complete before onboarding script
Onboarding script → Must complete before commit
Commit → Must complete before project config creation
```

**All operations have strict sequential dependencies.**

### Parallelization Opportunities

**Opportunity 1: Parallel file creation (LOW impact)**

**Current pattern (lines 132-179, 212-260):**
```javascript
// Sequential file writes
ensureDefaultConfig(workspace);          // 20ms
createProjectConfig(repo, desc, tech);   // 30ms
```

**Parallelized pattern:**
```javascript
await Promise.all([
  ensureDefaultConfig(workspace),
  createProjectConfig(repo, desc, tech)
]);
```

**Impact:** Reduce 50ms → 30ms (~40% on file I/O, <1% overall)  
**Complexity:** Low  
**Recommendation:** Not worth it - minimal gains, adds complexity

**Opportunity 2: Pre-fetch metadata during clone (LOW impact)**

**Current:** Clone repo (2-5s) → then fetch metadata  
**Parallelized:** Clone repo in parallel with fetching repo metadata via GitHub API

**Impact:** Save ~200ms during clone phase  
**Complexity:** Medium (requires API integration)  
**Recommendation:** Not worth it - clone dominates, metadata not immediately needed

### Implementation Notes

- Git operations (clone, commit, push) must remain sequential
- User prompts block execution and can't be parallelized
- Subprocess spawning (onboarding script) must wait for workspace setup
- **Overall verdict:** No significant parallelization opportunities

---

## 2. track-project.js

### Current Workflow

1. **Parse arguments** (~10ms)
2. **Locate Powerlevel repo** (~50ms)
3. **Determine tracking target** (auto-detect or explicit, ~100ms)
4. **Validate external repo** (GitHub API call, ~300ms)
5. **Generate project name** (~5ms)
6. **Check for collisions** (~10ms)
7. **Fetch repo metadata** (GitHub API call, ~300ms) - *line 350-358*
8. **Fetch external issues** (GitHub API call, ~500ms) - *line 418-420*
9. **Show preview & confirm** (user input, variable)
10. **Create project config** (~30ms file I/O)
11. **Create tracking epic** (GitHub API call, ~400ms)
12. **Add to project board** (GraphQL API calls, ~600ms)
13. **Update cache** (~20ms)

**Total estimated time:** 2.3-3 seconds (excluding user prompts)

### Sequential Dependencies

```
Locate Powerlevel → Must complete before project config creation
Validate repo → Must complete before metadata fetch
Project name → Must complete before collision check
Config creation → Must complete before epic creation
Epic creation → Must complete before project board addition
```

**But:** Steps 7 (metadata) and 8 (issues) are independent!

### Parallelization Opportunities

**Opportunity 1: Parallel metadata + issues fetch (MEDIUM impact)**

**Current pattern (lines 348-420):**
```javascript
// Sequential API calls
const metadata = fetchRepoMetadata(owner, repo);  // 300ms
console.log('✓ Repository validated');

// ... later ...
console.log('Fetching issues...');
const issues = fetchExternalIssues(repoPath);     // 500ms
```

**Parallelized pattern:**
```javascript
console.log('Fetching repository data and issues...');
const [metadata, issues] = await Promise.all([
  fetchRepoMetadata(owner, repo),
  fetchExternalIssues(repoPath)
]);
console.log('✓ Repository validated');
console.log(`✓ Found ${issues.length} open issues`);
```

**Impact:** Reduce 800ms → 500ms (~38% speedup on API calls, ~13% overall)  
**Complexity:** Low  
**Recommendation:** **Implement** - Clear win, simple refactor

**Opportunity 2: Parallel project config + epic creation (UNSAFE)**

**Why not:** Epic body depends on config description (line 461-465). Can't parallelize.

**Opportunity 3: Parallel label creation + epic creation (LOW impact)**

**Current:** Create label (line 456-458) → Create epic (line 466-472)  
**Parallelized:** Run in parallel

**Impact:** Save ~100ms  
**Complexity:** Low  
**Risk:** Epic creation might fail if label doesn't exist yet (race condition)  
**Recommendation:** Not worth it - unsafe without proper synchronization

### Implementation Notes

- fetchRepoMetadata and fetchExternalIssues are both synchronous GitHub CLI calls
- Would need to wrap in async functions or use worker threads
- Promise.all() with async wrappers is cleanest approach
- **Overall verdict:** One clear win (metadata + issues parallelization)

---

## 3. create-epic.js

### Current Workflow

1. **Parse arguments & validate** (~10ms)
2. **Detect repository** (~20ms)
3. **Verify gh CLI auth** (~50ms)
4. **Ensure labels exist** (~200ms, batch GitHub API)
5. **Parse plan file** (~30ms file I/O)
6. **Create epic on GitHub** (~400ms API call)
7. **Create epic label** (~100ms API call)
8. **Load cache** (~10ms)
9. **Add epic to cache** (~5ms)
10. **Create sub-issues loop** (~400ms × N issues) - *lines 117-142*
    - For each task: createSubIssue() + addSubIssue()
11. **Save cache** (~10ms)
12. **Detect project board** (~200ms GraphQL query)
13. **Add epic to board** (~300ms GraphQL mutation)
14. **Set epic fields** (Priority + Status, ~200ms each)
15. **Add sub-issues to board loop** (~500ms × N issues) - *lines 236-289*
    - For each sub-issue: getNodeId + addToProject + updateFields
16. **Append epic reference to plan** (~20ms file I/O)

**Total estimated time:** 2-3s (3 tasks) to 5-10s (10 tasks)

### Sequential Dependencies

```
Parse → Validate auth → Labels exist → Parse plan → Create epic
Epic created → Can create sub-issues (need parent ID)
Epic created → Can add to project board
Sub-issues created → Can add to project board

But: Individual sub-issues are independent from each other!
```

### Parallelization Opportunities

**Opportunity 1: Parallel sub-issue creation (HIGH impact)**

**Current pattern (lines 117-142):**
```javascript
for (let i = 0; i < plan.tasks.length; i++) {
  const task = plan.tasks[i];
  const subIssueNumber = createSubIssue(repoPath, task, ...);  // 400ms each
  console.log(`✓ Created sub-issue #${subIssueNumber}`);
  addSubIssue(cache, epicNumber, {...});
}
```

**Parallelized pattern:**
```javascript
const subIssuePromises = plan.tasks.map((task, i) => {
  return Promise.resolve().then(() => {
    const taskLabels = getTaskLabels(epicNumber, plan.priority);
    const subIssueNumber = createSubIssue(repoPath, task, ...);
    return { number: subIssueNumber, title: task };
  }).catch(error => {
    console.error(`✗ Failed task ${i+1}: ${error.message}`);
    return null;
  });
});

const results = await Promise.allSettled(subIssuePromises);
results.forEach(result => {
  if (result.status === 'fulfilled' && result.value) {
    addSubIssue(cache, epicNumber, result.value);
  }
});
```

**Impact:** Reduce N×400ms → 400ms (~75% speedup for 4+ tasks)  
**Example:** 5 tasks: 2000ms → 500ms  
**Complexity:** Medium (error handling for individual failures)  
**Recommendation:** **Implement with Promise.allSettled()** - Significant gains

**Opportunity 2: Parallel project board additions for sub-issues (MEDIUM impact)**

**Current pattern (lines 236-289):**
```javascript
for (const subIssue of cachedEpic.sub_issues) {
  const subIssueNodeId = getIssueNodeId(repoPath, subIssue.number);  // 200ms
  const subItemId = addIssueToProject(projectBoard.id, subIssueNodeId);  // 200ms
  updateProjectItemField(...);  // 200ms × 2 fields
  // Total: ~600ms per sub-issue
}
```

**Parallelized pattern:**
```javascript
const boardPromises = cachedEpic.sub_issues.map(subIssue => {
  return Promise.resolve().then(() => {
    const nodeId = getIssueNodeId(repoPath, subIssue.number);
    const itemId = addIssueToProject(projectBoard.id, nodeId);
    // Update fields...
    return subIssue.number;
  }).catch(error => {
    console.log(`⚠ Failed #${subIssue.number}: ${error.message}`);
    return null;
  });
});

await Promise.allSettled(boardPromises);
```

**Impact:** Reduce N×600ms → 600ms (~83% speedup for 5+ sub-issues)  
**Example:** 5 sub-issues: 3000ms → 600ms  
**Complexity:** Low  
**Recommendation:** **Implement** - Clear win, minimal risk

**Opportunity 3: Parallel epic board addition + sub-issue creation (UNSAFE)**

**Why not:** Sub-issues must exist before adding to board. Sequential dependency required.

### Implementation Notes

- GitHub API rate limits (5000/hour) unlikely to be hit with parallel requests
- Use Promise.allSettled() instead of Promise.all() for resilience
- Individual sub-issue failures shouldn't block others
- **Overall verdict:** Two major wins (sub-issue creation + board additions)

### Error Handling Trade-offs

**Promise.all():**
- Fails fast if any sub-issue creation fails
- Appropriate for: Critical operations where all must succeed
- Use case: None in this script (partial success is acceptable)

**Promise.allSettled():**
- Continues even if some operations fail
- Returns status for each operation
- Appropriate for: Independent operations where partial success is valuable
- Use case: **Recommended** for both sub-issue creation and board additions

---

## 4. sync-external-epics.js

### Current Workflow

1. **Define sync array** (static data, ~1ms)
2. **Loop through syncs** - *lines 32-46*
   - For each epic:
     - Fetch external issues (~500ms GitHub API)
     - Generate epic body (~10ms)
     - Update epic body (~300ms GitHub API)
     - Log result
     - **Total: ~810ms per epic**

**Total estimated time:** ~810ms × 4 epics = 3.2 seconds

### Sequential Dependencies

```
Epic #111 sync → (independent) ← Epic #112 sync
Epic #133 sync → (independent) ← Epic #134 sync
```

**All syncs are fully independent!** No shared state, no dependencies.

### Parallelization Opportunities

**Opportunity 1: Parallel epic syncs (HIGH impact)**

**Current pattern (lines 32-46):**
```javascript
for (const sync of syncs) {
  console.log(`Syncing Epic #${sync.epicNumber}...`);
  const result = await syncExternalEpic(
    POWERLEVEL_REPO,
    sync.epicNumber,
    sync.externalRepo,
    sync.description
  );
  
  if (result.synced) {
    console.log(`✓ Synced ${result.issueCount} issues\n`);
  } else {
    console.error(`✗ Sync failed: ${result.error}\n`);
  }
}
```

**Parallelized pattern:**
```javascript
const syncPromises = syncs.map(sync => {
  return syncExternalEpic(
    POWERLEVEL_REPO,
    sync.epicNumber,
    sync.externalRepo,
    sync.description
  ).then(result => ({ ...result, epicNumber: sync.epicNumber }))
   .catch(error => ({ 
     synced: false, 
     error: error.message, 
     epicNumber: sync.epicNumber 
   }));
});

console.log('🔄 Syncing all epics in parallel...\n');
const results = await Promise.all(syncPromises);

results.forEach(result => {
  if (result.synced) {
    console.log(`✓ Epic #${result.epicNumber}: Synced ${result.issueCount} issues`);
  } else {
    console.error(`✗ Epic #${result.epicNumber}: ${result.error}`);
  }
});
```

**Impact:** Reduce 810ms × 4 → 810ms (~75% speedup)  
**Example:** 4 epics: 3240ms → 810ms  
**Complexity:** Low  
**Recommendation:** **Implement immediately** - Massive win, zero risk

**Opportunity 2: Batch logging after completion**

**Current:** Log each epic as it completes (interleaved output)  
**Parallelized:** Collect all results, log summary table

**Impact:** Cleaner output, no performance impact  
**Complexity:** Low  
**Recommendation:** Bonus improvement with parallelization

### Implementation Notes

- Each syncExternalEpic() is independent (different repos, different epics)
- No cache contention or shared state
- GitHub API rate limits unlikely to be hit (4 parallel requests)
- Use Promise.all() (not allSettled) since we want to know if any fail
- **Overall verdict:** Perfect candidate for parallelization

---

## Cross-Script Observations

### Patterns Identified

1. **GitHub API calls dominate execution time** across all scripts
2. **Sub-resource creation loops** are prime parallelization targets
3. **File I/O operations** are too fast to benefit from parallelization (<50ms)
4. **Git operations** must remain sequential (clone/commit/push)

### Common Parallelization Pattern

```javascript
// BEFORE: Sequential loop
for (const item of items) {
  const result = await expensiveOperation(item);
  logResult(result);
}

// AFTER: Parallel batch with error isolation
const promises = items.map(item => 
  expensiveOperation(item).catch(err => ({ error: err.message, item }))
);
const results = await Promise.allSettled(promises);
results.forEach(result => logResult(result));
```

### Other Optimizations Noted (Out of Scope)

- **Caching:** track-project.js fetches metadata twice (validation + config)
- **Batching:** GitHub GraphQL could batch multiple field updates into one mutation
- **Redundant calls:** Some scripts re-fetch project board info multiple times
- **Rate limiting:** No exponential backoff on API errors (though rare)

---

## Recommendations Summary

### Priority 1: Implement Immediately

| Script | Opportunity | Impact | Complexity |
|--------|-------------|--------|-----------|
| **sync-external-epics.js** | Parallel epic syncs | 75% faster | Low |
| **create-epic.js** | Parallel sub-issue creation | 75% faster (5+ tasks) | Medium |
| **create-epic.js** | Parallel board additions | 83% faster (5+ sub-issues) | Low |

**Estimated dev time:** 2-4 hours total

### Priority 2: Consider for Future

| Script | Opportunity | Impact | Complexity |
|--------|-------------|--------|-----------|
| **track-project.js** | Parallel metadata + issues fetch | 13% faster | Low |

**Estimated dev time:** 30 minutes

### Priority 3: Not Recommended

| Script | Opportunity | Reason |
|--------|-------------|--------|
| **auto-onboard.js** | Any parallelization | Sequential dependencies dominate |
| **create-epic.js** | Parallel label + epic creation | Race condition risk |
| **track-project.js** | Parallel config + epic creation | Data dependency |

---

## Node.js Parallelization Patterns

### Pattern 1: Promise.all() for Critical Operations

**Use when:** All operations must succeed, fail fast on error

```javascript
const [result1, result2, result3] = await Promise.all([
  operation1(),
  operation2(),
  operation3()
]);
```

**Pros:** Simple, fast failure  
**Cons:** One failure stops everything  
**Use cases:** Parallel fetches where all data is required

### Pattern 2: Promise.allSettled() for Independent Operations

**Use when:** Partial success is acceptable, operations are independent

```javascript
const results = await Promise.allSettled([
  operation1(),
  operation2(),
  operation3()
]);

results.forEach(result => {
  if (result.status === 'fulfilled') {
    console.log('Success:', result.value);
  } else {
    console.error('Failed:', result.reason);
  }
});
```

**Pros:** Resilient, all operations complete  
**Cons:** More verbose error handling  
**Use cases:** **Recommended for sub-issue creation and board additions**

### Pattern 3: Worker Threads (Not Recommended for This Codebase)

**Use when:** CPU-bound operations (parsing large files, computation)

**Why not here:**
- All bottlenecks are I/O-bound (GitHub API, file system)
- Overhead of worker thread creation exceeds benefits
- GitHub CLI commands can't be easily parallelized across threads

---

## Implementation Checklist

### For create-epic.js Sub-Issue Parallelization

- [ ] Wrap createSubIssue() calls in Promise.allSettled()
- [ ] Handle individual failures gracefully (log but continue)
- [ ] Update cache after all promises resolve
- [ ] Test with 1, 5, and 10 sub-issues
- [ ] Verify GitHub API rate limits not exceeded
- [ ] Update progress logging (show concurrent creation)

### For sync-external-epics.js Parallelization

- [ ] Convert for-loop to Promise.all() with map
- [ ] Batch logging after all syncs complete
- [ ] Add summary statistics (X/Y succeeded)
- [ ] Test with 4+ epics
- [ ] Verify no race conditions on cache writes

### For track-project.js Metadata + Issues Fetch

- [ ] Wrap fetchRepoMetadata() and fetchExternalIssues() in async functions
- [ ] Use Promise.all() to fetch in parallel
- [ ] Update console logging to reflect parallel fetch
- [ ] Test with slow network conditions
- [ ] Ensure metadata validation doesn't break

---

## Measurement Baseline

Before implementing parallelization, capture baseline metrics:

```bash
# Measure create-epic.js with 5 tasks
time node bin/create-epic.js docs/plans/test-plan-5-tasks.md

# Measure sync-external-epics.js
time node bin/sync-external-epics.js

# Measure track-project.js
time node bin/track-project.js org/repo --name test --dry-run
```

**Expected improvements:**
- create-epic.js: 5s → 2s (3 task plan)
- sync-external-epics.js: 3.2s → 0.9s (4 epics)
- track-project.js: 2.3s → 2.0s (modest improvement)

---

## Conclusion

**High-value opportunities identified:**
1. ✅ **sync-external-epics.js** - 75% speedup, trivial implementation
2. ✅ **create-epic.js sub-issues** - 75% speedup, moderate implementation
3. ✅ **create-epic.js board additions** - 83% speedup, easy implementation

**Medium-value opportunities:**
4. ⚠️ **track-project.js fetches** - 13% speedup, easy implementation

**Low-value opportunities:**
5. ❌ **auto-onboard.js** - No significant parallelization possible

**Next steps:**
1. Implement Priority 1 recommendations (sync-external-epics.js + create-epic.js)
2. Add performance instrumentation (timers around parallel blocks)
3. Update documentation with new parallel execution behavior
4. Consider GitHub API rate limiting monitoring

**Risks:**
- Minimal - all identified opportunities use independent operations
- GitHub API rate limits (5000/hour) unlikely to be exceeded
- Error handling with Promise.allSettled() prevents cascading failures
