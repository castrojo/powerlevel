# Personal Git / GitHub Workflow

This is the portable reference for setting up and working in any repository.
Apply this to every repo before starting work.

---

## Remote Naming Convention

Every repo must have exactly this layout:

```
origin    → castrojo/<repo>   (your fork — push here only)
upstream  → <org>/<repo>      (upstream — fetch only, NEVER push)
```

Verify with:

```bash
git remote -v
```

If the layout is wrong, fix it before doing anything else (see Normalizing Remotes below).

---

## Setting Up a New Fork (Correct Way)

Always clone your fork first, then add upstream:

```bash
# 1. Clone your fork
git clone git@github.com:castrojo/<repo>.git
cd <repo>

# 2. Add upstream
git remote add upstream git@github.com:<upstream-org>/<repo>.git

# 3. Verify
git remote -v
# origin    git@github.com:castrojo/<repo>.git (fetch)
# origin    git@github.com:castrojo/<repo>.git (push)
# upstream  git@github.com:<upstream-org>/<repo>.git (fetch)
# upstream  git@github.com:<upstream-org>/<repo>.git (push)

# 4. Fetch upstream branches
git fetch upstream

# 5. Set local main/lts to track upstream
git branch --set-upstream-to=upstream/main main
# If the repo has an lts branch:
git checkout --track upstream/lts
```

---

## Normalizing Remotes in an Existing Repo

If a repo has wrong remote names (e.g. both pointing to upstream, fork named something else):

```bash
# Identify what you have
git remote -v

# Rename your fork remote to origin (if it's named something else, e.g. castrojo)
git remote rename castrojo origin

# If origin currently points to upstream, rename it first
git remote rename origin upstream-old
git remote add origin git@github.com:castrojo/<repo>.git
git remote set-url upstream git@github.com:<upstream-org>/<repo>.git
git remote remove upstream-old

# Verify
git remote -v
```

**bluefin-lts specific:** See `~/.config/opencode/plans/bluefin-lts/development-tasks.md`
for the exact commands to normalize this legacy repo.

---

## Branch Lifecycle

```
upstream/main (or lts)
      │
      │  git checkout -b feat/my-work upstream/main
      ▼
  feat/my-work  ← all messy commits, WIP, LLM noise live here
      │
      │  When ready to send upstream:
      │  git checkout -b clean/my-work upstream/main
      │  git merge --squash feat/my-work
      │  git commit (one clean conventional commit)
      ▼
  clean/my-work  ← single commit, sent upstream via --web PR
      │
      │  After PR submitted:
      │  git branch -d clean/my-work
      │  git push origin --delete clean/my-work
      ▼
   (deleted)     feat/my-work kept until upstream PR merges
```

### Rules

- Work branches: `feat/`, `fix/`, `chore/`, `docs/` prefixes
- Push work branches to `origin` (your fork) only
- `main` and `lts` in your fork track upstream — never commit directly to them
- Flow is always `main` → `lts`. Never merge `lts` → `main`.

---

## Worktree Convention

All feature work runs in isolated git worktrees. Standard location: `.worktrees/<branch-name>` inside each repo.

### Gitignore strategy

`.worktrees/` is excluded via the **global gitignore** (`~/.config/git/ignore`), which covers every repo on the machine — including fork repos where you cannot commit upstream `.gitignore` changes. For owner repos, also add `.worktrees` to the repo's `.gitignore` explicitly.

The global gitignore source is tracked in `castrojo/opencode-config` at `git-config/ignore`. New machine setup (Step 4b) installs it automatically.

### Creating a worktree

```bash
# Verify .worktrees is ignored first
git check-ignore -v .worktrees

# Create worktree on a new branch
git worktree add .worktrees/<branch-name> -b feat/<name>

# Install dependencies if needed (Node.js example)
cd .worktrees/<branch-name> && npm install
```

### Listing and cleaning up

```bash
# List all worktrees for this repo
git worktree list

# Remove a finished worktree
git worktree remove .worktrees/<branch-name>

# Remove a stale/dirty worktree
git worktree remove --force .worktrees/<branch-name>
```

Full protocol (directory priority, baseline verification, etc.): `using-git-worktrees` skill.

---

## Upstream PR Checklist

Before opening any PR to upstream, verify all of these:

- [ ] Working branch is pushed to `origin` (your fork), not `upstream`
- [ ] Clean branch created off `upstream/<target>` (not off your working branch)
- [ ] `git merge --squash` applied — exactly **one** commit above upstream tip
  - Verify: `git log --oneline upstream/<target>..HEAD` shows exactly 1 line
- [ ] Commit message is a clean conventional commit (no WIP, no LLM noise)
- [ ] `Assisted-by:` footer present in commit
- [ ] Project validation passes (e.g. `just check && just lint`)
- [ ] Both confirmation dialogs completed (via `finishing-a-development-branch` skill)
- [ ] `gh pr create --web` used — browser opened, user submits manually
- [ ] Clean branch deleted after submission

---

## Keeping Your Fork in Sync

```bash
# Fetch latest from upstream
git fetch upstream

# Update your local main (never commit here directly)
git checkout main
git merge --ff-only upstream/main
git push origin main

# Same for lts if applicable
git checkout lts
git merge --ff-only upstream/lts
git push origin lts
```

Use `--ff-only` — if this fails, your fork has diverged and something is wrong.

---

## One-Time Setup Checklist for Any New Repo

1. [ ] Clone fork as `origin`, add upstream as `upstream`
2. [ ] Verify `git remote -v` matches convention
3. [ ] Set local tracking branches to `upstream/*`
4. [ ] Create a plans directory: `mkdir -p ~/.config/opencode/plans/<repo-name>/`
5. [ ] Check if repo has a `just` Justfile — run `just --list` to learn available commands
6. [ ] Identify the validation command (e.g. `just check && just lint`, `make test`, etc.)
7. [ ] Note the target upstream branch (`main`, `lts`, `stable`, etc.)
8. [ ] Set up `.worktrees/`: verify global gitignore covers it (`git check-ignore -v .worktrees`), then `mkdir -p .worktrees`

---

## What Never Goes in a Repo

- Plans, implementation notes, LLM session artifacts
- This file or any other personal workflow docs
- `AGENTS.md` with personal workflow rules (upstream repos may have their own)
- Anything under `~/.config/opencode/`

All personal docs live in `~/.config/opencode/plans/<repo-name>/`.
