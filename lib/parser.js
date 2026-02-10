import { readFileSync } from 'fs';

/**
 * Parses a plan file to extract epic information
 * @param {string} filePath - Path to plan file
 * @returns {object} Parsed plan with title, goal, tasks, and priority
 */
export function parsePlanFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let title = '';
  let goal = '';
  let priority = 'p2'; // Default priority
  const tasks = [];
  let inGoalSection = false;
  let inTasksSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Extract title from first heading
    if (!title && line.startsWith('# ')) {
      title = line.substring(2).trim();
      continue;
    }
    
    // Extract priority from metadata or frontmatter
    if (line.match(/^priority:\s*(p[0-3])/i)) {
      priority = line.match(/^priority:\s*(p[0-3])/i)[1].toLowerCase();
      continue;
    }
    
    // Detect goal section (both ## and ### level headings)
    if (line.match(/^###+?\s+goal/i)) {
      inGoalSection = true;
      inTasksSection = false;
      continue;
    }
    
    // Detect tasks section
    if (line.match(/^###+?\s+(tasks|steps|checklist)/i)) {
      inTasksSection = true;
      inGoalSection = false;
      continue;
    }
    
    // Detect any other section heading
    if (line.match(/^##/)) {
      inGoalSection = false;
      inTasksSection = false;
      continue;
    }
    
    // Collect goal text
    if (inGoalSection && line.length > 0) {
      goal += (goal ? '\n' : '') + line;
    }
    
    // Collect tasks
    if (inTasksSection) {
      // Match checklist items: - [ ] task or - task
      const taskMatch = line.match(/^[-*]\s+(?:\[[ x]\]\s+)?(.+)/);
      if (taskMatch) {
        tasks.push(taskMatch[1].trim());
      }
    }
  }
  
  return {
    title: title || 'Untitled Plan',
    goal: goal || 'No goal specified',
    tasks,
    priority
  };
}

/**
 * Formats an epic body from plan data
 * @param {object} plan - Plan object from parsePlanFile
 * @returns {string} Formatted markdown body for GitHub issue
 */
export function formatEpicBody(plan) {
  let body = `## Goal\n\n${plan.goal}\n\n`;
  
  if (plan.tasks && plan.tasks.length > 0) {
    body += `## Tasks\n\n`;
    plan.tasks.forEach((task, index) => {
      body += `- [ ] ${task}\n`;
    });
  }
  
  return body;
}

/**
 * Extract plan file path from message
 * @param {string} message - Message text
 * @returns {string|null} Plan file path or null
 */
export function extractPlanFromMessage(message) {
  // Look for patterns like "docs/plans/2026-02-10-feature.md"
  const match = message.match(/docs\/plans\/[\w-]+\.md/);
  return match ? match[0] : null;
}
