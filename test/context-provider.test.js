#!/usr/bin/env node

/**
 * Test script for context-provider.js
 * Tests caching and context API
 */

import { ContextProvider } from '../lib/context-provider.js';
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

// Test ContextProvider
console.log('\n=== Testing ContextProvider ===\n');

test('should cache context for performance', () => {
  const provider = new ContextProvider();
  const testDir = join(tmpdir(), 'test-cache-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-10-test.md'), `# Test
**Epic Issue:** #42
`);
  
  const context1 = provider.getContext(testDir);
  const context2 = provider.getContext(testDir);
  
  assert(context1 === context2, 'Should return same object reference (cached)');
  assertEqual(context1.epicNumber, 42, 'Context should have correct epic number');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should invalidate cache when requested', () => {
  const provider = new ContextProvider();
  const testDir = join(tmpdir(), 'test-invalidate-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-10-test.md'), `# Test
**Epic Issue:** #42
`);
  
  const context1 = provider.getContext(testDir);
  provider.invalidateCache(testDir);
  const context2 = provider.getContext(testDir);
  
  assert(context1 !== context2, 'Should return different object reference after invalidation');
  
  // But they should have the same data
  assertEqual(context1.epicNumber, context2.epicNumber, 'Epic number should be the same');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should clear all cache', () => {
  const provider = new ContextProvider();
  const testDir1 = join(tmpdir(), 'test-clear-1-' + Date.now());
  const testDir2 = join(tmpdir(), 'test-clear-2-' + Date.now());
  
  const plansDir1 = join(testDir1, 'docs', 'plans');
  const plansDir2 = join(testDir2, 'docs', 'plans');
  mkdirSync(plansDir1, { recursive: true });
  mkdirSync(plansDir2, { recursive: true });
  
  writeFileSync(join(plansDir1, '2026-02-10-test.md'), `# Test
**Epic Issue:** #42
`);
  
  writeFileSync(join(plansDir2, '2026-02-10-test.md'), `# Test
**Epic Issue:** #99
`);
  
  const context1a = provider.getContext(testDir1);
  const context2a = provider.getContext(testDir2);
  
  provider.clearCache();
  
  const context1b = provider.getContext(testDir1);
  const context2b = provider.getContext(testDir2);
  
  assert(context1a !== context1b, 'Dir 1 should have new object after clear');
  assert(context2a !== context2b, 'Dir 2 should have new object after clear');
  
  // Cleanup
  rmSync(testDir1, { recursive: true });
  rmSync(testDir2, { recursive: true });
});

test('should get display string', () => {
  const provider = new ContextProvider();
  const testDir = join(tmpdir(), 'test-display-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-10-awesome-feature.md'), `# Awesome Feature Implementation Plan
**Epic Issue:** #42
`);
  
  const display = provider.getDisplayString(testDir);
  assertEqual(display, 'Epic #42: Awesome Feature', 'Should format display string correctly');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should return null display string when no epic', () => {
  const provider = new ContextProvider();
  const testDir = join(tmpdir(), 'test-no-epic-' + Date.now());
  mkdirSync(testDir, { recursive: true });
  
  const display = provider.getDisplayString(testDir);
  assertEqual(display, null, 'Should return null when no epic found');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should get epic URL', () => {
  const provider = new ContextProvider();
  const testDir = join(tmpdir(), 'test-url-' + Date.now());
  const plansDir = join(testDir, 'docs', 'plans');
  mkdirSync(plansDir, { recursive: true });
  
  writeFileSync(join(plansDir, '2026-02-10-test.md'), `# Test
**Epic Issue:** #42
`);
  
  const url = provider.getEpicUrl(testDir);
  // URL will be null because we're not in a git repo
  // The function should still work without crashing
  assert(url === null || url.includes('github.com'), 'Should return null or valid URL');
  
  // Cleanup
  rmSync(testDir, { recursive: true });
});

test('should handle cache miss gracefully', () => {
  const provider = new ContextProvider();
  const testDir = join(tmpdir(), 'test-miss-' + Date.now());
  mkdirSync(testDir, { recursive: true });
  
  // No plans directory, should return null
  const context = provider.getContext(testDir);
  assertEqual(context, null, 'Should return null for directory without plans');
  
  // Should cache the null result
  const context2 = provider.getContext(testDir);
  assert(context === context2, 'Should cache null results');
  
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
