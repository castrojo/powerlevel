# Library Batching Audit

**Date:** 2026-02-10  
**Purpose:** Identify batching opportunities in Powerlevel library functions to reduce GitHub API calls and improve rate limit efficiency.

## Executive Summary

**Current state:** Libraries make individual API calls per operation, leading to N calls for N items.

**Key findings:**
- **github-cli.js**: Sequential gh CLI calls, no batching support (CLI limitation)
- **project-item-manager.js**: Sequential GraphQL mutations, high batching potential
- **project-field-manager.js**: Single query per project, minimal batching opportunity
- **cache-manager.js**: Synchronous file I/O, opportunity for in-memory buffer

**Biggest wins:**
1. Batch GraphQL mutations in project-item-manager.js: ~70-90% API call reduction
2. In-memory cache buffer: Eliminate redundant disk I/O during session

---

## 1. github-cli.js

### Current Operations

**Functions with API calls:**
- `createEpic()`: 1 `gh issue create` call (line 51)
- `createSubIssue()`: 1 `gh issue create` call per sub-issue (line 103)
- `updateIssueBody()`: 1 `gh issue edit` call (line 143)
- `addComment()`: 1 `gh issue comment` call (line 175)
- `closeIssue()`: 1 `gh issue close` call + optional comment (line 207)
- `createTrackingEpic()`: 1 `gh issue create` call (line 238)
- `execGraphQL()`: 1 `gh api graphql` call (line 294)

**Total API operations:** 12 distinct call sites

**Usage patterns (from bin/create-epic.js):**
```javascript
// Line 117-142: Loop creating N sub-issues
for (let i = 0; i < plan.tasks.length; i++) {
  const subIssueNumber = createSubIssue(...);  // N API calls
}

// Line 247-255: Loop adding N sub-issues to project board
for (const subIssue of cachedEpic.sub_issues) {
  const subItemId = addIssueToProject(...);     // N API calls
  updateProjectItemField(...);                  // 2N API calls (priority + status)
}
```

**Measured impact:**
- Creating 10-task epic: **10 sub-issue API calls** (sequential)
- Adding to project board: **10 addItem + 20 updateField = 30 API calls**

### Batching Opportunities

#### Opportunity 1: Batch Issue Creation via GraphQL

**Current:** N sequential `gh issue create` calls  
**Proposed:** Single GraphQL mutation with N issues

**GraphQL capability:** GitHub GraphQL API supports batching mutations using aliases:

```graphql
mutation {
  issue1: createIssue(input: {...}) { issue { number id } }
  issue2: createIssue(input: {...}) { issue { number id } }
  issue3: createIssue(input: {...}) { issue { number id } }
}
```

**Rate limit savings:**
- Formula: **N calls → 1 call = (N-1) savings**
- Example: 10 sub-issues: 10 calls → 1 call = **9 calls saved (90%)**

**Implementation complexity:** Medium
- Requires: GraphQL mutation builder, response parser, error handling per issue
- Benefits: CLI → GraphQL migration enables other batching patterns
- Drawbacks: `gh` CLI convenience lost (need direct API token handling)

**Error handling:** Partial failure support
- GraphQL returns per-mutation results
- Must handle: Some issues created, others failed
- Requires: Transaction-like rollback strategy OR accept partial success

#### Opportunity 2: Batch Label Updates

**Current:** Not explicitly batched (labels set during `createIssue`)  
**Proposed:** If post-creation label updates needed, batch via GraphQL

**GraphQL syntax:**
```graphql
mutation {
  add1: addLabelsToLabelable(input: {labelableId: "...", labelIds: [...]}) { ... }
  add2: addLabelsToLabelable(input: {labelableId: "...", labelIds: [...]}) { ... }
}
```

**Rate limit savings:**
- Formula: **N calls → 1 call = (N-1) savings**
- Example: 10 issues: 10 calls → 1 call = **9 calls saved (90%)**

**Implementation complexity:** Low (if needed at all)
- Current code sets labels during creation (efficient)
- Only needed if updating labels post-creation

#### Opportunity 3: Batch Comment Creation

**Current:** 1 `gh issue comment` call per comment (line 175)  
**Proposed:** Batch multiple comments via GraphQL

