# Skill: flatpak-packaging

Use when building, publishing, or debugging OCI-based Flatpak applications.
Covers the full pipeline: build → OCI export → push → index → install.

## When to invoke

- Building a Flatpak app from a manifest locally or in CI
- Debugging OCI export, label verification, or registry push failures
- Setting up a new app in the jorgehub pipeline
- Diagnosing layer non-determinism or CI layer cache miss issues
- Updating the gh-pages index after a push

---

## Pipeline Overview

```
flatpak-builder (in container)
  → .ostree-repo/  (OSTree)
  → flatpak build-bundle --oci
  → .appname.oci/  (OCI image dir)
  → skopeo copy --dest-compress-format=zstd:chunked
  → ghcr.io/castrojo/jorgehub/<app>:latest
  → update-index.py (on gh-pages worktree)
  → oci+https://<pages-url>  (flatpak remote)
```

---

## Build Container

Always use the official Flathub infra container — matches the CI environment:

```bash
podman run --rm -v $(pwd):/work:z \
  ghcr.io/flathub-infra/flatpak-github-actions:gnome-49 \
  bash -c "cd /work && flatpak-builder --repo=.ostree-repo --force-clean builddir flatpaks/<app>/manifest.yaml"
```

SDK versions: `gnome-46`, `gnome-47`, `gnome-48`, `gnome-49`

---

## OCI Export + Labels

Labels are stamped automatically by `flatpak build-bundle --oci` from OSTree metadata.
**Do NOT set org.flatpak.ref or org.flatpak.metadata manually** — they come from the ref.

```bash
flatpak build-bundle --oci .ostree-repo .appname.oci \
  app/com.example.App/x86_64/stable
```

Required labels (auto-stamped):
- `org.flatpak.ref` — e.g. `app/com.mitchellh.ghostty/x86_64/stable`
- `org.flatpak.metadata` — full `[Application]` INI section
- `org.flatpak.installed-size`
- `org.flatpak.download-size`

Labels live in OCI **Labels** (not Annotations). Flatpak silently skips images where
these are in Annotations instead.

### Export structure — multiple OSTree commits per app

Every app exports at minimum 3 OSTree commits:

```
Exporting com.example.App to repo
Exporting com.example.App.Locale to repo
Exporting com.example.App.Debug to repo
```

Only the main commit ends up in the OCI image. `.Locale` and `.Debug` are written to
the OSTree repo but are not bundled. When packaging a new app, this is normal — do not
try to suppress these exports.

### Cache-hit export output

When all modules are cached, `flatpak-builder --repo` produces:

```
Cache hit for <module>, skipping build   (repeated per module)
Everything cached, checking out from cache
Exporting <AppId> to repo
Commit: <sha256>
Metadata Total: NNN
Metadata Written: 1       ← new OSTree commit created (metadata only)
Content Total: NNN
Content Written: 0        ← no content re-written (all from cache)
Content Bytes Written: 0 (0 bytes)
```

`Content Written: 0` confirms the build cache is working. `Metadata Written: 1` is
expected — flatpak-builder creates a new commit each export regardless of content.

### --force-clean scope

`flatpak-builder --force-clean` empties **`.build-dir` only** — the per-module build
sandbox. It does NOT touch:
- `.ostree-repo/` — OSTree commit history is preserved
- `.appname.oci/` — OCI layout dir (separately managed by `rm -rf` before export)
- `.flatpak-builder/cache/` — module build cache (preserved, this is the speed-up)

In LOCAL_ONLY loop mode `--force-clean` is still needed because flatpak-builder
refuses to reuse a non-empty `.build-dir` from a previous run.

---

## Reading Build Output

A healthy cached run looks like this end-to-end. Use this as a reference when something deviates.

```
==> Build container already cached, skipping pull.
Emptying app dir '.build-dir'
Downloading sources
Fetching full git repo https://...     ← normal, see "Source Downloads" section
...
Starting build of <AppId>
Cache hit for <module1>, skipping build
Cache hit for <module2>, skipping build
...
Everything cached, checking out from cache
Exporting <AppId> to repo
Commit: <sha256>
Metadata Total: NNN
Metadata Written: 1
Content Total: NNN
Content Written: 0                     ← 0 = cache working; non-zero = rebuild happened
Content Bytes Written: 0 (0 bytes)
Exporting <AppId>.Locale to repo       ← always present
Commit: <sha256>
...
Exporting <AppId>.Debug to repo        ← always present
Commit: <sha256>
...
Pruning cache                          ← normal; flatpak-builder evicts stale cache entries
==> Build complete. Exporting OCI image...
==> Pushing to local registry (label verification)...
Getting image source signatures        ← normal skopeo output
Copying blob sha256:<layer-hash>       ← layer content; should be stable run-to-run
Copying config sha256:<config-hash>    ← OCI config; varies per run (timestamp in config JSON)
Writing manifest to image destination
==> Local digest: sha256:<manifest>    ← varies per run (covers config hash)
==> Inspecting labels...
OK: org.flatpak.ref
OK: org.flatpak.metadata
All required labels present.
```

