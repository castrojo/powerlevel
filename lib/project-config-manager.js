import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';
import { execGh } from './github-cli.js';

/**
 * Checks if project already exists
 * @param {string} powerlevelPath - Path to Powerlevel repo
 * @param {string} projectName - Project slug
 * @returns {boolean}
 */
export function projectExists(powerlevelPath, projectName) {
  const configPath = join(powerlevelPath, 'projects', projectName, 'config.json');
  return existsSync(configPath);
}

/**
 * Generates project name from repo with intelligent shortening
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @returns {string} Suggested project name
 */
export function generateProjectName(owner, repo) {
  // Extract meaningful prefix from owner
  let ownerPrefix = owner.toLowerCase();
  
  // Remove common prefixes
  ownerPrefix = ownerPrefix.replace(/^project-?/, '');
  ownerPrefix = ownerPrefix.replace(/^the-?/, '');
  
  // For org-style names (e.g., "projectbluefin" → "bluefin")
  const orgMatch = ownerPrefix.match(/^[a-z]+(bluefin|ublue|cncf|oci|linux)/);
  if (orgMatch) {
    ownerPrefix = orgMatch[1];
  }
  
  // Clean repo name
  let repoName = repo.toLowerCase().replace(/[-_]/g, '-');
  
  // Apply shortening rules (to standalone words too)
  const shorteningRules = [
    { pattern: /^documentation$/, replace: 'docs' },
    { pattern: /-documentation$/, replace: '-docs' },
    { pattern: /^website$/, replace: 'site' },
    { pattern: /-website$/, replace: '-site' },
    { pattern: /^repository$/, replace: 'repo' },
    { pattern: /-repository$/, replace: '-repo' },
    { pattern: /^project-/, replace: '' },
    { pattern: /^the-/, replace: '' }
  ];
  
  for (const rule of shorteningRules) {
    repoName = repoName.replace(rule.pattern, rule.replace);
  }
  
  // If repo name is generic or same as owner, combine them
  const genericNames = ['docs', 'documentation', 'website', 'site', 'repo', 'repository', 'common'];
  if (genericNames.includes(repoName) || repoName === ownerPrefix) {
    return `${ownerPrefix}-${repoName}`;
  }
  
  // If repo name is descriptive, use it (unless it's the same as owner)
  if (repoName !== ownerPrefix) {
    return repoName;
  }
  
  // Fallback: combine
  return `${ownerPrefix}-${repoName}`;
}

/**
 * Fetches repo metadata from GitHub API
 * @param {string} owner - Repo owner
 * @param {string} repo - Repo name
 * @returns {Object|null} { description, language, topics, archived, fork, parent }
 */
export function fetchRepoMetadata(owner, repo) {
  try {
    const output = execGh(`api repos/${owner}/${repo} --jq '{description: .description, language: .language, topics: .topics, archived: .archived, fork: .fork, parent: .parent.full_name}'`);
    return JSON.parse(output);
  } catch (error) {
    console.error(`Failed to fetch repo metadata: ${error.message}`);
    return null;
  }
}

/**
 * Detects tech stack from repo metadata
 * @param {Object} metadata - From fetchRepoMetadata()
 * @param {string} repo - Repo name
 * @returns {Array<string>} Tech stack tags
 */
export function detectTechStack(metadata, repo) {
  const stack = [];
  
  // From primary language
  if (metadata.language) {
    stack.push(metadata.language);
  }
  
  // From topics (filter for tech-related ones)
  if (metadata.topics && Array.isArray(metadata.topics)) {
    const techTopics = metadata.topics.filter(t => {
      const techKeywords = [
        'javascript', 'typescript', 'python', 'go', 'rust', 'java', 
        'hugo', 'react', 'vue', 'angular', 'svelte', 'astro',
        'docker', 'kubernetes', 'github-actions', 'ci-cd'
      ];
      return techKeywords.includes(t.toLowerCase());
    });
    stack.push(...techTopics);
  }
  
  // From repo name patterns
  const repoLower = repo.toLowerCase();
  if (repoLower.includes('docs') || repoLower.includes('documentation')) {
    stack.push('Documentation');
  }
  if (repoLower.includes('website') || repoLower.includes('site')) {
    stack.push('Website');
  }
  
  // Deduplicate and capitalize
  return [...new Set(stack)].map(item => {
    // Capitalize first letter
    return item.charAt(0).toUpperCase() + item.slice(1);
  });
}

/**
 * Validates project config structure
 * @param {Object} config - Config to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateProjectConfig(config) {
  const errors = [];
  
  if (!config.repo) {
    errors.push('Missing required field: repo');
  }
  
  if (config.active === undefined) {
    errors.push('Missing required field: active');
  }
  
  if (!config.labels || !config.labels.project) {
    errors.push('Missing required field: labels.project');
  }
  
  // Validate repo format
  if (config.repo && !config.repo.match(/^[^/]+\/[^/]+$/)) {
    errors.push('Invalid repo format (expected: owner/repo)');
  }
  
  // Validate fork format if provided
  if (config.fork && !config.fork.match(/^[^/]+\/[^/]+$/)) {
    errors.push('Invalid fork format (expected: owner/repo)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Prompts user for project name on collision
 * @param {string} suggestedName - Initial suggestion
 * @param {string} powerlevelPath - Path to Powerlevel repo
 * @returns {Promise<string>} User's chosen name
 */
export async function promptForProjectName(suggestedName, powerlevelPath) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const askForName = () => {
      rl.question(`\nEnter a different project name: `, (answer) => {
        const newName = answer.trim();
        
        if (!newName) {
          console.error('Error: Project name cannot be empty');
          askForName();
          return;
        }
        
        if (projectExists(powerlevelPath, newName)) {
          console.error(`Error: Project '${newName}' already exists`);
          askForName();
          return;
        }
        
        rl.close();
        resolve(newName);
      });
    };
    
    askForName();
  });
}

/**
 * Creates project config.json file
 * @param {string} powerlevelPath - Path to Powerlevel repo
 * @param {string} projectName - Project slug (e.g., "bluefin-docs")
 * @param {Object} config - Config object
 */
export function createProjectConfig(powerlevelPath, projectName, config) {
  const projectDir = join(powerlevelPath, 'projects', projectName);
  const plansDir = join(projectDir, 'plans');
  const configPath = join(projectDir, 'config.json');
  
  // Create directories
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
  }
  
  if (!existsSync(plansDir)) {
    mkdirSync(plansDir, { recursive: true });
  }
  
  // Write config file
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}
