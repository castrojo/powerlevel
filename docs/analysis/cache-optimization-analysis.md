# Cache Optimization Analysis

**Date:** 2026-02-10  
**Author:** Performance Analysis Task  
**Scope:** Cache performance characteristics and optimization opportunities

---

## Executive Summary

Powerlevel's cache system uses **synchronous file-based JSON storage** with a dirty-flag pattern for write deferral. Current implementation is simple and reliable but has optimization opportunities for **5-10x reduction in file I/O** through in-memory caching and batched writes.

**Key Findings:**
- ✅ **Simple & reliable** - Synchronous I/O prevents race conditions
- ⚠️ **High file I/O frequency** - Multiple reads/writes per session
- 🚀 **Low-hanging fruit** - In-memory caching could eliminate 80%+ of disk access

---

## Current Architecture

### Storage Format

**Location:** `cache/<repo-hash>/state.json`  
**Format:** Pretty-printed JSON (2-space indent)  
**Encoding:** UTF-8

```javascript
{
  "epics": [
    {
      "number": 160,
      "title": "...",
      "goal": "...",
      "priority": "p2",
      "state": "open",
      "dirty": false,
      "sub_issues": [],
      "tracked_items": [],
      "journey": []
    }
  ],
  "issues": [],
  "project_board": { "id": "...", "number": 1, "url": "..." },
  "last_task_check": "2026-02-10T20:00:00Z"
}
```

### Access Patterns

**Read Operations:**
- `loadCache()` - Synchronous `readFileSync()` + `JSON.parse()`
- Returns empty cache structure if file missing (graceful degradation)
- Error handling: Log and return empty cache on parse failure

**Write Operations:**
- `saveCache()` - Synchronous `writeFileSync()` with pretty-print (`JSON.stringify(cache, null, 2)`)
- Creates directory tree if missing (`mkdirSync({ recursive: true })`)
- Throws error on write failure (intentional - critical operation)

**Dirty Flag Pattern:**
```javascript
// Mark epic as needing sync
markEpicDirty(cache, epicNumber);
saveCache(owner, repo, cache);  // Write immediately

// Later: session end triggers sync
getDirtyEpics(cache);  // Filter epics where dirty === true
syncToGitHub(dirtyEpics);
clearDirtyFlags(cache);
saveCache(owner, repo, cache);  // Write again
```

### Cache Size Characteristics

**Actual measurements from production:**
- **Small repo** (0 epics): ~100 bytes
- **Medium repo** (4 epics, no sub-issues): ~1.4 KB
- **Estimated large repo** (20 epics × 5 sub-issues each, full journey): ~30-50 KB

**Size breakdown per epic (estimated):**
```
Basic epic structure:     ~200 bytes
+ 5 sub-issues:          ~500 bytes
+ 10 journey entries:    ~800 bytes
+ 50 tracked items:      ~1.5 KB
--------------------------------
Total per epic:          ~3 KB
```

**Typical JSON size overhead:** Pretty-print adds ~15-20% size (whitespace + newlines)

---

## Cache Access Frequency

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ PLUGIN INITIALIZATION (session start)                       │
├─────────────────────────────────────────────────────────────┤
│ 1. loadCache()              → Read cache from disk          │
│ 2. syncExternalProjects()   → Read cache again (¹)          │
│ 3. Epic context detection   → Read cache again (¹)          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ DURING DEVELOPMENT (skill invocations, task completions)    │
├─────────────────────────────────────────────────────────────┤
│ Per skill invocation:                                        │
│   - loadCache()             → Read cache                     │
│   - Update epic (mark dirty)                                 │
│   - saveCache()             → Write cache                    │
│                                                              │
│ Per task completion:                                         │
│   - loadCache()             → Read cache                     │
│   - addJourneyEntry()                                        │
│   - saveCache()             → Write cache                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ SESSION END (idle event)                                     │
├─────────────────────────────────────────────────────────────┤
│ 1. loadCache()              → Read cache                     │
│ 2. checkForCompletedTasks()                                  │
│    - loadCache()            → Read cache again (²)           │
│    - saveCache()            → Write cache                    │
│ 3. syncDirtyEpics()                                          │
│ 4. clearDirtyFlags()                                         │
│ 5. saveCache()              → Write cache                    │
└─────────────────────────────────────────────────────────────┘

