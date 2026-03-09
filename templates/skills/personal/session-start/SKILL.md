---
name: session-start
description: Use at the start of every session in any repository, before doing any other work — verifies which project is loaded, initializes or corrects the project memory block, and surfaces any active plans.
---

# Session Start

Run this at the beginning of every session, before any other action. Takes under 60 seconds.

**Announce:** "Using session-start to orient context."

---

## Step 0: Verify workflow-state MCP and check for active loop

Identify repo name (may be done as part of Step 1 — run early if needed):
```bash
REPO=$(basename $(git rev-parse --show-toplevel 2>/dev/null) 2>/dev/null || echo "")
```

### MCP health check

Run both checks in parallel:

```bash
systemctl --user is-active opencode-state-db 2>&1
ls ~/.config/opencode/mcp/state/opencode-state-mcp 2>/dev/null && echo "binary: ok" || echo "binary: MISSING"
```

**If quadlet is not `active`:**
> "workflow-state DB is not running. Fix: `systemctl --user start opencode-state-db`"
> Include in Step 5 report. Do not block the session.

**If binary is MISSING:**
> "workflow-state binary missing (expected after clean clone or machine reprovision)."
> "Fix: `cd ~/.config/opencode/mcp/state && go build -o opencode-state-mcp .`"
> Include in Step 5 report. Do not block the session.

**If both are healthy:** proceed silently — no mention in the report.

### Active loop check

**Primary (MCP)** — only if binary is healthy:

```
get_session_context(repo: "<REPO>")
```

Parse `phase` field from the JSON response.

**Fallback** (if MCP unavailable or binary missing):

```bash
cat ~/.config/opencode/plans/${REPO}/loop-state.md 2>/dev/null || echo "NO_STATE"
```

Parse `phase:` field from the file.

If `phase` is non-empty and not the template placeholder: output this block at the TOP of the Step 5 report:

```
Goal: <goal>
[ LOOP ACTIVE ] <REPO> • <phase> • Run <run> • Next: loop-task
```

If `phase` is empty or the template placeholder: output nothing. Do not mention loops in the report if no loop is active.

---

## Step 1: Verify the project

```bash
pwd && git remote get-url origin 2>/dev/null || echo "not a git repo"
```

Record: repo name and origin URL.

Also run:

```bash
git branch --show-current
git log --oneline origin/main..HEAD 2>/dev/null | wc -l
```

If the current branch is **not** `main` and has **0 commits ahead of `main`**, it is a stale merged branch. Say so explicitly and ask:

> "You're on `<branch>` which has already been merged (0 commits ahead of main). Switch to `main`, create a new branch, or stay here?"

Wait for the user's answer before proceeding to Step 1b.

---

## Step 1b: Check for uncommitted opencode-config changes

```bash
git -C ~/.config/opencode status --short
```

If any files are modified or untracked: **CRITICAL — commit before any other work.**

```bash
git -C ~/.config/opencode diff --stat
cd ~/.config/opencode
git add AGENTS.md opencode.json memory/ agent-memory.json skills/personal/ agents/ plans/ devaipod.toml
git commit -m "chore(config): sync uncommitted session changes

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

Tell the user: "Found uncommitted opencode-config changes from a previous session — committed before starting."

If the output is empty: proceed to Step 1c.

---

## Step 1c: Check devcontainer setup

```bash
ls .devcontainer/devcontainer.json 2>/dev/null && echo "devcontainer: ok" || echo "devcontainer: MISSING"
```

If **MISSING** and this is a git repo: note it in the Step 5 report:

> "`.devcontainer/devcontainer.json` is missing. devaipod will fall back to `default-image`.
> Run `onboarding-a-repository` Step 9 to add it when ready."

Do **not** block the session on this. It is a reminder, not a gate.
If the directory is not a git repo (e.g. working in `~/src`): skip this check.

---

## Step 2: Check the project memory block

Read the current `project` memory block. It is correct if **all three** hold:

1. First line is `# <RepoName>` matching the repo you just verified
2. It contains the validation command for this repo
3. It is under 500 chars

**If all three are true: skip Step 3 entirely.** No write needed.

