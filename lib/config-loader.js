import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  superpowers: {
    enabled: false,
    remote: 'origin',
    repoUrl: '',
    autoOnboard: false,
    wikiSync: true
  },
  wiki: {
    autoSync: false,
    syncOnCommit: false,
    includeSkills: true,
    includeDocs: true
  },
  tracking: {
    autoUpdateEpics: true,
    updateOnTaskComplete: true,
    commentOnProgress: false
  },
  projectBoard: {
    enabled: true,
    number: null,
    autoCreate: true
  },
  superpowersIntegration: {
    enabled: true,
    trackSkillUsage: true,
    updateEpicOnSkillInvocation: true
  }
};

/**
 * Deep merges two objects, with values from source overriding target
 * @param {Object} target - Target object (defaults)
 * @param {Object} source - Source object (user config)
 * @returns {Object} Merged object
 */
export function mergeConfig(target, source) {
  if (!target || typeof target !== 'object') {
    throw new Error('target must be an object');
  }
  
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { ...target };
  }

  const result = { ...target };

  for (const key in source) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }

    const sourceValue = source[key];
    const targetValue = result[key];

    // If both values are plain objects, merge recursively
    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = mergeConfig(targetValue, sourceValue);
    } else {
      // Otherwise, source value overwrites target value
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Validates a git URL (SSH or HTTPS format)
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid git URL
 */
function isValidGitUrl(url) {
  if (typeof url !== 'string' || !url) {
    return false;
  }

  // HTTPS format: https://any-domain.com/path/repo.git
  const httpsPattern = /^https:\/\/[^\/]+\/[\w\-\.\/]+(\.git)?$/;
  
  // SSH format: git@any-domain.com:path/repo.git
  const sshPattern = /^git@[^:]+:[\w\-\.\/]+(\.git)?$/;

  return httpsPattern.test(url) || sshPattern.test(url);
}

/**
 * Validates configuration structure and values
 * @param {Object} config - Configuration object to validate
 * @throws {Error} If config is invalid
 */
export function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('Config must be an object');
  }

  // Validate superpowers section
  if (config.superpowers) {
    const { enabled, repoUrl, remote, autoOnboard, wikiSync } = config.superpowers;

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      throw new Error('superpowers.enabled must be a boolean');
    }

    if (enabled && !repoUrl) {
      throw new Error('superpowers.repoUrl is required when superpowers.enabled is true');
    }

    if (enabled && repoUrl && !isValidGitUrl(repoUrl)) {
      throw new Error('superpowers.repoUrl must be a valid git URL (SSH or HTTPS format)');
    }

    if (remote !== undefined && typeof remote !== 'string') {
      throw new Error('superpowers.remote must be a string');
    }

    if (autoOnboard !== undefined && typeof autoOnboard !== 'boolean') {
      throw new Error('superpowers.autoOnboard must be a boolean');
    }

    if (wikiSync !== undefined && typeof wikiSync !== 'boolean') {
      throw new Error('superpowers.wikiSync must be a boolean');
    }
  }

  // Validate wiki section
  if (config.wiki) {
    const { autoSync, syncOnCommit, includeSkills, includeDocs } = config.wiki;

    if (autoSync !== undefined && typeof autoSync !== 'boolean') {
      throw new Error('wiki.autoSync must be a boolean');
    }

    if (syncOnCommit !== undefined && typeof syncOnCommit !== 'boolean') {
      throw new Error('wiki.syncOnCommit must be a boolean');
    }

    if (includeSkills !== undefined && typeof includeSkills !== 'boolean') {
      throw new Error('wiki.includeSkills must be a boolean');
    }

    if (includeDocs !== undefined && typeof includeDocs !== 'boolean') {
      throw new Error('wiki.includeDocs must be a boolean');
    }
  }

  // Validate tracking section
  if (config.tracking) {
    const { autoUpdateEpics, updateOnTaskComplete, commentOnProgress } = config.tracking;

    if (autoUpdateEpics !== undefined && typeof autoUpdateEpics !== 'boolean') {
      throw new Error('tracking.autoUpdateEpics must be a boolean');
    }

    if (updateOnTaskComplete !== undefined && typeof updateOnTaskComplete !== 'boolean') {
      throw new Error('tracking.updateOnTaskComplete must be a boolean');
    }

    if (commentOnProgress !== undefined && typeof commentOnProgress !== 'boolean') {
      throw new Error('tracking.commentOnProgress must be a boolean');
    }
  }

  // Validate projectBoard section
  if (config.projectBoard) {
    const { enabled, number, autoCreate } = config.projectBoard;

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      throw new Error('projectBoard.enabled must be a boolean');
    }

    if (number !== undefined && number !== null && (typeof number !== 'number' || !Number.isInteger(number) || number < 1)) {
      throw new Error('projectBoard.number must be null or a positive integer');
    }

    if (autoCreate !== undefined && typeof autoCreate !== 'boolean') {
      throw new Error('projectBoard.autoCreate must be a boolean');
    }
  }

  // Validate superpowersIntegration section
  if (config.superpowersIntegration) {
    const { enabled, trackSkillUsage, updateEpicOnSkillInvocation } = config.superpowersIntegration;

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      throw new Error('superpowersIntegration.enabled must be a boolean');
    }

    if (trackSkillUsage !== undefined && typeof trackSkillUsage !== 'boolean') {
      throw new Error('superpowersIntegration.trackSkillUsage must be a boolean');
    }

    if (updateEpicOnSkillInvocation !== undefined && typeof updateEpicOnSkillInvocation !== 'boolean') {
      throw new Error('superpowersIntegration.updateEpicOnSkillInvocation must be a boolean');
    }
  }
}

