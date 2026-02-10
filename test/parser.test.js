#!/usr/bin/env node

/**
 * Test script for parser.js
 * Tests plan file parsing and message parsing
 */

import { extractPlanFromMessage } from '../lib/parser.js';

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

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('Testing parser.js\n');

// Test 1: Extract plan file from message
test('should extract plan file path from message', () => {
  const message = "I'm working on docs/plans/2026-02-10-feature.md";
  const result = extractPlanFromMessage(message);
  
  assertEqual(result, 'docs/plans/2026-02-10-feature.md', 'Should extract plan file path');
});

// Test 2: Extract plan file from longer message
test('should extract plan file from longer message', () => {
  const message = "Let me implement the plan in docs/plans/2026-02-10-superpowers-integration.md using TDD.";
  const result = extractPlanFromMessage(message);
  
  assertEqual(result, 'docs/plans/2026-02-10-superpowers-integration.md', 'Should extract plan file path');
});

// Test 3: Return null when no plan file in message
test('should return null when no plan file in message', () => {
  const message = "Just writing some code here.";
  const result = extractPlanFromMessage(message);
  
  assertEqual(result, null, 'Should return null when no plan file found');
});

// Test 4: Extract plan with underscores and hyphens
test('should extract plan file with underscores and hyphens', () => {
  const message = "Working on docs/plans/2026-02-10-my_feature-name.md";
  const result = extractPlanFromMessage(message);
  
  assertEqual(result, 'docs/plans/2026-02-10-my_feature-name.md', 'Should extract plan with underscores');
});

// Test 5: Extract first plan file if multiple present
test('should extract first plan file if multiple present', () => {
  const message = "Moving from docs/plans/2026-02-10-old.md to docs/plans/2026-02-10-new.md";
  const result = extractPlanFromMessage(message);
  
  assertEqual(result, 'docs/plans/2026-02-10-old.md', 'Should extract first plan file');
});

// Test 6: Return null for partial plan path
test('should return null for partial plan path', () => {
  const message = "Check the plans directory";
  const result = extractPlanFromMessage(message);
  
  assertEqual(result, null, 'Should return null for partial path');
});

// Test 7: Extract plan with numbers only
test('should extract plan with numbers in filename', () => {
  const message = "See docs/plans/2026-02-10-123.md for details";
  const result = extractPlanFromMessage(message);
  
  assertEqual(result, 'docs/plans/2026-02-10-123.md', 'Should extract plan with numbers');
});

// Summary
console.log(`\n${testsPassed} passed, ${testsFailed} failed`);
process.exit(testsFailed > 0 ? 1 : 0);
