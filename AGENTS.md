# castrojo/powerlevel — AGENTS.md

Destiny 2-themed GitHub Copilot stats website. Go + Astro monorepo.

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
- `just` or `just pl` — run terminal dashboard
- `just install` — install `pl` binary to ~/.local/bin/
- `just export` — regenerate src/data/powerlevel.json from data/
- `just dev` — start Astro dev server
- `just test-go` — Go unit tests
- `just test-e2e` — Playwright E2E

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
