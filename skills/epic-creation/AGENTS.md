# Epic Creation Skill - Implementation Guide

For AI agents implementing or debugging this skill.

## When Called

**Trigger:** Automatically invoked by `writing-plans` skill after implementation plan is saved.

**Context:** User has just completed brainstorming and planning phases, and an implementation plan markdown file exists in `docs/plans/`.

## Technical Workflow

### 1. Plan File Parsing

The skill uses `lib/parser.js` to extract structured data from markdown:

```javascript
import { parsePlanFile } from '../../lib/parser.js';

const planData = parsePlanFile(planFilePath);
// Returns: { title, goal, tasks: [], priority }
```

**What to extract:**
- **Title:** First `# Header` in file
- **Goal:** Text after `**Goal:**` marker
- **Tasks:** Each `## Task N: Description` section
- **Priority:** From frontmatter `priority:` field (default: `normal`)

**Edge cases:**
- Missing goal → Use title as goal
- No tasks → Create epic with warning, no sub-issues
- Invalid frontmatter → Use defaults

### 2. Repository Detection

```javascript
import { detectRepo } from '../../lib/repo-detector.js';

const repo = detectRepo();
// Returns: { owner: 'username', repo: 'project-name' }
```

**Failure modes:**
- Not in git repo → Error, cannot proceed
- No remote origin → Error, user must add remote
- Non-GitHub remote → Error, only GitHub supported

### 3. Cache Loading

```javascript
import { loadCache, saveCache } from '../../lib/cache-manager.js';

const cache = loadCache(repo.owner, repo.repo);
```

Cache is loaded to check for duplicate epics and store new epic data locally.

### 4. Epic Creation on GitHub

```javascript
import { createEpic } from '../../lib/github-cli.js';
import { getEpicLabels } from '../../lib/label-manager.js';
import { formatEpicBody } from '../../lib/parser.js';

const body = formatEpicBody(planData, planFilePath);
const labels = getEpicLabels(planData.priority);

const epicNumber = await createEpic(
  repo,
  planData.title,
  body,
  labels
);
```

**Epic body format:**
```markdown
{goal}

## Plan
Implementation plan: `docs/plans/2026-02-09-feature.md`

## Sub-Tasks
- [ ] Task 1: Description
- [ ] Task 2: Description
- [ ] Task 3: Description

## Status
**Phase:** Planning → Implementation → Review → Merged
```

**Labels applied:**
- `type/epic`
- `status/planning`
- `priority/{p0,p1,p2,p3}`

### 5. Sub-Task Creation

For each task in the plan:

```javascript
import { createSubIssue } from '../../lib/github-cli.js';
import { getTaskLabels } from '../../lib/label-manager.js';

for (const task of planData.tasks) {
  const taskBody = `Part of epic #${epicNumber}\n\nImplementation details in plan: \`${planFilePath}\``;
  const labels = getTaskLabels(epicNumber, planData.priority);
  
  const taskNumber = await createSubIssue(
    repo,
    task,
    taskBody,
    labels,
    epicNumber
  );
  
  // Store in cache
  addSubIssue(cache, epicNumber, {
    number: taskNumber,
    title: task,
    labels
  });
}
```

**Sub-task labels:**
- `type/task`
- `task/pending`
- `epic/{epicNumber}` (dynamic label, auto-created)
- `priority/{p0,p1,p2,p3}`

### 6. Cache Update

```javascript
import { addEpic } from '../../lib/cache-manager.js';

addEpic(cache, {
  number: epicNumber,
  title: planData.title,
  labels,
  plan_file: planFilePath
});

// Cache now contains epic and all sub-issues
saveCache(repo.owner, repo.repo, cache);
```

### 7. Plan File Update

Insert epic reference at top of plan file using `insertEpicReference`:

```javascript
import { insertEpicReference } from '../../lib/parser.js';
import { readFileSync, writeFileSync } from 'fs';

const planContent = readFileSync(planFilePath, 'utf8');
const updatedContent = insertEpicReference(planContent, epicNumber, subTaskNumbers);
writeFileSync(planFilePath, updatedContent);
```

**Result:**
```markdown
# Feature Name Implementation Plan

> **Epic Issue:** #123
> **Sub-Tasks:** #124, #125, #126

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans...
```

The epic reference is inserted after the title heading, before any other content.

### 8. Git Commit

```javascript
import { execSync } from 'child_process';

execSync(`git add "${planFilePath}"`, { stdio: 'inherit' });
execSync(`git commit -m "docs: link plan to epic #${epicNumber}"`, { stdio: 'inherit' });
```

## Integration with Other Components

### Called By
- `writing-plans` skill (line 101)

### Calls
- `lib/parser.js` - Plan parsing
- `lib/repo-detector.js` - Repo detection
- `lib/cache-manager.js` - Cache operations
- `lib/github-cli.js` - GitHub API calls
- `lib/label-manager.js` - Label management

### Updates
- GitHub Issues (epic + sub-tasks)
- Cache file (`cache/<repo-hash>/state.json`)
- Plan file (appends epic reference)
- Git history (commits plan update)

## Error Scenarios

### GitHub CLI Not Authenticated
```
Error: gh: command failed with exit code 1
stderr: To authenticate, please run: gh auth login
```
**Solution:** User must run `gh auth login`

### Rate Limit Exceeded
```
Error: API rate limit exceeded
```
**Solution:** Wait for rate limit reset, or use authenticated requests

### Duplicate Epic Reference
Check plan file for existing epic reference before creating:
```javascript
const content = fs.readFileSync(planFilePath, 'utf8');
if (content.includes('**Epic Issue:**')) {
  console.warn('Plan already has epic reference, skipping creation');
  return;
}
```

### Network Failure
```
Error: unable to resolve host github.com
```
**Solution:** Retry with exponential backoff, or fail gracefully

### Invalid Plan Format
```
Error: Could not extract tasks from plan
```
**Solution:** Create epic without sub-tasks, add warning comment to epic

## Testing

### Manual Test
```bash
cd /path/to/repo
node bin/create-epic.js docs/plans/test-plan.md
```

### Verify Results
1. Check GitHub: `gh issue view <epic-number>`
2. Check cache: `cat cache/<repo-hash>/state.json | jq .epics`
3. Check plan file: `tail -5 docs/plans/test-plan.md`
4. Check git log: `git log -1`

### Cleanup After Test
```bash
gh issue close <epic-number>
gh issue close <task-numbers>
git reset HEAD~1
```

## Performance

**Typical execution time:**
- Plan with 5 tasks: ~2-3 seconds
- Plan with 20 tasks: ~8-10 seconds

**Bottleneck:** GitHub API calls (1 call per issue)

**Optimization:** Could batch-create issues via GraphQL (future enhancement)

## Future Enhancements

1. **Parallel issue creation** - Use GitHub GraphQL mutations
2. **Epic templates** - Custom epic body formats per repo
3. **Auto-assign** - Assign epic to plan author
4. **Milestone linking** - Link epic to GitHub milestone
5. **Project board** - Auto-add to project board if configured
