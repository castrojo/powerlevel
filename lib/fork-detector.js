import { execFileSync } from 'child_process';
import { parseRepoFromUrl, getRemoteUrl } from './remote-manager.js';
import { execGh } from './github-cli.js';

/**
 * Gets all git remotes with parsed repo info
 * @param {string} cwd - Working directory
 * @returns {Object} Map of remote names to {owner, repo} objects
 */
export function getAllRemotes(cwd) {
  try {
    const output = execFileSync('git', ['remote'], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    const remoteNames = output.split('\n').map(r => r.trim()).filter(Boolean);
    const remotes = {};
    
    for (const remoteName of remoteNames) {
      const url = getRemoteUrl(remoteName, cwd);
      if (url) {
        const repoInfo = parseRepoFromUrl(url);
        if (repoInfo) {
          remotes[remoteName] = repoInfo;
        }
      }
    }
    
    return remotes;
  } catch (error) {
    return {};
  }
}

/**
 * Checks if repo is a fork via GitHub API
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @returns {Object} { isFork: boolean, parent: string|null }
 */
export function checkIfFork(owner, repo) {
  try {
    const output = execGh(`api repos/${owner}/${repo} --jq '{fork: .fork, parent: .parent.full_name}'`);
    const data = JSON.parse(output);
    
    return {
      isFork: data.fork === true,
      parent: data.parent || null
    };
  } catch (error) {
    return { isFork: false, parent: null };
  }
}

/**
 * Detects fork relationship from git remotes
 * @param {string} cwd - Working directory to check
 * @returns {Object} { isDetected: boolean, upstream: {owner, repo}, fork: {owner, repo}, confidence: string }
 */
export function detectForkRelationship(cwd) {
  const remotes = getAllRemotes(cwd);
  
  // Strategy 1: Check for 'upstream' remote (high confidence)
  if (remotes.upstream) {
    return {
      isDetected: true,
      upstream: remotes.upstream,
      fork: remotes.origin || null,
      confidence: 'high',
      reasoning: 'upstream remote found'
    };
  }
  
  // Strategy 2: Check if origin is a fork via GitHub API (medium confidence)
  if (remotes.origin) {
    const forkCheck = checkIfFork(remotes.origin.owner, remotes.origin.repo);
    if (forkCheck.isFork && forkCheck.parent) {
      const [owner, repo] = forkCheck.parent.split('/');
      return {
        isDetected: true,
        upstream: { owner, repo },
        fork: remotes.origin,
        confidence: 'medium',
        reasoning: 'GitHub API reports origin is a fork'
      };
    }
  }
  
  // No fork detected
  return {
    isDetected: false,
    upstream: null,
    fork: null,
    confidence: 'none',
    reasoning: 'No upstream remote and origin is not a fork'
  };
}

/**
 * Determines which repo to track (upstream > origin)
 * @param {string} cwd - Working directory
 * @returns {Object} { target: {owner, repo}, fork: {owner, repo}|null, reasoning: string }
 */
export function selectTrackingTarget(cwd) {
  const forkInfo = detectForkRelationship(cwd);
  
  if (forkInfo.isDetected) {
    return {
      target: forkInfo.upstream,
      fork: forkInfo.fork,
      reasoning: `Fork detected: tracking upstream (${forkInfo.reasoning})`
    };
  }
  
  // Not a fork - track origin if available
  const remotes = getAllRemotes(cwd);
  if (remotes.origin) {
    return {
      target: remotes.origin,
      fork: null,
      reasoning: 'No fork detected: tracking origin'
    };
  }
  
  // No valid remote found
  return {
    target: null,
    fork: null,
    reasoning: 'No origin or upstream remote found'
  };
}
