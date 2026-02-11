# Batch & Parallelize Workflow Optimization Analysis

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Analyze all Powerlevel workflows to identify batching and parallelization opportunities for improved efficiency and reduced API costs.

**Architecture:** Systematic audit of plugin.js hooks, library functions, and bin scripts. Document current sequential bottlenecks, identify GraphQL batch opportunities, and propose parallelization strategies. Deliver comprehensive analysis report with prioritized implementation recommendations.

**Tech Stack:** Node.js, GitHub GraphQL API, GitHub REST API, git operations, file I/O

---

## Task 1: Audit plugin.js Session Lifecycle Hooks

**Files:**
- Read: `plugin.js` (entire file, focus on hooks)
- Create: `docs/analysis/session-hooks-audit.md`

**What to analyze:**

1. **`session.idle` hook (landThePlane)**
   - Currently: Sequential epic sync loop
   - Questions:
     - Can we batch GitHub API calls?
     - Can dirty epics be synced in parallel?
     - What's the current API call count per sync?

2. **`session.created` hook (epic detection)**
   - Currently: Sequential plan file scanning
   - Questions:
     - Can file reads be parallelized?
     - Can we batch multiple plan detections?

3. **`experimental.session.compacting` hook**
   - Currently: Re-injecting epic context
   - Questions:
     - Any batching opportunities for context reconstruction?

**Analysis output format:**

```markdown
# Session Hooks Audit

## session.idle (landThePlane)

**Current behavior:**
- [Sequential steps listed]
- API calls per sync: [count]
- Average duration: [estimate]

**Batching opportunities:**
1. [Opportunity description]
   - Impact: [High/Medium/Low]
   - Complexity: [High/Medium/Low]
   - Estimated savings: [API calls/time]

**Parallelization opportunities:**
1. [Opportunity description]
   - Impact: [High/Medium/Low]
   - Complexity: [High/Medium/Low]
   - Estimated savings: [time]

[Repeat for each hook]
```

**Step 1: Read plugin.js and extract hook implementations**

Commands:
```bash
grep -n "session\\.idle\|session\\.created\|session\\.compacting" plugin.js
# Note line numbers for each hook
```

**Step 2: Trace each hook's execution path**

For each hook:
- Identify all function calls
- Count API operations (gh cli, GraphQL, REST)
- Identify sequential dependencies vs independent operations

**Step 3: Document findings in session-hooks-audit.md**

Create structured markdown with:
- Current behavior section per hook
- Identified bottlenecks
- Batching opportunities with impact assessment
- Parallelization opportunities with impact assessment

**Step 4: Commit**

```bash
git add docs/analysis/session-hooks-audit.md
git commit -m "docs: audit session lifecycle hooks for optimization"
```

---

## Task 2: Audit Library Functions for Batching Opportunities

**Files:**
- Read: `lib/github-cli.js`, `lib/cache-manager.js`, `lib/project-item-manager.js`, `lib/project-field-manager.js`
- Create: `docs/analysis/library-batching-audit.md`

**What to analyze:**

1. **github-cli.js**
   - Current: Individual gh CLI calls per operation
   - Questions:
     - Can we batch issue creation?
     - Can we batch label updates?
     - Can we batch comment creation?
     - Should we switch from CLI to GraphQL for batching?

2. **project-item-manager.js**
   - Current: One GraphQL mutation per item
   - Questions:
     - Can we batch addProjectV2ItemById mutations?
     - Can we batch updateProjectV2ItemFieldValue mutations?
     - What's the GraphQL rate limit impact?

3. **cache-manager.js**
   - Current: File I/O per cache operation
   - Questions:
     - Can we batch cache writes?
     - Should we use in-memory buffer with periodic flush?

**Analysis output format:**

```markdown
# Library Batching Audit

## github-cli.js

**Current operations:**
- `createEpic()`: 1 API call
- `createSubIssue()`: 1 API call per sub-issue
- `updateIssueBody()`: 1 API call
- [etc.]

**Batching opportunities:**
1. Batch issue creation with GraphQL
   - Current: N sequential `gh issue create` calls
   - Proposed: Single GraphQL mutation with N issues
   - Impact: Reduce API calls by N-1
   - Complexity: Medium (requires GraphQL mutation builder)
   - Rate limit savings: [calculation]

[Repeat for each library]
```