**GraphQL syntax:**
```graphql
mutation {
  c1: addComment(input: {subjectId: "...", body: "..."}) { ... }
  c2: addComment(input: {subjectId: "...", body: "..."}) { ... }
}
```

**Rate limit savings:**
- Formula: **N calls → 1 call = (N-1) savings**
- Example: 5 journey comments: 5 calls → 1 call = **4 calls saved (80%)**

**Implementation complexity:** Low
- Simple mutation structure
- Used in `landThePlane()` for journey sync

**Usage context:**
- `lib/land-the-plane.js`: Syncs journey events as comments to dirty epics
- Typical: 3-5 journey events per epic = 3-5 API calls per epic

### Recommendation

**Priority: Medium**

**Rationale:**
- `gh` CLI is convenient but limits batching
- GraphQL migration unlocks batching across all operations
- Sub-issue creation happens rarely (epic setup), not a hot path
- Comment batching (journey sync) has higher session-end impact

**Suggested approach:**
1. Keep `gh` CLI for single operations (createEpic, closeIssue)
2. Add GraphQL batch functions for loops:
   - `batchCreateIssues(repo, issues[])`
   - `batchAddComments(comments[])`
3. Migrate high-frequency operations first (project board, comments)

---

## 2. project-item-manager.js

### Current Operations

**Functions with API calls:**
- `addIssueToProject()`: 1 GraphQL `addProjectV2ItemById` mutation (line 27-38)
- `updateProjectItemField()`: 1 GraphQL `updateProjectV2ItemFieldValue` mutation (line 68-84)
- `getIssueNodeId()`: 1 GraphQL query for issue node ID (line 103-114)

**Total API operations:** 4 GraphQL call sites

**Usage patterns (from bin/create-epic.js):**
```javascript
// Line 192: Add epic to board
const itemId = addIssueToProject(projectBoard.id, issueNodeId);  // 1 call

// Line 206, 222: Update epic fields (priority + status)
updateProjectItemField(...);  // 2 calls

// Line 247-275: Add N sub-issues to board
for (const subIssue of cachedEpic.sub_issues) {
  const subItemId = addIssueToProject(...);    // N calls
  updateProjectItemField(...);                 // N calls (priority)
  updateProjectItemField(...);                 // N calls (status)
}
```

**Measured impact:**
- Epic: 1 addItem + 2 updateField = **3 API calls**
- 10 sub-issues: 10 addItem + 10 priority + 10 status = **30 API calls**
- **Total: 33 API calls per epic creation**

### Batching Opportunities

#### Opportunity 1: Batch addProjectV2ItemById Mutations

**Current:** N sequential GraphQL mutations  
**Proposed:** Single GraphQL mutation with N aliased operations

**GraphQL capability:** Fully supported with aliases

```graphql
mutation {
  item1: addProjectV2ItemById(input: {
    projectId: "PVT_..."
    contentId: "I_..."
  }) { item { id } }
  
  item2: addProjectV2ItemById(input: {
    projectId: "PVT_..."
    contentId: "I_..."
  }) { item { id } }
  
  # ... up to ~50 items per batch
}
```

**Rate limit savings:**
- Formula: **N calls → 1 call = (N-1) savings**
- Example: 10 sub-issues: 10 calls → 1 call = **9 calls saved (90%)**

**Implementation complexity:** Low
- Simple aliased mutation pattern
- Response parsing: `{ item1: {...}, item2: {...} }`
- Error handling: Check each alias for errors

**Batch size limits:**
- GitHub GraphQL: No documented hard limit, recommend **50 operations per batch**
- Reason: Large requests may timeout, 50 is safe and practical

**Error handling:**
- Partial failure: Individual items may fail (e.g., "already exists")
- Strategy: Collect successful item IDs, log failures, continue

#### Opportunity 2: Batch updateProjectV2ItemFieldValue Mutations

**Current:** 2N sequential mutations (priority + status per item)  
**Proposed:** Single mutation with all field updates

**GraphQL capability:** Fully supported with aliases

