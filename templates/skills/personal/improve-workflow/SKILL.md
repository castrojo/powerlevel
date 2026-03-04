---
name: improve-workflow
description: Use when the user corrects you, repeats an instruction you should have followed, or you identify a gap in a skill or AGENTS.md — captures the improvement immediately before continuing work.
---

# Improve Workflow

Invoke the moment you notice a workflow gap. Do not defer.

**Announce:** "Using improve-workflow to capture a correction."

---

## When to invoke

- The user corrects you on something you should have known
- The user repeats an instruction for the second time in a session
- A skill gave wrong or incomplete guidance
- A mistake happened that a rule should have prevented

---

## Step 1: Classify the improvement

| Improvement type | File to update |
|---|---|
| Global workflow rule or ban | `~/.config/opencode/AGENTS.md` |
| Skill is missing a step or has wrong guidance | The skill's `SKILL.md` |
| Project-specific convention | Project's `AGENTS.md` |
| Agent behavioral style or human preference | `~/.config/opencode/memory/persona.md` or `human.md` |

---

## Step 2: Draft the change

Write 1-3 sentences. Show draft to user:
> "I'm going to add the following to `<file>`: `<draft>`. Should I proceed?"

Wait for confirmation.

---

## Step 3: Apply the edit

Surgical edit only — do not rewrite surrounding content.

---

## Step 4: Commit

```bash
cd ~/.config/opencode
git add <file>
git commit -m "fix(workflow): <what was wrong and what was fixed>

Assisted-by: <Model> via OpenCode"
git push
```

---

## Step 5: Write a journal entry

```
journal_write(
  title: "Workflow correction: <topic>",
  body: "Corrected <file>. Was: <old>. Now: <new>. Triggered by: <cause>.",
  tags: "workflow-learning"
)
```

## Step 6: Continue

Resume the original task.
