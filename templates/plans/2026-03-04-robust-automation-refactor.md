# 2026-03-04-robust-automation-refactor.md

**Goal:** Refactor `setup.sh` and template skills to be idempotent, portable, and data-safe.

---

## 🛠 Task 1: Data-Safe Setup Script (`setup.sh`)
**Instructions for Implementation Agent:**
1.  **Idempotent Backup:** Replace `mv "$CONFIG_DIR" "${CONFIG_DIR}.bak"` with a check. If `$CONFIG_DIR` exists, prompt the user or use a timestamped backup: `mv "$CONFIG_DIR" "${CONFIG_DIR}.$(date +%Y%m%d%H%M%S).bak"`.
2.  **Portable Sed:** Replace `sed -i` with a more portable alternative (e.g., a simple Node script) to ensure it works on both Linux and macOS.
3.  **Check-before-Push:** In the "Seed repo" step, check if the repo already has content before forcing a push.

---

## 🛠 Task 2: Refactor Template Skills (Instructions)
**Instructions for Implementation Agent:**
1.  **Refactor `onboarding-a-repository`**:
    - Add idempotency checks for `git remote rename`.
    - Use `OPENCODE_ROOT="${OPENCODE_ROOT:-$HOME/.config/opencode}"` for path abstraction.
    - Automate the creation of a local `AGENTS.md` for stable project facts.
2.  **Refactor `session-start`**:
    - Remove the requirement to write a 1000-char `memory_set` block.
    - Make it rely on the local `AGENTS.md` for static context.
    - Only use `memory_set` for transient session goals.

---

## 🛠 Task 3: Create `project-discovery` Skill
**Instructions for Implementation Agent:**
- Create `templates/skills/personal/project-discovery/SKILL.md`.
- Implement automated detection for: Node.js, Rust, Go, and Python.
- Output a structured "Discovery Report" for other skills to consume.
