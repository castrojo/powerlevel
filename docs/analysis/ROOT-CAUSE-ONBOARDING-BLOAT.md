# Root Cause Analysis: Onboarding Bloat and Minimal Repository Impact Violation

**Date:** 2026-02-11  
**Analyst:** OpenCode AI Agent  
**Context:** Discovered during castrojo/bluespeed setup audit  
**Related Epic:** #165

---

## Executive Summary

The Powerlevel onboarding process violates its own "tracking-only" design philosophy by adding 113 lines of bloat to newly onboarded projects:
- 53-line AGENTS.md (should be ~29 lines)
- 40-line SUPERPOWERS.md (should not exist)
- 20-line config.json (should be 6 lines)

**Root Cause:** No written principle about "minimal repository impact" existed when the template and onboarding scripts were designed on February 10, 2026.

**Impact:** Every project onboarded since template creation has received unnecessary bloat that contradicts Powerlevel's "tracking-only" philosophy.

---

## The Core Contradiction

### What the Design Philosophy Says

From commit `b1c1db0` (2026-02-10):

> "Powerlevel is **always a tracking-only system**. All epics track work happening in other repositories. Powerlevel never manages the actual work—it only displays unified status snapshots."

**Implication:** Powerlevel should be metadata-only with zero impact on project structure.

### What the Onboarding Process Actually Does

**Template creates placeholder sections:**
```markdown
### Architecture
[Describe your project's architecture]

### Development Workflow
[Describe your development workflow]

### Testing
[Describe how to run tests]

### Deployment
[Describe deployment process]
```

**Script creates workflow documentation:**
- `docs/SUPERPOWERS.md` (40 lines explaining Powerlevel internals)

**Script creates verbose config:**
- `.opencode/config.json` with ALL options (20 lines)
- Uses deprecated schema (`superpowers.*`, `wiki.*`, `tracking.*`)
- Missing new schema keys (`projectBoard.*`, `superpowersIntegration.*`)

**Violations:**
- ❌ Imposes structure on projects (Architecture/Testing sections)
- ❌ Makes Powerlevel feel like a documentation framework
- ❌ Creates maintenance burden (40 lines of redundant workflow docs)
- ❌ Duplicates defaults that belong in code, not config files

---

## Timeline of Events

### February 10, 2026: Design Philosophy Established

**Commit:** `b1c1db0` - "codify tracking-only design philosophy"

**Documented:**
- Powerlevel is tracking-only
- Never manages actual work
- Only displays status snapshots

**NOT Documented:**
- Minimal repository footprint
- Metadata-only files
- No structural placeholders

**Gap:** Philosophy focused on *Powerlevel's behavior* but didn't extend to *onboarding footprint*.

### February 10, 2026 17:08: Template Created with Bloat

**Commit:** `9a43115` - "add AGENTS.md template for tracked projects"

**Created:** `templates/AGENTS.md.template` with 53 lines
- Lines 1-31: Correct managed section ✅
- Lines 32-54: Placeholder sections (Architecture/Development/Testing/Deployment) ❌

**No consideration of:** Line count, footprint size, minimal impact

**Why this happened:**
1. No written principle about minimal footprint
2. Followed common boilerplate template pattern
3. Seemed "helpful" to provide structure guidance

### February 10, 2026 17:11: Onboarding Script Enhanced

**Commit:** `ffc4cb2` - "create AGENTS.md during project onboarding"

**Added:** Automatic AGENTS.md creation from template

**Script behavior:**
```javascript
// bin/onboard-project.js
createStubDocumentation(cwd);  // Creates docs/SUPERPOWERS.md (40 lines)
createDefaultConfig(cwd);      // Creates .opencode/config.json (20 lines)
createAgentsFile(cwd);         // Creates AGENTS.md (53 lines from template)
```

**No validation:** Script doesn't check footprint size or bloat.

### February 10, 2026 17:12: Bloat Documented as Intentional

**Commit:** `46dc47d` - "document AGENTS.md template usage"

**File:** `templates/README.md`

**Explicitly documented placeholder sections:**
```markdown
2. **Project-Specific Context** (customizable)
   - Architecture notes
   - Development workflow
   - Testing instructions
   - Deployment process
```

**This made bloat official policy.** Not an accident or oversight—it was the intended design.

### February 11, 2026: Problem Discovered

**Context:** Bluespeed onboarding audit

**Found:**
- Template creates 53 lines (23 extra lines of placeholders)
- Script creates 40-line SUPERPOWERS.md (redundant workflow docs)
- Script creates 20-line config with wrong schema
- No verification checklist, missing token scopes, no npm install docs

**Total impact:** 113 lines added per project (should be ~35 lines maximum)

---

## Root Causes (Ranked by Importance)

### 1. No Written Principle Before Implementation ⭐⭐⭐⭐⭐

