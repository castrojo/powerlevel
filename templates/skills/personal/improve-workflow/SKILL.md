---
name: improve-workflow
description: Use when the user corrects you, repeats an instruction you should have followed, or you identify a gap in a skill or AGENTS.md — captures the improvement immediately before continuing work.
---

# Improve Workflow

Invoke this skill the moment you notice a workflow gap. Do not defer to the end of the session.

## Execution contract

This skill is always dispatched as a **silent background Task subagent**. It is never run inline and never announced to the user.

**Parent agent:** when a correction occurs, dispatch immediately and continue:
```
Task(
  description="capture workflow correction",
  prompt="Run improve-workflow: <one-sentence correction summary>. Full context: <what was wrong, what the correct behavior is, which file to update>",
  subagent_type="general"
)
# continue main work immediately — do NOT wait for subagent
```

**Subagent (this skill):** follow Steps 1–6 below, working autonomously. Do not communicate back intermediate results. Return a one-line summary when done.

**Do NOT announce this skill. Do NOT show the user that a correction is being captured.**

---

## When to invoke

- The user corrects you on something you should have known
- The user repeats an instruction for the second time in a session
- You discover a missing step in a skill or AGENTS.md
- A skill gave you wrong or incomplete guidance
- You make a mistake that a rule should have prevented

---

## Step 1: Classify the improvement

Determine the right file to update:

| Improvement type | File to update |
|---|---|
| Global workflow rule, convention, or ban | `~/.config/opencode/AGENTS.md` |
| Skill is missing a step or has wrong guidance | The skill's `SKILL.md` |
| Project-specific convention or command | Project's `AGENTS.md` in the repo |
| Agent behavioral style or human preference | `~/.config/opencode/memory/persona.md` or `human.md` |

**Priority:** Always prefer updating the relevant skill over adding to AGENTS.md. Add to AGENTS.md only for cross-cutting conventions that no single skill owns (git protocol, remote naming, PR rules, commit standards). If in doubt: update the skill.

---

## Step 1b: Look up existing content (DB-first)

Before drafting the change, retrieve the current content to edit surgically.

- **Updating AGENTS.md** → use `search_rules` with the relevant topic keyword:
  ```
  workflow-state_search_rules(query: "<topic>", domain: "<domain if known>")
  ```
  This returns the exact rule text and ID so you can make a targeted edit without reading the full file.

- **Updating a skill** → use `search_skill` to locate the specific section:
  ```
  workflow-state_search_skill(skill_name: "<skill>", query: "<topic>")
  ```

- **Fallback** (if neither returns the relevant section): read the file directly.

---

## Step 2: Draft the change

Write 1–3 sentences that capture the correction precisely. Be surgical — add only what's missing. Do not rewrite surrounding content.

Apply the change directly — this skill runs as a background subagent with no user interaction.

---

## Step 3: Apply the edit

Use the Edit tool to make the surgical change. Do not rewrite the file.

---

## Step 3b: Sync the changed content to the DB

After applying the edit, push the updated content to the workflow-state DB so it stays queryable without a future re-seed:

- **Skill edit** → call `upsert_skill_section` for each changed `##` section:
  ```
  workflow-state_upsert_skill_section(skill: "<skill-name>", section: "<heading>", content: "<full section text>")
  ```
  If editing the frontmatter (name, description), also upsert it as section `frontmatter`.

- **AGENTS.md edit** → call `upsert_rule` for the changed section:
  ```
  workflow-state_upsert_rule(id: "<agents-<slug>>", domain: "<domain>", content: "<full section text>")
  ```

This is mandatory — it keeps the DB as the live source so `search_rules` and `search_skill` always return current content.

---

## Step 4: Commit

Commit to the appropriate repo:

- Global `AGENTS.md` or `memory/*.md` → `castrojo/opencode-config`
- Superpowers skill → `castrojo/superpowers` (rebase on upstream before pushing)
- Personal skill → `castrojo/opencode-config`
- Project `AGENTS.md` → that project's fork

```bash
cd <repo>
git add <file>
git commit -m "fix(workflow): <what was wrong and what was fixed>

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

---

## Step 5: Write a journal entry

```
journal_write(
  title: "Workflow correction: <topic>",
  body: "Corrected <file>. Was missing: <old behavior>. Now: <new behavior>. Triggered by: <what caused the correction>.",
  tags: "workflow-learning"
)
```

---

## Step 6: Continue work

Resume the original task. The correction has been captured and committed — do not revisit it.
