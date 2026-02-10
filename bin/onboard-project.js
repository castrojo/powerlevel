#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { execFileSync } from 'child_process';
import * as readline from 'readline';
import { detectRepo } from '../lib/repo-detector.js';
import { loadConfig, mergeConfig, validateConfig } from '../lib/config-loader.js';
import { hasRemote, addRemote, fetchRemote, getRemoteUrl } from '../lib/remote-manager.js';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {
    force: false,
    configPath: null
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') {
      args.force = true;
    } else if (arg.startsWith('--config-path=')) {
      args.configPath = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node bin/onboard-project.js [options]');
      console.log('');
      console.log('Options:');
      console.log('  --force              Skip confirmation prompts, overwrite existing remote');
      console.log('  --config-path=PATH   Custom config file location (defaults to .opencode/config.json)');
      console.log('  --help, -h           Show this help message');
      console.log('');
      console.log('Examples:');
      console.log('  node bin/onboard-project.js');
      console.log('  node bin/onboard-project.js --force');
      console.log('  node bin/onboard-project.js --config-path=/custom/path/config.json');
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      console.error('Run with --help for usage information');
      process.exit(1);
    }
  }

  return args;
}

/**
 * Prompt user for yes/no confirmation
 */
function promptYesNo(question) {
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
 * Get list of branches from a remote
 */
function getRemoteBranches(remoteName, cwd) {
  try {
    const output = execFileSync('git', ['branch', '-r', '--list', `${remoteName}/*`], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.includes('->'))
      .map(line => line.replace(`${remoteName}/`, ''));
  } catch (error) {
    console.debug(`Failed to get branches for remote '${remoteName}': ${error.message}`);
    return [];
  }
}

/**
 * Create stub documentation file
 */
function createStubDocumentation(cwd) {
  const docsDir = join(cwd, 'docs');
  const docPath = join(docsDir, 'SUPERPOWERS.md');

  // Create docs directory if it doesn't exist
  if (!existsSync(docsDir)) {
    mkdirSync(docsDir, { recursive: true });
  }

  // Don't overwrite existing documentation
  if (existsSync(docPath)) {
    console.log('  ⚠ docs/SUPERPOWERS.md already exists, skipping...');
    return;
  }

  const content = `# Superpowers Integration

This project is integrated with the Superpowers workflow for OpenCode.

## Context Sources

OpenCode agents working on this project have access to the following context sources:

1. **Local documentation** - Files in \`docs/\` directory
2. **Superpowers remote** - Shared skills and patterns from the superpowers repository
3. **Project configuration** - Settings in \`.opencode/config.json\`

## For AI Agents

When working on this project:

1. Check \`.opencode/config.json\` for enabled features and settings
2. Use skills from the superpowers remote when appropriate
3. Follow the implementation patterns in \`docs/plans/\`
4. Update tracking information using the epic-creation and land-the-plane skills

## Configuration

Configuration is stored in \`.opencode/config.json\`. See that file for details on:

- Superpowers remote settings (\`superpowers.*\`)
- Wiki sync behavior (\`wiki.*\`)
- Issue tracking integration (\`tracking.*\`)

## Getting Started

1. Verify superpowers remote: \`git remote -v\`
2. Fetch latest skills: \`git fetch superpowers\`
3. Check configuration: \`cat .opencode/config.json\`

For more information, see: https://github.com/castrojo/superpowers
`;

  writeFileSync(docPath, content, 'utf8');
  console.log('  ✓ Created docs/SUPERPOWERS.md');
}

/**
 * Create default configuration file
 */
function createDefaultConfig(cwd, repoUrl) {
  const configDir = join(cwd, '.opencode');
  const configPath = join(configDir, 'config.json');

  // Create .opencode directory if it doesn't exist
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Don't overwrite existing config
  if (existsSync(configPath)) {
    console.log('  ⚠ .opencode/config.json already exists, skipping...');
    return;
  }

  const defaultConfig = {
    superpowers: {
      enabled: true,
      remote: 'superpowers',
      repoUrl: repoUrl,
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
    }
  };

  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + '\n', 'utf8');
  console.log('  ✓ Created .opencode/config.json');
}

