#!/usr/bin/env node

/**
 * Test script for remote-manager.js
 * Tests SSH conversion, remote URL management, and SSH enforcement
 */

import {
  parseRepoFromUrl,
  convertHttpsToSsh,
  hasRemote,
  getRemoteUrl,
  setRemoteUrl,
  addRemote,
  fetchRemote,
  detectRepoFromRemote,
  ensureRemotesUseSSH
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

// Test convertHttpsToSsh
console.log('\n=== Testing convertHttpsToSsh ===\n');

test('convertHttpsToSsh: converts HTTPS URL with .git', () => {
  const result = convertHttpsToSsh('https://github.com/owner/repo.git');
  assertEqual(result, 'git@github.com:owner/repo.git');
});

test('convertHttpsToSsh: converts HTTPS URL without .git', () => {
  const result = convertHttpsToSsh('https://github.com/owner/repo');
  assertEqual(result, 'git@github.com:owner/repo.git');
});

test('convertHttpsToSsh: returns same URL if already SSH', () => {
  const sshUrl = 'git@github.com:owner/repo.git';
  const result = convertHttpsToSsh(sshUrl);
  assertEqual(result, sshUrl);
});

test('convertHttpsToSsh: returns null for non-GitHub URL', () => {
  const result = convertHttpsToSsh('https://gitlab.com/owner/repo.git');
  assertEqual(result, null);
});

test('convertHttpsToSsh: returns null for invalid URL', () => {
  const result = convertHttpsToSsh('not-a-url');
  assertEqual(result, null);
});

test('convertHttpsToSsh: returns null for empty string', () => {
  const result = convertHttpsToSsh('');
  assertEqual(result, null);
});

test('convertHttpsToSsh: returns null for null input', () => {
  const result = convertHttpsToSsh(null);
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

test('setRemoteUrl: changes the remote URL', () => {
  setRemoteUrl('origin', 'git@github.com:test/repo.git', testRepoPath);
  const url = getRemoteUrl('origin', testRepoPath);
  assertEqual(url, 'git@github.com:test/repo.git');
});

test('detectRepoFromRemote: detects repository from remote', () => {
  const repoInfo = detectRepoFromRemote('origin', testRepoPath);
  assertEqual(repoInfo, { owner: 'test', repo: 'repo' });
});

test('ensureRemotesUseSSH: converts HTTPS remotes to SSH', () => {
  // Add another HTTPS remote
  addRemote('upstream', 'https://github.com/upstream/repo.git', testRepoPath);
  
  // Ensure remotes use SSH
  const conversions = ensureRemotesUseSSH(testRepoPath);
  
  // Should convert the upstream remote (origin is already SSH)
  assert(conversions.length === 1, 'Should convert one remote');
  assertEqual(conversions[0].remote, 'upstream');
  assertEqual(conversions[0].oldUrl, 'https://github.com/upstream/repo.git');
  assertEqual(conversions[0].newUrl, 'git@github.com:upstream/repo.git');
  
  // Verify the remote was actually changed
  const upstreamUrl = getRemoteUrl('upstream', testRepoPath);
  assertEqual(upstreamUrl, 'git@github.com:upstream/repo.git');
});

test('ensureRemotesUseSSH: does not convert SSH remotes', () => {
  // All remotes should now be SSH
  const conversions = ensureRemotesUseSSH(testRepoPath);
  assertEqual(conversions.length, 0, 'Should not convert any remotes');
});

test('ensureRemotesUseSSH: handles multiple HTTPS remotes', () => {
  // Add two more HTTPS remotes
  addRemote('fork', 'https://github.com/fork/repo.git', testRepoPath);
  addRemote('mirror', 'https://github.com/mirror/repo.git', testRepoPath);
  
  const conversions = ensureRemotesUseSSH(testRepoPath);
  
  assert(conversions.length === 2, 'Should convert two remotes');
  
  // Verify both were converted
  const forkUrl = getRemoteUrl('fork', testRepoPath);
  const mirrorUrl = getRemoteUrl('mirror', testRepoPath);
  assertEqual(forkUrl, 'git@github.com:fork/repo.git');
  assertEqual(mirrorUrl, 'git@github.com:mirror/repo.git');
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
