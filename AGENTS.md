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

## Leveling up
Edit `data/powerlevel-data.json` — bump weapon levels based on criteria in plan.
Run `just export` then `just deploy`.

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
