# Bootstrap Instructions

This repo sets up a structured OpenCode workflow. When a user points you here, follow these steps exactly.

---

## Step 1: Check prerequisites

Run:
```bash
gh auth status
ssh -T git@github.com
npm --version
```

If any fail, stop and tell the user:
- `gh auth status` fails → `gh auth login --git-protocol ssh`
- SSH fails → generate a key: `ssh-keygen -t ed25519` then `gh ssh-key add ~/.ssh/id_ed25519.pub --title "$(hostname)"`
- `npm` missing → install Node.js from https://nodejs.org

Do not proceed until all three pass.

---

## Step 2: Run setup

```bash
git clone git@github.com:castrojo/powerlevel.git /tmp/powerlevel-setup
bash /tmp/powerlevel-setup/setup.sh
```

The script is fully automated. It will:
- Create a private `opencode-config` repo in the user's GitHub account
- Clone `obra/superpowers` as read-only (push disabled)
- Wire up symlinks, run `npm install`, configure global gitignore
- Seed the config with templates and commit everything

If the script fails, read the error — it will tell you exactly what to fix.

---

## Step 3: Install community skills

After setup, the user needs to install community skills via the OpenCode skill installer.
Tell the user: "Open a new OpenCode session, press ctrl+p, and install these skills:"

| Skill | Source |
|---|---|
| `gh-cli` | `github/awesome-copilot` |
| `code-review` | `supercent-io/skills-template` |
| `container-debugging` | `aj-geddes/useful-ai-prompts` |
| `shellcheck-configuration` | `wshobson/agents` |
| `devops-engineer` | `jeffallan/claude-skills` |
| `github-actions-templates` | `wshobson/agents` |
| `git-commit` | `github/awesome-copilot` |
| `bash-linux` | `sickn33/antigravity-awesome-skills` |
| `fedora-linux-triage` | `github/awesome-copilot` |
| `find-skills` | `vercel-labs/skills` |

---

## Step 4: First session

Tell the user to open a new OpenCode session in `~/.config/opencode/` and say "session-start".

In that first session, ask the user a few questions to fill in `memory/human.md`:
- Preferred container runtime (Docker, Podman, etc.)
- Communication style preferences
- Any tools or conventions they always use

Write their answers into `memory/human.md` and commit:
```bash
cd ~/.config/opencode
git add memory/human.md
git commit -m "chore(memory): initial human preferences"
git push
```

Setup is complete.

---

## README Constraint

The README is a **skill and feature focused product page**. Describe what the user gets
(skills, memory, journal, workflow discipline) and how to use the repo. It is not a manual
and contains no agent instructions. Keep it under 2 pages. Agent instructions belong in
this file (`AGENTS.md`), not the README.

---

## What NOT to Do

- Do NOT set `gh repo edit --template` on this repo. An agent reads the repo directly.
  The GitHub template flag is for humans using the "Use this template" UI — it has no
  effect on how agents interact with the repo.