**What to watch for:**
- `Content Written: 0` on every module → build cache is healthy
- `Content Written: N` on any module → that module rebuilt (manifest/SDK/source changed)
- `MISSING: org.flatpak.ref` → OCI export failed or wrong ref was passed to `flatpak build-bundle`
- Blob hash changes between runs → normal for the OCI config; see SOURCE_DATE_EPOCH section for layer stability

---

## Ghostty Module Reference

Ghostty's module list (as of 1.x). When all are cache hits, no build occurred:

```
zig, bzip2-redirect, gtk4-layer-shell, pandoc, dependencies-meta, ghostty, cleanup, finish
```

`dependencies-meta` is a Ghostty-specific pattern — a meta-module that declares runtime
dependencies without building code. Other apps may not have this. `cleanup` and `finish`
are standard flatpak-builder lifecycle modules present in most apps.

---

**CRITICAL GOTCHA:** `skopeo copy --dest-compress-format=zstd:chunked` does NOT
recompress existing gzip layers even with `--dest-force-compress-format`. It reuses
the existing compressed blob from the source. You must use `podman push` which
decompresses and recompresses from the image store.

**Correct pipeline:**

```bash
# Step 1: Push to local registry with skopeo (no compression change needed)
skopeo copy \
  --dest-tls-verify=false \
  --digestfile "/tmp/<app>-digest.txt" \
  "oci:./<app>.oci" \
  "docker://localhost:5000/castrojo/jorgehub/<app>:latest"

# Step 2: Load OCI dir into podman image store
DIGEST=$(podman pull "oci:./<app>.oci" 2>&1 | tail -1)

# Step 3: Push to ghcr.io with zstd:chunked via podman (forces recompression)
gh auth token | podman login ghcr.io --username castrojo --password-stdin
podman push \
  --compression-format=zstd:chunked \
  --digestfile "/tmp/<app>-ghcr-digest.txt" \
  "${DIGEST}" \
  "docker://ghcr.io/castrojo/jorgehub/<app>:latest"
```

Verify zstd:chunked was applied:
```bash
skopeo inspect --raw docker://ghcr.io/castrojo/jorgehub/<app>:latest \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
for l in d['layers']:
    print(l['mediaType'])
    for k in l.get('annotations',{}):
        if 'zstd' in k: print(' ', k)
"
# Expect: application/vnd.oci.image.layer.v1.tar+zstd
#         io.github.containers.zstd-chunked.manifest
```

---

## Label Verification

Always verify labels after push before updating the index:

```bash
skopeo inspect docker://ghcr.io/castrojo/jorgehub/<app>:latest \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
labels = d.get('Labels', {})
for k in ['org.flatpak.ref','org.flatpak.metadata','org.flatpak.installed-size','org.flatpak.download-size']:
    print(k, '=', labels.get(k, 'MISSING')[:60])
"
```

---

## Index Update

The index lives on the `gh-pages` branch. Use a worktree — never checkout gh-pages in main:

```bash
git worktree add /tmp/<repo>-pages gh-pages

python3 scripts/update-index.py \
  --app <appname> \
  --digest "$(cat /tmp/<app>-digest.txt)" \
  --registry ghcr.io \
  --tags latest

git -C /tmp/<repo>-pages add index/static
git -C /tmp/<repo>-pages commit -m "feat(index): update <app>"
git -C /tmp/<repo>-pages push origin gh-pages

git worktree remove /tmp/<repo>-pages
```

Index schema:
```json
{
  "Registry": "https://ghcr.io",
  "Results": [
    {
      "Name": "castrojo/jorgehub/<app>",
      "Images": [{ "Digest": "sha256:...", "Tags": ["latest"], "Labels": {...} }]
    }
  ]
}
```

---

## flatpak Remote Setup

```bash
# Add remote from .flatpakrepo
flatpak remote-add --user --if-not-exists jorgehub ~/src/jorgehub/jorgehub.flatpakrepo

# Verify app appears
flatpak remote-ls jorgehub --user

# Install
flatpak install --user --noninteractive jorgehub com.example.App
```

The `jorgehub.flatpakrepo` URL format: `oci+https://<github-pages-url>` — flatpak
appends `/index/static` automatically.

---

## Proof of OCI Origin

```bash
flatpak info --user com.example.App
# Look for: Alt-id: sha256:...  ← OCI digest, proves OCI pull
# Origin: jorgehub              ← remote name
```

---

## Manifest Strategy for Upstream Apps

