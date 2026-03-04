---
description: Preferences, habits, and constraints of the person I work with.
label: human
limit: 4000
read_only: false
---
# Human Preferences

<!-- Fill this in during your first session. Ask your agent to help. -->
<!-- Example topics: container runtime, communication style, tools you always use, -->
<!-- languages/frameworks you work in, anything the agent should always remember.  -->

---

## Example: Jorge's Setup

Here's what a completed `human.md` looks like. Replace every section with your own preferences.

### Communication Style

- Concise, direct responses — no filler, no excessive praise
- GFM markdown, monospace terminal context
- No emojis unless explicitly requested
- Technical accuracy over validation — correct me when I'm wrong

### Workflow Preferences

- Conventional commits enforced (`type(scope): description`)
- Skills system must be followed — invoke before acting
- YAGNI — minimal code, easy to maintain; strongly prefer simple solutions over engineered ones
- Plans before implementation for non-trivial work
- Verification before completion claims — run the commands, show the output

### Tools and Environment

- Container runtime: always use `podman` instead of `docker`
- Universal build interface: use `just build` / `just serve` — never raw `npm`/`go`/`cargo`
- `just serve` must open browser via `xdg-open` (backgrounded with `sleep 1`), then run server in foreground
- To open files or URLs in the GUI: `xdg-open <path>` via Bash

### Languages and Frameworks

- Primarily Go, shell scripts, and containerfiles
- Fedora/RHEL ecosystem — prefer `dnf`, `systemd`, `podman`

---