(¹) Currently loads cache per operation (no shared state)
(²) Nested operation loads cache independently
```

### Quantified Access Patterns

**Conservative scenario** (1-hour session, 1 epic, 3 skills invoked):
```
Session start:          3 reads
Skill invocations:      3 reads + 3 writes (1 per skill)
Session end:            2 reads + 2 writes
────────────────────────────────────────────────
Total:                  8 reads + 5 writes = 13 file operations
```

**Active scenario** (4-hour session, 3 epics, 8 skills invoked, 5 task completions):
```
Session start:          3 reads
Skill invocations:      8 reads + 8 writes
Task completions:       5 reads + 5 writes
Session end:            2 reads + 2 writes
────────────────────────────────────────────────
Total:                  18 reads + 15 writes = 33 file operations
```

**Static code analysis** (grep counts):
- `loadCache` invocations in `plugin.js`: 4 locations
- `saveCache` invocations in `plugin.js`: 2 locations
- `loadCache` in `lib/`: 7 locations (session-hooks, epic-updater, epic-detector)
- `saveCache` in `lib/`: 3 locations
- `loadCache` in `bin/`: 2 scripts (create-epic, track-project)

---

## Performance Characteristics

### Read Latency

**Synchronous file read + JSON parse:**
```
File system overhead:     ~0.5-2ms (SSD)
JSON.parse():            ~0.1ms per KB (V8 optimization)
─────────────────────────────────────────────
Small cache (1 KB):       ~0.6-2.1ms
Medium cache (5 KB):      ~1-3ms
Large cache (50 KB):      ~2-5ms
```

**Typical session total read time:**
- Conservative: 8 reads × 2ms = ~16ms
- Active: 18 reads × 2ms = ~36ms

**Impact:** Negligible for user experience (<100ms threshold)

### Write Latency

**Synchronous JSON stringify + file write:**
```
JSON.stringify():        ~0.2ms per KB (pretty-print adds ~30%)
File system overhead:     ~1-3ms (fsync to disk)
─────────────────────────────────────────────
Small cache (1 KB):       ~1.5-3.5ms
Medium cache (5 KB):      ~2-5ms
Large cache (50 KB):      ~10-18ms
```

**Typical session total write time:**
- Conservative: 5 writes × 3ms = ~15ms
- Active: 15 writes × 3ms = ~45ms

**Impact:** Negligible but **wasteful** (many writes are redundant)

### Sync vs Async

**Current approach:** Synchronous (`readFileSync`, `writeFileSync`)

**Rationale:**
- ✅ Prevents race conditions (no concurrent writes)
- ✅ Simpler error handling (no callback/promise chains)
- ✅ Acceptable latency (<5ms per operation)
- ⚠️ Blocks event loop (minor issue for plugin initialization)

**Async consideration:**
- Would require locking mechanism for concurrent access
- Minimal performance gain (file I/O is already fast)
- Adds complexity for marginal benefit
- **Recommendation:** Keep synchronous for cache-manager.js

---

## Bottlenecks

### 1. **Redundant File Reads**

**Impact:** Medium  
**Frequency:** 8-18 reads per session

**Problem:**
Cache is re-loaded from disk on every operation:
- `plugin.js` initialization: 3 separate `loadCache()` calls
- `session-hooks.js`: Loads cache per skill invocation
- `epic-updater.js`: Loads cache per journey entry

**Consequence:**
- Same data read multiple times within seconds
- Wasted file system I/O (even with OS page cache, syscall overhead exists)

**Example:**
```javascript
// plugin.js lines 203, 309, 334
const cache1 = loadCache(owner, repo);  // Read #1
// ... 
const cache2 = loadCache(owner, repo);  // Read #2 (same data!)
```

---

### 2. **Write-on-Every-Change Pattern**

**Impact:** Medium  
**Frequency:** 3-15 writes per session

**Problem:**
Every skill invocation triggers immediate cache write:
```javascript
// session-hooks.js line 106
handleSkillInvocation(...)
  → Update cache (mark dirty, add journey)
  → saveCache(owner, repo, cache);  // Write immediately
