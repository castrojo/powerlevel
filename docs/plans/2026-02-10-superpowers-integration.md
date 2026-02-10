# Superpowers Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Powerlevel to drive Superpowers workflow through GitHub Project Boards, epics, and event-driven tracking.

**Architecture:** Event-driven integration using OpenCode session hooks to detect skill invocations (executing-plans, finishing-a-development-branch) and automatically track progress in GitHub. Project boards are created/configured on-demand using GitHub Projects V2 GraphQL API. Epic references are inserted at the top of plan files for easy discovery.

**Tech Stack:** Node.js, GitHub GraphQL API (Projects V2), OpenCode session events, existing Powerlevel cache system

---

## Task 1: Project Board Manager

Create library for managing GitHub Project Boards using Projects V2 GraphQL API.

**Files:**
- Create: `lib/project-board-manager.js`
- Create: `lib/__tests__/project-board-manager.test.js`

**Step 1: Write failing test for getOrCreateProjectBoard**

Create test file:

```javascript
// lib/__tests__/project-board-manager.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateProjectBoard, addEpicToBoard } from '../project-board-manager.js';

describe('project-board-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create project board if none exists', async () => {
    const owner = 'testuser';
    const repo = 'testrepo';
    
    const result = await getOrCreateProjectBoard(owner, repo);
    
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('number');
    expect(result).toHaveProperty('url');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- project-board-manager`
Expected: FAIL with "Cannot find module '../project-board-manager.js'"

**Step 3: Write minimal implementation**

Create implementation file:

```javascript
// lib/project-board-manager.js
import { execSync } from 'child_process';

/**
 * Get existing project board or create new one
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} config - Configuration object with optional board settings
 * @returns {Promise<Object>} Project board info { id, number, url }
 */
export async function getOrCreateProjectBoard(owner, repo, config = {}) {
  const repoPath = `${owner}/${repo}`;
  
  // Check if board is specified in config
  if (config.projectBoard?.number) {
    try {
      const board = await getProjectBoard(owner, repo, config.projectBoard.number);
      return board;
    } catch (error) {
      console.warn(`Configured board #${config.projectBoard.number} not found, creating new one`);
    }
  }
  
  // Try to find existing "Superpowers" board
  try {
    const boards = await listProjectBoards(owner, repo);
    const superpowersBoard = boards.find(b => b.title === 'Superpowers');
    if (superpowersBoard) {
      return superpowersBoard;
    }
  } catch (error) {
    console.debug('Could not list boards:', error.message);
  }
  
  // Create new board
  return createProjectBoard(owner, repo);
}

/**
 * List project boards for repository
 */
async function listProjectBoards(owner, repo) {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        projectsV2(first: 10) {
          nodes {
            id
            number
            title
            url
          }
        }
      }
    }
  `;
  
  const result = execGhGraphQL(query, { owner, repo });
  return result.repository.projectsV2.nodes;
}

/**
 * Get specific project board by number
 */
async function getProjectBoard(owner, repo, number) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        projectV2(number: $number) {
          id
          number
          title
          url
        }
      }
    }
  `;
  
  const result = execGhGraphQL(query, { owner, repo, number });
  return result.repository.projectV2;
}

/**
 * Create new project board
 */
async function createProjectBoard(owner, repo) {
  const repoPath = `${owner}/${repo}`;
  
  // Get repository ID first
  const repoQuery = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        id
      }
    }
  `;
  
  const repoResult = execGhGraphQL(repoQuery, { owner, repo });
  const repoId = repoResult.repository.id;
  
  // Create project
  const mutation = `
    mutation($repoId: ID!, $title: String!) {
      createProjectV2(input: {
        repositoryId: $repoId,
        title: $title
      }) {
        projectV2 {
          id
          number
          title
          url
        }
      }
    }
  `;
  
  const result = execGhGraphQL(mutation, { repoId, title: 'Superpowers' });
  return result.createProjectV2.projectV2;
}

/**
 * Add epic issue to project board
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} projectId - Project board ID
 * @param {number} issueNumber - Epic issue number
 */
export async function addEpicToBoard(owner, repo, projectId, issueNumber) {
  // Get issue ID
  const issueQuery = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;
  
  const issueResult = execGhGraphQL(issueQuery, { owner, repo, number: issueNumber });
  const issueId = issueResult.repository.issue.id;
  
  // Add to project
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {
        projectId: $projectId,
        contentId: $contentId
      }) {
        item {
          id
        }
      }
    }
  `;
  
  execGhGraphQL(mutation, { projectId, contentId: issueId });
}

