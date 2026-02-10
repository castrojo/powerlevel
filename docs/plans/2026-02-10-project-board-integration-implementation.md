# Project Board Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable automatic GitHub Project Board integration when creating epics, with proper field mapping from labels to project fields.

**Architecture:** Implement three new library modules (project-board-detector, project-field-manager, project-item-manager) and integrate them into the epic creation flow. Use GraphQL API for field operations while maintaining gh CLI for basic operations.

**Tech Stack:** Node.js, GitHub CLI, GitHub GraphQL API

---

## Phase 1: Core Infrastructure

### Task 1: Implement Project Board Detector

**Files:**
- Create: `lib/project-board-detector.js`
- Modify: `lib/cache-manager.js` (add project board caching functions)

**Step 1: Create project board detector stub**

Create `lib/project-board-detector.js`:

```javascript
import { execGh } from './github-cli.js';

/**
 * Detect the default project board for a user/org
 * Returns the first active project board
 */
export function detectProjectBoard(owner) {
  try {
    const projectsJson = execGh(`project list --owner ${owner} --format json`);
    const projects = JSON.parse(projectsJson);
    
    if (!projects.projects || projects.projects.length === 0) {
      return null;
    }
    
    const firstProject = projects.projects[0];
    
    return {
      id: firstProject.id,
      number: firstProject.number,
      title: firstProject.title,
      owner: owner,
      url: firstProject.url || `https://github.com/users/${owner}/projects/${firstProject.number}`,
      detected_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to detect project board: ${error.message}`);
    return null;
  }
}

/**
 * Get a specific project board by number
 */
export function getProjectBoard(owner, projectNumber) {
  try {
    const projectsJson = execGh(`project list --owner ${owner} --format json`);
    const projects = JSON.parse(projectsJson);
    
    if (!projects.projects) {
      return null;
    }
    
    const project = projects.projects.find(p => p.number === projectNumber);
    
    if (!project) {
      return null;
    }
    
    return {
      id: project.id,
      number: project.number,
      title: project.title,
      owner: owner,
      url: project.url || `https://github.com/users/${owner}/projects/${project.number}`,
      detected_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to get project board: ${error.message}`);
    return null;
  }
}
```

**Step 2: Add project board caching to cache-manager**

Add to `lib/cache-manager.js`:

```javascript
/**
 * Get cached project board info
 */
export function getCachedProjectBoard(cache) {
  return cache.project_board || null;
}

/**
 * Cache project board info
 */
export function cacheProjectBoard(cache, projectBoard) {
  cache.project_board = projectBoard;
}
```

**Step 3: Test project board detection manually**

Run:
```bash
node -e "import('./lib/project-board-detector.js').then(m => console.log(JSON.stringify(m.detectProjectBoard('castrojo'), null, 2)))"
```

Expected: JSON output with project board details or null

**Step 4: Commit**

```bash
git add lib/project-board-detector.js lib/cache-manager.js
git commit -m "feat: add project board detection and caching"
```

---

### Task 2: Implement Project Field Manager (read-only)

**Files:**
- Create: `lib/project-field-manager.js`

**Step 1: Create GraphQL query helper**

Create `lib/project-field-manager.js`:

```javascript
import { execSync } from 'child_process';

/**
 * Execute a GraphQL query using gh CLI
 */
function execGraphQL(query, variables = {}) {
  const variablesJson = JSON.stringify(variables);
  const queryJson = JSON.stringify(query);
  
  try {
    const result = execSync(
      `gh api graphql -f query=${queryJson} -F variables=${variablesJson}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(result);
  } catch (error) {
    throw new Error(`GraphQL query failed: ${error.message}`);
  }
}

/**
 * Get project fields with their IDs and options
 */
export function getProjectFields(owner, projectNumber) {
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          title
          fields(first: 20) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const result = execGraphQL(query, { owner, number: projectNumber });
    
    if (!result.data || !result.data.user || !result.data.user.projectV2) {
      return null;
    }
    
    const project = result.data.user.projectV2;
    const fields = {};
    
    for (const field of project.fields.nodes) {
      fields[field.name] = {
        id: field.id,
        name: field.name,
        dataType: field.dataType,
        options: field.options || null
      };
    }
    
    return {
      projectId: project.id,
      fields
    };
  } catch (error) {
    console.error(`Failed to get project fields: ${error.message}`);
    return null;
  }
}

