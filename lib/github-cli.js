import { execSync } from 'child_process';
import { platform } from 'os';

/**
 * Executes a GitHub CLI command
 * @param {string} command - The gh command to execute (without 'gh' prefix)
 * @param {Object} options - Options for execSync
 * @returns {string} Command output
 * @throws {Error} If command fails
 */
export function execGh(command, options = {}) {
  try {
    const output = execSync(`gh ${command}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options
    });
    return output.trim();
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message;
    throw new Error(`GitHub CLI error: ${errorMessage}`);
  }
}

/**
 * Opens a URL in the default browser
 * @param {string} url - The URL to open
 * @param {Object} client - OpenCode SDK client (optional)
 */
export function openInBrowser(url, client = null) {
  try {
    const os = platform();
    let command;
    
    switch (os) {
      case 'darwin':
        command = `open "${url}"`;
        break;
      case 'win32':
        command = `start "" "${url}"`;
        break;
      default: // linux and others
        command = `xdg-open "${url}"`;
        break;
    }
    
    execSync(command, {
      stdio: 'ignore',
      detached: true
    });
    
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'info',
          message: `Opened URL in browser: ${url}`
        }
      });
    }
  } catch (error) {
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'warn',
          message: `Failed to open browser: ${error.message}`
        }
      });
    }
    // Don't throw - browser opening is non-critical
  }
}

/**
 * Parses issue number from gh issue create output
 * @param {string} output - Output from gh issue create command
 * @returns {number|null} Issue number or null if not found
 */
export function parseIssueNumber(output) {
  // Output format: https://github.com/owner/repo/issues/123
  const match = output.match(/\/issues\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Creates an epic issue
 * @param {string} repo - Repository in owner/repo format
 * @param {string} title - Epic title
 * @param {string} body - Epic description
 * @param {string[]} labels - Array of label names
 * @param {Object} client - OpenCode SDK client (optional)
 * @param {boolean} openBrowser - Whether to open the epic in browser (default: true)
 * @returns {number} Created issue number
 */
export function createEpic(repo, title, body, labels = [], client = null, openBrowser = true) {
  try {
    const labelsArg = labels.length > 0 ? `--label "${labels.join(',')}"` : '';
    
    // Use stdin to pass body to avoid shell escaping issues
    const command = `issue create --repo ${repo} --title "${title}" ${labelsArg} --body-file -`;
    
    const output = execSync(`gh ${command}`, {
      input: body,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const issueNumber = parseIssueNumber(output.trim());
    
    if (!issueNumber) {
      throw new Error('Failed to parse issue number from output');
    }
    
    // Open epic in browser
    if (openBrowser) {
      const epicUrl = `https://github.com/${repo}/issues/${issueNumber}`;
      openInBrowser(epicUrl, client);
    }
    
    return issueNumber;
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message;
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'error',
          message: `Error creating epic: ${errorMessage}`
        }
      });
    }
    throw new Error(`GitHub CLI error: ${errorMessage}`);
  }
}

/**
 * Creates a sub-issue (task) for an epic
 * @param {string} repo - Repository in owner/repo format
 * @param {string} title - Issue title
 * @param {string} body - Issue description
 * @param {string[]} labels - Array of label names
 * @param {number} epicNumber - Parent epic number
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {number} Created issue number
 */
export function createSubIssue(repo, title, body, labels = [], epicNumber = null, client = null) {
  try {
    let fullBody = body;
    
    // Add epic reference to body
    if (epicNumber) {
      fullBody = `Part of #${epicNumber}\n\n${body}`;
    }
    
    const labelsArg = labels.length > 0 ? `--label "${labels.join(',')}"` : '';
    
    // Use stdin to pass body to avoid shell escaping issues
    const command = `issue create --repo ${repo} --title "${title}" ${labelsArg} --body-file -`;
    
    const output = execSync(`gh ${command}`, {
      input: fullBody,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const issueNumber = parseIssueNumber(output.trim());
    
    if (!issueNumber) {
      throw new Error('Failed to parse issue number from output');
    }
    
    return issueNumber;
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message;
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'error',
          message: `Error creating sub-issue: ${errorMessage}`
        }
      });
    }
    throw new Error(`GitHub CLI error: ${errorMessage}`);
  }
}

