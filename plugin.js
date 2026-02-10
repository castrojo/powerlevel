import { execSync } from 'child_process';
import { detectRepo } from './lib/repo-detector.js';
import { loadCache, saveCache, getDirtyEpics, clearDirtyFlags } from './lib/cache-manager.js';
import { ensureLabelsExist } from './lib/label-manager.js';
import { execGh } from './lib/github-cli.js';

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
 * Land the plane - sync all dirty epics and clear flags
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 */
async function landThePlane(owner, repo) {
  try {
    console.log('🛬 Landing the plane - syncing epics to GitHub...');
    
    const cache = loadCache(owner, repo);
    await syncDirtyEpics(owner, repo, cache);
    
    // Clear dirty flags after successful sync
    clearDirtyFlags(cache);
    saveCache(owner, repo, cache);
    
    console.log('✓ All epics synced and flags cleared.');
  } catch (error) {
    console.error(`Error during landing: ${error.message}`);
  }
}

/**
 * Plugin initialization
 */
export async function GitHubTrackerPlugin({ session }) {
  console.log('Initializing GitHub Tracker plugin...');
  
  // Verify gh CLI
  if (!verifyGhCli()) {
    console.error('GitHub Tracker plugin disabled - gh CLI not available');
    return;
  }
  
  // Detect repository
  const repoInfo = detectRepo(session.cwd || process.cwd());
  if (!repoInfo) {
    console.error('GitHub Tracker plugin disabled - not in a GitHub repository');
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
  
  // Hook into session.idle event
  if (session && session.on) {
    session.on('idle', async () => {
      await landThePlane(owner, repo);
    });
    console.log('✓ Hooked into session.idle event');
  } else {
    console.warn('Warning: Session does not support event hooks');
  }
  
  console.log('✓ GitHub Tracker plugin initialized successfully');
}

export default GitHubTrackerPlugin;