**The Smoking Gun:** "minimal repository impact" was never written down when template was designed.

**Evidence:**
- `b1c1db0` documented "tracking-only" on Feb 10
- Template created 12 hours later same day
- No document saying "metadata-only files" or "minimal footprint"

**Why this is the root cause:**
Without a written principle, the implementer had no constraint. Adding "helpful" placeholder sections seemed reasonable because there was no guidance saying otherwise.

**What was missing:**
```markdown
## Onboarding Principle: Metadata-Only Files

When adding files to tracked projects:
- ✅ Add project-specific metadata (repo name, epic link, date)
- ❌ Never add structural placeholders
- ❌ Never impose project organization
- Goal: 100% Powerlevel metadata, 0% project scaffolding
- Target: <10 lines per file
```

**Impact:** Without this principle, bloat seemed acceptable.

### 2. Template Followed Wrong Mental Model ⭐⭐⭐⭐

**Mental Model Used:** "Project generator" (e.g., create-react-app, cookiecutter)

**Common pattern:** Templates provide structure for users to fill in

**Industry examples:**
- create-react-app: Creates full project structure with folders/files
- cookiecutter: Generates boilerplate with placeholders
- GitHub repo templates: Include LICENSE, README with sections

**Why this pattern was wrong here:**
- Powerlevel is NOT a project generator
- Powerlevel is a tracking dashboard
- Role is metadata injection, not scaffolding

**Correct Mental Model:** "Dependency tracker" (e.g., Dependabot, Renovate)

**How Dependabot does it:**
```yaml
# .github/dependabot.yml (3 lines)
version: 2
updates:
  - package-ecosystem: "npm"
```

**Total footprint:** 3 lines. That's it.

**Impact:** Following the generator pattern instead of tracker pattern led to 37x bloat (113 lines vs 3 lines).

### 3. No Review or Validation ⭐⭐⭐

**Evidence:**
- Template committed directly to main
- No PR, no review, no validation
- Solo development (jorge.castro@gmail.com only committer)
- 12 commits in one day (fast iteration)

**Missing gates:**
1. Review question: "Does this template add only Powerlevel metadata?"
2. Validation: "Run onboard script, check diff—is footprint acceptable?"
3. Comparison: "How does Dependabot/Renovate do this?"
4. Test protocol: "Onboard dummy repo, inspect changes"

**Impact:** No gate prevented bloated template from becoming default.

### 4. Config Bloat Mirrored Template Bloat ⭐⭐⭐

**Same anti-pattern:** "Be helpful by showing all options upfront"

**Script behavior:**
```javascript
const defaultConfig = {
  superpowers: { /* 5 options */ },
  wiki: { /* 4 options */ },
  tracking: { /* 3 options */ }
};
// Result: 20 lines
```

**What was already in code:**
```javascript
// lib/config-loader.js
const DEFAULT_CONFIG = {
  superpowers: { /* same 5 options */ },
  wiki: { /* same 4 options */ },
  tracking: { /* same 3 options */ },
  projectBoard: { /* 3 options */ },
  superpowersIntegration: { /* 3 options */ }
};
```

**Problem:** Script duplicates defaults that already exist in code.

**Worse:** Uses deprecated schema, missing new keys (`projectBoard`, `superpowersIntegration`).

**Correct approach:**
```json
{
  "projectBoard": { "enabled": true },
  "superpowersIntegration": { "enabled": true }
}
```

**6 lines.** Code provides the rest.

**Impact:** Created configs that break when schema evolves.

### 5. No Testing Before Real Use ⭐⭐

**Evidence:**
- Template created Feb 10
- First real project onboarded Feb 11 (bluespeed)
- No test projects to validate footprint

**Missing steps:**
1. Onboard dummy repo
2. Inspect AGENTS.md, config.json, docs/
3. Ask: "Is this footprint acceptable?"
4. Compare: "How many lines do other tools add?"

**Impact:** Didn't discover bloat until real project impacted.

---

## Why This Will Happen Again (Without Changes)

### Current Risk Factors

1. **No written principles** - Future agents have no "minimal impact" guidance
2. **Template still has bloat** - Next project gets 53 lines
3. **Scripts contradict principles** - Even if AGENTS.md documents minimal impact, `onboard-project.js` adds bloat
4. **No automated validation** - Nothing prevents 100-line templates
5. **No examples** - How would an agent know 53 lines is too many?

### Scenario: Future Agent Onboards New Project

**Without fixes:**
```
Agent reads: "Powerlevel is tracking-only"
Agent thinks: "I should use minimal approach"
Agent runs: node bin/onboard-project.js
Script creates: 53-line AGENTS.md, 20-line config, 40-line SUPERPOWERS.md
Agent reports: "✓ Onboarded successfully"
Result: Agent had good intentions, script undermined them
```

