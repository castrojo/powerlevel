# 2026-03-04-senior-engineer-gap-analysis.md

**Goal:** Improve the simplicity, idempotency, and efficiency of the OpenCode workflow while reducing "Agent Toil."

---

## 🛠 Architectural Recommendations

### 1. Simplify Discovery (Toil Reduction)
- **Problem:** Agents are manually parsing `package.json`, `Cargo.toml`, and `Makefile` in every session to find validation commands.
- **Good enough solution:** Create a simple `project-discovery` script in the user's `bin/` or as a reusable skill. 
- **User Experience:** The agent runs one command and gets a clean "Discovery Report" instead of guessing.

### 2. Idempotent Onboarding (Simplicity)
- **Problem:** `onboarding-a-repository` tries to rename remotes every time, which is noisy and error-prone.
- **Good enough solution:** Update the skill to check if `upstream` already exists before trying to `git remote rename origin upstream`.
- **Refactor Pattern:** `git remote get-url upstream >/dev/null 2>&1 || git remote rename origin upstream`

### 3. Path Portability (Environment Agnostic)
- **Problem:** Hardcoded `~/.config/opencode/` fragments are scattered throughout skills.
- **Good enough solution:** Standardize on an internal variable (e.g., `OPENCODE_ROOT`) at the start of every skill. 
- **UX benefit:** Makes it much easier to use this setup in a devcontainer or a different OS layout without rewriting every skill.

### 4. Token Efficiency (Cost/Context Management)
- **Problem:** `session-start` frequently overwrites a large project memory block (~1000 chars) that persists in every turn.
- **Good enough solution:** Move *stable* facts (Validation commands, Repo URLs) to the project's `AGENTS.md`. Use `memory_set` only for *active session goals*.
- **Efficiency:** This reduces the "ambient context" sent to the model in every turn, saving tokens and keeping the context window focused on the task at hand.

---

## ⚡ Non-Negotiable Standards (The "Senior Review")

For any future agent modifying this repo or the user's config:
1. **Sidecar Privacy:** Never commit plans, session notes, or user preferences to code repositories.
2. **Surgical Changes:** Use `replace` or targeted `write_file` for specific lines. Do not rewrite entire files unless the file is <20 lines.
3. **Validation First:** A task is not complete when the code is written; it is complete when the `validation command` passes and the `AGENTS.md` rules are verified.
4. **No Chitchat:** Keep responses technical and concise. Efficiency is a feature.