/**
 * Map label to field value
 * Returns { fieldName, optionId } or null
 */
export function mapLabelToField(label, projectFields) {
  if (!projectFields || !projectFields.fields) {
    return null;
  }
  
  const fields = projectFields.fields;
  
  // Priority mapping
  const priorityMap = {
    'priority/p0': { field: 'Priority', value: 'P0 - Critical' },
    'priority/p1': { field: 'Priority', value: 'P1 - High' },
    'priority/p2': { field: 'Priority', value: 'P2 - Normal' },
    'priority/p3': { field: 'Priority', value: 'P3 - Low' }
  };
  
  // Status mapping
  const statusMap = {
    'status/planning': { field: 'Status', value: 'Todo' },
    'status/in-progress': { field: 'Status', value: 'In Progress' },
    'status/review': { field: 'Status', value: 'In Progress' },
    'status/done': { field: 'Status', value: 'Done' }
  };
  
  let mapping = null;
  if (priorityMap[label]) {
    mapping = priorityMap[label];
  } else if (statusMap[label]) {
    mapping = statusMap[label];
  } else {
    return null;
  }
  
  const field = fields[mapping.field];
  if (!field || !field.options) {
    return null;
  }
  
  const option = field.options.find(opt => opt.name === mapping.value);
  if (!option) {
    return null;
  }
  
  return {
    fieldId: field.id,
    fieldName: field.name,
    optionId: option.id,
    optionName: option.name
  };
}
```

**Step 2: Test field reading manually**

Run:
```bash
node -e "import('./lib/project-field-manager.js').then(m => console.log(JSON.stringify(m.getProjectFields('castrojo', 1), null, 2)))"
```

Expected: JSON output with field definitions

**Step 3: Commit**

```bash
git add lib/project-field-manager.js
git commit -m "feat: add project field manager for reading fields"
```

---

### Task 3: Implement Project Item Manager

**Files:**
- Create: `lib/project-item-manager.js`

**Step 1: Create project item manager**

Create `lib/project-item-manager.js`:

```javascript
import { execSync } from 'child_process';

/**
 * Execute a GraphQL mutation using gh CLI
 */
