#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const repo = 'castrojo/opencode-superpower-github';
const owner = 'castrojo';
const repoName = 'opencode-superpower-github';

// Epic mapping
const epicMapping = {
  'epic/1': { number: 1, nodeId: null },
  'epic/4': { number: 4, nodeId: null },
  'epic/5': { number: 5, nodeId: null }
};

function execGraphQL(query, variables) {
  // Build variable arguments for gh CLI
  const parts = [];
  
  for (const [key, value] of Object.entries(variables)) {
    if (Array.isArray(value)) {
      // For arrays, pass each element separately
      for (const item of value) {
        parts.push(`-f ${key}[]='${item}'`);
      }
    } else if (typeof value === 'number') {
      parts.push(`-F ${key}=${value}`);
    } else {
      parts.push(`-f ${key}='${String(value).replace(/'/g, "'\\''")}'`);
    }
  }
  
  const varsStr = parts.join(' ');
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

async function getEpicNodeIds() {
  console.log('Fetching epic node IDs...');
  
  for (const [label, epic] of Object.entries(epicMapping)) {
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
        }
      }
    `;
    
    const result = execGraphQL(query, { owner, repo: repoName, number: epic.number });
    epic.nodeId = result.repository.issue.id;
    console.log(`  Epic #${epic.number} node ID: ${epic.nodeId}`);
  }
}

async function closeOldIssue(issueNumber) {
  try {
    execSync(`gh issue close ${issueNumber} --repo ${repo} --comment "Closing to recreate with parent relationship support. Content will be preserved in new issue."`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`  ✓ Closed old issue #${issueNumber}`);
  } catch (error) {
    console.error(`  ✗ Error closing #${issueNumber}: ${error.message}`);
  }
}

async function createIssueWithParent(issueData, parentNodeId) {
  const query = `
    mutation($repositoryId: ID!, $title: String!, $body: String!, $labelIds: [ID!], $parentIssueId: ID!) {
      createIssue(input: {
        repositoryId: $repositoryId
        title: $title
        body: $body
        labelIds: $labelIds
        parentIssueId: $parentIssueId
      }) {
        issue {
          id
          number
          url
        }
      }
    }
  `;
  
  // Get repository ID
  const repoQuery = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
      }
    }
  `;
  
  const repoResult = execGraphQL(repoQuery, { owner, name: repoName });
  const repositoryId = repoResult.repository.id;
  
  // Get label IDs
  const labelIds = [];
  for (const labelName of issueData.labels) {
    const labelQuery = `
      query($owner: String!, $name: String!, $label: String!) {
        repository(owner: $owner, name: $name) {
          label(name: $label) {
            id
          }
        }
      }
    `;
    
    try {
      const labelResult = execGraphQL(labelQuery, { owner, name: repoName, label: labelName });
      if (labelResult.repository.label) {
        labelIds.push(labelResult.repository.label.id);
      }
    } catch (err) {
      console.log(`    Warning: Label "${labelName}" not found, skipping`);
    }
  }
  
  // Create new issue
  const variables = {
    repositoryId,
    title: issueData.title,
    body: issueData.body || '',
    parentIssueId: parentNodeId
  };
  
  // Only add labelIds if we have labels
  if (labelIds.length > 0) {
    variables.labelIds = labelIds;
  }
  
  const result = execGraphQL(query, variables);
  
  return result.createIssue.issue;
}

async function recreateSubIssues() {
  console.log('Starting sub-issue recreation process...\n');
  
  // Load backup data (NDJSON format)
  const backupData = readFileSync('/tmp/subissue-backup/all-subissues-compact.json', 'utf8');
  const issues = backupData.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
  
  // Get epic node IDs
  await getEpicNodeIds();
  
  console.log(`\nProcessing ${issues.length} sub-issues...\n`);
  
  const mapping = []; // Track old -> new issue number mapping
  
  for (const issue of issues) {
    const epicLabel = issue.epic_label;
    const parentNodeId = epicMapping[epicLabel].nodeId;
    const parentNumber = epicMapping[epicLabel].number;
    
    console.log(`Processing #${issue.number}: ${issue.title}`);
    console.log(`  Parent: Epic #${parentNumber}`);
    
    try {
      // Close old issue
      await closeOldIssue(issue.number);
      
      // Create new issue with parent
      const newIssue = await createIssueWithParent(issue, parentNodeId);
      console.log(`  ✓ Created new issue #${newIssue.number} with parent relationship`);
      console.log(`  URL: ${newIssue.url}`);
      
      mapping.push({
        old: issue.number,
        new: newIssue.number,
        epic: parentNumber,
        title: issue.title
      });
      
    } catch (error) {
      console.error(`  ✗ Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  // Save mapping
  const mappingJson = JSON.stringify(mapping, null, 2);
  execSync(`cat > /tmp/subissue-backup/issue-mapping.json`, { input: mappingJson });
  
  console.log('✅ Sub-issue recreation complete!');
  console.log(`\nIssue number mapping saved to: /tmp/subissue-backup/issue-mapping.json`);
  console.log('\nNext step: Update epic bodies with new issue numbers');
  
  return mapping;
}

recreateSubIssues().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