**If empty, wrong repo name, or missing the validation command:** rewrite it now using Step 3. Do not proceed with stale or wrong context.

---

## Step 3: (Re)write the project memory block (only if Step 2 failed)

The memory block must not duplicate facts already in the project's `AGENTS.md` — those are injected into the system prompt on every turn. Store only what is NOT covered there.

Call `memory_set` with scope `project`:

```
# <RepoName>

- Repo: git@github.com:<org>/<repo>.git
- Validation: <exact command, e.g. just check>
- Plans: ~/.config/opencode/plans/<repo-name>/
- Architecture: <1-2 sentence summary>
```

Keep under 500 chars. If the project has a well-populated `AGENTS.md`, skip fields already covered there.

---

## Step 4: Check for active plans

```bash
ls ~/.config/opencode/plans/<repo-name>/ 2>/dev/null || echo "no plans directory"
```

If files exist, scan their names. If any plan looks in-progress (not dated far in the past), read its header and report to the user:

> "Found active plan: `<filename>` — last task was: `<last completed task>`"

**If an active plan was found**, also run:

```bash
git status --short
git worktree list
```

and the project's validation command (from the project block). Include all results in the Step 5 report so the user has a full ready-to-resume picture: plan state + working tree state + active worktrees + validation state. If a worktree exists for the active feature branch, note it explicitly — the user may need to switch there before starting work.

**If an active plan was found AND no loop is active (phase is empty in `get_session_context`):** add this to the Step 5 report:

> "Active plan found with no loop running. Say **'start a loop'** to begin a loop-start session for this plan."

---

## Step 4b: Surface relevant journal entries

Search for recent discoveries in this project using **text search, not project filter**.
The `project:` field in journal entries stores the full working directory path (e.g.
`/var/home/jorge/src`), not the repo name — filtering by repo name returns nothing.

```
journal_search(text: "<repo-name>", limit: 5)
```

If results exist, read the titles and note any that are directly relevant to known active work. Do not read the full bodies unless a title is directly relevant — the goal is a quick recall check, not a full review.

---

## Step 4c: Spin up container pod (optional)

Only run if the user explicitly asks for container work this session, or if an active plan
requires it. Do NOT auto-spin for every session — pod startup takes ~30s and adds noise.

If requested:

```bash
REPONAME=$(basename $(git rev-parse --show-toplevel))
~/.cargo/bin/devaipod up ~/src/${REPONAME} --host \
  2>&1 | tee /tmp/devaipod-up-${REPONAME}.log
POD=$(grep -oP '(?<=Pod ready \()[\w-]+(?=\))' /tmp/devaipod-up-${REPONAME}.log)
echo "$POD" > /tmp/devaipod-pod-${REPONAME}
```

`bind_home` in `~/.config/devaipod.toml` delivers AGENTS.md, skills, memory, and agents to
containers automatically via `podman cp`. The repo's `.devcontainer/devcontainer.json` controls
the container image and capabilities (capAdd, runArgs, etc.) — separate concern from bind_home.

If pod fails to start: warn the user, do not block the session.

Include pod info in the Step 5 report:
> Pod `<name>` ready. Use `devaipod exec <pod> --host -- bash -c '<cmd>'`
> for container work. Pod name stored at `/tmp/devaipod-pod-<reponame>`.

---

## Step 5: Report

Tell the user in one paragraph:
- Which repo/project is loaded
- Whether the project block was correct, corrected, or newly written
- Any active plans found, including working tree state and validation result if a plan was active (or "no active plans")
- Any journal entries surfaced worth noting (or "no recent entries")
- devcontainer status: present or missing (if missing, include the reminder to run Step 9)
- Pod status (if Step 4c ran)

Then stop. Do not begin any other work until the user gives a task.

**CRITICAL:** The project memory block reflects the last active project — it does not mean that is what the user wants to work on today. After reporting, always ask:

> "The active project context is `<repo>` — is that what we're working on today, or something different?"

Wait for the user to name the task before doing anything.

---

## Cost note

This skill injects ~0 extra tokens into ongoing messages. The memory block write is a one-time cost of ~200 tokens. The plan scan and journal search add ~0 tokens to the system prompt.
