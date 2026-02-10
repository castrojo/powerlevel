# Land the Plane - Implementation Details

## Purpose

Sync dirty epics to GitHub before session ends, ensuring no work is lost to session timeout or disconnect.

## Trigger Points

### 1. session.idle Hook (Automatic)

**When:** Session has been idle for 5+ minutes

**What it does:**
1. Checks for dirty epics in cache
2. If found, syncs all to GitHub
3. Clears dirty flags on success

**Implementation location:**
- Hook: `session.idle` (OpenCode lifecycle)
- Skill: `land-the-plane`
- Cache: `$XDG_CACHE_HOME/opencode-superpower/epic-cache.json`

### 2. /gh-sync Command (Manual)

**When:** User explicitly runs `/gh-sync`

**What it does:**
- Immediate sync of all dirty epics
- Same behavior as idle hook
- Reports sync status

**Use cases:**
- Before context switch
- Before closing session
- When unsure if changes were saved
- Testing sync behavior

## Batch Sync Strategy

### MVP Implementation

**What gets synced:**
- Epic title → Issue title
- Epic description → Issue body
- Epic ID → Issue label (for tracking)
- Dirty flag → Cleared after successful sync

**What's deferred for full implementation:**
- Story-level sync (stories → issue comments or tasks)
- Todo-level sync (todos → checklist items)
- Epic metadata (status, priority, tags)
- Bidirectional sync (GitHub → cache)

### Sync Order

1. **Load cache** - Read `epic-cache.json`
2. **Filter dirty** - Select epics where `dirty == true`
3. **Sync each epic:**
   - Check if `github_issue` exists
   - If yes: Update existing issue
   - If no: Create new issue, store number in cache
4. **Clear dirty flags** - After all syncs succeed
5. **Report results** - Count synced, errors if any

## Cache Operations

### Cache Structure

```json
{
  "epics": [
    {
      "id": "epic-001",
      "title": "Implement authentication system",
      "description": "Add JWT-based auth with refresh tokens...",
      "github_issue": 42,
      "dirty": true,
      "created_at": "2026-02-09T10:30:00Z",
      "updated_at": "2026-02-09T11:45:00Z"
    }
  ]
}
```

### Dirty Flag Lifecycle

**Set to `true` when:**
- Epic created
- Epic title edited
- Epic description edited
- Epic metadata changed

**Set to `false` when:**
- Successfully synced to GitHub
- Manual `/gh-clear-dirty` command (admin only)

### Cache Location

**Path:** `$XDG_CACHE_HOME/opencode-superpower/epic-cache.json`

**Default:** `~/.cache/opencode-superpower/epic-cache.json`

**Fallback:** If `XDG_CACHE_HOME` not set, use `~/.cache/`

## GitHub Sync Details

### Creating New Issues

```bash
gh issue create \
  --title "$epic_title" \
  --body "$epic_body" \
  --label "epic" \
  --label "epic-id:$epic_id"
```

**Response parsing:**
- Extract issue number from URL
- Store in cache as `github_issue`

### Updating Existing Issues

```bash
gh issue edit "$issue_number" \
  --title "$epic_title" \
  --body "$epic_body"
```

**No response parsing needed** - Issue number already known.

### Epic ID Tracking

**Label format:** `epic-id:<uuid>`

**Purpose:** Link GitHub issue back to cache epic

**Used for:**
- Bidirectional sync (future)
- Duplicate detection
- Cache reconstruction

## Error Handling

### Sync Failures

**If issue create fails:**
- Log error: `"Failed to create issue for epic: <title>"`
- Keep dirty flag set
- Continue to next epic
- Report failure count at end

**If issue update fails:**
- Log error: `"Failed to update issue #<N> for epic: <title>"`
- Keep dirty flag set
- Continue to next epic
- Report failure count at end

### Cache Errors

**If cache file missing:**
- Report: "No cache found, nothing to land"
- Exit gracefully (not an error)

**If cache file corrupt:**
- Report: "Cache file corrupt: <error>"
- Do NOT clear cache
- Ask user to check file manually
- Exit with error

**If cache write fails:**
- Report: "Failed to update cache after sync"
- Syncs completed, but dirty flags not cleared
- Warn: "Next sync will re-push same epics"
- Log cache file path

### Network Errors

**If gh command times out:**
- Retry once after 5s delay
- If still fails, mark as error
- Keep dirty flag set

**If GitHub API rate limited:**
- Report: "Rate limited, try again in <N> minutes"
- Keep all dirty flags set
- Exit with error

## Concurrency

### Race Conditions

**Problem:** Multiple agents editing same epic simultaneously

**Solution (MVP):** Last write wins
- Each edit sets dirty flag
- Sync always uses latest cache state
- No conflict resolution needed

**Future:** Operational transformation or CRDTs

### Lock File

**Not implemented in MVP** - Single agent assumed

**Future:** Lock file at `$XDG_CACHE_HOME/opencode-superpower/epic-cache.lock`

## Future Enhancements