**Step 1: Read each library file and catalog API operations**

For each lib file:
```bash
# Count gh CLI calls
grep -n "execSync.*gh " lib/github-cli.js | wc -l

# Count GraphQL mutations
grep -n "gh api graphql" lib/project-item-manager.js

# Count file I/O operations
grep -n "writeFileSync\|readFileSync" lib/cache-manager.js
```

**Step 2: Identify operations that could be batched**

Criteria:
- Operations called in loops
- Operations with same target (e.g., same repo)
- Operations with no sequential dependencies

**Step 3: Research GitHub GraphQL batch capabilities**

Reference: https://docs.github.com/en/graphql/guides/forming-calls-with-graphql#working-with-variables

Questions to answer:
- Can we batch issue creation mutations?
- What's the max batch size?
- What's the error handling for partial failures?

**Step 4: Document findings in library-batching-audit.md**

Include:
- Current operation counts
- Identified batch opportunities
- GraphQL capabilities research
- Implementation complexity estimates

**Step 5: Commit**

```bash
git add docs/analysis/library-batching-audit.md
git commit -m "docs: audit library functions for batching opportunities"
```

---

## Task 3: Audit bin Scripts for Parallelization Opportunities

**Files:**
- Read: `bin/auto-onboard.js`, `bin/track-project.js`, `bin/create-epic.js`, `bin/sync-external-epics.js`
- Create: `docs/analysis/scripts-parallelization-audit.md`

**What to analyze:**

1. **auto-onboard.js**
   - Current: Sequential file creation and git operations
   - Questions:
     - Can file creation be parallelized?
     - Can git operations be optimized?

2. **track-project.js**
   - Current: Sequential issue fetching and epic creation
   - Questions:
     - Can we fetch issues in parallel with metadata?
     - Can project config creation happen in parallel with GitHub operations?

3. **sync-external-epics.js**
   - Current: Likely sequential sync per epic
   - Questions:
     - Can external repo fetches be parallelized?
     - Can tasklist updates be batched?

4. **create-epic.js**
   - Current: Sequential sub-issue creation
   - Questions:
     - Can sub-issues be created in parallel?
     - Can project board addition happen in parallel with issue creation?

**Analysis output format:**

```markdown
# Scripts Parallelization Audit

## auto-onboard.js

**Current workflow:**
1. [Step 1] - Duration: [estimate]
2. [Step 2] - Duration: [estimate]
[etc.]

**Sequential dependencies:**
- [Step A] must complete before [Step B] because [reason]

**Parallelization opportunities:**
1. Steps [X, Y, Z] can run in parallel
   - Impact: Reduce total time by [estimate]
   - Complexity: [High/Medium/Low]
   - Implementation: [Promise.all, worker threads, etc.]

[Repeat for each script]
```

**Step 1: Read each script and map execution flow**

For each script:
- Trace the execution path
- Identify sequential operations
- Identify independent operations

**Step 2: Identify sequential bottlenecks**

Look for:
- Loops that could run in parallel (e.g., creating N sub-issues)
- Independent I/O operations (file reads, API calls)
- CPU-bound operations that could use worker threads

**Step 3: Research Node.js parallelization patterns**

Options to evaluate:
- `Promise.all()` for parallel async operations
- `Promise.allSettled()` for parallel with error isolation
- Worker threads for CPU-bound operations
- Stream-based processing for large datasets

**Step 4: Document findings in scripts-parallelization-audit.md**

Include:
- Current execution flow diagrams (text-based)
- Identified bottlenecks
- Parallelization opportunities with time savings estimates
- Recommended patterns and libraries

**Step 5: Commit**

```bash
git add docs/analysis/scripts-parallelization-audit.md
git commit -m "docs: audit bin scripts for parallelization opportunities"
```

---

