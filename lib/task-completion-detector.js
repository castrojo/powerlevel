import { execSync } from 'child_process';

/**
 * Detects task completion from a commit message
 * Looks for patterns: closes #N, fixes #N, resolves #N, completes #N
 * 
 * @param {string} message - Commit message to parse
 * @returns {{issueNumber: number, keyword: string} | null} - Parsed task info or null if not found
 */
export function detectTaskFromCommit(message) {
  if (!message || typeof message !== 'string') {
    return null;
  }

  // Pattern: closes/fixes/resolves/completes #123
  const pattern = /\b(closes|fixes|resolves|completes)\s+#(\d+)/i;
  const match = message.match(pattern);

  if (match) {
    return {
      issueNumber: parseInt(match[2], 10),
      keyword: match[1].toLowerCase()
    };
  }

  return null;
}

/**
 * Gets recent commits since a given timestamp
 * 
 * @param {string} since - ISO timestamp string
 * @param {string} cwd - Current working directory
 * @returns {Array<{hash: string, message: string, timestamp: string}>} - Array of commit objects
 */
export function getRecentCommits(since, cwd) {
  if (!since || typeof since !== 'string') {
    return [];
  }

  if (!cwd || typeof cwd !== 'string') {
    return [];
  }

  try {
    // Get commits since timestamp in format: hash|message|timestamp
    const output = execSync(
      `git log --since="${since}" --format="%H|%s|%cI"`,
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );

    if (!output || !output.trim()) {
      return [];
    }

    // Parse output into commit objects
    const commits = output
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, message, timestamp] = line.split('|');
        return {
          hash: hash.trim(),
          message: message.trim(),
          timestamp: timestamp.trim()
        };
      });

    return commits;
  } catch (error) {
    // Handle non-git directories or git errors gracefully
    return [];
  }
}

/**
 * Finds completed tasks from commits since a given timestamp
 * 
 * @param {string} since - ISO timestamp string
 * @param {string} cwd - Current working directory
 * @returns {Array<{issueNumber: number, keyword: string, commit: object}>} - Array of completed tasks
 */
export function findCompletedTasks(since, cwd) {
  const commits = getRecentCommits(since, cwd);
  
  if (!commits || commits.length === 0) {
    return [];
  }

  const completedTasks = [];

  for (const commit of commits) {
    const detected = detectTaskFromCommit(commit.message);
    
    if (detected) {
      completedTasks.push({
        issueNumber: detected.issueNumber,
        keyword: detected.keyword,
        commit: {
          hash: commit.hash,
          message: commit.message,
          timestamp: commit.timestamp
        }
      });
    }
  }

  return completedTasks;
}
