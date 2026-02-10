#!/usr/bin/env node

/**
 * Test script for epic-updater.js
 * Tests journey entry management, epic syncing, and task completion recording
 */

import { addJourneyEntry, syncEpicToGitHub, recordTaskCompletion } from '../lib/epic-updater.js';
import { loadCache, saveCache, addEpic } from '../lib/cache-manager.js';
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

function assertThrows(fn, message) {
  try {
    fn();
    throw new Error(message || 'Expected function to throw');
  } catch (error) {
    if (error.message === message || error.message.includes('Expected function to throw')) {
      throw error;
    }
    // Expected error, test passes
  }
}

// Setup test environment
function setupTestDir() {
  // Cleanup cache first
  const cacheDir = join(process.cwd(), 'cache');
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
  
  const testDir = join(tmpdir(), `epic-updater-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  mkdirSync(testDir, { recursive: true });
  
  // Initialize as git repo
  execSync('git init', { cwd: testDir, stdio: 'ignore' });
  execSync('git remote add origin git@github.com:test/repo.git', { cwd: testDir, stdio: 'ignore' });
  
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

## Goal

This is a test plan for epic updates.

## Tasks

- [ ] Task 1: First task
- [ ] Task 2: Second task
- [ ] Task 3: Third task
`;
  
  const planFile = join(opencodeDir, 'plans', 'test-plan.md');
  mkdirSync(join(opencodeDir, 'plans'), { recursive: true });
  writeFileSync(planFile, planContent);
  
  return { testDir, planFile };
}

function cleanupTestDir(testDir) {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  
  // Also cleanup cache directory for this test repo
  const cacheDir = join(process.cwd(), 'cache');
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true });
  }
}

// Run tests
console.log('Running epic-updater.js tests...\n');

// Test 1: Validate epic number - positive integer only
test('validateEpicNumber - rejects non-positive integers', () => {
  assertThrows(() => addJourneyEntry(-1, { event: 'test', message: 'test' }, '.'));
  assertThrows(() => addJourneyEntry(0, { event: 'test', message: 'test' }, '.'));
  assertThrows(() => addJourneyEntry(1.5, { event: 'test', message: 'test' }, '.'));
});

// Test 2: Add journey entry with valid data
test('addJourneyEntry - adds entry to cache and marks dirty', () => {
  const { testDir, planFile } = setupTestDir();
  
  try {
    // Create a test epic in cache
    let cache = loadCache('test', 'repo');
    cache = addEpic(cache, {
      number: 123,
      title: 'Test Epic',
      plan_file: planFile,
      state: 'open',
      labels: ['type/epic']
    });
    saveCache('test', 'repo', cache);
    
    // Add journey entry
    addJourneyEntry(123, {
      event: 'epic_created',
      message: '📝 Epic created from implementation plan'
    }, testDir);
    
    // Verify entry added and marked dirty
    cache = loadCache('test', 'repo');
    const epic = cache.epics.find(e => e.number === 123);
    
    assert(epic, 'Epic should exist in cache');
    assert(epic.journey, 'Epic should have journey array');
    assert(epic.journey.length === 1, 'Journey should have one entry');
    assert(epic.journey[0].event === 'epic_created', 'Journey entry should have correct event');
    assert(epic.journey[0].message === '📝 Epic created from implementation plan', 'Journey entry should have correct message');
    assert(epic.dirty === true, 'Epic should be marked dirty');
    
  } finally {
    cleanupTestDir(testDir);
  }
});

// Test 3: Add journey entry with agent info
test('addJourneyEntry - includes agent information', () => {
  const { testDir, planFile } = setupTestDir();
  
  try {
    let cache = loadCache('test', 'repo');
    cache = addEpic(cache, {
      number: 456,
      title: 'Test Epic',
      plan_file: planFile,
      state: 'open'
    });
    saveCache('test', 'repo', cache);
    
    addJourneyEntry(456, {
      event: 'task_complete',
      message: '✅ Task 1 completed',
      agent: 'subagent-abc123',
      metadata: { taskNumber: 1 }
    }, testDir);
    
    cache = loadCache('test', 'repo');
    const epic = cache.epics.find(e => e.number === 456);
    
    assert(epic.journey[0].agent === 'subagent-abc123', 'Journey entry should include agent');
    assert(epic.journey[0].metadata.taskNumber === 1, 'Journey entry should include metadata');
    
  } finally {
    cleanupTestDir(testDir);
  }
});

