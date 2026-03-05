---
name: bluefin-release-verification
description: Use when checking, confirming, or auditing bluefin image builds on ghcr.io for ublue-os/bluefin or ublue-os/bluefin-lts on a specific date or time range
---

# Bluefin Release Verification

## Overview

**Always query the live registry first.** `skopeo inspect --no-creds` works
anonymously against all `ghcr.io/ublue-os/*` images and returns the actual
`Created` timestamp embedded in the image. Never assume a build ran based on
CI history alone — always confirm what is actually in the registry.

Workflow run history is secondary: use it to explain *why* an image has a
given timestamp, or to diagnose failures.

---

## Registry Check Commands (Primary — always run these first)

### Mainline (ublue-os/bluefin)

```bash
# Check all rolling tags in one pass
for image in bluefin bluefin-dx; do
  for tag in stable stable-daily gts latest beta; do
    result=$(skopeo inspect --no-creds docker://ghcr.io/ublue-os/${image}:${tag} 2>/dev/null | jq -r '.Created // "NOT FOUND"')
    echo "${image}:${tag} -> $result"
  done
done
```

### LTS (ublue-os/bluefin-lts)

```bash
# Production tags (from lts branch, published by Scheduled LTS Release)
for image in bluefin bluefin-dx bluefin-gdx; do
  for tag in lts lts-hwe; do
    result=$(skopeo inspect --no-creds docker://ghcr.io/ublue-os/${image}:${tag} 2>/dev/null | jq -r '.Created // "NOT FOUND"')
    echo "${image}:${tag} -> $result"
  done
done

# Testing tags (from main branch, published on every push/PR merge)
for image in bluefin bluefin-dx bluefin-gdx; do
  for tag in lts-testing lts-hwe-testing; do
    result=$(skopeo inspect --no-creds docker://ghcr.io/ublue-os/${image}:${tag} 2>/dev/null | jq -r '.Created // "NOT FOUND"')
    echo "${image}:${tag} -> $result"
  done
done
```

### Single image spot check

```bash
skopeo inspect --no-creds docker://ghcr.io/ublue-os/bluefin:stable | jq '{Created, Digest}'
```

---

## Image Matrix

### Mainline — ublue-os/bluefin (Fedora/Silverblue-based)

Built by `ublue-os/bluefin` via "Stable Images", "GTS Images", "Latest Images" workflows.

| Image | Rolling tags | Dated variants |
|---|---|---|
| `ghcr.io/ublue-os/bluefin` | `stable`, `stable-daily`, `gts`, `latest`, `beta` | `stable-YYYYMMDD`, `stable-43.YYYYMMDD` |
| `ghcr.io/ublue-os/bluefin-dx` | same | same |

Both images built in 2 flavors (`main`, `nvidia-open`) — same tag, multi-arch manifest.

Trigger: Renovate PRs bumping base image digests. Multiple runs per day are normal.

### LTS — ublue-os/bluefin-lts (CentOS Stream 10 / bootc-based)

Completely different CI model, branch model, and tag scheme from mainline.

**Branches:**
- `main` — integration/testing (PRs merge here)
- `lts` — production (published images come from here)

**Images and tags:**

| Image | Production tags (lts branch) | Testing tags (main branch) |
|---|---|---|
| `ghcr.io/ublue-os/bluefin` | `lts`, `lts-hwe` | `lts-testing`, `lts-hwe-testing` |
| `ghcr.io/ublue-os/bluefin-dx` | `lts`, `lts-hwe` | `lts-testing`, `lts-hwe-testing` |
| `ghcr.io/ublue-os/bluefin-gdx` | `lts` | `lts-testing` |

Date-stamped variants for each (same tag + `.YYYYMMDD` or `-YYYYMMDD`):
`lts.YYYYMMDD`, `lts-YYYYMMDD`, `stream10-YYYYMMDD`, `10-YYYYMMDD`

---

## LTS Release Mechanics

