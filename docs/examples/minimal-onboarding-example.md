# Minimal Onboarding Example

**Purpose:** Demonstrate the difference between "minimal repository impact" (tracking-only) vs. "project generator" (boilerplate) approaches.

**Context:** Created as part of root cause analysis for Epic #165 (onboarding bloat issue).

## The Problem

Powerlevel's design philosophy is "tracking-only system" but current onboarding adds 113 lines per project:
- `AGENTS.md` managed section: 53 lines (template)
- `.opencode/config.json`: 20 lines (config)
- `docs/SUPERPOWERS.md`: 40 lines (extra file)

**Expected:** 37 lines max (15 in AGENTS.md, 6 in config, no extra files)  
**Ideal:** 9 lines (8 in AGENTS.md, 1 in config)

---

## Comparison to Industry Standards

### Dependabot (3 lines - Ideal Standard)

**File:** `.github/dependabot.yml`

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
```

**Why it works:**
- Metadata-only (package type, no behavior)
- Dependabot reads external docs for behavior
- Zero repository bloat
- No placeholder sections

---

### Renovate (8 lines - Good Standard)

**File:** `renovate.json`

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended"
  ],
  "packageRules": []
}
```

**Why it works:**
- Points to external schema for validation
- Extends base config (behavior elsewhere)
- Empty arrays ready for customization
- Minimal local content

---

### Codecov (1 line - Minimal Standard)

**File:** `codecov.yml`

```yaml
coverage: {}
```

**Why it works:**
- Enables tracking with empty config
- All behavior from defaults
- Documentation lives in Codecov docs
- Ultimate minimal footprint

---

## Powerlevel Examples

### Current Implementation (113 lines - ❌ Wrong)

**File:** `AGENTS.md` (53 lines)

```markdown
# castrojo/example-project

<!-- POWERLEVEL MANAGED SECTION - START -->
## Managed by Powerlevel

This project is tracked by Powerlevel...

### For AI Agents

**CRITICAL:** Before making any changes to this project, you MUST:
1. Read the Powerlevel best practices: https://raw.githubusercontent.com/...
2. Review all applicable best practices for this project

### Project Info
- **Repository:** castrojo/example-project
- **Onboarded to Powerlevel:** 2026-02-11
- **Tracking Epic:** [View on GitHub](https://github.com/...)
<!-- POWERLEVEL MANAGED SECTION - END -->

---

## Project-Specific Context

<!-- Agents: This section is for project maintainers to document context -->

### Architecture

<!-- Document key architectural decisions, patterns, tech stack -->

### Development Workflow

<!-- Document dev environment setup, branch strategy, testing -->

### Testing Strategy

<!-- Document test patterns, coverage requirements, CI/CD -->

### Deployment

<!-- Document deployment process, environments, rollback -->
```

**Why this is wrong:**
- Placeholder sections (Architecture, Testing, Deployment) are project generator pattern
- Violates "tracking-only" philosophy
- Forces repo to contain what should be external docs
- Creates maintenance burden (stale placeholders)

**File:** `.opencode/config.json` (20 lines)

```json
{
  "$schema": "https://raw.githubusercontent.com/castrojo/powerlevel/main/schemas/opencode-config.schema.json",
  "mcp": {
    "servers": {
      "dosu": {
        "type": "remote",
        "url": "https://dosu.dev/mcp/castrojo/example-project",
        "authentication": {
          "type": "github-token",
          "scope": "repo"
        }
      }
    }
  },
  "superpowers": {
    "enabled": true,
    "wiki": "https://github.com/castrojo/superpowers/wiki"
  }
}
```

**Why this is wrong:**
- `superpowers` config: deprecated, should be in global config
- `wiki`: redundant, Superpowers location is standard
- Schema URL: unnecessarily long for every project
- Authentication object: verbose, could be simplified

**File:** `docs/SUPERPOWERS.md` (40 lines)

```markdown
# Superpowers Integration

This project uses OpenCode Superpowers for enhanced AI agent capabilities.

## What are Superpowers?
Superpowers are advanced workflows...
[38 more lines of generic Superpowers docs]
```

**Why this is wrong:**
- Duplicates content that lives in Superpowers repo
- No project-specific information
- Becomes stale when Superpowers updates
- Pure bloat (should link, not duplicate)

---

### Target Implementation (37 lines - ✅ Acceptable)

**File:** `AGENTS.md` (15 lines)

```markdown
# castrojo/example-project

<!-- POWERLEVEL MANAGED SECTION - START -->
## Managed by Powerlevel

This project is tracked by [Powerlevel](https://github.com/castrojo/powerlevel).

**For AI Agents:** Read best practices at https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/README.md

**Project Info:**
- Repository: castrojo/example-project
- Onboarded: 2026-02-11
- Tracking Epic: [View on GitHub](https://github.com/castrojo/powerlevel/issues?q=is:issue+label:project/example-project)
<!-- POWERLEVEL MANAGED SECTION - END -->

---

## Project-Specific Context

<!-- Add project-specific agent instructions below -->
```

**Why this works:**
- Links to external docs instead of duplicating
- No placeholder sections
- Tracking metadata only
- Clear separation (managed vs. project-specific)
- Follows Renovate pattern (extends external config)

