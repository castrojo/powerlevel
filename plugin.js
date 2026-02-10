import { execSync } from 'child_process';
import { detectRepo } from './lib/repo-detector.js';
import { loadCache, saveCache, getDirtyEpics, clearDirtyFlags, getEpic } from './lib/cache-manager.js';
import { ensureLabelsExist } from './lib/label-manager.js';
import { execGh } from './lib/github-cli.js';
import { findCompletedTasks } from './lib/task-completion-detector.js';
import { recordTaskCompletion } from './lib/epic-updater.js';
import { loadConfig } from './lib/config-loader.js';
import { listProjects, calculatePowerlevel } from './lib/project-manager.js';
import { ContextProvider } from './lib/context-provider.js';

/**
 * Verifies gh CLI is installed and authenticated
 * @returns {boolean} True if gh is ready
 */
function verifyGhCli() {
  try {
    execGh('auth status');
    console.log('✓ GitHub CLI authenticated');
    return true;
  } catch (error) {
    console.error('✗ GitHub CLI not authenticated. Run: gh auth login');
    return false;
  }
}

/**
 * Syncs dirty epics to GitHub
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} cache - Cache object
 */
async function syncDirtyEpics(owner, repo, cache) {
  const dirtyEpics = getDirtyEpics(cache);
  
  if (dirtyEpics.length === 0) {
    console.log('No epics need syncing.');
    return;
  }
  
  console.log(`Syncing ${dirtyEpics.length} epic(s) to GitHub...`);
  
  const repoPath = `${owner}/${repo}`;
  
  for (const epic of dirtyEpics) {
    try {
      console.log(`  Syncing epic #${epic.number}...`);
      
      // Build task checklist
      let body = epic.goal ? `## Goal\n\n${epic.goal}\n\n` : '';
      
      if (epic.sub_issues && epic.sub_issues.length > 0) {
        body += `## Tasks\n\n`;
        epic.sub_issues.forEach(subIssue => {
          const status = subIssue.state === 'closed' ? 'x' : ' ';
          body += `- [${status}] #${subIssue.number} ${subIssue.title}\n`;
        });
      }
      
      // Update the epic issue
      execGh(`issue edit ${epic.number} --repo ${repoPath} --body "${body.replace(/"/g, '\\"')}"`);
      
      console.log(`  ✓ Synced epic #${epic.number}`);
    } catch (error) {
      console.error(`  ✗ Failed to sync epic #${epic.number}: ${error.message}`);
    }
  }
}

/**
 * Checks for completed tasks since last check and updates epics
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 */
async function checkForCompletedTasks(owner, repo, cwd) {
  try {
    // Load config to check if task completion tracking is enabled
    const config = loadConfig(cwd);
    
    if (!config.tracking.updateOnTaskComplete) {
      return;
    }
    
    const cache = loadCache(owner, repo);
    
    // Get last check time from cache (default to 1 hour ago if first run)
    const lastCheck = cache.last_task_check || new Date(Date.now() - 3600000).toISOString();
    
    console.log(`Checking for completed tasks since ${lastCheck}...`);
    
    // Find completed tasks from commits
    const completedTasks = findCompletedTasks(lastCheck, cwd);
    
    if (completedTasks.length === 0) {
      console.log('No completed tasks found.');
      cache.last_task_check = new Date().toISOString();
      saveCache(owner, repo, cache);
      return;
    }
    
    console.log(`Found ${completedTasks.length} completed task(s):`);
    
    // For each completed task, try to map to epic and record completion
    for (const task of completedTasks) {
      const { issueNumber, keyword, commit } = task;
      
      console.log(`  - Issue #${issueNumber} (${keyword}) in commit ${commit.hash.substring(0, 7)}`);
      
      // Find the issue in cache
      const issue = cache.issues?.find(i => i.number === issueNumber);
      
      if (!issue) {
        console.log(`    ⚠️  Issue #${issueNumber} not found in cache (may not be a task from an epic)`);
        continue;
      }
      
      // Find the epic this task belongs to
      const epic = cache.epics?.find(e => 
        e.sub_issues?.some(si => si.number === issueNumber)
      );
      
      if (!epic) {
        console.log(`    ⚠️  Could not find epic for issue #${issueNumber}`);
        continue;
      }
      
      // Extract task number from issue title (assumes format "Task N: Title")
      const taskMatch = issue.title?.match(/Task\s+(\d+):/i);
      if (!taskMatch) {
        console.log(`    ⚠️  Could not extract task number from issue title: ${issue.title}`);
        continue;
      }
      
      const taskNumber = parseInt(taskMatch[1], 10);
      const taskTitle = issue.title.replace(/Task\s+\d+:\s*/i, '');
      
      // Record task completion with agent info from commit
      const agentInfo = {
        name: `git-commit-${commit.hash.substring(0, 7)}`,
        id: commit.hash
      };
      
      try {
        recordTaskCompletion(epic.number, taskNumber, taskTitle, agentInfo, cwd);
        console.log(`    ✅ Recorded task ${taskNumber} completion for epic #${epic.number}`);
      } catch (error) {
        console.error(`    ✗ Failed to record completion: ${error.message}`);
      }
    }
    
    // Update last check time
    cache.last_task_check = new Date().toISOString();
    saveCache(owner, repo, cache);
    
  } catch (error) {
    console.error(`Error checking for completed tasks: ${error.message}`);
  }
}

