# Fix Powerlevel/Superpowers Out-of-Box Setup Issues

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 7 critical issues preventing Powerlevel/Superpowers from working "out of the box" for new users

**Architecture:** This involves documentation updates to AGENTS.md, onboarding script improvements, and creating GitHub issues for future agents to fix technical debt

**Tech Stack:** Markdown documentation, GitHub Issues API (via gh CLI), Node.js onboarding scripts

---

## Task 1: Document Minimal Repository Impact Principles in AGENTS.md

**Files:**
- Modify: `AGENTS.md` (add new section after line 1054)

**Step 1: Read current AGENTS.md to find insertion point**

Run: Read AGENTS.md, locate "Multi-Machine Development" section end

**Step 2: Create new section content**

Insert after line 1054, before "Project Onboarding Implementation":

```markdown
## MINIMAL REPOSITORY IMPACT PRINCIPLES

**⚠️ CRITICAL: Powerlevel MUST be functionally INVISIBLE to projects.**

### Core Philosophy

Powerlevel is a **tracking-only dashboard**. It reads project state and displays it centrally. It should have ZERO impact on how projects operate.

**Principle: "Add metadata, not dependencies"**

### The Problem: Current Onboarding Bloat

**Current onboarding adds too much:**
- 54-line AGENTS.md template with placeholder sections
- docs/SUPERPOWERS.md workflow documentation (40 lines)  
- .opencode/config.json with extensive defaults

**Example: castrojo/bluespeed**
- AGENTS.md is 376 lines
- Only 31 lines are Powerlevel-managed (HTML comment block)
- Other 345 lines are project-specific content
- Template creates stub sections that duplicate project work

**Issues with current approach:**
1. Placeholder sections create merge conflicts
2. Makes Powerlevel feel intrusive
3. Encourages dependency on Powerlevel for project docs
4. Projects inherit Powerlevel's structure instead of defining their own

### MANDATORY Principles for Onboarding Agents

**⚠️ Agents performing Powerlevel onboarding MUST follow these rules:**

#### Principle 1: HTML Comment Block ONLY for AGENTS.md

**DO THIS (31 lines):**
```markdown
<!-- POWERLEVEL MANAGED SECTION - START -->
<!-- This section is maintained by Powerlevel. Manual edits may be overwritten. -->

## Managed by Powerlevel

