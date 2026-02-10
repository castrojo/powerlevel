# Project Board Integration Design

**Date:** 2026-02-09  
**Status:** Design  
**Priority:** p2

## Goal

Enable automatic GitHub Project Board integration when creating epics. Users can define custom project views and fields, and the system will automatically add epics/tasks to the project board with proper field values populated from labels and plan metadata.

## Problem Statement

Currently:
- Epics and tasks are created as GitHub issues but not added to project boards
- Project board must be manually maintained (adding issues, setting fields)
- No connection between labels (priority/p2) and project fields (Priority)
- Users have to duplicate metadata entry (once in labels, once in project fields)

## Proposed Solution

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Epic Creation Flow                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Parse plan file                                         │
│     ↓                                                       │
│  2. Create GitHub issues (epic + tasks)                     │
│     ↓                                                       │
│  3. Detect/Cache project board                              │
│     ↓                                                       │
│  4. Add issues to project board                             │
│     ↓                                                       │
│  5. Map labels → project fields                             │
│     ↓                                                       │
│  6. Set project field values                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Design

#### 1. **Project Board Detector** (`lib/project-board-detector.js`)

**Purpose**: Discover and cache the user's default project board.

**Functions**:
- `detectProjectBoard(owner)` - Find first active project for user/org
- `getProjectId(owner, projectNumber)` - Get specific project by number
- `cacheProjectBoard(cache, projectInfo)` - Store in cache

**Cache Structure**:
```json
{
  "project_board": {
    "id": "PVT_kwHOABNJ7c4BOyQ9",
    "number": 1,
    "title": "Superpowers Development",
    "owner": "castrojo",
    "detected_at": "2026-02-09T22:00:00Z"
  }
}
```

**Detection Strategy**:
1. Check cache first
2. If not cached, use `gh project list --owner <owner>` to find first project
3. If multiple projects, use first one (user can override via config)
4. Store in cache for future use

---

#### 2. **Project Field Manager** (`lib/project-field-manager.js`)

**Purpose**: Map between GitHub labels and project board fields.

**Functions**:
- `getProjectFields(projectId)` - Fetch all fields with their IDs and options
- `mapLabelToField(label, fields)` - Convert label to field value
- `createFieldIfMissing(projectId, fieldName, fieldType)` - Auto-create fields

**Label → Field Mapping**:
```javascript
{
  // Priority mapping
  "priority/p0": { field: "Priority", value: "P0 - Critical" },
  "priority/p1": { field: "Priority", value: "P1 - High" },
  "priority/p2": { field: "Priority", value: "P2 - Normal" },
  "priority/p3": { field: "Priority", value: "P3 - Low" },
  
  // Status mapping
  "status/planning": { field: "Status", value: "Todo" },
  "status/in-progress": { field: "Status", value: "In Progress" },
  "status/review": { field: "Status", value: "In Progress" },
  "status/done": { field: "Status", value: "Done" },
  
  // Epic mapping
  "epic/123": { field: "Parent issue", value: 123 }
}
```

**Field Detection Strategy**:
- Query project for existing fields
- Cache field IDs and option IDs
- If field missing, optionally create it (or skip)

---

#### 3. **Project Item Manager** (`lib/project-item-manager.js`)

**Purpose**: Add issues to project board and set field values.

**Functions**:
- `addIssueToProject(projectId, issueId)` - Add issue to board
- `setProjectItemFields(projectId, itemId, fieldValues)` - Set multiple fields
- `updateProjectItemField(projectId, itemId, fieldId, value)` - Update single field

**GraphQL Mutations Used**:
```graphql
# Add item to project
mutation {
  addProjectV2ItemById(input: {
    projectId: "PROJECT_ID"
    contentId: "ISSUE_ID"
  }) {
    item { id }
  }
}

# Set field value
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PROJECT_ID"
    itemId: "ITEM_ID"
    fieldId: "FIELD_ID"
    value: { singleSelectOptionId: "OPTION_ID" }
  }) {
    projectV2Item { id }
  }
}
```

**Error Handling**:
- If item already in project, skip (no error)
- If field doesn't exist, log warning and continue
- If field value invalid, log warning and continue
- Never fail epic creation due to project board errors

---

#### 4. **Integration Point** (`bin/create-epic.js`)

**Modifications**:
```javascript
// After creating epic and tasks on GitHub...

// Step 6: Add to project board (new)
if (shouldUseProjectBoard(config)) {
  const projectBoard = await detectProjectBoard(owner);
  
  if (projectBoard) {
    // Add epic to project
    const epicItem = await addIssueToProject(projectBoard.id, epicNumber);
    
    // Set epic fields
    await setProjectItemFields(projectBoard.id, epicItem.id, {
      priority: plan.priority,
      status: 'planning'
    });
    
    // Add sub-issues to project
    for (const subIssue of taskIssues) {
      const taskItem = await addIssueToProject(projectBoard.id, subIssue.number);
      await setProjectItemFields(projectBoard.id, taskItem.id, {
        priority: plan.priority,
        status: 'planning',
        parent_issue: epicNumber
      });
    }
    
    // Cache project board info
    cache.project_board = projectBoard;
  }
}
```