/**
 * Execute GitHub GraphQL query using gh CLI
 */
function execGhGraphQL(query, variables) {
  const cmd = `gh api graphql -f query='${query.replace(/'/g, "'\\''")}' ${
    Object.entries(variables)
      .map(([key, value]) => {
        const type = typeof value === 'number' ? '-F' : '-f';
        return `${type} ${key}='${value}'`;
      })
      .join(' ')
  }`;
  
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    const result = JSON.parse(output);
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    
    return result.data;
  } catch (error) {
    throw new Error(`GraphQL query failed: ${error.message}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- project-board-manager`
Expected: PASS (or SKIP if no test environment)

**Step 5: Commit**

```bash
git add lib/project-board-manager.js lib/__tests__/project-board-manager.test.js
git commit -m "feat: add project board manager with GraphQL API"
```

---

## Task 2: Session Event Hooks

Create event listener system to detect Superpowers skill invocations.

**Files:**
- Create: `lib/session-hooks.js`
- Modify: `lib/cache-manager.js` (add event tracking)

**Step 1: Write failing test for session hook detection**

```javascript
// lib/__tests__/session-hooks.test.js
import { describe, it, expect, vi } from 'vitest';
import { registerSessionHooks, detectSkillInvocation } from '../session-hooks.js';

describe('session-hooks', () => {
  it('should detect executing-plans skill invocation', () => {
    const message = "I'm using the executing-plans skill to implement this plan.";
    const result = detectSkillInvocation(message);
    
    expect(result).toEqual({
      skill: 'executing-plans',
      detected: true
    });
  });

  it('should detect finishing-a-development-branch skill invocation', () => {
    const message = "I'm using the finishing-a-development-branch skill to complete this work.";
    const result = detectSkillInvocation(message);
    
    expect(result).toEqual({
      skill: 'finishing-a-development-branch',
      detected: true
    });
  });

  it('should return null for non-skill messages', () => {
    const message = "Just writing some code here";
    const result = detectSkillInvocation(message);
    
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- session-hooks`
Expected: FAIL with "Cannot find module '../session-hooks.js'"

**Step 3: Write implementation**

```javascript
// lib/session-hooks.js
import { loadCache, saveCache } from './cache-manager.js';
import { extractPlanFromMessage } from './parser.js';

/**
 * Pattern to detect skill invocations in messages
 */
const SKILL_PATTERNS = [
  { pattern: /using the executing-plans skill/i, skill: 'executing-plans' },
  { pattern: /using the finishing-a-development-branch skill/i, skill: 'finishing-a-development-branch' },
  { pattern: /using the subagent-driven-development skill/i, skill: 'subagent-driven-development' },
  { pattern: /using the writing-plans skill/i, skill: 'writing-plans' },
];

/**
 * Detect skill invocation from message
 * @param {string} message - Message text to analyze
 * @returns {Object|null} { skill, detected } or null
 */
export function detectSkillInvocation(message) {
  for (const { pattern, skill } of SKILL_PATTERNS) {
    if (pattern.test(message)) {
      return { skill, detected: true };
    }
  }
  return null;
}

/**
 * Register session event hooks
 * @param {Object} session - OpenCode session object
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 */
export function registerSessionHooks(session, owner, repo, cwd) {
  if (!session || !session.on) {
    console.warn('Session does not support event hooks');
    return;
  }

  // Hook into message events to detect skill usage
  session.on('assistant.message', async (message) => {
    const skillInfo = detectSkillInvocation(message.content || '');
    
    if (skillInfo) {
      console.debug(`Detected skill: ${skillInfo.skill}`);
      await handleSkillInvocation(skillInfo.skill, message, owner, repo, cwd);
    }
  });

  // Hook into plan file creation
  session.on('file.created', async (file) => {
    if (file.path && file.path.includes('docs/plans/')) {
      console.debug(`Plan file created: ${file.path}`);
      await handlePlanCreation(file.path, owner, repo, cwd);
    }
  });

  console.log('✓ Registered session event hooks for Superpowers integration');
}

/**
 * Handle skill invocation event
 */
async function handleSkillInvocation(skill, message, owner, repo, cwd) {
  const cache = loadCache(owner, repo);
  
  switch (skill) {
    case 'executing-plans':
      await handleExecutingPlans(message, cache, owner, repo, cwd);
      break;
    case 'finishing-a-development-branch':
      await handleFinishingBranch(message, cache, owner, repo, cwd);
      break;
    case 'subagent-driven-development':
      await handleSubagentDevelopment(message, cache, owner, repo, cwd);
      break;
  }
  
  saveCache(owner, repo, cache);
}

/**
 * Handle executing-plans skill invocation
 */
async function handleExecutingPlans(message, cache, owner, repo, cwd) {
  // Try to extract plan file reference from message
  const planFile = extractPlanFromMessage(message.content);
  
  if (planFile) {
    // Find epic associated with this plan
    const epic = findEpicByPlanFile(cache, planFile);
    
    if (epic) {
      console.log(`Linked executing-plans to epic #${epic.number}`);
      
      // Track event in epic journey
      if (!epic.journey) {
        epic.journey = [];
      }
      
      epic.journey.push({
        timestamp: new Date().toISOString(),
        event: 'skill_invocation',
        skill: 'executing-plans',
        message: 'Started executing implementation plan'
      });
      
      // Mark epic as dirty for sync
      epic.dirty = true;
      
      // Update epic status to in-progress
      if (epic.labels && !epic.labels.includes('status/in-progress')) {
        epic.labels = epic.labels.filter(l => !l.startsWith('status/'));
        epic.labels.push('status/in-progress');
      }
    }
  }
}