## Task 4: Analyze GitHub API Rate Limit Impact

**Files:**
- Read: All files that make GitHub API calls
- Create: `docs/analysis/rate-limit-analysis.md`

**What to analyze:**

1. **Current rate limit consumption**
   - Primary rate limit: 5000 requests/hour (authenticated)
   - GraphQL rate limit: 5000 points/hour
   - How many requests per typical workflow?
   - How many requests per session?

2. **Rate limit optimization strategies**
   - Batching (reduce request count)
   - Caching (avoid redundant requests)
   - Conditional requests (304 Not Modified)
   - GraphQL vs REST (points vs requests)

3. **Cost analysis**
   - API calls per epic creation: [count]
   - API calls per session sync: [count]
   - API calls per external epic sync: [count]

**Analysis output format:**

```markdown
# Rate Limit Analysis

## Current Consumption

**Epic creation workflow:**
- Create epic: 1 request
- Create N sub-issues: N requests
- Add to project board: N+1 GraphQL mutations (points: [calculation])
- Update labels: M requests
- **Total:** [count] requests, [count] GraphQL points

**Session end sync:**
- [Breakdown of requests]
- **Total:** [count] requests per dirty epic

**External epic sync:**
- [Breakdown of requests]
- **Total:** [count] requests per tracked project

## Optimization Opportunities

### Batching Impact
- [Opportunity]: Reduces [X] requests to [Y] requests
- Rate limit savings: [percentage]

### Caching Impact
- [Opportunity]: Eliminates [X] redundant requests
- Rate limit savings: [percentage]

### GraphQL Migration Impact
- [Opportunity]: Switch from REST to GraphQL for [operation]
- Rate limit savings: [calculation]

## Recommendations

[Prioritized list of optimizations with impact estimates]
```

**Step 1: Identify all API call sites**

```bash
# Find all gh CLI calls
grep -r "execSync.*gh " lib/ bin/ plugin.js | grep -v node_modules

# Find all GraphQL calls
grep -r "gh api graphql" lib/ bin/ plugin.js

# Find all REST API calls
grep -r "gh api " lib/ bin/ plugin.js | grep -v graphql
```

**Step 2: Count requests per workflow**

For each major workflow:
- Epic creation (lib/github-cli.js, plugin.js)
- Session sync (plugin.js landThePlane)
- External sync (bin/sync-external-epics.js)
- Project onboarding (bin/auto-onboard.js, bin/track-project.js)

**Step 3: Calculate rate limit impact**

Use GitHub's rate limit calculator:
- REST: 1 request = 1 unit
- GraphQL: Query/mutation cost varies (typically 1-100 points)

**Step 4: Research batching strategies**

GitHub GraphQL supports:
- Multiple mutations in one query (batch operations)
- Aliases for parallel queries
- Variables for dynamic batching

**Step 5: Document findings and recommendations**

Include:
- Current consumption breakdown
- Optimization opportunities with impact
- Prioritized recommendations
- Implementation complexity estimates

**Step 6: Commit**

```bash
git add docs/analysis/rate-limit-analysis.md
git commit -m "docs: analyze GitHub API rate limit impact and optimizations"
```

---

## Task 5: Analyze Cache Performance and Optimization

**Files:**
- Read: `lib/cache-manager.js`, `plugin.js` (cache usage)
- Create: `docs/analysis/cache-optimization-analysis.md`

**What to analyze:**

1. **Current cache architecture**
   - File-based JSON cache per repo
   - Write-on-change (dirty flag pattern)
   - Read-on-demand

2. **Cache access patterns**
   - Read frequency: How often is cache read?
   - Write frequency: How often is cache written?
   - Cache size: Typical size of cache files?

3. **Optimization opportunities**
   - In-memory caching (reduce file I/O)
   - Batch writes (reduce fsync calls)
   - Incremental writes (update only changed fields)
   - Cache invalidation strategy

**Analysis output format:**

