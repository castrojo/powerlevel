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
      sub_issues: [], // Legacy: kept for self-tracking epics
      tracked_items: [] // New: tasklist items for external tracking
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

/**
 * Get cached project board info
 */
export function getCachedProjectBoard(cache) {
  return cache.project_board || null;
}

/**
 * Cache project board info
 * @param {Object} cache - Cache object
 * @param {Object} projectBoard - Project board object
 * @returns {Object} Updated cache
 */
export function cacheProjectBoard(cache, projectBoard) {
  cache.project_board = projectBoard;
  return cache;
}

/**
 * Updates tracked items (tasklist) for an external tracking epic
 * @param {Object} cache - Cache object
 * @param {number} epicNumber - Epic issue number
 * @param {Array<Object>} items - Array of tracked items from external repo
 * @returns {Object} Updated cache
 */
export function updateTrackedItems(cache, epicNumber, items) {
  const epic = cache.epics.find(e => e.number === epicNumber);
  
  if (!epic) {
    throw new Error(`Epic #${epicNumber} not found in cache`);
  }
  
  epic.tracked_items = items;
  epic.dirty = true;
  
  return cache;
}

/**
 * Gets an epic from the cache by number
 * @param {Object} cache - Cache object
 * @param {number} epicNumber - Epic issue number
 * @returns {Object|null} Epic object or null if not found
 */
export function getEpic(cache, epicNumber) {
  return cache.epics.find(e => e.number === epicNumber) || null;
}

/**
 * Updates an epic in the cache with new fields
 * @param {Object} cache - Cache object
 * @param {number} epicNumber - Epic issue number
 * @param {Object} updates - Object with fields to update
 * @returns {Object} Updated cache
 */
export function updateEpic(cache, epicNumber, updates) {
  const epic = cache.epics.find(e => e.number === epicNumber);
  
  if (!epic) {
    throw new Error(`Epic #${epicNumber} not found in cache`);
  }
  
  Object.assign(epic, updates);
  
  return cache;
}

/**
 * Adds a journey entry to an epic in the cache
 * @param {Object} cache - Cache object
 * @param {number} epicNumber - Epic issue number
 * @param {Object} entry - Journey entry with timestamp, event, message, agent (optional), metadata (optional)
 * @returns {Object} Updated cache
 */
export function addJourneyEntry(cache, epicNumber, entry) {
  const epic = cache.epics.find(e => e.number === epicNumber);
  
  if (!epic) {
    throw new Error(`Epic #${epicNumber} not found in cache`);
  }
  
  if (!epic.journey) {
    epic.journey = [];
  }
  
  epic.journey.push(entry);
  epic.dirty = true;
  
  return cache;
}
