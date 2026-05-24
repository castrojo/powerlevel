# REBALANCE.md — Powerlevel System Balance Proposals

> **Status:** Proposals only. No data files modified.  
> **Do not implement** any section without explicit approval.  
> **Files this touches (if approved):** `data/triumphs.json`, `data/seals.json`, `src/data/powerlevel.json` (tier names)

---

## Section 1: Level Scale Redesign

### Problem

The current 10-tier system (Introduced → Masterwork) has a meaningful progression gap between tiers 3–7. Most real work lands in the 1–4 band, and the jump to Expert (5) feels like a wall rather than a milestone. The names themselves are borrowed from generic RPG vocabulary and don't reflect the D2-flavored voice of the rest of the system.

### Proposed Tier Names (Level 1–10)

| Level | Current Name | Proposed Name | What Earns It |
|-------|-------------|---------------|---------------|
| 1 | Introduced | **GHOST SCAN** | Skill loaded at least once, one session using it |
| 2 | Novice | **RISEN** | Skill used across 3+ distinct sessions, first real output |
| 3 | Apprentice | **GUARDIAN** | Skill used correctly without prompting, friction documented |
| 4 | Skilled | **HUNTER/TITAN/WARLOCK** | Skill shapes an architectural decision or PR design |
| 5 | Expert | **VANGUARD** | Skill prevents a class of mistakes across a full season |
| 6 | Mastery | **LEGEND** | Skill improved (SKILL.md updated based on session learning) |
| 7 | Veteran | **TRIALS FLAWLESS** | Skill used to unblock another Guardian (real contribution) |
| 8 | Elite | **DAWNBLADE** | Skill contributed upstream or documented publicly |
| 9 | Master | **CONQUEROR** | Skill drives a multi-session epic from plan to shipped |
| 10 | Masterwork | **THE WITNESS** | Skill is so internalized it no longer needs to be loaded |

### Rationale for Name Changes

- **GHOST SCAN** (1): first contact — Ghost scans a new object/area before anything else happens
- **RISEN** (2): you've been resurrected, you know you exist; the skill has been applied
- **GUARDIAN** (3): the training wheels are off; you carry the Light without being told
- **HUNTER/TITAN/WARLOCK** (4): you've chosen a class — a real operating style is forming
- **VANGUARD** (5): trusted enough to lead others; the skill prevents, not just corrects
- **LEGEND** (6): your name appears in the record; the skill has been refined in the field
- **TRIALS FLAWLESS** (7): you went to the Lighthouse; the skill was applied perfectly end-to-end
- **DAWNBLADE** (8): you carry the flame forward; the skill has been shared or externalized
- **CONQUEROR** (9): you've completed the hardest content; the skill drives full epics
- **THE WITNESS** (10): the final shape; mastery is invisible because it's become instinct

---

### Star System (within-level granularity)

Add ★ notation to each level without changing the numeric schema. The three-star system provides visible sub-level progress without schema changes.

```
Level 3 ★☆☆  →  Level 3 ★★☆  →  Level 3 ★★★  →  Level 4 ★☆☆
```

**Star criteria (apply to all levels):**

| Stars | Trigger |
|-------|---------|
| ★☆☆ | Level just incremented (fresh level) |
| ★★☆ | Skill used successfully in 2+ sessions since level-up, OR produced a merged PR |
| ★★★ | Skill used to unblock a hard problem OR skill file updated with new learning |

**Storage:** Add an optional `stars: 0/1/2` field to each weapon entry in `powerlevel-data.json`. Default `0` (★☆☆). Dashboard renders `★☆☆` / `★★☆` / `★★★` beside the level badge. Levels are still the canonical progression gate.

**Example rendered output:**
```
workflow          TRUSTEE    Level 6 ★★★   arc
github            CHAPERONE  Level 5 ★★☆   arc
cicd-learning     OUTBREAK   Level 3 ★★★   arc
```

---

## Section 2: Seal Rebalance

### Framework

| Difficulty | Current required | Proposed required | Gate philosophy |
|------------|-----------------|-------------------|-----------------|
| accessible | 5 | **3** | Any engaged session can earn this within a season |
| veteran | 6–7 | **4** | Requires intentional practice, not heroics |
| pinnacle | 8–10 | **5–6** | Hard wall, but achievable by an active Guardian |

**Bonus triumphs** count toward a "completion score" and can gild the seal — but they never gate it.

