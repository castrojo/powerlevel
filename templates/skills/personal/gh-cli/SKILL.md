---
name: gh-cli
description: GitHub CLI focused reference for PR, issue, release, and API operations used in this workflow. For the full reference manual, see https://cli.github.com/manual/
---

# GitHub CLI (gh) — Focused Reference

## Auth Check

```bash
gh auth status
gh auth token           # print current token
```

## Pull Requests

```bash
# Create (ALWAYS use --web for upstream PRs — user submits manually)
gh pr create --web
gh pr create --title "title" --body "body" --base main   # origin PRs only

# View / list
gh pr list
gh pr view [<number>]
gh pr view --web

# Checks
gh pr checks [<number>]

# Merge (origin PRs only — never merge upstream PRs without --web create)
gh pr merge [<number>] --squash --delete-branch

# Review
gh pr review [<number>] --approve
gh pr review [<number>] --request-changes --body "..."

# Update branch
gh pr update-branch [<number>]
```

## Issues

```bash
gh issue list
gh issue list --label bug --state open
gh issue view <number>
gh issue create --title "title" --body "body"
gh issue close <number>
gh issue comment <number> --body "comment"
```

## Labels

```bash
# List labels (with color + description)
gh label list -R <owner>/<repo>
gh label list -R <owner>/<repo> --json name,color,description \
  | jq '.[] | [.name, .color, .description] | @tsv' -r | sort

# Create a label
gh label create "kind/example" --color "a6e3a1" --description "..." -R <owner>/<repo>

# Edit a label (rename, recolor, or both)
gh label edit "kind/example" --color "a6e3a1" -R <owner>/<repo>
gh label edit "old-name" --name "new-name" --color "a6e3a1" -R <owner>/<repo>

# Delete a label
gh label delete "label-name" -R <owner>/<repo> --confirm

# Clone label set from one repo to another (overwrites)
gh label clone <source-owner>/<source-repo> -R <dest-owner>/<dest-repo> --force
```

### Bluefin Label Enforcement

**Canonical schema lives in `projectbluefin/common`. Sync these four repos only — no others:**
- `projectbluefin/common` (canonical)
- `projectbluefin/dakota` (formerly distroless)
- `ublue-os/bluefin`
- `ublue-os/bluefin-lts`

**Hard rules:**
- NEVER edit issues — only labels
- Colors must match `projectbluefin/common` exactly
- Full schema + known drift inventory: `~/.config/opencode/plans/common/project-notes.md`

```bash
# Audit drift: compare label colors between common and a downstream repo
diff \
  <(gh label list -R projectbluefin/common --json name,color | jq -r '.[] | "\(.name) \(.color)"' | sort) \
  <(gh label list -R ublue-os/bluefin --json name,color | jq -r '.[] | "\(.name) \(.color)"' | sort)

# Sync a specific label to all four repos
for repo in projectbluefin/dakota ublue-os/bluefin ublue-os/bluefin-lts; do
  gh label edit "area/buildstream" --color "0066FF" -R "$repo"
done

# Add a missing label to downstream repos
for repo in projectbluefin/dakota ublue-os/bluefin ublue-os/bluefin-lts; do
  gh label create "kind/translation" --color "8B5CF6" \
    --description "Translation and localization work (i18n/l10n)" \
    -R "$repo" 2>/dev/null || \
  gh label edit "kind/translation" --color "8B5CF6" \
    --description "Translation and localization work (i18n/l10n)" \
    -R "$repo"
done
```

## Releases

```bash
gh release list
gh release view <tag>
gh release create <tag> --title "title" --notes "notes"
gh release create <tag> --generate-notes
```

## Repos

```bash
gh repo view                    # current repo
gh repo view --web              # open in browser
gh repo fork <org>/<repo> --clone=false   # fork without cloning
gh repo clone <org>/<repo>
```

## Raw API

```bash
# GET
gh api repos/{owner}/{repo}/pulls

# POST
gh api repos/{owner}/{repo}/issues --method POST \
  --field title="Bug report" --field body="..."

# Paginate
gh api --paginate repos/{owner}/{repo}/issues

# With jq
gh api repos/{owner}/{repo}/pulls --jq '.[].title'

# PR comments
gh api repos/{owner}/{repo}/pulls/<number>/comments
```

## Workflow / Actions

```bash
gh run list
gh run view <run-id>
gh run watch <run-id>
gh workflow list
gh workflow run <workflow-name>
```

## Environment / Auth

```bash
gh auth login
gh auth login --git-protocol ssh
gh auth logout
gh auth refresh --scopes write:org
```

## Useful Flags

| Flag | Usage |
|---|---|
| `--json <fields>` | Output specific fields as JSON |
| `--jq <expr>` | Filter JSON output |
| `--paginate` | Fetch all pages |
| `--web` | Open in browser |
| `-R <owner>/<repo>` | Target a specific repo |

## Full Reference

For complete documentation: https://cli.github.com/manual/