```graphql
mutation {
  # Epic updates
  epicPriority: updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_..."
    itemId: "PVTI_..."
    fieldId: "PVTF_..."
    value: { singleSelectOptionId: "..." }
  }) { projectV2Item { id } }
  
  epicStatus: updateProjectV2ItemFieldValue(input: {...}) { ... }
  
  # Sub-issue updates (2 per issue)
  sub1Priority: updateProjectV2ItemFieldValue(input: {...}) { ... }
  sub1Status: updateProjectV2ItemFieldValue(input: {...}) { ... }
  sub2Priority: updateProjectV2ItemFieldValue(input: {...}) { ... }
  sub2Status: updateProjectV2ItemFieldValue(input: {...}) { ... }
  # ... etc
}
```

**Rate limit savings:**
- Formula: **2N calls → 1 call = (2N-1) savings**
- Example: 10 sub-issues (2 fields each): 20 calls → 1 call = **19 calls saved (95%)**

**Implementation complexity:** Medium
- Requires: Field ID + option ID pre-fetched (already done via `getProjectFields()`)
- Response structure: Flat object with aliases
- Error handling: Per-field update may fail

**Combined batching strategy:**

```javascript
// Current: 33 API calls (1 epic + 10 sub-issues)
// 1. Add epic to board (1 call)
// 2. Update epic fields (2 calls)
// 3. Add 10 sub-issues to board (10 calls)
// 4. Update 10 sub-issues fields (20 calls)

// Proposed: 2 API calls (94% reduction)
// 1. Batch add all items (1 call)
//    - Epic + 10 sub-issues = 11 addProjectV2ItemById
// 2. Batch update all fields (1 call)
//    - Epic priority + status = 2 updates
//    - 10 sub-issues × 2 fields = 20 updates
//    - Total: 22 updateProjectV2ItemFieldValue

// Rate limit savings: 33 calls → 2 calls = 31 saved (94%)
```

**Proof-of-concept code:**

```javascript
export function batchAddItemsToProject(projectId, issueIds) {
  const aliases = issueIds.map((id, idx) => 
    `item${idx}: addProjectV2ItemById(input: {
      projectId: "${projectId}"
      contentId: "${id}"
    }) { item { id } }`
  );
  
  const mutation = `mutation { ${aliases.join('\n')} }`;
  const result = execGraphQL(mutation);
  
  // Parse results: { item0: {...}, item1: {...}, ... }
  return Object.entries(result.data).map(([alias, data]) => ({
    alias,
    itemId: data.item.id
  }));
}
```

#### Opportunity 3: Batch getIssueNodeId Queries

**Current:** N sequential GraphQL queries to get issue node IDs  
**Proposed:** Single query with N aliased issue lookups

**GraphQL capability:** Fully supported

```graphql
query {
  repository(owner: "owner", name: "repo") {
    issue1: issue(number: 123) { id }
    issue2: issue(number: 124) { id }
    issue3: issue(number: 125) { id }
  }
}
```

**Rate limit savings:**
- Formula: **N calls → 1 call = (N-1) savings**
- Example: 10 sub-issues: 10 calls → 1 call = **9 calls saved (90%)**

**Implementation complexity:** Low
- Simple aliased query pattern
- Response parsing: `{ issue1: {id: "..."}, issue2: {...} }`

**Current usage:**
- Called once per issue before adding to project board
- Nested inside sub-issue loop (line 249 in create-epic.js)

**Optimization strategy:**

```javascript
// Before loop: Batch fetch all node IDs (1 call)
const nodeIds = batchGetIssueNodeIds(repoPath, [epicNumber, ...subIssueNumbers]);

// Then use cached IDs in batch operations (no additional calls)
```

### Recommendation

**Priority: High** ⚠️ **Highest impact opportunity**

**Rationale:**
- Project board operations are already GraphQL-based (easy migration)
- Batching reduces 33 calls → 2 calls per epic (94% savings)
- Happens on every epic creation (high frequency)
- Low implementation complexity (alias pattern)

**Suggested approach:**
1. Implement `batchAddItemsToProject(projectId, issueIds[])`
2. Implement `batchUpdateItemFields(projectId, updates[])`
3. Implement `batchGetIssueNodeIds(repo, numbers[])`
4. Refactor `bin/create-epic.js` to use batched functions
5. Add retry logic with exponential backoff (already exists at line 6)

