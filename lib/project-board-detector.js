import { execGh } from './github-cli.js';

/**
 * Detect the default project board for a user/org
 * Returns the first active project board
 * @param {string} owner - GitHub username or organization name
 * @returns {Object|null} Project board object with id, number, title, owner, url, and detected_at, or null if not found
 */
export function detectProjectBoard(owner) {
  try {
    const projectsJson = execGh(`project list --owner ${owner} --format json`);
    const projects = JSON.parse(projectsJson);
    
    if (!projects.projects || projects.projects.length === 0) {
      return null;
    }
    
    const firstProject = projects.projects[0];
    
    if (!firstProject.url) {
      throw new Error(`Project board #${firstProject.number} missing URL field from GitHub API`);
    }
    
    return {
      id: firstProject.id,
      number: firstProject.number,
      title: firstProject.title,
      owner: owner,
      url: firstProject.url,
      detected_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to detect project board: ${error.message}`);
    return null;
  }
}

/**
 * Get a specific project board by number
 * @param {string} owner - GitHub username or organization name
 * @param {number} projectNumber - Project board number
 * @returns {Object|null} Project board object with id, number, title, owner, url, and detected_at, or null if not found
 */
export function getProjectBoard(owner, projectNumber) {
  try {
    const projectsJson = execGh(`project list --owner ${owner} --format json`);
    const projects = JSON.parse(projectsJson);
    
    if (!projects.projects) {
      return null;
    }
    
    const project = projects.projects.find(p => p.number === projectNumber);
    
    if (!project) {
      return null;
    }
    
    if (!project.url) {
      throw new Error(`Project board #${project.number} missing URL field from GitHub API`);
    }
    
    return {
      id: project.id,
      number: project.number,
      title: project.title,
      owner: owner,
      url: project.url,
      detected_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to get project board: ${error.message}`);
    return null;
  }
}
