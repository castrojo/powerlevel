import { detectRepo } from './lib/repo-detector.js';
import { loadCache, saveCache, getDirtyEpics, clearDirtyFlags, updateTrackedItems } from './lib/cache-manager.js';
import { ensureLabelsExist } from './lib/label-manager.js';
import { execGh } from './lib/github-cli.js';
import { findCompletedTasks } from './lib/task-completion-detector.js';
import { recordTaskCompletion } from './lib/epic-updater.js';
import { loadConfig } from './lib/config-loader.js';
import { listProjects, calculatePowerlevel } from './lib/project-manager.js';
import { ContextProvider } from './lib/context-provider.js';
import { isExternalTrackingEpic, syncExternalEpic } from './lib/external-tracker.js';
import { getRankForPowerlevel } from './lib/destiny-ranks.js';
import { logInfo, logWarn, logError, logDebug } from './lib/logger.js';

/**
 * Verifies gh CLI is installed and authenticated
 * @param {Object} client - OpenCode SDK client
 * @returns {boolean} True if gh is ready
 */
function verifyGhCli(client) {
  try {
    execGh('auth status');
    logInfo(client, '✓ GitHub CLI authenticated');
    return true;
  } catch (error) {
    logError(client, '✗ GitHub CLI not authenticated. Run: gh auth login');
    return false;
  }
}

/**
 * Syncs dirty epics to GitHub
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} cache - Cache object
 * @param {Object} client - OpenCode SDK client
 */
async function syncDirtyEpics(owner, repo, cache, client) {
  const dirtyEpics = getDirtyEpics(cache);

  if (dirtyEpics.length === 0) {
    logInfo(client, 'No epics need syncing.');
    return;
  }

  logInfo(client, `Syncing ${dirtyEpics.length} epic(s) to GitHub...`);

  const repoPath = `${owner}/${repo}`;

  for (const epic of dirtyEpics) {
    try {
      logInfo(client, `  Syncing epic #${epic.number}...`);

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

      logInfo(client, `  ✓ Synced epic #${epic.number}`);
    } catch (error) {
      logError(client, `  ✗ Failed to sync epic #${epic.number}: ${error.message}`);
    }
  }
}

/**
 * Checks for completed tasks since last check and updates epics
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 * @param {Object} client - OpenCode SDK client
 */
async function checkForCompletedTasks(owner, repo, cwd, client) {
  try {
    // Load config to check if task completion tracking is enabled
    const config = loadConfig(cwd);

    if (!config.tracking.updateOnTaskComplete) {
      return;
    }

    const cache = loadCache(owner, repo);

    // Get last check time from cache (default to 1 hour ago if first run)
    const lastCheck = cache.last_task_check || new Date(Date.now() - 3600000).toISOString();

    logInfo(client, `Checking for completed tasks since ${lastCheck}...`);

    // Find completed tasks from commits
    const completedTasks = findCompletedTasks(lastCheck, cwd);

    if (completedTasks.length === 0) {
      logInfo(client, 'No completed tasks found.');
      cache.last_task_check = new Date().toISOString();
      saveCache(owner, repo, cache);
      return;
    }

    logInfo(client, `Found ${completedTasks.length} completed task(s):`);

    // For each completed task, try to map to epic and record completion
    for (const task of completedTasks) {
      const { issueNumber, keyword, commit } = task;

      logInfo(client, `  - Issue #${issueNumber} (${keyword}) in commit ${commit.hash.substring(0, 7)}`);

      // Find the issue in cache
      const issue = cache.issues?.find(i => i.number === issueNumber);

      if (!issue) {
        logWarn(client, `    ⚠️  Issue #${issueNumber} not found in cache (may not be a task from an epic)`);
        continue;
      }

      // Find the epic this task belongs to
      const epic = cache.epics?.find(e =>
        e.sub_issues?.some(si => si.number === issueNumber)
      );

      if (!epic) {
        logWarn(client, `    ⚠️  Could not find epic for issue #${issueNumber}`);
        continue;
      }

      // Extract task number from issue title (assumes format "Task N: Title")
      const taskMatch = issue.title?.match(/Task\s+(\d+):/i);
      if (!taskMatch) {
        logWarn(client, `    ⚠️  Could not extract task number from issue title: ${issue.title}`);
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
        logInfo(client, `    ✅ Recorded task ${taskNumber} completion for epic #${epic.number}`);
      } catch (error) {
        logError(client, `    ✗ Failed to record completion: ${error.message}`);
      }
    }

    // Update last check time
    cache.last_task_check = new Date().toISOString();
    saveCache(owner, repo, cache);

  } catch (error) {
    logError(client, `Error checking for completed tasks: ${error.message}`);
  }
}

/**
 * Land the plane - sync all dirty epics and clear flags
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 * @param {Object} client - OpenCode SDK client
 */
