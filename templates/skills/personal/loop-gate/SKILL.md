---
name: loop-gate
description: Use after all loop-task runs complete — shows progress, processes systemic improvements via improve-workflow, commits, and gates the phase transition on human confirmation
---

Announce: "Using loop-gate to confirm phase transition."

---

## Step 1: Read current state

```bash
cat ~/.config/opencode/plans/<REPO>/loop-state.md
```

Show current position:
```
Loop goal: <loop_goal>
[ LOOP GATE ] <REPO> • Phase <N>/<total_phases> complete • Runs: <X>/<Y>
```

---

## Step 2: Show progress summary

List what was accomplished this phase:
- Runs completed: X/N
- journal_write entries: (search journal for this loop's run entries)
- Systemic improvements found: (count items under ## Systemic improvements)

```
journal_search(text: "<REPO> Loop Run", limit: 10)
```

List the titles found. This confirms all runs are documented.

---

## Step 3: Process systemic improvements

Read ## Systemic improvements from loop-state.md.

For each item listed:
1. Present it to the user
2. Invoke improve-workflow (one invocation per item — do not batch)
3. Each improve-workflow call produces a commit to opencode-config

If no items: skip to Step 4.

Note: improve-workflow was banned mid-run. This is where those parked items get actioned.

---

## Step 4: Commit opencode-config (catch-all)

After all improve-workflow calls:
```bash
git -C ~/.config/opencode status --short
```

If any uncommitted changes remain:
```bash
cd ~/.config/opencode
git add AGENTS.md opencode.json memory/ agent-memory.json skills/personal/ agents/ plans/ devaipod.toml loop-state-template.md
git commit -m "chore(config): loop-gate sync — Phase <N> complete

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

---

## Step 5: Human confirmation gate

Use the question tool:

```
question: "Phase <N> complete. Advance to Phase <N+1>?"
options:
  - "Yes — advance to Phase <N+1>" → proceed to Step 6
  - "No — run more iterations in Phase <N>" → stop here, user invokes loop-task again
```

Do not advance without explicit "Yes".

---

## Step 6: Advance phase

Update loop-state.md:
- active_phase: <N+1>
- run_progress: 0/<Y> (reset run counter for next phase if applicable, or keep as-is)
- last_action: loop-gate Phase <N> complete
- next_action: (depends on new phase — see below)

Phase transition next actions:
- Phase N → N+1 (not final): next_action = invoke loop-task (Phase <N+1> Run 1)
- Phase N → N+1 (final, N+1 = total_phases): next_action = invoke loop-end

Show:
```
Loop goal: <loop_goal>
[ GATE PASSED ] <REPO> • Now in Phase <N+1>/<total_phases> • Next: <next_action>
```

**MUST: end with the question tool below. Do NOT substitute inline text or "say X to continue" instructions.**

Then use the question tool to ask what to do next:

**If advancing to a non-final phase:**
```
question: "Phase <N+1> ready. Start Phase <N+1> Run 1 now?"
options:
  - "Yes — start Phase <N+1> Run 1 now" → invoke loop-task immediately
  - "Skip — already done / not needed" → mark phase complete, advance without running loop-task
  - "Stop here — I'll continue later" → stop
```

**If advancing to the final phase (N+1 = total_phases):**
```
question: "Final phase ready. Run loop-end now?"
options:
  - "Yes — run loop-end now" → invoke loop-end immediately
  - "Skip — already done / not needed" → mark complete, no loop-end needed
  - "Stop here — I'll run loop-end later" → stop
```