### Story-Level Sync

**Approach 1:** Stories as issue comments
- Pro: Simple, keeps all context in one issue
- Con: Comments not as structured

**Approach 2:** Stories as checklist items
- Pro: Visual progress tracking
- Con: Limited metadata

**Approach 3:** Stories as linked issues
- Pro: Full issue features per story
- Con: More API calls, complex linking

**Recommendation:** Start with Approach 2, migrate to 3 if needed

### Bidirectional Sync

**GitHub → Cache:**
- Poll for issue updates
- Merge external edits
- Conflict resolution strategy

**Use cases:**
- User edits issue in GitHub UI
- External tools update issues
- Collaborative editing

**Complexity:** Medium-high
- Requires conflict detection
- Needs merge strategy
- Must handle deletions

### Offline Mode

**Problem:** Network unavailable during idle

**Solution:**
- Queue syncs in pending file
- Retry on next connection
- Report queued syncs to user

**Implementation:**
- `epic-sync-queue.json` alongside cache
- Background retry loop
- Exponential backoff

### Webhook Integration

**Problem:** Polling GitHub is inefficient

**Solution:**
- GitHub webhooks notify of changes
- Push updates to cache
- Real-time bidirectional sync

**Requirements:**
- Webhook endpoint (server)
- Authentication/verification
- Event processing logic

## Testing Strategy

### Unit Tests

**Test cases:**
- Sync with no dirty epics
- Sync with 1 dirty epic (no github_issue)
- Sync with 1 dirty epic (existing github_issue)
- Sync with multiple dirty epics
- Sync fails (network error)
- Cache file missing
- Cache file corrupt

### Integration Tests

**Test cases:**
- End-to-end sync to real GitHub repo
- session.idle hook triggers sync
- /gh-sync command triggers sync
- Verify dirty flags cleared
- Verify GitHub issue created/updated

### Manual Testing

**Checklist:**
- [ ] Create epic, verify dirty flag set
- [ ] Wait for session idle, verify sync
- [ ] Check GitHub issue created
- [ ] Edit epic, verify dirty flag set again
- [ ] Run /gh-sync, verify update
- [ ] Check GitHub issue updated
- [ ] Kill network, verify error handling
- [ ] Restore network, verify retry succeeds

## Performance Considerations

### API Rate Limits

**GitHub API limits:**
- 5000 requests/hour (authenticated)
- ~83 requests/minute

**Typical usage:**
- 1 request per dirty epic
- Max ~10 dirty epics per session
- Well under rate limit

### Cache File Size

**Estimate:**
- 100 epics × 2KB each = 200KB
- Negligible load time
- No optimization needed for MVP

### Sync Duration

**Estimate:**
- 1 epic = ~500ms (network latency)
- 10 epics = ~5s total
- Acceptable for idle hook

## Security Considerations

### GitHub Token

**Storage:** gh CLI handles token securely

**Permissions needed:**
- `repo` scope (create/edit issues)
- `read:org` if using org repos

**Verification:** Check gh auth status before sync

### Cache File Permissions

**Set on creation:** `chmod 600 epic-cache.json`

**Purpose:** Prevent other users reading cache

**Contents:** May include sensitive epic descriptions

## Logging

### What to Log

**Always log:**
- Sync start/end timestamp
- Epic IDs synced
- GitHub issue numbers
- Errors (with context)

**Never log:**
- GitHub tokens
- Full epic descriptions (may be sensitive)

### Log Location

**Path:** `$XDG_STATE_HOME/opencode-superpower/land-the-plane.log`

**Default:** `~/.local/state/opencode-superpower/land-the-plane.log`

**Rotation:** Rotate daily, keep 7 days

### Log Format

```
2026-02-09T14:30:00Z [INFO] Starting sync (3 dirty epics)
2026-02-09T14:30:01Z [INFO] Synced epic-001 -> issue #42
2026-02-09T14:30:02Z [INFO] Synced epic-002 -> issue #43
2026-02-09T14:30:03Z [ERROR] Failed to sync epic-003: network timeout
2026-02-09T14:30:03Z [INFO] Sync complete (2/3 succeeded)
```

## Monitoring

### Success Metrics

- Sync success rate (%)
- Average sync duration (ms)
- Dirty epics at session end (count)
- Manual vs automatic syncs (ratio)

### Alerts

**Warn if:**
- Sync failure rate > 10%
- Sync duration > 30s
- More than 20 dirty epics at once

**Alert if:**
- Sync failure rate > 50%
- Cache file corrupt
- GitHub API rate limited

## Rollout Plan

### Phase 1: MVP (Current)

- Epic-level sync only
- Title + description + ID
- Automatic on session.idle
- Manual via /gh-sync

### Phase 2: Stories

- Story-level sync as checklist items
- Progress tracking in GitHub UI

### Phase 3: Bidirectional

- GitHub → Cache sync
- Conflict resolution
- Collaborative editing support

### Phase 4: Real-time

- Webhook integration
- Push-based updates
- Sub-second sync latency
