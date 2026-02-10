#!/usr/bin/env node

/**
 * Test script for epic-detector.js
 * Tests epic detection from plan files and branch names
 */

import { 
  detectEpicFromPlan, 
  detectEpicFromBranch, 
  detectEpicContext,
  formatEpicDisplay,
  getEpicUrl
} from '../lib/epic-detector.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Test detectEpicFromPlan
console.log('\n=== Testing detectEpicFromPlan ===\n');

test('should detect epic number from plan file', () => {
  const testDir = join(tmpdir(), 'test-epic-plan-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-10-test-feature.md'), `# Test Feature Implementation Plan

**Epic Issue:** #42

Some content here.
`);
  
  const epicNumber = detectEpicFromPlan(testDir);
  assertEqual(epicNumber, 42, 'Should extract epic number 42');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should return null when no plans directory exists', () => {
  const testDir = join(tmpdir(), 'test-no-plans-' + Date.now());
  mkdirSync(testDir, { recursive: true });
  
  const epicNumber = detectEpicFromPlan(testDir);
  assertEqual(epicNumber, null, 'Should return null when no plans directory');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should return null when plan has no epic reference', () => {
  const testDir = join(tmpdir(), 'test-no-epic-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-10-test-feature.md'), `# Test Feature Implementation Plan

**Date:** February 10, 2026

Some content here.
`);
  
  const epicNumber = detectEpicFromPlan(testDir);
  assertEqual(epicNumber, null, 'Should return null when no epic reference');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should use most recent plan file', () => {
  const testDir = join(tmpdir(), 'test-multiple-plans-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-09-old-feature.md'), `# Old Feature
**Epic Issue:** #10
`);
  
  writeFileSync(join(plansDir, '2026-02-10-new-feature.md'), `# New Feature
**Epic Issue:** #42
`);
  
  const epicNumber = detectEpicFromPlan(testDir);
  assertEqual(epicNumber, 42, 'Should use most recent plan file (42, not 10)');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

// Test detectEpicContext
console.log('\n=== Testing detectEpicContext ===\n');

test('should extract full epic context', () => {
  const testDir = join(tmpdir(), 'test-epic-context-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-10-test-feature.md'), `# Test Feature Implementation Plan

**Epic Issue:** #42

Some content here.
`);
  
  const context = detectEpicContext(testDir);
  assert(context !== null, 'Context should not be null');
  assertEqual(context.epicNumber, 42, 'Epic number should be 42');
  assertEqual(context.epicTitle, 'Test Feature', 'Epic title should be extracted');
  assertEqual(context.planFile, 'docs/plans/2026-02-10-test-feature.md', 'Plan file path should be set');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should strip "Implementation Plan" from title', () => {
  const testDir = join(tmpdir(), 'test-epic-title-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-10-feature.md'), `# My Feature Implementation Plan

**Epic Issue:** #99
`);
  
  const context = detectEpicContext(testDir);
  assertEqual(context.epicTitle, 'My Feature', 'Should strip "Implementation Plan" suffix');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

// Test formatEpicDisplay
console.log('\n=== Testing formatEpicDisplay ===\n');

test('should format epic display string', () => {
  const context = {
    epicNumber: 42,
    epicTitle: 'Test Feature',
    planFile: 'docs/plans/2026-02-10-test-feature.md',
    repo: 'owner/repo'
  };
  
  const display = formatEpicDisplay(context);
  assertEqual(display, 'Epic #42: Test Feature', 'Should format display string correctly');
});

test('should return null for null context', () => {
  const display = formatEpicDisplay(null);
  assertEqual(display, null, 'Should return null for null context');
});

// Test getEpicUrl
console.log('\n=== Testing getEpicUrl ===\n');

test('should generate GitHub URL', () => {
  const context = {
    epicNumber: 42,
    epicTitle: 'Test Feature',
    planFile: 'docs/plans/2026-02-10-test-feature.md',
    repo: 'owner/repo'
  };
  
  const url = getEpicUrl(context);
  assertEqual(url, 'https://github.com/owner/repo/issues/42', 'Should generate correct GitHub URL');
});

test('should return null when repo is missing', () => {
  const context = {
    epicNumber: 42,
    epicTitle: 'Test Feature',
    planFile: 'docs/plans/2026-02-10-test-feature.md',
    repo: null
  };
  
  const url = getEpicUrl(context);
  assertEqual(url, null, 'Should return null when repo is missing');
});

// Test detectEpicFromBranch
console.log('\n=== Testing detectEpicFromBranch ===\n');

test('should detect epic from branch name epic-123', () => {
  // Note: This test would require a real git repo with a branch
  // For now, we'll just verify the function exists and returns null for non-git dirs
  const testDir = join(tmpdir(), 'test-not-git-' + Date.now());
  mkdirSync(testDir, { recursive: true });
  
  const epicNumber = detectEpicFromBranch(testDir);
  assertEqual(epicNumber, null, 'Should return null for non-git directory');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

// Summary
console.log('\n=== Test Summary ===\n');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!');
  process.exit(0);
}
