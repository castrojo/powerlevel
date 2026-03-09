---
name: loop-gate
description: Use after all loop-task runs complete — shows progress, parks [GAP] items for postflight capture, commits, and gates the phase transition on human confirmation
---

Announce: "Using loop-gate to confirm phase transition."

---

## Step 1: Read current state

**Primary (MCP):**

```
get_session_context(repo: "<REPO>")
```

Parse the JSON response:
- `phase` → `<name> <current>/<total>` → current_phase_name, N (current), total_phases
- `run` → `<X>/<Y>` → X, Y
- `goal` → loop goal text

Show current position:
```
Goal: <goal>
Pipeline: <pipeline_bar> <current_phase_name> <N>/<total_phases> | Phase runs: <run_bar> <X>/<Y>
[ LOOP GATE ] <REPO> • Phase <current_phase_name> complete
```

---

## Step 2: Show progress summary

List what was accomplished this phase:
- Runs completed: X/Y
- Systemic improvements found: call `get_run_history(repo: "<REPO>", phase: "<current_phase_name>", filter: "[GAP]")` and count returned items

---

## Step 3: Scan AGENTS.md for conflicts — MANDATORY

This step catches stale references, retired tool names, and broken cross-references that accumulate over time.

**Primary (MCP):** Use `search_rules` to detect stale content — do NOT grep the file:

```
search_rules(query: "capture-loop", domain: "loop")
```
If results return: flag as `STALE: capture-loop reference found`

```
search_rules(query: "devaipod loop capture loop batch-append")
```
If results return: flag as `STALE: old loop terminology found`

**Primary (MCP):** Verify all skills in DB have a SKILL.md on disk:

```
list_skills()
```

For each skill returned, verify `~/.config/opencode/skills/personal/<skill>/SKILL.md` exists:
```bash
# Only use bash for file existence check — not for DB queries
for skill in <list from list_skills>; do
  [ ! -f "$HOME/.config/opencode/skills/personal/${skill}/SKILL.md" ] && echo "MISSING: $skill"
done
```

**If conflicts found:** For each conflict, use the question tool:
```
question: "AGENTS.md conflict: '<conflict description>'. Fix now or park as systemic improvement?"
options:
  - "Fix now" → invoke improve-workflow immediately
  - "Park it — add to Systemic improvements" → record via `append_run_summary(repo: "<REPO>", run_num: 0, findings: "[GAP] <gap description>", phase: "<current_phase_name>")` (run_num 0 = gate-level finding)
```

**If no conflicts:** note "AGENTS.md clean" and continue.

---

## Step 4: CI parity check — MANDATORY

Verify the project's local devcontainer matches the CI workflow image.

```bash
# Get local image
LOCAL_IMAGE=$(cat .devcontainer/devcontainer.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('image','NOT_FOUND'))" 2>/dev/null || echo "NO_DEVCONTAINER")

# Get CI image (check common locations)
CI_IMAGE=$(grep -r "image:\|container:\|FROM " .github/workflows/*.yml 2>/dev/null | grep -v "^Binary" | head -3 || echo "NO_CI")

echo "Local: $LOCAL_IMAGE"
echo "CI: $CI_IMAGE"
```

**If devcontainer is missing:** note it (do not block gate — some repos intentionally lack devcontainer).

**If images differ:** surface as a systemic improvement via MCP:

```
append_run_summary(
  repo: "<REPO>",
  run_num: 0,
  findings: "[GAP] CI parity: local uses <LOCAL_IMAGE>, CI uses <CI_IMAGE> — align them",
  phase: "<current_phase_name>"
)
```

**If images match or are compatible:** note "CI parity OK" and continue.

---

## Step 5: Workflow improvements

`[GAP]` items recorded during this phase are processed autonomously at postflight
by the `workflow-capture` subagent (dispatched from `loop-end` Stage 1).

No action needed here. Continue to Step 6.

---

## Step 6: Commit opencode-config (catch-all)

After all parked items are queued (catch-all for any uncommitted changes):
```bash
git -C ~/.config/opencode status --short
```

If any uncommitted changes remain:
```bash
cd ~/.config/opencode
git add AGENTS.md opencode.json memory/ agent-memory.json skills/personal/ agents/ plans/ devaipod.toml loop-state-template.md
git commit -m "chore(config): loop-gate sync — Phase <current_phase_name> complete

Assisted-by: Claude Sonnet 4.6 via OpenCode"
git push
```

---

## Step 7: Human confirmation gate

**Default (MODE=autonomous):** Auto-advance. Skip the question. Proceed directly to Step 8.

**If MODE=interactive** (user explicitly requested step-by-step mode at loop-start):

Use the question tool:

```
question: "Phase '<current_phase_name>' complete. Advance to '<next_phase_name>'?"
options:
  - "Yes — advance to <next_phase_name>" → proceed to Step 8
  - "No — run more iterations in <current_phase_name>" → stop here, user invokes loop-task again
```

Do not advance without explicit "Yes" when MODE=interactive.

---

## Step 8: Advance phase

**Primary (MCP):** Update DB state — advance phase name and reset run count:

```
set_loop_state(
  repo: "<REPO>",
  phase: "<next_phase_name> <N+1>/<total_phases>",
  run: "0/<Y>",
  goal: "<goal>"
)
```

Ask user for Y (run count for next phase) if unknown.

Show:
```
Goal: <goal>
Pipeline: <updated pipeline_bar> <next_phase_name> <N+1>/<total_phases> | Phase runs: ░░░░░ 0/<Y>
[ GATE PASSED ] <REPO> • Now in phase: <next_phase_name> • Next: loop-task Run 1
```

**Default (MODE=autonomous):** Auto-invoke the next action — `loop-task Run 1` if advancing to a non-final phase, or `loop-end` if all phases complete. Skip the question.

**If MODE=interactive:** Use the question tool as shown below.

**If advancing to a non-final phase:**
```
question: "Phase '<next_phase_name>' ready. Start Run 1 now?"
options:
  - "Yes — start <next_phase_name> Run 1 now" → invoke loop-task immediately
  - "Skip — already done / not needed" → mark phase complete, advance without running loop-task
  - "Stop here — I'll continue later" → stop
```

**If this is the final phase:**
```
question: "All phases complete. Run loop-end now?"
options:
  - "Yes — run loop-end now" → invoke loop-end immediately
  - "Skip — already done / not needed" → mark complete, no loop-end needed
  - "Stop here — I'll run loop-end later" → stop
```