```

**Consequence:**
- Multiple writes within minutes (dirty flag changes)
- Each write re-serializes entire cache (even if 1 epic changed)
- Pretty-print adds serialization overhead

**Optimization potential:**
If writes were deferred to session end:
- 3-15 writes → **1 write** = **66-93% reduction**

---

### 3. **Full-Object Serialization**

**Impact:** Low (current cache sizes)  
**Frequency:** Every write operation

**Problem:**
`saveCache()` serializes entire cache object:
```javascript
writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
```

**Consequence:**
- Changing 1 epic → Serialize all epics
- For small caches (<50 KB): negligible impact
- For large projects (100+ epics): could become bottleneck

**Future concern:** If Powerlevel scales to 100+ tracked projects, serialization overhead increases linearly.

---

## Optimization Opportunities

### 1. In-Memory Cache Layer (High Impact)

**Concept:** Load cache once per session, keep in memory, flush on session end.

**Implementation:**
```javascript
// New: lib/cache-instance.js
class CacheInstance {
  constructor(owner, repo) {
    this.owner = owner;
    this.repo = repo;
    this.data = null;
    this.dirty = false;
  }
  
  load() {
    if (!this.data) {
      this.data = loadCache(this.owner, this.repo);  // Disk read
    }
    return this.data;
  }
  
  save(force = false) {
    if (this.dirty || force) {
      saveCache(this.owner, this.repo, this.data);  // Disk write
      this.dirty = false;
    }
  }
  
  markDirty() {
    this.dirty = true;
  }
}

// plugin.js creates singleton per repo
const cacheInstance = new CacheInstance(owner, repo);
```

**Impact:**
- **Reads:** 8-18 → **1** = **87-94% reduction** 🚀
- **Writes:** 5-15 → **1** = **80-93% reduction** 🚀
- **Total file I/O:** 13-33 → **2** = **84-93% reduction** 🚀

**Trade-offs:**
- ✅ Massive I/O reduction
- ✅ Faster operations (no disk latency)
- ⚠️ Requires singleton pattern per repository
- ⚠️ Risk: If process crashes, unsaved changes lost (mitigate with periodic flush)

**Implementation complexity:** Low (simple class wrapper)

---

### 2. Batch Write Buffer (Medium Impact)

**Concept:** Buffer writes and flush periodically or on session end.

**Implementation:**
```javascript
// Modify cache-manager.js
let writeBuffer = new Map();  // key: cacheKey, value: {cache, timer}

export function saveCache(owner, repo, cache, options = {}) {
  const immediate = options.immediate || false;
  const cacheKey = `${owner}/${repo}`;
  
  if (immediate) {
    // Critical write (session end, error recovery)
    _flushCache(cacheKey, cache);
  } else {
    // Buffer write, flush after debounce period
    writeBuffer.set(cacheKey, cache);
    
    if (writeBuffer.has(cacheKey)) {
      clearTimeout(writeBuffer.get(cacheKey).timer);
    }
    
    const timer = setTimeout(() => {
      _flushCache(cacheKey, cache);
    }, 5000);  // 5-second debounce
    
    writeBuffer.set(cacheKey, { cache, timer });
  }
}
```

**Impact:**
- **Writes:** 5-15 → **1-2** = **80-93% reduction**
- **Reads:** No change
- **Total file I/O:** 13-33 → **9-20** = **30-39% reduction**

**Trade-offs:**
- ✅ Reduces redundant writes
- ✅ Minimal code changes
- ⚠️ Adds complexity (timers, buffers)
- ⚠️ Risk: Buffered data lost if process crashes before flush

**Implementation complexity:** Medium (debouncing, error handling)

---

### 3. Incremental JSON Patch (Low Impact, Future-Proofing)

**Concept:** Write only changed fields instead of full cache.

**Implementation:**
```javascript
// Use JSON Patch RFC 6902 (npm: fast-json-patch)
import { compare, applyPatch } from 'fast-json-patch';

let previousCache = null;

