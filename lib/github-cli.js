import { execSync } from 'child_process';

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
 * @returns {number} Created issue number
 */
export function createEpic(repo, title, body, labels = []) {
  try {
    const labelsArg = labels.length > 0 ? `--label "${labels.join(',')}"` : '';
    const command = `issue create --repo ${repo} --title "${title}" --body "${body}" ${labelsArg}`;
    
    const output = execGh(command);
    const issueNumber = parseIssueNumber(output);
    
    if (!issueNumber) {
      throw new Error('Failed to parse issue number from output');
    }
    
    return issueNumber;
  } catch (error) {
    console.error(`Error creating epic: ${error.message}`);
    throw error;
  }
}

/**
 * Creates a sub-issue (task) for an epic
 * @param {string} repo - Repository in owner/repo format
 * @param {string} title - Issue title
 * @param {string} body - Issue description
 * @param {string[]} labels - Array of label names
 * @param {number} epicNumber - Parent epic number
 * @returns {number} Created issue number
 */
export function createSubIssue(repo, title, body, labels = [], epicNumber = null) {
  try {
    let fullBody = body;
    
    // Add epic reference to body
    if (epicNumber) {
      fullBody = `Part of #${epicNumber}\n\n${body}`;
    }
    
    const labelsArg = labels.length > 0 ? `--label "${labels.join(',')}"` : '';
    const command = `issue create --repo ${repo} --title "${title}" --body "${fullBody}" ${labelsArg}`;
    
    const output = execGh(command);
    const issueNumber = parseIssueNumber(output);
    
    if (!issueNumber) {
      throw new Error('Failed to parse issue number from output');
    }
    
    return issueNumber;
  } catch (error) {
    console.error(`Error creating sub-issue: ${error.message}`);
    throw error;
  }
}

/**
 * Updates an issue body
 * @param {string} repo - Repository in owner/repo format
 * @param {number} issueNumber - Issue number to update
 * @param {string} body - New issue body
 */
export function updateIssueBody(repo, issueNumber, body) {
  try {
    execGh(`issue edit ${issueNumber} --repo ${repo} --body "${body}"`);
  } catch (error) {
    console.error(`Error updating issue #${issueNumber}: ${error.message}`);
    throw error;
  }
}

/**
 * Adds a comment to an issue
 * @param {string} repo - Repository in owner/repo format
 * @param {number} issueNumber - Issue number
 * @param {string} comment - Comment text
 */
export function addComment(repo, issueNumber, comment) {
  try {
    execGh(`issue comment ${issueNumber} --repo ${repo} --body "${comment}"`);
  } catch (error) {
    console.error(`Error adding comment to issue #${issueNumber}: ${error.message}`);
    throw error;
  }
}

/**
 * Closes an issue
 * @param {string} repo - Repository in owner/repo format
 * @param {number} issueNumber - Issue number to close
 * @param {string} comment - Optional closing comment
 */
export function closeIssue(repo, issueNumber, comment = null) {
  try {
    if (comment) {
      addComment(repo, issueNumber, comment);
    }
    execGh(`issue close ${issueNumber} --repo ${repo}`);
  } catch (error) {
    console.error(`Error closing issue #${issueNumber}: ${error.message}`);
    throw error;
  }
}
