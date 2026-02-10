import { execGh } from './github-cli.js';

/**
 * Detect the default project board for a user/org
 * Returns the first active project board
 */
export function detectProjectBoard(owner) {
  try {
    const projectsJson = execGh(`project list --owner ${owner} --format json`);
    const projects = JSON.parse(projectsJson);
    
    if (!projects.projects || projects.projects.length === 0) {
      return null;
    }
    
    const firstProject = projects.projects[0];
    
    return {
      id: firstProject.id,
      number: firstProject.number,
      title: firstProject.title,
      owner: owner,
      url: firstProject.url || `https://github.com/users/${owner}/projects/${firstProject.number}`,
      detected_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to detect project board: ${error.message}`);
    return null;
  }
}

/**
 * Get a specific project board by number
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
    
    return {
      id: project.id,
      number: project.number,
      title: project.title,
      owner: owner,
      url: project.url || `https://github.com/users/${owner}/projects/${project.number}`,
      detected_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Failed to get project board: ${error.message}`);
    return null;
  }
}
