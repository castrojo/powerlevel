#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const repo = 'castrojo/opencode-superpower-github';

async function updateEpicBodies() {
  console.log('Updating epic bodies with new issue numbers...\n');
  
  // Load mapping
  const mapping = JSON.parse(readFileSync('/tmp/subissue-backup/issue-mapping.json', 'utf8'));
  
  // Group by epic
  const epicMappings = {};
  for (const item of mapping) {
    if (!epicMappings[item.epic]) {
      epicMappings[item.epic] = [];
    }
    epicMappings[item.epic].push(item);
  }
  
  // Update each epic
  for (const [epicNumber, items] of Object.entries(epicMappings)) {
    console.log(`Updating Epic #${epicNumber} (${items.length} sub-issues)...`);
    
    try {
      // Get current epic body
      const bodyJson = execSync(`gh issue view ${epicNumber} --repo ${repo} --json body`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      let body = JSON.parse(bodyJson).body;
      
      // Replace old issue numbers with new ones
      for (const item of items) {
        // Replace patterns like "- #6 -" with "- #101 -"
        const oldPattern = new RegExp(`(- )#${item.old}( -)`, 'g');
        body = body.replace(oldPattern, `$1#${item.new}$2`);
      }
      
      // Write updated body
      const tmpFile = `/tmp/epic-${epicNumber}-updated-body.md`;
      execSync(`cat > ${tmpFile}`, { input: body });
      execSync(`gh issue edit ${epicNumber} --repo ${repo} --body-file ${tmpFile}`);
      execSync(`rm ${tmpFile}`);
      
      console.log(`  ✓ Updated Epic #${epicNumber}`);
      
    } catch (error) {
      console.error(`  ✗ Error updating Epic #${epicNumber}: ${error.message}`);
    }
  }
  
  console.log('\n✅ Epic bodies updated with new issue numbers!');
}

updateEpicBodies().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
