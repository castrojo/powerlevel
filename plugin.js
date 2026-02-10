import { execSync, execFileSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { detectRepo } from './lib/repo-detector.js';
import { loadCache, saveCache, getDirtyEpics, clearDirtyFlags, getEpic } from './lib/cache-manager.js';
import { ensureLabelsExist } from './lib/label-manager.js';
import { execGh } from './lib/github-cli.js';
import { findCompletedTasks } from './lib/task-completion-detector.js';
import { recordTaskCompletion } from './lib/epic-updater.js';
import { loadConfig } from './lib/config-loader.js';
import { listProjects, calculatePowerlevel } from './lib/project-manager.js';
import { wikiExists, cloneWiki, getWikiCacheDir } from './lib/wiki-manager.js';
import { getOnboardingStatus, promptOnboarding } from './lib/onboarding-check.js';
import { detectEpicFromBranch, getEpicDetails, formatEpicTitle } from './lib/epic-detector.js';
import { updateSessionTitle } from './lib/session-title-updater.js';

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
 * Checks if wiki cache needs refreshing based on TTL
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {number} ttlHours - Time-to-live in hours (default: 1)
 * @returns {boolean} True if cache should be refreshed
 */
function shouldRefreshWiki(owner, repo, ttlHours = 1) {
  try {
    const cacheDir = getWikiCacheDir(owner, repo);
    const lastFetchFile = join(cacheDir, '.last_fetch');
    
    if (!existsSync(lastFetchFile)) {
      return true;
    }
    
    const lastFetchStr = readFileSync(lastFetchFile, 'utf8').trim();
    const lastFetch = new Date(lastFetchStr);
    
    if (isNaN(lastFetch.getTime())) {
      // Invalid date format, refresh
      return true;
    }
    
    const now = new Date();
    const hoursSinceLastFetch = (now - lastFetch) / (1000 * 60 * 60);
    
    return hoursSinceLastFetch > ttlHours;
  } catch (error) {
    // If we can't read the cache, assume we need to refresh
    return true;
  }
}

/**
 * Updates the last fetch timestamp for wiki cache
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 */
function updateWikiTimestamp(owner, repo) {
  try {
    const cacheDir = getWikiCacheDir(owner, repo);
    
    // Ensure cache directory exists
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    
    const lastFetchFile = join(cacheDir, '.last_fetch');
    const now = new Date().toISOString();
    writeFileSync(lastFetchFile, now, 'utf8');
  } catch (error) {
    // Non-critical - log but don't throw
    console.debug(`Could not update wiki timestamp: ${error.message}`);
  }
}

/**
 * Fetches and caches superpowers wiki content
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} config - Configuration object
 */
async function fetchSuperpowersWiki(owner, repo, config) {
  try {
    // Check if we should fetch the wiki
    if (!config.superpowers.wikiSync) {
      console.debug('Wiki sync disabled in config (superpowers.wikiSync = false)');
      return;
    }
    
    // Extract superpowers owner/repo from config URL
    const superpowersRepoUrl = config.superpowers.repoUrl;
    if (!superpowersRepoUrl) {
      console.debug('No superpowers repo URL configured, skipping wiki fetch');
      return;
    }
    
    // Parse owner/repo from git URL
    let superpowersOwner, superpowersRepo;
    const httpsMatch = superpowersRepoUrl.match(/https:\/\/github\.com\/([^\/]+)\/([^\/\.]+)/);
    const sshMatch = superpowersRepoUrl.match(/git@github\.com:([^\/]+)\/([^\/\.]+)/);
    
    if (httpsMatch) {
      superpowersOwner = httpsMatch[1];
      superpowersRepo = httpsMatch[2];
    } else if (sshMatch) {
      superpowersOwner = sshMatch[1];
      superpowersRepo = sshMatch[2];
    } else {
      console.debug('Could not parse superpowers repo URL, skipping wiki fetch');
      return;
    }
    
    // Check cache TTL
    if (!shouldRefreshWiki(superpowersOwner, superpowersRepo)) {
      console.debug('Wiki cache is still fresh, skipping fetch');
      return;
    }
    
    console.log('📚 Fetching superpowers wiki documentation...');
    
    // Check if wiki exists
    if (!wikiExists(superpowersOwner, superpowersRepo)) {
      console.warn('⚠️  Superpowers wiki not found or not accessible');
      return;
    }
    
    // Clone/update wiki
    await cloneWiki(superpowersOwner, superpowersRepo);
    
    // Update timestamp
    updateWikiTimestamp(superpowersOwner, superpowersRepo);
    
    console.log('✓ Wiki documentation available locally');
  } catch (error) {
    // Non-fatal - log warning but don't crash plugin
    console.warn(`⚠️  Failed to fetch wiki: ${error.message}`);
    console.debug('Plugin will continue without wiki cache');
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
 * Handles session.created event - sets initial multi-line title
 * @param {Object} sessionInfo - Session info from event
 * @param {Object} client - OpenCode SDK client
 * @param {string} cwd - Current working directory
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 */
async function handleSessionCreated(sessionInfo, client, cwd, owner, repo) {
  try {
    const epicNumber = detectEpicFromBranch(cwd);
    if (!epicNumber) {
      console.debug('No epic detected from branch name');
      return;
    }
    
    const epic = getEpicDetails(epicNumber, owner, repo);
    if (!epic) {
      console.warn(`Epic #${epicNumber} not found in cache`);
      return;
    }
    
    // Format as multi-line title
    const title = formatEpicTitle(epic, {
      showProgress: true,
      includeDescription: true,
      maxDescriptionLength: 150
    });
    
    const success = await updateSessionTitle(client, sessionInfo.id, title);
    if (success) {
      console.log(`✓ Session title set for Epic #${epicNumber}`);
      console.debug(`Title:\n${title}`);
    }
  } catch (error) {
    console.debug(`Could not set session title: ${error.message}`);
  }
}

/**
 * Handles session.idle event - updates title with latest status
 * @param {string} sessionID - Session ID from event
 * @param {Object} client - OpenCode SDK client
 * @param {string} cwd - Current working directory
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 */
async function handleSessionIdle(sessionID, client, cwd, owner, repo) {
  try {
    // First run existing "land the plane" logic
    await landThePlane(owner, repo, cwd);
    
    // Then update session title with refreshed epic data
    const epicNumber = detectEpicFromBranch(cwd);
    if (!epicNumber) return;
    
    // Reload cache (may have been updated by landThePlane)
    const epic = getEpicDetails(epicNumber, owner, repo);
    if (!epic) return;
    
    const title = formatEpicTitle(epic, {
      showProgress: true,
      includeDescription: true,
      maxDescriptionLength: 150
    });
    
    await updateSessionTitle(client, sessionID, title);
    console.debug(`✓ Session title refreshed for Epic #${epicNumber}`);
  } catch (error) {
    console.debug(`Could not update session title: ${error.message}`);
  }
}

/**
 * Plugin initialization
 */
export async function PowerlevelPlugin({ client, session, directory, worktree }) {
  console.log('Initializing Powerlevel plugin...');
  
  // Get current working directory
  const cwd = directory || process.cwd();
  
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
  
  // Load configuration
  let config;
  try {
    config = loadConfig(cwd);
  } catch (error) {
    console.warn(`Warning: Could not load config: ${error.message}`);
    console.warn('Using default configuration');
    // Use minimal default config
    config = {
      superpowers: { wikiSync: false, repoUrl: '', autoOnboard: true },
      wiki: { autoSync: false },
      tracking: { updateOnTaskComplete: false }
    };
  }
  
  // Check onboarding status (respects autoOnboard setting)
  if (config.superpowers?.autoOnboard !== false) {
    const status = getOnboardingStatus(cwd);
    if (!status.onboarded && !session._powerlevel_onboarding_prompted) {
      promptOnboarding(session);
      // Store flag to avoid repeating in the same session
      session._powerlevel_onboarding_prompted = true;
    }
  }
  
  // Ensure labels exist
  try {
    await ensureLabelsExist(repoPath);
    console.log('✓ Labels verified');
  } catch (error) {
    console.error(`Warning: Failed to verify labels: ${error.message}`);
  }
  
  // Fetch superpowers wiki (non-blocking)
  await fetchSuperpowersWiki(owner, repo, config);
  
  // Register /wiki-sync slash command
  if (session && typeof session.registerCommand === 'function') {
    session.registerCommand({
      name: 'wiki-sync',
      description: 'Sync skills and docs to GitHub wiki',
      async handler(args) {
        console.log('Running wiki sync...');
        try {
          const scriptPath = join(dirname(new URL(import.meta.url).pathname), 'bin', 'sync-wiki.js');
          const output = execFileSync(
            'node',
            [scriptPath, ...args],
            { cwd, encoding: 'utf8', stdio: 'pipe' }
          );
          console.log(output);
        } catch (error) {
          console.error('Wiki sync failed:', error.message);
          if (error.stdout) console.log(error.stdout);
          if (error.stderr) console.error(error.stderr);
        }
      }
    });
    console.log('✓ Registered /wiki-sync command');
  }
  
  // Hook into session.idle event (legacy session API)
  if (session && session.on) {
    session.on('idle', async () => {
      await landThePlane(owner, repo, cwd);
    });
    console.log('✓ Hooked into session.idle event');
  } else {
    console.warn('Warning: Session does not support event hooks');
  }
  
  console.log('✓ Powerlevel plugin initialized successfully');
  
  // Return plugin hooks for OpenCode plugin API
  return {
    // Hook into all events
    event: async ({ event }) => {
      // Update title when session is created
      if (event.type === 'session.created') {
        await handleSessionCreated(event.properties.info, client, cwd, owner, repo);
      }
      
      // Update title when session goes idle (after landing the plane)
      if (event.type === 'session.idle') {
        await handleSessionIdle(event.properties.sessionID, client, cwd, owner, repo);
      }
    },
    
    // Inject epic context during compaction
    'experimental.session.compacting': async (input, output) => {
      try {
        const epicNumber = detectEpicFromBranch(cwd);
        if (epicNumber) {
          const epic = getEpicDetails(epicNumber, owner, repo);
          if (epic) {
            output.context.push(
              `## Active Epic: #${epic.number}\n\n` +
              `**Title:** ${epic.title}\n` +
              `**Goal:** ${epic.goal || 'Goal undefined'}\n\n` +
              `Continue working on this epic's tasks.`
            );
          }
        }
      } catch (error) {
        console.debug(`Could not inject epic context: ${error.message}`);
      }
    }
  };
}

export default PowerlevelPlugin;