export function saveCache(owner, repo, cache) {
  if (previousCache) {
    const patch = compare(previousCache, cache);
    
    if (patch.length < cache.epics.length * 0.3) {
      // Patch is smaller than 30% of full cache → Use incremental
      writePatchFile(cachePath, patch);
    } else {
      // Patch is large → Full write is more efficient
      writeFullCache(cachePath, cache);
    }
  } else {
    writeFullCache(cachePath, cache);
  }
  
  previousCache = structuredClone(cache);
}
```

**Impact:**
- **Write size:** 100% → **10-30%** (for small changes)
- **Write latency:** 3ms → **1ms** (smaller serialization)
- **Total file I/O reduction:** Minimal (write count unchanged)

**Trade-offs:**
- ✅ Reduces write size for large caches
- ✅ Faster serialization
- ⚠️ Adds complexity (patch diffing, reconstruction)
- ⚠️ Requires patch log management (or hybrid approach)
- ⚠️ Minimal benefit for current cache sizes (<50 KB)

**Implementation complexity:** High (diffing algorithm, error recovery)

**Recommendation:** Defer until cache sizes exceed 100 KB regularly.

---

### 4. Async Cache with Locking (Low Priority)

**Concept:** Convert to async I/O with mutex locking.

**Implementation:**
```javascript
import { Mutex } from 'async-mutex';

const cacheLocks = new Map();

function getLock(owner, repo) {
  const key = `${owner}/${repo}`;
  if (!cacheLocks.has(key)) {
    cacheLocks.set(key, new Mutex());
  }
  return cacheLocks.get(key);
}

export async function loadCache(owner, repo) {
  const lock = getLock(owner, repo);
  const release = await lock.acquire();
  
  try {
    const data = await fs.readFile(getCachePath(owner, repo), 'utf8');
    return JSON.parse(data);
  } finally {
    release();
  }
}
```

**Impact:**
- **Non-blocking event loop:** Improves plugin responsiveness during initialization
- **Performance gain:** Negligible (file I/O already <5ms)

**Trade-offs:**
- ⚠️ Significant complexity increase (async/await everywhere, mutex management)
- ⚠️ Minimal performance gain (sync I/O is already fast)
- ⚠️ Breaking change (all callers must use `await`)

**Recommendation:** Not worth complexity cost. Keep synchronous.

---

## Cache Invalidation Strategy

### Current Approach

**Invalidation triggers:**
- ❌ **None** - Cache is never invalidated except on manual deletion
- ✅ **File change events:** `plugin.js:339-343` invalidates epic context cache on plan file changes

**Potential issues:**
- If GitHub issues are modified externally (web UI, other tools), cache becomes stale
- No TTL (Time To Live) mechanism
- No version/checksum validation

### Proposed Invalidation Strategy

**Option A: TTL-Based (Conservative)**
```javascript
{
  "epics": [...],
  "issues": [...],
  "project_board": {...},
  "metadata": {
    "cached_at": "2026-02-10T20:00:00Z",
    "ttl_seconds": 3600  // 1 hour
  }
}

// On load:
if (Date.now() - cache.metadata.cached_at > cache.metadata.ttl_seconds * 1000) {
  // Cache expired → Reload from GitHub
  cache = reloadFromGitHub(owner, repo);
}
```

**Option B: Checksum-Based (Aggressive)**
```javascript
// Store ETag from GitHub API response
cache.metadata.etag = response.headers['etag'];

