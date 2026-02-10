import { execSync } from 'child_process';
import { createHash } from 'crypto';

/**
 * Detects GitHub repository information from git remote origin
 * @param {string} cwd - Current working directory
 * @returns {{owner: string, repo: string} | null} Repository info or null if not found
 */
export function detectRepo(cwd = process.cwd()) {
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

    console.error(`Unable to parse GitHub URL: ${remoteUrl}`);
    return null;
  } catch (error) {
    if (error.message.includes('not a git repository')) {
      console.error('Not in a git repository');
    } else {
      console.error(`Error detecting repository: ${error.message}`);
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
