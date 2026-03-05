---
name: container-harvest
description: Use after any devaipod session — journal findings and check for container output files
---

# Skill: container-harvest

## When to Use

After any devaipod session. Use as a quick checklist before teardown. The host agent
already has stdout from any `podman exec` calls and can journal findings directly with
`journal_write` — no extraction step needed.

**Announce:** "Using container-harvest to capture session findings."

---

## Steps

### 1. Journal significant findings

If the container session produced insights, discoveries, or design decisions:

```
journal_write(title: "...", body: "...", tags: "...")
```

Call this on the host agent directly. The host agent has the stdout from all container
commands already.

### 2. Check for report files

If the container agent was asked to write outputs to disk:

```bash
ls /workspaces/<repo>/
```

Review any `.md` or report files written by the container agent. Incorporate into host
workflow as needed.

### 3. Update the project memory block

After any container run, update the project-scoped memory block with stable facts
discovered during the session:

- Build commands that worked (exact invocations, not just tool names)
- Server start command and port
- Any environment setup required (e.g. `npm install` must run first)
- Gotchas (missing tools, slow steps, workarounds used)

```
memory_replace(scope: "project", label: "project", oldText: "...", newText: "...")
```

This ensures each future run of the same project starts more efficient than the last.
The project memory block is the compounding improvement ledger — treat every container
run as an opportunity to make the next one faster.

### 4. Update the active plan

If a plan file exists for this repo (`~/.config/opencode/plans/<repo>/`), append a new
section to the most recent plan file:

```markdown
## Run N findings — YYYY-MM-DD

- **Tested:** <what was run>
- **Broke:** <failures, errors, unexpected behavior>
- **Slow:** <bottlenecks, timing notes>
- **Agent tasks:** <one entry per finding — each must state: file to fix, recommended change, reason>
  - Format: `[ ] fix <file>: <what to change> — <why>`
  - Workaround documentation is banned. If a workaround exists, the task is to eliminate it.
  - Example: `[ ] fix Justfile: add npm install as first build step — fails on clean host without node_modules`
```

This keeps the plan self-updating across runs — no separate planning session needed.

**If this is the final run in a series:**

1. Run `plan-self-review` on the full accumulated plan — score it, list deficiencies, edit inline.
2. Run `architecture-review` — check for structural issues, resolve critical/high items inline.
3. Output an **executive report** to the user with two clearly labeled sections:

   **Systemic Fixes** (global — apply across all repos):
   - AGENTS.md rule additions or corrections
   - Skill gaps or missing steps
   - Justfile convention violations
   - Workflow protocol improvements

   **Per-Project Fixes** (scoped to this repo only):
   - Justfile recipe fixes
   - project-notes corrections
   - CI/CD changes
   - Config corrections

4. Present the reviewed plan to the user. **User decides when to execute — never auto-execute.**

---

### 5. That's it

- `.config/opencode` is live-mounted — skill edits and AGENTS.md changes are already on host
- `.local/share/opencode` is intentionally NOT in the container — no DB to sync
- Workspace dir changes land on host via devaipod's bind-mount automatically

---

## Notes

- `~/.cargo/bin/devaipod exec <workspace> -W --host` opens a shell in the workspace for debugging
- `~/.cargo/bin/devaipod attach -l --host` attaches to the most recent workspace