### Production releases (lts branch)

**Trigger:** `Scheduled LTS Release` workflow — cron `0 2 * * 0` (every Sunday 02:00 UTC),
or manual `workflow_dispatch`.

**What it does:** Dispatches all 5 build workflows on the `lts` branch:
- `build-regular.yml` → `bluefin`
- `build-dx.yml` → `bluefin-dx`
- `build-gdx.yml` → `bluefin-gdx`
- `build-regular-hwe.yml` → `bluefin` with `-hwe` tag suffix
- `build-dx-hwe.yml` → `bluefin-dx` with `-hwe` tag suffix

**Publish condition:** Images are only pushed to GHCR when:
- event is `workflow_dispatch` AND branch is `lts` or `main`, OR
- event is `push` AND branch is `main`

Pushes to `lts` (e.g. after merging a promotion PR) trigger **validation builds only** —
they build but do NOT publish.

**Generate Release:** Triggered automatically after `Build Bluefin LTS GDX` completes
on `lts` branch via `workflow_dispatch`. Creates a GitHub release with changelog.

### Testing builds (main branch)

Published automatically on every push to `main` (PR merges) with `-testing` tags.
Use these to verify a change before it's promoted to production.

### Promoting main → lts

`Promote Main to LTS` workflow (`workflow_dispatch`) creates a PR from `main` → `lts`.
Merging that PR triggers validation builds (no publish). The next scheduled release
(or a manual dispatch) then publishes the merged content.

---

## Workflow Run Commands (Secondary — use to explain/diagnose)

### Check LTS scheduled release history

```bash
gh run list -R ublue-os/bluefin-lts -w "Scheduled LTS Release" \
  --json databaseId,conclusion,createdAt,event --limit 10
```

### Check mainline stable build runs on a date

```bash
DATE="YYYY-MM-DD"
gh run list -R ublue-os/bluefin \
  --json databaseId,name,conclusion,createdAt,headBranch --limit 100 | \
  jq --arg d "$DATE" '[.[] | select(.createdAt | startswith($d)) |
    select(.name | test("Stable|GTS|Latest|Images"; "i"))]'
```

### Inspect jobs in a run

```bash
gh run view <RUN_ID> -R ublue-os/bluefin \
  --json jobs --jq '.jobs[] | {name, conclusion, startedAt, completedAt}'
```

### Mainline complete stable run anatomy (7 jobs required)

```
image (main, bluefin, stable)          ~17 min
image (main, bluefin-dx, stable)       ~25 min
image (nvidia-open, bluefin, stable)   ~18 min
image (nvidia-open, bluefin-dx, stable)~29 min
Check all builds successful
generate-release (stable)
generate-release (stable-daily)
```

All 7 must be `conclusion: success` for a confirmed mainline stable push.

---

## Confirming a Release

1. **Run the registry check commands above first** — if `Created` is within the
   expected window, the image is confirmed in the registry.
2. Use workflow runs only to confirm the trigger source or diagnose a missing/stale image.

**Mainline stable confirmed** = `bluefin:stable` and `bluefin-dx:stable` both show
`Created` timestamps matching the expected build window.

**LTS production confirmed** = `bluefin:lts`, `bluefin-dx:lts`, `bluefin-gdx:lts`
(+ `-hwe` variants where applicable) all show matching `Created` timestamps.

**NOT confirmed** = any tag returns `NOT FOUND`, or `Created` is older than expected.
In that case, check workflow runs for failures.

---

## Notes

- `read:packages` OAuth scope is required for `gh api /orgs/ublue-os/packages/...`.
  The standard castrojo token does not have it. Use `skopeo` instead.
- The `Scheduled LTS Release` workflow may show an empty run list if it was created
  recently or has not yet fired. Check the cron schedule (Sundays 02:00 UTC) against
  the date being verified.
- Multiple mainline stable runs per day is normal — Renovate fires on each base image bump.
