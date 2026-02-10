# Wiki Sync System

## Overview

The Wiki Sync system enables automatic synchronization of skills and documentation from your Superpowers remote repository to your project's GitHub wiki. This creates a centralized, accessible knowledge base that both humans and AI agents can reference during development.

**Key Benefits:**
- **Centralized Documentation**: All skills and docs in one discoverable location
- **Automatic Updates**: Sync manually or configure automatic syncing
- **Version Controlled**: Wiki content backed by git for full history tracking
- **Discoverable**: GitHub wikis are searchable and linkable

## What Gets Synced

### Skills (from Superpowers Remote)
- All `SKILL.md` files from the superpowers remote's `skills/` directory
- Converted to wiki-friendly page names (e.g., `epic-creation` → `Skills-Epic-Creation.md`)
- Includes full skill content with instructions, workflows, and examples

### Documentation (from Project)
- All Markdown files (`.md`) from your project's `docs/` directory
- Preserves original filenames and structure
- Keeps your project-specific documentation alongside shared skills

### What Doesn't Get Synced
- Implementation plans (`docs/plans/`) - these stay in your repository
- Non-markdown files
- Hidden files and directories
- Git metadata

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Superpowers Remote (git@github.com:user/superpowers.git)  │
│  └── skills/                                                │
│      ├── epic-creation/SKILL.md                            │
│      ├── land-the-plane/SKILL.md                           │
│      └── writing-plans/SKILL.md                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ git fetch + git show
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Local Cache (.git/temp-superpowers-skills/)               │
│  [Temporary extraction of SKILL.md files]                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Copy + Transform
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  Wiki Cache (~/.cache/opencode-superpower/wiki/owner-repo/)│
│  └── Skills-Epic-Creation.md                               │
│  └── Skills-Land-The-Plane.md                              │
│  └── Skills-Writing-Plans.md                               │
│  └── [Project docs/*.md files]                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ git commit + git push
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  GitHub Wiki (https://github.com/owner/repo.wiki.git)      │
│  [Publicly accessible wiki pages]                          │
└─────────────────────────────────────────────────────────────┘
```

**Process Flow:**
1. **Fetch**: Pull latest commits from superpowers remote
2. **Extract**: Use `git show` to extract SKILL.md files without full checkout
3. **Transform**: Convert skill directory names to wiki page names
4. **Clone Wiki**: Clone or update local cache of wiki repository
5. **Copy**: Sync skills and docs to wiki cache directory
6. **Commit**: Stage, commit, and push changes to wiki
7. **Cleanup**: Remove temporary extraction directory

## Setup

### Prerequisites

1. **GitHub Repository**: Your project must be in a GitHub repository
2. **Wiki Enabled**: GitHub wiki must be enabled for the repository
3. **Superpowers Remote**: Configured superpowers remote (run onboarding first)
4. **GitHub CLI**: Authenticated `gh` CLI for wiki access
5. **Git Authentication**: SSH keys or HTTPS credentials for git operations

### Installation

1. **Run Project Onboarding** (if not already done):
   ```bash
   node bin/onboard-project.js
   ```
   
   This sets up:
   - Superpowers git remote
   - Default configuration file
   - Stub documentation

2. **Enable GitHub Wiki**:
   - Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings`
   - Scroll to "Features" section
   - Check the "Wikis" checkbox
   - Click "Save changes"
   - Create an initial wiki page (Home) if prompted

3. **Configure Wiki Sync** in `.opencode/config.json`:
   ```json
   {
     "wiki": {
       "autoSync": false,
       "syncOnCommit": false,
       "includeSkills": true,
       "includeDocs": true
     }
   }
   ```

### Verification

Check that everything is set up correctly:

```bash
# Verify superpowers remote exists
git remote -v | grep superpowers

# Check configuration
cat .opencode/config.json

# Test wiki access
git ls-remote https://github.com/YOUR_USERNAME/YOUR_REPO.wiki.git
```

## Usage

### Manual Sync (Recommended)

Run the wiki sync script whenever you want to update the wiki:

```bash
node bin/sync-wiki.js
```

This will:
1. Load configuration from `.opencode/config.json`
2. Fetch latest from superpowers remote
3. Extract skills from remote
4. Clone/update wiki repository
5. Sync skills and docs
6. Commit and push changes

**Common Flags:**

```bash
# Dry run - see what would be synced without pushing
node bin/sync-wiki.js --dry-run

# Force sync even if autoSync is disabled
node bin/sync-wiki.js --force

# Sync to a different repository
node bin/sync-wiki.js --repo=owner/repo

# Show help
node bin/sync-wiki.js --help
```

### Automatic Sync (Future)

In future versions, you can enable automatic syncing:

```json
{
  "wiki": {
    "autoSync": true,
    "syncOnCommit": false
  }
}
```

**Note**: Currently, set `autoSync: false` and use manual sync. Automatic syncing will be implemented in a future release.

### Slash Command (OpenCode Plugin)

If the OpenCode plugin is active, you can sync from within a session:

```
/wiki-sync
```

This runs the sync operation and reports results inline.

## Configuration

Configuration is stored in `.opencode/config.json`. Here are all wiki-related options:

### `wiki.autoSync`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Enable automatic syncing (when implemented)
- **Recommendation**: Keep as `false`, use manual sync

### `wiki.syncOnCommit`
- **Type**: Boolean
- **Default**: `false`
- **Description**: Trigger wiki sync after each commit (when implemented)
- **Recommendation**: Keep as `false` to avoid excessive syncing

### `wiki.includeSkills`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Sync SKILL.md files from superpowers remote
- **Recommendation**: Keep as `true` to make skills accessible

### `wiki.includeDocs`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Sync Markdown files from project `docs/` directory
- **Recommendation**: Set to `true` if you want project docs in wiki

### `superpowers.remote`
- **Type**: String
- **Default**: `"superpowers"`
- **Description**: Name of the git remote for superpowers repository
- **Note**: Must match the remote name you configured during onboarding

### `superpowers.wikiSync`
- **Type**: Boolean
- **Default**: `true`
- **Description**: Enable wiki-related features in the plugin
- **Recommendation**: Keep as `true`

## Troubleshooting

### Error: "Wiki is not enabled for owner/repo"

**Problem**: GitHub wiki is not enabled for your repository.

**Solution**:
1. Go to your repository settings: `https://github.com/owner/repo/settings`
2. Scroll to "Features" section
3. Check "Wikis"
4. Create an initial wiki page (Home)
5. Try sync again

### Error: "Remote 'superpowers' not found"

**Problem**: Superpowers remote is not configured.

**Solution**:
```bash
# Run onboarding script
node bin/onboard-project.js

# Or manually add the remote
git remote add superpowers git@github.com:castrojo/superpowers.git
git fetch superpowers
```

### Error: "Failed to fetch from remote"

**Problem**: Network connectivity, authentication, or incorrect URL.

**Solution**:
1. Check network connectivity
2. Verify remote URL: `git remote get-url superpowers`
3. Test SSH access: `ssh -T git@github.com`
4. If using HTTPS, check credentials
5. Try manual fetch: `git fetch superpowers`

### Error: "Failed to commit/push wiki"

**Problem**: Missing write permissions or git authentication issues.

**Solution**:
1. Check GitHub permissions (must have write access)
2. Verify git credentials are configured
3. For SSH: Check `~/.ssh/config` and key permissions
4. For HTTPS: Check credential helper: `git config credential.helper`
5. Test manual wiki clone:
   ```bash
   git clone https://github.com/owner/repo.wiki.git /tmp/test-wiki
   ```

### Warning: "No skills found" or "No docs found"

**Problem**: The superpowers remote has no skills, or your project has no docs.

**Solution**:
- **For skills**: Verify superpowers remote has `skills/` directory:
  ```bash
  git ls-tree superpowers/main:skills
  ```
- **For docs**: Check if `docs/` directory exists with `.md` files:
  ```bash
  ls docs/*.md
  ```

### "Wiki is already up to date - no changes to sync"

**Not an Error**: The wiki already contains the latest content.

This is normal if:
- You recently synced
- No skills or docs have changed
- The cache is current

### Error: "Invalid JSON in config file"

**Problem**: Syntax error in `.opencode/config.json`.

**Solution**:
1. Validate JSON syntax: `cat .opencode/config.json | jq`
2. Check for common issues:
   - Missing commas between properties
   - Trailing commas (not allowed in JSON)
   - Unquoted keys or string values
   - Mismatched brackets/braces

### Cache Issues

If sync behaves unexpectedly, clear the cache:

```bash
# Clear wiki cache
rm -rf ~/.cache/opencode-superpower/wiki/

# Clear temporary skills extraction
rm -rf .git/temp-superpowers-skills/

# Re-run sync
node bin/sync-wiki.js
```

## Advanced Usage

### Syncing Multiple Projects

You can sync wikis for multiple repositories from a single superpowers setup:

```bash
# Sync current project
cd ~/projects/app-one
node ~/path/to/bin/sync-wiki.js

# Sync another project
cd ~/projects/app-two
node ~/path/to/bin/sync-wiki.js
```

Each project maintains its own wiki and configuration.

### Custom Superpowers Repository

To use a different superpowers fork or custom repository:

1. Update `.opencode/config.json`:
   ```json
   {
     "superpowers": {
       "remote": "my-superpowers",
       "repoUrl": "git@github.com:myuser/my-superpowers.git"
     }
   }
   ```

2. Re-run onboarding to add the remote:
   ```bash
   node bin/onboard-project.js --force
   ```

3. Sync as usual:
   ```bash
   node bin/sync-wiki.js
   ```

### Excluding Specific Skills

Currently, all skills from the superpowers remote are synced. To exclude specific skills:

1. Sync normally
2. Manually delete unwanted pages from wiki (via GitHub web interface or locally)
3. The sync script won't re-add deleted pages unless their content changes

**Better approach** (future): Add a `wiki.excludeSkills` config option.

### Customizing Wiki Page Names

The default transformation is:
- `epic-creation` → `Skills-Epic-Creation.md`
- `land-the-plane` → `Skills-Land-The-Plane.md`

To customize, edit `lib/wiki-manager.js:126-130` (the `syncSkillsToWiki` function).

## Maintenance

### Regular Sync Workflow

Recommended workflow for keeping wiki updated:

1. **After superpowers updates**:
   ```bash
   git fetch superpowers
   node bin/sync-wiki.js
   ```

2. **After docs changes**:
   ```bash
   # Make changes to docs/*.md
   node bin/sync-wiki.js
   ```

3. **Before starting new work**:
   ```bash
   # Ensure agents have latest context
   node bin/sync-wiki.js
   ```

### Monitoring Sync Status

Check the last sync time by looking at wiki commit history:

```bash
# Clone wiki locally
git clone https://github.com/owner/repo.wiki.git /tmp/wiki

# View commit log
cd /tmp/wiki
git log --oneline

# See what was synced
git show HEAD
```

### Reverting Changes

If a sync introduces unwanted changes:

```bash
# Clone wiki
git clone https://github.com/owner/repo.wiki.git /tmp/wiki
cd /tmp/wiki

# Revert last commit
git revert HEAD

# Push revert
git push

# Your wiki cache will update on next sync
```

## Best Practices

1. **Manual Sync**: Use manual sync until automatic syncing is fully tested
2. **Review First**: Use `--dry-run` to preview changes before pushing
3. **Regular Updates**: Sync after superpowers updates or major docs changes
4. **Clear Cache**: Clear cache if you experience sync issues
5. **Backup Wiki**: Periodically clone your wiki for offline backup
6. **Document Changes**: Update project docs when adding new patterns or workflows

## Security Considerations

- **Public Wikis**: GitHub wikis are public if your repo is public
- **Sensitive Info**: Never commit secrets, tokens, or credentials to docs
- **Review Content**: Review what gets synced - skills may contain internal patterns
- **Private Repos**: Use private repos if syncing proprietary knowledge

## Related Documentation

- [Agent Context Discovery](AGENT-CONTEXT.md) - How agents discover and use wiki content
- [Onboarding Guide](../README.md#quick-start) - Initial project setup
- [Configuration Reference](../lib/config-loader.js) - Full config schema

## Support

If you encounter issues:

1. Check this troubleshooting guide
2. Verify prerequisites (wiki enabled, remote configured)
3. Try `--dry-run` to diagnose issues
4. Clear cache and retry
5. Report issues: https://github.com/castrojo/superpowers/issues
