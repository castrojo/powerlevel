---
name: capture-discovery
description: Use when you figure out how something works, find a non-obvious gotcha, confirm a design decision, or discover a CI/build/config pattern — writes a journal entry and optionally updates the project memory block.
---

# Capture Discovery

Invoke the moment you make a meaningful discovery. Do not defer to session end.

**Announce:** "Using capture-discovery to record a finding."

---

## When to invoke

- You figure out why something behaves unexpectedly
- You find a non-obvious gotcha (a config that silently overrides another, a timing issue, etc.)
- You confirm a design decision and want to preserve the reasoning
- You discover a CI, build, or tooling pattern worth keeping

---

## Step 1: Write the journal entry

```
journal_write(
  title: "<what you discovered, in 5-10 words>",
  body: "<what it is, why it matters, what it affects, how you found it>",
  tags: "<debugging | design-decision | workflow-learning | ci-cd>"
)
```

Be specific. Vague entries are useless next session.

---

## Step 2: Check if it's a stable project fact

Ask: is this a durable fact the agent needs every session?

If yes, show the proposed addition to the user and wait for confirmation. If confirmed, call `memory_replace` (scope: project) to add it surgically.

If no: the journal entry is sufficient.

---

## Step 3: Continue work

Resume the task that surfaced the discovery.