---

### Configuration

Users can configure project board behavior via environment variables or config file:

**Environment Variables**:
```bash
# Disable project board integration
GITHUB_TRACKER_PROJECT_ENABLED=false

# Use specific project number
GITHUB_TRACKER_PROJECT_NUMBER=2

# Auto-create missing fields
GITHUB_TRACKER_PROJECT_AUTO_CREATE_FIELDS=true
```

**Config File** (`.github-tracker.json`):
```json
{
  "projectBoard": {
    "enabled": true,
    "projectNumber": 1,
    "autoCreateFields": false,
    "fieldMapping": {
      "priority": "Priority",
      "status": "Status",
      "epic": "Parent issue"
    }
  }
}
```

---

### Implementation Phases

#### Phase 1: Core Infrastructure
- Project board detector
- Project field manager (read-only)
- Add issues to project (no field setting)

#### Phase 2: Field Mapping
- Label → field mapping logic
- Set priority field from labels
- Set status field from labels

#### Phase 3: Advanced Features
- Auto-create missing fields
- Support custom field mappings
- Epic link field (Parent issue)

#### Phase 4: View Configuration
- Read user-defined view configuration
- Apply filters to views
- Set view-specific field visibility

---

### API Requirements

**GitHub CLI Commands**:
```bash
# List projects
gh project list --owner <owner> --format json

# Get project fields
gh project field-list <number> --owner <owner> --format json

# Add item to project
gh project item-add <number> --owner <owner> --url <issue-url>

# Note: Field setting requires GraphQL API
```

**GraphQL Queries**:
```graphql
# Get project with fields
query {
  user(login: "USER") {
    projectV2(number: NUMBER) {
      id
      title
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
}

# Add item and get item ID
mutation {
  addProjectV2ItemById(input: {
    projectId: "PROJECT_ID"
    contentId: "ISSUE_ID"
  }) {
    item { id }
  }
}

# Set field value
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PROJECT_ID"
    itemId: "ITEM_ID"
    fieldId: "FIELD_ID"
    value: { singleSelectOptionId: "OPTION_ID" }
  }) {
    projectV2Item { id }
  }
}
```

---

### User Experience

**Before** (Manual):
```bash
$ node bin/create-epic.js my-plan.md
✓ Created epic #5
✓ Created 3 sub-issues

# User manually:
# 1. Opens project board
# 2. Adds epic #5 to board
# 3. Adds sub-issues to board
# 4. Sets Priority field to P2
# 5. Sets Status field to Planning
```

**After** (Automatic):
```bash
$ node bin/create-epic.js my-plan.md
✓ Created epic #5
✓ Created 3 sub-issues
✓ Added to project board "Superpowers Development"
  → Set Priority: P2
  → Set Status: Planning
  → Added 3 sub-issues to board
```

---

### Testing Strategy

**Manual Testing**:
1. Create epic with priority label
2. Verify epic appears in project board
3. Verify Priority field matches label
4. Verify sub-issues added to board
5. Verify Parent issue field set correctly

**Edge Cases**:
- No project board exists → Skip gracefully
- Project board exists but no Priority field → Log warning, skip
- Issue already in project → Skip, no error
- Invalid priority label → Use default (P2)

---

### Future Enhancements

1. **Bidirectional Sync**: Update labels when project fields change
2. **View Templates**: Pre-defined view configurations (Epic Board, Sprint Board)
3. **Iteration Support**: Map plan dates to iteration fields
4. **Custom Fields**: Support user-defined field types (text, number, date)
5. **Multi-Project**: Support adding to multiple project boards
6. **Insights Integration**: Generate progress charts from project data

---

## Open Questions

1. **Field Creation**: Should we auto-create missing fields or just skip them?
2. **Default Project**: Use first project, or require explicit configuration?
3. **Error Handling**: Fail epic creation if project board fails, or just log warning?
4. **Field Names**: Hardcode field names ("Priority") or make them configurable?
5. **View Configuration**: Where should users define view configuration? (Config file? Interactive prompt?)

---

## Success Criteria

- [ ] Epics automatically added to project board
- [ ] Priority field set from label
- [ ] Status field set to appropriate value
- [ ] Sub-issues added to board with parent link
- [ ] Cache stores project board info
- [ ] No breaking changes to existing epic creation
- [ ] Graceful degradation if project board unavailable
- [ ] Documentation for configuration options

---

## References

- GitHub Projects v2 API: https://docs.github.com/en/graphql/reference/objects#projectv2
- Best Practices: https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/best-practices-for-projects
- GraphQL API: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects

---

**Epic:** #5 (https://github.com/castrojo/opencode-superpower-github/issues/5)
