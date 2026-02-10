#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync } from 'child_process';
import { loadConfig } from '../lib/config-loader.js';
import { detectRepo } from '../lib/repo-detector.js';
import { wikiExists, cloneWiki, syncSkillsToWiki, commitAndPushWiki } from '../lib/wiki-manager.js';
import { hasRemote, fetchRemote, getRemoteUrl } from '../lib/remote-manager.js';

/**
 * Parse command line arguments
 * @returns {{force: boolean, dryRun: boolean, repo: string | null, help: boolean}}
 */
function parseArgs() {
  const args = {
    force: false,
    dryRun: false,
    repo: null,
    help: false
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') {
      args.force = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--repo=')) {
      args.repo = arg.split('=')[1];
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      console.error(`❌ Unknown argument: ${arg}`);
      console.error('   Run with --help for usage information');
      process.exit(1);
    }
  }

  return args;
}

/**
 * Display help message
 */
function showHelp() {
  console.log('Usage: node bin/sync-wiki.js [options]');
  console.log('');
  console.log('Syncs skills and documentation from the superpowers repo to the project\'s GitHub wiki.');
  console.log('');
  console.log('Options:');
  console.log('  --force            Override config.wiki.autoSync check and proceed anyway');
  console.log('  --dry-run          Show what would be synced without actually pushing changes');
  console.log('  --repo=owner/repo  Explicit target repository (defaults to current git origin)');
  console.log('  --help, -h         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  node bin/sync-wiki.js');
  console.log('  node bin/sync-wiki.js --dry-run');
  console.log('  node bin/sync-wiki.js --force');
  console.log('  node bin/sync-wiki.js --repo=castrojo/my-project');
  console.log('');
  console.log('Configuration:');
  console.log('  The script respects settings in .opencode/config.json:');
  console.log('  - wiki.autoSync: Enable/disable automatic syncing');
  console.log('  - wiki.includeSkills: Sync skills from superpowers remote');
  console.log('  - wiki.includeDocs: Sync docs from project docs/ directory');
  console.log('  - superpowers.remote: Name of the superpowers remote (default: "superpowers")');
  console.log('');
}

/**
 * Parse repo string (owner/repo) into components
 * @param {string} repoStr - Repository in "owner/repo" format
 * @returns {{owner: string, repo: string} | null}
 */
function parseRepoString(repoStr) {
  if (!repoStr || typeof repoStr !== 'string') {
    return null;
  }

  const parts = repoStr.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  return {
    owner: parts[0],
    repo: parts[1]
  };
}

/**
 * Extract skills from superpowers remote to a temporary directory
 * Uses git archive to extract files without a full checkout
 * @param {string} remoteName - Name of superpowers remote
 * @param {string} cwd - Current working directory
 * @returns {string} Path to temporary skills directory
 */
