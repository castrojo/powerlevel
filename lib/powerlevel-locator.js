import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import * as readline from 'readline';

const GLOBAL_CONFIG_PATH = join(homedir(), '.config', 'opencode', 'powerlevel.json');

/**
 * Checks if directory is a Powerlevel repo
 * @param {string} path - Directory to check
 * @returns {boolean}
 */
export function isPowerlevelRepo(path) {
  return existsSync(join(path, 'plugin.js')) && 
         existsSync(join(path, 'projects'));
}

/**
 * Loads global Powerlevel config
 * @returns {Object|null} Config object or null
 */
export function loadGlobalConfig() {
  if (!existsSync(GLOBAL_CONFIG_PATH)) {
    return null;
  }
  
  try {
    const content = readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Warning: Failed to parse global config: ${error.message}`);
    return null;
  }
}

/**
 * Saves global Powerlevel config
 * @param {Object} config - Config to save
 */
export function saveGlobalConfig(config) {
  try {
    const configDir = dirname(GLOBAL_CONFIG_PATH);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    
    writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  } catch (error) {
    throw new Error(`Failed to save global config: ${error.message}`);
  }
}

/**
 * Prompts user for Powerlevel location
 * @returns {Promise<string>} User-provided path
 */
export function promptForPowerlevelLocation() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('Enter path to Powerlevel repository: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Prompts yes/no question
 * @param {string} question - Question to ask
 * @returns {Promise<boolean>}
 */
export function promptYesNo(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(`${question} (y/n) `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Finds Powerlevel repo location using multiple strategies
 * @returns {Promise<string|null>} Path to Powerlevel repo or null
 */
export async function locatePowerlevelRepo() {
  // Strategy 1: Check CWD
  const cwd = process.cwd();
  if (isPowerlevelRepo(cwd)) {
    return cwd;
  }
  
  // Strategy 2: Check global config
  const globalConfig = loadGlobalConfig();
  if (globalConfig && globalConfig.repo_path) {
    if (isPowerlevelRepo(globalConfig.repo_path)) {
      return globalConfig.repo_path;
    } else {
      console.warn(`Warning: Configured path is not a valid Powerlevel repo: ${globalConfig.repo_path}`);
    }
  }
  
  // Strategy 3: Search common locations
  const commonLocations = [
    join(homedir(), 'src', 'powerlevel'),
    join(homedir(), 'projects', 'powerlevel'),
    join(homedir(), 'code', 'powerlevel'),
    join(homedir(), 'powerlevel')
  ];
  
  for (const location of commonLocations) {
    if (existsSync(location) && isPowerlevelRepo(location)) {
      console.log(`✓ Found Powerlevel at: ${location}`);
      
      // Ask to save to global config
      const shouldSave = await promptYesNo(`\nSave this location to ${GLOBAL_CONFIG_PATH}?`);
      if (shouldSave) {
        const config = globalConfig || {};
        config.repo_path = location;
        saveGlobalConfig(config);
        console.log('✓ Saved to global config');
      }
      
      return location;
    }
  }
  
  // Strategy 4: Prompt user
  console.log('\nPowerlevel repository not found in common locations.');
  console.log('Searched:');
  commonLocations.forEach(loc => console.log(`  - ${loc}`));
  console.log('');
  
  const userPath = await promptForPowerlevelLocation();
  
  if (!existsSync(userPath)) {
    console.error(`Error: Path does not exist: ${userPath}`);
    return null;
  }
  
  if (!isPowerlevelRepo(userPath)) {
    console.error(`Error: Not a valid Powerlevel repository: ${userPath}`);
    console.error('Expected to find: plugin.js and projects/ directory');
    return null;
  }
  
  // Ask to save
  const shouldSave = await promptYesNo(`\nSave this location to ${GLOBAL_CONFIG_PATH}?`);
  if (shouldSave) {
    const config = globalConfig || {};
    config.repo_path = userPath;
    saveGlobalConfig(config);
    console.log('✓ Saved to global config');
  }
  
  return userPath;
}
