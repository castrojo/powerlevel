# Wiki Sync and Agent Context Discovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable agents to discover context from central superpowers repo via git remote, implement automated wiki sync for documentation, and enable automatic epic/sub-issue updates when subagents complete tasks.

**Architecture:** Git-based wiki sync using wiki.git clone/push, automated project onboarding adds superpowers remote, task completion hooks update GitHub issues via cache system and gh CLI.

**Tech Stack:** Node.js, GitHub CLI (`gh`), Git operations, OpenCode plugin system, cache-manager.js

---

## Task 1: Create Wiki Manager Library

**Files:**
- Create: `lib/wiki-manager.js`

**Implementation:**

Create `lib/wiki-manager.js` with these functions:
1. `getWikiCacheDir(owner, repo)` - Returns cache path for wiki
2. `cloneWiki(owner, repo)` - Clone or update wiki repo to cache
3. `wikiExists(owner, repo)` - Check if wiki enabled  
4. `syncSkillsToWiki(skillsDir, wikiDir)` - Copy SKILL.md files to wiki
5. `commitAndPushWiki(wikiDir, message)` - Commit and push changes

**Details:**
- Cache location: `~/.cache/opencode-superpower/wiki/${owner}-${repo}/`
- Wiki URL: `https://github.com/${owner}/${repo}.wiki.git`
- Skill files: Convert `epic-creation` → `Skills-Epic-Creation.md`
- Use `execSync` for git operations
- Handle errors gracefully (wiki not enabled, auth failures)

**Testing:**
- Test wiki clone operation
- Test skill sync (create test skills directory)
- Verify wiki pages created correctly

**Commit:** `feat: add wiki manager with clone and sync`

---

## Task 2: Create Configuration System

**Files:**
- Create: `lib/config-loader.js`
- Create: `.opencode/config.json.template`

**Implementation:**

Create config loader with default configuration:
```javascript
{
  superpowers: { enabled, remote, repoUrl, autoOnboard, wikiSync },
  wiki: { autoSync, syncOnCommit, includeSkills, includeDocs },
  tracking: { autoUpdateEpics, updateOnTaskComplete, commentOnProgress }
}
```

**Functions:**
1. `loadConfig(cwd)` - Load config from `.opencode/config.json` or use defaults
2. `mergeConfig(defaults, user)` - Deep merge user config over defaults
3. `validateConfig(config)` - Validate config structure and values

**Validation rules:**
- `superpowers.repoUrl` required if `superpowers.enabled`
- `repoUrl` must be valid git URL (SSH or HTTPS)

**Template:** Create `.opencode/config.json.template` with full default config

**Testing:**
- Test config loading (with and without file)
- Test validation (valid and invalid configs)
- Test merge logic

**Commit:** `feat: add configuration system with validation`

---

## Task 3: Add Remote Management

**Files:**
- Create: `lib/remote-manager.js`
- Modify: `lib/repo-detector.js`

**Implementation:**

Create `lib/remote-manager.js`:
1. `hasRemote(remoteName, cwd)` - Check if remote exists
2. `addRemote(remoteName, url, cwd)` - Add git remote
3. `fetchRemote(remoteName, cwd)` - Fetch from remote
4. `getRemoteUrl(remoteName, cwd)` - Get remote URL

Extend `lib/repo-detector.js`:
1. `detectRepoFromRemote(remoteName, cwd)` - Detect repo from specific remote
2. `parseRepoFromUrl(url)` - Extract owner/repo from URL (make existing logic exportable)

**Testing:**
- Test remote operations with existing origin remote
- Test repo detection from URL

**Commit:** `feat: add remote management and multi-remote support`

---

## Task 4: Create Automated Onboarding Script

**Files:**
- Create: `bin/onboard-project.js`

**Implementation:**

Create executable script that:
1. Detects current project (`detectRepo()`)
2. Loads config (`loadConfig()`)
3. Adds superpowers remote if not exists
4. Fetches from superpowers remote
5. Creates `docs/SUPERPOWERS.md` stub documentation
6. Creates `.opencode/config.json` if not exists

**Stub documentation content:**
- Explains Superpowers integration
- Lists context sources (local docs, superpowers remote, wiki)
- Instructions for AI agents
- Configuration reference

**Output:**
- Success messages for each step
- Next steps guide for user

**Testing:**
- Run onboarding script
- Verify remote added
- Verify files created
- Check `git remote -v`

