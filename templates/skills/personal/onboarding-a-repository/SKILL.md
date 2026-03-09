---
name: onboarding-a-repository
description: Use when starting work on any repository for the first time — sets up remotes, plans directory, fork AGENTS.md, project memory block, and validation baseline
---

# Onboarding a Repository

## Overview

Run this checklist **once per repo, before any other work begins.** Every step is mandatory. The skill ends with a journal entry and, if the skill had gaps, an in-session update.

**Announce at start:** "I'm using the onboarding-a-repository skill to set up this repository."

---

## Checklist

### Step 1: Verify remote layout

**For bluefin ecosystem repos** (`ublue-os/*`, `projectbluefin/*`): a fork in `castrojo` namespace
is mandatory. If the fork doesn't exist yet, create it on GitHub before continuing:

```bash
gh repo fork <org>/<repo> --clone=false
```

```bash
git remote -v
```

Expected:
```
origin    git@github.com:castrojo/<repo>.git (fetch)
origin    git@github.com:castrojo/<repo>.git (push)
upstream  git@github.com:<org>/<repo>.git (fetch)
upstream  git@github.com:<org>/<repo>.git (push)
```

**If wrong:** Fix it before doing anything else.

```bash
# Rename your fork remote to origin (if named something else)
git remote rename <fork-name> origin

# If origin currently points to upstream, rotate it:
git remote rename origin upstream-old
git remote add origin git@github.com:castrojo/<repo>.git
git remote set-url upstream git@github.com:<org>/<repo>.git
git remote remove upstream-old

# Fetch and set tracking branches
git fetch upstream
git branch --set-upstream-to=upstream/main main
# If lts branch exists:
git branch --set-upstream-to=upstream/lts lts
```

Full reference: `~/.config/opencode/plans/git-workflow.md`

---

### Step 1b: Sync fork main to upstream

Run this every session, not just on first onboard:

```bash
git fetch upstream
git log --oneline upstream/main..main
```

Fork `main` must be **at most 1 commit ahead of upstream** — the fork-only AGENTS.md commit.

**If output is just the AGENTS.md commit (or empty):** sync normally:

```bash
git rebase upstream/main
git push origin main --force-with-lease
```

**If the fork is dirty** (Renovate commits on main, old merge commits, more than 1 non-upstream commit):

```bash
# Save the AGENTS.md commit SHA before resetting
AGENTS_SHA=$(git log --oneline upstream/main..main | grep -i "agents\|gitattributes" | tail -1 | awk '{print $1}')

git reset --hard upstream/main

# Re-apply only the fork-only commit
# If cherry-pick conflicts on AGENTS.md (upstream also has one), apply manually:
git show ${AGENTS_SHA}:AGENTS.md > AGENTS.md
git show ${AGENTS_SHA}:.gitattributes > .gitattributes
git add AGENTS.md .gitattributes
git commit -m "chore: fork-only AGENTS.md and .gitattributes

Assisted-by: <Model> via OpenCode"

git push origin main --force
```

---

### Step 2: Create plans directory

```bash
mkdir -p ~/.config/opencode/plans/<repo-name>/
```

This is where all project plans, architecture notes, and LLM session artifacts live. **Nothing from this directory ever goes inside the repo.**

---

### Step 2c: Initialize loop state

Initialize a clean loop state for this repo in the DB:

```
set_loop_state(
  repo: "<repo-name>",
  phase: "",
  run: "0/0",
  goal: ""
)
```

This creates a clean empty state. The first loop-start for this repo will find it ready.

---

### Step 2b: Set up worktree directory

**Standard location:** `.worktrees/` inside the repo root (for all repos — owner and fork alike).

**Global gitignore** (`~/.config/git/ignore`) covers `.worktrees` across all repos. Verify it's set up once per machine:

```bash
grep -q "\.worktrees" ~/.config/git/ignore 2>/dev/null || {
  mkdir -p ~/.config/git
  echo ".worktrees" >> ~/.config/git/ignore
  git config --global core.excludesFile ~/.config/git/ignore
  echo "global gitignore created"
}
```

**For owner repos** (no `upstream` remote — repos you own directly, not forks): also add `.worktrees` to the repo's `.gitignore` explicitly:

