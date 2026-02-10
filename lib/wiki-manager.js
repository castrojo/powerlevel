import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Gets the cache directory path for a wiki
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {string} Path to wiki cache directory
 */
export function getWikiCacheDir(owner, repo) {
  if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') {
    throw new Error('owner and repo must be non-empty strings');
  }
  
  const cacheRoot = join(homedir(), '.cache', 'opencode-superpower', 'wiki');
  return join(cacheRoot, `${owner}-${repo}`);
}

/**
 * Checks if a repository has wiki enabled
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {boolean} True if wiki exists and is accessible
 */
export function wikiExists(owner, repo, client = null) {
  if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') {
    throw new Error('owner and repo must be non-empty strings');
  }
  
  try {
    // Use gh CLI to check wiki - handles auth automatically
    execFileSync('gh', ['repo', 'view', `${owner}/${repo}`, '--json', 'hasWikiEnabled'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return true;
  } catch (error) {
    // Any error (wiki disabled, auth failure, network error) returns false
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'debug',
          message: `Wiki check failed for ${owner}/${repo}: ${error.message}`
        }
      });
    }
    return false;
  }
}

/**
 * Clones or updates a wiki repository to the cache
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {string} Path to the cloned wiki directory
 * @throws {Error} If clone/pull fails
 */
export function cloneWiki(owner, repo, client = null) {
  if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') {
    throw new Error('owner and repo must be non-empty strings');
  }
  
  const wikiDir = getWikiCacheDir(owner, repo);
  // Use SSH URL to avoid interactive auth prompts
  const wikiUrl = `git@github.com:${owner}/${repo}.wiki.git`;

  try {
    if (existsSync(join(wikiDir, '.git'))) {
      // Wiki already cloned, pull latest changes
      if (client) {
        client.app.log({
          body: {
            service: 'powerlevel',
            level: 'info',
            message: `Updating wiki cache for ${owner}/${repo}...`
          }
        });
      }
      execFileSync('git', ['pull'], {
        cwd: wikiDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000 // 10 second timeout
      });
    } else {
      // Clone wiki for the first time
      if (client) {
        client.app.log({
          body: {
            service: 'powerlevel',
            level: 'info',
            message: `Cloning wiki for ${owner}/${repo}...`
          }
        });
      }
      const parentDir = join(homedir(), '.cache', 'opencode-superpower', 'wiki');
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      execFileSync('git', ['clone', wikiUrl, wikiDir], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000 // 30 second timeout
      });
    }
    
    return wikiDir;
  } catch (error) {
    throw new Error(`Failed to clone/update wiki: ${error.message}`);
  }
}

/**
 * Syncs skill files from a directory to the wiki
 * Converts skill directory names to wiki page format
 * @param {string} skillsDir - Path to skills directory
 * @param {string} wikiDir - Path to wiki directory
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {number} Number of skill files synced
 */
export function syncSkillsToWiki(skillsDir, wikiDir, client = null) {
  if (!skillsDir || !wikiDir || typeof skillsDir !== 'string' || typeof wikiDir !== 'string') {
    throw new Error('skillsDir and wikiDir must be non-empty strings');
  }
  
  if (!existsSync(skillsDir)) {
    throw new Error(`Skills directory not found: ${skillsDir}`);
  }

  if (!existsSync(wikiDir)) {
    throw new Error(`Wiki directory not found: ${wikiDir}`);
  }

  let syncedCount = 0;

  // Read all subdirectories in skills directory
  const entries = readdirSync(skillsDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const skillName = entry.name;
    const skillFile = join(skillsDir, skillName, 'SKILL.md');

    if (!existsSync(skillFile)) {
      if (client) {
        client.app.log({
          body: {
            service: 'powerlevel',
            level: 'info',
            message: `Skipping ${skillName}: no SKILL.md found`
          }
        });
      }
      continue;
    }

    // Convert skill name to wiki page name
    // epic-creation -> Skills-Epic-Creation.md
    const wikiPageName = 'Skills-' + skillName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('-') + '.md';

    const wikiPagePath = join(wikiDir, wikiPageName);

    // Copy skill file to wiki
    const content = readFileSync(skillFile, 'utf8');
    writeFileSync(wikiPagePath, content, 'utf8');
    
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'info',
          message: `Synced ${skillName} -> ${wikiPageName}`
        }
      });
    }
    syncedCount++;
  }

  return syncedCount;
}

/**
 * Commits and pushes changes to the wiki repository
 * @param {string} wikiDir - Path to wiki directory
 * @param {string} message - Commit message
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {boolean} True if changes were committed and pushed, false if no changes
 * @throws {Error} If commit or push fails
 */
export function commitAndPushWiki(wikiDir, message, client = null) {
  if (!existsSync(wikiDir)) {
    throw new Error(`Wiki directory not found: ${wikiDir}`);
  }

  try {
    // Check if there are any changes
    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: wikiDir,
      encoding: 'utf8'
    }).trim();

    if (!status) {
      if (client) {
        client.app.log({
          body: {
            service: 'powerlevel',
            level: 'info',
            message: 'No changes to commit'
          }
        });
      }
      return false;
    }

    // Stage all changes
    execFileSync('git', ['add', '.'], {
      cwd: wikiDir
    });

    // Commit changes
    execFileSync('git', ['commit', '-m', message], {
      cwd: wikiDir
    });

    // Push to remote
    execFileSync('git', ['push'], {
      cwd: wikiDir
    });

    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'info',
          message: `Successfully committed and pushed: ${message}`
        }
      });
    }
    return true;
  } catch (error) {
    throw new Error(`Failed to commit/push wiki: ${error.message}`);
  }
}
