# BP-001: GitHub Issue Form Validation

**Status:** Active
**Enforcement:** Lint Check
**Applies To:** Any project using GitHub issue forms (`.github/ISSUE_TEMPLATE/*.yml`)

## Overview

GitHub issue forms use YAML syntax with strict validation rules. This best practice documents YAML syntax requirements and GitHub-specific constraints to ensure issue forms validate correctly before pushing to GitHub.

## Rules

### MUST Requirements

#### 1. Values Must Be Strings

All attribute values in YAML MUST be quoted strings, even for boolean-like values.

**✅ Correct:**
```yaml
attributes:
  - type: dropdown
    attributes:
      options:
        - "yes"
        - "no"
```

**❌ Incorrect:**
```yaml
attributes:
  - type: dropdown
    attributes:
      options:
        - yes
        - no
```

#### 2. IDs Must Be Valid Identifiers

IDs MUST contain only alphanumeric characters, hyphens (`-`), and underscores (`_`).

**✅ Correct:**
```yaml
- type: input
  id: user_email
  attributes:
    label: Email Address
```

**❌ Incorrect:**
```yaml
- type: input
  id: user.email
  attributes:
    label: Email Address
```

#### 3. Labels and IDs Must Be Unique

Within a single issue form, all `label` values and all `id` values MUST be unique.

**✅ Correct:**
```yaml
body:
  - type: input
    id: contact_email
    attributes:
      label: Contact Email
  - type: input
    id: backup_email
    attributes:
      label: Backup Email
```

**❌ Incorrect:**
```yaml
body:
  - type: input
    id: email
    attributes:
      label: Email
  - type: input
    id: email  # Duplicate ID
    attributes:
      label: Backup Email
```

#### 4. Required Keys Must Be Present

Issue forms MUST include these top-level keys:
- `name` - Display name for the template
- `description` - Brief description
- `body` - Array of form elements

Each body element MUST include:
- `type` - Element type (input, textarea, dropdown, checkboxes, markdown)
- `attributes` - Element configuration

**✅ Correct:**
```yaml
name: Bug Report
description: File a bug report
body:
  - type: input
    attributes:
      label: Summary
```

**❌ Incorrect:**
```yaml
name: Bug Report
# Missing description
body:
  - type: input
    # Missing attributes
```

#### 5. No Empty Strings Where Values Required

Fields that require values (like `label`, `description`, `placeholder`) MUST NOT be empty strings.

**✅ Correct:**
```yaml
- type: input
  attributes:
    label: Bug Summary
    placeholder: Brief description of the issue
```

**❌ Incorrect:**
```yaml
- type: input
  attributes:
    label: ""
    placeholder: Brief description of the issue
```

### GitHub-Specific Constraints

#### Valid Type Values

The `type` field MUST be one of:
- `input` - Single-line text input
- `textarea` - Multi-line text input
- `dropdown` - Select dropdown
- `checkboxes` - Multiple checkboxes
- `markdown` - Static markdown content (informational)

#### Dropdown Options

Dropdown elements MUST have an `options` array with at least one option.

```yaml
- type: dropdown
  attributes:
    label: Operating System
    options:
      - "Linux"
      - "macOS"
      - "Windows"
```

#### Checkboxes Structure

Checkboxes MUST have a `label` array with at least one option.

```yaml
- type: checkboxes
  attributes:
    label: Acknowledgements
    options:
      - label: "I have read the documentation"
        required: true
```

## Validation

### Manual Validation

Use `yq` (YAML query tool) to validate syntax:

```bash
# Install yq if needed
# macOS: brew install yq
# Linux: wget https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64 -O /usr/local/bin/yq

# Validate all issue form templates
for file in .github/ISSUE_TEMPLATE/*.yml; do
  echo "Validating $file..."
  yq eval '.' "$file" > /dev/null && echo "✅ Valid" || echo "❌ Invalid"
done
```

### Automated Validation (Future)

Future enhancement: GitHub Actions workflow to validate issue forms on PR.

## References

- [GitHub Docs: Common Validation Errors](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/common-validation-errors-when-creating-issue-forms)
- [GitHub Docs: Syntax for Issue Forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [YAML Specification](https://yaml.org/spec/1.2.2/)

## Examples

### ✅ Complete Valid Example

```yaml
name: Bug Report
description: Report a bug in the application
title: "[Bug]: "
labels: ["type/bug", "status/triage"]
body:
  - type: markdown
    attributes:
      value: |
        ## Bug Report
        Please provide details about the issue you encountered.
  
  - type: input
    id: bug_summary
    attributes:
      label: Bug Summary
      description: Brief description of the bug
      placeholder: "Example: Application crashes when clicking Save button"
    validations:
      required: true
  
  - type: textarea
    id: reproduction_steps
    attributes:
      label: Steps to Reproduce
      description: How can we reproduce this issue?
      placeholder: |
        1. Go to '...'
        2. Click on '...'
        3. Scroll down to '...'
        4. See error
    validations:
      required: true
  
  - type: dropdown
    id: severity
    attributes:
      label: Severity
      description: How severe is this bug?
      options:
        - "Critical - Blocks all work"
        - "High - Major functionality broken"
        - "Medium - Feature partially broken"
        - "Low - Minor issue"
    validations:
      required: true
  
  - type: checkboxes
    id: acknowledgements
    attributes:
      label: Acknowledgements
      options:
        - label: "I have searched existing issues to avoid duplicates"
          required: true
        - label: "I have provided all required information"
          required: true
```

### ❌ Common Mistakes

```yaml
name: Bug Report
description: Report a bug
body:
  # ❌ Unquoted boolean-like value
  - type: dropdown
    attributes:
      options:
        - yes
        - no
  
  # ❌ Invalid ID (contains dot)
  - type: input
    id: user.email
    attributes:
      label: Email
  
  # ❌ Duplicate IDs
  - type: input
    id: contact
    attributes:
      label: Email
  
  - type: input
    id: contact  # Duplicate!
    attributes:
      label: Phone
  
  # ❌ Empty label
  - type: input
    attributes:
      label: ""
      placeholder: Enter something
  
  # ❌ Missing required 'attributes' key
  - type: textarea
```

## Changelog

- 2026-02-10: Initial version (BP-001)
