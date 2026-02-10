# Agent Context Discovery

## Overview

Agent Context Discovery enables AI agents (like OpenCode assistants) to automatically discover and utilize contextual information from multiple sources. This helps agents work more effectively by providing them with relevant skills, patterns, workflows, and project-specific knowledge.

**Why This Matters:**
- **Better Decision Making**: Agents access proven patterns and workflows
- **Consistency**: Agents follow project conventions and standards
- **Efficiency**: Agents don't need to ask for context that's already available
- **Quality**: Agents apply battle-tested skills instead of improvising

## How It Works

### Discovery Process

```
┌─────────────────────────────────────────────────────────────┐
│  1. Plugin Initialization (Session Start)                   │
│     - Load .opencode/config.json                            │
│     - Check if superpowers.enabled = true                   │
│     - Verify superpowers remote exists                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Context Collection                                      │
│     - Fetch from superpowers remote (if configured)         │
│     - Clone project wiki (if wikiSync enabled)              │
│     - Load implementation plans (.opencode/plans/)          │
│     - Read project documentation (docs/)                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Cache Management                                        │
│     - Store in ~/.cache/opencode-superpower/                │
│     - Check TTL (Time To Live) - default 1 hour             │
│     - Refresh if expired or force-refresh requested         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Agent Access                                            │
│     - Agent reads cached context as needed                  │
│     - Skills invoked via skill system                       │
│     - Patterns referenced in decision making                │
│     - Plans guide implementation work                       │
└─────────────────────────────────────────────────────────────┘
```

### TTL-Based Refresh

Context is cached locally with a Time To Live (TTL):

- **Default TTL**: 1 hour
- **Trigger**: Session start, skill invocation, manual refresh
- **Behavior**: If cache is older than TTL, refresh from sources
- **Benefits**: Fast local access with periodic updates

## Context Sources

### 1. Superpowers Wiki (Skills & Patterns)

**Location**: Cached from superpowers remote wiki
**Content**: 
- Skills (e.g., `epic-creation`, `land-the-plane`, `writing-plans`)
- Workflow patterns
- Best practices
- Shared knowledge across all projects

**How Agents Use It**:
- Invoke skills when appropriate tasks arise
- Reference patterns for implementation decisions
- Follow established workflows for common tasks

**Example**:
```
Agent sees: "Create a new epic from the plan"
Agent thinks: "I should use the epic-creation skill"
Agent invokes: skill tool with 'epic-creation'
```

### 2. Project Wiki (Project-Specific Context)

**Location**: Cached from project's GitHub wiki
**Content**:
- Project architecture documentation
- API references
- Domain-specific patterns
- Team conventions and standards

**How Agents Use It**:
- Understand project structure before making changes
- Follow project-specific naming conventions
- Apply domain knowledge to implementation

**Example**:
```
Agent sees: "Add a new API endpoint"
Agent reads: Project wiki's API documentation
Agent follows: Established patterns for routing, validation, error handling
```

### 3. Implementation Plans (Epic Tracking)

**Location**: `.opencode/plans/` directory in project
**Content**:
- Epic plans with goals and task breakdowns
- Task dependencies and sequencing
- Context for current work
- References to related issues

**How Agents Use It**:
- Understand the big picture for current work
- Follow task sequence defined in plan
- Update epic tracking as tasks complete
- Add journey updates to plans

**Example**:
```
Agent reads: .opencode/plans/2026-02-09-wiki-sync-and-context-discovery.md
Agent understands: This is Task 10 of 12
Agent knows: What tasks came before, what comes next
Agent updates: Journey section when task completes
```

### 4. Local Documentation (Project Docs)

**Location**: `docs/` directory in project
**Content**:
- README files
- Architecture documents (AGENTS.md, ARCHITECTURE.md)
- Configuration guides
- Troubleshooting guides

**How Agents Use It**:
- Learn project architecture and design decisions
- Understand configuration options
- Reference troubleshooting guides for common issues

**Example**:
```
Agent sees: Error in plugin initialization
Agent reads: docs/TROUBLESHOOTING.md
Agent applies: Solution for "Plugin failed to load"
```

## Available Context

### Skills Library

Skills are executable workflows that agents can invoke. Each skill provides:

- **Purpose**: What the skill accomplishes
- **When to Use**: Triggering conditions
- **Prerequisites**: What must be in place before using
- **Steps**: Detailed workflow to follow
- **Outputs**: What the skill produces

**Example Skills**:
- `epic-creation` - Create GitHub epic from implementation plan
- `land-the-plane` - Sync dirty cache state to GitHub at session end
- `writing-plans` - Create structured implementation plans
- `verification-before-completion` - Verify work before claiming completion
- `test-driven-development` - TDD workflow for feature implementation

### Patterns Library

Patterns are reusable solutions to common problems:

- **Git Workflow**: Branching, committing, merging strategies
- **Testing Patterns**: Unit tests, integration tests, E2E tests
- **Error Handling**: Graceful failure, retry logic, user feedback
- **Configuration Management**: Loading, validating, merging configs
- **Cache Management**: Storage, invalidation, TTL strategies