---

### CURSEBREAKER (accessible, 5 → 3 required)

**Current required:** `first_fracture`, `loop_holds`, `workflow_clean`, `friction_remembered`, `curse_lifted`

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `first_fracture` | **CORE** | Straightforward: fix one failing CI run |
| `workflow_clean` | **CORE** | One clean push. Achievable in any session |
| `friction_remembered` | **CORE** | Write one SKILL.md update. Very doable |
| `loop_holds` | bonus | Full cicd-learning cycle is 6 steps — complex |
| `curse_lifted` | bonus | Requires 48h open failure — time-gated, rare |

**New proposal:** require 3 of (`first_fracture`, `workflow_clean`, `friction_remembered`, `loop_holds`). Remove `curse_lifted` from the required set entirely — move it to bonus.

---

### DEADEYE (accessible, 5 → 3 required)

**Current required:** `first_shot`, `precision_load`, `clean_sights`, `triple_tap`, `steady_hand`

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `first_shot` | **CORE** | Ship one cask/formula. Entry-level |
| `precision_load` | **CORE** | Zero-warning AppStream — achievable with one pass |
| `clean_sights` | **CORE** | First-push-passes-CI goal for any PR |
| `triple_tap` | bonus | Two distinct formats in one season — significant time investment |
| `steady_hand` | bonus | Three packages, full season — tracking required |

**New proposal:** require `first_shot` + `precision_load` + `clean_sights`.

---

### CHRONICLER (veteran, 7 → 4 required)

**Current required:** all 7 (`whispers_library`, `oracles_pivot`, `keeper_of_codex`, `voices_of_archive`, `pages_unburned`, `found_in_dark`, `full_record`)

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `keeper_of_codex` | **CORE** | 5 knowledge entries in a season — achievable |
| `pages_unburned` | **CORE** | One merged doc PR — clear, actionable |
| `full_record` | **CORE** | 3 SKILL.md updates in a season — routine for an engaged Guardian |
| `community_skill_levelup` | **CORE** | First level increment — naturally happens |
| `whispers_library` | bonus | 10 verified knowledge loops — tracking required |
| `voices_of_archive` | bonus | 3 CNCF community entries — domain-specific |
| `oracles_pivot` | bonus (secret) | Keep as secret triumph |
| `found_in_dark` | bonus (secret) | Keep as secret triumph |

**New proposal:** require `keeper_of_codex` + `pages_unburned` + `full_record` + `community_skill_levelup`.

---

### BLACKSMITH (veteran, 7 → 4 required)

**Current required:** all 7 (`first_forge`, `tempered_steel`, `full_matrix`, `variant_mastery`, `iron_in_fire`, `release_bell`, `masters_mark`)

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `first_forge` | **CORE** | Build and validate locally — one session |
| `tempered_steel` | **CORE** | One merged upstream PR — this is the soul of the seal |
| `variant_mastery` | **CORE** | Work with 4 variants in a season — routine Bluefin work |
| `full_matrix` | bonus | All variants + cosign — requires CI infrastructure |
| `iron_in_fire` | bonus | 3 simultaneous open PRs — situational |
| `release_bell` | bonus | Full release cycle — rare operation |
| `masters_mark` | bonus | Dashboard power level gate — passive |

**New proposal:** require `first_forge` + `tempered_steel` + `variant_mastery` + (`full_matrix` OR `iron_in_fire`).

---

### RIVENSBANE (veteran, 7 → 4 required)

**Current required:** all 7 (`voice_thousand_commits`, `dragons_hoard`, `community_herald`, `thousand_voices`, `keeper_of_law`, `wishing_wall`, `riven_silent`)

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `voice_thousand_commits` | **CORE** | One merged CNCF trilogy PR — the entry point |
| `dragons_hoard` | **CORE** | 10 MCP queries — easily done in 2 sessions |
| `keeper_of_law` | **CORE** | Update cncf-community skill once — direct and clear |
| `thousand_voices` | **CORE** | All three sites in one session — reasonable for active work |
| `community_herald` | bonus | Governance PR — specific and rare |
| `wishing_wall` | bonus | blueprint-mode + cncf-dev same session — complex |
| `riven_silent` | bonus | Long-standing bug — time-gated |

**New proposal:** require `voice_thousand_commits` + `dragons_hoard` + `keeper_of_law` + `thousand_voices`.