/**
 * Handle finishing-a-development-branch skill invocation
 */
async function handleFinishingBranch(message, cache, owner, repo, cwd) {
  // Try to find active epic based on current working directory or recent activity
  const activeEpic = findActiveEpic(cache, cwd);
  
  if (activeEpic) {
    console.log(`Linked finishing-branch to epic #${activeEpic.number}`);
    
    // Track event in epic journey
    if (!activeEpic.journey) {
      activeEpic.journey = [];
    }
    
    activeEpic.journey.push({
      timestamp: new Date().toISOString(),
      event: 'skill_invocation',
      skill: 'finishing-a-development-branch',
      message: 'Started finishing development branch'
    });
    
    // Mark epic as dirty for sync
    activeEpic.dirty = true;
    
    // Update epic status to review
    if (activeEpic.labels && !activeEpic.labels.includes('status/review')) {
      activeEpic.labels = activeEpic.labels.filter(l => !l.startsWith('status/'));
      activeEpic.labels.push('status/review');
    }
  }
}

/**
 * Handle subagent-driven-development skill invocation
 */
async function handleSubagentDevelopment(message, cache, owner, repo, cwd) {
  const planFile = extractPlanFromMessage(message.content);
  
  if (planFile) {
    const epic = findEpicByPlanFile(cache, planFile);
    
    if (epic) {
      console.log(`Linked subagent-driven-development to epic #${epic.number}`);
      
      if (!epic.journey) {
        epic.journey = [];
      }
      
      epic.journey.push({
        timestamp: new Date().toISOString(),
        event: 'skill_invocation',
        skill: 'subagent-driven-development',
        message: 'Started subagent-driven development'
      });
      
      epic.dirty = true;
    }
  }
}

/**
 * Handle plan file creation
 */
async function handlePlanCreation(planPath, owner, repo, cwd) {
  console.debug(`Plan created: ${planPath}`);
  // This will be handled by epic-creation skill
}

/**
 * Find epic by plan file path
 */
function findEpicByPlanFile(cache, planFile) {
  if (!cache.epics) return null;
  
  return Object.values(cache.epics).find(epic => 
    epic.plan_file === planFile || 
    epic.plan_file?.includes(planFile)
  );
}

/**
 * Find active epic (most recently updated with in-progress status)
 */
function findActiveEpic(cache, cwd) {
  if (!cache.epics) return null;
  
  const inProgressEpics = Object.values(cache.epics).filter(epic =>
    epic.state !== 'closed' &&
    epic.labels?.some(l => l === 'status/in-progress')
  );
  
  if (inProgressEpics.length === 0) {
    // Fall back to most recently updated open epic
    const openEpics = Object.values(cache.epics).filter(epic => epic.state !== 'closed');
    if (openEpics.length > 0) {
      return openEpics.sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      )[0];
    }
    return null;
  }
  
  // Return most recently updated in-progress epic
  return inProgressEpics.sort((a, b) => 
    new Date(b.updated_at) - new Date(a.updated_at)
  )[0];
}
```

**Step 4: Update parser.js to add extractPlanFromMessage**

Modify `lib/parser.js` to add:

```javascript
/**
 * Extract plan file path from message
 * @param {string} message - Message text
 * @returns {string|null} Plan file path or null
 */
