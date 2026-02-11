#!/usr/bin/env node

import { locatePowerlevelRepo, promptYesNo } from '../lib/powerlevel-locator.js';
import { 
  selectTrackingTarget, 
  detectForkRelationship 
} from '../lib/fork-detector.js';
import {
  generateProjectName,
  fetchRepoMetadata,
  detectTechStack,
  validateProjectConfig,
  projectExists,
  promptForProjectName,
  createProjectConfig
} from '../lib/project-config-manager.js';
import { createTrackingEpic } from '../lib/github-cli.js';
import { ensureProjectLabel } from '../lib/label-manager.js';
import { 
  fetchExternalIssues, 
  generateExternalEpicBody 
} from '../lib/external-tracker.js';
import { detectRepo } from '../lib/repo-detector.js';
import { detectProjectBoard } from '../lib/project-board-detector.js';
import { 
  getIssueNodeId, 
  addIssueToProject, 
  updateProjectItemField 
} from '../lib/project-item-manager.js';
import { getProjectFields, mapLabelToField } from '../lib/project-field-manager.js';
import { loadCache, addEpic, saveCache } from '../lib/cache-manager.js';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {
    externalRepo: null,
    name: null,
    fork: null,
    description: null,
    priority: 'p2',
    techStack: null,
    auto: false,
    dryRun: false,
    force: false,
    noBoard: false,
    help: false
  };
  
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--auto') {
      args.auto = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg === '--no-board') {
      args.noBoard = true;
    } else if (arg === '--name') {
      args.name = process.argv[++i];
    } else if (arg === '--fork') {
      args.fork = process.argv[++i];
    } else if (arg === '--description') {
      args.description = process.argv[++i];
    } else if (arg === '--priority') {
      args.priority = process.argv[++i];
    } else if (arg === '--tech-stack') {
      args.techStack = process.argv[++i].split(',').map(s => s.trim());
    } else if (!arg.startsWith('--') && !args.externalRepo) {
      args.externalRepo = arg;
    }
  }
  
  return args;
}

/**
 * Format repo object to string
 */
function formatRepo(repoObj) {
  return `${repoObj.owner}/${repoObj.repo}`;
}

/**
 * Get priority display name
 */
function getPriorityName(priority) {
  const names = {
    p0: 'Critical',
    p1: 'High',
    p2: 'Medium',
    p3: 'Low'
  };
  return names[priority] || priority;
}

/**
 * Show help text
 */
function showHelp() {
  console.log(`
track-project.js - Register external repository for tracking in Powerlevel

USAGE:
  node bin/track-project.js <external-repo> [options]
  node bin/track-project.js --auto [options]

ARGUMENTS:
  <external-repo>          External repo to track (owner/repo format)

OPTIONS:
  --name <name>            Project slug for directory/label (auto-generated if omitted)
  --fork <fork-repo>       Your fork of the upstream (auto-detected if in fork's directory)
  --description <text>     Project description (fetched from GitHub if omitted)
  --priority <p0-p3>       Priority for tracking epic (default: p2)
  --tech-stack <csv>       Comma-separated tech stack tags
  --auto                   Auto-detect everything from current directory
  --dry-run                Show what would be created without making changes
  --force                  Overwrite existing project config
  --no-board               Skip project board integration
  --help                   Show this help

EXAMPLES:
  # Explicit mode (all info provided)
  node bin/track-project.js projectbluefin/documentation \\
    --name bluefin-docs \\
    --fork castrojo/documentation \\
    --priority p1

  # Auto-detection mode (run from fork's working directory)
  cd ~/src/bluefin-docs
  node ~/src/powerlevel/bin/track-project.js --auto

  # Minimal mode (just upstream, generate defaults)
  node bin/track-project.js projectbluefin/documentation --name bluefin-docs

  # Dry-run mode (preview without changes)
  node bin/track-project.js cncf/toc --name cncf-toc --dry-run

WORKFLOW:
  1. Detects/validates external repo
  2. Generates project name (or uses --name)
  3. Fetches repo metadata from GitHub
  4. Creates projects/{name}/config.json
  5. Creates tracking epic in Powerlevel
  6. Adds epic to project board
  7. Auto-syncs issues on session start

FORK WORKFLOW:
  When tracking a fork:
  - Upstream repo is tracked (where real work happens)
  - Fork is referenced (for PR workflow context)
  - Auto-detection finds 'upstream' remote

For more info: https://github.com/castrojo/powerlevel/blob/main/AGENTS.md
`);
}