---

### WAYFARER (veteran, 6 → 4 required)

**Current required:** `wayfarer_three_families`, `wayfarer_knowledge_loop`, `wayfarer_blueprint_three_types`, `wayfarer_cross_repo`, `wayfarer_new_skill`, `wayfarer_multi_domain`

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `wayfarer_knowledge_loop` | **CORE** | Complete one knowledge loop — foundational |
| `wayfarer_new_skill` | **CORE** | Create one skill — clear and valuable |
| `wayfarer_cross_repo` | **CORE** | Work across repos — typical session pattern |
| `wayfarer_multi_domain` | **CORE** | 3 skill families in one session — demanding but achievable |
| `wayfarer_three_families` | bonus | Three distinct families used — tracked over time |
| `wayfarer_blueprint_three_types` | bonus | Three different blueprint types — complex gate |

**New proposal:** require `wayfarer_knowledge_loop` + `wayfarer_new_skill` + `wayfarer_cross_repo` + `wayfarer_multi_domain`.

---

### HARBINGER (veteran, 5 → 3 required)

**Current required:** `harbinger_first_skill`, `harbinger_first_pr`, `harbinger_custom_agent`, `harbinger_first_use_case`, `harbinger_agents_md`

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `harbinger_first_skill` | **CORE** | First skill created — the entry point |
| `harbinger_first_pr` | **CORE** | First merged PR — fundamental |
| `harbinger_agents_md` | **CORE** | AGENTS.md is the control plane — update it once |
| `harbinger_custom_agent` | bonus | Custom agent requires significant design work |
| `harbinger_first_use_case` | bonus | Documenting a use case — optional enrichment |

**New proposal:** require `harbinger_first_skill` + `harbinger_first_pr` + `harbinger_agents_md`.

---

### WARDEN (veteran, 7 → 4 required)

**Current required:** `first_responder`, `blameless_record`, `five_whys_deep`, `runbook_authored`, `runbook_executed`, `runbook_updated_after_incident`, `toil_eliminated`

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `first_responder` | **CORE** | First incident response — entry point |
| `blameless_record` | **CORE** | One blameless retro — foundational SRE practice |
| `runbook_authored` | **CORE** | Write one runbook — concrete, actionable |
| `toil_eliminated` | **CORE** | Remove one toil item — clear and valuable |
| `five_whys_deep` | bonus | Full 5-whys analysis — requires real incident |
| `runbook_executed` | bonus | Following a runbook under pressure — situational |
| `runbook_updated_after_incident` | bonus | Post-incident update — sequential dependency |

**New proposal:** require `first_responder` + `blameless_record` + `runbook_authored` + `toil_eliminated`.

---

### SPIREKEEPER (veteran, 7 → 4 required)

**Current required:** `golden_signals_instrumented`, `trace_the_path`, `alert_not_noise`, `dashboard_created`, `slo_defined`, `error_budget_decision`, `observability_gap_fixed`

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `golden_signals_instrumented` | **CORE** | Instrument one service — entry point |
| `dashboard_created` | **CORE** | One dashboard created — concrete deliverable |
| `slo_defined` | **CORE** | Define one SLO — foundational |
| `alert_not_noise` | **CORE** | One meaningful alert — directly actionable |
| `trace_the_path` | bonus | Full distributed trace — infrastructure required |
| `error_budget_decision` | bonus | Error budget decision — requires data over time |
| `observability_gap_fixed` | bonus | Gap closure — requires prior gap inventory |

**New proposal:** require `golden_signals_instrumented` + `dashboard_created` + `slo_defined` + `alert_not_noise`.

---

### PATHFINDER (veteran, 7 → 4 required)

**Current required:** `first_adr_written`, `adr_referenced_in_pr`, `adr_superseded`, `first_substantive_review`, `blueprint_before_pr`, `design_review_first`, `review_turnaround`

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `first_adr_written` | **CORE** | Write one ADR — entry point for architectural thinking |
| `blueprint_before_pr` | **CORE** | Run blueprint-mode before one PR — core habit |
| `first_substantive_review` | **CORE** | Give one real review — achievable immediately |
| `design_review_first` | **CORE** | Design review before impl — the core discipline |
| `adr_referenced_in_pr` | bonus | ADR referenced in PR — dependent on prior ADR |
| `adr_superseded` | bonus | Superseding an ADR — requires history of ADRs |
| `review_turnaround` | bonus | Fast review turnaround — SLA tracking required |

