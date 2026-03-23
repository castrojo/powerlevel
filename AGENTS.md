> ⛔ Never open upstream PRs. Full rules: `cat ~/src/skills/workflow/SKILL.md`

# castrojo/powerlevel

Destiny 2-themed GitHub Copilot stats website. Go + Astro monorepo.
Live: `https://castrojo.github.io/powerlevel/` | Branch: `main`

## Skills

```bash
cat skills/SKILL.md              # repo operational knowledge (leveling, stats, GHA race conditions)
cat ~/src/skills/powerlevel/SKILL.md    # same skill via global path
```

## Quick Start

```bash
just dev           # start Astro dev server
just test-go       # Go unit tests
just test-e2e      # Playwright E2E
just export        # regenerate src/data/powerlevel.json from data/
just refresh       # export-stats + build-site + commit + push (run locally at session end)
```

## Critical Rules

- **Read pre-computed data only** — never run `just pl` or the Go binary for display; read `data/powerlevel-data.json` directly
- **Two-file leveling** — always update BOTH `~/src/skills/<name>/SKILL.md` Level AND `data/skill-levels.json`
- **Stats are cumulative** — never run `just export-stats` from two machines simultaneously; pull first
- **GHA-first** — all computation runs in GitHub Actions; agents are data sources only

## Work Queue

```bash
gh issue list --repo castrojo/powerlevel --label copilot-ready --state open
gh issue list --repo castrojo/copilot-config --label copilot-ready --state open
```

## Session End

```bash
supermemory(mode="add", type="conversation", scope="project", content="[WHAT]...[WHY]...[FIX]...[NEXT]...")
```
