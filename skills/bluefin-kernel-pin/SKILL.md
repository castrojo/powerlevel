---
name: bluefin-kernel-pin
description: Use when akmods-zfs or akmods-nvidia-open lag behind akmods kernel version in ublue-os/bluefin, causing build failures on stable or gts streams
---

# Bluefin Kernel Pin

## Overview

Pin the kernel version in bluefin's stable/gts CI workflows when ZFS or Nvidia akmods containers haven't been rebuilt for the latest kernel that the base akmods container ships.

**Core principle:** The `akmods`, `akmods-zfs`, and `akmods-nvidia-open` containers at `ghcr.io/ublue-os/` must all have matching kernel tags. When they diverge, builds fail. Pinning forces all three to use the last kernel where all containers agree.

## When to Use

- Stable or GTS build failures with skopeo/container-not-found errors referencing akmods-zfs or akmods-nvidia-open
- `akmods:coreos-stable-<fedora>` has a newer `ostree.linux` label than what `akmods-zfs:coreos-stable-<fedora>-*` tags exist for
- Upstream issue tracker mentions ZFS/akmods lag
- After confirming the pin is no longer needed (akmods-zfs catches up), to unpin

**Only affects:** `stable` and `gts` streams (these use `akmods_flavor=coreos-stable` which includes ZFS). `latest` and `beta` use `akmods_flavor=main` with no ZFS.

## Diagnosis

### 1. Find current akmods kernel version

```bash
skopeo inspect docker://ghcr.io/ublue-os/akmods:coreos-stable-42 \
  | jq -r '.Labels["ostree.linux"]'
# Example output: 6.18.5-200.fc42.x86_64
```

### 2. Check if akmods-zfs exists for that kernel

```bash
skopeo inspect docker://ghcr.io/ublue-os/akmods-zfs:coreos-stable-42-6.18.5-200.fc42.x86_64
# If this fails with "manifest unknown", ZFS is behind
```

### 3. Find the latest akmods-zfs kernel

```bash
skopeo list-tags docker://ghcr.io/ublue-os/akmods-zfs \
  | jq -r '.Tags[]' | grep 'coreos-stable-42' | sort -V | tail -5
```

### 4. Verify the pin target exists for ALL required containers

```bash
PIN="6.17.12-200.fc42.x86_64"
FEDORA="42"
FLAVOR="coreos-stable"

# All three must succeed:
skopeo inspect docker://ghcr.io/ublue-os/akmods:${FLAVOR}-${FEDORA}-${PIN}
skopeo inspect docker://ghcr.io/ublue-os/akmods-zfs:${FLAVOR}-${FEDORA}-${PIN}
# Only if building nvidia-open flavor:
skopeo inspect docker://ghcr.io/ublue-os/akmods-nvidia-open:${FLAVOR}-${FEDORA}-${PIN}
```

## Applying the Pin

Edit 2 files, 1 line each. Uncomment and set the `kernel_pin` value:

**`.github/workflows/build-image-stable.yml`** (~line 27):
```yaml
    with:
      kernel_pin: 6.17.12-200.fc42.x86_64
```

**`.github/workflows/build-image-gts.yml`** (~line 26):
```yaml
    with:
      kernel_pin: 6.17.12-200.fc42.x86_64
```

The pin value is the **full kernel release string** (e.g., `6.17.12-200.fc42.x86_64`).

**GTS may need a different pin** than stable if it tracks a different Fedora version. Check `akmods_flavor` mapping:

| Stream | `akmods_flavor` | Typical Fedora |
|--------|-----------------|----------------|
| `gts` | `coreos-stable` | N-1 (e.g., 41) |
| `stable` | `coreos-stable` | N (e.g., 42) |

## Removing the Pin

When akmods-zfs catches up to the akmods kernel, re-comment the lines:

```yaml
    with:
      # kernel_pin: 6.17.12-200.fc42.x86_64
```

**Verify first** that the unpinned kernel works by running the diagnosis steps above.

## How the Pin Flows Through the Build

```
Workflow YAML
  kernel_pin: "6.17.12-200.fc42.x86_64"
       |
       v
reusable-build.yml
  inputs.kernel_pin --> just build-ghcr ... "${{ inputs.kernel_pin }}"
       |
       v
Justfile: build(kernel_pin)
  |-- fedora_version: extracts "fc42" --> 42 (overrides skopeo detection)
  |-- kernel_release = kernel_pin (verbatim, skips akmods label lookup)
  |-- cosign verify: akmods, akmods-zfs, akmods-nvidia-open
  |-- --build-arg KERNEL=${kernel_release}
       |
       v
Containerfile: ARG KERNEL
       |
       v
03-install-kernel-akmods.sh: uses $KERNEL in skopeo copy tags
  ghcr.io/ublue-os/akmods:${AKMODS_FLAVOR}-$(rpm -E %fedora)-${KERNEL}
  ghcr.io/ublue-os/akmods-zfs:${AKMODS_FLAVOR}-$(rpm -E %fedora)-${KERNEL}
```

**Key behavior when pinned:** The Justfile skips the `skopeo inspect` of the akmods container to read `ostree.linux`. Instead it uses the pin value directly, ensuring all container references use the same kernel version.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Pin only stable, forget gts | Both files must be updated |
| Use wrong Fedora version suffix | Check `fc<N>` matches the stream's Fedora version |
| Pin to a kernel that akmods itself doesn't have | Verify `akmods:<flavor>-<fedora>-<pin>` exists too |
| Forget to unpin after akmods-zfs catches up | Monitor upstream; old pins block kernel security updates |
| Edit `latest` or `beta` workflows | These don't use ZFS, never need kernel pins |
