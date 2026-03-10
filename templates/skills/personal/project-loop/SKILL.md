---
name: project-loop
description: Use when starting a new project improvement loop — wraps the full brainstorm→plan→execute→ship pipeline with loop-task iterations in the execute phase; devaipod is the execution environment
---

# Skill: project-loop

Announce: "Using project-loop to start a structured project improvement loop."

This skill drives a 3-phase loop for project work (features, bug fixes, refactors):
- **Phase 1 (plan):** Brainstorm → write plan → review → confirm
- **Phase 2 (execute):** loop-task iterations via devaipod — build, observe, fix
- **Phase 3 (ship):** CI green, PR, merge, cleanup

Invoke `loop-start` first if no loop is active. Set `phase_names: plan,execute,ship`.

---

## Before You Start: Fork Check

Work always happens in a local fork in `YOUR_GITHUB_USERNAME`, not on upstream directly.

```bash
git remote -v
```

Expected:
```
origin    git@github.com:YOUR_GITHUB_USERNAME/<repo>.git  (push here)
upstream  git@github.com:<org>/<repo>.git                 (fetch only)
```

If the remote layout is wrong: stop and run `onboarding-a-repository` first.
If the repo is already owned by `YOUR_GITHUB_USERNAME` (no upstream): proceed directly.

Sync the fork to upstream before starting (skip silently for owner repos):

```bash
if git remote get-url upstream &>/dev/null; then
  git fetch upstream
  git rebase upstream/main
  echo "Fork synced to upstream/main"
fi
```

If rebase conflicts, resolve before starting the loop. A dirty fork produces messy PRs.

---

## Phase 1: Plan

**Goal:** Understand the problem, agree on the design, write a task-by-task plan. No code yet.

### Step 0: Pre-flight local fork sync

Ensure the local repository is up to date with upstream before planning begins, preventing conflicts later.

```bash
# Check if upstream remote exists
git remote -v
```

If an `upstream` remote exists, sync it:
```bash
git fetch upstream
git rebase upstream/main
```

### Step 1: Brainstorm

Load and follow the `brainstorming` skill. Explore:
- What problem are we solving?
- What constraints apply (API compat, CI budget, no new deps without asking)?
- What are the design options?
- What are we deliberately NOT building?

Produce a design summary. **Stop and confirm with user before proceeding.**

### Step 2: Write the plan

Load and follow the `writing-plans` skill.
Seed the plan to the DB via `import_plan` — no .md file is created. Task data enters the DB exclusively via `import_plan`.

### Step 3: Review the plan

Load and follow `plan-self-review` and `architecture-review` (as subagents if both apply).
Resolve all critical/high severity issues inline in the plan before proceeding.

### Step 4: Advance to execute phase

Auto-advance. After plan review completes, invoke `loop-gate` immediately to advance to Phase 2 (execute). No confirmation needed.

---

## Phase 2: Execute

**Goal:** Build. Each loop-task run = one devaipod invocation + observation.

### Execution pattern

Each run via `loop-task`:
1. Run `just build` (or the project's validation command) via devaipod
2. Observe: what failed, what the error is, where it is in the code
3. Fix the failures — edit source files, apply the minimal surgical fix
4. Commit the fix: `git add -p && git commit -m "fix: <description>"`
5. Append run summary: what failed, what was fixed, what remains
6. Update loop state via set_loop_state MCP

**N = max build attempts.** Default N=5. Loop terminates early when `just build` passes clean. If N is exceeded without a clean build, surface remaining failures and escalate to the user.

**One failure category per run.** If the build has multiple error categories, fix the most fundamental one (root of the dependency chain) first, then re-run. Do not fix all error categories in one run — that leads to tangled commits.

### Subagent strategy

Build-iteration runs are always sequential — each run depends on the fixes from the previous run. Dispatch loop-task serially. Do NOT parallelize execute-phase runs.

If the plan has truly independent parallel tasks (e.g., implement unrelated features with no shared code), use the `dispatching-parallel-agents` skill BEFORE starting the build-iteration loop to split the work.

### devaipod invocation

```bash
~/.cargo/bin/devaipod run ~/src/<REPO> --host -c 'just build'
```

The devcontainer.json in the repo controls the container image. This must match CI — loop-gate will check this at phase transition.

### devaipod Gotchas

**bind_home paths:** Use granular subpaths — do NOT list `.config/opencode` itself. The agent startup script pre-creates `.config/opencode` before files are copied; `podman cp` of a directory into an existing directory nests the source inside it. Use: `.config/opencode/AGENTS.md`, `.config/opencode/skills`, `.config/opencode/memory`, `.config/opencode/agents`.

**Do NOT bind_home `opencode.json`** — devaipod writes its own version; overwriting it breaks the agent's model/provider configuration.

**devcontainer.json resolution:** `--devcontainer-json` flag > `.devcontainer/devcontainer.json` > `--image` flag > `default-image` in `devaipod.toml`. The `mounts` field is silently ignored — use `bind_home` for config delivery.

**Container-building repos** (build uses `podman build`, `flatpak-builder`) need additional devcontainer.json fields:
```json
"capAdd": ["SYS_ADMIN"],
"runArgs": ["--security-opt", "label=disable", "--security-opt", "unmask=/proc/*", "--device", "/dev/net/tun", "--device", "/dev/kvm"]
```

**Shell quoting in `bash -c`:** Never use Python f-strings with single quotes inside a `bash -c '...'` string — inner single quotes terminate the outer shell string. Use `grep` or `jq` to parse output instead.

**Capturing command output from a running container:**
```bash
POD=$(cat /tmp/devaipod-pod-$(basename $PWD))
podman exec ${POD}-workspace bash -c '<command>'
```
(`devaipod run` launches an AI agent — it does NOT pipe shell stdout back to the caller.)

### Phase 2 ends when

The most recent `just build` passes clean inside devaipod. Invoke `loop-gate` immediately.

---

## Phase 3: Ship

**Goal:** CI green, PR created, merged. Clean up.

### Step 1: Verify CI matches local

The loop-gate CI parity check should have already surfaced any mismatch. If not, run the project's validation command:

```bash
just check
```

CI workflow verification is done by running the project's validation command — not by grepping CI files. If `just check` is not defined, check the project's `opencode.json` for the correct validation command.

If local and CI diverge: fix before creating a PR.

### Step 2: Create the PR

Load and follow `finishing-a-development-branch`.

The skill handles:
- Squash to one commit
- PR creation via `gh pr create --web`
- Both confirmation dialogs
- Gemini review reminder

**Do NOT auto-submit.** The user always clicks "Create Pull Request" in the browser.

### Step 3: Loop-end

After PR is created (not merged — merged is out of scope for the loop):
- Invoke `loop-end` for the state integrity checklist
- Verify skills-as-byproduct: the execute phase must have produced or improved at least one skill
- Reset loop state via set_loop_state MCP

---

## Cross-machine note

Loop state is stored in the workflow-state DB. Start Phase 1 on one machine, continue Phase 2 on another — session-start calls get_session_context automatically and surfaces the active loop in the banner. No file sync needed.

---

## After each use: improve this skill

At the end of every project-loop session, answer:
> "Did this skill miss anything? Was any step unclear, wrong, or absent?"

If yes: fix this SKILL.md inline before running loop-end. If the fix is generic, copy to powerlevel/templates/ too.

This is the evolving prompt property — each use makes the next loop better.