/**
 * Updates an issue body
 * @param {string} repo - Repository in owner/repo format
 * @param {number} issueNumber - Issue number to update
 * @param {string} body - New issue body
 * @param {Object} client - OpenCode SDK client (optional)
 */
export function updateIssueBody(repo, issueNumber, body, client = null) {
  try {
    // Use stdin to pass body to avoid shell escaping issues
    const command = `issue edit ${issueNumber} --repo ${repo} --body-file -`;
    
    execSync(`gh ${command}`, {
      input: body,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message;
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'error',
          message: `Error updating issue #${issueNumber}: ${errorMessage}`
        }
      });
    }
    throw new Error(`GitHub CLI error: ${errorMessage}`);
  }
}

/**
 * Adds a comment to an issue
 * @param {string} repo - Repository in owner/repo format
 * @param {number} issueNumber - Issue number
 * @param {string} comment - Comment text
 * @param {Object} client - OpenCode SDK client (optional)
 */
export function addComment(repo, issueNumber, comment, client = null) {
  try {
    // Use stdin to pass comment to avoid shell escaping issues
    const command = `issue comment ${issueNumber} --repo ${repo} --body-file -`;
    
    execSync(`gh ${command}`, {
      input: comment,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message;
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'error',
          message: `Error adding comment to issue #${issueNumber}: ${errorMessage}`
        }
      });
    }
    throw new Error(`GitHub CLI error: ${errorMessage}`);
  }
}

/**
 * Creates an external tracking epic in Powerlevel repo
 * @param {string} repoPath - Powerlevel repo (owner/repo)
 * @param {string} title - Epic title
 * @param {string} body - Epic body (markdown)
 * @param {Array<string>} labels - Label names
 * @param {Object} client - OpenCode SDK client (optional)
 * @param {boolean} openBrowser - Whether to open the epic in browser (default: true)
 * @returns {number} Epic issue number
 */
export function createTrackingEpic(repoPath, title, body, labels, client = null, openBrowser = true) {
  try {
    const labelsArg = labels.length > 0 ? `--label "${labels.join(',')}"` : '';
    
    // Use stdin to pass body to avoid shell escaping issues
    const command = `issue create --repo ${repoPath} --title "${title}" ${labelsArg} --body-file -`;
    
    const output = execSync(`gh ${command}`, {
      input: body,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Extract issue number from output (format: https://github.com/owner/repo/issues/123)
    const match = output.match(/\/issues\/(\d+)/);
    if (!match) {
      throw new Error('Failed to extract issue number from gh output');
    }
    
    const issueNumber = parseInt(match[1], 10);
    
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'info',
          message: `Created tracking epic #${issueNumber} in ${repoPath}`
        }
      });
    }
    
    // Open epic in browser
    if (openBrowser) {
      const epicUrl = `https://github.com/${repoPath}/issues/${issueNumber}`;
      openInBrowser(epicUrl, client);
    }
    
    return issueNumber;
  } catch (error) {
    const errorMessage = error.stderr?.toString() || error.message;
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'error',
          message: `Failed to create tracking epic: ${errorMessage}`
        }
      });
    }
    throw new Error(`GitHub CLI error: ${errorMessage}`);
  }
}

/**
 * Executes a GitHub GraphQL query
 * @param {string} query - GraphQL query string
 * @param {Object} variables - Query variables
 * @returns {Object} Parsed JSON response
 * @throws {Error} If query fails
 */
export function execGraphQL(query, variables = {}) {
  const varFlags = Object.entries(variables)
    .map(([key, value]) => `-F ${key}=${JSON.stringify(value)}`)
    .join(' ');
  
  try {
    // Escape single quotes to prevent shell injection
    const escapedQuery = query.replace(/'/g, "'\\''");
    const result = execSync(
      `gh api graphql -f query='${escapedQuery}' ${varFlags}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(result);
  } catch (error) {
    // Try to parse error output as JSON
    try {
      const errorOutput = error.stderr?.toString() || error.stdout?.toString() || '';
      const parsed = JSON.parse(errorOutput);
      if (parsed.errors) {
        return parsed; // Return with errors so caller can handle
      }
    } catch (parseError) {
      // Not JSON, use original error
    }
    throw new Error(`GraphQL query failed: ${error.message}`);
  }
}
