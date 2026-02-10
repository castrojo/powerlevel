#!/usr/bin/env node

import { readFileSync, appendFileSync } from 'fs';
import { resolve } from 'path';
import { detectRepo } from '../lib/repo-detector.js';
import { loadCache, saveCache, addEpic, addSubIssue } from '../lib/cache-manager.js';
import { parsePlanFile, formatEpicBody } from '../lib/parser.js';
import { createEpic, createSubIssue } from '../lib/github-cli.js';
import { getEpicLabels, getTaskLabels, ensureEpicLabel, ensureLabelsExist } from '../lib/label-manager.js';
import { execGh } from '../lib/github-cli.js';
import { detectProjectBoard } from '../lib/project-board-detector.js';
import { getProjectFields, mapLabelToField } from '../lib/project-field-manager.js';
import { addIssueToProject, updateProjectItemField, getIssueNodeId } from '../lib/project-item-manager.js';
import { getCachedProjectBoard, cacheProjectBoard } from '../lib/cache-manager.js';
import { loadConfig, getProjectBoardConfig, getProjectBoardConfigFromEnv } from '../lib/config-loader.js';

/**
 * Main function to create an epic from a plan file
 */
async function main() {
  // Get plan file from command line arguments
  const planFile = process.argv[2];
  
  if (!planFile) {
    console.error('Usage: node bin/create-epic.js <plan-file>');
    console.error('Example: node bin/create-epic.js docs/plans/my-feature.md');
    process.exit(1);
  }
  
  const planPath = resolve(planFile);
  
  // Detect repository
  const repoInfo = detectRepo();
  if (!repoInfo) {
    console.error('Error: Not in a GitHub repository');
    process.exit(1);
  }
  
  const { owner, repo } = repoInfo;
  const repoPath = `${owner}/${repo}`;
  
  console.log(`Repository: ${repoPath}`);
  console.log(`Plan file: ${planPath}`);
  console.log('');
  
  // Verify gh CLI
  try {
    execGh('auth status');
  } catch (error) {
    console.error('Error: GitHub CLI not authenticated. Run: gh auth login');
    process.exit(1);
  }
  
  // Ensure labels exist
  console.log('Ensuring required labels exist...');
  try {
    await ensureLabelsExist(repoPath);
    console.log('');
  } catch (error) {
    console.error(`Warning: Failed to create labels: ${error.message}`);
    console.log('Continuing anyway...');
    console.log('');
  }
  
  // Parse plan file
  console.log('Parsing plan file...');
  let plan;
  try {
    plan = parsePlanFile(planPath);
  } catch (error) {
    console.error(`Error parsing plan file: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`  Title: ${plan.title}`);
  console.log(`  Priority: ${plan.priority}`);
  console.log(`  Tasks: ${plan.tasks.length}`);
  console.log('');
  
  // Create epic on GitHub
  console.log('Creating epic on GitHub...');
  const epicBody = formatEpicBody(plan);
  const epicLabels = getEpicLabels(plan.priority);
  
  let epicNumber;
  try {
    epicNumber = createEpic(repoPath, plan.title, epicBody, epicLabels);
    console.log(`  ✓ Created epic #${epicNumber}`);
    console.log(`  URL: https://github.com/${repoPath}/issues/${epicNumber}`);
  } catch (error) {
    console.error(`  ✗ Failed to create epic: ${error.message}`);
    process.exit(1);
  }
  
  // Ensure epic label exists
  ensureEpicLabel(repoPath, epicNumber);
  
  // Load cache
  const cache = loadCache(owner, repo);
  
  // Add epic to cache
  addEpic(cache, {
    number: epicNumber,
    title: plan.title,
    goal: plan.goal,
    priority: plan.priority,
    state: 'open',
    dirty: false,
    sub_issues: []
  });
  
  // Create sub-issues for each task
  if (plan.tasks.length > 0) {
    console.log('');
    console.log(`Creating ${plan.tasks.length} sub-issue(s)...`);
    
    for (let i = 0; i < plan.tasks.length; i++) {
      const task = plan.tasks[i];
      const taskLabels = getTaskLabels(epicNumber, plan.priority);
      
      try {
        const subIssueNumber = createSubIssue(
          repoPath,
          task,
          `Task ${i + 1} of ${plan.tasks.length}`,
          taskLabels,
          epicNumber
        );
        
        console.log(`  ✓ Created sub-issue #${subIssueNumber}: ${task}`);
        
        // Add to cache
        addSubIssue(cache, epicNumber, {
          number: subIssueNumber,
          title: task,
          state: 'open',
          epic_number: epicNumber
        });
      } catch (error) {
        console.error(`  ✗ Failed to create sub-issue: ${error.message}`);
      }
    }
  }
  
  // Save cache
  saveCache(owner, repo, cache);
  console.log('');
  console.log('✓ Cache updated');
  
  // Load project board configuration
  const fileConfig = loadConfig();
  const envConfig = getProjectBoardConfigFromEnv();
  const projectConfig = {
    ...getProjectBoardConfig(fileConfig),
    ...envConfig
  };
  
  if (!projectConfig.enabled) {
    console.log('');
    console.log('⚠ Project board integration disabled via configuration');
  } else {
    // Add epic to project board with field mapping
    console.log('');
    console.log('Adding epic to project board...');
  
  try {
    // Try to get cached project board first
    let projectBoard = getCachedProjectBoard(cache);
    
    // If not cached, detect it
    if (!projectBoard) {
      projectBoard = detectProjectBoard(owner);
      
      if (projectBoard) {
        cacheProjectBoard(cache, projectBoard);
        saveCache(owner, repo, cache);
      }
    }
    
    if (!projectBoard) {
      console.log('  ⚠ No project board found, skipping');
    } else {
      console.log(`  Using project: ${projectBoard.title}`);
      
      // Get issue node ID
      const issueNodeId = getIssueNodeId(repoPath, epicNumber);
      if (!issueNodeId) {
        throw new Error('Failed to get issue node ID');
      }
      
      // Add epic to project
      const itemId = addIssueToProject(projectBoard.id, issueNodeId);
      
      if (itemId) {
        console.log(`  ✓ Added epic to project board`);
        
        // Get project fields
        const projectFields = getProjectFields(owner, projectBoard.number);
        
        if (projectFields) {
          // Map priority label to field
          const priorityLabel = `priority/${plan.priority}`;
          const priorityMapping = mapLabelToField(priorityLabel, projectFields);
          
          if (priorityMapping) {
            const success = updateProjectItemField(
              projectBoard.id,
              itemId,
              priorityMapping.fieldId,
              priorityMapping.optionId
            );
            
            if (success) {
              console.log(`  ✓ Set Priority: ${priorityMapping.optionName}`);
            }
          }
          
          // Map status label to field
          const statusMapping = mapLabelToField('status/planning', projectFields);
          
          if (statusMapping) {
            const success = updateProjectItemField(
              projectBoard.id,
              itemId,
              statusMapping.fieldId,
              statusMapping.optionId
            );
            
            if (success) {
              console.log(`  ✓ Set Status: ${statusMapping.optionName}`);
            }
          }
        }
      }
      
      // Add sub-issues to project board
      if (cache.epics && plan.tasks.length > 0) {
        console.log('');
        console.log('Adding sub-issues to project board...');
        
        const projectFields = getProjectFields(owner, projectBoard.number);
        
        // Find the epic in cache
        const cachedEpic = cache.epics.find(e => e.number === epicNumber);
        
        if (cachedEpic && cachedEpic.sub_issues) {
          for (const subIssue of cachedEpic.sub_issues) {
            try {
              const subIssueNodeId = getIssueNodeId(repoPath, subIssue.number);
              if (!subIssueNodeId) {
                console.log(`  ⚠ Could not get node ID for #${subIssue.number}`);
                continue;
              }
              
              const subItemId = addIssueToProject(projectBoard.id, subIssueNodeId);
              
              if (subItemId && projectFields) {
                // Set priority field
                const priorityLabel = `priority/${plan.priority}`;
                const priorityMapping = mapLabelToField(priorityLabel, projectFields);
                
                if (priorityMapping) {
                  updateProjectItemField(
                    projectBoard.id,
                    subItemId,
                    priorityMapping.fieldId,
                    priorityMapping.optionId
                  );
                }
                
                // Set status field
                const statusMapping = mapLabelToField('status/planning', projectFields);
                
                if (statusMapping) {
                  updateProjectItemField(
                    projectBoard.id,
                    subItemId,
                    statusMapping.fieldId,
                    statusMapping.optionId
                  );
                }
                
                console.log(`  ✓ Added #${subIssue.number} to project`);
              }
            } catch (error) {
              console.log(`  ⚠ Failed to add #${subIssue.number}: ${error.message}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error(`  ✗ Failed to add to project board: ${error.message}`);
    console.log(`  (Epic creation succeeded - project board is optional)`);
  }
  }
  
  // Append epic reference to plan file
  console.log('');
  console.log('Updating plan file...');
  try {
    const epicReference = `\n\n---\n\n**Epic:** #${epicNumber} (https://github.com/${repoPath}/issues/${epicNumber})\n`;
    appendFileSync(planPath, epicReference, 'utf8');
    console.log('  ✓ Added epic reference to plan file');
  } catch (error) {
    console.error(`  ✗ Failed to update plan file: ${error.message}`);
  }
  
  console.log('');
  console.log('✅ Epic creation complete!');
  console.log(`View epic: https://github.com/${repoPath}/issues/${epicNumber}`);
}

// Run main function
main().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
