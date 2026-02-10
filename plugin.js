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
import { registerSessionHooks } from './lib/session-hooks.js';

/**
 * Converts numbers to words (0-20, then tens)
 * Falls back to numerals for numbers > 100
 * @param {number} num - Number to convert
 * @returns {string} Word representation or numeral
 */
function numberToWord(num) {
  const words = {
    0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four',
    5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
    10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen',
    15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen',
    20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty',
    60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety'
  };
  
  if (num <= 20) return words[num];
  if (num < 100) {
    const tens = Math.floor(num / 10) * 10;
    const ones = num % 10;
    return ones === 0 ? words[tens] : `${words[tens]}-${words[ones]}`;
  }
  return num.toString(); // Fallback to numeral for large numbers
}

/**
 * Verifies gh CLI is installed and authenticated
 * @returns {boolean} True if gh is ready
 */
function verifyGhCli(client = null) {
  try {
    execGh('auth status');
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: '✓ GitHub CLI authenticated' }
      });
    }
    return true;
  } catch (error) {
    // Early error - client not available yet
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
function updateWikiTimestamp(owner, repo, client = null) {
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
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'debug', message: `Could not update wiki timestamp: ${error.message}` }
      });
    }
  }
}

/**
 * Fetches and caches superpowers wiki content
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} config - Configuration object
 */
async function fetchSuperpowersWiki(owner, repo, config, client = null) {
  try {
    // Check if we should fetch the wiki
    if (!config.superpowers.wikiSync) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'debug', message: 'Wiki sync disabled in config (superpowers.wikiSync = false)' }
        });
      }
      return;
    }
    
    // Extract superpowers owner/repo from config URL
    const superpowersRepoUrl = config.superpowers.repoUrl;
    if (!superpowersRepoUrl) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'debug', message: 'No superpowers repo URL configured, skipping wiki fetch' }
        });
      }
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
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'debug', message: 'Could not parse superpowers repo URL, skipping wiki fetch' }
        });
      }
      return;
    }
    
    // Check cache TTL
    if (!shouldRefreshWiki(superpowersOwner, superpowersRepo)) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'debug', message: 'Wiki cache is still fresh, skipping fetch' }
        });
      }
      return;
    }
    
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: '📚 Fetching superpowers wiki documentation...' }
      });
    }
    
    // Check if wiki exists
    if (!wikiExists(superpowersOwner, superpowersRepo, client)) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'warn', message: '⚠️  Superpowers wiki not found or not accessible' }
        });
      }
      return;
    }
    
    // Clone/update wiki
    await cloneWiki(superpowersOwner, superpowersRepo, client);
    
    // Update timestamp
    updateWikiTimestamp(superpowersOwner, superpowersRepo, client);
    
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: '✓ Wiki documentation available locally' }
      });
    }
  } catch (error) {
    // Non-fatal - log warning but don't crash plugin
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'warn', message: `⚠️  Failed to fetch wiki: ${error.message}` }
      });
      client.app.log({
        body: { service: 'powerlevel', level: 'debug', message: 'Plugin will continue without wiki cache' }
      });
    }
  }
}

/**
 * Syncs dirty epics to GitHub
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} cache - Cache object
 */
async function syncDirtyEpics(owner, repo, cache, client = null) {
  const dirtyEpics = getDirtyEpics(cache);
  
  if (dirtyEpics.length === 0) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: 'No epics need syncing.' }
      });
    }
    return;
  }
  
  if (client) {
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: `Syncing ${dirtyEpics.length} epic(s) to GitHub...` }
    });
  }
  
  const repoPath = `${owner}/${repo}`;
  
  for (const epic of dirtyEpics) {
    try {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: `  Syncing epic #${epic.number}...` }
        });
      }
      
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
      
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: `  ✓ Synced epic #${epic.number}` }
        });
      }
    } catch (error) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'error', message: `  ✗ Failed to sync epic #${epic.number}: ${error.message}` }
        });
      }
    }
  }
}

