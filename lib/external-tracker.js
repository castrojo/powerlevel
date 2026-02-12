import { execGh } from './github-cli.js';
import { logInfo, logError } from './logger.js';

/**
 * Fetches open issues from an external repository
 * @param {string} externalRepo - External repo in owner/repo format
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {Array<Object>} Array of issue objects with number, title, state, url
 */
export function fetchExternalIssues(externalRepo, client = null) {
  try {
    // Try multiple label patterns for epics
    let output = execGh(`issue list --repo ${externalRepo} --state open --label type/epic --json number,title,state,url --limit 100`);
    let issues = JSON.parse(output);
    
    // If no type/epic issues, try just "epic" label
    if (issues.length === 0) {
      output = execGh(`issue list --repo ${externalRepo} --state open --label epic --json number,title,state,url --limit 100`);
      issues = JSON.parse(output);
    }
    
    // If still no epics, fall back to all open issues
    if (issues.length === 0) {
      output = execGh(`issue list --repo ${externalRepo} --state open --json number,title,state,url --limit 100`);
      issues = JSON.parse(output);
    }
    
    logInfo(client, `Fetched ${issues.length} open issues from ${externalRepo}`);
    
    return issues;
  } catch (error) {
    logError(client, `Error fetching issues from ${externalRepo}: ${error.message}`);
    return [];
  }
}

/**
 * Formats external issues as GitHub tasklist markdown
 * @param {Array<Object>} issues - Array of issue objects from fetchExternalIssues
 * @returns {string} Markdown tasklist format
 */
export function formatTasklist(issues) {
  if (!issues || issues.length === 0) {
    return '- [ ] No open issues in external repository\n';
  }
  
  return issues.map(issue => {
    const checkbox = issue.state === 'CLOSED' ? '[x]' : '[ ]';
    return `- ${checkbox} [${issue.title}](${issue.url})`;
  }).join('\n');
}

/**
 * Generates full epic body with tasklist for external tracking
 * @param {string} externalRepo - External repo in owner/repo format
 * @param {string} description - Project description
 * @param {Array<Object>} issues - Array of external issues
 * @returns {string} Full epic body markdown
 */
export function generateExternalEpicBody(externalRepo, description, issues) {
  const tasklist = formatTasklist(issues);
  
  return `**External Project Tracking Epic**

This epic tracks open issues from the external repository: [${externalRepo}](https://github.com/${externalRepo})

**Description:** ${description}

**Tracked Issues:**

${tasklist}

**Tracking Status:**
- External repo: https://github.com/${externalRepo}
- Auto-synced on session start
- Tasklist items represent open issues in the external repo

**Design Note:** This is a tracking-only epic. All work happens in the external repository. Powerlevel displays unified status snapshots but never modifies external repos.`;
}

/**
 * Syncs external project tracking epic with latest issues from external repo
 * @param {string} powerlevelRepo - Powerlevel repo (owner/repo)
 * @param {number} epicNumber - Epic issue number in Powerlevel
 * @param {string} externalRepo - External repo (owner/repo)
 * @param {string} description - Project description
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {Object} Sync result with issue count and updated body
 */
export async function syncExternalEpic(powerlevelRepo, epicNumber, externalRepo, description, client = null) {
  try {
    // Fetch latest issues from external repo
    const issues = fetchExternalIssues(externalRepo, client);
    
    // Generate new epic body with tasklist
    const newBody = generateExternalEpicBody(externalRepo, description, issues);
    
    // Update epic body via gh CLI
    const { updateIssueBody } = await import('./github-cli.js');
    updateIssueBody(powerlevelRepo, epicNumber, newBody, client);
    
    logInfo(client, `✓ Synced Epic #${epicNumber}: ${issues.length} items tracked`);
    
    return {
      issueCount: issues.length,
      body: newBody,
      synced: true
    };
  } catch (error) {
    logError(client, `Error syncing Epic #${epicNumber}: ${error.message}`);
    return {
      issueCount: 0,
      body: null,
      synced: false,
      error: error.message
    };
  }
}

/**
 * Detects if an epic is an external tracking epic
 * @param {Object} epic - Epic object from cache
 * @returns {boolean} True if external tracking epic
 */
export function isExternalTrackingEpic(epic) {
  if (!epic || !epic.labels) return false;
  
  // Check for project/* label (indicates external tracking)
  return epic.labels.some(label => 
    label.startsWith('project/') && !label.includes('powerlevel')
  );
}