/**
 * Land the plane - sync all dirty epics and clear flags
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 */
async function landThePlane(owner, repo, cwd) {
  try {
    console.log('🛬 Landing the plane - syncing epics to GitHub...');
    
    // First, check for completed tasks from commits
    await checkForCompletedTasks(owner, repo, cwd);
    
    // Then sync dirty epics
    const cache = loadCache(owner, repo);
    await syncDirtyEpics(owner, repo, cache);
    
    // Clear dirty flags after successful sync
    clearDirtyFlags(cache);
    saveCache(owner, repo, cache);
    
    // Calculate and display powerlevel
    const projects = listProjects(cwd);
    const powerlevel = calculatePowerlevel(projects);
    
    console.log('✓ All epics synced and flags cleared.');
    if (powerlevel > 0) {
      console.log(`✨ Powerlevel ${powerlevel} - Managing ${powerlevel} active ${powerlevel === 1 ? 'project' : 'projects'}`);
    }
  } catch (error) {
    console.error(`Error during landing: ${error.message}`);
  }
}

/**
 * Plugin initialization
 */
export async function PowerlevelPlugin({ session }) {
  console.log('Initializing Powerlevel plugin...');
  
  // Get current working directory
  const cwd = session.cwd || process.cwd();
  
  // Verify gh CLI
  if (!verifyGhCli()) {
    console.error('Powerlevel plugin disabled - gh CLI not available');
    return;
  }
  
  // Detect repository
  const repoInfo = detectRepo(cwd);
  if (!repoInfo) {
    console.error('Powerlevel plugin disabled - not in a GitHub repository');
    return;
  }
  
  const { owner, repo } = repoInfo;
  const repoPath = `${owner}/${repo}`;
  
  console.log(`✓ Detected repository: ${repoPath}`);
  
  // Ensure labels exist
  try {
    await ensureLabelsExist(repoPath);
    console.log('✓ Labels verified');
  } catch (error) {
    console.error(`Warning: Failed to verify labels: ${error.message}`);
  }
  
  // Initialize context provider for epic detection
  const contextProvider = new ContextProvider();
  
  // Expose context API to OpenCode
  if (session && session.context) {
    session.context.getEpic = () => {
      return {
        display: contextProvider.getDisplayString(cwd),
        url: contextProvider.getEpicUrl(cwd),
        raw: contextProvider.getContext(cwd)
      };
    };
    
    console.log('✓ Epic context API exposed to session.context.getEpic()');
    
    // Log current epic if detected
    const epicContext = contextProvider.getContext(cwd);
    if (epicContext) {
      console.log(`📌 Current Epic: #${epicContext.epicNumber} - ${epicContext.epicTitle}`);
      console.log(`   Plan: ${epicContext.planFile}`);
      console.log(`   URL: ${contextProvider.getEpicUrl(cwd)}`);
    }
  }
  
  // Hook into session.idle event
  if (session && session.on) {
    session.on('idle', async () => {
      await landThePlane(owner, repo, cwd);
    });
    console.log('✓ Hooked into session.idle event');
    
    // Hook into file change events to invalidate cache
    session.on('file:change', (event) => {
      if (event.path && event.path.includes('docs/plans/')) {
        contextProvider.invalidateCache(cwd);
        console.log('↻ Epic context cache invalidated (plan file changed)');
      }
    });
  } else {
    console.warn('Warning: Session does not support event hooks');
  }
  
  console.log('✓ Powerlevel plugin initialized successfully');
}

export default PowerlevelPlugin;
