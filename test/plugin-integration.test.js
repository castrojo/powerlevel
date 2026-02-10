#!/usr/bin/env node

/**
 * Integration test for plugin.js task completion detection
 * Tests that the plugin correctly detects and records task completions
 */

import { addEpic, addSubIssue, loadCache, saveCache } from '../lib/cache-manager.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { findCompletedTasks } from '../lib/task-completion-detector.js';

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Setup test repository with cache
function setupTestEnv() {
  const testDir = join(tmpdir(), `plugin-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  mkdirSync(testDir, { recursive: true });
  
  // Initialize as git repo
  execSync('git init', { cwd: testDir, stdio: 'ignore' });
  execSync('git config user.email "test@example.com"', { cwd: testDir, stdio: 'ignore' });
  execSync('git config user.name "Test User"', { cwd: testDir, stdio: 'ignore' });
  execSync('git remote add origin git@github.com:test/repo.git', { cwd: testDir, stdio: 'ignore' });
  
  // Create initial commit
  writeFileSync(join(testDir, 'README.md'), '# Test Repo\n');
  execSync('git add .', { cwd: testDir, stdio: 'ignore' });
  execSync('git commit -m "Initial commit"', { cwd: testDir, stdio: 'ignore' });
  
  // Create .opencode directory and config
  const opencodeDir = join(testDir, '.opencode');
  mkdirSync(opencodeDir, { recursive: true });
  
  const config = {
    superpowers: {
      enabled: true,
      remote: 'origin',
      repoUrl: 'git@github.com:test/repo.git'
    },
    tracking: {
      autoUpdateEpics: true,
      updateOnTaskComplete: true,
      commentOnProgress: false
    }
  };
  
  writeFileSync(join(opencodeDir, 'config.json'), JSON.stringify(config, null, 2));
  
  // Create a test plan file
  const planContent = `# Test Implementation Plan

**Goal:** Test epic task completion detection.

## Tasks

- [ ] Task 1: First task
- [ ] Task 2: Second task
- [ ] Task 3: Third task
`;
  
  const planFile = join(opencodeDir, 'plans', 'test-plan.md');
  mkdirSync(join(opencodeDir, 'plans'), { recursive: true });
  writeFileSync(planFile, planContent);
  
  // Setup cache with an epic and sub-issues
  let cache = loadCache('test', 'repo');
  
  cache = addEpic(cache, {
    number: 100,
    title: 'Test Epic',
    plan_file: planFile,
    state: 'open',
    labels: ['type/epic']
  });
  
  cache = addSubIssue(cache, 100, {
    number: 101,
    title: 'Task 1: First task',
    state: 'open',
    labels: ['type/task', 'epic/100']
  });
  
  cache = addSubIssue(cache, 100, {
    number: 102,
    title: 'Task 2: Second task',
    state: 'open',
    labels: ['type/task', 'epic/100']
  });
  
  saveCache('test', 'repo', cache);
  
  return { testDir, planFile };
}

function cleanupTestEnv(testDir) {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  
  // Cleanup cache
  const cacheDir = join(process.cwd(), 'cache');
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}

function addCommit(testDir, message) {
  const filename = `file-${Date.now()}.txt`;
  writeFileSync(join(testDir, filename), 'test content\n');
  execSync('git add .', { cwd: testDir, stdio: 'ignore' });
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: testDir, stdio: 'ignore' });
}

// Run tests
console.log('Running plugin.js integration tests...\n');

// Test 1: Task completion detection in real-world scenario
test('End-to-end: Detect task completion from commit and map to epic', () => {
  const { testDir } = setupTestEnv();
  
  try {
    const before = new Date().toISOString();
    
    // Wait to ensure commit timestamp is after 'before'
    const sleep = (ms) => execSync(`sleep ${ms / 1000}`, { stdio: 'ignore' });
    sleep(1100);
    
    // Simulate a developer completing task 1 (issue #101)
    addCommit(testDir, 'feat: implement first task closes #101');
    
    // Simulate the plugin checking for completed tasks
    const completedTasks = findCompletedTasks(before, testDir);
    
    assert(completedTasks.length === 1, 'Should find one completed task');
    assert(completedTasks[0].issueNumber === 101, 'Should detect issue #101');
    
    // Verify we can map it to the epic
    const cache = loadCache('test', 'repo');
    const issue = cache.issues.find(i => i.number === 101);
    assert(issue, 'Issue should be in cache');
    assert(issue.title === 'Task 1: First task', 'Issue title should match');
    
    const epic = cache.epics.find(e => 
      e.sub_issues?.some(si => si.number === 101)
    );
    assert(epic, 'Should find the epic containing this task');
    assert(epic.number === 100, 'Epic number should be 100');
    
  } finally {
    cleanupTestEnv(testDir);
  }
});

// Test 2: Multiple task completions in one session
test('End-to-end: Detect multiple task completions', () => {
  const { testDir } = setupTestEnv();
  
  try {
    const before = new Date().toISOString();
    
    const sleep = (ms) => execSync(`sleep ${ms / 1000}`, { stdio: 'ignore' });
    sleep(1100);
    
    // Simulate completing two tasks
    addCommit(testDir, 'feat: complete task 1 closes #101');
    addCommit(testDir, 'feat: complete task 2 fixes #102');
    
    const completedTasks = findCompletedTasks(before, testDir);
    
    assert(completedTasks.length === 2, `Should find two completed tasks, got ${completedTasks.length}`);
    assert(completedTasks.some(t => t.issueNumber === 101), 'Should include issue #101');
    assert(completedTasks.some(t => t.issueNumber === 102), 'Should include issue #102');
    
  } finally {
    cleanupTestEnv(testDir);
  }
});

// Test 3: No false positives for unrelated commits
test('End-to-end: No false positives for regular commits', () => {
  const { testDir } = setupTestEnv();
  
  try {
    const before = new Date().toISOString();
    
    const sleep = (ms) => execSync(`sleep ${ms / 1000}`, { stdio: 'ignore' });
    sleep(1100);
    
    // Add regular commits without task completions
    addCommit(testDir, 'feat: add new feature');
    addCommit(testDir, 'fix: bug fix');
    addCommit(testDir, 'docs: update readme');
    
    const completedTasks = findCompletedTasks(before, testDir);
    
    assert(completedTasks.length === 0, 'Should not find any completed tasks');
    
  } finally {
    cleanupTestEnv(testDir);
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('='.repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
