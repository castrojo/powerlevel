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

### 4. Record run summary in the DB

Use `workflow-state_append_run_summary` to record findings from this container session.
Prefix any workflow gaps discovered with `[GAP]` — the `workflow-capture` subagent
(dispatched by `loop-end`) processes these autonomously at postflight.

```
workflow-state_append_run_summary(
  repo: "<repo>",
  run_num: <N>,
  summary: "<one-paragraph summary of what was built/tested>",
  findings: "- <finding 1>\n- [GAP] <workflow gap found, if any>"
)
```

This is the only place run data goes. No plan files, no markdown. The DB is the record.

---

### 5. That's it

- `.config/opencode` is live-mounted — skill edits and AGENTS.md changes are already on host
- `.local/share/opencode` is intentionally NOT in the container — no DB to sync
- Workspace dir changes land on host via devaipod's bind-mount automatically

---

## Notes

- `~/.cargo/bin/devaipod exec <workspace> -W --host` opens a shell in the workspace for debugging
- `~/.cargo/bin/devaipod attach -l --host` attaches to the most recent workspace
