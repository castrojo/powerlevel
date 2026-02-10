# Central Superpowers Repository - Transparent Integration

**Date:** 2026-02-09  
**Status:** Design  
**Priority:** p2  
**Parent Epic:** #4

## Goal

Create `castrojo/superpowers` as a **transparent coordination layer** that:
- Aggregates plans from multiple projects for visibility
- Provides skill documentation via wiki for AI agents
- Operates completely behind the scenes - users never interact with it directly

## User Experience (What Users See)

### Installing Superpowers Tooling
```bash
# One-time install
npm install -g @castrojo/superpowers
```

### Working in Project
```bash
# User works in their project repo normally
cd ~/projects/my-app

# Create a plan in standard location
mkdir -p .opencode/plans
vim .opencode/plans/2026-02-10-new-feature.md

# Create epic using standard command
superpowers create-epic .opencode/plans/2026-02-10-new-feature.md

# ✓ Creates issues in my-app repo
# ✓ Adds to my-app project board
# ✓ Updates plan with epic link
# ✓ (Behind scenes: syncs to castrojo/superpowers)
```

**Users never know about castrojo/superpowers** - it just works.

---

## What Happens Behind the Scenes

### Plan Sync (Automatic)
```javascript
// In create-epic.js
async function createEpic(planPath) {
  // 1. Create issues in project repo (visible to user)
  const epic = await createEpicInProjectRepo(planPath);
  
  // 2. Sync to superpowers (transparent - user doesn't see this)
  await syncToSuperpowers(planPath);
  
  return epic;
}

async function syncToSuperpowers(planPath) {
  // Read project config
  const projectConfig = detectProjectConfig(); // from .git/config or package.json
  
  // Check if superpowers remote exists
  const hasRemote = await checkGitRemote('superpowers');
  
  if (!hasRemote) {
    // Add superpowers remote (silently)
    await execGit('remote add superpowers https://github.com/castrojo/superpowers.git');
  }
  
  // Push .opencode/ to superpowers:projects/<project-name>/
  await execGit('subtree push --prefix=.opencode superpowers main:projects/' + projectConfig.name);
  
  // Silent success - user never sees this
}
```

### Wiki Access (Automatic)
```javascript
// When AI agent needs skill docs
async function getSkillDoc(skillName) {
  // Fetch from superpowers wiki (cached locally)
  const wikiUrl = 'https://raw.githubusercontent.com/wiki/castrojo/superpowers/Skills-' + skillName + '.md';
  const cached = await getCachedWiki(wikiUrl);
  
  if (cached) return cached;
  
  // Fetch and cache
  const content = await fetch(wikiUrl).then(r => r.text());
  await cacheWiki(wikiUrl, content);
  
  return content;
}
```

---

## Repository Structure

### Project Repository (User's Workspace)
```
my-app/                                # User's project repo
├── src/                               # Project source code
├── .opencode/                         # Standard OpenCode location
│   ├── plans/
│   │   └── 2026-02-10-feature.md
│   ├── AGENTS.md                      # (Optional) Project-specific context
│   │                                  # References superpowers/AGENTS.md
│   └── config.json                    # Optional project config
├── .git/
│   └── config                         # Has superpowers remote (added automatically)
└── package.json
```

**Project `AGENTS.md` structure** (optional):
```markdown
# My App - Agent Context

## Superpowers Integration

This project uses [castrojo/superpowers](https://github.com/castrojo/superpowers) for:
- Epic creation workflow
- Planning conventions
- Best practices

See central guidance: https://github.com/castrojo/superpowers/AGENTS.md

## Project-Specific Context

- Tech stack: Node.js + React
- Architecture: Microservices
- [... project-specific details ...]
```

This allows:
1. **Reuse central skills** from superpowers
2. **Add project-specific context** where needed
3. **Reference central opinions** without duplication

### Superpowers Repository (Central Skills & Coordination)
```
castrojo/superpowers/
├── README.md                          # How to use superpowers in your project
├── AGENTS.md                          # Central instructions for AI agents
│                                      # - How project repos use superpowers
│                                      # - Superpowers opinions and patterns
│                                      # - References to skills and best practices
│
├── skills/                            # Reusable Superpowers skills
│   ├── epic-creation/
│   │   ├── SKILL.md                   # Skill for AI agents
│   │   └── AGENTS.md                  # Architecture documentation
│   ├── land-the-plane/
│   ├── writing-plans/
│   └── ...
│
├── projects/                          # Auto-synced from project repos
│   ├── my-app/                        # (pushed automatically from my-app)
│   │   ├── plans/
│   │   └── config.json
│   ├── another-app/                   # (pushed automatically from another-app)
│   │   └── plans/
│   └── ...
│
├── docs/                              # Best practices & architecture
│   ├── best-practices/
│   │   ├── labeling-strategy.md
│   │   └── planning-guidelines.md
│   └── architecture/
│       ├── epic-creation-flow.md
│       └── github-integration.md
│
└── lib/                               # Published as @castrojo/superpowers npm package
    ├── epic-creator.js
    ├── wiki-fetcher.js
    └── sync-manager.js
```

### Superpowers Wiki (AI Documentation)
```
Home.md                                # Overview & navigation
AGENTS.md                              # Central agent instructions (top-level)
Skills-Epic-Creation.md                # Auto-published from skills/epic-creation/SKILL.md
Skills-Writing-Plans.md                # Auto-published from skills/writing-plans/SKILL.md
Best-Practices-Planning.md             # Auto-published from docs/best-practices/
...
```

**Key Files**:

1. **`AGENTS.md` (top-level)** - Central instructions for AI agents:
   - How to use superpowers in project repos
   - Superpowers opinions (labeling, planning, workflow)
   - References to available skills
   - Best practices for multi-project work