**Commit:** `feat: add automated project onboarding script`

---

## Task 5: Epic Auto-Update System

**Files:**
- Create: `lib/epic-updater.js`
- Modify: `lib/cache-manager.js`

**Implementation:**

Create `lib/epic-updater.js`:
1. `updateEpicOnTaskComplete(owner, repo, taskNumber, message)` - Main function
   - Find epic containing task
   - Add completion comment to task issue
   - Update task status in cache
   - Check if all tasks complete → close epic
   - Otherwise add progress comment to epic
   
2. `findEpicForTask(cache, taskNumber)` - Search cache for epic
3. `addComment(owner, repo, issueNumber, body)` - Add GitHub comment
4. `closeEpic(owner, repo, issueNumber)` - Close epic issue
5. `updateTaskInCache(cache, epicNumber, taskNumber, state)` - Update cache
6. `updateEpicInCache(cache, epicNumber, state)` - Update cache

Extend `lib/cache-manager.js`:
1. `recordTaskCompletion(cache, taskNumber, completedBy, message)` - Track completion
2. `getTaskCompletions(cache, taskNumber)` - Get completion history

**Comment format:**
- Task: "✅ **Task completed** [message] _Updated automatically by Superpowers_"
- Epic progress: "📊 **Progress Update** Completed: X/Y tasks _Updated automatically by Superpowers_"
- Epic close: "✅ Epic completed - all tasks done"

**Testing:**
- Create test task completion
- Verify comments added
- Check cache updates

**Commit:** `feat: add automatic epic update on task completion`

---

## Task 6: Integrate Epic Updates into Plugin

**Files:**
- Modify: `plugin.js`
- Create: `lib/task-completion-detector.js`

**Implementation:**

Create `lib/task-completion-detector.js`:
1. `detectTaskFromCommit(message)` - Parse commit message for task number
   - Patterns: `closes #123`, `fixes #456`, `resolves #789`, `completes #123`
2. `getRecentCommits(since, cwd)` - Get commits since timestamp
3. `findCompletedTasks(since, cwd)` - Find completed tasks in commits

Modify `plugin.js` `landThePlane` function:
1. Load config, check `tracking.autoUpdateEpics`
2. Get last check time from cache
3. Find completed tasks since last check
4. For each task: call `updateEpicOnTaskComplete`
5. Update `last_task_check` in cache

**Testing:**
- Create commit with "closes #N" message
- Trigger session idle
- Verify epic updated

**Commit:** `feat: integrate epic auto-update into plugin idle hook`

---

## Task 7: Create Wiki Sync Script

**Files:**
- Create: `bin/sync-wiki.js`

**Implementation:**

Create executable script that:
1. Detects repo
2. Checks if wiki exists
3. Clones/updates wiki
4. Syncs skills if `config.wiki.includeSkills`
5. Syncs docs if `config.wiki.includeDocs` (TODO for now)
6. Commits and pushes changes

**Output:**
- Progress messages
- Count of synced pages
- Wiki URL
- Error messages for common issues (wiki not enabled, auth failure)

**Error handling:**
- Wiki not enabled → show how to enable
- Auth failed → show gh auth login
- No changes → "Wiki already up to date"

**Testing:**
- Run sync script
- Verify wiki pages created
- Check GitHub wiki

**Commit:** `feat: add wiki sync script for skills and docs`

---

## Task 8: Add Wiki Fetch to Plugin

**Files:**
- Modify: `plugin.js`

**Implementation:**