```bash
# Check if it's an owner repo
git remote get-url upstream 2>/dev/null && echo "fork repo — global gitignore sufficient" || {
  grep -q "\.worktrees" .gitignore 2>/dev/null || echo -e "\n# Git worktrees (local dev isolation)\n.worktrees" >> .gitignore
  echo "added .worktrees to repo .gitignore"
}
```

For fork repos (where `upstream` exists), the global gitignore is sufficient — no `.gitignore` commit needed.

**Verify it works:**

```bash
git check-ignore -v .worktrees && echo "PASS: .worktrees is ignored"
```

**Create the directory so the `using-git-worktrees` skill finds it immediately:**

```bash
mkdir -p .worktrees
```

> Future work in this repo: always `git worktree add .worktrees/<branch-name> -b <branch>`.
> Full protocol: `using-git-worktrees` skill.

---

### Step 3: Discover validation commands

Run these to understand the project's build/test tooling:

```bash
# Check for just (most common in this workflow)
just --list 2>/dev/null || echo "no Justfile"

# Check for make
make help 2>/dev/null || make --dry-run 2>/dev/null | head -20 || echo "no Makefile"

# Check package.json scripts
cat package.json 2>/dev/null | grep -A20 '"scripts"' || echo "no package.json"

# Check for cargo, go, pytest, etc.
ls Cargo.toml go.mod pyproject.toml 2>/dev/null
```

Record the validation command (e.g. `just check && just lint`, `make test`, `npm test`). You will need it in Step 5 and Step 8.

**Container-building projects:** If the build/validation command uses `podman run` or `docker run`
internally (i.e., the build script itself launches containers), the Container-First Rule exception
applies — wrapping the build in a devaipod container would be podman-in-podman and is not
supported. In this case, run `just loop` / `just build` directly on the host. Document this
explicitly in the project's `AGENTS.md` under Critical Notes:
```
`just loop` runs on host — uses podman internally; do NOT wrap in a devaipod container.
```

---

### Step 3b: Check for MCP servers

```bash
cat opencode.json 2>/dev/null | python3 -c "
import sys, json
d = json.load(sys.stdin)
mcps = d.get('mcp', {})
print(list(mcps.keys()) if mcps else 'no MCPs configured')
" || echo "no opencode.json"
```

