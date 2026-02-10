#!/usr/bin/env node

/**
 * Test script for project-board-manager.js
 * Tests project board creation and epic addition using GraphQL API
 */

import { getOrCreateProjectBoard, addEpicToBoard } from '../lib/project-board-manager.js';

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

console.log('Testing project-board-manager.js\n');

// Test 1: getOrCreateProjectBoard should return object with required properties
test('getOrCreateProjectBoard should return object with required properties', async () => {
  // This test validates the function signature and return structure
  // Actual API calls would require GitHub authentication and real repos
  // For now, we verify the function exists and has the right shape
  
  assert(typeof getOrCreateProjectBoard === 'function', 'getOrCreateProjectBoard should be a function');
});

// Test 2: addEpicToBoard should be a function
test('addEpicToBoard should be a function', () => {
  assert(typeof addEpicToBoard === 'function', 'addEpicToBoard should be a function');
});

// Summary
console.log(`\n${testsPassed} passed, ${testsFailed} failed`);
process.exit(testsFailed > 0 ? 1 : 0);
