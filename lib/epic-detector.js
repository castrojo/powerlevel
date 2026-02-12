import { execSync } from 'child_process';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
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
 * Reads the most recent plan file and extracts the epic number
 * @param {string} cwd - Current working directory
 * @returns {{ epicNumber: number, content: string, filename: string } | null}
 */
function readLatestPlan(cwd) {
  const plansDir = join(cwd, 'docs', 'plans');
  if (!existsSync(plansDir)) return null;

  const planFiles = readdirSync(plansDir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();

  if (planFiles.length === 0) return null;

  const filename = planFiles[0];
  const content = readFileSync(join(plansDir, filename), 'utf-8');
  const epicMatch = content.match(/\*\*Epic Issue:\*\*\s+#(\d+)/);
  if (!epicMatch) return null;

  return { epicNumber: parseInt(epicMatch[1], 10), content, filename };
}

/**
 * Detects epic from plan files in docs/plans/ directory
 * Looks for **Epic Issue:** #N pattern in most recent plan file
 * @param {string} cwd - Current working directory
 * @returns {number|null} Epic number or null if not found
 */
export function detectEpicFromPlan(cwd) {
  try {
    const plan = readLatestPlan(cwd);
    return plan ? plan.epicNumber : null;
  } catch (error) {
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
    const plan = readLatestPlan(cwd);
    if (!plan) return null;

    const titleMatch = plan.content.match(/^#\s+(.+)$/m);
    const planTitle = titleMatch ? titleMatch[1].replace(' Implementation Plan', '').trim() : 'Unknown';

    const repoInfo = detectRepo(cwd);
    const repo = repoInfo ? `${repoInfo.owner}/${repoInfo.repo}` : null;

    return {
      epicNumber: plan.epicNumber,
      epicTitle: planTitle,
      planFile: `docs/plans/${plan.filename}`,
      repo
    };
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

