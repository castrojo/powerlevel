import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { detectRepoFromRemote as detectFromRemote } from './remote-manager.js';

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

    // Parse HTTPS URL: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        repo: httpsMatch[2]
      };
    }

    // Parse SSH URL: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(/git@github\.com:([^\/]+)\/([^\/]+?)(\.git)?$/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        repo: sshMatch[2]
      };
    }

    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'error',
          message: `Unable to parse GitHub URL: ${remoteUrl}`
        }
      });
    }
    return null;
  } catch (error) {
    if (error.message.includes('not a git repository')) {
      if (client) {
        client.app.log({
          body: {
            service: 'powerlevel',
            level: 'error',
            message: 'Not in a git repository'
          }
        });
      }
    } else {
      if (client) {
        client.app.log({
          body: {
            service: 'powerlevel',
            level: 'error',
            message: `Error detecting repository: ${error.message}`
          }
        });
      }
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
