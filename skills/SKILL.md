# powerlevel — Operational Knowledge

## Powerlevel

- **Weapon:** Trustee
- **Aspect:** KNOCKOUT
- **Dispatch name:** `KNOCKOUT · Trustee`
- **Level:** 5

## When to Use
Load this skill for any work in `castrojo/powerlevel` — Go CLI, Astro website, GHA compute/deploy pipelines, stats export.

## When NOT to Use
Not applicable — this is the repo-specific knowledge base.

---

## Structure

- `cmd/pl/` — Go CLI terminal dashboard (replaces powerlevel.py)
- `cmd/exporter/` — Go exporter: reads data/, writes src/data/powerlevel.json
- `internal/data/` — data model, loader, PL formula, stat scaling
- `internal/renderer/` — terminal ANSI output, bars, side-by-side columns
- `internal/exporter/` — sanitized JSON export for website
- `data/` — source of truth JSON (edit these manually to level up)
- `src/` — Astro 5 website (castrojo.github.io/powerlevel)
- `tests/` — Playwright E2E

## Key commands

- `just` or `just pl` — run terminal dashboard (local dev only)
- `just install` — install `pl` binary to ~/.local/bin/
- `just export` — regenerate src/data/powerlevel.json from data/
- `just dev` — start Astro dev server
- `just test-go` — Go unit tests
- `just test-e2e` — Playwright E2E

## Session start display

Agents should display current Powerlevel at session start using the static reader:

```bash
python3 -c "
import json, os
path = os.path.expanduser('~/src/powerlevel/data/powerlevel-data.json')
try:
    d = json.load(open(path))
    weapons = d.get('weapons', {})
    pl = int(sum(w['level'] for w in weapons.values()) / max(len(weapons), 1))
    print(f'🔆 ◆ {pl} · {d[\"season\"][\"name\"]}')
except Exception:
    print('🔆 ◆ -- (data unavailable)')
"
```

**Do NOT** run `just pl`, `go run ./cmd/pl/`, or any command that invokes the Go binary
for display purposes. The binary is for local development use only.
Computation happens in GitHub Actions — agents read pre-computed data.

## Leveling up (GHA-first design)

**All computation runs in GitHub Actions. Agents are data sources only.**

When a skill level increases, agents MUST update TWO files:

1. `Level:` field in `~/src/skills/<name>/SKILL.md` (copilot-config repo)
2. `~/src/powerlevel/data/skill-levels.json` — matching entry for the skill

Both must be committed. `skill-levels.json` is the machine-readable source that
`compute.yml` reads. Updating only SKILL.md will NOT update the powerlevel.

```bash
# After incrementing Level: in skills/X/SKILL.md:
cd ~/src && just sync          # commit copilot-config
# Then update powerlevel:
# edit ~/src/powerlevel/data/skill-levels.json — bump "skill-name": N
cd ~/src/powerlevel
git add data/skill-levels.json
git commit -m "feat: level up skill-name → N"
git push
# compute.yml triggers automatically on push to data/skill-levels.json
```

Use `just level-up` to open `skill-levels.json` in your editor for manual level edits.

## Stats refresh (local workflow)

### First-time setup

Create the optional global config for tools that need to locate the powerlevel repo:
```bash
mkdir -p ~/.config/powerlevel
echo '{"powerlevel_dir":"~/src/powerlevel"}' > ~/.config/powerlevel/config.json
```

`just export-stats` reads `~/.copilot/session-store.db` — a LOCAL file. GHA cannot access it.
Run locally at session end to keep stats current:

```bash
cd ~/src/powerlevel
just refresh   # = export-stats + build-site + commit + push
```

**Never annotate `just export-stats` as GHA-only.** It has always been a local command.
The GHA cache (`computed-<hash>`) stores computed weapon/triumph results between runs.
deploy.yml restores from cache before building.

### Multi-machine cumulative stats

`just export-stats` is **safe to run from any machine**. Stats are cumulative across machines.

`data/exported-sessions.json` (committed to git) is the session manifest. The exporter:
1. Loads manifest → skips already-counted session UUIDs
2. Computes **delta** from only new local sessions
3. **Adds** delta to committed baseline — never overwrites
4. Merges feed top-20 (deduplicated by session ID), accumulates model usage by line offset
5. Saves updated manifest

**Do NOT** edit `data/exported-sessions.json` manually.
**Do NOT** run `just export-stats` from two machines simultaneously — pull before you run.

## PL Formula

`PL = 100 + sum(all weapon levels) / 8`
Soft cap 250 (~3-4mo) · Hard cap 450 (~12-18mo) · Pinnacle 650 (~2-3yr)

## Subclass → Skill domain mapping

| Element  | Name         | Domain          | Super agents                          |
|----------|--------------|-----------------|---------------------------------------|
| Arc      | VELOCITY     | CI/CD, TDD      | blueprint-mode, tdd-red/green/refactor |
| Solar    | COMMUNITY    | OSS, knowledge  | principal-software-engineer            |
| Void     | MASTERY      | Skills, security| se-security-reviewer, swe-subagent    |
| Strand   | DISTRIBUTION | Packaging, GH   | github-actions-expert                 |
| Stasis   | STABILITY    | OCI, builds     | swe-subagent                          |

## GHA Race Condition — workflow_run Required

When the compute workflow commits derived artifacts (triumphs.json, seals.json),
the deploy workflow MUST trigger via `workflow_run`, NOT `on: push`. Push triggers
on the same files cause a race — deploy publishes stale data before compute finishes.

Also: cache keys MUST include the compute implementation file, not just input data files.
If inputs are unchanged but compute logic changed, a cache hit will skip the new binary.

Related: castrojo/copilot-config#79

## Batch Commits + cancel-in-progress Outage Pattern

With `concurrency: { cancel-in-progress: true }`: only the LAST commit's run survives.
12 commits in ~30 minutes = 11 cancelled runs. One surviving run hit cold-cache edge case.

Rules: batch related commits (max 3-4 per push), wait for CI green between groups for
interdependent changes. Or push all at once, then verify the FINAL run specifically.

Related: castrojo/copilot-config#79

## Superpowers skills

The canonical Superpowers skill set lives at [obra/superpowers](https://github.com/obra/superpowers).
The `castrojo/superpowers` fork contains personal customizations.
Contribute general-purpose skills upstream to `obra/superpowers`.