export function extractPlanFromMessage(message) {
  // Look for patterns like "docs/plans/2026-02-10-feature.md"
  const match = message.match(/docs\/plans\/[\w-]+\.md/);
  return match ? match[0] : null;
}
```

**Step 5: Run tests**

Run: `npm test -- session-hooks`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/session-hooks.js lib/__tests__/session-hooks.test.js lib/parser.js
git commit -m "feat: add session event hooks for skill detection"
```

---

## Task 3: Enhanced Epic Reference Insertion

Update parser to insert epic references at top of plan files instead of appending.

**Files:**
- Modify: `lib/parser.js`
- Modify: `skills/epic-creation/SKILL.md` (update documentation)

**Step 1: Write test for epic reference insertion at top**

```javascript
// Add to lib/__tests__/parser.test.js
it('should insert epic reference at top of plan file', () => {
  const planContent = `# Feature Name Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build something cool

## Task 1: First Task`;

  const result = insertEpicReference(planContent, 123, [124, 125]);
  
  expect(result).toContain('> **Epic Issue:** #123');
  expect(result).toContain('> **Sub-Tasks:** #124, #125');
  // Should be after title but before Claude instruction
  const lines = result.split('\n');
  const epicLineIndex = lines.findIndex(l => l.includes('Epic Issue:'));
  const claudeLineIndex = lines.findIndex(l => l.includes('For Claude:'));
  expect(epicLineIndex).toBeGreaterThan(0);
  expect(epicLineIndex).toBeLessThan(claudeLineIndex);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- parser`
Expected: FAIL with "insertEpicReference is not defined"

**Step 3: Implement insertEpicReference function**

Add to `lib/parser.js`:

```javascript
/**
 * Insert epic reference at top of plan file (after title, before Claude instruction)
 * @param {string} content - Plan file content
 * @param {number} epicNumber - Epic issue number
 * @param {Array<number>} subTaskNumbers - Sub-task issue numbers
 * @returns {string} Updated content
 */
export function insertEpicReference(content, epicNumber, subTaskNumbers = []) {
  const lines = content.split('\n');
  
  // Find the line after the title (first # line)
  let insertIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('# ')) {
      insertIndex = i + 1;
      
      // Skip any blank lines after title
      while (insertIndex < lines.length && lines[insertIndex].trim() === '') {
        insertIndex++;
      }
      break;
    }
  }
  
  // Build epic reference block
  const epicRef = [
    '',
    `> **Epic Issue:** #${epicNumber}`,
  ];
  
  if (subTaskNumbers.length > 0) {
    epicRef.push(`> **Sub-Tasks:** ${subTaskNumbers.map(n => `#${n}`).join(', ')}`);
  }
  
  epicRef.push('');
  
  // Insert at the found position
  lines.splice(insertIndex, 0, ...epicRef);
  
  return lines.join('\n');
}
```

**Step 4: Update epic-creation skill to use insertEpicReference**

The skill should now use this function instead of appending.

**Step 5: Run tests**

Run: `npm test -- parser`
Expected: PASS

**Step 6: Commit**

```bash
git add lib/parser.js lib/__tests__/parser.test.js
git commit -m "feat: insert epic references at top of plan files"
```

---

## Task 4: Update Epic Creation for Project Boards

Enhance epic-creation to automatically add epics to project board.

**Files:**
- Modify: `bin/create-epic.js`
- Modify: `lib/cache-manager.js` (add project board caching)

**Step 1: Update cache structure to include project board**

Add to `lib/cache-manager.js`:

```javascript
/**
 * Add project board to cache
 * @param {Object} cache - Cache object
 * @param {Object} board - Board info { id, number, url }
 */
export function setProjectBoard(cache, board) {
  cache.project_board = board;
}

/**
 * Get project board from cache
 * @param {Object} cache - Cache object
 * @returns {Object|null} Board info or null
 */
export function getProjectBoard(cache) {
  return cache.project_board || null;
}
```

**Step 2: Update create-epic.js to use project board**

Modify `bin/create-epic.js` to add epic to board after creation:

```javascript
// Add imports at top
import { getOrCreateProjectBoard, addEpicToBoard } from '../lib/project-board-manager.js';
import { setProjectBoard, getProjectBoard } from '../lib/cache-manager.js';
import { loadConfig } from '../lib/config-loader.js';