**New proposal:** require `first_adr_written` + `blueprint_before_pr` + `first_substantive_review` + `design_review_first`.

---

### FLAWLESS (pinnacle, 6 → 5 required)

**Current required:** all 6 (`flawless_red_before_green`, `minimal_passing`, `refactor_holds`, `full_cycle`, `no_regressions`, `perfect_run`)

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `flawless_red_before_green` | **CORE** | 5 red-before-green tasks — the habit |
| `minimal_passing` | **CORE** | Minimal implementation approved by refactor — precision |
| `refactor_holds` | **CORE** | Refactor with no regressions — the full clean |
| `full_cycle` | **CORE** | Red→green→refactor in one session — the complete act |
| `no_regressions` | **CORE** | qa finds nothing — the final seal |
| `perfect_run` | bonus (secret) | Three perfect sessions — legendary, keep as gilding trigger |

**New proposal:** require all 5 non-secret triumphs. `perfect_run` unlocks gilding only.

---

### DREDGEN (pinnacle, 8 → 5 required)

**Current required:** all 8 (`shadows_gaze`, `worms_teeth`, `erianas_promise`, `second_truth`, `adversarial_mind`, `hand_of_darkness`, `fall_remembered`, `dredgens_burden`)

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `shadows_gaze` | **CORE** | Surface one real finding — the entry |
| `worms_teeth` | **CORE** | OWASP Top 10 finding and remediation — the soul of Dredgen |
| `fall_remembered` | **CORE** | Document one vulnerability/incident — knowledge preservation |
| `adversarial_mind` | **CORE** | qa overturns tdd-green — the adversarial loop |
| `erianas_promise` | **CORE** | 5 doublecheck runs — sustained practice |
| `second_truth` | bonus | `second-opinion` reversed a decision — situational |
| `hand_of_darkness` | bonus | Both agents same PR — high-effort |
| `dredgens_burden` | bonus | All 4 sentinel weapons at power — passive gate |

**New proposal:** require `shadows_gaze` + `worms_teeth` + `fall_remembered` + `adversarial_mind` + `erianas_promise`.

---

### QUEENSGUARD (pinnacle, 7 → 5 required)

**Current required:** all 7 (`throne_of_deep`, `taken_shore`, `court_of_blades`, `pale_heart_intact`, `silent_vanguard`, `queens_promise`, `undying_watch`)

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `throne_of_deep` | **CORE** | Full LTS workflow — the entry |
| `queens_promise` | **CORE** | Gate triggered + squash-merged — the ceremony |
| `pale_heart_intact` | **CORE** | No regressions to LTS users — the measure of success |
| `taken_shore` | **CORE** | linux-desktop issue resolved — cross-domain |
| `court_of_blades` | **CORE** | Local OTA test via zot — technical validation |
| `silent_vanguard` | bonus | cosign all variants — requires full matrix |
| `undying_watch` | bonus | Full season, all PRs gated — time-gated |

**New proposal:** require `throne_of_deep` + `queens_promise` + `pale_heart_intact` + `taken_shore` + `court_of_blades`.

---

### GILDED GHOST (pinnacle, 8 → 5 required)

**Current required:** all 8 (`ghosts_light`, `light_bearer`, `shell_upgrade`, `resurrection`, `pattern_encoded`, `travelers_gift`, `beyond_the_pale`, `ghost_remembers`)

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `ghosts_light` | **CORE** | Skill used 3+ sessions — the proof it matters |
| `shell_upgrade` | **CORE** | Trim a skill to target line count — routine maintenance |
| `resurrection` | **CORE** | Knowledge search prevents a repeated mistake — the loop working |
| `pattern_encoded` | **CORE** | Add one rule to AGENTS.md from real friction — direct |
| `light_bearer` | **CORE** | Create a custom agent for a real problem — advanced but clear |
| `travelers_gift` | bonus | Full agent audit (5+ issues) — major session investment |
| `beyond_the_pale` | bonus (secret) | 10 gilded seals — late-game achievement |
| `ghost_remembers` | bonus (secret) | Prior context spared substantial work — serendipitous |

**New proposal:** require `ghosts_light` + `shell_upgrade` + `resurrection` + `pattern_encoded` + `light_bearer`.

---

### CONQUEROR (pinnacle, 10 → 6 required)

