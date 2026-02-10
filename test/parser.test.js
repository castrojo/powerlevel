#!/usr/bin/env node

/**
 * Test script for parser.js
 * Tests plan file parsing and message parsing
 */

import { extractPlanFromMessage, insertEpicReference } from '../lib/parser.js';

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

// Test 8: Insert epic reference at top of plan file
test('should insert epic reference at top of plan file', () => {
  const planContent = `# Feature Name Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build something cool

## Task 1: First Task`;

  const result = insertEpicReference(planContent, 123, [124, 125]);
  
  // Check that epic reference is present
  if (!result.includes('> **Epic Issue:** #123')) {
    throw new Error('Epic reference should include epic issue number');
  }
  if (!result.includes('> **Sub-Tasks:** #124, #125')) {
    throw new Error('Epic reference should include sub-task numbers');
  }
  
  // Check that it's inserted after title but before Claude instruction
  const lines = result.split('\n');
  const epicLineIndex = lines.findIndex(l => l.includes('Epic Issue:'));
  const claudeLineIndex = lines.findIndex(l => l.includes('For Claude:'));
  
  if (epicLineIndex <= 0) {
    throw new Error('Epic reference should be after title (index > 0)');
  }
  if (epicLineIndex >= claudeLineIndex) {
    throw new Error('Epic reference should be before Claude instruction');
  }
});

// Test 9: Insert epic reference without sub-tasks
test('should insert epic reference without sub-tasks', () => {
  const planContent = `# Simple Plan

Some content here.`;

  const result = insertEpicReference(planContent, 456);
  
  if (!result.includes('> **Epic Issue:** #456')) {
    throw new Error('Epic reference should include epic issue number');
  }
  if (result.includes('Sub-Tasks:')) {
    throw new Error('Epic reference should not include sub-tasks line when empty');
  }
});

// Summary
console.log(`\n${testsPassed} passed, ${testsFailed} failed`);
process.exit(testsFailed > 0 ? 1 : 0);
