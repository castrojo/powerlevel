# Manual Setup Checklist

After implementing the rebrand, complete these manual steps:

## GitHub Repository

- [ ] Rename repository: `opencode-superpower-github` → `powerlevel`
  - Go to GitHub → Settings → Repository name → Rename
  
- [ ] Update repository description:
  ```
  Multi-project management dashboard for OpenCode + Superpowers. Your Powerlevel = number of projects you're managing.
  ```

- [ ] Update repository topics/tags:
  - Remove: `issue-tracker`
  - Add: `project-management`, `dashboard`, `powerlevel`

## Local Configuration

- [ ] Update git remote:
  ```bash
  git remote set-url origin https://github.com/castrojo/powerlevel.git
  ```

- [ ] Update OpenCode config (`~/.config/opencode/opencode.json`):
  ```json
  {
    "plugin": [
      "~/.config/opencode/powerlevel/plugin.js"
    ]
  }
  ```

- [ ] Update skills symlink:
  ```bash
  rm ~/.config/opencode/skills/github-tracker
  ln -s ~/.config/opencode/powerlevel/skills ~/.config/opencode/skills/powerlevel
  ```

## Verification

- [ ] Test plugin loads: Start OpenCode session
- [ ] Test epic creation: Create a test plan
- [ ] Test dashboard creation: Run `node bin/create-dashboard.js`

## Complete!

Once all items are checked, the rebrand is complete.
