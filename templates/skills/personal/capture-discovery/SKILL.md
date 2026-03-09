---
name: capture-discovery
description: Use when you figure out how something works, find a non-obvious gotcha, confirm a design decision, or discover a CI/build/config pattern — writes a journal entry and optionally updates the project memory block with stable facts.
---

# Capture Discovery

Invoke this the moment you make a meaningful discovery. Do not defer to session end.

**Announce:** "Using capture-discovery to record a finding."

---

## When to invoke

- You figure out why something behaves unexpectedly
- You find a non-obvious gotcha (e.g. a gitignored file, a timing issue, a config that silently overrides another)
- You confirm a design decision and want to preserve the reasoning
- You discover a CI, build, or tooling pattern worth preserving
- You learn something about the codebase that you would want to know next session

---

## Step 1: Write the journal entry

```
journal_write(
  title: "<what you discovered, in 5–10 words>",
  body: "<what it is, why it matters, what it affects, how you found it>",
  tags: "<debugging | design-decision | workflow-learning | ci-cd | os-image>"
)
```

Be specific. Vague entries ("looked into X") are useless next session.

---

## Step 2: Check if it's a stable project fact

Ask: is this a durable fact about the repo that an agent needs every session?

Examples of stable facts: validation command changed, new MCP added, key directory renamed, critical constraint discovered.

Examples of non-stable facts: a specific bug's root cause, a one-time fix, a transient CI failure.

**If stable:** show the proposed project block addition to the user:

> "This seems like a stable fact worth adding to the project block: `<1-line fact>`. Should I add it?"

Wait for explicit confirmation. If confirmed, call `memory_replace` (scope: project) to add the line surgically.

**If not stable:** skip Step 2. The journal entry is sufficient.

---

## Step 3: Continue work

Resume the task that surfaced the discovery. Do not change course unless the discovery changes the plan.
