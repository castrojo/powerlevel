#!/usr/bin/env node

import { log, logInfo, logWarn, logError, logDebug } from '../lib/logger.js';

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

console.log('\n=== Testing logger.js ===\n');

test('log: does nothing when client is null', () => {
  log(null, 'info', 'test message');
});

test('log: does nothing when client is undefined', () => {
  log(undefined, 'info', 'test message');
});

test('log: calls client.app.log with correct shape', () => {
  let captured = null;
  const mockClient = { app: { log: (arg) => { captured = arg; } } };
  log(mockClient, 'info', 'hello world');
  assertEqual(captured, { body: { service: 'powerlevel', level: 'info', message: 'hello world' } });
});

test('logInfo: uses info level', () => {
  let captured = null;
  const mockClient = { app: { log: (arg) => { captured = arg; } } };
  logInfo(mockClient, 'info message');
  assertEqual(captured.body.level, 'info');
  assertEqual(captured.body.message, 'info message');
});

test('logWarn: uses warn level', () => {
  let captured = null;
  const mockClient = { app: { log: (arg) => { captured = arg; } } };
  logWarn(mockClient, 'warn message');
  assertEqual(captured.body.level, 'warn');
});

test('logError: uses error level', () => {
  let captured = null;
  const mockClient = { app: { log: (arg) => { captured = arg; } } };
  logError(mockClient, 'error message');
  assertEqual(captured.body.level, 'error');
});

test('logDebug: uses debug level', () => {
  let captured = null;
  const mockClient = { app: { log: (arg) => { captured = arg; } } };
  logDebug(mockClient, 'debug message');
  assertEqual(captured.body.level, 'debug');
});

test('log: handles client without app gracefully', () => {
  log({}, 'info', 'test');
});

test('log: handles client.app without log gracefully', () => {
  log({ app: {} }, 'info', 'test');
});

console.log('\n=== Test Summary ===\n');
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
if (testsFailed > 0) process.exit(1);