```markdown
# Cache Optimization Analysis

## Current Architecture

**Storage:** JSON files in `cache/<repo-hash>/state.json`

**Access pattern:**
- Reads: [frequency] per [workflow]
- Writes: [frequency] per [workflow]
- Size: [typical size] per repo

**Performance characteristics:**
- Read latency: [estimate]
- Write latency: [estimate]
- Sync/async: [current approach]

## Bottlenecks

1. [Bottleneck description]
   - Impact: [High/Medium/Low]
   - Frequency: [how often this occurs]

## Optimization Opportunities

### In-Memory Caching
- Keep cache in memory during session
- Lazy load on first access
- Periodic flush to disk
- Impact: Reduce file I/O by [estimate]

### Batch Writes
- Buffer dirty flags
- Single write with all changes
- Impact: Reduce write syscalls by [estimate]

### Incremental Updates
- Write only changed fields (JSON patch)
- Impact: Reduce write size by [estimate]

## Recommendations

[Prioritized list with implementation complexity]
```

**Step 1: Analyze cache-manager.js implementation**

Questions to answer:
- How is cache loaded? (sync/async)
- How is cache written? (sync/async)
- What triggers cache writes?
- How big are cache files typically?

**Step 2: Profile cache access patterns**

```bash
# Count cache reads in plugin.js
grep -n "loadCache\|getCache" plugin.js | wc -l

# Count cache writes
grep -n "saveCache\|updateCache" plugin.js | wc -l

# Check cache file sizes
ls -lh cache/*/state.json 2>/dev/null || echo "No cache files yet"
```

**Step 3: Research caching strategies**

Options to evaluate:
- LRU cache for in-memory storage
- Write-behind caching (buffer + periodic flush)
- JSON patch for incremental updates
- Memory-mapped files for large caches

**Step 4: Document findings and recommendations**

Include:
- Current architecture diagram (text-based)
- Identified bottlenecks
- Optimization opportunities with impact
- Implementation complexity estimates

**Step 5: Commit**

```bash
git add docs/analysis/cache-optimization-analysis.md
git commit -m "docs: analyze cache performance and optimization opportunities"
```

---

## Task 6: Create Prioritized Optimization Roadmap

**Files:**
- Read: All analysis files from previous tasks
- Create: `docs/analysis/OPTIMIZATION-ROADMAP.md`

**What to synthesize:**

1. **Consolidate all findings**
   - Session hooks optimizations
   - Library batching opportunities
   - Script parallelization opportunities
   - Rate limit optimizations
   - Cache optimizations

2. **Prioritize by impact**
   - High impact, low complexity → Quick wins
   - High impact, high complexity → Strategic investments
   - Low impact, low complexity → Nice-to-haves
   - Low impact, high complexity → Avoid

3. **Create implementation phases**
   - Phase 1: Quick wins (1-2 days)
   - Phase 2: Medium complexity (3-5 days)
   - Phase 3: Strategic investments (1-2 weeks)

**Roadmap output format:**

```markdown
# Powerlevel Optimization Roadmap

## Executive Summary

**Total optimization opportunities identified:** [count]

**Estimated impact:**
- API calls reduction: [percentage]
- Session duration reduction: [percentage]
- Rate limit consumption reduction: [percentage]

**Recommended implementation order:** [Phase 1 → Phase 2 → Phase 3]

---

## Quick Wins (Phase 1)

### 1. [Optimization Name]
- **Impact:** [High/Medium/Low]
- **Complexity:** Low
- **Estimated savings:** [specific metric]
- **Implementation effort:** [time estimate]
- **Files affected:** [list]
- **Description:** [brief explanation]

[Repeat for all Phase 1 items]

---

## Medium Complexity (Phase 2)

[Same format as Phase 1]

---

## Strategic Investments (Phase 3)

[Same format as Phase 1]

---

## Implementation Considerations

### Testing Strategy
- [How to test batch operations]
- [How to verify rate limit improvements]
- [How to benchmark cache performance]

### Rollback Plan
- [How to revert changes if needed]
- [Feature flags for gradual rollout]

### Monitoring
- [What metrics to track]
- [How to measure success]

---

## Appendices

### Appendix A: Impact Calculation Methodology
[Explain how impact estimates were calculated]

### Appendix B: References
- [Link to analysis files]
- [Link to GitHub API docs]
- [Link to Node.js performance docs]
```