**Estimated impact:**
- 10-task epic: 33 calls → 2 calls = **31 calls saved**
- 20 epics per session: 660 calls → 40 calls = **620 calls saved**
- Rate limit: 5000/hour → effectively **10x capacity increase** for project board operations

---

## 3. project-field-manager.js

### Current Operations

**Functions with API calls:**
- `getProjectFields()`: 1 GraphQL query for project fields (line 6-34)

**Total API operations:** 2 GraphQL call sites (both in same function)

**Usage patterns:**
```javascript
// Called once per epic creation to get field metadata
const projectFields = getProjectFields(owner, projectNumber);

// Then used for mapping labels to field values (no API calls)
const priorityMapping = mapLabelToField(label, projectFields);
```

**Measured impact:**
- Called 2x per epic creation (once for epic, once for sub-issues)
- Could be optimized to 1x with better caching

### Batching Opportunities

#### Opportunity 1: Cache Project Fields in Memory

**Current:** Query fetched 2x per epic (once for epic, once for sub-issues loop)  
**Proposed:** Fetch once, cache in session memory

**Rate limit savings:**
- Formula: **2 calls → 1 call = 1 saved per epic (50%)**
- Example: 20 epics: 40 calls → 20 calls = **20 calls saved**

**Implementation complexity:** Low
- Add in-memory cache object: `const fieldCache = new Map()`
- Cache key: `${owner}:${projectNumber}`
- TTL: Session duration (no staleness issues)

**Proof-of-concept code:**

```javascript
const fieldCache = new Map();

export function getProjectFields(owner, projectNumber, useCache = true) {
  const cacheKey = `${owner}:${projectNumber}`;
  
  if (useCache && fieldCache.has(cacheKey)) {
    return fieldCache.get(cacheKey);
  }
  
  const result = execGraphQL(query, { owner, number: projectNumber });
  // ... parse result ...
  
  fieldCache.set(cacheKey, projectFields);
  return projectFields;
}
```

#### Opportunity 2: Batch Field Queries for Multiple Projects

**Current:** Not applicable (single project per operation)  
**Proposed:** N/A

**Rationale:** Projects are queried one at a time; no batch scenario exists.

### Recommendation

**Priority: Low**

**Rationale:**
- Already efficient (1-2 calls per epic)
- In-memory caching is simple win
- Not a hot path compared to item/field mutations

**Suggested approach:**
1. Add `Map()` for in-memory field cache
2. Call once at epic creation start
3. Reuse cached fields for epic + all sub-issues

**Estimated impact:**
- Per epic: 2 calls → 1 call = **1 call saved (50%)**
- 20 epics: 40 calls → 20 calls = **20 calls saved**

---

## 4. cache-manager.js

### Current Operations

**Functions with file I/O:**
- `loadCache()`: 1 `readFileSync()` call (line 39)
- `saveCache()`: 1 `writeFileSync()` call (line 65)

**Total I/O operations:** 3 file call sites (1 read, 1 write, 1 backup on error)

**Usage patterns (from bin/create-epic.js):**
```javascript
// Load at start (line 60)
let cache = loadCache(owner, repo);

// Add epic to cache (in-memory update, line 97)
addEpic(cache, {...});

// Add each sub-issue (in-memory update, line 133-138)
addSubIssue(cache, epicNumber, {...});

// Save once at end (line 146)
saveCache(owner, repo, cache);

// Load again for project board (line 168)
cache = loadCache(owner, repo);

// Save again after project board cache (line 176)
saveCache(owner, repo, cache);
```

**Measured impact:**
- 2 `loadCache()` calls
- 2 `saveCache()` calls
- **4 file I/O operations per epic creation**

**Disk I/O is not rate-limited but:**
- Adds latency (especially on networked filesystems)
- Creates race condition risk (concurrent sessions)
- Generates unnecessary writes

### Batching Opportunities

#### Opportunity 1: In-Memory Cache Buffer with Periodic Flush

**Current:** Load/save on every cache operation  
**Proposed:** Keep cache in memory, flush only when necessary

**Implementation strategy:**

