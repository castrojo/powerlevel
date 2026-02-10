import { execFileSync } from 'child_process';
import { loadCache, saveCache, getEpic, addJourneyEntry as cacheAddJourneyEntry, updateEpic } from './cache-manager.js';
import { loadConfig } from './config-loader.js';
import { detectRepo } from './repo-detector.js';
import { parsePlanFile } from './parser.js';

/**
 * Validates an epic number
 * @param {number} epicNumber - Epic issue number
 * @throws {Error} If epic number is invalid
 */
function validateEpicNumber(epicNumber) {
  if (!Number.isInteger(epicNumber) || epicNumber <= 0) {
    throw new Error('Epic number must be a positive integer');
  }
}

/**
 * Sanitizes user input for GitHub API
 * @param {string} input - User input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  // Remove null bytes and control characters
  return input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F]/g, '');
}

/**
 * Formats epic body with goal, tasks, and journey
 * @param {Object} epic - Epic object from cache
 * @param {string} cwd - Current working directory
 * @returns {string} Formatted markdown body
 */
function formatEpicBodyWithJourney(epic, cwd) {
  let body = '';
  
  // Try to load original plan file for goal and tasks
  if (epic.plan_file) {
    try {
      const plan = parsePlanFile(epic.plan_file);
      
      body += `## Goal\n\n${plan.goal}\n\n`;
      
      if (plan.tasks && plan.tasks.length > 0) {
        body += `## Tasks\n\n`;
        
        // Check which tasks are completed by looking at sub_issues
        const completedTasks = new Set();
        if (epic.sub_issues) {
          epic.sub_issues.forEach(subIssue => {
            if (subIssue.state === 'closed') {
              completedTasks.add(subIssue.number);
            }
          });
        }
        
        plan.tasks.forEach((task, index) => {
          const taskNumber = index + 1;
          const subIssue = epic.sub_issues?.find(si => si.title?.includes(`Task ${taskNumber}`));
          const isCompleted = subIssue && completedTasks.has(subIssue.number);
          const checkbox = isCompleted ? '[x]' : '[ ]';
          body += `- ${checkbox} ${task}\n`;
        });
        body += '\n';
      }
    } catch (error) {
      // If plan file can't be loaded, use basic epic info
      body += `## Goal\n\n${epic.title}\n\n`;
    }
  } else {
    body += `## Goal\n\n${epic.title}\n\n`;
  }
  
  // Add journey section if entries exist
  if (epic.journey && epic.journey.length > 0) {
    body += `## Progress Journey\n\n`;
    
    // Sort journey entries by timestamp (newest first)
    const sortedJourney = [...epic.journey].sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
    
    sortedJourney.forEach(entry => {
      const timestamp = new Date(entry.timestamp).toISOString().replace('T', ' ').substring(0, 16);
      body += `- **${timestamp} UTC** - ${entry.message}`;
      if (entry.agent) {
        body += `\n  - Agent: ${entry.agent}`;
      }
      body += '\n';
    });
  }
  
  return body;
}

/**
 * Adds a journey entry to an epic's cache
 * @param {number} epicNumber - Epic issue number
 * @param {Object} entry - Journey entry with event, message, agent (optional)
 * @param {string} cwd - Current working directory
 * @returns {void}
 */
export function addJourneyEntry(epicNumber, entry, cwd) {
  validateEpicNumber(epicNumber);
  
  if (!entry || typeof entry !== 'object') {
    throw new Error('Entry must be an object');
  }
  
  if (!entry.event || typeof entry.event !== 'string') {
    throw new Error('Entry must have an event field (string)');
  }
  
  if (!entry.message || typeof entry.message !== 'string') {
    throw new Error('Entry must have a message field (string)');
  }
  
  try {
    const repo = detectRepo(cwd);
    const cache = loadCache(repo.owner, repo.repo);
    
    const epic = getEpic(cache, epicNumber);
    if (!epic) {
      throw new Error(`Epic #${epicNumber} not found in cache`);
    }
    
    // Sanitize entry fields
    const sanitizedEntry = {
      timestamp: entry.timestamp || new Date().toISOString(),
      event: sanitizeInput(entry.event),
      message: sanitizeInput(entry.message),
      ...(entry.agent && { agent: sanitizeInput(entry.agent) }),
      ...(entry.metadata && { metadata: entry.metadata })
    };
    
    cacheAddJourneyEntry(cache, epicNumber, sanitizedEntry);
    saveCache(repo.owner, repo.repo, cache);
    
    console.log(`✅ Added journey entry to epic #${epicNumber}`);
  } catch (error) {
    console.error(`Error adding journey entry to epic #${epicNumber}: ${error.message}`);
    throw error;
  }
}

