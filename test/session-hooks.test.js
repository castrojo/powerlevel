#!/usr/bin/env node

/**
 * Test script for session-hooks.js
 * Tests skill detection and session event handling
 */

import { detectSkillInvocation, registerSessionHooks } from '../lib/session-hooks.js';

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

console.log('Testing session-hooks.js\n');

// Test 1: Detect executing-plans skill invocation
test('should detect executing-plans skill invocation', () => {
  const message = "I'm using the executing-plans skill to implement this plan.";
  const result = detectSkillInvocation(message);
  
  assertEqual(result, {
    skill: 'executing-plans',
    detected: true
  }, 'Should detect executing-plans skill');
});

// Test 2: Detect finishing-a-development-branch skill invocation
test('should detect finishing-a-development-branch skill invocation', () => {
  const message = "I'm using the finishing-a-development-branch skill to complete this work.";
  const result = detectSkillInvocation(message);
  
  assertEqual(result, {
    skill: 'finishing-a-development-branch',
    detected: true
  }, 'Should detect finishing-a-development-branch skill');
});

// Test 3: Detect subagent-driven-development skill invocation
test('should detect subagent-driven-development skill invocation', () => {
  const message = "I'm using the subagent-driven-development skill for parallel tasks.";
  const result = detectSkillInvocation(message);
  
  assertEqual(result, {
    skill: 'subagent-driven-development',
    detected: true
  }, 'Should detect subagent-driven-development skill');
});

// Test 4: Detect writing-plans skill invocation
test('should detect writing-plans skill invocation', () => {
  const message = "I'm using the writing-plans skill to create this implementation plan.";
  const result = detectSkillInvocation(message);
  
  assertEqual(result, {
    skill: 'writing-plans',
    detected: true
  }, 'Should detect writing-plans skill');
});

// Test 5: Return null for non-skill messages
test('should return null for non-skill messages', () => {
  const message = "Just writing some code here";
  const result = detectSkillInvocation(message);
  
  assertEqual(result, null, 'Should return null for non-skill messages');
});

// Test 6: Skill detection is case-insensitive
test('should detect skills case-insensitively', () => {
  const message = "I'm USING THE EXECUTING-PLANS SKILL to implement.";
  const result = detectSkillInvocation(message);
  
  assertEqual(result, {
    skill: 'executing-plans',
    detected: true
  }, 'Should detect skill case-insensitively');
});

// Test 7: Detect skill in middle of longer message
test('should detect skill in middle of message', () => {
  const message = "First I'll check the requirements, then I'm using the finishing-a-development-branch skill to wrap up, and finally push.";
  const result = detectSkillInvocation(message);
  
  assertEqual(result, {
    skill: 'finishing-a-development-branch',
    detected: true
  }, 'Should detect skill in middle of message');
});

// Test 8: registerSessionHooks handles missing session gracefully
test('should handle missing session gracefully', () => {
  // Should not throw
  registerSessionHooks(null, 'owner', 'repo', '/tmp');
  assert(true, 'Should not throw with null session');
});

// Test 9: registerSessionHooks handles session without .on method
test('should handle session without event support', () => {
  const sessionWithoutEvents = { id: 'test' };
  // Should not throw
  registerSessionHooks(sessionWithoutEvents, 'owner', 'repo', '/tmp');
  assert(true, 'Should not throw with session lacking .on method');
});

// Test 10: registerSessionHooks registers with valid session
test('should register hooks with valid session', () => {
  let messageHandlerRegistered = false;
  let fileHandlerRegistered = false;
  
  const mockSession = {
    on: (event, handler) => {
      if (event === 'assistant.message') {
        messageHandlerRegistered = true;
      }
      if (event === 'file.created') {
        fileHandlerRegistered = true;
      }
    }
  };
  
  registerSessionHooks(mockSession, 'owner', 'repo', '/tmp');
  
  assert(messageHandlerRegistered, 'Should register assistant.message handler');
  assert(fileHandlerRegistered, 'Should register file.created handler');
});

// Summary
console.log(`\n${testsPassed} passed, ${testsFailed} failed`);
process.exit(testsFailed > 0 ? 1 : 0);
