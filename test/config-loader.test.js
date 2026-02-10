#!/usr/bin/env node

/**
 * Test script for config-loader.js
 * Tests config loading, merging, and validation
 */

import { loadConfig, mergeConfig, validateConfig } from '../lib/config-loader.js';
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

// Setup test directory
const testDir = join(tmpdir(), `config-loader-test-${Date.now()}`);
mkdirSync(testDir, { recursive: true });
mkdirSync(join(testDir, '.opencode'), { recursive: true });

console.log('Testing config-loader.js\n');

// Test 1: loadConfig without config file returns defaults
test('loadConfig without config file returns defaults', () => {
  const config = loadConfig(testDir);
  assert(config.superpowers.enabled === false, 'superpowers.enabled should be false');
  assert(config.superpowers.remote === 'origin', 'superpowers.remote should be origin');
  assert(config.wiki.autoSync === false, 'wiki.autoSync should be false');
  assert(config.tracking.autoUpdateEpics === true, 'tracking.autoUpdateEpics should be true');
});

// Test 2: loadConfig with valid config file merges correctly
test('loadConfig with valid config file merges correctly', () => {
  const userConfig = {
    superpowers: {
      enabled: true,
      repoUrl: 'https://github.com/user/repo.git'
    }
  };
  writeFileSync(join(testDir, '.opencode', 'config.json'), JSON.stringify(userConfig));
  
  const config = loadConfig(testDir);
  assert(config.superpowers.enabled === true, 'superpowers.enabled should be true');
  assert(config.superpowers.repoUrl === 'https://github.com/user/repo.git', 'repoUrl should be set');
  assert(config.superpowers.remote === 'origin', 'superpowers.remote should still be origin (default)');
  assert(config.wiki.autoSync === false, 'wiki.autoSync should be false (default)');
});

// Test 3: mergeConfig deep merges correctly
test('mergeConfig deep merges correctly', () => {
  const target = {
    a: { b: 1, c: 2 },
    d: 3
  };
  const source = {
    a: { b: 10 },
    e: 4
  };
  const result = mergeConfig(target, source);
  
  assertEqual(result.a.b, 10, 'a.b should be 10 (overridden)');
  assertEqual(result.a.c, 2, 'a.c should be 2 (preserved)');
  assertEqual(result.d, 3, 'd should be 3 (preserved)');
  assertEqual(result.e, 4, 'e should be 4 (added)');
});

// Test 4: validateConfig accepts valid config
test('validateConfig accepts valid config', () => {
  const validConfig = {
    superpowers: {
      enabled: true,
      repoUrl: 'git@github.com:user/repo.git',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    },
    wiki: {
      autoSync: true,
      syncOnCommit: false,
      includeSkills: true,
      includeDocs: false
    },
    tracking: {
      autoUpdateEpics: false,
      updateOnTaskComplete: true,
      commentOnProgress: true
    }
  };
  
  validateConfig(validConfig); // Should not throw
});

// Test 5: validateConfig rejects config with enabled=true but no repoUrl
test('validateConfig rejects enabled=true without repoUrl', () => {
  const invalidConfig = {
    superpowers: {
      enabled: true,
      repoUrl: '',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  
  assertThrows(() => validateConfig(invalidConfig), 'Should throw when enabled but no repoUrl');
});

// Test 6: validateConfig rejects invalid git URLs
test('validateConfig rejects invalid git URLs', () => {
  const invalidConfig = {
    superpowers: {
      enabled: true,
      repoUrl: 'not-a-valid-url',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  
  assertThrows(() => validateConfig(invalidConfig), 'Should throw for invalid git URL');
});

// Test 7: validateConfig accepts HTTPS git URLs
test('validateConfig accepts HTTPS git URLs', () => {
  const config = {
    superpowers: {
      enabled: true,
      repoUrl: 'https://github.com/owner/repo.git',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  
  validateConfig(config); // Should not throw
});

// Test 8: validateConfig accepts SSH git URLs
test('validateConfig accepts SSH git URLs', () => {
  const config = {
    superpowers: {
      enabled: true,
      repoUrl: 'git@github.com:owner/repo.git',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  
  validateConfig(config); // Should not throw
});

// Test 9: validateConfig accepts URLs without .git suffix
test('validateConfig accepts URLs without .git suffix', () => {
  const config1 = {
    superpowers: {
      enabled: true,
      repoUrl: 'https://github.com/owner/repo',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  validateConfig(config1); // Should not throw
  
  const config2 = {
    superpowers: {
      enabled: true,
      repoUrl: 'git@github.com:owner/repo',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  validateConfig(config2); // Should not throw
});

// Test 10: validateConfig rejects non-boolean values
test('validateConfig rejects non-boolean values', () => {
  const invalidConfig = {
    superpowers: {
      enabled: 'yes', // Should be boolean
      repoUrl: 'https://github.com/owner/repo.git',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  
  assertThrows(() => validateConfig(invalidConfig), 'Should throw for non-boolean enabled');
});

// Test 11: loadConfig rejects invalid JSON
test('loadConfig rejects invalid JSON', () => {
  writeFileSync(join(testDir, '.opencode', 'config.json'), '{ invalid json }');
  
  assertThrows(() => loadConfig(testDir), 'Should throw for invalid JSON');
});

// Test 12: loadConfig validates after merging
test('loadConfig validates after merging', () => {
  const invalidUserConfig = {
    superpowers: {
      enabled: true
      // Missing repoUrl - should fail validation
    }
  };
  writeFileSync(join(testDir, '.opencode', 'config.json'), JSON.stringify(invalidUserConfig));
  
  assertThrows(() => loadConfig(testDir), 'Should throw after validation');
});

// Test 13: mergeConfig handles array input correctly
test('mergeConfig handles array input correctly', () => {
  const target = { a: 1, b: 2 };
  const source = [1, 2, 3]; // Array instead of object
  
  const result = mergeConfig(target, source);
  assertEqual(result, target, 'Should return target unchanged when source is array');
});

// Test 14: validateConfig accepts self-hosted git URLs (GitLab)
test('validateConfig accepts self-hosted git URLs (GitLab)', () => {
  const config = {
    superpowers: {
      enabled: true,
      repoUrl: 'https://gitlab.example.com/user/repo.git',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  
  validateConfig(config); // Should not throw
});

// Test 15: validateConfig accepts self-hosted SSH URLs
test('validateConfig accepts self-hosted SSH URLs', () => {
  const config = {
    superpowers: {
      enabled: true,
      repoUrl: 'git@gitlab.example.com:team/project.git',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  
  validateConfig(config); // Should not throw
});

// Test 16: validateConfig accepts URLs with nested paths
test('validateConfig accepts URLs with nested paths', () => {
  const config1 = {
    superpowers: {
      enabled: true,
      repoUrl: 'https://gitlab.example.com/team/subgroup/repo.git',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  validateConfig(config1); // Should not throw
  
  const config2 = {
    superpowers: {
      enabled: true,
      repoUrl: 'git@gitlab.example.com:team/subgroup/project.git',
      remote: 'origin',
      autoOnboard: false,
      wikiSync: true
    }
  };
  validateConfig(config2); // Should not throw
});

// Cleanup
rmSync(testDir, { recursive: true, force: true });

// Summary
console.log(`\n${testsPassed} passed, ${testsFailed} failed`);
process.exit(testsFailed > 0 ? 1 : 0);