2. **`skills/*/SKILL.md`** - Individual skill documentation for AI
   - Loaded by OpenCode when skill is invoked
   - Published to wiki for easy reference

3. **`skills/*/AGENTS.md`** - Architecture docs for each skill
   - For developers/maintainers
   - How the skill works internally

---

## Configuration (Optional)

Users can optionally configure in `.opencode/config.json`:

```json
{
  "project": {
    "name": "my-app",
    "repository": "me/my-app"
  },
  "superpowers": {
    "sync": true,                      // Auto-sync to castrojo/superpowers (default: true)
    "wiki": "castrojo/superpowers"     // Where to fetch skill docs (default)
  }
}
```

Most users won't need this - auto-detection works.

---

## CLI Tool: `superpowers` Command

Published as npm package `@castrojo/superpowers`:

```bash
# Create epic (standard workflow)
superpowers create-epic .opencode/plans/my-plan.md

# List all projects (maintainer view)
superpowers list-projects

# Fetch latest skill docs
superpowers update-docs

# Check sync status
superpowers status
```

---

## Auto-Detection Logic

The tool auto-detects project info from:

1. **Git remote origin**:
   ```bash
   git remote get-url origin
   # → https://github.com/user/my-app.git
   # Extracted: user/my-app
   ```

2. **package.json** (if Node.js):
   ```json
   {
     "name": "my-app",
     "repository": "github:user/my-app"
   }
   ```

3. **Repo root directory name**: Last resort fallback

---

## Transparent Sync Strategy

### When Sync Happens
- After creating an epic
- After updating a plan
- On `git push` (via git hook - optional)
- Manual: `superpowers sync`

### What Gets Synced
- `.opencode/plans/` directory
- `.opencode/config.json` (if exists)
- `.opencode/AGENTS.md` (if exists)

### What Doesn't Get Synced
- Source code
- Tests
- Build artifacts
- Anything outside `.opencode/`

---

## Migration Plan

### Step 1: Create Superpowers Repo & NPM Package
```bash
# Create repo
gh repo create castrojo/superpowers --public

# Initialize structure
cd superpowers
mkdir -p projects docs/skills lib
echo "# Superpowers" > README.md

# Publish npm package
npm init -y
npm publish @castrojo/superpowers
```

### Step 2: Convert opencode-superpower-github

```bash
cd ~/src/opencode-superpower-github

# Move plans to standard location
mkdir -p .opencode/plans
mv docs/plans/* .opencode/plans/ 2>/dev/null || true

# Create config (optional - auto-detection works)
cat > .opencode/config.json <<EOF
{
  "project": {
    "name": "opencode-superpower-github",
    "repository": "castrojo/opencode-superpower-github"
  }
}
EOF

# Commit
git add .opencode/
git commit -m "refactor: use standard .opencode location"
git push

# Test transparent sync
npx @castrojo/superpowers create-epic .opencode/plans/existing-plan.md
# → Should auto-sync to superpowers (user doesn't see this)
```

### Step 3: Verify Transparency

```bash
# Check that sync happened (in superpowers repo)
cd ~/src/superpowers
git pull
ls projects/opencode-superpower-github/plans/
# Should see plans synced automatically
```

---

## Benefits of Transparent Approach

### For Users
- ✅ **No new concepts** - just `.opencode/plans/` (standard)
- ✅ **No manual sync** - happens automatically
- ✅ **No superpowers repo interaction** - never see it
- ✅ **Standard git workflow** - nothing changes
- ✅ **Works in any project** - just install the tool

### For Maintainers
- ✅ **Central visibility** - all plans in one place
- ✅ **No user support needed** - it just works
- ✅ **Wiki for AI agents** - skill docs centralized
- ✅ **Opt-in sync** - can disable if needed

### For AI Agents
- ✅ **Consistent skill docs** - fetched from wiki
- ✅ **Project context** - aggregated in superpowers
- ✅ **Cached locally** - fast access
- ✅ **Auto-updated** - always current

---

## Implementation Phases

### Phase 1: Core Package
- [ ] Create `@castrojo/superpowers` npm package
- [ ] Implement `create-epic` command (existing functionality)
- [ ] Add auto-detection for project info
- [ ] Test in opencode-superpower-github

### Phase 2: Transparent Sync
- [ ] Add superpowers remote automatically
- [ ] Implement `git subtree push` for `.opencode/`
- [ ] Make sync silent (no user-facing output)
- [ ] Add opt-out mechanism

### Phase 3: Wiki Integration
- [ ] Set up superpowers wiki
- [ ] Implement wiki fetcher with caching
- [ ] Auto-publish docs to wiki via GitHub Actions
- [ ] Test skill doc fetching

### Phase 4: Polish
- [ ] Add `superpowers status` command
- [ ] Add `superpowers list-projects` for maintainers
- [ ] Write documentation
- [ ] Publish v1.0.0

---

## Open Questions

1. **Sync frequency**: After every epic creation, or batched?
2. **Opt-out**: Environment variable? Config file? Both?
3. **Conflict resolution**: What if projects have same name?
4. **Private repos**: How to handle authentication for sync?
5. **Failure handling**: What if sync fails? Silent or notify user?

---

## Success Criteria

- [ ] User installs `@castrojo/superpowers` package
- [ ] User runs `superpowers create-epic` in their project
- [ ] Issues created in their project repo (not superpowers)
- [ ] Plan auto-syncs to superpowers repo (user doesn't know)
- [ ] No manual superpowers interaction required
- [ ] Wiki provides skill docs for AI agents
- [ ] Works in any project with `.opencode/plans/`

---

**Epic:** #4 (https://github.com/castrojo/opencode-superpower-github/issues/4)
