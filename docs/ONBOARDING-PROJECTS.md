# Onboarding Projects to Powerlevel

Guide for adding external projects to Powerlevel tracking and distributing best practices.

---

## ⚠️ KNOWN ISSUES - DO NOT ONBOARD NEW PROJECTS YET

**Current onboarding process adds excessive bloat (113 lines per project).**

**Status:** Epic #165 in progress to fix onboarding bloat  
**Root Cause:** [docs/analysis/ROOT-CAUSE-ONBOARDING-BLOAT.md](../analysis/ROOT-CAUSE-ONBOARDING-BLOAT.md)

**Issues being fixed:**
- Template adds 53-line placeholder sections (should be 15 lines)
- Config generates 20+ lines (should be 6 lines)
- Creates unnecessary `docs/SUPERPOWERS.md` (should not exist)

**Timeline:**
- Documentation phase: ✅ Complete (root cause analysis, validation tools, examples)
- Implementation phase: ⏳ In progress (Issues #166, #167, #168, #172)
- Release: Target TBD after all P0/P1 issues resolved

**For new projects:** Wait until Epic #165 is closed before onboarding.  
**For existing projects:** See [Migration Guide](../examples/minimal-onboarding-example.md#migration-guide) to reduce bloat.

**Validation:** After fixes, run `bin/validate-onboarding.sh` to verify minimal footprint.

---

## Overview

When you onboard a project to Powerlevel, you create a tracking relationship where:

1. **Powerlevel tracks the project's progress** - Epics, sub-issues, status updates
2. **Project follows Powerlevel best practices** - Via AGENTS.md references
3. **Agents discover standards automatically** - Through documentation chain

## Prerequisites

Before onboarding a project:

- [ ] Project is in a git repository
- [ ] You have write access to the project
- [ ] Project has `.opencode/config.json` or will have one created
- [ ] GitHub CLI (`gh`) is authenticated: `gh auth status`

## Automated Onboarding (Recommended)

### Step 1: Navigate to project directory

```bash
cd /path/to/your/project
```

### Step 2: Run onboarding script

From the Powerlevel repository:

```bash
node /path/to/powerlevel/bin/onboard-project.js
```

Or if you're in the project directory and have Powerlevel as a remote:

```bash
# If Powerlevel is set as 'superpowers' remote
git fetch superpowers
node path/to/onboard-project.js
```

### Step 3: Review what was created

The script creates/updates:

1. **`.opencode/config.json`** - Configuration file (if doesn't exist)
2. **`AGENTS.md`** - Agent instructions with Powerlevel integration
   - Managed section (HTML-commented to prevent accidental edits)
   - Best practices links
   - Project-specific context section (customizable)
3. **Git remote** - `superpowers` remote pointing to Powerlevel (if configured)

### Step 4: Customize project-specific context

⚠️ **Note:** This section describes the current (bloated) behavior. After Epic #165 fixes, placeholder sections will be removed.

Edit `AGENTS.md` and add **only project-specific information** below the managed section:

```markdown
<!-- POWERLEVEL MANAGED SECTION - END -->

---

## Project-Specific Context

### Architecture

Our project uses a microservices architecture with:
- Frontend: React + TypeScript
- Backend: Node.js + Express
- Database: PostgreSQL

### Development Workflow

1. Create feature branch from `main`
2. Write tests first (TDD)
3. Implement feature
4. Run full test suite
5. Create PR with template
6. Squash merge after approval
```

**Important:** Only add sections that are actually relevant to your project. Empty placeholder sections violate the "minimal repository impact" principle and will be removed in future template versions.

### Step 5: Commit changes

```bash
git add .opencode/config.json AGENTS.md
git commit -m "chore: onboard project to Powerlevel tracking"
git push
```

## Manual Onboarding

If you prefer manual setup or need more control:

### Step 1: Copy template files

```bash
# From your project root
cp /path/to/powerlevel/templates/AGENTS.md.template ./AGENTS.md
```

### Step 2: Replace placeholders

Edit `AGENTS.md` and replace:
- `{{PROJECT_NAME}}` → `owner/repo` (e.g., `castrojo/tap`)
- `{{OWNER}}` → `owner` (e.g., `castrojo`)
- `{{REPO}}` → `repo` (e.g., `tap`)
- `{{ONBOARDED_DATE}}` → Current date (YYYY-MM-DD)

### Step 3: Create config if needed

If `.opencode/config.json` doesn't exist:

```bash
mkdir -p .opencode
cp /path/to/powerlevel/.opencode/config.json.template .opencode/config.json
```

Edit `.opencode/config.json` and set `superpowers.repoUrl` to Powerlevel repository.

### Step 4: Commit

```bash
git add .opencode/config.json AGENTS.md
git commit -m "chore: onboard project to Powerlevel tracking"
git push
```

## Verification

After onboarding, verify the setup:

### Check AGENTS.md

```bash
cat AGENTS.md | grep "Managed by Powerlevel"
```

Expected: Should see the managed section with best practices links.

### Check Configuration

```bash
cat .opencode/config.json | grep -A 5 "superpowers"
```

Expected: Should see superpowers config with enabled=true.

### Test Best Practices Access

```bash
curl -s https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/README.md | head -20
```

Expected: Should fetch the best practices index.

## Agent Discovery Flow

After onboarding, here's how agents discover best practices:

```
1. Agent starts work in tracked project
        ↓
2. Agent reads project's AGENTS.md
        ↓
3. Finds "Managed by Powerlevel" section
        ↓
4. Follows link: https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/README.md
        ↓
5. Reads best practices index
        ↓
6. Identifies applicable practices (e.g., BP-001 for issue forms)
        ↓
7. Fetches specific practice: https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/github-issue-form-validation.md
        ↓
8. Applies MUST requirements and SHOULD recommendations
```

**No git clone, no wiki sync, just HTTP fetches of raw markdown files.**

## Updating Tracked Projects

When Powerlevel adds new best practices or updates existing ones:

### Automatic Updates (via Template)

If you want to refresh the managed section:

```bash
cd /path/to/your/project
node /path/to/powerlevel/bin/onboard-project.js --force
```

This overwrites the managed section with the latest template while preserving project-specific context.

### Manual Updates

Edit `AGENTS.md` and update the managed section (between HTML comments) with new best practice links.

## Troubleshooting

### "AGENTS.md already exists" Warning

**Symptom:** Script reports AGENTS.md exists and prompts for overwrite.

**Solution:**
- Answer "yes" to overwrite with Powerlevel template
- Answer "no" to manually merge Powerlevel section into existing file
- Use `--force` flag to skip prompt: `node bin/onboard-project.js --force`

### Best Practices Links Don't Work

**Symptom:** Fetching raw URLs returns 404.

**Causes:**
- Repository is private (raw URLs only work for public repos)
- File path is incorrect
- File hasn't been pushed to `main` branch yet

**Solution:**
- Make Powerlevel repository public (recommended)
- Or: Use authenticated git clone instead of raw URLs (more complex)

### Template Placeholders Not Replaced

**Symptom:** AGENTS.md contains `{{PROJECT_NAME}}` instead of actual project name.

**Cause:** Manual copy of template without placeholder replacement.

**Solution:**
- Use automated script: `node bin/onboard-project.js`
- Or: Manually find/replace all `{{...}}` placeholders

## FAQ

### Do I need the superpowers git remote?

**No.** The superpowers remote is optional. Best practices are distributed via GitHub raw URLs (HTTP), not git remotes. The remote is only useful if you want to:
- Fetch Superpowers skills directly
- Use worktree-based workflows
- Contribute back to Powerlevel

For most projects, just having `AGENTS.md` with best practices links is sufficient.

### What if my project already has AGENTS.md?

**Answer:** The onboarding script will prompt you to overwrite or skip. If you skip, manually add the Powerlevel managed section to your existing AGENTS.md. Use HTML comments to mark it for easier updates later.

### Can I opt out of specific best practices?

**Yes.** Add to `.opencode/config.json`:

```json
{
  "bestPractices": {
    "enabled": true,
    "exclude": ["BP-001"]  // Skip BP-001 for this project
  }
}
```

Agents should respect this configuration.

### How do I add project-specific best practices?

**Answer:** Add them to your project's `AGENTS.md` in the project-specific context section. Powerlevel best practices are for standards that apply to ALL tracked projects. Project-specific practices stay in the project.

### What if Powerlevel repository becomes private?

**Answer:** GitHub raw URLs only work for public repositories. If Powerlevel becomes private, you'll need to:
- Use authenticated git clone to fetch best practices
- Or: Distribute best practices via wiki (more complex)
- Or: Copy best practices into each tracked project (loses centralization)

**Recommendation:** Keep Powerlevel repository public to maintain simple HTTP-based distribution.

## Next Steps

After onboarding:

1. **Review applicable best practices** - Check which practices apply to your project
2. **Run lint checks** - Validate existing code against MUST requirements
3. **Fix violations** - Address any issues found by lint checks
4. **Update CI/CD** - Add best practice validation to your pipeline (optional)
5. **Educate team** - Share AGENTS.md and best practices with your team
6. **Track progress** - Create tracking epic in Powerlevel dashboard

## Related Documentation

- [Powerlevel Architecture](../AGENTS.md) - Full architecture overview
- [Best Practices Index](best-practices/README.md) - All available best practices
- [Wiki Sync System](WIKI-SYNC.md) - Wiki sync for skills (not used for best practices)
- [Superpowers Skills](https://github.com/castrojo/superpowers) - Shared workflow skills
