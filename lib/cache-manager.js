import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getRepoHash } from './repo-detector.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', 'cache');

/**
 * Gets the cache file path for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {string} Path to cache file
 */
function getCachePath(owner, repo) {
  const hash = getRepoHash(owner, repo);
  const repoDir = join(CACHE_DIR, hash);
  return join(repoDir, 'state.json');
}

/**
 * Loads cache for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Object} Cache object with epics, issues, and project_board
 */
export function loadCache(owner, repo) {
  const cachePath = getCachePath(owner, repo);
  
  if (!existsSync(cachePath)) {
    return {
      epics: [],
      issues: [],
      project_board: null
    };
  }

  try {
    const data = readFileSync(cachePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading cache: ${error.message}`);
    return {
      epics: [],
      issues: [],
      project_board: null
    };
  }
}

/**
 * Saves cache for a repository
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} cache - Cache object to save
 */
export function saveCache(owner, repo, cache) {
  const cachePath = getCachePath(owner, repo);
  const cacheDir = dirname(cachePath);

  try {
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }
    writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error saving cache: ${error.message}`);
    throw error;
  }
}

/**
 * Adds an epic to the cache
 * @param {Object} cache - Cache object
 * @param {Object} epic - Epic object with number, title, priority, etc.
 * @returns {Object} Updated cache
 */
export function addEpic(cache, epic) {
  const existingIndex = cache.epics.findIndex(e => e.number === epic.number);
  
  if (existingIndex >= 0) {
    cache.epics[existingIndex] = { ...cache.epics[existingIndex], ...epic };
  } else {
    cache.epics.push({
      ...epic,
      dirty: false,
      sub_issues: []
    });
  }
  
  return cache;
}

/**
 * Adds a sub-issue to an epic in the cache
 * @param {Object} cache - Cache object
 * @param {number} epicNumber - Epic issue number
 * @param {Object} subIssue - Sub-issue object
 * @returns {Object} Updated cache
 */
export function addSubIssue(cache, epicNumber, subIssue) {
  const epic = cache.epics.find(e => e.number === epicNumber);
  
  if (!epic) {
    throw new Error(`Epic #${epicNumber} not found in cache`);
  }

  const existingIndex = epic.sub_issues.findIndex(si => si.number === subIssue.number);
  
  if (existingIndex >= 0) {
    epic.sub_issues[existingIndex] = { ...epic.sub_issues[existingIndex], ...subIssue };
  } else {
    epic.sub_issues.push(subIssue);
  }
  
  // Add to global issues list
  const issueIndex = cache.issues.findIndex(i => i.number === subIssue.number);
  if (issueIndex >= 0) {
    cache.issues[issueIndex] = { ...cache.issues[issueIndex], ...subIssue };
  } else {
    cache.issues.push(subIssue);
  }
  
  return cache;
}

/**
 * Marks an epic as dirty (needs sync)
 * @param {Object} cache - Cache object
 * @param {number} epicNumber - Epic issue number
 * @returns {Object} Updated cache
 */
export function markEpicDirty(cache, epicNumber) {
  const epic = cache.epics.find(e => e.number === epicNumber);
  
  if (epic) {
    epic.dirty = true;
  }
  
  return cache;
}

/**
 * Gets all dirty epics from cache
 * @param {Object} cache - Cache object
 * @returns {Array} Array of dirty epics
 */
export function getDirtyEpics(cache) {
  return cache.epics.filter(e => e.dirty === true);
}

/**
 * Clears dirty flags from all epics
 * @param {Object} cache - Cache object
 * @returns {Object} Updated cache
 */
export function clearDirtyFlags(cache) {
  cache.epics.forEach(epic => {
    epic.dirty = false;
  });
  
  return cache;
}
