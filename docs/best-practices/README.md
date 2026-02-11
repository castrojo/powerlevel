# Powerlevel Best Practices

Standards for all projects managed by Powerlevel. These practices apply to ANY project tracked in the Powerlevel dashboard.

## How to Use These Practices

**For AI Agents:**
1. When working on a Powerlevel-tracked project, read that project's `AGENTS.md`
2. Follow the link to this document
3. Review all applicable best practices before making changes
4. Apply MUST requirements strictly (these are lint-enforced)

**For Humans:**
- Reference these docs when setting up new projects
- Use the lint commands to validate before committing
- Suggest new best practices via PRs to Powerlevel repo

## Available Best Practices

### BP-001: GitHub Issue Form Validation
**URL:** https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/github-issue-form-validation.md

**Applies to:** Any project using GitHub issue forms (`.github/ISSUE_TEMPLATE/*.yml`)

**Summary:** YAML syntax rules and GitHub-specific validation requirements for issue form templates.

**Enforcement:** Lint check via `gh` CLI + YAML parser

---

### BP-002: Upstream Pull Request Workflow

**URL:** https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/upstream-pr-workflow.md

**Applies to:** Fork-based contribution workflows

**Summary:** Guidelines for preparing pristine single-commit pull requests from fork to upstream with auto-detection, verification, and manual submission gate.

**Enforcement:** Agent-Guided (Manual gate enforced)

---

## Adding New Best Practices

1. Create new markdown file: `docs/best-practices/{topic}.md`
2. Use clean kebab-case names (e.g., `github-issue-form-validation.md`)
3. Assign next BP number (BP-002, BP-003, etc.) in the document frontmatter
4. Add entry to this README with URL, summary, and enforcement method
5. Update `AGENTS.md` to reference the new practice
6. Commit with message: `docs: add BP-XXX {topic}`

## URL Pattern

All best practices use stable GitHub raw URLs:

```
https://raw.githubusercontent.com/castrojo/powerlevel/main/docs/best-practices/{topic}.md
```

**Benefits:**
- No git clone required (just HTTP fetch)
- Cached by GitHub CDN
- Works from any environment
- No authentication needed (public repo)

## Best Practice Document Template

```markdown
# BP-XXX: {Title}

**Status:** Active | Draft | Deprecated
**Enforcement:** Manual | Lint Check | CI Required
**Applies To:** All Projects | Specific Tech Stack

## Overview

[2-3 sentences explaining what this practice covers]

## Rules

### MUST Requirements

1. [Requirement with clear pass/fail criteria]
2. [Another requirement]

### SHOULD Recommendations

1. [Soft recommendation]
2. [Another recommendation]

## Validation

[Command to run for lint check, if applicable]

## References

- [External documentation links]
- [GitHub docs references]

## Examples

### ✅ Good

[Example following the practice]

### ❌ Bad

[Example violating the practice]
```

## Changelog

- 2026-02-10: Created best practices system (BP-001)