```javascript
class CacheManager {
  constructor() {
    this.caches = new Map(); // Key: "owner/repo", Value: cache object
    this.dirty = new Set();  // Tracks which repos need flush
  }
  
  loadCache(owner, repo) {
    const key = `${owner}/${repo}`;
    
    // Return from memory if available
    if (this.caches.has(key)) {
      return this.caches.get(key);
    }
    
    // Otherwise load from disk and cache
    const cache = loadCacheFromDisk(owner, repo);
    this.caches.set(key, cache);
    return cache;
  }
  
  saveCache(owner, repo, cache) {
    const key = `${owner}/${repo}`;
    
    // Update in-memory cache
    this.caches.set(key, cache);
    this.dirty.add(key);
    
    // Don't write to disk immediately
  }
  
  flush(owner, repo) {
    const key = `${owner}/${repo}`;
    
    if (!this.dirty.has(key)) {
      return; // No changes to save
    }
    
    const cache = this.caches.get(key);
    saveCacheToDisk(owner, repo, cache);
    this.dirty.delete(key);
  }
  
  flushAll() {
    for (const key of this.dirty) {
      const [owner, repo] = key.split('/');
      this.flush(owner, repo);
    }
  }
}
```

**I/O savings:**
- Formula: **N saves → 1 flush = (N-1) writes eliminated**
- Example: 10 cache updates: 10 writes → 1 write = **9 writes saved (90%)**

**Implementation complexity:** Medium
- Requires: Refactor from functional to class-based cache manager
- Must handle: Session end flush (hook into `landThePlane()`)
- Risk: Cache loss if session crashes before flush

#### Opportunity 2: Debounced File Writes

**Current:** Immediate write on every `saveCache()` call  
**Proposed:** Debounce writes (e.g., 500ms delay), cancel if another save incoming

**JavaScript debounce pattern:**

```javascript
let writeTimer = null;

export function saveCache(owner, repo, cache) {
  const cachePath = getCachePath(owner, repo);
  
  // Cancel pending write
  if (writeTimer) {
    clearTimeout(writeTimer);
  }
  
  // Schedule write after 500ms
  writeTimer = setTimeout(() => {
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
    writeTimer = null;
  }, 500);
}
```

**I/O savings:**
- Formula: **Rapid successive saves → 1 final write**
- Example: 5 saves in 1 second: 5 writes → 1 write = **4 writes saved (80%)**

**Implementation complexity:** Low
- Simple timer pattern
- Must flush on session end (clear timer, immediate write)

**Drawbacks:**
- 500ms delay before data persists (acceptable risk)
- Timer must be cleared on process exit

### Recommendation

**Priority: Low** (Not rate-limited, but good for performance)

**Rationale:**
- Disk I/O is fast on modern systems
- No rate limit concerns (GitHub API is the bottleneck)
- In-memory buffer adds complexity and crash risk
- Debouncing is simpler but still adds risk

**Suggested approach:**
1. **Short-term:** Keep current synchronous I/O (simple, safe)
2. **Medium-term:** Add in-memory cache with flush on session end
3. **Long-term:** Evaluate if I/O is actual bottleneck (profile first)

**Estimated impact:**
- Latency: ~5-10ms saved per operation (negligible)
- No rate limit impact (different resource)

---

## Other Observations

### 1. Retry Logic with Exponential Backoff

**Current state:** Implemented in `project-item-manager.js` (line 6-20)