In plugin initialization (after `ensureLabelsExist`):
1. Check `config.superpowers.wikiSync`
2. Check if wiki exists
3. Clone wiki to cache
4. Handle errors gracefully (warn, don't fail)

**Output:**
- "📚 Fetching wiki documentation..."
- "✓ Wiki documentation available locally"
- Or warning if failed

**Testing:**
- Start OpenCode session
- Verify wiki fetch message
- Check wiki cached locally

**Commit:** `feat: fetch wiki on plugin initialization`

---

## Task 9: Add Onboarding Check

**Files:**
- Modify: `plugin.js`
- Create: `lib/onboarding-check.js`

**Implementation:**

Create `lib/onboarding-check.js`:
1. `isProjectOnboarded(cwd)` - Check if project onboarded
   - Has superpowers remote?
   - Has config file?
   - Returns: `{ onboarded, hasRemote, hasConfig }`
2. `getOnboardingInstructions()` - Return formatted instructions

Modify `plugin.js` initialization:
1. Check `config.superpowers.autoOnboard`
2. Check onboarding status
3. Display instructions if not onboarded
4. Continue (don't block)

**Instructions format:**
```
╔═══════════════════════════════════════════════════════════════╗
║  🚀 Superpowers Onboarding Required                          ║
╚═══════════════════════════════════════════════════════════════╝

Run: node bin/onboard-project.js
```

**Testing:**
- Remove superpowers remote
- Start session
- Verify instructions shown
- Re-run onboarding

**Commit:** `feat: check onboarding status on plugin init`

---

## Task 10: Documentation

**Files:**
- Create: `docs/WIKI-SYNC.md`
- Create: `docs/AGENT-CONTEXT.md`
- Modify: `README.md`

**Implementation:**

Create `docs/WIKI-SYNC.md`:
- Overview of wiki sync system
- What gets synced (skills, docs)
- What doesn't (plans)
- Manual sync instructions
- Configuration options
- How it works (git-based)
- Requirements (wiki enabled, auth)
- Troubleshooting (common errors)

Create `docs/AGENT-CONTEXT.md`:
- Overview of context discovery
- Context sources (local docs, superpowers remote, wiki)
- Onboarding process
- Configuration
- Verification steps
- For AI agents section
- For humans section

Modify `README.md`:
- Add "Superpowers Integration" section
- Setup instructions (onboarding)
- Wiki sync instructions
- Links to docs
- Configuration reference

**Commit:** `docs: add wiki sync and agent context documentation`

---

## Task 11: Integration Tests

**Files:**
- Create: `test/integration-test.sh`

**Implementation:**

Create bash script that tests:
1. Config loading
2. Remote management (check origin)
3. Repo detection
4. Wiki existence check
5. Task completion detection

**Test format:**
```bash
#!/bin/bash
set -e
echo "🧪 Running integration tests..."

# Test 1: Config loading
node -e "import { loadConfig } from './lib/config-loader.js'; ..."

# Test 2: Remote management
...

echo "✅ All integration tests passed!"
```

**Testing:**
- Make executable
- Run tests
- Verify all pass

**Commit:** `test: add integration test suite`

---

## Task 12: Final Verification and Epic Creation

**Files:**
- This plan file (update with epic reference)

**Implementation:**

1. Run full verification:
   - Integration tests
   - All scripts (onboard, sync-wiki)
   - Manual testing

2. Create epic:
   - Run: `node bin/create-epic.js .opencode/plans/2026-02-09-wiki-sync-and-context-discovery.md`
   - Verify epic and 12 sub-issues created

3. Plan file update:
   - Epic creation script auto-appends epic reference

4. Commit plan:
   - `git add .opencode/plans/2026-02-09-wiki-sync-and-context-discovery.md`
   - `git commit -m "docs: add epic reference to wiki sync plan"`

5. Final announcement:
   - Epic number
   - Task count
   - Next steps
   - Epic URL

**Commit:** `docs: add epic reference to wiki sync plan`

---

## Summary

This plan implements:

1. ✅ **Wiki Manager** - Git-based wiki clone/sync operations
2. ✅ **Config System** - Flexible configuration with validation
3. ✅ **Remote Management** - Multi-remote git operations
4. ✅ **Automated Onboarding** - Script to setup superpowers integration
5. ✅ **Epic Auto-Update** - Task completions automatically update GitHub issues
6. ✅ **Plugin Integration** - Wiki fetch and task tracking in idle hook
7. ✅ **Wiki Sync Script** - Standalone script for manual sync
8. ✅ **Onboarding Check** - Detect and guide first-time setup
9. ✅ **Documentation** - Comprehensive guides for users and agents
10. ✅ **Integration Tests** - Verify all components work together
11. ✅ **Epic Creation** - Track implementation with GitHub issues

**Key Features:**
- Agents discover context from multiple sources automatically
- Wiki syncs from repository (skills + docs)
- Subagent task completions update epics without prompting
- Project onboarding is automated
- All tracking via GitHub issues (no superpowers repo issues)

**Tech Stack:**
- Node.js ES modules
- Git operations for wiki and remotes
- GitHub CLI for issue operations
- Cache system for offline operations
- OpenCode plugin hooks for automation
