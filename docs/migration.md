# Migration Guide

## Upgrading from opencode-superpower-github

### Quick Steps

1. **Update plugin path:**

In `~/.config/opencode/opencode.json`:
```json
{
  "plugin": [
    "~/.config/opencode/powerlevel/plugin.js"
  ]
}
```

2. **Update skills symlink:**
```bash
rm ~/.config/opencode/skills/github-tracker
ln -s ~/.config/opencode/powerlevel/skills ~/.config/opencode/skills/powerlevel
```

3. **Rename repository:**
- GitHub → Settings → Rename repository to "powerlevel"

4. **Update git remote:**
```bash
git remote set-url origin https://github.com/your-username/powerlevel.git
```

### What Changed

- Package name: `opencode-superpower-github` → `powerlevel`
- Version: `0.1.0` → `0.2.0`
- Multi-project support added
- Project labels added (`project/name`)
- Dashboard creation script added

### Backward Compatibility

All existing functionality still works. The rebrand is additive - old workflows are unchanged.