async function landThePlane(owner, repo, cwd, client) {
  try {
    logInfo(client, '🛬 Landing the plane - syncing epics to GitHub...');

    // First, check for completed tasks from commits
    await checkForCompletedTasks(owner, repo, cwd, client);

    // Then sync dirty epics
    const cache = loadCache(owner, repo);
    await syncDirtyEpics(owner, repo, cache, client);

    // Clear dirty flags after successful sync
    clearDirtyFlags(cache);
    saveCache(owner, repo, cache);

    // Calculate and display powerlevel
    const projects = listProjects(cwd, client);
    const powerlevel = calculatePowerlevel(projects);

    logInfo(client, '✓ All epics synced and flags cleared.');
    client.tui.showToast({ body: { message: '✓ All epics synced', variant: 'success' } });

    if (powerlevel > 0) {
      const rank = getRankForPowerlevel(powerlevel);
      logInfo(client, `✨ Powerlevel ${powerlevel} ~ ${rank.title}`);
    }
  } catch (error) {
    logError(client, `Error during landing: ${error.message}`);
  }
}

/**
 * Syncs external tracking epics with their external repositories
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 * @param {Object} client - OpenCode SDK client
 */
async function syncExternalProjects(owner, repo, cwd, client) {
  try {
    const cache = loadCache(owner, repo);
    const projects = listProjects(cwd, client);
    const repoPath = `${owner}/${repo}`;

    logInfo(client, 'Syncing external project tracking epics...');

    for (const epic of cache.epics) {
      if (isExternalTrackingEpic(epic)) {
        // Find project config by matching label
        const projectLabel = epic.labels.find(l => l.startsWith('project/'));
        if (!projectLabel) continue;

        const projectName = projectLabel.replace('project/', '');
        const project = projects.find(p => p.name === projectName);

        if (!project || !project.repo) {
          logWarn(client, `⚠ Skip Epic #${epic.number}: No project config found for ${projectName}`);
          continue;
        }

        // Sync epic with external repo
        const result = await syncExternalEpic(
          repoPath,
          epic.number,
          project.repo,
          project.description || 'No description',
          client
        );

        if (result.synced) {
          // Update cache with tracked items
          updateTrackedItems(cache, epic.number, result.issueCount);
        }
      }
    }

    // Save updated cache
    saveCache(owner, repo, cache);
    logInfo(client, '✓ External project sync complete');
  } catch (error) {
    logError(client, `Error syncing external projects: ${error.message}`);
  }
}

/**
 * Powerlevel plugin for OpenCode
 * @param {Object} context - OpenCode plugin context
 * @param {Object} context.client - OpenCode SDK client
 * @param {string} context.directory - Current working directory
 * @param {string} context.worktree - Git worktree path
 */
export async function PowerlevelPlugin({ client, directory, worktree }) {
  try {
    logInfo(client, 'Initializing Powerlevel plugin...');

    // Get current working directory from plugin context
    const cwd = directory;

    // Verify gh CLI
    if (!verifyGhCli(client)) {
      logError(client, 'Powerlevel plugin disabled - gh CLI not available');
      return {};
    }

    // Detect repository
    const repoInfo = detectRepo(cwd, client);
    if (!repoInfo) {
      logError(client, 'Powerlevel plugin disabled - not in a GitHub repository');
      return {};
    }

    const { owner, repo } = repoInfo;
    const repoPath = `${owner}/${repo}`;

    logInfo(client, `✓ Detected repository: ${repoPath}`);

    // Ensure labels exist
    try {
      await ensureLabelsExist(repoPath);
      logInfo(client, '✓ Labels verified');
    } catch (error) {
      logWarn(client, `Warning: Failed to verify labels: ${error.message}`);
    }

    // Sync external tracking epics (Option B: Session start sync)
    await syncExternalProjects(owner, repo, cwd, client);

    // Initialize context provider for epic detection
    const contextProvider = new ContextProvider();

    // Calculate and display powerlevel
    const projects = listProjects(cwd, client);
    const powerlevel = calculatePowerlevel(projects);

    if (powerlevel > 0) {
      const rank = getRankForPowerlevel(powerlevel);
      logInfo(client, `✨ Powerlevel ${powerlevel} ~ ${rank.title}`);
      client.tui.showToast({ body: { message: `Powerlevel ${powerlevel} ~ ${rank.title}`, variant: 'success' } });
    }

    // Log current epic if detected
    const epicContext = contextProvider.getContext(cwd);
    if (epicContext) {
      logInfo(client, `📌 Current Epic: #${epicContext.epicNumber} - ${epicContext.epicTitle}`);
      logInfo(client, `   Plan: ${epicContext.planFile}`);
      logInfo(client, `   URL: ${contextProvider.getEpicUrl(cwd)}`);
      client.tui.showToast({ body: { message: `Epic #${epicContext.epicNumber} - ${epicContext.epicTitle}`, variant: 'info' } });
    }

    logInfo(client, '✓ Powerlevel plugin initialized successfully');

    // Return proper hooks object
    return {
      'session.idle': async () => {
        await landThePlane(owner, repo, cwd, client);
      },
      'file.edited': async (input, output) => {
        // Check if plan file was edited, invalidate cache
        if (input.file && input.file.includes('docs/plans/')) {
          contextProvider.invalidateCache(cwd);
          logDebug(client, 'Epic context cache invalidated (plan file changed)');
        }
      }
    };
  } catch (error) {
    // Wrap entire init in try/catch so plugin errors don't crash OpenCode
    logError(client, `Powerlevel plugin failed to initialize: ${error.message}`);
    return {};
  }
}

export default PowerlevelPlugin;