**File:** `.opencode/config.json` (6 lines)

```json
{
  "$schema": "https://r.to/powerlevel-schema",
  "mcp": {
    "servers": {"dosu": {"type": "remote"}}
  }
}
```

**Why this works:**
- Minimal config (defaults from schema)
- Shortened schema URL (aliased)
- No deprecated keys
- Remote type only (URL from schema defaults)
- Authentication from global config

**File:** `docs/SUPERPOWERS.md` (removed)

**Why this works:**
- No duplicate documentation
- Links from AGENTS.md sufficient
- Zero maintenance burden
- Follows Codecov pattern (minimal footprint)

---

### Ideal Implementation (9 lines - ✅ Best)

**File:** `AGENTS.md` (8 lines)

```markdown
# castrojo/example-project

<!-- POWERLEVEL MANAGED SECTION - START -->
Tracked by [Powerlevel](https://github.com/castrojo/powerlevel). [Best Practices](https://r.to/powerlevel-bp) | [Epic](https://github.com/castrojo/powerlevel/issues?q=label:project/example-project)
<!-- POWERLEVEL MANAGED SECTION - END -->

---

## Project-Specific Context
```

**Why this is ideal:**
- Single line for tracking (like Codecov)
- Shortened URLs (GitHub redirects)
- All metadata in one line
- Still human-readable
- Ultimate minimal footprint

**File:** `.opencode/config.json` (1 line)

```json
{"$schema": "https://r.to/powerlevel-schema"}
```

**Why this is ideal:**
- Schema contains all defaults
- Per-project overrides in project config
- Global overrides in `~/.config/opencode/config.json`
- Matches Codecov pattern (empty config enables tracking)

---

## Design Patterns

### Tracker Pattern (Correct for Powerlevel)

**Characteristics:**
- Minimal metadata in repo
- Behavior defined externally
- Points to external docs/schemas
- Zero maintenance burden
- Examples: Dependabot, Renovate, Codecov

**Implementation:**
- Short AGENTS.md (tracking metadata + links)
- Minimal config (schema + overrides only)
- No duplicate docs
- No placeholder sections

### Generator Pattern (Wrong for Powerlevel)

**Characteristics:**
- Generates boilerplate/scaffolding
- Includes placeholder sections
- Duplicates external docs
- Creates maintenance burden
- Examples: create-react-app, Rails generators

**Implementation:**
- Long AGENTS.md (templates + placeholders)
- Verbose config (all options listed)
- Duplicate docs (SUPERPOWERS.md)
- Placeholder sections requiring fill-in

---

## Validation

Use `bin/validate-onboarding.sh` to check any project:

```bash
cd /var/home/jorge/.config/opencode/powerlevel
./bin/validate-onboarding.sh ~/src/example-project
```

**Checks:**
- ✅ AGENTS.md managed section ≤ 15 lines
- ✅ `.opencode/config.json` ≤ 10 lines
- ✅ No `docs/SUPERPOWERS.md`
- ✅ No deprecated config keys

---

## Migration Guide

### For Existing Projects

**If project has 113-line onboarding:**

1. **Backup current AGENTS.md:**
   ```bash
   cp AGENTS.md AGENTS.md.backup
   ```

2. **Replace managed section** with target implementation (15 lines)

3. **Remove placeholder sections** (Architecture, Development Workflow, etc.)
   - Keep project-specific content below `---`
   - Remove generic placeholders

4. **Update `.opencode/config.json`:**
   ```bash
   # Remove deprecated keys
   jq 'del(.superpowers, .wiki)' .opencode/config.json > .opencode/config.json.tmp
   mv .opencode/config.json.tmp .opencode/config.json
   ```

5. **Delete `docs/SUPERPOWERS.md`:**
   ```bash
   rm docs/SUPERPOWERS.md
   ```

6. **Validate:**
   ```bash
   /var/home/jorge/.config/opencode/powerlevel/bin/validate-onboarding.sh .
   ```

### For New Projects

Run fixed `onboard-project.js` (after Epic #165 fixes):

```bash
cd /var/home/jorge/.config/opencode/powerlevel
npm run onboard castrojo/new-project
```

Should produce:
- 15-line AGENTS.md managed section
- 6-line `.opencode/config.json`
- No `docs/SUPERPOWERS.md`

---

## Related Documentation

- **Root Cause Analysis:** `docs/analysis/ROOT-CAUSE-ONBOARDING-BLOAT.md`
- **Implementation Plan:** `docs/plans/2026-02-11-fix-onboarding-issues.md`
- **Template:** `templates/AGENTS.md.template` (to be fixed)
- **Validation Script:** `bin/validate-onboarding.sh`

---

## Success Metrics

| Metric | Current | Target | Ideal |
|--------|---------|--------|-------|
| Total lines | 113 | 37 | 9 |
| AGENTS.md | 53 | 15 | 8 |
| Config | 20 | 6 | 1 |
| Extra files | 1 | 0 | 0 |
| Maintenance burden | High | Low | Zero |

**Goal:** Match Dependabot/Renovate/Codecov pattern - tracking metadata only, behavior from external sources.
