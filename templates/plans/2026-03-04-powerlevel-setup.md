# powerlevel Repo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Overwrite castrojo/powerlevel with a minimal workflow bootstrapper that lets any user point their agent at it and get the same OpenCode setup structure.

**Architecture:** powerlevel is a read-only reference + automation tool. It is NOT the user's config. setup.sh creates a private `opencode-config` repo and clones `obra/superpowers` (read-only). All personal config lives in the user's own repos. powerlevel stays upstream.

**Key constraint:** Minimal and opinionated. Ship the workflow structure, not opinions about what goes in it.

---

## File Structure

```
powerlevel/
├── README.md                          ← human product page (<2 pages)
├── AGENTS.md                          ← bootstrap instructions for the agent
├── setup.sh                           ← full automation (agent runs this)
└── templates/
    ├── AGENTS.md                      ← minimal global workflow rules (YOUR_USERNAME placeholder)
    ├── opencode.json                  ← plugin config
    ├── agent-memory.json              ← journal config
    ├── memory/
    │   ├── persona.md                 ← minimal agent persona
    │   └── human.md                   ← blank, filled in during first session
    ├── git-config/
    │   └── ignore                     ← .worktrees
    └── skills/
        └── personal/
            ├── session-start/SKILL.md
            ├── session-end/SKILL.md
            ├── capture-discovery/SKILL.md
            ├── improve-workflow/SKILL.md
            ├── onboarding-a-repository/SKILL.md
            └── new-machine-setup/SKILL.md
```

---

### Task 1: Clear old repo content

**Files:**
- Delete: `docs/`, `plugin.js`, `projects/`, `skills/` (root level)
- Keep: `LICENSE`

**Step 1:** Remove stale files
```bash
cd /tmp/powerlevel-clone
rm -rf docs plugin.js projects skills
```

**Step 2:** Verify only LICENSE and README.md remain (README will be overwritten in Task 2)
```bash
ls /tmp/powerlevel-clone/
```

---

### Task 2: Write README.md

**File:** `/tmp/powerlevel-clone/README.md`

Human product page. Under 2 pages. Reads like a product description, not a manual.

Content goals:
- One-line description: "castrojo's OpenCode setup — fork the workflow, not the config"
- What's included: table of tools with links (OpenCode, opencode-agent-memory, superpowers, obra/superpowers, personal skills)
- What the setup gives you: 4-6 bullet features (persistent memory, journal, skill discipline, session hygiene, safe git rails)
- How it works: 3 steps (point agent at this repo, agent runs setup.sh, opens new session with full workflow ready)
- Honest tradeoffs: 2-3 bullet pros, 2-3 bullet cons
- No agent instructions. No setup details. Just what it is.

---

### Task 3: Write AGENTS.md (bootstrap instructions)

**File:** `/tmp/powerlevel-clone/AGENTS.md`

Agent-only. Short. Tells the agent exactly what to do when a user says "set up my workflow".

Content:
1. Detect or ask for GitHub username (`gh api user --jq .login`)
2. Check prerequisites — if missing, tell user what to install
3. Run `bash setup.sh` (agent executes it)
4. After setup: open a new session in `~/.config/opencode/` and run `session-start`
5. First session: ask user a few questions to fill in `memory/human.md` (preferred container tool, communication style, anything else)
6. Install community skills via OpenCode skill installer — list the skills with sources

No global workflow rules here. Those live in `templates/AGENTS.md`.

---

### Task 4: Write setup.sh

**File:** `/tmp/powerlevel-clone/setup.sh`

Executable. Agent runs `bash setup.sh`. Full automation.

Steps the script performs:
1. Detect username: `USERNAME=$(gh api user --jq .login)` — no prompting, fails if gh not authenticated
2. Check prereqs: `gh`, `git`, `npm`, `ssh -T git@github.com` — print clear error and exit if any missing
3. Check if `~/.config/opencode` already exists — if yes, back it up to `~/.config/opencode.bak`
4. Create private `$USERNAME/opencode-config` repo via `gh repo create $USERNAME/opencode-config --private --clone=false` — skip if already exists
5. Clone powerlevel templates to a temp dir, copy to a local staging area, replace all `YOUR_USERNAME` with `$USERNAME`
6. Push staged content to `$USERNAME/opencode-config` (init, add remote, push)
7. Clone `$USERNAME/opencode-config` to `~/.config/opencode/`
8. Clone `obra/superpowers` to `~/.config/opencode/superpowers/` — set `git remote set-url --push origin DISABLE` so it's permanently read-only
9. Create symlinks:
   - `~/.config/opencode/plugins/superpowers.js` → `superpowers/.opencode/plugins/superpowers.js`
   - `~/.config/opencode/skills/superpowers` → `superpowers/skills`
