---
name: session-start
description: Use at the start of every session in any repository, before doing any other work — verifies which project is loaded, initializes or corrects the project memory block, and surfaces any active plans.
---

# Session Start

Run at the beginning of every session, before any other action.

**Announce:** "Using session-start to orient context."

---

## Step 1: Verify the project

```bash
pwd && git remote get-url origin 2>/dev/null || echo "not a git repo"
git branch --show-current
git log --oneline origin/main..HEAD 2>/dev/null | wc -l
```

If on a branch with 0 commits ahead of main, it's likely stale. Ask the user before continuing.

---

## Step 2: Check the project memory block

The block is correct if **all three** hold:
1. First line is `# <RepoName>` matching the repo you just verified
2. It contains the validation command for this repo
3. It is under 500 chars

**If all three are true: skip Step 3 entirely.** No write needed.

**If empty, wrong repo name, or missing the validation command:** rewrite now using Step 3.

Do not proceed with stale or wrong context.

---

## Step 3: (Re)write the project memory block (only if Step 2 failed)

The memory block must not duplicate facts already in the project's `AGENTS.md` — those are always in the system prompt. Store only what is NOT there.

Call `memory_set` with scope `project`:

```
# <RepoName>

- Repo: git@github.com:<org>/<repo>.git
- Validation: <exact command, e.g. bash -n setup.sh>
- Plans: ~/.config/opencode/plans/<repo-name>/
- Architecture: <1-2 sentence summary>
```

Keep under 500 chars. If the project has a well-populated `AGENTS.md`, skip fields that are already covered there.

---

## Step 4: Check for active plans

```bash
ls ~/.config/opencode/plans/<repo-name>/ 2>/dev/null || echo "no plans directory"
```

If files exist, scan their names. Report any that look in-progress. If an active plan is found, also run:

```bash
git status --short
git worktree list
```

---

## Step 4b: Surface relevant journal entries

```
journal_search(project: "<repo-name>", limit: 3)
```

Note any entries directly relevant to known active work.

---

## Step 5: Report

One paragraph:
- Which repo is loaded
- Whether the project block was correct, corrected, or newly written
- Any active plans and working tree state (or "no active plans")
- Any relevant journal entries (or "no recent entries")

Then stop. Do not begin any other work until the user gives a task.
