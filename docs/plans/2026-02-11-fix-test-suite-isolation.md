# Fix Test Suite Isolation and Reliability Implementation Plan

> **Epic Issue:** #177
> **Sub-Tasks:** #178, #179, #180

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the test concurrency race condition causing 1 constant failure in the 103-test suite, and harden all tests against shared-state pollution.

**Architecture:** The root cause is that `epic-updater.test.js` and `plugin-integration.test.js` both use the same cache key (`owner='test'`, `repo='repo'`), writing to the same on-disk file. When Node's test runner executes files concurrently, `epic-updater.test.js` deletes the entire `cache/` directory during cleanup while `plugin-integration.test.js` is sleeping (1.1s for commit timestamp spacing), destroying its cache mid-test. Fix by giving each test file a unique cache namespace and scoping cleanup to only the test's own cache hash directory.

**Tech Stack:** Node.js (ESM), Node built-in test runner (`node --test`), `fs`, `child_process`

---

### Task 1: Give Each Test File a Unique Cache Namespace

**Files:**
- Modify: `test/epic-updater.test.js` (lines 137, 145, 154, 174, 181, 190, 206, 213, 217, 235, 242, 250, 266, 267, 283, 290, 311, 328, 334)
- Modify: `test/plugin-integration.test.js` (lines 88, 112, 160)

**Step 1: Update `epic-updater.test.js` cache keys**

Change all `loadCache('test', 'repo')` and `saveCache('test', 'repo', ...)` calls to use a unique namespace:

```javascript
// Before:
let cache = loadCache('test', 'repo');
saveCache('test', 'repo', cache);

// After:
let cache = loadCache('test-updater', 'repo');
saveCache('test-updater', 'repo', cache);
```

**Step 2: Update `plugin-integration.test.js` cache keys**

Change all `loadCache('test', 'repo')` and `saveCache('test', 'repo', ...)` calls to use a different unique namespace:

```javascript
// Before:
let cache = loadCache('test', 'repo');
saveCache('test', 'repo', cache);

// After:
let cache = loadCache('test-plugin', 'repo');
saveCache('test-plugin', 'repo', cache);
```

**Step 3: Run full test suite with default concurrency**

Run: `node --test test/*.test.js`
Expected: All 103 tests pass (11 files, 0 failures)

**Step 4: Commit**

```bash
git add test/epic-updater.test.js test/plugin-integration.test.js
git commit -m "fix: use unique cache namespaces per test file to prevent concurrency races"
```

### Task 2: Scope Cache Cleanup to Test-Specific Directories

**Files:**
- Modify: `test/epic-updater.test.js` (lines 57-59, 115-118)
- Modify: `test/plugin-integration.test.js` (lines 123-127)

**Step 1: Update `epic-updater.test.js` cleanup to delete only its own hash directory**

```javascript
import { getRepoHash } from '../lib/repo-detector.js';

// In setupTestDir():
// Before:
const cacheDir = join(process.cwd(), 'cache');
if (existsSync(cacheDir)) {
  rmSync(cacheDir, { recursive: true, force: true });
}

// After:
const hash = getRepoHash('test-updater', 'repo');
const cacheHashDir = join(process.cwd(), 'cache', hash);
if (existsSync(cacheHashDir)) {
  rmSync(cacheHashDir, { recursive: true, force: true });
}

// In cleanupTestDir():
// Before:
const cacheDir = join(process.cwd(), 'cache');
if (existsSync(cacheDir)) {
  rmSync(cacheDir, { recursive: true, force: true });
}

// After:
const hash = getRepoHash('test-updater', 'repo');
const cacheHashDir = join(process.cwd(), 'cache', hash);
if (existsSync(cacheHashDir)) {
  rmSync(cacheHashDir, { recursive: true, force: true });
}
```

**Step 2: Update `plugin-integration.test.js` cleanup similarly**

```javascript
import { getRepoHash } from '../lib/repo-detector.js';

// In cleanupTestEnv():
// Before:
const cacheDir = join(process.cwd(), 'cache');
if (existsSync(cacheDir)) {
  rmSync(cacheDir, { recursive: true, force: true });
}

// After:
const hash = getRepoHash('test-plugin', 'repo');
const cacheHashDir = join(process.cwd(), 'cache', hash);
if (existsSync(cacheHashDir)) {
  rmSync(cacheHashDir, { recursive: true, force: true });
}
```

**Step 3: Run full test suite with default concurrency**

Run: `node --test test/*.test.js`
Expected: All 103 tests pass (11 files, 0 failures)

**Step 4: Commit**

```bash
git add test/epic-updater.test.js test/plugin-integration.test.js
git commit -m "fix: scope cache cleanup to test-specific hash directories"
```

### Task 3: Add `npm test` Script to package.json

**Files:**
- Modify: `package.json`

**Step 1: Add test script**

```json
{
  "scripts": {
    "test": "node --test test/*.test.js"
  }
}
```

**Step 2: Verify `npm test` works**

Run: `npm test`
Expected: All 103 tests pass

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add npm test script to package.json"
```
