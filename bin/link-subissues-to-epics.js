#!/usr/bin/env node

import { execSync } from 'child_process';

const projectId = 'PVT_kwHOABNJ7c4BOyQ9';
const owner = 'castrojo';
const repo = 'opencode-superpower-github';
const parentIssueFieldId = 'PVTF_lAHOABNJ7c4BOyQ9zg9YoQ4';

// Map of sub-issues to their parent epics (from epic/<number> labels)
const subIssueMapping = {
  // Epic #1 sub-issues
  2: 1,
  3: 1,
  
  // Epic #4 sub-issues
  6: 4, 7: 4, 8: 4, 9: 4, 10: 4, 11: 4, 12: 4, 13: 4,
  14: 4, 15: 4, 16: 4, 17: 4, 18: 4, 19: 4, 21: 4, 23: 4,
  
  // Epic #5 sub-issues
  20: 5, 22: 5, 24: 5, 25: 5, 26: 5, 27: 5, 28: 5, 29: 5,
  30: 5, 31: 5, 32: 5, 33: 5
};

function execGraphQL(query, variables) {
  const varsStr = Object.entries(variables)
    .map(([key, value]) => {
      const type = typeof value === 'number' ? '-F' : '-f';
      return `${type} ${key}='${value}'`;
    })
    .join(' ');
  
  const cmd = `gh api graphql -f query='${query.replace(/'/g, "'\\''")}' ${varsStr}`;
  
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

async function getProjectItemId(issueNumber) {
  const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          projectItems(first: 10) {
            nodes {
              id
              project {
                id
              }
            }
          }
        }
      }
    }
  `;
  
  const result = execGraphQL(query, { owner, repo, issueNumber });
  const items = result.repository.issue.projectItems.nodes;
  const item = items.find(i => i.project.id === projectId);
  
  if (!item) {
    throw new Error(`Issue #${issueNumber} not found in project`);
  }
  
  return item.id;
}

async function getIssueNodeId(issueNumber) {
  const query = `
    query($owner: String!, $repo: String!, $issueNumber: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $issueNumber) {
          id
        }
      }
    }
  `;
  
  const result = execGraphQL(query, { owner, repo, issueNumber });
  return result.repository.issue.id;
}

async function setParentIssue(subIssueNumber, epicNumber) {
  try {
    // Get project item ID for the sub-issue
    const itemId = await getProjectItemId(subIssueNumber);
    
    // Get node ID for the parent epic
    const epicNodeId = await getIssueNodeId(epicNumber);
    
    // Set parent issue field - use raw JSON approach
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $issueId: ID!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: {
            issueId: $issueId
          }
        }) {
          projectV2Item {
            id
          }
        }
      }
    `;
    
    const cmd = `gh api graphql -f query='${mutation.replace(/'/g, "'\\''")}' -f projectId='${projectId}' -f itemId='${itemId}' -f fieldId='${parentIssueFieldId}' -f issueId='${epicNodeId}'`;
    
    execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    
    console.log(`✓ Linked #${subIssueNumber} → Epic #${epicNumber}`);
  } catch (error) {
    console.error(`✗ Error linking #${subIssueNumber} → Epic #${epicNumber}: ${error.message}`);
  }
}

async function linkAllSubIssues() {
  console.log('Linking sub-issues to parent epics...\n');
  
  for (const [subIssue, epic] of Object.entries(subIssueMapping)) {
    await setParentIssue(parseInt(subIssue), epic);
  }
  
  console.log('\n✅ All sub-issues linked to their parent epics');
}

linkAllSubIssues().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
