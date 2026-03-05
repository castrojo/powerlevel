---
name: gnome-extension-management
description: Use when checking, updating, or auditing GNOME Shell extensions bundled in bluefin-lts or similar bootc OS image repos that manage extensions as git submodules
---

# GNOME Extension Management

## Overview

Extensions in bluefin-lts are managed as **git submodules** pointing at their upstream GitHub repos. Versions are pinned by commit hash, not by package manager. The canonical version marker is the `extensions.gnome.org-vNNN` tag convention used by most extension repos.

## How Extensions Are Managed

### Directory structure

```
.gitmodules                            # submodule URLs
system_files/usr/share/gnome-shell/extensions/
  <uuid>/                              # one submodule per extension
build_scripts/21-build-gnome-extensions.sh  # compile step after copy
```

Extensions are copied into the image via `COPY system_files /files` in the Containerfile, then compiled by `21-build-gnome-extensions.sh`.

### Submodule pin = the version

The pinned commit in `.gitmodules` / `git submodule status` IS the version. There is no separate version string anywhere else.

## Checking the Current Version

```bash
# Shows commit hash for every extension
git submodule status

# Single extension
git submodule status -- "system_files/usr/share/gnome-shell/extensions/dash-to-dock@micxgx.gmail.com"
```

The `-` prefix means the submodule is not checked out locally; the hash is still the recorded pin.

## Finding the Latest Upstream Version

**CRITICAL:** Most GNOME extension repos do NOT use `v*` semver tags. The canonical version tag format is:

```
extensions.gnome.org-vNNN        # annotated tag
extensions.gnome.org-vNNN^{}     # dereferenced to commit
```

Check latest release and HEAD:

```bash
git ls-remote https://github.com/<org>/<repo>.git HEAD "refs/tags/extensions.gnome.org-v*"
```

Example output to read:

```
ffadcc425c9863a59b08ad604987564db7bbacc3  HEAD
e114ff02b573e4b49193eb8f3c62637e0dcb3468  refs/tags/extensions.gnome.org-v103
ffadcc425c9863a59b08ad604987564db7bbacc3  refs/tags/extensions.gnome.org-v103^{}
```

- The `^{}` line is the **commit** the annotated tag points to
- If pinned hash == latest `extensions.gnome.org-vNNN^{}` commit → up to date
- If pinned hash == HEAD but not a tagged release → pinned to unreleased code (check if intentional)

## Checking All Extensions at Once

Quick audit across all submodules:

```bash
# Get current pins
git submodule status

# For each extension, compare against its upstream:
# Pull URL from .gitmodules, run git ls-remote
grep -A2 'submodule' .gitmodules | grep url | awk '{print $3}'
```

## Updating an Extension

To update a submodule to its latest tagged release:

```bash
# 1. Find the commit for the new tag
git ls-remote https://github.com/<org>/<repo>.git "refs/tags/extensions.gnome.org-v*"

# 2. Update the submodule to the target commit
git -C "system_files/usr/share/gnome-shell/extensions/<uuid>" fetch origin
git -C "system_files/usr/share/gnome-shell/extensions/<uuid>" checkout <commit-hash>

# 3. Stage the change
git add "system_files/usr/share/gnome-shell/extensions/<uuid>"
git status  # confirm new hash is staged
```

## Common Mistakes

| Mistake | Reality |
|---|---|
| Looking for a version string in code | There is none — the commit hash IS the version |
| Checking only for `v*` semver tags | Extension repos use `extensions.gnome.org-vNNN` tag format |
| Assuming HEAD == latest release | HEAD may be ahead of the latest tagged release |
| Confusing Ubuntu packaging tags (`ubuntu-dock-*`) with extension versions | Ubuntu tags are packaging artifacts, not extension releases |
| Running `git submodule update` blindly | This checks out whatever is pinned, doesn't update to latest |

## Extension Build Notes

After updating submodule pins, the build step in `21-build-gnome-extensions.sh` compiles schemas and runs `make` for some extensions. No separate build script changes are needed unless the extension's build system changes.

## Quick Reference — Extension UUIDs

| Extension | UUID directory | Tag format |
|---|---|---|
| Dash to Dock | `dash-to-dock@micxgx.gmail.com` | `extensions.gnome.org-vNNN` |
| Blur My Shell | `blur-my-shell@aunetx` | `extensions.gnome.org-vNNN` |
| AppIndicator | `appindicatorsupport@rgcjonas.gmail.com` | varies — check upstream |
| Caffeine | `tmp/caffeine` (moved in build) | varies — check upstream |
| GSConnect | `gsconnect@andyholmes.github.io` | varies — check upstream |
| Logo Menu | `logomenu@aryan_k` | check upstream |
| Search Light | `search-light@icedman.github.com` | check upstream |
