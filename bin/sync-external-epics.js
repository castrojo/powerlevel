#!/usr/bin/env node

import { syncExternalEpic } from '../lib/external-tracker.js';

const POWERLEVEL_REPO = 'castrojo/powerlevel';

const syncs = [
  {
    epicNumber: 111,
    externalRepo: 'projectbluefin/common',
    description: 'Universal Blue / Bluefin common components and infrastructure'
  },
  {
    epicNumber: 112,
    externalRepo: 'castrojo/tap',
    description: 'Homebrew tap for Linux desktop packages'
  },
  {
    epicNumber: 133,
    externalRepo: 'cncf/staff',
    description: 'CNCF staff tasks and project management'
  },
  {
    epicNumber: 134,
    externalRepo: 'cncf/tab',
    description: 'CNCF Technical Advisory Board (TAB) and End User Community'
  }
];

console.log('🔄 Starting external epic syncs...\n');

for (const sync of syncs) {
  console.log(`Syncing Epic #${sync.epicNumber} (${sync.externalRepo})...`);
  const result = await syncExternalEpic(
    POWERLEVEL_REPO,
    sync.epicNumber,
    sync.externalRepo,
    sync.description
  );
  
  if (result.synced) {
    console.log(`✓ Synced ${result.issueCount} issues\n`);
  } else {
    console.error(`✗ Sync failed: ${result.error}\n`);
  }
}

console.log('✅ All syncs complete!');