/**
 * Checks for completed tasks since last check and updates epics
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 */
async function checkForCompletedTasks(owner, repo, cwd, client = null) {
  try {
    // Load config to check if task completion tracking is enabled
    const config = loadConfig(cwd);
    
    if (!config.tracking.updateOnTaskComplete) {
      return;
    }
    
    const cache = loadCache(owner, repo, client);
    
    // Get last check time from cache (default to 1 hour ago if first run)
    const lastCheck = cache.last_task_check || new Date(Date.now() - 3600000).toISOString();
    
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: `Checking for completed tasks since ${lastCheck}...` }
      });
    }
    
    // Find completed tasks from commits
    const completedTasks = findCompletedTasks(lastCheck, cwd);
    
    if (completedTasks.length === 0) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: 'No completed tasks found.' }
        });
      }
      cache.last_task_check = new Date().toISOString();
      saveCache(owner, repo, cache, client);
      return;
    }
    
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: `Found ${completedTasks.length} completed task(s):` }
      });
    }
    
    // For each completed task, try to map to epic and record completion
    for (const task of completedTasks) {
      const { issueNumber, keyword, commit } = task;
      
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: `  - Issue #${issueNumber} (${keyword}) in commit ${commit.hash.substring(0, 7)}` }
        });
      }
      
      // Find the issue in cache
      const issue = cache.issues?.find(i => i.number === issueNumber);
      
      if (!issue) {
        if (client) {
          client.app.log({
            body: { service: 'powerlevel', level: 'info', message: `    ⚠️  Issue #${issueNumber} not found in cache (may not be a task from an epic)` }
          });
        }
        continue;
      }
      
      // Find the epic this task belongs to
      const epic = cache.epics?.find(e => 
        e.sub_issues?.some(si => si.number === issueNumber)
      );
      
      if (!epic) {
        if (client) {
          client.app.log({
            body: { service: 'powerlevel', level: 'info', message: `    ⚠️  Could not find epic for issue #${issueNumber}` }
          });
        }
        continue;
      }
      
      // Extract task number from issue title (assumes format "Task N: Title")
      const taskMatch = issue.title?.match(/Task\s+(\d+):/i);
      if (!taskMatch) {
        if (client) {
          client.app.log({
            body: { service: 'powerlevel', level: 'info', message: `    ⚠️  Could not extract task number from issue title: ${issue.title}` }
          });
        }
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
        recordTaskCompletion(epic.number, taskNumber, taskTitle, agentInfo, cwd, client);
        if (client) {
          client.app.log({
            body: { service: 'powerlevel', level: 'info', message: `    ✅ Recorded task ${taskNumber} completion for epic #${epic.number}` }
          });
        }
      } catch (error) {
        if (client) {
          client.app.log({
            body: { service: 'powerlevel', level: 'error', message: `    ✗ Failed to record completion: ${error.message}` }
          });
        }
      }
    }
    
    // Update last check time
    cache.last_task_check = new Date().toISOString();
    saveCache(owner, repo, cache, client);
    
  } catch (error) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'error', message: `Error checking for completed tasks: ${error.message}` }
      });
    }
  }
}

/**
 * Land the plane - sync all dirty epics and clear flags
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 */
async function landThePlane(owner, repo, cwd, client = null) {
  try {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: '🛬 Landing the plane - syncing epics to GitHub...' }
      });
    }
    
    // First, check for completed tasks from commits
    await checkForCompletedTasks(owner, repo, cwd, client);
    
    // Then sync dirty epics
    const cache = loadCache(owner, repo, client);
    await syncDirtyEpics(owner, repo, cache, client);
    
    // Clear dirty flags after successful sync
    clearDirtyFlags(cache);
    saveCache(owner, repo, cache, client);
    
    // Calculate and display powerlevel
    const projects = listProjects(cwd, client);
    const powerlevel = calculatePowerlevel(projects);
    
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: '✓ All epics synced and flags cleared.' }
      });
      if (powerlevel > 0) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: `Powerlevel 🔶 ${powerlevel} - Managing ${numberToWord(powerlevel)} active ${powerlevel === 1 ? 'project' : 'projects'}` }
        });
      }
    }
  } catch (error) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'error', message: `Error during landing: ${error.message}` }
      });
    }
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
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'debug', message: 'No epic detected from branch name' }
        });
      }
      return;
    }
    
    const epic = getEpicDetails(epicNumber, owner, repo);
    if (!epic) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'warn', message: `Epic #${epicNumber} not found in cache` }
        });
      }
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
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: `✓ Session title set for Epic #${epicNumber}` }
        });
        client.app.log({
          body: { service: 'powerlevel', level: 'debug', message: `Title:\n${title}` }
        });
      }
    }
  } catch (error) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'debug', message: `Could not set session title: ${error.message}` }
      });
    }
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
    await landThePlane(owner, repo, cwd, client);
    
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
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'debug', message: `✓ Session title refreshed for Epic #${epicNumber}` }
      });
    }
  } catch (error) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'debug', message: `Could not update session title: ${error.message}` }
      });
    }
  }
}