### Workflows Library

Workflows are step-by-step processes for common tasks:

- **Project Onboarding**: Setting up a new project with superpowers
- **Feature Development**: From planning to implementation to review
- **Bug Fixing**: Reproduce, diagnose, fix, verify, document
- **Epic Creation**: Plan → Epic → Sub-tasks → Tracking
- **Session End**: Cache sync, cleanup, status reporting

## Configuration

### Enabling Context Discovery

Edit `.opencode/config.json`:

```json
{
  "superpowers": {
    "enabled": true,
    "remote": "superpowers",
    "repoUrl": "git@github.com:castrojo/superpowers.git",
    "wikiSync": true
  },
  "wiki": {
    "autoSync": false,
    "includeSkills": true,
    "includeDocs": true
  }
}
```

**Key Options**:

- `superpowers.enabled` - Master switch for context discovery
- `superpowers.wikiSync` - Enable wiki-based context fetching
- `wiki.includeSkills` - Include skills from superpowers remote
- `wiki.includeDocs` - Include project docs in wiki

### Cache Configuration

Cache settings are currently hardcoded but will be configurable in future versions:

```javascript
// Future configuration (not yet implemented)
{
  "cache": {
    "ttl": 3600,           // 1 hour in seconds
    "location": "~/.cache/opencode-superpower/",
    "maxSize": 104857600,  // 100 MB
    "autoCleanup": true
  }
}
```

### Adding Custom Context

To add project-specific context that agents can discover:

1. **Create Documentation**:
   ```bash
   mkdir -p docs
   echo "# Project Architecture" > docs/ARCHITECTURE.md
   ```

2. **Write Implementation Plans**:
   ```bash
   mkdir -p .opencode/plans
   # Plans auto-discovered by agents
   ```

3. **Add to Wiki** (if enabled):
   ```bash
   # Docs in docs/ will be synced to wiki
   node bin/sync-wiki.js
   ```

4. **Create Custom Skills** (advanced):
   ```bash
   # In superpowers repo (or fork)
   mkdir skills/my-custom-skill
   echo "# My Custom Skill" > skills/my-custom-skill/SKILL.md
   ```

## For Developers

### Cache Structure

Context is cached in `~/.cache/opencode-superpower/`:

```
~/.cache/opencode-superpower/
├── wiki/
│   ├── owner-repo/          # Wiki cache per repository
│   │   ├── .git/            # Git metadata
│   │   ├── Skills-*.md      # Skill pages from superpowers
│   │   └── *.md             # Project docs synced to wiki
│   └── castrojo-superpowers/  # Superpowers wiki itself
│       └── Skills-*.md
└── state.json               # Future: Cache metadata and TTL info
```

### Adding New Context Sources

To extend the system with new context sources:

1. **Create a new manager** in `lib/`:
   ```javascript
   // lib/custom-context-manager.js
   export function fetchCustomContext(config, cwd) {
     // Fetch from your custom source
     // Return structured data
   }
   ```

2. **Update plugin initialization** in `plugin.js`:
   ```javascript
   import { fetchCustomContext } from './lib/custom-context-manager.js';
   
   // In plugin initialization
   if (config.customContext.enabled) {
     const context = await fetchCustomContext(config, cwd);
     // Cache context
   }
   ```

3. **Add configuration** in `lib/config-loader.js`:
   ```javascript
   const DEFAULT_CONFIG = {
     // ... existing config
     customContext: {
       enabled: false,
       source: 'https://...',
       ttl: 3600
     }
   };
   ```

### Debugging Context Issues

Enable debug logging to trace context discovery:

```javascript
// In plugin.js (temporary)
const DEBUG = true;

if (DEBUG) {
  console.log('Context sources:', {
    superpowersRemote: config.superpowers.remote,
    wikiSync: config.superpowers.wikiSync,
    cacheLocation: getCacheDir()
  });
}
```

**Check cache state**:

```bash
# View wiki cache
ls -lah ~/.cache/opencode-superpower/wiki/

# Check cache age
stat ~/.cache/opencode-superpower/wiki/owner-repo/.git/FETCH_HEAD

# View cached skills
find ~/.cache/opencode-superpower/wiki/ -name "Skills-*.md"
```

**Verify superpowers remote**:

```bash
# Check remote exists
git remote -v | grep superpowers

# Test fetch
git fetch superpowers

# List remote branches
git branch -r | grep superpowers

# View remote skills
git ls-tree superpowers/main:skills
```

**Test wiki fetch manually**:

```bash
# Clone wiki
git clone https://github.com/owner/repo.wiki.git /tmp/test-wiki

# Check content
ls /tmp/test-wiki/
```

### Performance Considerations

**Cache Efficiency**:
- First access: ~2-5 seconds (clone wiki + fetch remote)
- Subsequent access: <100ms (read from cache)
- TTL refresh: ~1-2 seconds (git pull)

**Network Usage**:
- Initial setup: ~5-10 MB (depends on wiki size)
- Refresh: ~100 KB - 1 MB (incremental updates)
- Per-session: Minimal (cache hit)

