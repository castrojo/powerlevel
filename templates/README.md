# Powerlevel Templates

Templates for creating new projects in the Powerlevel system.

## Using the Project Template

1. Copy the project template:
```bash
cp -r templates/project-template projects/my-new-project
```

2. Edit `projects/my-new-project/config.json`:
   - Update `repo` to your GitHub repository
   - Update `labels.project` to `project/my-new-project`
   - Add a meaningful description

3. Create your first plan in `projects/my-new-project/plans/`

## AGENTS.md Template

Template for creating AGENTS.md files in Powerlevel-tracked projects.

### Using the Template

**Automated (Recommended):**

Run the onboarding script from the project directory:

```bash
node /path/to/powerlevel/bin/onboard-project.js
```

The script automatically creates AGENTS.md from the template.

**Manual:**

1. Copy the template:
```bash
cp templates/AGENTS.md.template /path/to/project/AGENTS.md
```

2. Replace placeholders:
   - `{{PROJECT_NAME}}` → `owner/repo`
   - `{{OWNER}}` → Repository owner
   - `{{REPO}}` → Repository name
   - `{{ONBOARDED_DATE}}` → Current date (YYYY-MM-DD)

3. Customize project-specific context section

### Template Structure

The template has two sections:

1. **Powerlevel Managed Section** (HTML-commented)
   - Best practices links
   - Powerlevel integration info
   - Should only be updated via template or manually with care

2. **Project-Specific Context** (customizable)
   - Architecture notes
   - Development workflow
   - Testing instructions
   - Deployment process

### Updating Tracked Projects

To update the managed section in existing tracked projects:

```bash
cd /path/to/project
node /path/to/powerlevel/bin/onboard-project.js --force
```

This preserves project-specific content while refreshing Powerlevel integration.