**Current required:** all 10 seal completions + `pinnacle_reached` + `agent_of_every_order`

| Triumph | Proposed status | Reason |
|---------|----------------|--------|
| `seal_blacksmith` | **CORE** | Build mastery — foundational |
| `seal_chronicler` | **CORE** | Knowledge mastery — foundational |
| `seal_cursebreaker` | **CORE** | CI mastery — most achievable accessible seal |
| `seal_dredgen` | **CORE** | Security mastery — required discipline |
| `seal_flawless` | **CORE** | TDD mastery — the craft |
| `seal_rivensbane` | **CORE** | Community mastery — the mission |
| `seal_deadeye` | bonus | Distribution mastery — domain-specific |
| `seal_queensguard` | bonus | LTS mastery — domain-specific |
| `pinnacle_reached` | bonus | Power level 1800 — passive accumulation |
| `agent_of_every_order` | bonus | 5 agent types in one session — execution |

**New proposal:** require 6 seal completions from the core list. `pinnacle_reached` and `agent_of_every_order` contribute to gilding only.

---

## Section 3: Triumph Rewrite Candidates

The following triumphs have requirements that are either time-gated, infrastructure-dependent, or so specific they effectively never trigger. Flagged by: vague success criteria, multi-week tracking requirement, or external dependencies.

---

### 1. `curse_lifted` — THE CURSE LIFTED
**Current:** "Diagnose and resolve a CI failure that has been open for more than 48 hours"  
**Problem:** 48-hour time gate means you need to find an old failure. Luck-dependent, not skill-dependent.  
**Rewrite:** "Diagnose and resolve a CI failure where the root cause was non-obvious (required reading source code, checking dep versions, or reading CI logs across multiple runs) — document the diagnosis in a comment or knowledge entry."  
**Why:** Preserves the "hard debugging" intent without requiring a stale failure to exist.

---

### 2. `iron_in_fire` — IRON IN THE FIRE
**Current:** "Have 3 or more open PRs simultaneously across bluefin, aurora, or base repos — all CI green"  
**Problem:** Requires simultaneous state across repos — you need to manufacture the situation.  
**Rewrite:** "Open 3 PRs in a single week across any combination of castrojo/* repos, each passing CI on first push — timestamp evidence required."  
**Why:** Keeps the multi-PR energy but makes it achievable across a real working week.

---

### 3. `whispers_library` — WHISPER'S LIBRARY
**Current:** "Execute the complete knowledge loop 10 verified times across any sessions"  
**Problem:** "Verified" has no mechanism. 10 iterations requires session tracking over months.  
**Rewrite:** "In a single session, execute the full knowledge loop (recall → act → remember) at least 3 times — each iteration producing a distinct output (PR, file change, or knowledge entry). Document all three in a single session recap."  
**Why:** Same intent, completable in one focused session, clearly verifiable.

---

### 4. `stability_no_hotfix` — IMMUTABLE COVENANT
**Current:** "Complete a full season of platform work with zero hotfix commits"  
**Problem:** Season-length tracking, no clear audit mechanism, definition of "hotfix" is ambiguous.  
**Rewrite:** "Complete any 10-session stretch of platform work with zero direct pushes to protected branches and zero force pushes — verified by git log audit at session end."  
**Why:** 10 sessions is achievable within a season, force-push audit is concrete and automatable.

---

### 5. `stability_lts_gate` — GATED AND RELEASED
**Current:** "Complete a full bluefin-lts PR gate cycle from start to finish... squash-merge approved, merged without force pushes or manual interventions"  
**Problem:** Full gate cycle requires specific CI infrastructure to be live and correct. One CI glitch fails this.  
**Rewrite:** "Submit one PR to bluefin-lts that passes the create-lts-pr.yml gate check (draft PR auto-created) and is merged via squash without a force push — note the PR number as evidence."  
**Why:** Same ceremony, but a single successful PR is evidence enough.

---

### 6. `dredgens_burden` — DREDGEN'S BURDEN
**Current:** "All four SENTINEL weapons — 2nd-opinion, se-security, doublecheck, and qa — reach or exceed 1,300 power level"  
**Problem:** `second-opinion` skill entry has been removed. Power levels are computed, not directly controlled. This is passive accumulation with a removed dependency.  
**Rewrite:** "In a single session, use all three active verification agents (se-security-reviewer, doublecheck, qa) on the same codebase or PR — each must produce at least one actionable finding."  
**Why:** Removes the deleted dependency, creates a focused single-session challenge.