// On load:
const currentETag = fetchETag(owner, repo, epicNumber);
if (cache.metadata.etag !== currentETag) {
  // Data changed on GitHub → Reload
  cache = reloadFromGitHub(owner, repo);
}
```

**Recommendation:**
- **MVP:** No invalidation (assume Powerlevel is primary editor)
- **Post-MVP:** TTL-based with 1-hour expiration (balances freshness + API rate limits)

---

## Recommendations

### Priority 1: In-Memory Cache Singleton (Immediate)

**Rationale:**
- Highest impact (84-93% I/O reduction)
- Lowest complexity (simple class wrapper)
- No breaking changes (internal refactor only)

**Implementation steps:**
1. Create `lib/cache-instance.js` with `CacheInstance` class
2. Modify `plugin.js` to instantiate singleton per repo
3. Update `session-hooks.js` and `epic-updater.js` to use singleton
4. Add periodic flush (every 30 seconds) for crash recovery
5. Ensure session end always flushes (critical)

**Estimated effort:** 4-6 hours  
**Risk:** Low

---

### Priority 2: Deferred Writes (Short-Term)

**Rationale:**
- Combines well with in-memory cache
- Reduces write syscalls by 80-93%
- Minimal code changes

**Implementation steps:**
1. Add `dirty` flag to `CacheInstance`
2. Mark dirty on any cache modification
3. Flush only on session end (or periodic timer)
4. Add force-flush for critical operations (external project sync)

**Estimated effort:** 2-3 hours  
**Risk:** Low (already using dirty-flag pattern for epics)

---

### Priority 3: TTL-Based Invalidation (Medium-Term)

**Rationale:**
- Prevents stale cache issues for multi-device workflows
- Respects GitHub API rate limits (1-hour TTL = max 24 reloads/day)
- Simple to implement

**Implementation steps:**
1. Add `metadata.cached_at` and `metadata.ttl_seconds` to cache structure
2. Check TTL on `loadCache()`
3. Reload from GitHub if expired (via `gh api`)
4. Configurable TTL in `.opencode/config.json`

**Estimated effort:** 3-4 hours  
**Risk:** Low

---

### Priority 4: Incremental JSON Patch (Future)

**Rationale:**
- Only needed when cache sizes exceed 100 KB
- Significant complexity increase
- Marginal benefit for current workloads

**Defer until:**
- Average cache size > 100 KB
- Write latency > 50ms
- User reports performance issues

**Estimated effort:** 8-12 hours (diffing, reconstruction, testing)  
**Risk:** Medium (complex error recovery)

---

## Performance Projections

### After Implementing Priority 1 + Priority 2

**Conservative scenario** (1-hour session):
```
Current:   13 file operations (8 reads + 5 writes)
Optimized: 2 file operations (1 read + 1 write)
Reduction: 84%
```

**Active scenario** (4-hour session):
```
Current:   33 file operations (18 reads + 15 writes)
Optimized: 2 file operations (1 read + 1 write)
Reduction: 93%
```

**Latency improvement:**
```
Current total I/O time:   ~50ms per active session
Optimized total I/O time: ~5ms per active session
Speedup:                  10x 🚀
```

**User-facing impact:**
- Plugin initialization: **~10ms faster** (3 reads eliminated)
- Skill invocations: **~5ms faster per skill** (no disk write)
- Session end: **~15ms faster** (fewer reads)

**Overall:** Negligible user-facing impact (already fast), but **cleaner architecture** and **reduced disk wear** (important for SSD longevity).

---

## Architecture Diagram (Proposed)

### Current Flow (Multi-Read)

```
┌──────────────┐
│  plugin.js   │
└──────┬───────┘
       │ loadCache() → Disk Read #1
       ▼
┌──────────────┐
│session-hooks │
└──────┬───────┘
       │ loadCache() → Disk Read #2
       ▼
┌──────────────┐
│ epic-updater │
└──────┬───────┘
       │ loadCache() → Disk Read #3
       │ saveCache() → Disk Write #1
       ▼
┌──────────────┐
│session-hooks │
└──────┬───────┘
       │ saveCache() → Disk Write #2
       ▼
┌──────────────┐
│  plugin.js   │
└──────┬───────┘
       │ saveCache() → Disk Write #3
       ▼
```

### Proposed Flow (Singleton Cache)

```
┌──────────────────────────────────────────────┐
│          CacheInstance (In-Memory)           │
│  ┌────────────────────────────────────────┐  │
│  │ data: { epics, issues, project_board } │  │
│  │ dirty: false                           │  │
│  └────────────────────────────────────────┘  │
└────────┬──────────────────────┬──────────────┘
         │                      │
         │ load() (once)        │ save() (once)
         ▼                      ▼
    ┌─────────┐           ┌──────────┐
    │  Disk   │◄─────────►│   Disk   │
    │  Read   │  Session  │  Write   │
    │  (once) │  Lifecycle│  (once)  │
    └─────────┘           └──────────┘
         ▲                      ▲
         │                      │
         │                      │
    Session Start          Session End
```

---

## Conclusion

Powerlevel's current cache architecture is **simple, reliable, and performant** for typical workloads. However, **redundant file I/O** (8-18 reads per session) presents a clear optimization opportunity.

**Key recommendation:** Implement **in-memory cache singleton** (Priority 1) for **84-93% I/O reduction** with minimal complexity. This provides immediate benefits while maintaining code simplicity.

**Future-proofing:** Add TTL-based invalidation (Priority 3) to support multi-device workflows once adoption grows.

**Defer:** Incremental JSON patching (Priority 4) until cache sizes exceed 100 KB regularly.

---

**Next Steps:**
1. Review this analysis with maintainers
2. Approve Priority 1 implementation plan
3. Create implementation epic with sub-tasks
4. Benchmark before/after performance (confirm projections)
