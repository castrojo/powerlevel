#!/usr/bin/env node

/**
 * Manual test script for epic-updater.js
 * Demonstrates the epic update workflow
 * 
 * Run with: node test/manual-epic-updater-test.js
 */

import { addJourneyEntry, recordTaskCompletion } from '../lib/epic-updater.js';
import { loadCache, saveCache, addEpic } from '../lib/cache-manager.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

console.log('=== Epic Updater Manual Test ===\n');

// Setup test environment
const testDir = join(tmpdir(), `epic-updater-manual-test-${Date.now()}`);
mkdirSync(testDir, { recursive: true });

try {
  console.log(`📁 Test directory: ${testDir}\n`);
  
  // Initialize as git repo
  console.log('1️⃣  Initializing git repo...');
  execSync('git init', { cwd: testDir, stdio: 'ignore' });
  execSync('git remote add origin git@github.com:testuser/test-repo.git', { cwd: testDir, stdio: 'ignore' });
  console.log('   ✅ Git repo initialized\n');
  
  // Create .opencode directory and config
  console.log('2️⃣  Creating config...');
  const opencodeDir = join(testDir, '.opencode');
  mkdirSync(opencodeDir, { recursive: true });
  
  const config = {
    superpowers: {
      enabled: true,
      remote: 'origin',
      repoUrl: 'git@github.com:testuser/test-repo.git'
    },
    tracking: {
      autoUpdateEpics: true,
      updateOnTaskComplete: true,
      commentOnProgress: false
    }
  };
  
  writeFileSync(join(opencodeDir, 'config.json'), JSON.stringify(config, null, 2));
  console.log('   ✅ Config created\n');
  
  // Create a test plan file
  console.log('3️⃣  Creating test plan...');
  const planContent = `# Add GitHub Wiki Integration

## Goal

Implement automatic synchronization of project documentation to GitHub Wiki, 
making it easier to maintain up-to-date documentation for the Superpowers workflow.

## Tasks

- [ ] Create wiki sync library
- [ ] Add wiki detector for repo
- [ ] Implement auto-sync on session end
- [ ] Add manual sync command
- [ ] Document wiki setup process
`;
  
  const planFile = join(opencodeDir, 'plans', 'test-plan.md');
  mkdirSync(join(opencodeDir, 'plans'), { recursive: true });
  writeFileSync(planFile, planContent);
  console.log('   ✅ Plan created\n');
  
  // Create a test epic in cache
  console.log('4️⃣  Creating epic in cache...');
  let cache = loadCache('testuser', 'test-repo');
  cache = addEpic(cache, {
    number: 42,
    title: 'Add GitHub Wiki Integration',
    plan_file: planFile,
    state: 'open',
    labels: ['type/epic', 'priority/p1'],
    created_at: '2026-02-09T10:00:00Z'
  });
  saveCache('testuser', 'test-repo', cache);
  console.log('   ✅ Epic #42 created in cache\n');
  
  // Add initial journey entry
  console.log('5️⃣  Adding epic creation journey entry...');
  addJourneyEntry(42, {
    event: 'epic_created',
    message: '📝 Epic created from implementation plan',
    timestamp: '2026-02-09T10:00:00Z'
  }, testDir);
  console.log('   ✅ Journey entry added\n');
  
  // Simulate task 1 start
  console.log('6️⃣  Recording task 1 start...');
  addJourneyEntry(42, {
    event: 'task_started',
    message: '🚀 Task 1 started: Create wiki sync library',
    agent: 'subagent-task1',
    timestamp: '2026-02-09T11:30:00Z'
  }, testDir);
  console.log('   ✅ Task 1 start recorded\n');
  
  // Simulate task 1 completion
  console.log('7️⃣  Recording task 1 completion...');
  recordTaskCompletion(42, 1, 'Create wiki sync library', { name: 'subagent-task1' }, testDir);
  console.log('   ✅ Task 1 completion recorded\n');
  
  // Simulate task 2 start
  console.log('8️⃣  Recording task 2 start...');
  addJourneyEntry(42, {
    event: 'task_started',
    message: '🚀 Task 2 started: Add wiki detector for repo',
    agent: 'subagent-task2',
    timestamp: '2026-02-09T13:00:00Z'
  }, testDir);
  console.log('   ✅ Task 2 start recorded\n');
  
  // Simulate task 2 completion
  console.log('9️⃣  Recording task 2 completion...');
  recordTaskCompletion(42, 2, 'Add wiki detector for repo', { name: 'subagent-task2' }, testDir);
  console.log('   ✅ Task 2 completion recorded\n');
  
  // Load and display final cache state
  console.log('🔍 Final cache state:\n');
  cache = loadCache('testuser', 'test-repo');
  const epic = cache.epics.find(e => e.number === 42);
  
  console.log(`Epic #${epic.number}: ${epic.title}`);
  console.log(`State: ${epic.state}`);
  console.log(`Dirty: ${epic.dirty ? '✅ Yes (needs sync)' : '❌ No'}`);
  console.log(`Journey entries: ${epic.journey.length}`);
  console.log();
  
  console.log('Journey:');
  epic.journey.forEach((entry, index) => {
    const timestamp = new Date(entry.timestamp).toISOString().replace('T', ' ').substring(0, 16);
    console.log(`  ${index + 1}. [${timestamp} UTC] ${entry.message}`);
    if (entry.agent) {
      console.log(`     Agent: ${entry.agent}`);
    }
  });
  
  console.log('\n✅ Manual test completed successfully!');
  console.log('\nCache file location:');
  console.log(`   ${join(testDir, '../..', 'cache')}`);
  console.log('\nTo sync to GitHub (when gh CLI is configured):');
  console.log(`   import { syncEpicToGitHub } from './lib/epic-updater.js';`);
  console.log(`   syncEpicToGitHub(42, '${testDir}');`);
  
} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
} finally {
  // Cleanup
  console.log('\n🧹 Cleaning up test directory...');
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  console.log('   ✅ Cleanup complete\n');
}