// Test 4: Record task completion
test('recordTaskCompletion - creates properly formatted journey entry', () => {
  const { testDir, planFile } = setupTestDir();
  
  try {
    let cache = loadCache('test', 'repo');
    cache = addEpic(cache, {
      number: 789,
      title: 'Test Epic',
      plan_file: planFile,
      state: 'open'
    });
    saveCache('test', 'repo', cache);
    
    recordTaskCompletion(789, 2, 'Add remote management', { name: 'agent-1' }, testDir);
    
    cache = loadCache('test', 'repo');
    const epic = cache.epics.find(e => e.number === 789);
    
    assert(epic.journey[0].event === 'task_complete', 'Event should be task_complete');
    assert(epic.journey[0].message === '✅ Task 2 completed: Add remote management', 'Message should be formatted correctly');
    assert(epic.journey[0].agent === 'agent-1', 'Agent should be recorded');
    assert(epic.journey[0].metadata.taskNumber === 2, 'Task number should be in metadata');
    
  } finally {
    cleanupTestDir(testDir);
  }
});

// Test 5: Input sanitization
test('addJourneyEntry - sanitizes control characters', () => {
  const { testDir, planFile } = setupTestDir();
  
  try {
    let cache = loadCache('test', 'repo');
    cache = addEpic(cache, {
      number: 111,
      title: 'Test Epic',
      plan_file: planFile,
      state: 'open'
    });
    saveCache('test', 'repo', cache);
    
    // Try to add entry with control characters
    addJourneyEntry(111, {
      event: 'test\x00event',
      message: 'Test\x01message\x1F'
    }, testDir);
    
    cache = loadCache('test', 'repo');
    const epic = cache.epics.find(e => e.number === 111);
    
    assert(!epic.journey[0].event.includes('\x00'), 'Null bytes should be removed');
    assert(!epic.journey[0].message.includes('\x01'), 'Control characters should be removed');
    
  } finally {
    cleanupTestDir(testDir);
  }
});

// Test 6: Missing epic error handling
test('addJourneyEntry - throws error for missing epic', () => {
  const { testDir } = setupTestDir();
  
  try {
    const cache = loadCache('test', 'repo');
    saveCache('test', 'repo', cache);
    
    assertThrows(() => {
      addJourneyEntry(999, { event: 'test', message: 'test' }, testDir);
    });
    
  } finally {
    cleanupTestDir(testDir);
  }
});

// Test 7: Multiple journey entries sorted correctly
test('addJourneyEntry - maintains chronological order', () => {
  const { testDir, planFile } = setupTestDir();
  
  try {
    let cache = loadCache('test', 'repo');
    cache = addEpic(cache, {
      number: 222,
      title: 'Test Epic',
      plan_file: planFile,
      state: 'open'
    });
    saveCache('test', 'repo', cache);
    
    // Add multiple entries
    addJourneyEntry(222, {
      event: 'epic_created',
      message: 'Entry 1',
      timestamp: '2026-02-09T10:00:00Z'
    }, testDir);
    
    addJourneyEntry(222, {
      event: 'task_started',
      message: 'Entry 2',
      timestamp: '2026-02-09T11:00:00Z'
    }, testDir);
    
    addJourneyEntry(222, {
      event: 'task_complete',
      message: 'Entry 3',
      timestamp: '2026-02-09T12:00:00Z'
    }, testDir);
    
    cache = loadCache('test', 'repo');
    const epic = cache.epics.find(e => e.number === 222);
    
    assert(epic.journey.length === 3, 'Should have three entries');
    assert(epic.journey[0].message === 'Entry 1', 'First entry should be earliest');
    assert(epic.journey[2].message === 'Entry 3', 'Last entry should be latest');
    
  } finally {
    cleanupTestDir(testDir);
  }
});

// Test 8: Validation - requires event and message
test('addJourneyEntry - validates required fields', () => {
  const { testDir } = setupTestDir();
  
  try {
    let cache = loadCache('test', 'repo');
    cache = addEpic(cache, {
      number: 333,
      title: 'Test Epic',
      state: 'open'
    });
    saveCache('test', 'repo', cache);
    
    assertThrows(() => {
      addJourneyEntry(333, { message: 'test' }, testDir); // Missing event
    });
    
    assertThrows(() => {
      addJourneyEntry(333, { event: 'test' }, testDir); // Missing message
    });
    
    assertThrows(() => {
      addJourneyEntry(333, null, testDir); // Null entry
    });
    
  } finally {
    cleanupTestDir(testDir);
  }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('='.repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
