# Bluefin LTS Workflows

This document describes the key workflows and processes for the `ublue-os/bluefin-lts` repository.

## Repository Architecture

### Two-Branch Promotion Model

- **`main`** - Development/testing branch (PRs merge here first)
- **`lts`** - Production/stable branch (promoted from main via wei/pull bot)

### Image Tagging Strategy

- **Testing images**: `ghcr.io/ublue-os/bluefin:lts-testing`
  - Published when changes merge to `main` branch
  - Available for users to test upcoming changes
  - Updated with every push to `main`

- **Stable images**: `ghcr.io/ublue-os/bluefin:lts`
  - Published ONLY from `lts` branch
  - Updated when wei/pull bot merges `main` → `lts`
  - Consumed by end users in production

### Variants

All variants follow the same testing/stable pattern:
- `bluefin` (base)
- `bluefin-dx` (developer experience)
- `bluefin-gdx` (GPU developer experience)
- Each has a `-hwe` (hardware enablement) variant

Examples:
- Testing: `lts-testing`, `lts-dx-testing`, `lts-gdx-testing`, `lts-hwe-testing`
- Stable: `lts`, `lts-dx`, `lts-gdx`, `lts-hwe`

## Build Triggers

### Main Branch (`main`)

| Event | Result | Published Tag |
|-------|--------|---------------|
| Push (PR merge) | Build + publish | `lts-testing` |
| Pull request | Build (logs only) | `lts-testing` (not published) |
| workflow_dispatch | Build + publish | `lts-testing` |

### Stable Branch (`lts`)

| Event | Result | Published Tag |
|-------|--------|---------------|
| Push (wei/pull merge) | Build + publish | `lts` (stable) |
| Pull request (wei/pull) | Build (logs only) | `lts` (not published) |
| workflow_dispatch | Build + publish | `lts` (stable) |

**Note:** Scheduled cron builds were removed to save CI minutes. Builds are now event-driven.

## Wei/Pull Bot Integration

The wei/pull bot automates promotion from `main` to `lts`:

### How It Works
1. Bot runs weekly (Sundays ~4-10 AM UTC)
2. Creates PR from `main` → `lts` (e.g., PR #1100)
3. PR requires 2 maintainer approvals
4. When PR merges, push to `lts` triggers stable image build

### Manual Trigger
Visit: https://pull.git.ci/process/ublue-os/bluefin-lts (requires Cloudflare challenge)

### Branch Protection Settings
The `lts` branch has these protection settings to allow wei/pull:
- `allow_force_pushes`: `true` (required for wei/pull)
- `lock_branch`: `false` (allows pushes)
- `required_linear_history`: `false` (allows merge commits)

## Tag Logic Implementation

Located in `.github/workflows/reusable-build-image.yml` line ~153:

```bash
if [ "${REF_NAME}" != "${PRODUCTION_BRANCH}" ]; then
  export TAG_SUFFIX="testing"
  export DEFAULT_TAG="${DEFAULT_TAG}-${TAG_SUFFIX}"
fi
```

**Simple rule:** If you're not on the `lts` branch, you get `-testing` suffix. Period.

This guarantees that **ONLY the `lts` branch EVER produces stable `lts` tags**.

## Workflow Files

### Build Workflows (5 files)
All follow the same trigger pattern:

```yaml
on:
  pull_request:
    branches: [main, lts]
  push:
    branches: [main, lts]
  merge_group:
  workflow_dispatch:
```

Files:
- `.github/workflows/build-regular.yml` - Base Bluefin
- `.github/workflows/build-regular-hwe.yml` - Base with HWE
- `.github/workflows/build-dx.yml` - Developer Experience
- `.github/workflows/build-dx-hwe.yml` - DX with HWE
- `.github/workflows/build-gdx.yml` - GPU Developer Experience

### Reusable Workflow
- `.github/workflows/reusable-build-image.yml` - Shared build logic

### Publish Control
All workflows use:
```yaml
publish: ${{ github.event_name != 'pull_request' }}
```

This means:
- PRs: Build but don't publish (for logs/validation)
- Push/workflow_dispatch: Build and publish

## Build Timing

- **Container builds**: 45-90 minutes per variant
- **Total per push**: ~4.5-7.5 hours (5 workflows run in parallel)
- **Syntax checks**: <30 seconds (`just check`)
- **Linting**: <10 seconds (`just lint`)

CI timeout configured: 60 minutes per workflow (in `reusable-build-image.yml`)

## Common Operations

### Testing Upcoming Changes
Users can test changes merged to `main` before they're promoted to stable:

```bash
rpm-ostree rebase ghcr.io/ublue-os/bluefin:lts-testing
# or any variant:
rpm-ostree rebase ghcr.io/ublue-os/bluefin-dx:lts-testing
rpm-ostree rebase ghcr.io/ublue-os/bluefin-gdx:lts-testing
```

### Promoting Changes to Stable

1. Changes merge to `main` → `-testing` images published
2. Users test `-testing` images
3. Wei/pull bot creates PR from `main` → `lts` (weekly or manual trigger)
4. Maintainers review and approve PR (requires 2 approvals)
5. PR merges → push to `lts` → stable images published

### Manual Stable Build

If you need to rebuild stable images without waiting for wei/pull:

1. Go to Actions tab in `ublue-os/bluefin-lts`
2. Select a workflow (e.g., "Build Bluefin LTS")
3. Click "Run workflow"
4. Select branch: `lts`
5. Click "Run workflow"

This builds and publishes stable `lts` images from the current `lts` branch state.

## Key Configuration

### Environment Variables (reusable-build-image.yml)
```yaml
DEFAULT_TAG: "lts"              # DO NOT CHANGE - breaks everything
PRODUCTION_BRANCH: lts          # Branch for stable images
TESTING_BRANCH: main            # Currently unused (kept for compatibility)
```

### Concurrency
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref || github.run_id }}
  cancel-in-progress: true
```

Separate concurrency groups per branch means:
- Push to `main` won't cancel builds on `lts`
- Each branch has its own build queue

## Troubleshooting

### Problem: `-testing` images not appearing after merge to main
- Check GitHub Actions for build status
- Verify push trigger fired (Actions tab)
- Check that merge was to `main` branch, not `lts`

### Problem: Stable images not updating after wei/pull merge
- Verify the wei/pull PR actually merged to `lts`
- Check that push trigger fired on `lts` branch
- Confirm build completed successfully in Actions

### Problem: Wrong tag published (testing vs stable)
- Check which branch the workflow ran from (GitHub Actions logs)
- Verify `REF_NAME` environment variable in build logs
- Tag logic should be: `REF_NAME != "lts"` → add `-testing`

## Related PRs

- **PR #1101** - Enabled `-testing` images on main branch pushes
  - Removed scheduled cron builds
  - Added push triggers for both branches
  - Simplified tag logic

## Additional Resources

- Main repository: https://github.com/ublue-os/bluefin-lts
- Fork (castrojo): https://github.com/castrojo/bluefin-lts
- Wei/pull bot: https://pull.git.ci/process/ublue-os/bluefin-lts
- Registry: https://github.com/orgs/ublue-os/packages?repo_name=bluefin-lts