**Optimization Tips**:
- Increase TTL for stable contexts (skills change rarely)
- Decrease TTL for fast-moving projects (docs change often)
- Clear cache if experiencing stale data issues

## Troubleshooting

### Context Not Discovered

**Problem**: Agent doesn't seem to have access to skills or patterns.

**Solution**:
1. Check configuration: `cat .opencode/config.json`
2. Verify `superpowers.enabled = true`
3. Verify superpowers remote exists: `git remote -v`
4. Check cache exists: `ls ~/.cache/opencode-superpower/wiki/`
5. Try force refresh: Delete cache and restart session

### Stale Context

**Problem**: Agent is using old skills or patterns.

**Solution**:
1. Clear cache: `rm -rf ~/.cache/opencode-superpower/`
2. Fetch latest from remote: `git fetch superpowers`
3. Sync wiki: `node bin/sync-wiki.js`
4. Restart OpenCode session

### Cache Directory Not Found

**Problem**: Cache directory doesn't exist or is in wrong location.

**Solution**:
1. Check cache location: `echo ~/.cache/opencode-superpower/`
2. Create manually if needed: `mkdir -p ~/.cache/opencode-superpower/wiki/`
3. Verify permissions: `ls -ld ~/.cache/opencode-superpower/`
4. Re-run onboarding: `node bin/onboard-project.js`

### Superpowers Remote Not Configured

**Problem**: Agent can't fetch context from superpowers.

**Solution**:
1. Run onboarding: `node bin/onboard-project.js`
2. Or manually add remote:
   ```bash
   git remote add superpowers git@github.com:castrojo/superpowers.git
   git fetch superpowers
   ```
3. Update config to enable: Set `superpowers.enabled = true`

### Wiki Sync Fails

**Problem**: Can't sync context to project wiki.

**Solution**:
1. Enable wiki in GitHub settings
2. Create initial Home page
3. Check authentication: `gh auth status`
4. See [Wiki Sync Troubleshooting](WIKI-SYNC.md#troubleshooting)

## Best Practices

### For Agent Users

1. **Run Onboarding**: Always run `node bin/onboard-project.js` for new projects
2. **Keep Cache Fresh**: Periodically sync wiki to update context
3. **Review Skills**: Familiarize yourself with available skills
4. **Document Patterns**: Add project-specific patterns to `docs/`
5. **Trust the System**: Let agents discover context automatically

### For Agent Developers

1. **Check Before Ask**: Search cache before asking user for context
2. **Invoke Skills**: Use skill system when applicable
3. **Follow Patterns**: Apply established patterns from context
4. **Update Context**: Add journey updates when completing work
5. **Report Issues**: Log warnings if context is missing or stale

### For Project Maintainers

1. **Keep Wiki Updated**: Sync wiki after docs changes
2. **Document Decisions**: Add architecture docs for agents to discover
3. **Create Skills**: Add project-specific skills to superpowers fork
4. **Monitor Cache**: Check cache size and clean up old entries
5. **Version Documentation**: Use semantic versions for major docs changes

## Advanced Usage

### Multiple Superpowers Remotes

Support for multiple remote sources (future enhancement):

```json
{
  "superpowers": {
    "remotes": [
      {
        "name": "superpowers",
        "url": "git@github.com:castrojo/superpowers.git",
        "priority": 1
      },
      {
        "name": "team-patterns",
        "url": "git@github.com:myteam/patterns.git",
        "priority": 2
      }
    ]
  }
}
```

### Context Prioritization

When multiple context sources provide conflicting information:

1. **Project documentation** (highest priority)
2. **Implementation plans**
3. **Project wiki**
4. **Superpowers wiki**
5. **Default behaviors** (lowest priority)

### Custom Cache Location

To use a different cache location (requires code change):

```javascript
// In lib/wiki-manager.js
export function getWikiCacheDir(owner, repo) {
  const cacheRoot = process.env.OPENCODE_CACHE || 
                    join(homedir(), '.cache', 'opencode-superpower', 'wiki');
  return join(cacheRoot, `${owner}-${repo}`);
}
```

Then set environment variable:
```bash
export OPENCODE_CACHE=/mnt/fast-storage/cache
```

## Related Documentation

- [Wiki Sync System](WIKI-SYNC.md) - How to sync context to wikis
- [Onboarding Guide](../README.md#quick-start) - Initial setup
- [Configuration Reference](../lib/config-loader.js) - Config schema
- [AGENTS.md](../AGENTS.md) - Architecture for AI agents

## Future Enhancements

**Planned Features**:
1. Configurable TTL per context source
2. Multiple superpowers remotes
3. Context versioning and rollback
4. Real-time context updates (webhooks)
5. Context search/query interface
6. Context usage analytics
7. Automatic context refresh on remote changes

## Support

For issues or questions:

1. Check this guide and [Wiki Sync docs](WIKI-SYNC.md)
2. Verify configuration and cache status
3. Review debug output in plugin logs
4. Report issues: https://github.com/castrojo/superpowers/issues