**Script behavior overrides agent intentions.**

---

## Prevention Strategy: 5-Layer Defense

### Layer 1: Document Principle (Words) ⭐⭐⭐

**Action:** Add "MINIMAL REPOSITORY IMPACT PRINCIPLES" section to AGENTS.md

**Purpose:** Explain philosophy in natural language

**Effectiveness:** Medium (agents read it, but can't prevent script misuse)

**Status:** Documented in Epic #165 implementation plan

### Layer 2: Fix Template (Code) ⭐⭐⭐⭐⭐

**Action:** Remove lines 32-54 from `templates/AGENTS.md.template`

**Purpose:** Make bloat physically impossible

**Effectiveness:** High (can't create what doesn't exist)

**Status:** Documented in Issue #166 (not yet implemented)

### Layer 3: Fix Scripts (Code) ⭐⭐⭐⭐⭐

**Actions:**
1. Remove `createStubDocumentation()` from `bin/onboard-project.js`
2. Use minimal config (6 lines, correct schema)
3. Update success message (no SUPERPOWERS.md reference)

**Purpose:** Scripts enforce principles automatically

**Effectiveness:** High (agents typically run scripts, not manual steps)

**Status:** Documented in Issues #166, #167 (not yet implemented)

### Layer 4: Validation (Automated Check) ⭐⭐⭐⭐

**Action:** Create `bin/validate-onboarding.sh` script

**Purpose:** Check that AGENTS.md is ≤35 lines, config is <10 lines

**Checks:**
- AGENTS.md managed section ≤ 35 lines
- .opencode/config.json ≤ 10 lines
- docs/SUPERPOWERS.md does not exist

**Run via:** Pre-commit hook or manual validation

**Effectiveness:** High (catches violations before commit)

**Status:** Recommended, not yet documented in issues

### Layer 5: Examples (Reference) ⭐⭐⭐

**Action:** Create `docs/examples/minimal-onboarding-example.md`

**Purpose:** Show before/after of good onboarding

**Content:**
- Dependabot comparison (3 lines)
- Current Powerlevel (113 lines) ❌
- Target Powerlevel (37 lines max, ideally 9 lines) ✅

**Effectiveness:** Medium (helps agents understand goal)

**Status:** Recommended, not yet documented in issues

---

## Comparison: Powerlevel vs Other Tracking Tools

| Tool | Footprint | Files Added | Approach |
|------|-----------|-------------|----------|
| **Dependabot** | 3 lines | 1 file (`.github/dependabot.yml`) | Minimal config only |
| **Renovate** | 8 lines | 1 file (`renovate.json`) | Minimal config only |
| **Codecov** | 1 line | 1 file (`.codecov.yml`) | Minimal config only |
| **Powerlevel (current)** | 113 lines | 3 files (AGENTS.md, config.json, SUPERPOWERS.md) | Verbose with placeholders ❌ |
| **Powerlevel (target)** | ~35 lines | 2 files (AGENTS.md, config.json) | Metadata only ✅ |
| **Powerlevel (ideal)** | 9 lines | 1 file (AGENTS.md with link to upstream) | Ultra-minimal ✅ |

**Key insight:** Successful tracking tools add 1-8 lines. Powerlevel adds 113 lines (14x-113x more bloat).

---

## Recommended Fixes

### Immediate Actions (Critical Path)

1. **Fix template** - Remove lines 32-54 from `templates/AGENTS.md.template` (Issue #166)
2. **Fix config creation** - Use 6-line minimal config in `bin/onboard-project.js` (Issue #167)
3. **Remove SUPERPOWERS.md** - Delete `createStubDocumentation()` function (Issue #166)
4. **Document principles** - Add MINIMAL REPOSITORY IMPACT section to AGENTS.md (Task 1 in plan)

### Validation & Prevention

5. **Create validation script** - `bin/validate-onboarding.sh` (new recommendation)
6. **Add examples** - Create `docs/examples/minimal-onboarding-example.md` (new recommendation)
7. **Update README** - Cross-reference minimal impact principles in `templates/README.md`

### Future Optimization (Post-Fix)

8. **Consider 9-line snippet** - Move explanatory content upstream (proposed in earlier analysis)
9. **Add pre-commit hook** - Run validation automatically before commit
10. **Create comparison doc** - Show Powerlevel vs Dependabot/Renovate footprint

---

## Checklist for Onboarding Changes

Before ANY change to onboarding (template, scripts, docs):

- [ ] **Read:** MINIMAL REPOSITORY IMPACT PRINCIPLES section in AGENTS.md
- [ ] **Calculate:** How many lines will be added to project?
- [ ] **Justify:** Is EVERY line Powerlevel-specific metadata? (Not project scaffolding)
- [ ] **Compare:** Is this less than current template? (Ratchet downward, never upward)
- [ ] **Validate:** Run `bin/validate-onboarding.sh` (once created)
- [ ] **Test:** Onboard dummy project, inspect diff
- [ ] **Compare:** Is this comparable to Dependabot/Renovate footprint?
- [ ] **Review:** Get second pair of eyes on diff

**Target:** Every onboarding change should REDUCE footprint, never increase it.

---

## Answers to Key Questions

### Q: Why didn't the original implementer follow minimal principles?

**A:** Because minimal principles **weren't written down when template was created**. The design philosophy mentioned "tracking-only" but never extended that to "minimal onboarding footprint."

### Q: Was this a mistake or intentional design?

**A:** **Intentional design.** The template README explicitly documents placeholder sections as intended functionality. It followed the wrong mental model (project generator vs. tracker).

### Q: What single change would have prevented this?

**A:** Writing this sentence in AGENTS.md before implementing the template:

> "Onboarding files should add <10 lines of Powerlevel metadata only. No project scaffolding."

That single sentence would have changed the entire implementation.

### Q: How do we prevent this from happening again?

**A:**
1. Write principles BEFORE implementing features
2. Fix template/scripts to enforce principles automatically
3. Add validation checks (pre-commit hooks)
4. Create examples showing correct approach
5. Compare to industry standards (Dependabot, Renovate)

### Q: Who is responsible for following principles?

**A:**
- **Humans:** Read AGENTS.md before working on onboarding
- **AI Agents:** Must invoke skills/read docs before onboarding
- **Scripts:** Should enforce principles automatically (can't violate via automation)
- **Validation:** Pre-commit hooks catch violations

---

## Related Issues

All issues created as part of Epic #165:

- **#165** - Parent epic for onboarding fixes
- **#166** - Fix onboard-project.js to skip docs/SUPERPOWERS.md creation (P1)
- **#167** - Fix onboard-project.js to create minimal .opencode/config.json (P1)
- **#168** - Document and detect missing GitHub Project Board token scopes (P0)
- **#169** - Add npm install step to setup documentation (P2)
- **#170** - Add global config creation to setup documentation (P2)
- **#171** - Clarify canonical Superpowers repository in documentation (P3)
- **#172** - Add installation verification checklist to documentation (P1)

---

## Success Metrics

### Current State (Baseline)

- **Template size:** 53 lines (23 lines of bloat)
- **Files created:** 3 (AGENTS.md, config.json, SUPERPOWERS.md)
- **Total footprint:** 113 lines per project
- **Comparison to Dependabot:** 38x more bloat

### Target State (After Fixes)

- **Template size:** ~29 lines (0 lines of bloat)
- **Files created:** 2 (AGENTS.md, config.json)
- **Total footprint:** ~35 lines per project
- **Comparison to Dependabot:** 12x more bloat (acceptable for richer metadata)

### Ideal State (Future Optimization)

- **Template size:** 9 lines (ultra-minimal snippet + upstream link)
- **Files created:** 1 (AGENTS.md only)
- **Total footprint:** 9 lines per project
- **Comparison to Dependabot:** 3x more bloat (excellent for richer metadata)

---

## Appendix: Evidence Summary

### Commits Referenced

- `b1c1db0` (2026-02-10) - Codified tracking-only design philosophy
- `9a43115` (2026-02-10 17:08) - Created AGENTS.md template with 53 lines
- `ffc4cb2` (2026-02-10 17:11) - Added automatic AGENTS.md creation
- `46dc47d` (2026-02-10 17:12) - Documented template usage with placeholder sections

### Files Analyzed

- `templates/AGENTS.md.template` - 53 lines (should be 31)
- `templates/README.md` - Documents placeholder sections as intentional
- `bin/onboard-project.js` - Creates SUPERPOWERS.md and verbose config
- `lib/config-loader.js` - Already has defaults (no need to duplicate in files)
- `AGENTS.md` - Has "tracking-only" philosophy but not "minimal footprint"

### Projects Examined

- **castrojo/bluespeed** - First project onboarded, received 31-line managed section (manually cleaned placeholders)
- Audit revealed template would have created 53 lines + 40-line SUPERPOWERS.md + 20-line config

---

## Conclusion

**Root Cause:** No written principle about minimal repository impact when template designed.

**Contributing Factors:**
1. Followed wrong mental model (generator vs. tracker)
2. No review/validation before merge
3. No testing before real use
4. Defaults-in-config anti-pattern

**Prevention:** Document principles BEFORE implementing features, fix scripts to enforce automatically, add validation checks.

**Key Insight:** "Tracking-only system" was written down. "Minimal onboarding footprint" was not. **Unwritten principles don't get followed.**

---

**Next Steps:** Implement fixes per Epic #165 and create validation script to prevent regression.
