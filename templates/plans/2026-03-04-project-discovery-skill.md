# Project Discovery Skill — Implementation Plan

**Status:** Not started. Next up after data integrity and token efficiency work (2026-03-04).

**Goal:** A single skill that outputs a structured "Discovery Report" for any project — build tool, validation command, runtime versions — so agents stop manually parsing `package.json`, `Cargo.toml`, etc. in every session.

---

## Problem

`onboarding-a-repository` and `session-start` both contain ad-hoc discovery logic. Agents re-derive the same facts (what test command runs, what language is this, what build tool is present) every session by guessing at filenames. This is toil.

## Intended behavior

Agent runs `project-discovery` → gets one clean report → records the validation command → done.

The skill does NOT replace `onboarding-a-repository`. It is a utility that any skill can call.

---

## Skill spec

**File:** `templates/skills/personal/project-discovery/SKILL.md`

**Trigger:** Any time an agent needs to know "how do I build/test this project?" and the answer isn't already in the project memory block or AGENTS.md.

**Steps:**

1. Run detection in a single parallel bash block:
   - `just --list` (check for Justfile)
   - `make help` or `make --dry-run | head -5` (check for Makefile)
   - `cat package.json | python3 -c "..."` (extract npm scripts if present)
   - `ls Cargo.toml go.mod pyproject.toml requirements.txt` (language markers)

2. Emit a structured Discovery Report:
   ```
   === Discovery Report: <repo-name> ===
   Build tool:  just / make / npm / cargo / go / python
   Validate:    <exact command>
   Language:    <Node 20 / Rust 1.77 / Go 1.22 / Python 3.11>
   Key files:   <Justfile / Makefile / package.json / Cargo.toml / go.mod>
   ```

3. Record the validation command in the project memory block if missing.

**Constraints:**
- All detection runs in a single bash call (no sequential probing)
- Output is fixed-width structured text, not prose
- Skill is under 60 lines

---

## Out of scope

- Recursive project detection (monorepos)
- Auto-running the validation command (separate concern)
- Language version pinning or dependency analysis

---

## Files to create

- `templates/skills/personal/project-discovery/SKILL.md`
- Same file in live `~/.config/opencode/skills/personal/project-discovery/SKILL.md`

Both files are identical except for the `YOUR_USERNAME` placeholder (not present in this skill — no username references needed).