---

### 7. `multiplatform` — THE WEAVE HOLDS
**Current:** "Successfully distribute software to users via 3 different mechanisms (brew, flatpak, OCI) in a single season"  
**Problem:** Requires three separate packaging efforts in one season — a massive time investment that requires three distinct packaging contexts to exist simultaneously.  
**Rewrite:** "Distribute the same piece of software via 2 distinct mechanisms (any combination of brew cask, brew formula, flatpak, OCI, COPR) — both must be independently pullable/installable. Season not required."  
**Why:** Two formats is still an impressive achievement; removing the season gate makes it about the act, not the calendar.

---

### 8. `unbroken_ci_green` — (UNBROKEN seal)
**Current (inferred):** 10 consecutive GitHub Actions runs pass on first attempt across all repos  
**Problem:** One flaky test in an unrelated repo breaks a 9-run streak. No mercy rule.  
**Rewrite:** "Achieve 5 consecutive first-attempt CI passes on PRs YOU authored — no re-runs initiated by you. Flaky infrastructure failures (rate limits, network) don't break the streak if documented."  
**Why:** Attribution matters. Your streak shouldn't break because someone else's upstream flaked.

---

### 9. `travelers_gift` — THE TRAVELER'S GIFT
**Current:** "Complete a full agent audit — audit phase (4 parallel agents) + fix phase (5+ parallel swe-subagents) — identifying and resolving 5+ actionable issues"  
**Problem:** Requires 4+5 = 9 parallel agents in one session. Context budget for most models maxes out around 4-6 parallel dispatches. This is physically difficult to complete cleanly.  
**Rewrite:** "Complete one full audit cycle — at minimum 2 parallel review agents + 2 parallel fix agents — identifying and documenting at minimum 3 actionable issues, with all critical-severity findings resolved in the same session."  
**Why:** Same structure (audit → fix in parallel), scaled to what's actually executable.

---

### 10. `unbroken_blueprint_gate` — (UNBROKEN seal)
**Current (inferred):** Use blueprint-mode for 5 consecutive features without skipping any planning gate  
**Problem:** Requires tracking across sessions. No mechanism to verify "consecutive."  
**Rewrite:** "Use blueprint-mode to plan and ship 3 features in a single season — each must have a blueprint document committed to the repo before any implementation PR is opened. Link all three in a REBALANCE comment."  
**Why:** 3 features with committed blueprint documents is verifiable by git history.

---

### 11. `full_cycle` (FLAWLESS) — PRAXIS COMPLETE
**Current:** "Complete red → green → refactor TDD cycle using all three agents — delivered in a single session"  
**Problem:** Three full agent invocations in sequence in one session strains context budget for complex features.  
**Rewrite:** "Complete one red → green → refactor cycle where: (a) tdd-red's test suite fails before implementation exists, (b) tdd-green makes all tests pass with no other changes, (c) tdd-refactor confirms no structural changes needed. Document all three phase outputs as evidence."  
**Why:** Same three-phase requirement, but now emphasizes evidence over timing. Session boundary becomes irrelevant.

---

### 12. `iron_lords_memory` — IRON LORD'S MEMORY (seasonal)
**Current:** "Complete the IRON LORD seasonal seal during the founding season"  
**Problem:** Founding season is past. This triumph is permanently unclearable by any new Guardian.  
**Rewrite:** Keep as earned for founding-season completion, but add a reprint: "IRON LORD'S MEMORY II — complete any seasonal seal during the season it is active."  
**Why:** Preserves historical significance while opening the pattern to future seasonal cycles.

---

## Section 4: New Easy Triumphs (gap fillers)

These triumphs sit between "zero" and the first hard wall. They're achievable in normal daily workflow with no special setup, and they create a dopamine loop that encourages Guardian engagement.

---

### CURSEBREAKER — New easy triumphs

