---
name: land-the-plane
description: Use at session end or when disconnecting - syncs dirty epics to GitHub, ensuring no work is lost when the session ends
---

# Land the Plane

## Overview

Sync dirty epics to GitHub before session end, ensuring all work is persisted.

**Core principle:** Session state is temporary. GitHub is permanent. Sync before disconnect.

**Called by:** `session.idle` hook (automatic) and `/gh-sync` command (manual).

## The Process

### 1. Load Cache and Check Dirty State

```bash
# Load the epic cache
cache_file="$XDG_CACHE_HOME/opencode-superpower/epic-cache.json"

# Check for dirty epics
dirty_count=$(jq '[.epics[] | select(.dirty == true)] | length' "$cache_file")
```

**If no dirty epics:** Report "All epics synced, nothing to land" and exit.

**If dirty epics found:** Proceed to sync.

### 2. Sync Each Dirty Epic to GitHub

For each dirty epic:

```bash
# Extract epic data
epic_id=$(jq -r '.epics[0].id' "$cache_file")
epic_title=$(jq -r '.epics[0].title' "$cache_file")
epic_body=$(jq -r '.epics[0].description' "$cache_file")
issue_number=$(jq -r '.epics[0].github_issue' "$cache_file")

# Sync to GitHub
if [ -n "$issue_number" ]; then
  # Update existing issue
  gh issue edit "$issue_number" --title "$epic_title" --body "$epic_body"
else
  # Create new issue
  new_issue=$(gh issue create --title "$epic_title" --body "$epic_body" --label "epic")
  issue_number=$(echo "$new_issue" | grep -oP '#\K\d+')
  
  # Update cache with issue number
  jq --arg id "$epic_id" --arg issue "$issue_number" \
    '(.epics[] | select(.id == $id) | .github_issue) = $issue' \
    "$cache_file" > "$cache_file.tmp" && mv "$cache_file.tmp" "$cache_file"
fi
```

**Report progress:** "Synced epic: <title> (#<issue_number>)"

### 3. Clear Dirty Flags

After successful sync:

```bash
# Clear all dirty flags
jq '(.epics[] | .dirty) = false' "$cache_file" > "$cache_file.tmp" \
  && mv "$cache_file.tmp" "$cache_file"
```

**Final report:** "Landed <N> epic(s). All changes synced to GitHub."

## Integration

**Automatic trigger:**
- `session.idle` hook detects inactivity
- Checks for dirty epics
- Syncs automatically if found

**Manual trigger:**
- User runs `/gh-sync` command
- Immediate sync of all dirty epics

**Called by:**
- Session management system (automatic)
- User commands (manual)

## Key Principles

- **Sync before disconnect** - Never lose work to session timeout
- **Batch operations** - Sync all dirty epics in one pass
- **Idempotent** - Safe to run multiple times
- **Report progress** - User knows what's being saved
- **Error recovery** - If sync fails, dirty flag remains set

## Quick Reference

| Situation | Action |
|-----------|--------|
| No dirty epics | Report "nothing to land", exit |
| Epic has github_issue | Update existing issue |
| Epic has no github_issue | Create new issue, store number |
| Sync succeeds | Clear dirty flag |
| Sync fails | Keep dirty flag, report error |
| Session idle detected | Auto-run land-the-plane |
| User runs /gh-sync | Manual land-the-plane |

## Error Handling

**If gh command fails:**
- Log error to stderr
- Keep dirty flag set
- Report which epic failed
- Continue to next epic

**If cache file missing:**
- Report "No cache found, nothing to land"
- Exit gracefully

**If cache file corrupt:**
- Report error
- Do NOT clear cache
- Ask user to check `$XDG_CACHE_HOME/opencode-superpower/epic-cache.json`

## Why This Matters

- **Session state is ephemeral** - Memory is cleared on disconnect
- **GitHub is persistent** - Issues survive session end
- **Dirty flag tracks changes** - Know what needs syncing
- **Automatic safety net** - User doesn't need to remember

## When To Apply

**Automatically:**
- Session idle timeout (5+ minutes of inactivity)
- Graceful shutdown

**Manually:**
- User runs `/gh-sync`
- Before major context switch
- When unsure if changes were saved

## Red Flags

**Never:**
- Clear dirty flags before successful sync
- Assume GitHub is up-to-date
- Skip error reporting
- Lose epic data on sync failure

**Always:**
- Verify sync succeeded before clearing dirty flag
- Report what's being synced
- Handle errors gracefully
- Preserve dirty state on failure