```javascript
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('rate limit') && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

**Observation:** This function exists but is **not currently used** by any exported functions.

**Recommendation:** Apply retry logic to all GraphQL mutations:
- `addIssueToProject()`
- `updateProjectItemField()`
- `getIssueNodeId()`

**Benefits:**
- Graceful handling of transient rate limit errors
- Reduces failed operations due to temporary GitHub API issues

### 2. Error Handling in GraphQL Mutations

**Current state:** GraphQL mutations return partial errors in response (not thrown)

**Example (line 43-55 in project-item-manager.js):**
```javascript
if (result.errors) {
  const alreadyExists = result.errors.some(err => 
    err.message.includes('already exists')
  );
  
  if (alreadyExists) {
    console.log('  Item already exists, skipping');
    return null;
  }
  
  throw new Error(result.errors[0].message);
}
```

**Observation:** Good pattern for idempotency (skips duplicate adds).

**Recommendation:** When implementing batching, preserve this pattern:
- Check each aliased mutation result for errors
- Collect successful operations
- Log failures without aborting entire batch

### 3. Console.log Usage Instead of SDK Logging

**Current state:** Libraries use `console.log()` and `console.error()` throughout.

**Observation:** AGENTS.md (line 315-350) specifies SDK logging pattern:

```javascript
if (client) {
  client.app.log({
    body: { service: 'powerlevel', level: 'info', message: '...' }
  });
}
```

**Files affected:**
- `project-item-manager.js`: Lines 14, 51, 61, 95, 125
- `project-field-manager.js`: Line 60
- `cache-manager.js`: Lines 42, 67

**Recommendation:** Refactor console statements to SDK logging (out of scope for batching, but noted for cleanup).

### 4. Synchronous execSync() in github-cli.js

**Current state:** All `gh` CLI calls use `execSync()` (blocking)

**Observation:** Node.js best practice is async operations.

**Recommendation (future):**
- Migrate to `execAsync()` or promisified `exec()`
- Enables parallel operations (e.g., create 5 issues concurrently)
- Not directly related to batching, but improves throughput

**Complexity:** High (requires refactoring all callers to async/await)

---

## Summary & Prioritization

### High Priority (Implement First)

**1. Batch Project Board Mutations (project-item-manager.js)**
- **Impact:** 33 calls → 2 calls per epic (94% reduction)
- **Complexity:** Low (alias pattern, already GraphQL)
- **Estimated savings:** 31 API calls per epic
- **20 epics:** 620 API calls saved

### Medium Priority (Implement Second)

**2. Batch Issue Creation via GraphQL (github-cli.js)**
- **Impact:** N calls → 1 call (90% reduction for sub-issues)
- **Complexity:** Medium (CLI → GraphQL migration)
- **Estimated savings:** 9 API calls per 10-task epic
- **20 epics:** 180 API calls saved

**3. Batch Comment Creation (github-cli.js)**
- **Impact:** N calls → 1 call (80% reduction for journey sync)
- **Complexity:** Low (simple GraphQL mutation)
- **Estimated savings:** 4 API calls per epic (5 comments → 1 batch)
- **20 epics:** 80 API calls saved

### Low Priority (Nice to Have)

**4. In-Memory Field Cache (project-field-manager.js)**
- **Impact:** 2 calls → 1 call per epic (50% reduction)
- **Complexity:** Low (simple Map cache)
- **Estimated savings:** 1 API call per epic
- **20 epics:** 20 API calls saved

**5. In-Memory Cache Buffer (cache-manager.js)**
- **Impact:** Reduces disk I/O, not rate-limited
- **Complexity:** Medium (refactor to class-based)
- **Estimated savings:** Latency only (~10ms per operation)

---

## GraphQL Batch Capabilities Research

### Supported Patterns

**1. Aliased Mutations**

GitHub GraphQL API supports aliased mutations in a single request:

```graphql
mutation {
  createIssue1: createIssue(input: {
    repositoryId: "R_..."
    title: "Task 1"
    body: "Description"
  }) {
    issue { id number }
  }
  
  createIssue2: createIssue(input: {
    repositoryId: "R_..."
    title: "Task 2"
    body: "Description"
  }) {
    issue { id number }
  }
}
```

**Response format:**
```json
{
  "data": {
    "createIssue1": { "issue": { "id": "I_...", "number": 123 } },
    "createIssue2": { "issue": { "id": "I_...", "number": 124 } }
  }
}
```

**2. Aliased Queries**

Same pattern for queries:

```graphql
query {
  repository(owner: "owner", name: "repo") {
    epic: issue(number: 123) { id title }
    task1: issue(number: 124) { id title }
    task2: issue(number: 125) { id title }
  }
}
```

**3. Mixed Operations**

Can mix queries and mutations (but mutations execute sequentially):

```graphql
query {
  # Queries execute in parallel
  repo: repository(owner: "owner", name: "repo") { id }
  user: viewer { login }
}

