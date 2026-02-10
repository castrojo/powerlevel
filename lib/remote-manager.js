import { execFileSync } from 'child_process';

/**
 * Parses a GitHub repository URL and extracts owner/repo
 * Supports both HTTPS and SSH formats
 * @param {string} url - Git URL to parse
 * @returns {{owner: string, repo: string} | null} Repository info or null if parsing fails
 */
export function parseRepoFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Parse HTTPS URL: https://github.com/owner/repo.git
  const httpsMatch = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/]+?)(\.git)?$/);
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2]
    };
  }

  // Parse SSH URL: git@github.com:owner/repo.git
  const sshMatch = url.match(/git@github\.com:([^\/]+)\/([^\/]+?)(\.git)?$/);
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2]
    };
  }

  return null;
}

/**
 * Checks if a git remote exists in the repository
 * @param {string} remoteName - Name of the remote to check (e.g., 'origin', 'upstream')
 * @param {string} cwd - Current working directory (repository path)
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {boolean} True if remote exists, false otherwise
 */
export function hasRemote(remoteName, cwd, client = null) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new Error('remoteName must be a non-empty string');
  }

  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd must be a non-empty string');
  }

  // Validate remote name doesn't contain whitespace or special chars that could cause issues
  if (/\s/.test(remoteName)) {
    throw new Error('remoteName cannot contain whitespace');
  }

  try {
    const remotes = execFileSync('git', ['remote'], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return remotes.split('\n').map(r => r.trim()).includes(remoteName);
  } catch (error) {
    // If git command fails (e.g., not a git repo), return false
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'debug',
          message: `Failed to check remote '${remoteName}': ${error.message}`
        }
      });
    }
    return false;
  }
}

/**
 * Gets the URL of a git remote
 * @param {string} remoteName - Name of the remote
 * @param {string} cwd - Current working directory (repository path)
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {string | null} Remote URL or null if remote doesn't exist
 */
export function getRemoteUrl(remoteName, cwd, client = null) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new Error('remoteName must be a non-empty string');
  }

  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd must be a non-empty string');
  }

  // Validate remote name
  if (/\s/.test(remoteName)) {
    throw new Error('remoteName cannot contain whitespace');
  }

  try {
    const url = execFileSync('git', ['config', '--get', `remote.${remoteName}.url`], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    return url || null;
  } catch (error) {
    // Remote doesn't exist or git command failed
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'debug',
          message: `Failed to get URL for remote '${remoteName}': ${error.message}`
        }
      });
    }
    return null;
  }
}

/**
 * Adds a new git remote to the repository
 * @param {string} remoteName - Name for the new remote
 * @param {string} url - URL of the remote repository
 * @param {string} cwd - Current working directory (repository path)
 * @param {Object} client - OpenCode SDK client (optional)
 * @throws {Error} If remote already exists or git command fails
 */
export function addRemote(remoteName, url, cwd, client = null) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new Error('remoteName must be a non-empty string');
  }

  if (!url || typeof url !== 'string') {
    throw new Error('url must be a non-empty string');
  }

  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd must be a non-empty string');
  }

  // Validate remote name
  if (/\s/.test(remoteName)) {
    throw new Error('remoteName cannot contain whitespace');
  }

  // Check if remote already exists
  if (hasRemote(remoteName, cwd, client)) {
    throw new Error(`Remote '${remoteName}' already exists`);
  }

  try {
    execFileSync('git', ['remote', 'add', remoteName, url], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'info',
          message: `Successfully added remote '${remoteName}': ${url}`
        }
      });
    }
  } catch (error) {
    throw new Error(`Failed to add remote '${remoteName}': ${error.message}`);
  }
}

/**
 * Fetches updates from a git remote
 * @param {string} remoteName - Name of the remote to fetch from
 * @param {string} cwd - Current working directory (repository path)
 * @param {Object} client - OpenCode SDK client (optional)
 * @throws {Error} If remote doesn't exist or fetch fails
 */
export function fetchRemote(remoteName, cwd, client = null) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new Error('remoteName must be a non-empty string');
  }

  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd must be a non-empty string');
  }

  // Validate remote name
  if (/\s/.test(remoteName)) {
    throw new Error('remoteName cannot contain whitespace');
  }

  // Check if remote exists
  if (!hasRemote(remoteName, cwd, client)) {
    throw new Error(`Remote '${remoteName}' does not exist`);
  }

  try {
    execFileSync('git', ['fetch', remoteName], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'info',
          message: `Successfully fetched from remote '${remoteName}'`
        }
      });
    }
  } catch (error) {
    throw new Error(`Failed to fetch from remote '${remoteName}': ${error.message}`);
  }
}

/**
 * Detects GitHub repository information from a specific git remote
 * @param {string} remoteName - Name of the remote to check
 * @param {string} cwd - Current working directory (repository path)
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {{owner: string, repo: string} | null} Repository info or null if not found
 */
export function detectRepoFromRemote(remoteName, cwd, client = null) {
  if (!remoteName || typeof remoteName !== 'string') {
    throw new Error('remoteName must be a non-empty string');
  }

  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd must be a non-empty string');
  }

  const remoteUrl = getRemoteUrl(remoteName, cwd, client);
  
  if (!remoteUrl) {
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'error',
          message: `Remote '${remoteName}' not found in repository`
        }
      });
    }
    return null;
  }

  const repoInfo = parseRepoFromUrl(remoteUrl);
  
  if (!repoInfo) {
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'error',
          message: `Unable to parse GitHub URL from remote '${remoteName}': ${remoteUrl}`
        }
      });
    }
    return null;
  }

  return repoInfo;
}