/**
 * Plugin initialization
 */
export async function PowerlevelPlugin({ client, session, directory, worktree }) {
  client.app.log({
    body: { service: 'powerlevel', level: 'info', message: 'Initializing Powerlevel plugin...' }
  });
  
  // Get current working directory
  const cwd = directory || process.cwd();
  
  // Verify gh CLI
  if (!verifyGhCli(client)) {
    // Early error - plugin initialization failed
    console.error('Powerlevel plugin disabled - gh CLI not available');
    return;
  }
  
  // Detect repository
  const repoInfo = detectRepo(cwd, client);
  if (!repoInfo) {
    // Early error - plugin initialization failed
    console.error('Powerlevel plugin disabled - not in a GitHub repository');
    return;
  }
  
  const { owner, repo } = repoInfo;
  const repoPath = `${owner}/${repo}`;
  
  client.app.log({
    body: { service: 'powerlevel', level: 'info', message: `✓ Detected repository: ${repoPath}` }
  });
  
  // Load configuration
  let config;
  try {
    config = loadConfig(cwd);
  } catch (error) {
    client.app.log({
      body: { service: 'powerlevel', level: 'warn', message: `Warning: Could not load config: ${error.message}` }
    });
    client.app.log({
      body: { service: 'powerlevel', level: 'warn', message: 'Using default configuration' }
    });
    // Use minimal default config
    config = {
      superpowers: { wikiSync: false, repoUrl: '', autoOnboard: true },
      wiki: { autoSync: false },
      tracking: { updateOnTaskComplete: false }
    };
  }
  
  // Check onboarding status (respects autoOnboard setting)
  if (config.superpowers?.autoOnboard !== false) {
    const status = getOnboardingStatus(cwd, client);
    if (!status.onboarded && !session._powerlevel_onboarding_prompted) {
      promptOnboarding(session);
      // Store flag to avoid repeating in the same session
      session._powerlevel_onboarding_prompted = true;
    }
  }
  
  // Ensure labels exist
  try {
    await ensureLabelsExist(repoPath, client);
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: '✓ Labels verified' }
    });
  } catch (error) {
    client.app.log({
      body: { service: 'powerlevel', level: 'error', message: `Warning: Failed to verify labels: ${error.message}` }
    });
  }
  
  // Fetch superpowers wiki (non-blocking)
  await fetchSuperpowersWiki(owner, repo, config, client);
  
  // Register /wiki-sync slash command
  if (session && typeof session.registerCommand === 'function') {
    session.registerCommand({
      name: 'wiki-sync',
      description: 'Sync skills and docs to GitHub wiki',
        async handler(args) {
          client.app.log({
            body: { service: 'powerlevel', level: 'info', message: 'Running wiki sync...' }
          });
          try {
            const scriptPath = join(dirname(new URL(import.meta.url).pathname), 'bin', 'sync-wiki.js');
            const output = execFileSync(
              'node',
              [scriptPath, ...args],
              { cwd, encoding: 'utf8', stdio: 'pipe' }
            );
            client.app.log({
              body: { service: 'powerlevel', level: 'info', message: output }
            });
          } catch (error) {
            client.app.log({
              body: { service: 'powerlevel', level: 'error', message: `Wiki sync failed: ${error.message}` }
            });
            if (error.stdout) {
              client.app.log({
                body: { service: 'powerlevel', level: 'info', message: error.stdout }
              });
            }
            if (error.stderr) {
              client.app.log({
                body: { service: 'powerlevel', level: 'error', message: error.stderr }
              });
            }
          }
        }
    });
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: '✓ Registered /wiki-sync command' }
    });
  }
  
  // Register session hooks for Superpowers integration
  registerSessionHooks(session, owner, repo, cwd, client);
  
  // Hook into session.idle event (legacy session API)
  if (session && session.on) {
    session.on('idle', async () => {
      await landThePlane(owner, repo, cwd, client);
    });
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: '✓ Hooked into session.idle event' }
    });
  } else {
    client.app.log({
      body: { service: 'powerlevel', level: 'warn', message: 'Warning: Session does not support event hooks' }
    });
  }
  
  client.app.log({
    body: { service: 'powerlevel', level: 'info', message: '✓ Powerlevel plugin initialized successfully' }
  });
  
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
        if (client) {
          client.app.log({
            body: { service: 'powerlevel', level: 'debug', message: `Could not inject epic context: ${error.message}` }
          });
        }
      }
    }
  };
}

export default PowerlevelPlugin;