**Step 1: Read all analysis files**

```bash
cat docs/analysis/session-hooks-audit.md
cat docs/analysis/library-batching-audit.md
cat docs/analysis/scripts-parallelization-audit.md
cat docs/analysis/rate-limit-analysis.md
cat docs/analysis/cache-optimization-analysis.md
```

**Step 2: Extract all optimization opportunities**

Create a spreadsheet-style table (markdown):
```
| Optimization | Impact | Complexity | Savings | Source |
|--------------|--------|------------|---------|--------|
| [Name]       | High   | Low        | [metric]| [file] |
```

**Step 3: Prioritize using impact/complexity matrix**

```
High Impact, Low Complexity    → Phase 1 (Quick Wins)
High Impact, High Complexity   → Phase 3 (Strategic)
Low Impact, Low Complexity     → Phase 2 (Nice-to-haves)
Low Impact, High Complexity    → Backlog (Avoid)
```

**Step 4: Group into implementation phases**

Criteria:
- Phase 1: Can be done in 1-2 days, high impact
- Phase 2: Medium effort, good ROI
- Phase 3: Large effort, strategic value

**Step 5: Write comprehensive roadmap**

Include:
- Executive summary with key metrics
- Detailed phase breakdown
- Implementation considerations
- Testing strategy
- Monitoring plan

**Step 6: Commit**

```bash
git add docs/analysis/OPTIMIZATION-ROADMAP.md
git commit -m "docs: create prioritized optimization roadmap"
```

---

## Task 7: Create Analysis Summary for README

**Files:**
- Read: `docs/analysis/OPTIMIZATION-ROADMAP.md`
- Modify: `README.md` (add Performance section)

**What to add:**

Add a new "Performance" section to README.md that links to the optimization roadmap and summarizes key findings.

**Content:**

```markdown
## Performance

Powerlevel has been analyzed for batching and parallelization opportunities to optimize efficiency and reduce API costs.

**Key findings:**
- [X] optimization opportunities identified
- Estimated [Y%] reduction in API calls
- Estimated [Z%] reduction in session duration

**See:** [Optimization Roadmap](docs/analysis/OPTIMIZATION-ROADMAP.md) for detailed analysis and implementation phases.

**Quick wins implemented:**
- ✅ [Optimization 1]
- ✅ [Optimization 2]
- 🚧 [In progress items]

**Upcoming optimizations:**
- 📋 [Phase 2 items]
- 📋 [Phase 3 items]
```

**Step 1: Read OPTIMIZATION-ROADMAP.md**

```bash
grep "^## Executive Summary" -A 10 docs/analysis/OPTIMIZATION-ROADMAP.md
```

**Step 2: Extract key metrics**

- Total opportunities count
- API reduction percentage
- Duration reduction percentage

**Step 3: Determine placement in README**

Insert after "Project Board Integration" section, before "Troubleshooting"

**Step 4: Add Performance section to README**

Use the template above with actual metrics from the roadmap.

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add Performance section linking to optimization roadmap"
```

---

## Success Criteria

✅ **Analysis complete when:**
- All 5 analysis documents created in `docs/analysis/`
- Optimization roadmap created with prioritized recommendations
- README updated with Performance section
- All commits follow conventional commits format
- All findings are actionable with implementation complexity estimates

✅ **Quality checks:**
- Each analysis has concrete metrics (not vague "could be faster")
- Impact estimates are based on current usage patterns
- Complexity estimates consider existing codebase patterns
- Roadmap phases are realistic given available time

---

## Notes

- **No implementation in this plan** - This is pure analysis and documentation
- **Focus on measurable impact** - API call reduction, time savings, rate limit consumption
- **Consider maintainability** - Optimizations shouldn't sacrifice code clarity
- **Research phase** - May discover some optimizations aren't worth the complexity


---

**Epic:** #163 (https://github.com/castrojo/powerlevel/issues/163)
