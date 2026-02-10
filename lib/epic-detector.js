import { execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { loadCache } from './cache-manager.js';
import { detectRepo } from './repo-detector.js';

/**
 * Detects active epic from git branch name
 * Supports: epic-123, epic/123, feature/epic-123, 123-feature
 * @param {string} cwd - Current working directory
 * @returns {number|null} Epic number or null if not found
 */
export function detectEpicFromBranch(cwd) {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { 
      cwd, 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    
    // Match patterns: epic-123, epic/123, feature/epic-123, 123-feature
    const patterns = [
      /epic[-\/](\d+)/i,          // epic-123, epic/123
      /feature\/epic[-\/](\d+)/i, // feature/epic-123
      /^(\d+)[-\/]/               // 123-feature
    ];
    
    for (const pattern of patterns) {
      const match = branch.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    return null;
  } catch (error) {
    // Not a git repo or other error
    return null;
  }
}

/**
 * Detects epic from plan files in docs/plans/ directory
 * Looks for **Epic Issue:** #N pattern in most recent plan file
 * @param {string} cwd - Current working directory
 * @returns {number|null} Epic number or null if not found
 */
export function detectEpicFromPlan(cwd) {
  try {
    // Check for plans directory
    const plansDir = join(cwd, 'docs', 'plans');
    if (!existsSync(plansDir)) {
      return null;
    }
    
    // Get all plan files (most recent first by filename)
    const planFiles = readdirSync(plansDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse();
    
    if (planFiles.length === 0) {
      return null;
    }
    
    // Read most recent plan file
    const planFile = join(plansDir, planFiles[0]);
    const content = readFileSync(planFile, 'utf-8');
    
    // Extract epic reference (format: **Epic Issue:** #17)
    const epicMatch = content.match(/\*\*Epic Issue:\*\*\s+#(\d+)/);
    if (!epicMatch) {
      return null;
    }
    
    return parseInt(epicMatch[1], 10);
  } catch (error) {
    console.debug(`Error detecting epic from plan: ${error.message}`);
    return null;
  }
}

/**
 * Detects epic context from plan files in the current directory
 * Returns full context including title, plan file, and repo
 * @param {string} cwd - Current working directory
 * @returns {Object|null} Epic context or null if not found
 */
export function detectEpicContext(cwd) {
  try {
    // Check for plans directory
    const plansDir = join(cwd, 'docs', 'plans');
    if (!existsSync(plansDir)) {
      return null;
    }
    
    // Get all plan files (most recent first)
    const planFiles = readdirSync(plansDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse();
    
    if (planFiles.length === 0) {
      return null;
    }
    
    // Read most recent plan file
    const planFile = join(plansDir, planFiles[0]);
    const content = readFileSync(planFile, 'utf-8');
    
    // Extract epic reference (format: **Epic Issue:** #17)
    const epicMatch = content.match(/\*\*Epic Issue:\*\*\s+#(\d+)/);
    if (!epicMatch) {
      return null;
    }
    
    const epicNumber = parseInt(epicMatch[1], 10);
    
    // Extract title from first line
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const planTitle = titleMatch ? titleMatch[1].replace(' Implementation Plan', '').trim() : 'Unknown';
    
    // Detect repository
    const repoInfo = detectRepo(cwd);
    const repo = repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : null;
    
    return {
      epicNumber,
      epicTitle: planTitle,
      planFile: `docs/plans/${planFiles[0]}`,
      repo
    };
  } catch (error) {
    console.debug(`Error detecting epic context: ${error.message}`);
    return null;
  }
}

/**
 * Detects epic number using multiple strategies (plan files, then branch name)
 * @param {string} cwd - Current working directory
 * @returns {number|null} Epic number or null if not found
 */
export function detectEpic(cwd) {
  // Try plan files first (more reliable)
  const epicFromPlan = detectEpicFromPlan(cwd);
  if (epicFromPlan) {
    return epicFromPlan;
  }
  
  // Fall back to branch name
  return detectEpicFromBranch(cwd);
}

/**
 * Gets epic details from cache
 * @param {number} epicNumber - Epic issue number
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Object|null} Epic object or null if not found
 */
export function getEpicDetails(epicNumber, owner, repo) {
  try {
    const cache = loadCache(owner, repo);
    const epic = cache.epics.find(e => e.number === epicNumber);
    return epic || null;
  } catch (error) {
    return null;
  }
}

/**
 * Formats epic context for display in UI
 * @param {Object} context - Epic context from detectEpicContext
 * @returns {string} Formatted string for display
 */
export function formatEpicDisplay(context) {
  if (!context) {
    return null;
  }
  
  return `Epic #${context.epicNumber}: ${context.epicTitle}`;
}

/**
 * Generates GitHub URL for epic issue
 * @param {Object} context - Epic context from detectEpicContext
 * @returns {string|null} GitHub issue URL
 */
export function getEpicUrl(context) {
  if (!context || !context.repo) {
    return null;
  }
  
  return `https://github.com/${context.repo}/issues/${context.epicNumber}`;
}

/**
 * Formats epic title for session display (legacy, kept for compatibility)
 * @param {Object} epic - Epic object from cache
 * @param {Object} options - Formatting options
 * @returns {string} Formatted epic title
 */
export function formatEpicTitle(epic, options = {}) {
  if (!epic) {
    return '';
  }
  
  const {
    showProgress = false,
    includeDescription = false,
    maxDescriptionLength = 150
  } = options;
  
  let title = `Epic #${epic.number}: ${epic.title || 'Untitled'}`;
  
  if (showProgress && epic.sub_issues) {
    const total = epic.sub_issues.length;
    const completed = epic.sub_issues.filter(si => si.state === 'closed').length;
    title += ` (${completed}/${total})`;
  }
  
  if (includeDescription && epic.goal) {
    const desc = epic.goal.length > maxDescriptionLength 
      ? epic.goal.substring(0, maxDescriptionLength) + '...'
      : epic.goal;
    title += `\n${desc}`;
  }
  
  return title;
}
