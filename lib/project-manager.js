import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * Lists all configured projects in the projects/ directory
 * @param {string} basePath - Base path to search for projects
 * @returns {Array<Object>} Array of project configs
 */
export function listProjects(basePath) {
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
          console.warn(`Warning: Failed to parse config for ${entry.name}: ${error.message}`);
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

/**
 * Gets project config by name
 * @param {string} basePath - Base path
 * @param {string} projectName - Project name
 * @returns {Object|null} Project config or null
 */
export function getProject(basePath, projectName) {
  const projects = listProjects(basePath);
  return projects.find(p => p.name === projectName) || null;
}