This project is tracked by [Powerlevel](https://github.com/castrojo/powerlevel), a central project management dashboard for OpenCode + Superpowers.

### For AI Agents

**CRITICAL:** Before making any changes to this project, you MUST:

1. Read the Powerlevel best practices: https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/README.md
2. Review all applicable best practices for this project
3. Apply MUST requirements strictly (these are lint-enforced)
4. Follow SHOULD recommendations where appropriate

**Quick Links:**
- Best Practices Index: https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/README.md
- Powerlevel Repository: https://github.com/castrojo/powerlevel
- Powerlevel Architecture: https://github.com/castrojo/powerlevel/blob/main/AGENTS.md

### Project Info

- **Repository:** owner/repo
- **Onboarded to Powerlevel:** YYYY-MM-DD
- **Tracking Epic:** [View on GitHub](https://github.com/castrojo/powerlevel/issues?q=is:issue+label:project/repo)

<!-- POWERLEVEL MANAGED SECTION - END -->
```

**DO NOT ADD:**
- ❌ Placeholder project sections (Architecture, Development Workflow, Testing, Deployment)
- ❌ Horizontal rule separators after managed section
- ❌ "Project-Specific Context" headers
- ❌ Any content below the HTML comment

**Rationale:** Projects define their own structure. Powerlevel has no business creating placeholders.

#### Principle 2: NEVER Create docs/SUPERPOWERS.md

**Current behavior:** onboard-project.js creates 40-line workflow documentation file

**Problem:**
- Superpowers workflow is NOT project documentation
- Information is redundant with AGENTS.md managed section
- Creates maintenance burden (keeping two files in sync)
- Projects don't need 40 lines explaining Powerlevel internals

**New behavior:** Skip this file entirely

**Exception:** Only if project EXPLICITLY requests workflow documentation stub

#### Principle 3: Minimal .opencode/config.json (6 Lines Only)

**DO THIS:**
```json
{
  "projectBoard": {
    "enabled": true,
    "number": null,
    "autoCreate": true
  },
  "superpowersIntegration": {
    "enabled": true
  }
}
```

**DO NOT ADD:**
- ❌ Verbose nested configuration with all options
- ❌ Comments explaining each field (use JSON schema instead)
- ❌ Options the project hasn't requested
- ❌ wiki.*, tracking.*, superpowers.* keys unless needed

**Rationale:** Defaults should live in code (config-loader.js), not config files

#### Principle 4: Preserve Existing Project Files

**If AGENTS.md exists:**
1. Read the entire file
2. Check for existing Powerlevel section (search for `<!-- POWERLEVEL MANAGED SECTION`)
3. If exists: Update metadata only (onboarded date, repo info)
4. If not exists: Insert HTML comment block at TOP (line 1)
5. NEVER append placeholder sections below the managed block

**If .opencode/config.json exists:**
1. Read existing config with JSON parser
2. Merge Powerlevel keys ONLY (projectBoard, superpowersIntegration)
3. Preserve all existing project settings
4. Never overwrite unrelated keys

#### Principle 5: Single Commit, Descriptive Message

**Commit message format:**
```
chore: add Powerlevel tracking metadata

- Added Powerlevel managed section to AGENTS.md (31 lines)
- Created .opencode/config.json for project board integration

No functional changes to project behavior.
```

**Why:** Transparency about what changed, minimal diff for review

### Impact Examples

#### Example 1: New Project (No AGENTS.md)

**Before onboarding:**
```
project/
├── README.md
├── src/
└── .git/
```

**After onboarding:**
```
project/
├── AGENTS.md          ← 31 lines (HTML comment block only)
├── .opencode/
│   └── config.json    ← 6 lines (minimal config)
├── README.md
├── src/
└── .git/
```

**Total impact:** 37 lines across 2 files

#### Example 2: Existing Project (With AGENTS.md)

**Before onboarding:**
```
project/
├── AGENTS.md          ← 200 lines (project-specific)
├── .opencode/
│   └── config.json    ← 50 lines (existing config)
├── README.md
└── .git/
```

**After onboarding:**
```
project/
├── AGENTS.md          ← 231 lines (31 added at top, 200 preserved)
├── .opencode/
│   └── config.json    ← 52 lines (2 keys merged)
├── README.md
└── .git/
```

**Total impact:** 33 lines added (31 in AGENTS.md, 2 keys in config.json)

### Anti-Patterns (DO NOT DO THIS)

❌ **Creating placeholder sections in AGENTS.md**
```markdown
<!-- POWERLEVEL MANAGED SECTION - END -->

---

## Project-Specific Context

<!-- Add project-specific documentation below this line -->

### Architecture

[Describe your project's architecture]
```

❌ **Creating docs/SUPERPOWERS.md workflow file**

❌ **Verbose .opencode/config.json with all options**
```json
{
  "superpowers": {
    "enabled": true,
    "remote": "superpowers",
    "repoUrl": "git@github.com:castrojo/superpowers.git",
    "autoOnboard": false,
    "wikiSync": true
  },
  "wiki": { ... },
  "tracking": { ... }
}
```

❌ **Adding content after the HTML comment block**

❌ **Multiple commits for onboarding changes**

### Verification Checklist

Before committing onboarding changes, verify:

- [ ] AGENTS.md has ONLY the HTML comment block (31 lines added)
- [ ] No placeholder sections after `<!-- POWERLEVEL MANAGED SECTION - END -->`
- [ ] No docs/SUPERPOWERS.md file created
- [ ] .opencode/config.json has ONLY 2 required keys (projectBoard, superpowersIntegration)
- [ ] Existing project files preserved (not overwritten)
- [ ] Single commit with descriptive message
- [ ] Commit message includes line counts for transparency

### For External Projects

Projects tracked by Powerlevel should be able to:
- ✅ Remove Powerlevel at any time (delete 31 lines + 2 config keys)
- ✅ Use their own AGENTS.md structure
- ✅ Ignore Powerlevel entirely if desired
- ✅ See Powerlevel as "just metadata for tracking"

**Powerlevel is a service to maintainers, not a dependency.**
```

**Step 3: Insert section into AGENTS.md**

Run: Edit tool to insert section after line 1054

**Step 4: Update Project Onboarding Implementation section reference**

Add paragraph at start of "Project Onboarding Implementation" section:

```markdown
## Project Onboarding Implementation

**⚠️ CRITICAL: Read "MINIMAL REPOSITORY IMPACT PRINCIPLES" section first.**

Onboarding must add ONLY what's required for tracking. Follow minimal impact principles strictly.

**For AI agents assisting with project onboarding:**
```

**Step 5: Commit documentation changes**

```bash
git add AGENTS.md
git commit -m "docs: add minimal repository impact principles for onboarding

- Documents current bloat problem (54-line template vs 31-line requirement)
- Establishes 5 mandatory principles for onboarding agents
- Provides examples of correct vs incorrect onboarding
- Adds verification checklist
- Cross-references in Project Onboarding section"
```

---

## Task 2: Update AGENTS.md Template to Remove Bloat

**Files:**
- Modify: `templates/AGENTS.md.template` (reduce from 54 to 31 lines)

**Step 1: Read current template**

Run: Read templates/AGENTS.md.template

**Step 2: Remove all content after line 31**

Delete everything after `<!-- POWERLEVEL MANAGED SECTION - END -->`:
- Remove `---` separator
- Remove `## Project-Specific Context` section
- Remove all placeholder sections (Architecture, Development Workflow, Testing, Deployment)

**Step 3: Verify template is exactly 31 lines**

Run: `wc -l templates/AGENTS.md.template`
Expected: 31

**Step 4: Commit template change**

```bash
git add templates/AGENTS.md.template
git commit -m "fix: remove placeholder sections from AGENTS.md template

Reduces template from 54 to 31 lines (HTML comment block only).

Rationale:
- Projects should define their own structure
- Placeholders create merge conflicts and duplicate work
- Powerlevel should be metadata-only, not structural

Follows minimal repository impact principles."
```

---

## Task 3: Create GitHub Issue #1 - Fix onboard-project.js to Skip SUPERPOWERS.md

**Files:**
- Create GitHub issue via gh CLI

**Step 1: Create issue body**

```markdown
## Problem

`bin/onboard-project.js` creates `docs/SUPERPOWERS.md` (40 lines) explaining Powerlevel workflow. This is redundant with AGENTS.md managed section and creates maintenance burden.

## Current Behavior

```javascript
// bin/onboard-project.js lines 90-145
function createStubDocumentation(cwd) {
  const docsDir = join(cwd, 'docs');
  const docPath = join(docsDir, 'SUPERPOWERS.md');
  
  // Creates 40-line workflow documentation file
  writeFileSync(docPath, content, 'utf8');
}
```

Called on line 421:
```javascript
createStubDocumentation(cwd);
```

## Expected Behavior

Skip `docs/SUPERPOWERS.md` creation entirely. This file is NOT project documentation.

## Solution

**Option A: Remove function entirely**
- Delete `createStubDocumentation()` function (lines 90-145)
- Remove call on line 421
- Update onboarding success message (remove reference to SUPERPOWERS.md)

**Option B: Add flag to disable**
- Add `--skip-superpowers-doc` flag
- Default to skipping (require `--create-superpowers-doc` to enable)
- Update help text

**Recommendation:** Option A (remove entirely). If users request it later, add opt-in flag.

## Acceptance Criteria

- [ ] `createStubDocumentation()` function removed
- [ ] Function call removed from main()
- [ ] Success message updated (no mention of SUPERPOWERS.md)
- [ ] Test: Run onboard script, verify no docs/SUPERPOWERS.md created
- [ ] Commit message follows minimal impact principles

## Related

- Follows "MINIMAL REPOSITORY IMPACT PRINCIPLES" in AGENTS.md
- Part of onboarding bloat reduction initiative
```

**Step 2: Create issue**

```bash
gh issue create \
  --repo castrojo/powerlevel \
  --title "Fix onboard-project.js to skip docs/SUPERPOWERS.md creation" \
  --body "$(cat issue-body.md)" \
  --label "type/bug,priority/p1,area/powerlevel"
```

**Step 3: Verify issue created**

Run: `gh issue list --repo castrojo/powerlevel --limit 1`

---

## Task 4: Create GitHub Issue #2 - Fix onboard-project.js to Use Minimal Config

**Files:**
- Create GitHub issue via gh CLI

**Step 1: Create issue body**

```markdown
## Problem

`bin/onboard-project.js` creates verbose `.opencode/config.json` with all options (lines 165-184). This violates minimal impact principles.

## Current Behavior

```javascript
// bin/onboard-project.js lines 165-184
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
```

Creates **20 lines** of config. Most are defaults that belong in code, not config files.

## Expected Behavior

Create **minimal config** with only required keys:

```json
{
  "projectBoard": {
    "enabled": true,
    "number": null,
    "autoCreate": true
  },
  "superpowersIntegration": {
    "enabled": true
  }
}
```

**6 lines total** (4 lines of actual config + braces)

## Solution

**Files to modify:**
- `bin/onboard-project.js` lines 165-184 (createDefaultConfig function)
- `lib/config-loader.js` (ensure defaults are in code)

**Steps:**
1. Update `createDefaultConfig()` to use minimal config
2. Verify `lib/config-loader.js` has defaults for all other keys
3. Update merge logic to preserve existing keys (lines 292-297)
4. Update tests if any exist

**Code change:**

```javascript
function createDefaultConfig(cwd, repoUrl) {
  const configDir = join(cwd, '.opencode');
  const configPath = join(configDir, 'config.json');

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  if (existsSync(configPath)) {
    console.log('  ⚠ .opencode/config.json already exists, skipping...');
    return;
  }

  const minimalConfig = {
    projectBoard: {
      enabled: true,
      number: null,
      autoCreate: true
    },
    superpowersIntegration: {
      enabled: true
    }
  };

  writeFileSync(configPath, JSON.stringify(minimalConfig, null, 2) + '\n', 'utf8');
  console.log('  ✓ Created .opencode/config.json (minimal)');
}
```

## Acceptance Criteria

- [ ] `createDefaultConfig()` creates 6-line config (not 20 lines)
- [ ] `lib/config-loader.js` provides defaults for all other keys
- [ ] Existing configs are preserved (merge logic works)
- [ ] Test: Run onboard script, verify minimal config created
- [ ] Test: Run onboard script on existing config, verify merge works
- [ ] Commit message follows minimal impact principles

## Related

- Follows "MINIMAL REPOSITORY IMPACT PRINCIPLES" in AGENTS.md
- Part of onboarding bloat reduction initiative
```

**Step 2: Create issue**

```bash
gh issue create \
  --repo castrojo/powerlevel \
  --title "Fix onboard-project.js to create minimal .opencode/config.json" \
  --body "$(cat issue-body.md)" \
  --label "type/bug,priority/p1,area/powerlevel"
```

---

## Task 5: Create GitHub Issue #3 - Document Missing GitHub Token Scope in Setup Docs

**Files:**
- Create GitHub issue via gh CLI

**Step 1: Create issue body**

```markdown
## Problem

Powerlevel requires `read:project` and `write:project` scopes for GitHub Project Boards, but this is not documented in setup instructions.

## Current State

**Default `gh auth login` scopes:**
```
Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

**Missing scopes:**
- `read:project` - Required to list and read project boards
- `write:project` - Required to add issues to project boards

**User Experience:**
```bash
$ gh project list --owner castrojo
error: your authentication token is missing required scopes [read:project]
To request it, run:  gh auth refresh -s read:project
```

Powerlevel silently fails when trying to:
- Auto-detect project boards (`lib/project-board-detector.js`)
- Add epics to project board (`lib/project-item-manager.js`)

No error message shown to user - just doesn't work.

## Solution

**Option A: Update Setup Documentation**

Add to `README.md` and `docs/MACHINE-SETUP.md`:

```markdown
## Prerequisites

### GitHub CLI with Project Board Scopes

Powerlevel requires additional GitHub token scopes:

\`\`\`bash
# Initial login (if not already authenticated)
gh auth login

# Add project board scopes
gh auth refresh -s read:project -s write:project
\`\`\`

**Verify scopes:**
\`\`\`bash
gh auth status | grep "Token scopes"
# Should include: read:project, write:project
\`\`\`
```

**Option B: Auto-Detect and Prompt**

Add scope detection to `plugin.js`:

```javascript
// plugin.js - check scopes on init
const scopes = await checkGitHubScopes(client);
if (!scopes.includes('read:project')) {
  await client.app.log({
    body: {
      service: 'powerlevel',
      level: 'warn',
      message: 'Missing GitHub scope: read:project. Project board features disabled. Run: gh auth refresh -s read:project -s write:project'
    }
  });
}
```

**Option C: Both**

Update docs (Option A) AND add detection (Option B).

## Recommendation

**Option C** - Documentation is essential, but detection prevents silent failures.

## Acceptance Criteria

- [ ] README.md includes scope refresh instructions
- [ ] docs/MACHINE-SETUP.md includes scope verification step
- [ ] plugin.js detects missing scopes and logs warning
- [ ] Test: Fresh `gh auth login` + run Powerlevel, see warning
- [ ] Test: After `gh auth refresh`, warning disappears

## Related

- Identified during castrojo/bluespeed setup audit
- Affects all new Powerlevel users
- Priority P0 (prevents core feature from working)
```

**Step 2: Create issue**

```bash
gh issue create \
  --repo castrojo/powerlevel \
  --title "Document and detect missing GitHub Project Board token scopes" \
  --body "$(cat issue-body.md)" \
  --label "type/bug,priority/p0,area/powerlevel"
```

---

## Task 6: Create GitHub Issue #4 - Add npm install Step to Setup Docs

**Files:**
- Create GitHub issue via gh CLI

**Step 1: Create issue body**

```markdown
## Problem

Powerlevel setup instructions don't mention running `npm install` to install dependencies. While `package.json` currently has no dependencies, best practice is to run this during setup.

## Current State

**Setup steps in docs:**
1. Clone powerlevel repository
2. Symlink plugin and skills
3. Update opencode.json
4. Run gh auth login

**Missing step:**
- Run `npm install` in powerlevel directory

**Evidence from audit:**
```bash
$ test -d ~/.config/opencode/powerlevel/node_modules
Dependencies MISSING
```

## Risk

If Powerlevel adds npm dependencies in the future, plugin will fail to load with cryptic errors.

## Solution

Add step to `README.md` and `docs/MACHINE-SETUP.md`:

```markdown
### Install Powerlevel

\`\`\`bash
cd ~/.config/opencode/powerlevel
npm install
\`\`\`

This ensures all dependencies are installed (even if package.json currently has none).
```

**Placement:** After cloning/symlinking, before configuring opencode.json

## Acceptance Criteria

- [ ] README.md includes `npm install` step
- [ ] docs/MACHINE-SETUP.md includes `npm install` step
- [ ] Step positioned correctly in sequence
- [ ] Explanation provided (best practice, future-proofing)

## Related

- Identified during castrojo/bluespeed setup audit
- Low priority but prevents future issues
```

**Step 2: Create issue**

```bash
gh issue create \
  --repo castrojo/powerlevel \
  --title "Add npm install step to setup documentation" \
  --body "$(cat issue-body.md)" \
  --label "type/docs,priority/p2,area/powerlevel"
```

---

## Task 7: Create GitHub Issue #5 - Add Global Config Creation to Setup Docs

**Files:**
- Create GitHub issue via gh CLI

**Step 1: Create issue body**

```markdown
## Problem

`bin/track-project.js` with `--auto` relies on `~/.config/opencode/powerlevel.json` to locate Powerlevel repository. This is not documented or created during setup.

## Current State

**lib/powerlevel-locator.js detection strategy:**
1. Check `~/.config/opencode/powerlevel.json` (global config)
2. Check current working directory
3. Search common paths (`~/.config/opencode/powerlevel`)
4. Prompt user to enter path manually

**Audit findings:**
```bash
$ test -f ~/.config/opencode/powerlevel.json
No global Powerlevel config
```

## Impact

- `bin/track-project.js --auto` requires manual path entry on first run
- Less convenient for users with multiple workspaces
- Not portable across machines

## Solution

Add setup step to create global config:

```markdown
### Configure Global Settings

Create \`~/.config/opencode/powerlevel.json\`:

\`\`\`bash
cat > ~/.config/opencode/powerlevel.json <<'EOF'
{
  "powerlevelPath": "$HOME/.config/opencode/powerlevel"
}
EOF
\`\`\`

This helps Powerlevel locate itself when running CLI tools from any directory.
```

**Alternative:** Make `bin/track-project.js` create this file automatically on first run.

## Acceptance Criteria

- [ ] README.md includes global config creation step
- [ ] docs/MACHINE-SETUP.md includes global config creation step
- [ ] Example config provided
- [ ] Explanation of purpose provided

**OR**

- [ ] `bin/track-project.js` auto-creates config on first run
- [ ] Logs message: "Created ~/.config/opencode/powerlevel.json"

## Recommendation

Start with documentation (easy). Consider auto-creation as future enhancement.

## Related

- Identified during castrojo/bluespeed setup audit
- Improves multi-workspace UX
```

**Step 2: Create issue**

```bash
gh issue create \
  --repo castrojo/powerlevel \
  --title "Add global config creation to setup documentation" \
  --body "$(cat issue-body.md)" \
  --label "type/docs,priority/p2,area/powerlevel"
```

---

## Task 8: Create GitHub Issue #6 - Clarify Superpowers Canonical Repository

**Files:**
- Create GitHub issue via gh CLI

**Step 1: Create issue body**

```markdown
## Problem

Ambiguity about which Superpowers repository is canonical:
- `obra/superpowers` (original author)
- `castrojo/superpowers` (mentioned in Powerlevel docs)

## Current State

**Audit findings:**
```bash
$ cd ~/.config/opencode/superpowers && git remote -v
origin https://github.com/obra/superpowers.git
```

**Powerlevel references:**
- AGENTS.md mentions "OpenCode + Superpowers"
- Onboarding creates superpowers remote pointing to... where?
- No explicit statement of canonical repo

## Impact

- Users don't know which repo to track
- May receive updates from wrong source
- Confusion about contribution workflow

## Solution

**Option A: Document canonical repo**

Add to README.md:

```markdown
## About Superpowers

Powerlevel integrates with [Superpowers](https://github.com/obra/superpowers), a skills framework for OpenCode.

**Canonical repository:** https://github.com/obra/superpowers  
**Maintainer:** @obra
```

**Option B: Maintain fork**

If castrojo maintains a fork:

```markdown
## About Superpowers

Powerlevel uses a fork of Superpowers with Powerlevel-specific enhancements:

**Fork:** https://github.com/castrojo/superpowers  
**Upstream:** https://github.com/obra/superpowers

Contributions should target the upstream repository.
```

## Acceptance Criteria

- [ ] README.md clarifies which Superpowers repo is used
- [ ] AGENTS.md updated if needed
- [ ] Onboarding scripts point to correct repo
- [ ] Contribution workflow documented

## Related

- Identified during castrojo/bluespeed setup audit
- Housekeeping / clarity issue
```

**Step 2: Create issue**

```bash
gh issue create \
  --repo castrojo/powerlevel \
  --title "Clarify canonical Superpowers repository in documentation" \
  --body "$(cat issue-body.md)" \
  --label "type/docs,priority/p3,area/powerlevel"
```

---

## Task 9: Create GitHub Issue #7 - Add Onboarding Verification Checklist to Docs

**Files:**
- Create GitHub issue via gh CLI

**Step 1: Create issue body**

```markdown
## Problem

No verification checklist exists for users to confirm Powerlevel/Superpowers is properly installed and working.

## Current State

**Setup documentation:**
- Lists installation steps
- No verification section
- No troubleshooting section

**Result:** Users don't know if setup worked until they try to use it.

## Solution

Add verification section to `README.md` and `docs/MACHINE-SETUP.md`:

```markdown
## Verify Installation

Run these commands to verify Powerlevel is properly configured:

### 1. Check Powerlevel Plugin

\`\`\`bash
test -f ~/.config/opencode/powerlevel/plugin.js && echo "✓ Plugin found" || echo "✗ Plugin missing"
\`\`\`

### 2. Check Skills Symlinks

\`\`\`bash
ls -la ~/.config/opencode/skills/ | grep -E "powerlevel|superpowers"
# Should show:
# powerlevel -> /var/home/user/.config/opencode/powerlevel/skills
# superpowers -> /var/home/user/.config/opencode/superpowers/skills
\`\`\`

### 3. Check GitHub Authentication

\`\`\`bash
gh auth status
# Should show: Logged in to github.com
# Token scopes: Must include 'repo', 'read:project', 'write:project'
\`\`\`

### 4. Check Dependencies

\`\`\`bash
test -d ~/.config/opencode/powerlevel/node_modules && echo "✓ Dependencies installed" || echo "✗ Run: npm install"
\`\`\`

### 5. Verify OpenCode Config

\`\`\`bash
cat ~/.config/opencode/opencode.json | jq '.plugin'
# Should include:
# "/var/home/user/.config/opencode/powerlevel/plugin.js"
# "/var/home/user/.config/opencode/plugins/superpowers.js"
\`\`\`

### 6. Test Session Start

Start OpenCode in a git repository and verify:
- [ ] No plugin errors in console
- [ ] Powerlevel score displayed
- [ ] Skills available via skill tool

## Troubleshooting

**Issue:** Plugin not loading  
**Fix:** Check opencode.json syntax with `jq . ~/.config/opencode/opencode.json`

**Issue:** Skills not found  
**Fix:** Verify symlinks exist: `ls -la ~/.config/opencode/skills/`

**Issue:** GitHub API errors  
**Fix:** Refresh token scopes: `gh auth refresh -s read:project -s write:project`
```

## Acceptance Criteria

- [ ] Verification checklist added to README.md
- [ ] Verification checklist added to docs/MACHINE-SETUP.md
- [ ] Each check has copy-paste command
- [ ] Troubleshooting section included
- [ ] Test: Follow checklist on fresh install

## Related

- Identified during castrojo/bluespeed setup audit
- Improves out-of-box experience
```

**Step 2: Create issue**

```bash
gh issue create \
  --repo castrojo/powerlevel \
  --title "Add installation verification checklist to documentation" \
  --body "$(cat issue-body.md)" \
  --label "type/docs,priority/p1,area/powerlevel"
```

---

## Task 10: Commit and Push Plan

**Step 1: Commit plan file**

```bash
git add docs/plans/2026-02-11-fix-onboarding-issues.md
git commit -m "docs: add implementation plan for onboarding fixes

Addresses 7 critical issues found during bluespeed setup audit:
1. Document minimal repository impact principles
2. Update AGENTS.md template (54→31 lines)
3. Fix onboard-project.js to skip SUPERPOWERS.md
4. Fix onboard-project.js to use minimal config
5. Document missing GitHub token scopes
6. Add npm install step to docs
7. Add global config creation to docs

Plan includes detailed tasks for documentation updates and GitHub issue creation."
```

**Step 2: Push to remote**

```bash
git push origin main
```

**Step 3: Verify push succeeded**

Run: `git status`
Expected: "Your branch is up to date with 'origin/main'"



---

**Epic:** #165 (https://github.com/castrojo/powerlevel/issues/165)
