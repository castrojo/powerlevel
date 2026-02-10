#!/usr/bin/env node

import { addEpicToBoard } from '../lib/project-board-manager.js';

const projectId = 'PVT_kwHOABNJ7c4BOyQ9';
const owner = 'castrojo';
const repo = 'opencode-superpower-github';

// All issues to add (epics + sub-issues)
const allIssues = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33];

async function addAllIssues() {
  console.log(`Adding ${allIssues.length} issues to project board...\n`);
  
  let added = 0;
  let alreadyAdded = 0;
  let errors = 0;
  
  for (const issueNum of allIssues) {
    try {
      await addEpicToBoard(owner, repo, projectId, issueNum);
      console.log(`✓ Added issue #${issueNum} to project`);
      added++;
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('was already added')) {
        console.log(`→ Issue #${issueNum} already on project`);
        alreadyAdded++;
      } else {
        console.error(`✗ Error adding issue #${issueNum}: ${err.message}`);
        errors++;
      }
    }
  }
  
  console.log(`\n✅ Summary:`);
  console.log(`   Added: ${added}`);
  console.log(`   Already on board: ${alreadyAdded}`);
  console.log(`   Errors: ${errors}`);
}

addAllIssues().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
