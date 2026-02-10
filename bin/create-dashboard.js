#!/usr/bin/env node

/**
 * Powerlevel Dashboard Creator
 * 
 * Creates the central "Powerlevel N" project board for tracking all projects.
 */

import { execSync } from 'child_process';
import { listProjects, calculatePowerlevel } from '../lib/project-manager.js';

function execGh(command) {
  try {
    return execSync(`gh ${command}`, { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`gh command failed: ${error.message}`);
  }
}

function createDashboard() {
  console.log('🚀 Creating Powerlevel dashboard...');
  
  // Calculate current powerlevel
  const projects = listProjects(process.cwd());
  const powerlevel = calculatePowerlevel(projects);
  
  const boardTitle = `Powerlevel ${powerlevel}`;
  const boardDescription = `Central dashboard tracking ${powerlevel} active ${powerlevel === 1 ? 'project' : 'projects'}. Eyes up, Guardian.`;
  
  try {
    // Create the project board
    const result = execGh(`project create --title "${boardTitle}" --body "${boardDescription}"`);
    
    // Extract project number from result
    const match = result.match(/projects\\/(\\d+)/);
    const projectNumber = match ? match[1] : 'unknown';
    
    console.log(`✅ Dashboard created: ${boardTitle}`);
    console.log(`📊 Project board: https://github.com/users/YOUR_USERNAME/projects/${projectNumber}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Open the project board URL above');
    console.log('2. Configure views (Table, Board, Roadmap)');
    console.log('3. Add fields: Status, Priority, Project');
    console.log('4. Create filters for each tracked project');
    
    return projectNumber;
  } catch (error) {
    console.error(`❌ Failed to create dashboard: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createDashboard();
}

export { createDashboard };