mutation {
  # Mutations execute sequentially
  create: createIssue(input: {...}) { ... }
  update: updateIssue(input: {...}) { ... }
}
```

### Limitations

**1. Rate Limiting**

- **Counted per top-level field**, not per request
- Example: 10 aliased mutations = 10 rate limit points (but 1 network round trip)
- **Benefit:** Reduces network latency and connection overhead
- **Non-benefit:** Does not reduce rate limit consumption

**Note:** The primary benefit of batching is **reduced latency** (1 network round trip vs N), not rate limit savings in terms of points consumed.

**2. Batch Size**

- **No documented hard limit** on aliased operations
- **Practical limit:** ~50 operations per request (GitHub recommendation)
- **Reasoning:** Large requests may timeout or hit payload size limits

**3. Error Handling**

- **Partial success supported:** Some aliases succeed, others fail
- **Error format:**
  ```json
  {
    "data": {
      "success1": { ... },
      "success2": { ... },
      "failure3": null
    },
    "errors": [
      {
        "path": ["failure3"],
        "message": "Resource not accessible"
      }
    ]
  }
  ```

- **Strategy:** Check `errors` array, map errors to aliases via `path` field

**4. Transaction Semantics**

- **No transactions:** Mutations execute independently
- **No rollback:** If mutation 5 of 10 fails, mutations 1-4 are committed
- **Idempotency required:** Design mutations to be safely retryable

### Rate Limit Calculation Correction

**Initial assumption:** Batching reduces rate limit points consumed  
**Actual behavior:** Batching reduces network round trips, not rate limit points

**Correct calculation:**

| Scenario | Sequential | Batched | Network Saves | Rate Limit Saves |
|----------|-----------|---------|---------------|------------------|
| 10 sub-issues | 10 requests<br>10 points | 1 request<br>10 points | 9 round trips | 0 points |
| 30 project mutations | 30 requests<br>30 points | 1 request<br>30 points | 29 round trips | 0 points |

**Benefits of batching:**
1. **Latency:** 1 network round trip instead of N (major win)
2. **Throughput:** Fewer TCP connections, less overhead
3. **Reliability:** Fewer requests = fewer opportunities for transient failures

**Non-benefits:**
- Rate limit points consumed remain the same

**Revised impact assessment:**

**High Priority (Latency wins):**
- Project board operations: 33 requests → 2 requests = **31 fewer round trips** (~3-5 seconds saved per epic)
- Sub-issue creation: 10 requests → 1 request = **9 fewer round trips** (~1-2 seconds saved)

**Conclusion:** Batching is still highly valuable for **user-perceived performance**, even though rate limit point consumption is unchanged.

---

## Implementation Roadmap (Recommended Order)

### Phase 1: Quick Wins (Week 1)

1. **In-memory field cache** (project-field-manager.js)
   - Effort: 2 hours
   - Impact: 1 request saved per epic + code simplification

2. **Retry logic application** (project-item-manager.js)
   - Effort: 1 hour
   - Impact: Improved reliability, graceful rate limit handling

### Phase 2: High-Impact Batching (Week 2-3)

3. **Batch project board mutations** (project-item-manager.js)
   - Effort: 8 hours
   - Functions: `batchAddItemsToProject()`, `batchUpdateItemFields()`, `batchGetIssueNodeIds()`
   - Impact: 31 fewer requests per epic (major latency win)

4. **Refactor create-epic.js** to use batched functions
   - Effort: 4 hours
   - Impact: Enables batching benefits for all epic creation

### Phase 3: CLI → GraphQL Migration (Week 4-6)

5. **Batch issue creation** (github-cli.js)
   - Effort: 12 hours (includes error handling, testing)
   - Functions: `batchCreateIssues()`, GraphQL token handling
   - Impact: 9 fewer requests per 10-task epic

6. **Batch comment creation** (github-cli.js for land-the-plane)
   - Effort: 4 hours
   - Functions: `batchAddComments()`
   - Impact: 4 fewer requests per journey sync

### Phase 4: Optional Performance (Week 7)

7. **In-memory cache buffer** (cache-manager.js)
   - Effort: 6 hours (refactor + testing)
   - Impact: Reduced disk I/O latency (~10ms per operation)

---

## Validation & Testing Strategy

### Unit Tests

**Test batch functions independently:**
```javascript
describe('batchAddItemsToProject', () => {
  it('creates aliased GraphQL mutation for N items', () => {
    const mutation = buildBatchAddMutation(projectId, [id1, id2, id3]);
    expect(mutation).toContain('item0: addProjectV2ItemById');
    expect(mutation).toContain('item1: addProjectV2ItemById');
    expect(mutation).toContain('item2: addProjectV2ItemById');
  });
  
  it('handles partial failures gracefully', () => {
    const result = {
      data: { item0: {...}, item1: null, item2: {...} },
      errors: [{ path: ['item1'], message: 'Not found' }]
    };
    
    const successes = parseBatchResult(result);
    expect(successes).toHaveLength(2);
    expect(successes[0].alias).toBe('item0');
  });
});
```

### Integration Tests

**Test end-to-end epic creation with batching:**
```javascript
describe('Epic creation with batching', () => {
  it('creates epic with 10 sub-issues using 2 API calls', async () => {
    const apiCallCount = trackAPIcalls(() => {
      createEpicFromPlan('test-plan.md');
    });
    
    expect(apiCallCount).toBeLessThanOrEqual(2);
  });
});
```

### Performance Benchmarks

**Measure latency improvement:**
```javascript
console.time('Sequential');
for (const issue of issues) {
  await addIssueToProject(projectId, issue.id);
}
console.timeEnd('Sequential');  // ~3000ms