| ID | Name | Description | Points |
|----|------|-------------|--------|
| `cb_first_skill_load` | SIGNAL ACQUIRED | Load the workflow skill correctly at the start of a session — first call, before any implementation | 10 |
| `cb_memory_first` | GHOST WOKE FIRST | Begin a session with a `recall()` call that returns at least one result you actually use | 10 |
| `cb_push_no_fix` | CLEAN MERGE | Push a PR where no follow-up "fix: typo" or "fix: lint" commits are needed | 25 |
| `cb_ci_read_before_fix` | READ THE LOG | Before touching code on a CI failure, paste or quote the exact error line from the logs | 10 |
| `cb_scope_declared` | SCOPE OR SILENCE | Declare SCOPE / GOAL / OUT OF SCOPE before touching any file in a session | 10 |

---

### CHRONICLER — New easy triumphs

| ID | Name | Description | Points |
|----|------|-------------|--------|
| `chr_first_remember` | THE INSCRIPTION | Use `remember()` to save a session fact for the first time | 10 |
| `chr_used_recall` | THE ECHO | Use a `recall()` result to inform a decision (note the fact ID in a comment) | 10 |
| `chr_skill_md_read` | LIGHT CONSULTED | Load a skill file at the start of a task rather than inferring behavior from memory | 10 |
| `chr_session_summary` | AFTER ACTION | End a session with a written summary: what changed, why, and what's next | 15 |
| `chr_knowledge_tagged` | TAGGED AND FILED | Store a memory entry with both `tags` and `project` fields correctly populated | 10 |

---

### MASTERY — New easy triumphs

| ID | Name | Description | Points |
|----|------|-------------|--------|
| `mastery_skill_loaded` | THE TOOL IS READY | Load a domain skill (not workflow) before starting domain-specific work | 10 |
| `mastery_no_guessing` | SOURCE CONSULTED | Read a source file before claiming behavior — one tool call before any assertion | 10 |
| `mastery_pr_described` | THE BRIEF | Write a PR description that explains what changed, why, and what to review — not just a commit list | 15 |
| `mastery_review_accepted` | FEEDBACK ABSORBED | Receive code review feedback and implement at least one suggestion without arguing | 10 |
| `mastery_issue_linked` | THREAD CONNECTED | Open or close a PR that is linked to a tracking issue | 10 |

---

### VELOCITY — New easy triumphs

| ID | Name | Description | Points |
|----|------|-------------|--------|
| `vel_plan_before_code` | MAP BEFORE MARCH | Write a 3-line plan (what, how, done-criteria) before writing any code | 10 |
| `vel_agent_dispatched` | FIRST DEPLOYMENT | Dispatch your first subagent to do real work (not exploration) | 15 |
| `vel_tools_listed` | LOADOUT CHECKED | Run `just --list` or check available tools at the start of a session in a repo with a Justfile | 10 |
| `vel_worktree_used` | BRANCH ISOLATED | Use `git worktree add` to isolate feature work at least once | 15 |
| `vel_tests_first` | RED LIGHT | Write at least one failing test before writing any implementation in a session | 15 |

---

### DISTRIBUTION — New easy triumphs

| ID | Name | Description | Points |
|----|------|-------------|--------|
| `dist_formula_validated` | BREW CHECK | Run `brew style` or `brew audit` on a formula/cask before submitting | 10 |
| `dist_appstream_run` | VALIDATOR LOADED | Run `appstreamcli validate` on a metainfo file, even if warnings exist | 10 |
| `dist_oci_pulled` | IMAGE CONFIRMED | Pull an OCI image you pushed and verify it runs in a container | 15 |
| `dist_livecheck_works` | CURRENT CONFIRMED | Add a `livecheck` block that returns the correct version when run | 15 |
| `dist_first_cask` | THE FIRST BOTTLE | Submit your first Homebrew cask or formula to any tap | 25 |

---

### STABILITY — New easy triumphs

| ID | Name | Description | Points |
|----|------|-------------|--------|
| `stab_build_attempted` | FORGE LIT | Attempt a local Bluefin OCI image build using the bluefin-build skill | 10 |
| `stab_lts_skill_loaded` | QUEEN'S BRIEFING | Load the bluefin-lts skill before making any change to the LTS branch | 10 |
| `stab_no_direct_push` | GATE RESPECTED | Submit a change via PR rather than direct push to a protected branch | 10 |
| `stab_cosign_verified` | SEAL CHECKED | Run cosign verify on any image you reference in a PR | 15 |
| `stab_variant_listed` | KNOW YOUR FRAMES | Use the bluefin-variants skill to look up a variant before making variant-specific changes | 10 |

---

*End of REBALANCE.md*

Assisted-by: Claude claude-sonnet-4-5 via pi
