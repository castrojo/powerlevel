#!/usr/bin/env node

import { execSync } from 'child_process';

const repo = 'castrojo/opencode-superpower-github';
const epics = [1, 4, 5];

async function revertEpicTaskList(epicNumber) {
  try {
    // Get current epic body
    const bodyJson = execSync(`gh issue view ${epicNumber} --repo ${repo} --json body`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const { body } = JSON.parse(bodyJson);
    
    // Convert task list format back to plain list
    // Pattern: "- [ ] #N - " becomes "- #N - "
    const updatedBody = body.replace(/^- \[ \] #(\d+) - /gm, '- #$1 - ');
    
    // Only update if there were changes
    if (updatedBody !== body) {
      // Write updated body to temp file and update issue
      const tmpFile = `/tmp/epic-${epicNumber}-body.md`;
      execSync(`cat > ${tmpFile}`, { input: updatedBody });
      execSync(`gh issue edit ${epicNumber} --repo ${repo} --body-file ${tmpFile}`);
      execSync(`rm ${tmpFile}`);
      
      console.log(`✓ Reverted Epic #${epicNumber} to plain list format`);
      return true;
    } else {
      console.log(`→ Epic #${epicNumber} already has plain list format`);
      return false;
    }
  } catch (error) {
    console.error(`✗ Error updating Epic #${epicNumber}: ${error.message}`);
    return false;
  }
}

async function revertAllEpics() {
  console.log('Reverting epic task lists to plain list format...\n');
  
  let updated = 0;
  for (const epicNum of epics) {
    if (await revertEpicTaskList(epicNum)) {
      updated++;
    }
  }
  
  console.log(`\n✅ Reverted ${updated} epic(s) to plain list format`);
}

revertAllEpics().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
