---
name: onboarding-a-repository
description: Use when starting work on any repository for the first time — sets up remotes, fork AGENTS.md, project memory block, and validation baseline
---

# Onboarding a Repository

## Overview

Run this checklist **once per repo, before any other work begins.** Every step is mandatory. The skill ends with a journal entry and, if the skill had gaps, an in-session update.

**Announce at start:** "I'm using the onboarding-a-repository skill to set up this repository."

---

## Checklist

### Step 1: Verify remote layout

**For forked repos** (`ublue-os/*`, `projectbluefin/*`, or any upstream org): a fork in `YOUR_USERNAME` namespace
is mandatory. If the fork doesn't exist yet, create it on GitHub before continuing:

```bash
gh repo fork <org>/<repo> --clone=false
```

```bash
git remote -v
```

Expected:
```
origin    git@github.com:YOUR_USERNAME/<repo>.git (fetch)
origin    git@github.com:YOUR_USERNAME/<repo>.git (push)
upstream  git@github.com:<org>/<repo>.git (fetch)
upstream  git@github.com:<org>/<repo>.git (push)
```

**If wrong:** Fix it before doing anything else.

```bash
# Rename your fork remote to origin (if named something else)
git remote rename <fork-name> origin

# If origin currently points to upstream, rotate it:
git remote rename origin upstream-old
git remote add origin git@github.com:YOUR_USERNAME/<repo>.git
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

Record the validation command (e.g. `just check && just lint`, `make test`, `npm test`). You will need it in Step 4 and Step 8.

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
- Record working MCPs in the project memory block (Step 7) under a `## MCP Servers` section
- If an MCP fails to respond, note it — do not silently assume it works; broken MCPs produce stale data with no build error

If no `opencode.json` or no MCPs: note "no MCPs configured" in the project memory block.

Additionally, verify the **always-present** global workflow-state MCP is healthy before
any loop work:

```bash
systemctl --user is-active opencode-state-db && echo "DB: ok"
ls ~/.config/opencode/mcp/state/opencode-state-mcp && echo "binary: ok"
```

If either fails: see new-machine-setup Step 6c to fix it. Do not proceed with loop work
until the MCP is healthy — loop state and plan imports will silently fail.

---

### Step 4: Initialize project memory block

Use `memory_set` (scope: project) to write a durable quick-reference for this repo. Keep the total content under 500 chars:

```
memory_set(
  label: "project",
  scope: "project",
  description: "Durable, high-signal information about <repo-name>: remotes, branch model, conventions, and gotchas.",
  value: "# <Repo Name>

- Upstream: git@github.com:<org>/<repo>.git
- Fork: git@github.com:YOUR_USERNAME/<repo>.git
- Target branch: <main/lts/stable>
- Validation: <exact command from Step 3>
- Architecture: <1-2 sentence summary>"
)
```

Keep it under 500 chars. If the project has a well-populated AGENTS.md, skip fields already covered there.

---

### Step 5: Check for AGENTS.md on your fork