10. `npm install` in `~/.config/opencode/`
11. Copy `git-config/ignore` to `~/.config/git/ignore`, set `git config --global core.excludesFile`
12. Final verification: print pass/fail for each component
13. Print next steps: open new OpenCode session in `~/.config/opencode/`

Script must be `set -euo pipefail`. All git operations use SSH URLs.

---

### Task 5: Write templates/AGENTS.md

**File:** `/tmp/powerlevel-clone/templates/AGENTS.md`

This becomes the user's `~/.config/opencode/AGENTS.md`. Minimal global workflow rules.

Sections:
- **Session hygiene** — session-start at start, session-end at end
- **Feature workflow** — three stages: brainstorm → plan → execute; stop between each; no shortcuts
- **Commit conventions** — `type(scope): description` + `Assisted-by:` footer
- **Git rules** — SSH only, remote naming (`origin` = your fork, `upstream` = source, never push upstream), no HTTPS
- **Banned behaviors** — short list: no `gh pr create` to upstream without `--web`, no force push to main, no multi-commit upstream PRs, no committing plans/session notes to repos
- **Plans location** — `~/.config/opencode/plans/<repo-name>/` — never inside repos

Replace `castrojo` → `YOUR_USERNAME` throughout. setup.sh substitutes the real username.

Keep it under 80 lines. No bluefin-specific content. No Justfile conventions. Just the core process.

---

### Task 6: Write template config files

**Files:**

`templates/opencode.json`:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-agent-memory"]
}
```

`templates/agent-memory.json`:
```json
{
  "journal": {
    "enabled": true,
    "tags": [
      { "name": "debugging", "description": "Debugging sessions and findings" },
      { "name": "design-decision", "description": "Architecture and design choices" },
      { "name": "workflow-learning", "description": "Insights about the workflow system" },
      { "name": "ci-cd", "description": "CI/CD pipeline work" }
    ]
  }
}
```

`templates/memory/persona.md`: Minimal agent persona. Core principles only: evidence before assertions, surgical changes, YAGNI, honest disagreement, no emojis, concise output. No username-specific content.

`templates/memory/human.md`: Empty file with comment: `# Fill in during your first session — ask your agent to help`.

`templates/git-config/ignore`:
```
.worktrees
```

---

### Task 7: Write personal skills (genericized)

**Files:** `templates/skills/personal/<skill>/SKILL.md` for each of the 6 skills.

Generalize these from the originals:
- Replace all `castrojo` with `YOUR_USERNAME`
- Replace all `castrojo/opencode-config` with `YOUR_USERNAME/opencode-config`
- Remove bluefin-specific content from `onboarding-a-repository` (bluefin ecosystem section)
- Simplify `new-machine-setup` to reference `setup.sh` first, with manual fallback steps

Skills to include:
1. `session-start` — unchanged except username placeholder
2. `session-end` — unchanged except username placeholder
3. `capture-discovery` — unchanged (no username references)
4. `improve-workflow` — unchanged except username placeholder in commit step
5. `onboarding-a-repository` — remove bluefin ecosystem fork requirement; keep everything else
6. `new-machine-setup` — lead with "run setup.sh from castrojo/powerlevel"; keep manual steps as fallback

---

### Task 8: Commit and push

**Step 1:** Stage all new files
```bash
cd /tmp/powerlevel-clone
git add -A
git status
```

**Step 2:** Commit
```bash
git commit -m "chore: replace with OpenCode workflow bootstrapper

Replaces dead project content with a minimal workflow setup guide.
Provides setup.sh automation, template config, and personal skills
for anyone to replicate the castrojo OpenCode workflow structure.

Assisted-by: Claude Sonnet 4.6 via OpenCode"
```

**Step 3:** Push
```bash
git push origin main
```

**Step 4:** Set repo as GitHub template so users can create from it
```bash
gh repo edit castrojo/powerlevel --template
```

**Step 5:** Verify
```bash
gh repo view castrojo/powerlevel --json isTemplate,description
```
