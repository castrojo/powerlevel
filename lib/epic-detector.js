import { execSync } from 'child_process';
import { loadCache, getEpic } from './cache-manager.js';

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
 * Gets epic details from cache
 * @param {number} epicNumber - Epic issue number
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Object|null} Epic object or null if not found
 */
export function getEpicDetails(epicNumber, owner, repo) {
  try {
    const cache = loadCache(owner, repo);
    return getEpic(cache, epicNumber);
  } catch (error) {
    return null;
  }
}

/**
 * Formats label for compact display
 * @param {string} label - Label to format
 * @returns {string|null} Formatted label or null to skip
 */
function formatLabel(label) {
  // Remove common prefixes but keep domain/tech identifiers
  if (label.startsWith('priority/')) {
    return label.replace('priority/', '');
  }
  if (label.startsWith('area/')) {
    return label.replace('area/', '');
  }
  if (label.startsWith('domain/')) {
    return label.replace('domain/', '');
  }
  // Keep everything else as-is (backend, api, react, etc.)
  return label;
}

/**
 * Selects top 3 most topical/domain labels
 * Prioritizes domain, tech stack, and feature area over status
 * @param {string[]} labels - Array of label strings
 * @returns {string[]} Top 3 formatted labels
 */
function selectTopLabels(labels) {
  // Filter out status, type, and epic reference labels
  const filtered = labels.filter(label => {
    const lower = label.toLowerCase();
    return !lower.startsWith('status/') &&
           !lower.startsWith('type/') &&
           !lower.startsWith('epic/');
  });
  
  // Priority order for label categories
  const domainLabels = ['backend', 'frontend', 'api', 'database', 'auth', 'ui', 
                        'infrastructure', 'devops', 'security', 'testing'];
  
  const techLabels = ['react', 'vue', 'nodejs', 'python', 'go', 'rust',
                      'postgres', 'mysql', 'redis', 'mongodb', 'graphql', 'rest'];
  
  const featureLabels = ['analytics', 'payments', 'notifications', 'search',
                         'export', 'import', 'reporting', 'dashboard'];
  
  const selected = [];
  
  // 1. Add domain labels first
  for (const label of filtered) {
    const cleaned = formatLabel(label);
    if (cleaned && domainLabels.includes(cleaned.toLowerCase())) {
      selected.push(cleaned);
      if (selected.length >= 3) return selected;
    }
  }
  
  // 2. Add tech stack labels
  for (const label of filtered) {
    const cleaned = formatLabel(label);
    if (cleaned && techLabels.includes(cleaned.toLowerCase())) {
      selected.push(cleaned);
      if (selected.length >= 3) return selected;
    }
  }
  
  // 3. Add feature area labels
  for (const label of filtered) {
    const cleaned = formatLabel(label);
    if (cleaned && featureLabels.includes(cleaned.toLowerCase())) {
      selected.push(cleaned);
      if (selected.length >= 3) return selected;
    }
  }
  
  // 4. Add priority if P0 or P1 and we have room
  for (const label of labels) {
    if (label === 'priority/p0' || label === 'priority/p1') {
      const cleaned = label.replace('priority/', '');
      selected.push(cleaned);
      if (selected.length >= 3) return selected;
    }
  }
  
  // 5. Add any remaining custom labels
  for (const label of filtered) {
    const cleaned = formatLabel(label);
    if (cleaned && !selected.includes(cleaned)) {
      selected.push(cleaned);
      if (selected.length >= 3) return selected;
    }
  }
  
  return selected;
}

/**
 * Formats epic for multi-line session title display
 * Line 1: #123 - Epic Title
 * Line 2: [labels] ▓▓▓▓▓░░░ (5/8) OR placeholder
 * Line 3: Full description OR placeholder
 * @param {Object} epic - Epic object from cache
 * @param {Object} options - Formatting options
 * @returns {string} Multi-line title with newlines
 */
export function formatEpicTitle(epic, options = {}) {
  const {
    showProgress = true,
    includeDescription = true,
    maxDescriptionLength = 150
  } = options;
  
  const lines = [];
  
  // LINE 1: Issue # + Title
  lines.push(`#${epic.number} - ${epic.title || 'Untitled Epic'}`);
  
  // LINE 2: Labels + Progress Bar
  let line2 = '';
  
  // Add labels or placeholder
  if (epic.labels && epic.labels.length > 0) {
    const topLabels = selectTopLabels(epic.labels);
    if (topLabels.length > 0) {
      line2 += `[${topLabels.join(', ')}]`;
    } else {
      // Has labels but none topical - show placeholder
      line2 += '[Awaiting classification...]';
    }
  } else {
    // No labels at all - show placeholder
    line2 += '[Awaiting classification...]';
  }
  
  // Add progress bar
  if (showProgress && epic.sub_issues && epic.sub_issues.length > 0) {
    const completed = epic.sub_issues.filter(si => si.state === 'closed').length;
    const total = epic.sub_issues.length;
    
    const barLength = 8;
    const filled = Math.round((completed / total) * barLength);
    const bar = '▓'.repeat(filled) + '░'.repeat(barLength - filled);
    
    // Add space separator
    line2 += ` ${bar} (${completed}/${total})`;
  }
  
  lines.push(line2);
  
  // LINE 3: Description/Goal or placeholder
  if (includeDescription && epic.goal) {
    // Take first line or paragraph of goal
    const goalPreview = epic.goal.split('\n')[0].trim();
    
    // Hard truncate at max length
    const description = goalPreview.length > maxDescriptionLength
      ? goalPreview.substring(0, maxDescriptionLength - 3) + '...'
      : goalPreview;
    
    lines.push(description);
  } else {
    // No description - show Cryptarch placeholder
    lines.push('Goal undefined - destiny awaits');
  }
  
  // Join with newlines
  return lines.join('\n');
}