```bash
# Does YOUR_USERNAME/<repo> already have an AGENTS.md?
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
- NEVER send AGENTS.md to any remote other than `origin` (your `YOUR_USERNAME/<repo>` fork)
- If upstream already has an AGENTS.md, treat it as reference only — your fork's file is authoritative for your workflow

---

### Step 7: Update `project` memory block

The project memory block was initialized in Step 4. By Step 7 you have completed Steps 5–6 (AGENTS.md, fork setup). Revisit the memory block and add any details discovered since Step 4 — devaipod category, AGENTS.md status, MCP status:

```
memory_replace(
  label: "project",
  oldText: "- Architecture: <1-2 sentence summary>",
  newText: "- Architecture: <actual description>\n- AGENTS.md: <exists/created>\n- MCPs: <none/list>"
)
```

---

### Step 8: Run validation baseline

```bash
<validation command from Step 3>
```

If it passes: note that in the project memory block.
If it fails: investigate before starting any work. Do not skip this.

---

### Step 9: devaipod fitness assessment

devaipod provides container-isolated build/test runs. Every repo must have a
`.devcontainer/devcontainer.json` — without it devaipod falls back to `default-image`
which is fragile and misses repo-specific capabilities.

**Check existing devcontainer:**

```bash
cat .devcontainer/devcontainer.json 2>/dev/null || echo "MISSING"
```

If already present and tested: skip to Step 9d.

**Step 9a: Analyze the project build profile**

Determine which category this repo falls into:

| Category | Indicators | devcontainer type |
|---|---|---|
| Standard repo | web app, CLI, library, script — `just build` has no nested containers | minimal |
| Container-building repo | `just build` or CI uses `podman build`, `flatpak-builder`, or nested containers | privileged |
| Go/Rust binary | `go.mod` or `Cargo.toml` present | minimal + language tooling |
| Node/web | `package.json` present | minimal |

Run:
```bash
ls Cargo.toml go.mod package.json pyproject.toml 2>/dev/null
grep -r "podman\|docker\|flatpak-builder" Justfile Makefile 2>/dev/null | head -5
```

**Step 9b: Create devcontainer.json**

**For standard repos (web, CLI, library, Go, Node):**

```bash
mkdir -p .devcontainer
cat > .devcontainer/devcontainer.json << 'EOF'
{ "name": "<repo>", "image": "ghcr.io/bootc-dev/devenv-debian:latest" }
EOF
```

**For container-building repos (nested podman/flatpak-builder):**

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

**Step 9c: Test with a real devaipod run**

```bash
~/.cargo/bin/devaipod run ~/src/<repo> --host -c 'echo "devaipod: ok" && pwd && ls'
```

Expected output: prints "devaipod: ok", working directory inside container, repo files visible.

If it fails:
- Check that podman is running: `systemctl --user is-active podman.socket`
- Check devcontainer image can pull: `podman pull ghcr.io/bootc-dev/devenv-debian:latest`
- Check `DEVAIPOD_HOST_MODE=1` is set or `--host` was passed

**Step 9d: Run the project validation inside devaipod**

```bash
~/.cargo/bin/devaipod run ~/src/<repo> --host -c '<validation command from Step 3>'
```

This confirms the container can actually build/test the project. If it fails, investigate — common causes:
- Missing tool in devenv-debian (add `postCreateCommand` to install it)
- Permission issue (needs `capAdd: SYS_ADMIN` for mount operations)
- Network dependency not available in container

**Step 9e: Commit devcontainer.json**

```bash
git add .devcontainer/devcontainer.json
git commit -m "chore(devcontainer): add devcontainer.json for devaipod integration

Assisted-by: <Model> via OpenCode"
git push origin main
```

Note: `.devcontainer/devcontainer.json` is committed to the **fork** (`origin`). If the repo is yours (no upstream remote), commit to `main`. It is acceptable to include in upstream PRs if the upstream has no existing devcontainer.

**devaipod invocation pattern (all repos):**

```bash
# Fork repos (personal config via bind_home):
~/.cargo/bin/devaipod run ~/src/<repo> --host -c 'just build'