When an app has an official `flatpak/` directory:
1. Use it verbatim — SDK version, build flags, extensions
2. Replace `type: dir, path: ..` source with `type: archive` pointing to tip tarball
3. Include upstream's `zig-packages.json` / vendor lock files as-is
4. Set `branch: stable` in the manifest

Community manifests (e.g. yorickpeterse repos) are often stale — prefer upstream.

---

## ghcr.io Package Visibility

Packages with namespace slashes (e.g. `jorgehub/ghostty`) **cannot** have visibility
changed via the REST API — the PATCH endpoint returns 404 regardless of token scopes.

Fix: open the web UI manually:
```
https://github.com/users/<user>/packages/container/package/<owner>%2F<app>
```
Scroll to "Change package visibility" → Public.

---

## Token Scopes Required

| Operation | Scope needed |
|---|---|
| Push to ghcr.io | `write:packages` |
| Change visibility | web UI only (API broken for slash names) |

Refresh scopes:
```bash
gh auth refresh --hostname github.com --scopes write:packages
gh auth token | podman login ghcr.io --username castrojo --password-stdin
```

---

## OCI Blob Non-Determinism

**STATUS: RESOLVED** — `SOURCE_DATE_EPOCH=0` and `--override-source-date-epoch=0` are already applied in `build-local.sh`. Do not re-investigate.

**CRITICAL GOTCHA (for reference only):** `flatpak build-bundle --oci` produces a different layer blob hash
on every run even with a fully-cached build and identical app content.

- Root cause: tars are created from OSTree checkout with filesystem timestamps that vary per export
- Observable: blob `sha256:` changes each run; layer size is constant (content identical)
- Impact: CI layer caching silently broken; users re-download full layer on every rebuild

**Fix:** Set `SOURCE_DATE_EPOCH=0` before the `flatpak build-bundle --oci` call:

```bash
export SOURCE_DATE_EPOCH=0
flatpak build-bundle --oci .ostree-repo .appname.oci \
  app/com.example.App/x86_64/stable
```

Verify fix: run `just loop` twice and confirm both local digest lines show the same `sha256:`.

Note: `flatpak-builder --source-date-epoch` flag controls build timestamps, not OCI export
timestamps — it does NOT fix this. The env var on the `build-bundle` call is the fix.

---

## Build Container Re-Pull Overhead

`podman pull ghcr.io/flathub-infra/flatpak-github-actions:gnome-49` makes a network
round-trip on every run even if the image is already cached locally. Cost: ~2-3s per loop.

**Fix:** Guard the pull:

```bash
podman image exists ghcr.io/flathub-infra/flatpak-github-actions:gnome-49 \
  || podman pull ghcr.io/flathub-infra/flatpak-github-actions:gnome-49
```

This is safe for dev loops (the image changes rarely). For CI, always pull to get updates.

---

## Source Downloads Despite Cached Build

`flatpak-builder` fetches sources (git, git-lfs) on every invocation before checking the
per-module build cache. Even with all modules cached, a `git fetch` round-trip runs.

Expected output per run (normal, not an error):
```
Downloading sources
Fetching full git repo https://github.com/<org>/<repo>
git-lfs/x.y.z (GitHub; linux amd64; go x.y.z)
Running git lfs fetch
1 object found, done.
Fetching all references...
```

- Observable: printed even on fully-cached runs
- Root cause: source fetch happens before cache check in flatpak-builder's pipeline
- Workaround (under investigation): `flatpak-builder --disable-download` flag may skip this
- Alternative: pre-warm `.flatpak-builder/downloads/` with a one-time deep clone

---

## LOCAL_ONLY Loop Pattern

For iterative local development without pushing to ghcr.io, add a `LOCAL_ONLY` flag:

```bash
# scripts/build-local.sh — exit early after local registry verification
if [[ "${LOCAL_ONLY:-0}" == "1" ]]; then
  echo "==> LOCAL_ONLY mode — skipping ghcr.io push."
  exit 0
fi
```

```just
# Justfile
loop app="ghostty":
    LOCAL_ONLY=1 bash scripts/build-local.sh {{app}}
```

`just loop ghostty` runs in ~7-8s (fully cached, I/O-bound: podman pull + OCI blob copy).
`user+sys` time is only ~0.8s — the rest is network/I/O overhead.

---

## Reference

- Build container: `ghcr.io/flathub-infra/flatpak-github-actions:gnome-49`
- Index format: [flatpak OCI index spec](https://github.com/flatpak/flatpak/blob/main/doc/flatpak-oci-layout.md)
- ublue-os zstd:chunked pattern: `ublue-os/toolboxes` `.github/workflows/build-fedora-toolbox.yml`
  — uses `redhat-actions/push-to-registry` with `extra-args: --compression-format=zstd:chunked`

Base directory for this skill: file:///var/home/jorge/.config/opencode/skills/personal/flatpak-packaging