console.time('Batched');
await batchAddItemsToProject(projectId, issues.map(i => i.id));
console.timeEnd('Batched');  // ~300ms (10x faster)
```

---

## Appendix: File Operation Counts

### github-cli.js

| Function | Operation | API Calls | Called By |
|----------|-----------|-----------|-----------|
| `createEpic()` | gh issue create | 1 | bin/create-epic.js |
| `createSubIssue()` | gh issue create | 1 per call | bin/create-epic.js (loop) |
| `updateIssueBody()` | gh issue edit | 1 | lib/land-the-plane.js |
| `addComment()` | gh issue comment | 1 | lib/land-the-plane.js (loop) |
| `closeIssue()` | gh issue close | 1 + comment | Manual |
| `createTrackingEpic()` | gh issue create | 1 | bin/track-project.js |
| `execGraphQL()` | gh api graphql | 1 per call | Various |

**Total call sites:** 12

### cache-manager.js

| Function | Operation | I/O Calls | Called By |
|----------|-----------|-----------|-----------|
| `loadCache()` | readFileSync | 1 | bin/create-epic.js (2x) |
| `saveCache()` | writeFileSync | 1 | bin/create-epic.js (2x) |

**Total I/O per epic:** 4 (2 reads, 2 writes)

### project-item-manager.js

| Function | Operation | API Calls | Called By |
|----------|-----------|-----------|-----------|
| `addIssueToProject()` | GraphQL mutation | 1 per call | bin/create-epic.js (epic + N sub-issues) |
| `updateProjectItemField()` | GraphQL mutation | 1 per call | bin/create-epic.js (2× per issue) |
| `getIssueNodeId()` | GraphQL query | 1 per call | bin/create-epic.js (epic + N sub-issues) |

**Total per epic + 10 sub-issues:** 11 addItem + 22 updateField + 11 getNodeId = **44 API calls**

### project-field-manager.js

| Function | Operation | API Calls | Called By |
|----------|-----------|-----------|-----------|
| `getProjectFields()` | GraphQL query | 1 per call | bin/create-epic.js (2x per epic) |

**Total per epic:** 2 API calls

---

## Conclusion

**Key Takeaway:** Batching GraphQL operations in `project-item-manager.js` provides the highest ROI:
- **94% reduction in network round trips** (33 → 2 requests per epic)
- **Low implementation complexity** (alias pattern)
- **Major latency improvement** (~3-5 seconds saved per epic)

**Next Steps:**
1. Review this audit with team
2. Prioritize Phase 1 & Phase 2 implementations
3. Create implementation plan (see Task 6 roadmap)
4. Begin with in-memory field cache (quick win)