# Upstream recon (read-only, no personal config):
~/.cargo/bin/devaipod run https://github.com/org/repo --host -c 'investigate X'
```

The `mcp/state` bind_home path in `devaipod.toml` delivers the MCP binary to containers
automatically — loop-task runs inside containers can call workflow-state tools.

---

### Step 10: Write journal entry

```
journal_write(
  title: "Onboarded <repo-name>",
  body: "Set up remote layout, project memory block, AGENTS.md. Validation: <pass/fail>. Notes: <anything unexpected>.",
  tags: "workflow-learning"
)
```

---

### Step 10a: Bootstrap loop state and import initial plan

After onboarding completes, initialize this repo's loop state and seed a starter plan
so the first loop session starts immediately without orientation overhead.

**Initialize loop state in the DB:**

```
set_loop_state(
  repo: "<repo-name>",
  phase: "",
  run: "0/0",
  goal: ""
)
```

**If the project has a non-trivial validation command or build pipeline**, seed a starter plan directly into the DB:

**Import the starter plan into the DB:**

```
import_plan(
  repo: "<repo-name>",
  plan_id: "onboarding-starter",
  tasks: [
    {"task_num": 1, "description": "Run validation baseline inside devaipod"},
    {"task_num": 2, "description": "Verify container has all required tools"},
    {"task_num": 3, "description": "Document build time and gotchas in project memory block"}
  ]
)
```

**Verify the plan imported:**

```
get_plan_tasks(repo: "<repo-name>", plan_id: "onboarding-starter")
```

Expected: 3 tasks with status `pending`.

**The DB is ready for loop work:**
- Loop state: clean (`phase=""`, `run="0/0"`) — `loop-start` will initialize
- Plan `"onboarding-starter"`: 3 tasks seeded, all `status=pending`
- `session-start` will show no active loop (clean state)

To begin: invoke `loop-start` with goal `"Establish build baseline and devaipod environment for <repo-name>"`

---

### Step 10b: Skill audit and update

Onboarding is a high-signal moment — you have read the codebase, run the build, and hit every friction point fresh. That context is perishable. Before closing the session, answer these three questions and act on every yes:

1. **New skill needed?** Did any step involve a non-obvious process (took >30s to figure out, or required trial and error)? If yes → create a personal skill using `writing-skills`. Examples: project-specific build sequence, tricky devcontainer setup, MCP query pattern for this domain, non-standard tool config.

2. **Existing skill incomplete?** Was any skill invoked during onboarding wrong, missing a step, or unclear? If yes → fix it now with `improve-workflow`. Do not defer.

3. **Skill too large?** Is any skill doing more than one conceptual task — could a step be extracted into a focused sub-skill that other skills could call? If yes → split it. Extract the focused part as a new skill; replace it in the parent with a one-line reference: `> See <skill-name> skill.`

Write or update the affected skills. Commit to your `opencode-config` repo (or your superpowers fork for superpowers skills).

**Do not skip.** An onboarding that produces no skill improvement is incomplete. Friction was encountered and not captured for the next session.

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
| Lazy-load references | If any section would be >100 lines, extract to a DB-backed reference doc and add a one-line reference in AGENTS.md |

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

1. Extract to a journal entry or project memory block addendum
2. Replace the section with one line in AGENTS.md:

```markdown
> CI/CD architecture details: see project memory block or journal entry tagged "ci-cd"
```

The agent reads it on demand. This keeps AGENTS.md under ~150 lines (target: ~1,000 tokens).

### Canonical example

A well-structured fork AGENTS.md is 100–150 lines. It lazy-loads deeper reference docs
via journal entries or the project memory block on demand. It contains only project-specific
content — no global workflow rules.

### Never-commit rule

```
AGENTS.md committed to: YOUR_USERNAME/<repo> fork, main branch ✅
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

# Step 2b: Worktree setup (one-time global, then per-repo)
grep -q "\.worktrees" ~/.config/git/ignore 2>/dev/null || { mkdir -p ~/.config/git && echo ".worktrees" >> ~/.config/git/ignore && git config --global core.excludesFile ~/.config/git/ignore; }
mkdir -p .worktrees   # creates dir so using-git-worktrees skill finds it
git check-ignore -v .worktrees   # should print: ~/.config/git/ignore:1:.worktrees

# Step 3: Discover validation
just --list || make help

# Step 3b: Check for MCPs
cat opencode.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.get('mcp',{}).keys()))"

# Step 4: Initialize project memory block
# (Use memory_set with scope: project — repo URL, fork, validation, build tool, what it is, key dirs)

# Step 6: Commit fork AGENTS.md + .gitattributes
echo "AGENTS.md export-ignore" >> .gitattributes
git add AGENTS.md .gitattributes && git commit -m "chore: add AGENTS.md for AI-assisted workflow"
git push origin main   # fork only — NEVER upstream

# Step 8: Validate
just check && just lint   # or project equivalent

# Step 9: devaipod fitness assessment
~/.cargo/bin/devaipod run ~/src/<repo> --host -c 'echo "devaipod: ok"'
# Full validation in container:
~/.cargo/bin/devaipod run ~/src/<repo> --host -c '<validation command>'

# Step 10a: bootstrap loop state
# (Use MCP tools: set_loop_state, import_plan, get_plan_tasks)
```

Full git workflow reference: `~/.config/opencode/plans/git-workflow.md`