function execGraphQL(query) {
  try {
    const result = execSync(`gh api graphql -f query='${query}'`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(result);
  } catch (error) {
    throw new Error(`GraphQL mutation failed: ${error.message}`);
  }
}

/**
 * Add an issue to a project board
 * Returns the project item ID
 */
export function addIssueToProject(projectId, issueId) {
  const mutation = `
    mutation {
      addProjectV2ItemById(input: {
        projectId: "${projectId}"
        contentId: "${issueId}"
      }) {
        item {
          id
        }
      }
    }
  `;
  
  try {
    const result = execGraphQL(mutation);
    
    if (result.errors) {
      // Check if error is "already exists"
      const alreadyExists = result.errors.some(err => 
        err.message.includes('already exists') || 
        err.message.includes('duplicate')
      );
      
      if (alreadyExists) {
        console.log('  Item already in project, skipping');
        return null;
      }
      
      throw new Error(result.errors[0].message);
    }
    
    return result.data.addProjectV2ItemById.item.id;
  } catch (error) {
    console.error(`Failed to add issue to project: ${error.message}`);
    return null;
  }
}

/**
 * Update a project item field value
 */
export function updateProjectItemField(projectId, itemId, fieldId, optionId) {
  const mutation = `
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${projectId}"
        itemId: "${itemId}"
        fieldId: "${fieldId}"
        value: {
          singleSelectOptionId: "${optionId}"
        }
      }) {
        projectV2Item {
          id
        }
      }
    }
  `;
  
  try {
    const result = execGraphQL(mutation);
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to update project field: ${error.message}`);
    return false;
  }
}

/**
 * Get issue node ID from issue number
 */
export function getIssueNodeId(repoPath, issueNumber) {
  const [owner, repo] = repoPath.split('/');
  
  const query = `
    query {
      repository(owner: "${owner}", name: "${repo}") {
        issue(number: ${issueNumber}) {
          id
        }
      }
    }
  `;
  
  try {
    const result = execGraphQL(query);
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    
    return result.data.repository.issue.id;
  } catch (error) {
    console.error(`Failed to get issue node ID: ${error.message}`);
    return null;
  }
}
```

**Step 2: Commit**

```bash
git add lib/project-item-manager.js
git commit -m "feat: add project item manager for adding issues and setting fields"
```

---

### Task 4: Integrate project board into create-epic script

**Files:**
- Modify: `bin/create-epic.js`

**Step 1: Import new modules**

Add imports to `bin/create-epic.js` after line 10:

```javascript
import { detectProjectBoard } from '../lib/project-board-detector.js';
import { getProjectFields, mapLabelToField } from '../lib/project-field-manager.js';
import { addIssueToProject, updateProjectItemField, getIssueNodeId } from '../lib/project-item-manager.js';
import { getCachedProjectBoard, cacheProjectBoard } from '../lib/cache-manager.js';
```

**Step 2: Replace basic project board code**

Replace lines 145-166 in `bin/create-epic.js` with:

```javascript
  // Add epic to project board with field mapping
  console.log('');
  console.log('Adding epic to project board...');
  
  try {
    // Try to get cached project board first
    let projectBoard = getCachedProjectBoard(cache);
    
    // If not cached, detect it
    if (!projectBoard) {
      projectBoard = detectProjectBoard(owner);
      
      if (projectBoard) {
        cacheProjectBoard(cache, projectBoard);
        saveCache(owner, repo, cache);
      }
    }
    
    if (!projectBoard) {
      console.log('  ⚠ No project board found, skipping');
    } else {
      console.log(`  Using project: ${projectBoard.title}`);
      
      // Get issue node ID
      const issueNodeId = getIssueNodeId(repoPath, epicNumber);
      if (!issueNodeId) {
        throw new Error('Failed to get issue node ID');
      }
      
      // Add epic to project
      const itemId = addIssueToProject(projectBoard.id, issueNodeId);
      
      if (itemId) {
        console.log(`  ✓ Added epic to project board`);
        
        // Get project fields
        const projectFields = getProjectFields(owner, projectBoard.number);
        
        if (projectFields) {
          // Map priority label to field
          const priorityLabel = `priority/${plan.priority}`;
          const priorityMapping = mapLabelToField(priorityLabel, projectFields);
          
          if (priorityMapping) {
            const success = updateProjectItemField(
              projectBoard.id,
              itemId,
              priorityMapping.fieldId,
              priorityMapping.optionId
            );
            
            if (success) {
              console.log(`  ✓ Set Priority: ${priorityMapping.optionName}`);
            }
          }
          
          // Map status label to field
          const statusMapping = mapLabelToField('status/planning', projectFields);
          
          if (statusMapping) {
            const success = updateProjectItemField(
              projectBoard.id,
              itemId,
              statusMapping.fieldId,
              statusMapping.optionId
            );
            
            if (success) {
              console.log(`  ✓ Set Status: ${statusMapping.optionName}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`  ✗ Failed to add to project board: ${error.message}`);
    console.log(`  (Epic creation succeeded - project board is optional)`);
  }
```

**Step 3: Test epic creation with project board**

Run:
```bash
node bin/create-epic.js docs/plans/2026-02-09-project-board-integration.md
```

Expected: Epic created, added to project board, Priority and Status fields set

**Step 4: Commit**

```bash
git add bin/create-epic.js
git commit -m "feat: integrate project board with field mapping into epic creation"
```

---

## Phase 2: Sub-Issue Project Board Integration

### Task 5: Add sub-issues to project board

**Files:**
- Modify: `bin/create-epic.js`

**Step 1: Add sub-issues to project board**

After the sub-issue creation loop (after line 138), add:

```javascript
  // Add sub-issues to project board
  if (cache.project_board && cache.sub_issues && cache.sub_issues.length > 0) {
    console.log('');
    console.log('Adding sub-issues to project board...');
    
    const projectBoard = cache.project_board;
    const projectFields = getProjectFields(owner, projectBoard.number);
    
    for (const epic of cache.epics) {
      if (epic.number === epicNumber) {
        for (const subIssue of epic.sub_issues) {
          try {
            const issueNodeId = getIssueNodeId(repoPath, subIssue.number);
            if (!issueNodeId) {
              console.log(`  ⚠ Could not get node ID for #${subIssue.number}`);
              continue;
            }
            
            const itemId = addIssueToProject(projectBoard.id, issueNodeId);
            
            if (itemId && projectFields) {
              // Set priority field
              const priorityLabel = `priority/${plan.priority}`;
              const priorityMapping = mapLabelToField(priorityLabel, projectFields);
              
              if (priorityMapping) {
                updateProjectItemField(
                  projectBoard.id,
                  itemId,
                  priorityMapping.fieldId,
                  priorityMapping.optionId
                );
              }
              
              // Set status field
              const statusMapping = mapLabelToField('status/planning', projectFields);
              
              if (statusMapping) {
                updateProjectItemField(
                  projectBoard.id,
                  itemId,
                  statusMapping.fieldId,
                  statusMapping.optionId
                );
              }
              
              console.log(`  ✓ Added #${subIssue.number} to project`);
            }
          } catch (error) {
            console.log(`  ⚠ Failed to add #${subIssue.number}: ${error.message}`);
          }
        }
      }
    }
  }
```

**Step 2: Test with an epic that has sub-issues**

Create a test plan file `docs/plans/test-sub-issues.md`:

```markdown
# Test Sub-Issues

**Goal:** Test sub-issue project board integration

**Priority:** p2

## Task 1: First task
## Task 2: Second task
## Task 3: Third task
```

Run:
```bash
node bin/create-epic.js docs/plans/test-sub-issues.md
```

Expected: Epic and 3 sub-issues added to project board with fields set

**Step 3: Clean up test plan**

```bash
rm docs/plans/test-sub-issues.md
```

**Step 4: Commit**

```bash
git add bin/create-epic.js
git commit -m "feat: add sub-issues to project board with field mapping"
```

---

## Phase 3: Configuration Support

### Task 6: Add configuration support for project board

**Files:**
- Modify: `lib/config-loader.js`

**Step 1: Read existing config-loader**

Check what's already in `lib/config-loader.js`

**Step 2: Add project board configuration options**

Add to `lib/config-loader.js`:

```javascript
/**
 * Get project board configuration
 */
export function getProjectBoardConfig(config) {
  const defaults = {
    enabled: true,
    projectNumber: null, // null = auto-detect first project
    autoCreateFields: false,
    fieldMapping: {
      priority: 'Priority',
      status: 'Status',
      epic: 'Parent issue'
    }
  };
  
  if (!config || !config.projectBoard) {
    return defaults;
  }
  
  return {
    enabled: config.projectBoard.enabled !== false,
    projectNumber: config.projectBoard.projectNumber || defaults.projectNumber,
    autoCreateFields: config.projectBoard.autoCreateFields || defaults.autoCreateFields,
    fieldMapping: {
      ...defaults.fieldMapping,
      ...(config.projectBoard.fieldMapping || {})
    }
  };
}
```

**Step 3: Check for environment variables**

Add environment variable support:

```javascript
/**
 * Get project board configuration from environment
 */
export function getProjectBoardConfigFromEnv() {
  return {
    enabled: process.env.GITHUB_TRACKER_PROJECT_ENABLED !== 'false',
    projectNumber: process.env.GITHUB_TRACKER_PROJECT_NUMBER 
      ? parseInt(process.env.GITHUB_TRACKER_PROJECT_NUMBER, 10) 
      : null,
    autoCreateFields: process.env.GITHUB_TRACKER_PROJECT_AUTO_CREATE_FIELDS === 'true'
  };
}
```

**Step 4: Update create-epic to use configuration**

In `bin/create-epic.js`, add after line 49:

```javascript
import { loadConfig, getProjectBoardConfig, getProjectBoardConfigFromEnv } from '../lib/config-loader.js';
```

And before project board integration (around line 145), add:

```javascript
  // Load project board configuration
  const fileConfig = loadConfig();
  const envConfig = getProjectBoardConfigFromEnv();
  const projectConfig = {
    ...getProjectBoardConfig(fileConfig),
    ...envConfig
  };
  
  if (!projectConfig.enabled) {
    console.log('');
    console.log('⚠ Project board integration disabled via configuration');
    // Skip project board integration
  } else {
```

**Step 5: Test with configuration**

Create `.github-tracker.json`:

```json
{
  "projectBoard": {
    "enabled": true,
    "projectNumber": 1
  }
}
```

Run:
```bash
node bin/create-epic.js docs/plans/test-config.md
```

Expected: Uses project 1 specifically

**Step 6: Test with disabled configuration**

Create `.github-tracker.json`:

```json
{
  "projectBoard": {
    "enabled": false
  }
}
```

Run and verify project board is skipped

**Step 7: Clean up test config**

```bash
rm .github-tracker.json
```

**Step 8: Commit**

```bash
git add lib/config-loader.js bin/create-epic.js
git commit -m "feat: add configuration support for project board integration"
```

---

## Phase 4: Documentation and Polish

### Task 7: Add documentation

**Files:**
- Modify: `README.md`

**Step 1: Read existing README**

Check `README.md` structure

**Step 2: Add project board section**

Add to README.md after the "Epic Creation" section:

```markdown
## Project Board Integration

Epics and sub-issues are automatically added to your GitHub Project Board with proper field mapping.

### Features

- Auto-detects your first project board
- Maps labels to project fields:
  - `priority/p0-p3` → Priority field
  - `status/*` → Status field
- Adds both epics and sub-issues to the board
- Gracefully handles missing project boards or fields

### Configuration

**Environment Variables:**
```bash
# Disable project board integration
export GITHUB_TRACKER_PROJECT_ENABLED=false

# Use specific project number
export GITHUB_TRACKER_PROJECT_NUMBER=2
```

**Config File** (`.github-tracker.json`):
```json
{
  "projectBoard": {
    "enabled": true,
    "projectNumber": 1,
    "fieldMapping": {
      "priority": "Priority",
      "status": "Status"
    }
  }
}
```

### Field Mapping

The following label-to-field mappings are applied automatically:

| Label | Project Field | Project Value |
|-------|---------------|---------------|
| `priority/p0` | Priority | P0 - Critical |
| `priority/p1` | Priority | P1 - High |
| `priority/p2` | Priority | P2 - Normal |
| `priority/p3` | Priority | P3 - Low |
| `status/planning` | Status | Todo |
| `status/in-progress` | Status | In Progress |
| `status/review` | Status | In Progress |
| `status/done` | Status | Done |
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add project board integration documentation"
```

---

### Task 8: Add error handling improvements

**Files:**
- Modify: `lib/project-item-manager.js`

**Step 1: Improve GraphQL error handling**

Update `execGraphQL` function in `lib/project-item-manager.js`:

```javascript
function execGraphQL(query) {
  try {
    // Escape single quotes in query
    const escapedQuery = query.replace(/'/g, "'\\''");
    const result = execSync(`gh api graphql -f query='${escapedQuery}'`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(result);
  } catch (error) {
    // Try to parse error output as JSON
    try {
      const errorOutput = error.stderr || error.stdout || '';
      const parsed = JSON.parse(errorOutput);
      if (parsed.errors) {
        return parsed; // Return with errors so caller can handle
      }
    } catch (parseError) {
      // Not JSON, use original error
    }
    throw new Error(`GraphQL query failed: ${error.message}`);
  }
}
```

**Step 2: Add retry logic for rate limits**

Add retry helper:

```javascript
/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('rate limit') && i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`  Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

**Step 3: Commit**

```bash
git add lib/project-item-manager.js
git commit -m "fix: improve error handling and add retry logic for rate limits"
```

---

## Final Testing

### Task 9: End-to-end testing

**Step 1: Create a test plan**

Create `docs/plans/test-e2e.md`:

```markdown
# End-to-End Test Plan

**Goal:** Verify complete project board integration

**Priority:** p1

## Task 1: Test priority mapping
## Task 2: Test status mapping
## Task 3: Test error handling
```

**Step 2: Run epic creation**

```bash
node bin/create-epic.js docs/plans/test-e2e.md
```

Expected output:
- ✓ Created epic
- ✓ Added to project board
- ✓ Set Priority: P1 - High
- ✓ Set Status: Todo
- ✓ Created 3 sub-issues
- ✓ Added all sub-issues to project

**Step 3: Verify on GitHub**

Open the project board URL and verify:
1. Epic appears in project
2. Priority field is set correctly
3. Status field is set correctly
4. All sub-issues are added
5. Sub-issues have correct fields

**Step 4: Clean up test epic**

Close the test epic and issues on GitHub

**Step 5: Delete test plan**

```bash
rm docs/plans/test-e2e.md
```

**Step 6: Final commit**

```bash
git add -A
git commit -m "test: verify end-to-end project board integration"
```

---

## Success Criteria

- [x] Epics automatically added to project board
- [x] Priority field set from label
- [x] Status field set appropriately
- [x] Sub-issues added to board
- [x] Configuration support (env vars and config file)
- [x] Graceful error handling
- [x] Documentation complete
- [x] No breaking changes to existing epic creation