/**
 * Get project board configuration
 */
export function getProjectBoardConfig(config) {
  const defaults = {
    enabled: true,
    number: null, // null = auto-detect first project
    autoCreate: true
  };
  
  if (!config || !config.projectBoard) {
    return defaults;
  }
  
  return {
    enabled: config.projectBoard.enabled !== false,
    number: config.projectBoard.number !== undefined ? config.projectBoard.number : defaults.number,
    autoCreate: config.projectBoard.autoCreate !== undefined ? config.projectBoard.autoCreate : defaults.autoCreate
  };
}

/**
 * Get project board configuration from environment
 */
export function getProjectBoardConfigFromEnv() {
  const config = {};
  
  if (process.env.GITHUB_TRACKER_PROJECT_ENABLED !== undefined) {
    config.enabled = process.env.GITHUB_TRACKER_PROJECT_ENABLED !== 'false';
  }
  
  if (process.env.GITHUB_TRACKER_PROJECT_NUMBER) {
    config.number = parseInt(process.env.GITHUB_TRACKER_PROJECT_NUMBER, 10);
  }
  
  if (process.env.GITHUB_TRACKER_PROJECT_AUTO_CREATE !== undefined) {
    config.autoCreate = process.env.GITHUB_TRACKER_PROJECT_AUTO_CREATE === 'true';
  }
  
  return config;
}

/**
 * Loads configuration from .opencode/config.json or .github-tracker.json or returns defaults
 * @param {string} cwd - Current working directory (defaults to process.cwd())
 * @returns {Object} Validated configuration object
 * @throws {Error} If config file exists but is invalid
 */
export function loadConfig(cwd = process.cwd()) {
  if (!cwd || typeof cwd !== 'string') {
    throw new Error('cwd must be a non-empty string');
  }

  // Try .github-tracker.json first (for backwards compatibility)
  const trackerConfigPath = join(cwd, '.github-tracker.json');
  // Then try .opencode/config.json
  const opencodeConfigPath = join(cwd, '.opencode', 'config.json');
  
  let configPath = null;
  if (existsSync(trackerConfigPath)) {
    configPath = trackerConfigPath;
  } else if (existsSync(opencodeConfigPath)) {
    configPath = opencodeConfigPath;
  }

  // If config file doesn't exist, return defaults
  if (!configPath) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    // Read and parse config file
    const configContent = readFileSync(configPath, 'utf8');
    const userConfig = JSON.parse(configContent);

    // Merge user config over defaults
    const mergedConfig = mergeConfig(DEFAULT_CONFIG, userConfig);

    // Validate merged config
    validateConfig(mergedConfig);

    return mergedConfig;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in config file: ${error.message}`);
    }
    throw error;
  }
}
