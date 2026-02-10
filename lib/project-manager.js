import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Multi-project management library for Powerlevel
 * 
 * Handles:
 * - Project discovery and listing
 * - Powerlevel calculation (count of active projects)
 * - Project configuration loading
 */

/**
 * Get the projects directory path
 * @returns {string} Path to projects directory
 */
export function getProjectsDir() {
  const repoRoot = join(__dirname, '..');
  return join(repoRoot, 'projects');
}

/**
 * Ensure projects directory exists
 */
export function ensureProjectsDir() {
  const projectsDir = getProjectsDir();
  if (!existsSync(projectsDir)) {
    mkdirSync(projectsDir, { recursive: true });
  }
}

/**
 * List all projects in the projects directory
 * @returns {Array<string>} Array of project directory names
 */
export function listProjects() {
  const projectsDir = getProjectsDir();
  
  if (!existsSync(projectsDir)) {
    return [];
  }

  return readdirSync(projectsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !name.startsWith('.')); // Ignore hidden directories
}

/**
 * Load project configuration
 * @param {string} projectName - Name of the project
 * @returns {Object|null} Project config or null if not found
 */
export function loadProjectConfig(projectName) {
  const configPath = join(getProjectsDir(), projectName, 'config.json');
  
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Failed to load config for project ${projectName}:`, err.message);
    return null;
  }
}

/**
 * Get all active projects (projects with valid config)
 * @returns {Array<Object>} Array of project objects with name and config
 */
export function getActiveProjects() {
  const projects = listProjects();
  
  return projects
    .map(name => ({
      name,
      config: loadProjectConfig(name)
    }))
    .filter(project => project.config !== null);
}

/**
 * Calculate current Powerlevel (number of active projects)
 * @returns {number} Powerlevel score
 */
export function calculatePowerlevel() {
  return getActiveProjects().length;
}

/**
 * Get project directory path
 * @param {string} projectName - Name of the project
 * @returns {string} Path to project directory
 */
export function getProjectDir(projectName) {
  return join(getProjectsDir(), projectName);
}

/**
 * Get project plans directory path
 * @param {string} projectName - Name of the project
 * @returns {string} Path to project plans directory
 */
export function getProjectPlansDir(projectName) {
  return join(getProjectDir(projectName), 'plans');
}

/**
 * Check if a project exists
 * @param {string} projectName - Name of the project
 * @returns {boolean} True if project directory exists
 */
export function projectExists(projectName) {
  return existsSync(getProjectDir(projectName));
}

/**
 * Get project info summary
 * @param {string} projectName - Name of the project
 * @returns {Object|null} Project summary or null if not found
 */
export function getProjectInfo(projectName) {
  if (!projectExists(projectName)) {
    return null;
  }

  const config = loadProjectConfig(projectName);
  const plansDir = getProjectPlansDir(projectName);
  const hasPlanDir = existsSync(plansDir);
  
  return {
    name: projectName,
    config,
    hasPlans: hasPlanDir,
    path: getProjectDir(projectName)
  };
}