/**
 * Create AGENTS.md from template
 */
async function createAgentsFile(cwd, repoInfo, force = false) {
  const agentsPath = join(cwd, 'AGENTS.md');
  const templatePath = resolve(new URL(import.meta.url).pathname, '../../templates/AGENTS.md.template');

  // Check if AGENTS.md already exists
  if (existsSync(agentsPath) && !force) {
    console.log('  ⚠ AGENTS.md already exists');
    
    const shouldOverwrite = await promptYesNo('  Do you want to overwrite it with Powerlevel template?');
    
    if (!shouldOverwrite) {
      console.log('  Skipping AGENTS.md creation');
      return;
    }
  }

  // Read template
  let template;
  try {
    template = readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`  ❌ Failed to read template: ${error.message}`);
    return;
  }

  // Replace placeholders
  const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const content = template
    .replace(/\{\{PROJECT_NAME\}\}/g, `${repoInfo.owner}/${repoInfo.repo}`)
    .replace(/\{\{OWNER\}\}/g, repoInfo.owner)
    .replace(/\{\{REPO\}\}/g, repoInfo.repo)
    .replace(/\{\{ONBOARDED_DATE\}\}/g, now);

  // Write AGENTS.md
  try {
    writeFileSync(agentsPath, content, 'utf8');
    if (existsSync(agentsPath) && !force) {
      console.log('  ✓ Updated AGENTS.md with Powerlevel integration');
    } else {
      console.log('  ✓ Created AGENTS.md with Powerlevel integration');
    }
  } catch (error) {
    console.error(`  ❌ Failed to write AGENTS.md: ${error.message}`);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Onboarding project to Superpowers...\n');

  // Parse CLI arguments
  const args = parseArgs();

  // Detect current repository
  const cwd = process.cwd();
  const repoInfo = detectRepo(cwd);

  if (!repoInfo) {
    console.error('❌ Error: Not in a git repository');
    console.error('   Please run this script from within a git repository');
    process.exit(1);
  }

  console.log(`✓ Found git repository: ${repoInfo.owner}/${repoInfo.repo}`);

  // Load configuration
  let config;
  let configSource;
  
  try {
    if (args.configPath) {
      // Custom config path - read and merge with defaults manually
      configSource = args.configPath;
      const configContent = readFileSync(args.configPath, 'utf8');
      const userConfig = JSON.parse(configContent);
      
      // Merge with defaults
      const defaultConfig = {
        superpowers: {
          enabled: false,
          remote: 'superpowers',
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
        }
      };
      
      config = mergeConfig(defaultConfig, userConfig);
      validateConfig(config);
    } else {
      configSource = '.opencode/config.json';
      config = loadConfig(cwd);
    }
    
    console.log(`✓ Loaded configuration from ${configSource}`);
  } catch (error) {
    if (error.message.includes('Invalid JSON') || error.message.includes('must be')) {
      console.error(`❌ Error: ${error.message}`);
      process.exit(1);
    }
    // If config doesn't exist, we'll create it later
    console.log('  ⚠ No configuration found, will create default config');
    configSource = '.opencode/config.json';
    config = {
      superpowers: {
        enabled: false,
        remote: 'superpowers',
        repoUrl: 'git@github.com:castrojo/superpowers.git',
        autoOnboard: false,
        wikiSync: true
      }
    };
  }

  // Check if superpowers is enabled
  if (!config.superpowers.enabled && !args.force) {
    console.log('\n⚠ Superpowers is not enabled in configuration');
    console.log('  To enable, set "superpowers.enabled" to true in .opencode/config.json');
    console.log('  Or run with --force to proceed anyway');
    process.exit(0);
  }

  // Validate repoUrl
  const remoteName = config.superpowers.remote || 'superpowers';
  const repoUrl = config.superpowers.repoUrl;

  if (!repoUrl) {
    console.error('❌ Error: superpowers.repoUrl is not configured');
    console.error('   Please set "superpowers.repoUrl" in .opencode/config.json');
    console.error('   Example: "git@github.com:castrojo/superpowers.git"');
    process.exit(1);
  }

  // Check if remote already exists
  const remoteExists = hasRemote(remoteName, cwd);

  if (remoteExists) {
    const existingUrl = getRemoteUrl(remoteName, cwd);
    console.log(`\n⚠ Remote '${remoteName}' already exists: ${existingUrl}`);

    if (existingUrl === repoUrl) {
      console.log('  Remote URL matches configuration, skipping remote creation');
    } else {
      console.log(`  Configuration URL: ${repoUrl}`);

      if (!args.force) {
        const shouldReconfigure = await promptYesNo('  Do you want to update the remote URL?');
        
        if (!shouldReconfigure) {
          console.log('  Skipping remote update');
          process.exit(0);
        }

        // Remove existing remote
        try {
          execFileSync('git', ['remote', 'remove', remoteName], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          console.log(`  ✓ Removed existing remote '${remoteName}'`);
        } catch (error) {
          console.error(`  ❌ Failed to remove remote: ${error.message}`);
          process.exit(1);
        }
      } else {
        // Force flag: remove and re-add
        try {
          execFileSync('git', ['remote', 'remove', remoteName], {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe']
          });
          console.log(`  ✓ Removed existing remote '${remoteName}' (--force)`);
        } catch (error) {
          console.error(`  ❌ Failed to remove remote: ${error.message}`);
          process.exit(1);
        }
      }
    }
  }

  // Add remote if it doesn't exist (or was just removed)
  if (!hasRemote(remoteName, cwd)) {
    console.log(`\nAdding remote '${remoteName}'...`);
    try {
      addRemote(remoteName, repoUrl, cwd);
      console.log(`  ✓ Added remote '${remoteName}' → ${repoUrl}`);
    } catch (error) {
      console.error(`  ❌ ${error.message}`);
      process.exit(1);
    }
  }

  // Fetch from remote
  console.log(`\nFetching from remote '${remoteName}'...`);
  try {
    fetchRemote(remoteName, cwd);
    console.log(`  ✓ Fetched from remote '${remoteName}'`);
  } catch (error) {
    console.error(`  ❌ ${error.message}`);
    console.error('  This could be due to:');
    console.error('    - Network connectivity issues');
    console.error('    - Incorrect repository URL');
    console.error('    - Missing SSH keys or authentication');
    process.exit(1);
  }

  // Get list of branches
  const branches = getRemoteBranches(remoteName, cwd);
  if (branches.length > 0) {
    console.log(`  ✓ Available branches: ${branches.join(', ')}`);
  }

  // Create stub documentation
  console.log('\nCreating documentation...');
  try {
    createStubDocumentation(cwd);
  } catch (error) {
    console.error(`  ⚠ Warning: Failed to create documentation: ${error.message}`);
  }

  // Create default configuration if it doesn't exist
  console.log('\nSetting up configuration...');
  try {
    createDefaultConfig(cwd, repoUrl);
  } catch (error) {
    console.error(`  ⚠ Warning: Failed to create config: ${error.message}`);
  }

  // Create AGENTS.md from template
  console.log('\nCreating AGENTS.md...');
  try {
    await createAgentsFile(cwd, repoInfo, args.force);
  } catch (error) {
    console.error(`  ⚠ Warning: Failed to create AGENTS.md: ${error.message}`);
  }

  // Success!
  console.log('\n✅ Onboarding complete! You can now access superpowers context.\n');
  console.log('Next steps:');
  console.log(`  1. View remote: git remote -v`);
  console.log(`  2. List branches: git branch -r | grep ${remoteName}`);
  console.log(`  3. View configuration: cat .opencode/config.json`);
  console.log(`  4. Review AGENTS.md: cat AGENTS.md`);
  console.log(`  5. Check best practices: https://github.com/castrojo/powerlevel/blob/main/docs/best-practices/README.md`);
  console.log('');
}

// Run main function
main().catch(error => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