// After epic creation, add to board
const config = loadConfig(cwd);
const cache = loadCache(repo.owner, repo.repo);

// Get or create project board
let board = getProjectBoard(cache);
if (!board) {
  board = await getOrCreateProjectBoard(repo.owner, repo.repo, config);
  setProjectBoard(cache, board);
  console.log(`✓ Project board: ${board.url}`);
}

// Add epic to board
await addEpicToBoard(repo.owner, repo.repo, board.id, epicNumber);
console.log(`✓ Added epic #${epicNumber} to project board`);

saveCache(repo.owner, repo.repo, cache);
```

**Step 3: Test epic creation with project board**

Run: `node bin/create-epic.js docs/plans/test-plan.md`
Expected: Epic created and added to board

**Step 4: Commit**

```bash
git add bin/create-epic.js lib/cache-manager.js
git commit -m "feat: add epics to project board on creation"
```

---

## Task 5: Plugin Session Hook Registration

Update plugin.js to register session event hooks.

**Files:**
- Modify: `plugin.js`

**Step 1: Import session-hooks module**

Add to top of `plugin.js`:

```javascript
import { registerSessionHooks } from './lib/session-hooks.js';
```

**Step 2: Register hooks after plugin initialization**

Add after line 382 (after wiki sync):

```javascript
  // Register session hooks for Superpowers integration
  registerSessionHooks(session, owner, repo, cwd);
```

**Step 3: Test plugin initialization**

Start OpenCode session and verify hooks are registered:
- Check console for "✓ Registered session event hooks"

**Step 4: Commit**

```bash
git add plugin.js
git commit -m "feat: register session hooks for Superpowers integration"
```

---

## Task 6: Configuration Support

Add configuration options for project board and integration settings.

**Files:**
- Modify: `lib/config-loader.js`
- Create: `.powerlevel.example.json`

**Step 1: Update config schema**

Add to `lib/config-loader.js` to support:

```javascript
// Default config should include:
{
  projectBoard: {
    enabled: true,
    number: null,  // Optional: use specific board number
    autoCreate: true  // Create board if none exists
  },
  superpowersIntegration: {
    enabled: true,
    trackSkillUsage: true,
    updateEpicOnSkillInvocation: true
  }
}
```

**Step 2: Create example config**

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
  "superpowers": {
    "repoUrl": "https://github.com/castrojo/superpowers.git",
    "wikiSync": false,
    "autoOnboard": true
  }
}
```

**Step 3: Update config-loader to merge these defaults**

Ensure config-loader properly merges user config with defaults.

**Step 4: Commit**

```bash
git add lib/config-loader.js .powerlevel.example.json
git commit -m "feat: add config support for project boards and integration"
```

---

## Task 7: Update Documentation

Update AGENTS.md and README with new integration features.

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md` (if exists)

**Step 1: Document new components in AGENTS.md**

Add sections for:
- Project Board Manager
- Session Hooks
- Event-driven tracking
- Configuration options

**Step 2: Update architecture diagram**

Update the Data Flow section to include:
- Session event detection
- Project board integration
- Skill invocation tracking

**Step 3: Add integration examples**

Show examples of:
- How executing-plans links to epics
- How project boards get populated
- How journey events are tracked

**Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: update with Superpowers integration details"
```

---

## Verification

After all tasks complete:

1. **Test epic creation:**
   ```bash
   node bin/create-epic.js docs/plans/test-plan.md
   ```
   - Verify epic created
   - Verify epic added to project board
   - Verify epic reference inserted at top of plan

2. **Test skill detection:**
   - Start OpenCode session
   - Invoke executing-plans skill
   - Check console for skill detection message
   - Verify epic journey updated

3. **Test project board:**
   - Check GitHub Projects tab
   - Verify "Superpowers" board exists
   - Verify epics appear in board

4. **Test configuration:**
   - Create `.powerlevel.json` with custom board number
   - Run epic creation
   - Verify it uses configured board

## Success Criteria

- ✅ Project boards are created automatically or use configured board
- ✅ Epics are automatically added to project board on creation
- ✅ Epic references are inserted at top of plan files
- ✅ Session hooks detect executing-plans and finishing-a-development-branch skill invocations
- ✅ Epic journey tracks skill invocations
- ✅ Epic status is updated based on skill usage (planning → in-progress → review)
- ✅ Configuration supports custom project board settings
- ✅ Documentation is updated with integration details
