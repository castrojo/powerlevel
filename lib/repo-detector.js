import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { detectRepoFromRemote as detectFromRemote, parseRepoFromUrl } from './remote-manager.js';
import { logError } from './logger.js';

/**
 * Detects GitHub repository information from git remote origin
 * @param {string} cwd - Current working directory
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {{owner: string, repo: string} | null} Repository info or null if not found
 */
export function detectRepo(cwd = process.cwd(), client = null) {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    const parsed = parseRepoFromUrl(remoteUrl);
    if (parsed) {
      return parsed;
    }

    logError(client, `Unable to parse GitHub URL: ${remoteUrl}`);
    return null;
  } catch (error) {
    if (error.message.includes('not a git repository')) {
      logError(client, 'Not in a git repository');
    } else {
      logError(client, `Error detecting repository: ${error.message}`);
    }
    return null;
  }
}

/**
 * Generates a hash for cache directory naming
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {string} Hash of owner/repo
 */
export function getRepoHash(owner, repo) {
  const repoPath = `${owner}/${repo}`;
  return createHash('sha256').update(repoPath).digest('hex').substring(0, 16);
}

/**
 * Detects GitHub repository information from a specific git remote
 * This is a convenience wrapper around remote-manager's detectRepoFromRemote
 * @param {string} remoteName - Name of the remote to check (e.g., 'origin', 'upstream', 'superpowers')
 * @param {string} cwd - Current working directory (defaults to process.cwd())
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {{owner: string, repo: string} | null} Repository info or null if not found
 */
export function detectRepoFromRemote(remoteName, cwd = process.cwd(), client = null) {
  return detectFromRemote(remoteName, cwd, client);
}