If MCPs are configured:
- Identify what domain each covers (from the project's `AGENTS.md` MCP section)
- Do a test query for each to verify connectivity — note any that fail
- Record working MCPs in project-notes.md (Step 4) under a `## MCP Servers` section
- If an MCP fails to respond, note it — do not silently assume it works; broken MCPs produce stale data with no build error

If no `opencode.json` or no MCPs: note "no MCPs configured" in project-notes.md.

---

### Step 4: Write initial project notes

Create `~/.config/opencode/plans/<repo-name>/project-notes.md` with:

```markdown
# <Repo Name> — Project Notes

## Quick Reference

- **Upstream:** git@github.com:<org>/<repo>.git
- **Fork:** git@github.com:castrojo/<repo>.git
- **Target branch:** main (or lts, stable — identify from upstream)
- **Validation:** <exact command discovered in Step 3>
- **Build tool:** just / make / npm / cargo / ...

## What This Project Is

<1-2 sentences describing the project>

## Key Directories

- `<dir>/` — <purpose>
```

Update this file over time as you learn the project.

---

### Step 5: Check for AGENTS.md on your fork

```bash
# Does castrojo/<repo> already have an AGENTS.md?
git log --oneline --all -- AGENTS.md | head -5
ls AGENTS.md 2>/dev/null && echo "exists" || echo "missing"
```

- If it exists on your fork's branch: review it, update `project` memory block (Step 7), done.
- If it's missing: create one using the **Fork AGENTS.md Pattern** below.

---

### Step 6: Create fork AGENTS.md (if missing)

Create `AGENTS.md` in the repo root using the pattern documented below.

**Add `AGENTS.md export-ignore` to `.gitattributes`** (create the file if missing):

```
AGENTS.md export-ignore
```

This prevents AGENTS.md from appearing in `git archive` exports and signals to upstream that it must not be included in merges.

**Commit both files to your fork's `main` branch immediately:**

```bash
git add AGENTS.md .gitattributes
git commit -m "chore: add AGENTS.md for AI-assisted workflow

Assisted-by: <Model> via OpenCode"
git push origin main
```

**Hard rules — enforced unconditionally:**
- NEVER include AGENTS.md in any PR to the upstream repo
- NEVER send AGENTS.md to any remote other than `origin` (your `castrojo/<repo>` fork)
- If upstream already has an AGENTS.md, treat it as reference only — your fork's file is authoritative for your workflow

---

### Step 7: Update `project` memory block

Use `memory_set` (scope: project) to write a quick reference for the session:

```
# <Repo Name>

- Validation: <command>
- Build tool: <just/make/npm/...>
- Target branch: <main/lts/...>
- Plans: ~/.config/opencode/plans/<repo-name>/
- Upstream: <org>/<repo>
```

---

### Step 8: Run validation baseline

```bash
<validation command from Step 3>
```

If it passes: note that in the project-notes.md.
If it fails: investigate before starting any work. Do not skip this.

---

### Step 9: Set up devcontainer.json

devaipod requires a `.devcontainer/devcontainer.json` in each repo. Without it, devaipod
falls back to `default-image` in `~/.config/devaipod.toml` — this works but is fragile and
misses repo-specific capabilities. Every repo must have its own file.

**Check if it already exists:**

```bash
ls .devcontainer/devcontainer.json 2>/dev/null && echo "exists" || echo "MISSING"
```

**If missing, ask the user:**

> "Does this repo build container images or run nested podman/flatpak-builder during its
> normal workflow (e.g. `just build` invokes podman build or flatpak-builder)?"

**If NO** (standard repo — web app, CLI tool, library, etc.) — create:

```bash
mkdir -p .devcontainer
cat > .devcontainer/devcontainer.json << 'EOF'
{ "name": "<repo>", "image": "ghcr.io/bootc-dev/devenv-debian:latest" }
EOF
```

**If YES** (container-building repo) — create:

```bash
mkdir -p .devcontainer
cat > .devcontainer/devcontainer.json << 'EOF'
{
  "name": "<repo>",
  "image": "ghcr.io/bootc-dev/devenv-debian:latest",
  "runArgs": [
    "--security-opt", "label=disable",
    "--security-opt", "unmask=/proc/*",
    "--device", "/dev/net/tun",
    "--device", "/dev/kvm"
  ],
  "capAdd": ["SYS_ADMIN"],
  "postCreateCommand": {
    "devenv-init": "sudo /usr/local/bin/devenv-init.sh"
  },
  "remoteEnv": {
    "PATH": "${containerEnv:PATH}:/usr/local/cargo/bin"
  }
}
EOF
```

Commit to the repo's `main` (fork only — not part of any upstream PR):

```bash
git add .devcontainer/devcontainer.json
git commit -m "chore(devcontainer): add devcontainer.json for devaipod

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push origin main
```

**devaipod invocation pattern** (same for all repos):

```bash
# Fork repos (with personal config via bind_home):
~/.cargo/bin/devaipod run ~/src/<repo> --host -c 'task description'

# Upstream repos (read-only recon, no personal config needed):
~/.cargo/bin/devaipod run https://github.com/org/repo --host -c 'investigate X'
```

The `mounts` field in devcontainer.json is parsed by devaipod but silently ignored — use
`bind_home` in `~/.config/devaipod.toml` to deliver AGENTS.md, skills, and memory instead.

---

### Step 10: Write journal entry

```
journal_write(
  title: "Onboarded <repo-name>",
  body: "Set up remote layout, plans directory, AGENTS.md. Validation: <pass/fail>. Notes: <anything unexpected>.",
  tags: "workflow-learning"
)
```

---

### Step 11: Improve this skill if needed

If any step in this skill was **missing, wrong, or unclear**, invoke `writing-skills` now — before the session ends:

```
skill("writing-skills")
```

Update this skill in-session. Do not defer to a future session.

---

## Fork AGENTS.md Pattern

A fork's project-level AGENTS.md is **context for AI agents working in this specific repo.** It is not a copy of the global rules — those live in `~/.config/opencode/AGENTS.md` and are always in context.

### What to include

| Section | Rule |
|---|---|
| One-paragraph project description | What it is, what it builds, key technology |
| Working effectively / prerequisites | Install commands, environment setup, critical warnings |
| Build commands | Exact commands with timeout notes |
| Validation commands | The `just check && just lint` equivalent |
| Repository structure | Key directories and important files only |
| Common commands reference | Short copy-paste block for daily use |
| Critical project-specific reminders | Anything unique to this codebase the agent must not forget |
| Lazy-load references | If any section would be >100 lines, extract to `~/.config/opencode/plans/<repo>/` and add a one-line reference |

### What to omit (already in global `~/.config/opencode/AGENTS.md`)

| Section | Why to omit |
|---|---|
| Attribution / Assisted-by footer | Global rule, always in context |
| PR submission protocol | Global rule, always in context |
| Conventional commits rule | Global rule, always in context |
| Remote naming convention | Global rule, always in context |
| Branch workflow | Global rule, always in context |
| Banned behaviors list | Global rule, always in context |

### Lazy-load pattern

When a section is large (CI/CD architecture, build failure reference, etc.), do not embed it inline. Instead:

1. Extract to `~/.config/opencode/plans/<repo>/<section-name>.md`
2. Replace the section with one line in AGENTS.md:

```markdown
> CI/CD architecture details: see `~/.config/opencode/plans/<repo-name>/ci-architecture.md`
```

The agent reads it on demand. This keeps AGENTS.md under ~150 lines (target: ~1,000 tokens).

### Canonical example

`bluefin-lts` AGENTS.md at `~/src/bluefin-lts/AGENTS.md` is the reference implementation:
- 124 lines
- Lazy-loads CI architecture, build architecture, development tasks to `~/.config/opencode/plans/bluefin-lts/`
- Contains only project-specific content

### Never-commit rule

```
AGENTS.md committed to: castrojo/<repo> fork, main branch ✅
AGENTS.md in upstream PR:                                   ❌ NEVER
AGENTS.md pushed to upstream remote:                        ❌ NEVER
```

If the upstream repo has its own AGENTS.md, it is treated as reference only — per the authority hierarchy in `~/.config/opencode/AGENTS.md`.

---

## Quick Reference

```bash
# Step 1: Verify remotes
git remote -v

# Step 1b: Sync fork main (every session)
git fetch upstream && git log --oneline upstream/main..main
# Clean sync:
git rebase upstream/main && git push origin main --force-with-lease
# Dirty fork (hard reset):
git reset --hard upstream/main
# ...re-apply AGENTS.md commit, then force-push

# Step 2: Plans directory
mkdir -p ~/.config/opencode/plans/<repo>/

# Step 2b: Worktree setup (one-time global, then per-repo)
grep -q "\.worktrees" ~/.config/git/ignore 2>/dev/null || { mkdir -p ~/.config/git && echo ".worktrees" >> ~/.config/git/ignore && git config --global core.excludesFile ~/.config/git/ignore; }
mkdir -p .worktrees   # creates dir so using-git-worktrees skill finds it
git check-ignore -v .worktrees   # should print: ~/.config/git/ignore:1:.worktrees

# Step 3: Discover validation
just --list || make help

# Step 3b: Check for MCPs
cat opencode.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.get('mcp',{}).keys()))"

# Step 6: Commit fork AGENTS.md + .gitattributes
echo "AGENTS.md export-ignore" >> .gitattributes
git add AGENTS.md .gitattributes && git commit -m "chore: add AGENTS.md for AI-assisted workflow"
git push origin main   # fork only — NEVER upstream

# Step 8: Validate
just check && just lint   # or project equivalent

# Step 9: devaipod (no files to commit — just use the central config)
~/.cargo/bin/devaipod run ~/src/<repo> --host -c 'task description'
# Upstream recon: ~/.cargo/bin/devaipod run https://github.com/org/repo --host -c 'investigate X'
```

Full git workflow reference: `~/.config/opencode/plans/git-workflow.md`