/**
 * Show preview
 */
function showPreview({ trackingInfo, projectName, config, issueCount, powerlevelPath, args }) {
  console.log('\n' + '═'.repeat(60));
  console.log('📦 Project Configuration Preview');
  console.log('═'.repeat(60) + '\n');
  
  console.log('Tracking Target:');
  console.log(`  Upstream:     ${formatRepo(trackingInfo.target)}`);
  if (trackingInfo.fork) {
    console.log(`  Your Fork:    ${formatRepo(trackingInfo.fork)}`);
  }
  console.log(`  Description:  "${config.description}"`);
  
  console.log('\nProject Settings:');
  console.log(`  Name:         ${projectName}`);
  console.log(`  Label:        ${config.labels.project}`);
  console.log(`  Priority:     ${args.priority} - ${getPriorityName(args.priority)}`);
  if (config.tech_stack && config.tech_stack.length > 0) {
    console.log(`  Tech Stack:   ${config.tech_stack.join(', ')}`);
  }
  
  console.log('\nWill Create:');
  console.log(`  ✓ ${powerlevelPath}/projects/${projectName}/config.json`);
  console.log(`  ✓ ${powerlevelPath}/projects/${projectName}/plans/`);
  console.log(`  ✓ Epic in powerlevel repository`);
  if (!args.noBoard) {
    console.log(`  ✓ Project board entry`);
  }
  
  console.log(`\nFetched Issues: ${issueCount} open issues from upstream`);
  
  console.log('\n' + '═'.repeat(60));
}

/**
 * Show success summary
 */
function showSuccessSummary({ projectName, epicNumber, powerlevelRepo, trackingInfo }) {
  console.log('\n' + '✅ '.repeat(30));
  console.log('🎉 Project tracking successfully configured!');
  console.log('✅ '.repeat(30) + '\n');
  
  console.log('Created:');
  console.log(`  📁 projects/${projectName}/`);
  console.log(`  📊 Epic #${epicNumber}: https://github.com/${formatRepo(powerlevelRepo)}/issues/${epicNumber}`);
  
  console.log('\nNext Steps:');
  console.log(`  1. Review epic: gh issue view ${epicNumber} --repo ${formatRepo(powerlevelRepo)}`);
  console.log(`  2. View config: cat projects/${projectName}/config.json`);
  console.log(`  3. Create first plan: mkdir -p projects/${projectName}/plans/`);
  console.log(`  4. Start session in fork to contribute upstream`);
  
  if (trackingInfo.fork) {
    console.log('\n💡 Fork Workflow:');
    console.log(`  - Work happens in: ${formatRepo(trackingInfo.target)} (upstream)`);
    console.log(`  - You contribute via: ${formatRepo(trackingInfo.fork)} (fork)`);
    console.log(`  - PRs tracked automatically in Epic #${epicNumber}`);
  }
  
  console.log('');
}

/**
 * Add epic to project board
 */
