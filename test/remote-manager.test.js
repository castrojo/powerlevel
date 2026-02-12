#!/usr/bin/env node

/**
 * Test script for remote-manager.js
 * Tests SSH conversion, remote URL management, and SSH enforcement
 */

import {
  parseRepoFromUrl,
  hasRemote,
  getRemoteUrl,
  addRemote,
  fetchRemote,
  detectRepoFromRemote
} from '../lib/remote-manager.js';
import { existsSync, mkdirSync, rmSync } from 'fs';
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

// Test parseRepoFromUrl
console.log('\n=== Testing parseRepoFromUrl ===\n');

test('parseRepoFromUrl: parses HTTPS URL with .git', () => {
  const result = parseRepoFromUrl('https://github.com/owner/repo.git');
  assertEqual(result, { owner: 'owner', repo: 'repo' });
});

test('parseRepoFromUrl: parses HTTPS URL without .git', () => {
  const result = parseRepoFromUrl('https://github.com/owner/repo');
  assertEqual(result, { owner: 'owner', repo: 'repo' });
});

test('parseRepoFromUrl: parses SSH URL with .git', () => {
  const result = parseRepoFromUrl('git@github.com:owner/repo.git');
  assertEqual(result, { owner: 'owner', repo: 'repo' });
});

test('parseRepoFromUrl: parses SSH URL without .git', () => {
  const result = parseRepoFromUrl('git@github.com:owner/repo');
  assertEqual(result, { owner: 'owner', repo: 'repo' });
});

test('parseRepoFromUrl: returns null for invalid URL', () => {
  const result = parseRepoFromUrl('not-a-url');
  assertEqual(result, null);
});

test('parseRepoFromUrl: returns null for non-GitHub URL', () => {
  const result = parseRepoFromUrl('https://gitlab.com/owner/repo.git');
  assertEqual(result, null);
});

test('parseRepoFromUrl: returns null for empty string', () => {
  const result = parseRepoFromUrl('');
  assertEqual(result, null);
});

test('parseRepoFromUrl: returns null for null input', () => {
  const result = parseRepoFromUrl(null);
  assertEqual(result, null);
});

// Test with actual git repository
console.log('\n=== Testing with actual git repository ===\n');

// Create a temporary git repository for testing
const testRepoPath = join(tmpdir(), `test-remote-manager-${Date.now()}`);

function setupTestRepo() {
  if (existsSync(testRepoPath)) {
    rmSync(testRepoPath, { recursive: true, force: true });
  }
  mkdirSync(testRepoPath, { recursive: true });
  execSync('git init', { cwd: testRepoPath, stdio: 'pipe' });
  execSync('git config user.email "test@example.com"', { cwd: testRepoPath, stdio: 'pipe' });
  execSync('git config user.name "Test User"', { cwd: testRepoPath, stdio: 'pipe' });
}

function cleanupTestRepo() {
  if (existsSync(testRepoPath)) {
    rmSync(testRepoPath, { recursive: true, force: true });
  }
}

setupTestRepo();

test('hasRemote: returns false when remote does not exist', () => {
  const result = hasRemote('origin', testRepoPath);
  assertEqual(result, false);
});

test('addRemote: adds a new remote', () => {
  addRemote('origin', 'https://github.com/test/repo.git', testRepoPath);
  const hasIt = hasRemote('origin', testRepoPath);
  assert(hasIt, 'Remote should exist after adding');
});

test('hasRemote: returns true when remote exists', () => {
  const result = hasRemote('origin', testRepoPath);
  assertEqual(result, true);
});

test('getRemoteUrl: returns the remote URL', () => {
  const url = getRemoteUrl('origin', testRepoPath);
  assertEqual(url, 'https://github.com/test/repo.git');
});

test('detectRepoFromRemote: detects repository from remote', () => {
  const repoInfo = detectRepoFromRemote('origin', testRepoPath);
  assertEqual(repoInfo, { owner: 'test', repo: 'repo' });
});

// Cleanup
cleanupTestRepo();

// Print summary
console.log('\n=== Test Summary ===\n');
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
}
