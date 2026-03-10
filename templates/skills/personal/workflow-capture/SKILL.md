---
name: workflow-capture
description: Use at postflight to autonomously process all [GAP] items from the loop — classifies each gap, applies surgical edits, syncs DB, decides powerlevel backport, commits, and journals without user confirmation
---

Announce: "Using workflow-capture to process [GAP] items from this loop."

---

## Step 0: Early exit if no [GAP] items exist

Before doing anything else, query run history for [GAP] items:

```
get_run_history(repo: "<REPO>", filter: "[GAP]")
```

If the result contains **zero** [GAP] items across all runs:

1. Write a journal entry:
   ```
   journal_write(
     title: "workflow-capture: no gaps — <REPO> loop",
     body: "workflow-capture: no [GAP] items found this session. No skill updates needed.",
     tags: "workflow-capture, workflow-learning"
   )
   ```
2. **Stop immediately.** Do not proceed to any further steps.

Only continue to Step 1 if at least one [GAP] item was found.

---

## Step 1: Collect [GAP] items

Collect all items with `[GAP]` prefix from findings across all runs in this loop (already fetched in Step 0).

---

## Step 2: Process each item autonomously

For each `[GAP]` item, work through these sub-steps. Do NOT ask the user for confirmation at any point. Do NOT batch all edits into one read/write cycle — process each item completely before moving to the next.

### 2a: Classify the target

Determine which file to edit:

| Gap type | File |
|---|---|
| Skill missing a step or has wrong guidance | `~/.config/opencode/skills/personal/<skill>/SKILL.md` |
| Cross-cutting convention (git, PR, commit, session) | `~/.config/opencode/AGENTS.md` |
| Project-specific pattern or command | Project `AGENTS.md` in the repo root |
| Agent behavioral style or human preference | `~/.config/opencode/memory/persona.md` or `human.md` |

**When in doubt:** prefer updating the skill over AGENTS.md. Add to AGENTS.md only for conventions that no single skill owns.

### 2b: Read the current content (DB-first)

- Skill edit → `workflow-state_search_skill(skill_name: "<skill>", query: "<gap topic>")` to locate the section
- AGENTS.md edit → `workflow-state_search_rules(query: "<gap topic>", domain: "<domain if known>")`
- **If DB returns nothing:** The section is missing from the DB. Run the seeder to re-populate: `go run ~/.config/opencode/mcp/state/seed/skills/main.go`. NEVER fall back to reading the file directly.

### 2c: Apply a surgical edit

Use the Edit tool. Do NOT rewrite the file. Add only what is missing or fix only what is wrong. 1–3 sentences maximum.

### 2d: DB sync is automatic

The post-commit hook in `opencode-config` runs the seeder on every commit that touches a `SKILL.md` file. No manual `upsert_skill_section` or `upsert_rule` calls are needed — committing the file change is sufficient.

If committing from a context where the hook may not fire (e.g., non-opencode-config repo), run the seeder manually after the commit: `go run ~/.config/opencode/mcp/state/seed/skills/main.go`.

### 2e: Decide powerlevel backport

**Skip check (fast path):** If the user said "skip powerlevel" or "SKIP POWERLEVEL IMPROVEMENTS" at any point in this session — skip this step entirely for every item. Mark the backport decision as "skipped (user request)" in the Step 4 journal entry. Do not ask — the user already decided. Proceed directly to Step 2f (next item) or Step 3 if all items are processed.

Ask: "Is this fix generic enough for any user bootstrapping from scratch, with no personal refs, no specific repo names, no Bluefin/Flatpak specifics?"

- **Yes** → mark for backport: copy the updated SKILL.md to `~/src/powerlevel/templates/skills/personal/<skill>/SKILL.md` using `git -C ~/src/powerlevel add templates/` (do NOT commit yet — batch all backports into one commit in Step 3)
- **No** → opencode-config only, no copy

---

## Step 3: Commit all changes

### opencode-config (always, if any edits were made)

```
cd ~/.config/opencode
git add AGENTS.md skills/personal/ memory/
git commit -m "fix(workflow): automated capture from <REPO> loop — <N> improvements

<bullet list of what was fixed>

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

### powerlevel (only if any backports were approved in Step 2e)

```
cd ~/src/powerlevel
git add templates/
git commit -m "feat(templates): backport <N> workflow improvements from <REPO> loop

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

If no backports: skip the powerlevel commit entirely.

---

## Step 4: Write journal entry

```
journal_write(
  title: "Workflow capture: <REPO> loop — <N> improvements",
  body: "Processed <N> [GAP] items from <REPO> loop. Fixed: <list>. Backported: <list or 'none'>.",
  tags: "workflow-learning, workflow-capture"
)
```

---

## Step 5: Return summary

Return a one-paragraph summary:
- N items processed
- Which files were edited
- N backported to powerlevel (or "none")
- Commit hash(es)

---

## Why autonomous

This skill is the postflight counterpart to `improve-workflow`. The interactive `improve-workflow`
skill requires user confirmation because it runs mid-session when a mistake is caught live.
`workflow-capture` runs at postflight after all project work is complete — the [GAP] items were
already surfaced and reviewed during the loop runs. No additional confirmation is needed.
The agent is trusted to make correct classification and backport decisions.
