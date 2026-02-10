#!/usr/bin/env node

/**
 * Enforce project board status rules:
 * - Todo/In Progress/Done: Epics only
 * - Subissues: All sub-issues (issues with parent relationships)
 */

import { execSync } from 'child_process';

const PROJECT_ID = 'PVT_kwHOABNJ7c4BOyQ9';
const STATUS_FIELD_ID = 'PVTSSF_lAHOABNJ7c4BOyQ9zg9YoQg';
const OWNER = 'castrojo';
const REPO = 'opencode-superpower-github';

const STATUS_OPTIONS = {
  TODO: 'f75ad846',
  IN_PROGRESS: '47fc9ee4',
  DONE: '98236657',
  SUBISSUES: '3e8e5321'
};

const EPIC_STATUSES = ['Todo', 'In Progress', 'Done'];

function execGraphQL(query, variables = {}) {
  const varsStr = Object.entries(variables)
    .map(([key, value]) => {
      const flag = typeof value === 'number' ? '-F' : '-f';
      return `${flag} ${key}='${value}'`;
    })
    .join(' ');
  
  const cmd = `gh api graphql -f query='${query.replace(/'/g, "'\\''")}' ${varsStr}`;
  
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    return JSON.parse(output).data;
  } catch (error) {
    throw new Error(`GraphQL failed: ${error.message}`);
  }
}

async function getProjectItems() {
  const query = `
    query {
      user(login: "${OWNER}") {
        projectV2(number: 1) {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                  labels(first: 20) {
                    nodes {
                      name
                    }
                  }
                  parent {
                    number
                  }
                }
              }
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  
  const result = execGraphQL(query);
  return result.user.projectV2.items.nodes
    .filter(item => item.content)
    .map(item => ({
      itemId: item.id,
      number: item.content.number,
      title: item.content.title,
      labels: item.content.labels.nodes.map(l => l.name),
      parent: item.content.parent,
      status: item.fieldValueByName?.name || 'No Status'
    }));
}

function isEpic(item) {
  return item.labels.includes('type/epic');
}

function hasParent(item) {
  return item.parent !== null;
}

function getCorrectStatus(item) {
  if (hasParent(item)) {
    return 'Subissues';
  }
  
  // Epics can have any of the epic statuses
  if (isEpic(item)) {
    // Keep current status if it's already a valid epic status
    if (EPIC_STATUSES.includes(item.status)) {
      return item.status;
    }
    // Default to Todo if epic has invalid status
    return 'Todo';
  }
  
  // Non-epic without parent should be in Subissues (orphaned issue)
  return 'Subissues';
}

async function updateItemStatus(itemId, statusName) {
  const optionId = STATUS_OPTIONS[statusName.toUpperCase().replace(/ /g, '_')];
  
  if (!optionId) {
    console.error(`  ✗ Unknown status: ${statusName}`);
    return false;
  }
  
  const mutation = `
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${PROJECT_ID}"
        itemId: "${itemId}"
        fieldId: "${STATUS_FIELD_ID}"
        value: { singleSelectOptionId: "${optionId}" }
      }) {
        projectV2Item { id }
      }
    }
  `;
  
  try {
    execGraphQL(mutation);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to update: ${error.message}`);
    return false;
  }
}

async function enforceRules() {
  console.log('Enforcing project board status rules...\n');
  
  const items = await getProjectItems();
  
  let checked = 0;
  let fixed = 0;
  let errors = 0;
  
  for (const item of items) {
    checked++;
    
    const correctStatus = getCorrectStatus(item);
    
    if (item.status !== correctStatus) {
      console.log(`Issue #${item.number}: ${item.title}`);
      console.log(`  Current: ${item.status}`);
      console.log(`  Expected: ${correctStatus}`);
      console.log(`  Type: ${isEpic(item) ? 'Epic' : 'Sub-issue'}`);
      console.log(`  Parent: ${item.parent ? `#${item.parent.number}` : 'None'}`);
      
      if (await updateItemStatus(item.itemId, correctStatus)) {
        console.log(`  ✓ Fixed\n`);
        fixed++;
      } else {
        console.log(`  ✗ Failed\n`);
        errors++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Summary:`);
  console.log(`  Checked: ${checked} issues`);
  console.log(`  Fixed: ${fixed} issues`);
  console.log(`  Errors: ${errors} issues`);
  console.log(`  Compliant: ${checked - fixed - errors} issues`);
  console.log('='.repeat(50));
  
  if (fixed === 0 && errors === 0) {
    console.log('\n✅ All issues are correctly organized!');
  } else if (errors === 0) {
    console.log(`\n✅ Fixed ${fixed} issue(s) - board is now compliant`);
  } else {
    console.log(`\n⚠️  ${errors} error(s) occurred - manual review needed`);
  }
}

enforceRules().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
