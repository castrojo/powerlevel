import { execGh } from './github-cli.js';

/**
 * Label definitions aligned with Superpowers workflow
 */
export const LABELS = {
  // Epic priority labels
  'priority/p0': { color: 'b60205', description: 'Critical priority epic' },
  'priority/p1': { color: 'd93f0b', description: 'High priority epic' },
  'priority/p2': { color: 'fbca04', description: 'Medium priority epic' },
  'priority/p3': { color: '0e8a16', description: 'Low priority epic' },
  
  // Task priority labels (for sub-issues)
  'task/p0': { color: 'b60205', description: 'Critical priority task' },
  'task/p1': { color: 'd93f0b', description: 'High priority task' },
  'task/p2': { color: 'fbca04', description: 'Medium priority task' },
  'task/p3': { color: '0e8a16', description: 'Low priority task' },
  
  // Epic labels (dynamically generated with epic number)
  // Format: 'epic/123' - created as needed
  
  // Type labels
  'type/epic': { color: '5319e7', description: 'Epic issue' },
  'type/task': { color: '1d76db', description: 'Task issue' },
  
  // Status labels
  'status/planning': { color: 'd4c5f9', description: 'In planning phase' },
  'status/in-progress': { color: 'c2e0c6', description: 'Work in progress' },
  'status/blocked': { color: 'd73a4a', description: 'Blocked by dependency' },
  'status/review': { color: 'fbca04', description: 'In review' },
  'status/done': { color: '0e8a16', description: 'Completed' }
};

/**
 * Ensures all required labels exist in the repository
 * @param {string} repo - Repository in owner/repo format
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {Promise<void>}
 */
export async function ensureLabelsExist(repo, client = null) {
  if (client) {
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: 'Checking for required labels...' }
    });
  }
  
  const existingLabels = new Set();
  
  try {
    const output = execGh(`label list --repo ${repo} --json name --limit 1000`);
    const labels = JSON.parse(output);
    labels.forEach(label => existingLabels.add(label.name));
  } catch (error) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'error', message: `Error fetching existing labels: ${error.message}` }
      });
    }
    throw error;
  }

  const labelsToCreate = [];
  
  for (const [name, config] of Object.entries(LABELS)) {
    if (!existingLabels.has(name)) {
      labelsToCreate.push({ name, ...config });
    }
  }

  if (labelsToCreate.length === 0) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: 'All required labels already exist.' }
      });
    }
    return;
  }

  if (client) {
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: `Creating ${labelsToCreate.length} missing labels...` }
    });
  }
  
  for (const label of labelsToCreate) {
    try {
      execGh(`label create "${label.name}" --repo ${repo} --color ${label.color} --description "${label.description}"`);
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: `  ✓ Created label: ${label.name}` }
        });
      }
    } catch (error) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'error', message: `  ✗ Failed to create label ${label.name}: ${error.message}` }
        });
      }
    }
  }
}

/**
 * Gets priority labels for an epic
 * @param {string} priority - Priority level (p0, p1, p2, p3)
 * @returns {string[]} Array of label names
 */
export function getEpicLabels(priority = 'p2') {
  return [
    'type/epic',
    `priority/${priority}`,
    'status/planning'
  ];
}

/**
 * Gets labels for a task (sub-issue)
 * @param {number} epicNumber - Parent epic number
 * @param {string} priority - Priority level (p0, p1, p2, p3)
 * @returns {string[]} Array of label names
 */
export function getTaskLabels(epicNumber, priority = 'p2') {
  return [
    'type/task',
    `epic/${epicNumber}`,
    `task/${priority}`,
    'status/planning'
  ];
}

/**
 * Ensures an epic label exists
 * @param {string} repo - Repository in owner/repo format
 * @param {number} epicNumber - Epic issue number
 * @returns {string} The epic label name
 */
export function ensureEpicLabel(repo, epicNumber) {
  const labelName = `epic/${epicNumber}`;
  
  try {
    // Try to create the label (will fail silently if it exists)
    execGh(`label create "${labelName}" --repo ${repo} --color 5319e7 --description "Tasks for epic #${epicNumber}" 2>/dev/null || true`);
  } catch (error) {
    // Label might already exist, which is fine
  }
  
  return labelName;
}
