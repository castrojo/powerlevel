#!/usr/bin/env node

/**
 * Test script for task-completion-detector.js
 * Tests detection of task completions from commit messages
 */

import { 
  detectTaskFromCommit,
  getRecentCommits,
  findCompletedTasks
} from '../lib/task-completion-detector.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

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

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Setup test git repository
function setupTestRepo() {
  const testDir = join(tmpdir(), `task-detector-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
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
  
  return testDir;
}

function cleanupTestRepo(testDir) {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

function addCommit(testDir, message) {
  const filename = `file-${Date.now()}.txt`;
  writeFileSync(join(testDir, filename), 'test content\n');
  execSync('git add .', { cwd: testDir, stdio: 'ignore' });
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: testDir, stdio: 'ignore' });
}

// Run tests
console.log('Running task-completion-detector.js tests...\n');

// Test 1: Detect task from "closes #N" commit message
test('detectTaskFromCommit - detects closes #N pattern', () => {
  const result = detectTaskFromCommit('closes #123');
  assertEqual(result, { issueNumber: 123, keyword: 'closes' }, 'Should detect closes pattern');
});

// Test 2: Detect task from "fixes #N" commit message
test('detectTaskFromCommit - detects fixes #N pattern', () => {
  const result = detectTaskFromCommit('fixes #456');
  assertEqual(result, { issueNumber: 456, keyword: 'fixes' }, 'Should detect fixes pattern');
});

// Test 3: Detect task from "resolves #N" commit message
test('detectTaskFromCommit - detects resolves #N pattern', () => {
  const result = detectTaskFromCommit('resolves #789');
  assertEqual(result, { issueNumber: 789, keyword: 'resolves' }, 'Should detect resolves pattern');
});

// Test 4: Detect task from "completes #N" commit message
test('detectTaskFromCommit - detects completes #N pattern', () => {
  const result = detectTaskFromCommit('completes #111');
  assertEqual(result, { issueNumber: 111, keyword: 'completes' }, 'Should detect completes pattern');
});

// Test 5: Case insensitive detection
test('detectTaskFromCommit - case insensitive', () => {
  const result1 = detectTaskFromCommit('Closes #222');
  const result2 = detectTaskFromCommit('FIXES #333');
  assertEqual(result1, { issueNumber: 222, keyword: 'closes' }, 'Should handle capitalized keyword');
  assertEqual(result2, { issueNumber: 333, keyword: 'fixes' }, 'Should handle uppercase keyword');
});

// Test 6: Detect in middle of commit message
test('detectTaskFromCommit - detects in middle of message', () => {
  const result = detectTaskFromCommit('feat: add new feature closes #444 and updates docs');
  assertEqual(result, { issueNumber: 444, keyword: 'closes' }, 'Should detect in middle of message');
});

// Test 7: Return null for non-matching messages
test('detectTaskFromCommit - returns null for non-matching messages', () => {
  const result1 = detectTaskFromCommit('feat: add new feature');
  const result2 = detectTaskFromCommit('fix: bug in parser');
  const result3 = detectTaskFromCommit('related to #555 but not closing');
  
  assertEqual(result1, null, 'Should return null for plain commit message');
  assertEqual(result2, null, 'Should return null for commit without issue reference');
  assertEqual(result3, null, 'Should return null for non-closing reference');
});

// Test 8: Detect first match when multiple present
test('detectTaskFromCommit - returns first match when multiple present', () => {
  const result = detectTaskFromCommit('closes #666 and fixes #777');
  assertEqual(result, { issueNumber: 666, keyword: 'closes' }, 'Should return first match');
});

// Test 9: Get recent commits
test('getRecentCommits - retrieves commits since timestamp', () => {
  const testDir = setupTestRepo();
  
  try {
    // Wait a moment to ensure timestamp is before new commits
    const before = new Date().toISOString();
    
    // Small delay to ensure commits are after the timestamp
    const sleep = (ms) => execSync(`sleep ${ms / 1000}`, { stdio: 'ignore' });
    sleep(1100);
    
    // Add some commits
    addCommit(testDir, 'feat: add feature A');
    addCommit(testDir, 'fix: closes #100');
    addCommit(testDir, 'chore: update deps');
    
    const commits = getRecentCommits(before, testDir);
    
    assert(Array.isArray(commits), 'Should return an array');
    assert(commits.length >= 3, `Should have at least 3 commits, got ${commits.length}`);
    assert(commits.some(c => c.message.includes('closes #100')), 'Should include the closes commit');
    
  } finally {
    cleanupTestRepo(testDir);
  }
});

// Test 10: Get recent commits with no commits since timestamp
test('getRecentCommits - returns empty array when no recent commits', () => {
  const testDir = setupTestRepo();
  
  try {
    const future = new Date(Date.now() + 60000).toISOString(); // 1 minute in future
    const commits = getRecentCommits(future, testDir);
    
    assertEqual(commits, [], 'Should return empty array for future timestamp');
    
  } finally {
    cleanupTestRepo(testDir);
  }
});

// Test 11: Find completed tasks
test('findCompletedTasks - finds tasks from commits', () => {
  const testDir = setupTestRepo();
  
  try {
    const before = new Date(Date.now() - 1000).toISOString();
    
    addCommit(testDir, 'feat: add login closes #200');
    addCommit(testDir, 'fix: bug fixes #201');
    addCommit(testDir, 'chore: update docs');
    addCommit(testDir, 'feat: new feature completes #202');
    
    const completedTasks = findCompletedTasks(before, testDir);
    
    assert(Array.isArray(completedTasks), 'Should return an array');
    assert(completedTasks.length === 3, `Should have 3 completed tasks, got ${completedTasks.length}`);
    assert(completedTasks.some(t => t.issueNumber === 200), 'Should find issue #200');
    assert(completedTasks.some(t => t.issueNumber === 201), 'Should find issue #201');
    assert(completedTasks.some(t => t.issueNumber === 202), 'Should find issue #202');
    
  } finally {
    cleanupTestRepo(testDir);
  }
});

// Test 12: Find completed tasks with no matches
test('findCompletedTasks - returns empty array when no matches', () => {
  const testDir = setupTestRepo();
  
  try {
    const before = new Date(Date.now() - 1000).toISOString();
    
    addCommit(testDir, 'feat: add feature');
    addCommit(testDir, 'fix: bug fix');
    
    const completedTasks = findCompletedTasks(before, testDir);
    
    assertEqual(completedTasks, [], 'Should return empty array when no tasks completed');
    
  } finally {
    cleanupTestRepo(testDir);
  }
});

// Test 13: Handle invalid git repository
test('getRecentCommits - handles non-git directory gracefully', () => {
  const testDir = join(tmpdir(), `non-git-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  
  try {
    const commits = getRecentCommits('2026-01-01T00:00:00Z', testDir);
    assertEqual(commits, [], 'Should return empty array for non-git directory');
  } finally {
    cleanupTestRepo(testDir);
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('='.repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
