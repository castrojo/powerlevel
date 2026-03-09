---
name: onboarding-a-repository
description: Use when starting work on any repository for the first time — sets up remotes, plans directory, project memory block, and validation baseline.
---

# Onboarding a Repository

Run once per repo before any other work.

**Announce:** "I'm using the onboarding-a-repository skill to set up this repository."

---

## Step 1: Verify remote layout

```bash
git remote -v
```

Expected layout:
```
origin    git@github.com:YOUR_USERNAME/<repo>.git  (fetch/push)
upstream  git@github.com:<org>/<repo>.git           (fetch/push)
```

If your fork doesn't exist yet:
```bash
gh repo fork <org>/<repo> --clone=false
```

Fix remotes if wrong:
```bash
git remote rename origin upstream 2>/dev/null || true
git remote add origin git@github.com:YOUR_USERNAME/<repo>.git
git fetch upstream
git branch --set-upstream-to=upstream/main main
```

**All remote URLs must be SSH (`git@github.com:...`). Never HTTPS.**

---

## Step 1b: Sync fork main to upstream

```bash
git fetch upstream
git log --oneline upstream/main..main
```

Fork `main` should have at most 1 commit ahead (the fork-only AGENTS.md). If it's clean:
```bash
git rebase upstream/main && git push origin main --force-with-lease
```

---

## Step 2: Create plans directory

```bash
mkdir -p ~/.config/opencode/plans/<repo-name>/
```

Plans never go inside the git repo.

---

## Step 2c: Initialize loop state

Copy the loop state template for this repo:

```bash
cp ~/.config/opencode/loop-state-template.md ~/.config/opencode/plans/<repo-name>/loop-state.md
```

This creates a clean active_phase: 0 state. The first loop-start for this repo will find it ready.

If `~/.config/opencode/loop-state-template.md` doesn't exist (bootstrap hasn't been run or template was removed), create a minimal version:

```bash
cat > ~/.config/opencode/plans/<repo-name>/loop-state.md << 'EOF'
active_phase: 0
run_progress: 0/0
last_action: none
next_action: invoke loop-start

## Systemic improvements

EOF
```

---

## Step 3: Set up worktree directory

```bash
mkdir -p .worktrees
git check-ignore -v .worktrees  # should pass via global gitignore
```

If not ignored, verify global gitignore is set up:
```bash
grep -q "\.worktrees" ~/.config/git/ignore 2>/dev/null || \
  { mkdir -p ~/.config/git && echo ".worktrees" >> ~/.config/git/ignore && \
    git config --global core.excludesFile ~/.config/git/ignore; }
```

---

## Step 4: Discover validation commands

```bash
just --list 2>/dev/null || make help 2>/dev/null || cat package.json | grep -A10 '"scripts"' 2>/dev/null || echo "check Makefile/README"
```

Record the validation command.

---

## Step 5: Check for AGENTS.md on your fork

```bash
ls AGENTS.md 2>/dev/null && echo "exists" || echo "missing"
```

If missing, create a project-level AGENTS.md with:
- What the project is (1-2 sentences)
- Build and validation commands
- Key directories
- Critical warnings specific to this repo

Then add `.gitattributes`:
```
AGENTS.md export-ignore
```

Commit both to your fork only — never include AGENTS.md in a PR to upstream:
```bash
git add AGENTS.md .gitattributes
git commit -m "chore: add AGENTS.md for AI-assisted workflow"
git push origin main
```

---

## Step 6: Write project memory block

```
memory_set(scope: "project"):

# <RepoName>

- Repo: git@github.com:YOUR_USERNAME/<repo>.git
- Validation: <command>
- Plans: ~/.config/opencode/plans/<repo-name>/
- Upstream: <org>/<repo>
```

---

## Step 7: Run validation baseline

```bash
<validation command>
```

If it fails: investigate before starting any work.

---

## Step 8: Journal entry

```
journal_write(
  title: "Onboarded <repo-name>",
  body: "Set up remotes, plans dir, AGENTS.md. Validation: <pass/fail>. Notes: <anything unexpected>.",
  tags: "workflow-learning"
)
```