function extractSkillsFromRemote(remoteName, cwd) {
  const tempDir = join(cwd, '.git', 'temp-superpowers-skills');
  
  // Create temp directory if it doesn't exist
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  try {
    // Use git show to list files in the remote's skills directory
    // We'll extract the skills/ directory structure from the remote
    const remoteRef = `${remoteName}/main:skills`;
    
    // Get list of skill directories from remote
    const lsTreeOutput = execFileSync('git', ['ls-tree', '-d', '--name-only', remoteRef], {
      cwd,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    const skillDirs = lsTreeOutput.split('\n').filter(line => line.trim());

    // Extract each skill's SKILL.md file
    for (const skillDir of skillDirs) {
      const skillPath = join(tempDir, skillDir);
      if (!existsSync(skillPath)) {
        mkdirSync(skillPath, { recursive: true });
      }

      try {
        // Extract SKILL.md for this skill
        const skillFileRef = `${remoteName}/main:skills/${skillDir}/SKILL.md`;
        const content = execFileSync('git', ['show', skillFileRef], {
          cwd,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe']
        });

        writeFileSync(join(skillPath, 'SKILL.md'), content, 'utf8');
        console.log(`  ✓ Extracted ${skillDir}/SKILL.md`);
      } catch (error) {
        console.log(`  ⚠ Skipping ${skillDir}: no SKILL.md found`);
      }
    }

    return tempDir;
  } catch (error) {
    throw new Error(`Failed to extract skills from remote '${remoteName}': ${error.message}`);
  }
}

/**
 * Sync documentation files to wiki
 * @param {string} docsDir - Path to docs directory
 * @param {string} wikiDir - Path to wiki directory
 * @returns {number} Number of docs synced
 */
function syncDocsToWiki(docsDir, wikiDir) {
  if (!existsSync(docsDir)) {
    console.log('  ⚠ docs/ directory not found, skipping docs sync');
    return 0;
  }

  let syncedCount = 0;

  // Read all markdown files in docs directory (non-recursive for now)
  const entries = readdirSync(docsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const docFile = join(docsDir, entry.name);
    const wikiPagePath = join(wikiDir, entry.name);

    // Copy doc file to wiki
    const content = readFileSync(docFile, 'utf8');
    writeFileSync(wikiPagePath, content, 'utf8');

    console.log(`  Synced ${entry.name}`);
    syncedCount++;
  }

  return syncedCount;
}

/**
 * Generate dry-run output showing what would be synced
 * @param {Object} params - Sync parameters
 */
function showDryRunOutput(params) {
  const { owner, repo, superpowersRemote, superpowersUrl, includeSkills, includeDocs, skillsCount, docsCount } = params;

  console.log('\n🔍 Dry run mode - showing what would be synced:\n');
  console.log(`Target: ${owner}/${repo} wiki`);
  console.log(`Source: ${superpowersRemote} remote (${superpowersUrl})\n`);

  if (includeSkills && skillsCount > 0) {
    console.log('Skills to sync:');
    console.log(`  ✓ ${skillsCount} skill file(s) from superpowers remote`);
  } else if (includeSkills) {
    console.log('Skills to sync:');
    console.log('  ⚠ No skills found');
  }

  if (includeDocs && docsCount > 0) {
    console.log('\nDocs to sync:');
    console.log(`  ✓ ${docsCount} documentation file(s) from docs/ directory`);
  } else if (includeDocs) {
    console.log('\nDocs to sync:');
    console.log('  ⚠ No docs found');
  }

  const today = new Date().toISOString().split('T')[0];
  console.log(`\nWould commit with message: "Sync from superpowers (${today})"`);
  console.log('\n✓ Dry run complete - no changes were pushed');
}

/**
 * Main function
 */
async function main() {
  // Parse CLI arguments
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log('📚 Syncing wiki from superpowers...\n');

  // Get current working directory
  const cwd = process.cwd();

  // Load configuration
  let config;
  try {
    config = loadConfig(cwd);
    console.log('✓ Loaded configuration from .opencode/config.json');
  } catch (error) {
    console.error('❌ Error loading configuration:', error.message);
    console.error('   Run: node bin/onboard-project.js');
    process.exit(1);
  }

  // Check if wiki auto-sync is enabled (unless --force)
  if (!config.wiki.autoSync && !args.force) {
    console.log('\n⚠ Wiki auto-sync is disabled in configuration');
    console.log('  To enable, set "wiki.autoSync" to true in .opencode/config.json');
    console.log('  Or run with --force to sync anyway\n');
    process.exit(0);
  }

  if (args.force && !config.wiki.autoSync) {
    console.log('  ⚠ wiki.autoSync is disabled, but --force flag provided\n');
  }

  // Detect target repository
  let repoInfo;
  if (args.repo) {
    repoInfo = parseRepoString(args.repo);
    if (!repoInfo) {
      console.error('❌ Error: Invalid --repo format');
      console.error('   Expected: owner/repo (e.g., castrojo/my-project)');
      process.exit(1);
    }
    console.log(`✓ Using explicit repo: ${repoInfo.owner}/${repoInfo.repo}`);
  } else {
    repoInfo = detectRepo(cwd);
    if (!repoInfo) {
      console.error('❌ Error: Could not detect repository');
      console.error('   Please specify --repo=owner/repo or run from a git repository');
      process.exit(1);
    }
    console.log(`✓ Detected repo: ${repoInfo.owner}/${repoInfo.repo}`);
  }

  // Check if superpowers remote exists
  const superpowersRemote = config.superpowers.remote || 'superpowers';
  
  if (!hasRemote(superpowersRemote, cwd)) {
    console.error(`\n❌ Error: Remote '${superpowersRemote}' not found`);
    console.error('   Please run: node bin/onboard-project.js');
    console.error('   This will set up the superpowers remote');
    process.exit(1);
  }

  const superpowersUrl = getRemoteUrl(superpowersRemote, cwd);
  console.log(`✓ Found superpowers remote: ${superpowersUrl}`);

  // Fetch from superpowers remote if includeSkills is enabled
  if (config.wiki.includeSkills) {
    console.log(`\nFetching from remote '${superpowersRemote}'...`);
    try {
      fetchRemote(superpowersRemote, cwd);
      console.log(`  ✓ Fetched latest from '${superpowersRemote}'`);
    } catch (error) {
      console.error(`  ❌ Failed to fetch: ${error.message}`);
      console.error('  This could be due to:');
      console.error('    - Network connectivity issues');
      console.error('    - Incorrect remote URL');
      console.error('    - Missing SSH keys or authentication');
      process.exit(1);
    }
  }

  // Check if wiki exists
  console.log(`\nChecking if wiki exists for ${repoInfo.owner}/${repoInfo.repo}...`);
  const hasWiki = wikiExists(repoInfo.owner, repoInfo.repo);

  if (!hasWiki) {
    console.error(`\n❌ Error: Wiki is not enabled for ${repoInfo.owner}/${repoInfo.repo}`);
    console.error('   To enable the wiki:');
    console.error(`   1. Go to: https://github.com/${repoInfo.owner}/${repoInfo.repo}/settings`);
    console.error('   2. Scroll to "Features"');
    console.error('   3. Check "Wikis"');
    console.error('   4. Create at least one wiki page (Home)');
    process.exit(1);
  }

  console.log('  ✓ Wiki is enabled and accessible');

  // Clone or update wiki
  console.log('\nCloning/updating wiki...');
  let wikiDir;
  try {
    wikiDir = cloneWiki(repoInfo.owner, repoInfo.repo);
    console.log(`  ✓ Wiki ready at: ${wikiDir}`);
  } catch (error) {
    console.error(`  ❌ ${error.message}`);
    process.exit(1);
  }

  // Track sync statistics
  let totalSynced = 0;
  let skillsCount = 0;
  let docsCount = 0;

  // Sync skills if enabled
  if (config.wiki.includeSkills) {
    console.log('\nSyncing skills from superpowers remote...');
    try {
      const skillsDir = extractSkillsFromRemote(superpowersRemote, cwd);
      skillsCount = syncSkillsToWiki(skillsDir, wikiDir);
      totalSynced += skillsCount;
      console.log(`  ✓ Synced ${skillsCount} skill file(s)`);
    } catch (error) {
      console.error(`  ❌ Failed to sync skills: ${error.message}`);
      // Continue even if skills sync fails
    }
  } else {
    console.log('\n⚠ Skipping skills sync (wiki.includeSkills = false)');
  }

  // Sync docs if enabled
  if (config.wiki.includeDocs) {
    console.log('\nSyncing documentation files...');
    try {
      const docsDir = join(cwd, 'docs');
      docsCount = syncDocsToWiki(docsDir, wikiDir);
      totalSynced += docsCount;
      if (docsCount > 0) {
        console.log(`  ✓ Synced ${docsCount} documentation file(s)`);
      }
    } catch (error) {
      console.error(`  ❌ Failed to sync docs: ${error.message}`);
      // Continue even if docs sync fails
    }
  } else {
    console.log('\n⚠ Skipping docs sync (wiki.includeDocs = false)');
  }

  // Show dry-run output and exit if --dry-run
  if (args.dryRun) {
    showDryRunOutput({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      superpowersRemote,
      superpowersUrl,
      includeSkills: config.wiki.includeSkills,
      includeDocs: config.wiki.includeDocs,
      skillsCount,
      docsCount
    });
    process.exit(0);
  }

  // Commit and push changes
  if (totalSynced === 0) {
    console.log('\n✓ Wiki is already up to date - no changes to sync');
    process.exit(0);
  }

  console.log('\nCommitting and pushing changes...');
  const today = new Date().toISOString().split('T')[0];
  const commitMessage = `Sync from superpowers (${today})`;

  try {
    const hasChanges = commitAndPushWiki(wikiDir, commitMessage);
    
    if (hasChanges) {
      console.log(`  ✓ Pushed ${totalSynced} file(s) to wiki`);
      console.log(`\n✅ Wiki sync complete!`);
      console.log(`   View wiki: https://github.com/${repoInfo.owner}/${repoInfo.repo}/wiki`);
    } else {
      console.log('\n✓ No changes detected - wiki is already up to date');
    }
  } catch (error) {
    console.error(`  ❌ Failed to commit/push: ${error.message}`);
    console.error('  This could be due to:');
    console.error('    - Network connectivity issues');
    console.error('    - Missing write permissions to wiki');
    console.error('    - Git authentication issues');
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