/**
 * Syncs an epic to GitHub by updating the issue body with journey
 * @param {number} epicNumber - Epic issue number
 * @param {string} cwd - Current working directory
 * @returns {void}
 */
export function syncEpicToGitHub(epicNumber, cwd) {
  validateEpicNumber(epicNumber);
  
  try {
    const config = loadConfig(cwd);
    
    // Check if auto-update is enabled
    if (!config.tracking.autoUpdateEpics) {
      console.log(`⚠️  Epic auto-updates disabled in config`);
      return;
    }
    
    const repo = detectRepo(cwd);
    const cache = loadCache(repo.owner, repo.repo);
    
    const epic = getEpic(cache, epicNumber);
    if (!epic) {
      throw new Error(`Epic #${epicNumber} not found in cache`);
    }
    
    if (!epic.dirty) {
      console.log(`ℹ️  Epic #${epicNumber} is already in sync`);
      return;
    }
    
    // Generate updated epic body with journey
    const updatedBody = formatEpicBodyWithJourney(epic, cwd);
    
    // Update issue via GitHub API
    try {
      execFileSync('gh', [
        'api',
        `repos/${repo.owner}/${repo.repo}/issues/${epicNumber}`,
        '-X', 'PATCH',
        '-f', `body=${updatedBody}`
      ], { cwd, encoding: 'utf8' });
      
      console.log(`✅ Synced epic #${epicNumber} to GitHub`);
    } catch (ghError) {
      const errorMessage = ghError.stderr?.toString() || ghError.message;
      
      // Handle specific error cases
      if (errorMessage.includes('rate limit')) {
        throw new Error('GitHub API rate limit exceeded. Will retry later.');
      } else if (errorMessage.includes('Not Found')) {
        throw new Error(`Epic #${epicNumber} not found on GitHub`);
      } else {
        throw new Error(`GitHub API error: ${errorMessage}`);
      }
    }
    
    // Clear dirty flag and update timestamp
    updateEpic(cache, epicNumber, {
      dirty: false,
      updated_at: new Date().toISOString()
    });
    
    saveCache(repo.owner, repo.repo, cache);
    
  } catch (error) {
    if (error.message.includes('rate limit') || error.message.includes('network')) {
      // Keep dirty flag set for retry
      console.error(`⚠️  Network error syncing epic #${epicNumber}: ${error.message}`);
      console.error(`Epic remains marked as dirty for retry`);
    } else {
      console.error(`Error syncing epic #${epicNumber}: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Records task completion and adds journey entry
 * Convenience wrapper around addJourneyEntry
 * @param {number} epicNumber - Epic issue number
 * @param {number} taskNumber - Task number (1-indexed)
 * @param {string} taskTitle - Task title
 * @param {Object} agentInfo - Optional agent info { name, id }
 * @param {string} cwd - Current working directory
 * @returns {void}
 */
export function recordTaskCompletion(epicNumber, taskNumber, taskTitle, agentInfo, cwd) {
  validateEpicNumber(epicNumber);
  
  if (!Number.isInteger(taskNumber) || taskNumber <= 0) {
    throw new Error('Task number must be a positive integer');
  }
  
  if (!taskTitle || typeof taskTitle !== 'string') {
    throw new Error('Task title must be a non-empty string');
  }
  
  const message = `✅ Task ${taskNumber} completed: ${taskTitle}`;
  
  const entry = {
    event: 'task_complete',
    message: sanitizeInput(message),
    metadata: {
      taskNumber,
      taskTitle: sanitizeInput(taskTitle)
    }
  };
  
  if (agentInfo) {
    if (agentInfo.name) {
      entry.agent = sanitizeInput(agentInfo.name);
    } else if (agentInfo.id) {
      entry.agent = sanitizeInput(agentInfo.id);
    }
  }
  
  addJourneyEntry(epicNumber, entry, cwd);
  
  // Check if we should also add a GitHub comment
  try {
    const config = loadConfig(cwd);
    if (config.tracking.commentOnProgress) {
      const repo = detectRepo(cwd);
      
      let comment = `✅ **Task completed**\n\n${message}`;
      if (entry.agent) {
        comment += `\n\n_Completed by: ${entry.agent}_`;
      }
      comment += '\n\n_Updated automatically by Superpowers_';
      
      execFileSync('gh', [
        'issue',
        'comment',
        epicNumber.toString(),
        '--repo', `${repo.owner}/${repo.repo}`,
        '--body', comment
      ], { cwd, encoding: 'utf8' });
      
      console.log(`✅ Added completion comment to epic #${epicNumber}`);
    }
  } catch (error) {
    // Non-critical: log but don't throw
    console.error(`Warning: Could not add comment to epic #${epicNumber}: ${error.message}`);
  }
}
