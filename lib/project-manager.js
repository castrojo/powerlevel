import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { logWarn } from './logger.js';

/**
 * Lists all configured projects in the projects/ directory
 * @param {string} basePath - Base path to search for projects
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {Array<Object>} Array of project configs
 */
export function listProjects(basePath, client = null) {
  const projectsDir = join(basePath, 'projects');
  
  if (!existsSync(projectsDir)) {
    return [];
  }
  
  const projects = [];
  const entries = readdirSync(projectsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const configPath = join(projectsDir, entry.name, 'config.json');
      if (existsSync(configPath)) {
        try {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'));
          projects.push({
            name: entry.name,
            path: join(projectsDir, entry.name),
            ...config
          });
        } catch (error) {
          logWarn(client, `Warning: Failed to parse config for ${entry.name}: ${error.message}`);
        }
      }
    }
  }
  
  return projects;
}

/**
 * Calculates current Powerlevel (number of active projects)
 * @param {Array<Object>} projects - Array of project configs
 * @returns {number} Powerlevel score
 */
export function calculatePowerlevel(projects) {
  return projects.filter(p => p.active !== false).length;
}

