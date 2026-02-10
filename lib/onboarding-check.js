import { existsSync } from 'fs';
import { join } from 'path';
import { hasRemote } from './remote-manager.js';
import { loadConfig } from './config-loader.js';

/**
 * Checks if a project is properly onboarded with superpowers integration
 * @param {string} cwd - Current working directory (repository path)
 * @returns {boolean} True if project is fully onboarded, false otherwise
 */
export function isProjectOnboarded(cwd) {
  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd must be a non-empty string');
  }

  try {
    // Check 1: Superpowers remote exists
    if (!hasRemote('superpowers', cwd)) {
      return false;
    }

    // Check 2: Config file exists
    const configPath = join(cwd, '.opencode', 'config.json');
    if (!existsSync(configPath)) {
      return false;
    }

    // Check 3: Superpowers enabled in config
    const config = loadConfig(cwd);
    if (!config.superpowers?.enabled) {
      return false;
    }

    return true;
  } catch (error) {
    // If any check fails, consider project not onboarded
    console.debug(`Onboarding check failed: ${error.message}`);
    return false;
  }
}

/**
 * Gets detailed onboarding status with list of missing items
 * @param {string} cwd - Current working directory (repository path)
 * @returns {{onboarded: boolean, issues: string[]}} Status object with issues list
 */
export function getOnboardingStatus(cwd) {
  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd must be a non-empty string');
  }

  const issues = [];

  try {
    // Check 1: Superpowers remote exists
    if (!hasRemote('superpowers', cwd)) {
      issues.push('Missing superpowers git remote');
    }

    // Check 2: Config file exists
    const configPath = join(cwd, '.opencode', 'config.json');
    if (!existsSync(configPath)) {
      issues.push('No configuration file found at .opencode/config.json');
    } else {
      // Config exists, check its contents
      try {
        const config = loadConfig(cwd);
        
        // Check 3: Superpowers enabled
        if (!config.superpowers?.enabled) {
          issues.push('Superpowers not enabled in config');
        }
        
        // Check 4: Repo URL configured
        if (!config.superpowers?.repoUrl) {
          issues.push('Missing superpowers repository URL in config');
        }
      } catch (error) {
        issues.push(`Invalid configuration file: ${error.message}`);
      }
    }
  } catch (error) {
    // Top-level error checking status
    issues.push(`Failed to check onboarding status: ${error.message}`);
  }

  return {
    onboarded: issues.length === 0,
    issues
  };
}

/**
 * Displays helpful onboarding prompt to user
 * Should only be called once per session to avoid spam
 * @param {Object} session - OpenCode session object (optional, for future session-aware features)
 */
export function promptOnboarding(session) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 Superpowers Integration Not Detected');
  console.log('='.repeat(60));
  console.log('\nThis project is not yet onboarded to use Superpowers.');
  console.log('\nSuperpowers provides:');
  console.log('  • Shared skills and patterns across projects');
  console.log('  • Automated epic tracking and updates');
  console.log('  • Wiki-based context discovery for AI agents');
  console.log('\nTo get started, run:');
  console.log('\n  node bin/onboard-project.js');
  console.log('\n' + '='.repeat(60) + '\n');
}