async function addToProjectBoard(powerlevelPath, powerlevelRepo, epicNumber, priority) {
  try {
    console.log('📋 Adding to project board...');
    
    // Detect project board
    const projectBoard = detectProjectBoard(powerlevelRepo.owner);
    
    if (!projectBoard) {
      console.log('  ⚠ No project board found, skipping');
      return;
    }
    
    console.log(`  Using project: ${projectBoard.title}`);
    
    // Get issue node ID
    const repoPath = formatRepo(powerlevelRepo);
    const issueNodeId = getIssueNodeId(repoPath, epicNumber);
    if (!issueNodeId) {
      throw new Error('Failed to get issue node ID');
    }
    
    // Add epic to project
    const itemId = addIssueToProject(projectBoard.id, issueNodeId);
    
    if (itemId) {
      console.log('  ✓ Added epic to project board');
      
      // Get project fields
      const projectFields = getProjectFields(powerlevelRepo.owner, projectBoard.number);
      
      if (projectFields) {
        // Set Status field (primary field)
        const statusMapping = mapLabelToField('status/planning', projectFields);
        
        if (statusMapping) {
          const success = updateProjectItemField(
            projectBoard.id,
            itemId,
            statusMapping.fieldId,
            statusMapping.optionId
          );
          
          if (success) {
            console.log(`  ✓ Set Status: ${statusMapping.optionName}`);
          }
        }
      }
    }
  } catch (error) {
    console.error(`  ✗ Failed to add to project board: ${error.message}`);
    console.log('  (Epic creation succeeded - project board is optional)');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Track External Project in Powerlevel\n');
  
  // 1. Parse arguments
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    process.exit(0);
  }
  
  // 2. Locate Powerlevel repo
  console.log('🔍 Locating Powerlevel repository...');
  const powerlevelPath = await locatePowerlevelRepo();
  if (!powerlevelPath) {
    console.error('\n❌ Powerlevel repository not found');
    process.exit(4);
  }
  console.log(`✓ Found Powerlevel: ${powerlevelPath}\n`);
  
  // 3. Determine tracking target
  let trackingInfo;
  if (args.auto) {
    console.log('🔍 Auto-detecting from current directory...');
    const cwd = process.cwd();
    trackingInfo = selectTrackingTarget(cwd);
    if (!trackingInfo.target) {
      console.error('❌ Could not detect repo to track');
      console.error('   Try specifying explicitly: track-project.js owner/repo');
      process.exit(1);
    }
    
    const forkInfo = detectForkRelationship(cwd);
    if (forkInfo.isDetected) {
      console.log('✓ Detected fork relationship:');
      console.log(`  - Upstream: ${formatRepo(forkInfo.upstream)}`);
      console.log(`  - Fork: ${formatRepo(forkInfo.fork)}`);
      console.log(`  - Confidence: ${forkInfo.confidence} (${forkInfo.reasoning})`);
    }
  } else if (args.externalRepo) {
    const [owner, repo] = args.externalRepo.split('/');
    if (!owner || !repo) {
      console.error('❌ Invalid repo format (expected: owner/repo)');
      process.exit(1);
    }
    trackingInfo = {
      target: { owner, repo },
      fork: args.fork ? (() => {
        const [forkOwner, forkRepo] = args.fork.split('/');
        return { owner: forkOwner, repo: forkRepo };
      })() : null,
      reasoning: 'Explicit CLI argument'
    };
  } else {
    console.error('❌ No repository specified');
    console.error('   Use: track-project.js owner/repo');
    console.error('   Or:  track-project.js --auto');
    process.exit(1);
  }
  
  // 4. Validate external repo exists
  console.log(`\n🔍 Validating ${formatRepo(trackingInfo.target)}...`);
  const metadata = fetchRepoMetadata(
    trackingInfo.target.owner,
    trackingInfo.target.repo
  );
  if (!metadata) {
    console.error('❌ Repository not found or not accessible');
    console.error(`   Check: https://github.com/${formatRepo(trackingInfo.target)}`);
    process.exit(1);
  }
  console.log('✓ Repository validated');
  
  // 5. Generate project name
  let projectName = args.name;
  if (!projectName) {
    projectName = generateProjectName(
      trackingInfo.target.owner,
      trackingInfo.target.repo
    );
    console.log(`💡 Generated project name: ${projectName}`);
  }
  
  // 6. Check for collisions
  if (projectExists(powerlevelPath, projectName)) {
    if (!args.force) {
      console.error(`\n⚠️  Project '${projectName}' already exists\n`);
      console.error('Options:');
      console.error('  1. Use --force to overwrite');
      console.error('  2. Use --name to choose different name');
      console.error(`  3. Check existing: cat ${powerlevelPath}/projects/${projectName}/config.json`);
      
      // Prompt for new name
      projectName = await promptForProjectName(projectName, powerlevelPath);
      console.log(`✓ Using project name: ${projectName}`);
    } else {
      console.log(`⚠️  Overwriting existing project '${projectName}' (--force)`);
    }
  }
  
  // 7. Gather metadata
  const description = args.description || metadata.description || 
                      `Tracking ${formatRepo(trackingInfo.target)}`;
  const techStack = args.techStack || detectTechStack(metadata, trackingInfo.target.repo);
  
  // 8. Build config
  const config = {
    repo: formatRepo(trackingInfo.target),
    ...(trackingInfo.fork ? { fork: formatRepo(trackingInfo.fork) } : {}),
    active: true,
    labels: {
      project: `project/${projectName}`
    },
    description,
    tech_stack: techStack,
    tracking: {
      auto_sync: true,
      sync_interval: 'session'
    }
  };
  
  // 9. Validate config
  const validation = validateProjectConfig(config);
  if (!validation.valid) {
    console.error('\n❌ Invalid configuration:');
    validation.errors.forEach(err => console.error(`   - ${err}`));
    process.exit(1);
  }
  
  // 10. Fetch external issues
  console.log(`\n🔍 Fetching issues from ${formatRepo(trackingInfo.target)}...`);
  const issues = fetchExternalIssues(formatRepo(trackingInfo.target));
  console.log(`✓ Found ${issues.length} open issues`);
  
  // 11. Show preview
  showPreview({
    trackingInfo,
    projectName,
    config,
    issueCount: issues.length,
    powerlevelPath,
    args
  });
  
  // 12. Confirm (unless dry-run)
  if (args.dryRun) {
    console.log('\n🔍 Dry-run mode - no changes made');
    process.exit(0);
  }
  
  const proceed = await promptYesNo('\nProceed with creation?');
  if (!proceed) {
    console.log('Cancelled');
    process.exit(0);
  }
  
  // 13. Create project config
  console.log('\n📝 Creating project configuration...');
  createProjectConfig(powerlevelPath, projectName, config);
  console.log(`✓ Created projects/${projectName}/config.json`);
  console.log(`✓ Created projects/${projectName}/plans/`);
  
  // 14. Create tracking epic
  console.log('\n📊 Creating tracking epic...');
  const powerlevelRepo = detectRepo(powerlevelPath);
  const repoPath = formatRepo(powerlevelRepo);
  
  // Ensure project label exists before creating epic
  console.log(`  Creating project label: project/${projectName}...`);
  ensureProjectLabel(repoPath, projectName, description);
  console.log(`  ✓ Project label ready`);
  
  const epicTitle = `Track: ${metadata.name || trackingInfo.target.repo}`;
  const epicBody = generateExternalEpicBody(
    formatRepo(trackingInfo.target),
    description,
    issues
  );
  const epicNumber = createTrackingEpic(
    repoPath,
    epicTitle,
    epicBody,
    ['type/epic', `project/${projectName}`, `priority/${args.priority}`]
  );
  console.log(`✓ Created Epic #${epicNumber}`);
  
  // 15. Add to project board (if enabled)
  if (!args.noBoard) {
    console.log('');
    await addToProjectBoard(powerlevelPath, powerlevelRepo, epicNumber, args.priority);
  }
  
  // 16. Update cache
  console.log('\n💾 Updating cache...');
  const cache = loadCache(powerlevelRepo.owner, powerlevelRepo.repo);
  addEpic(cache, {
    number: epicNumber,
    title: epicTitle,
    labels: ['type/epic', `project/${projectName}`, `priority/${args.priority}`],
    state: 'open',
    created_at: new Date().toISOString()
  });
  saveCache(powerlevelRepo.owner, powerlevelRepo.repo, cache);
  console.log('✓ Cache updated');
  
  // 17. Success!
  showSuccessSummary({
    projectName,
    epicNumber,
    powerlevelRepo,
    trackingInfo
  });
}

// Run main
main().catch(error => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  console.error('');
  if (error.stack) {
    console.error('Stack trace:');
    console.error(error.stack);
  }
  process.exit(1);
});
