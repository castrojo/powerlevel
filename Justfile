# castrojo/powerlevel — Justfile

# Default: run the terminal dashboard
default:
    go run ./cmd/pl/

# First-time setup: create global config
setup:
    mkdir -p ~/.config/powerlevel
    @test -f ~/.config/powerlevel/config.json || echo '{"powerlevel_dir":"$(HOME)/src/powerlevel"}' > ~/.config/powerlevel/config.json
    @echo "✓ ~/.config/powerlevel/config.json ready"

# Build the binary
build:
    go build -o pl ./cmd/pl/

# Install to ~/.local/bin
install: build
    mkdir -p ~/.local/bin
    cp pl ~/.local/bin/pl
    @echo "✓ pl installed to ~/.local/bin/pl"
    @rm -f pl

# Run all Go tests
test-go:
    go test ./... -v

# Run the full dashboard (all subclasses)
all:
    go run ./cmd/pl/ --all

# Widget mode (single line for waybar/wtfutil)
widget:
    go run ./cmd/pl/ --widget

# JSON output
json:
    go run ./cmd/pl/ --json

# Start Astro dev server
dev:
    cd src && npm run dev

# Build the website
build-site:
    cd src && npm run build

# Preview the built site
preview:
    cd src && npm run preview

# Run Playwright E2E tests
test-e2e:
    cd src && npx playwright test

# Update visual regression snapshots
test-visual:
    cd src && npx playwright test --update-snapshots

# Run all tests
test-all: test-go test-e2e

# Lint
lint:
    golangci-lint run
    cd src && npx astro check

# Format
fmt:
    gofmt -w .
    cd src && npx prettier --write src/

# Update weapon levels manually — edit skill-levels.json (NOT powerlevel-data.json)
# Also update Level: in ~/src/skills/<name>/SKILL.md for each changed skill.
# Push triggers compute.yml which updates powerlevel-data.json automatically.
level-up:
    $EDITOR data/skill-levels.json
    @echo "✓ Levels updated — push to trigger compute pipeline"

# Show session streak stats
streak:
    go run ./cmd/streak/

# Export stats and feed from session_store — run LOCALLY before pushing.
# session-store.db is a local file, GHA cannot access it.
# Run this at the end of each session to keep stats current.
export-stats:
    go run ./cmd/exporter/ --data-dir data

# Refresh stats + site data from local session_store, then commit and push.
# Standard local refresh workflow — run at session end.
refresh: export-stats build-site
    git add data/ src/
    git commit -m "chore: refresh stats from session_store"
    git push
    @echo "✓ Stats refreshed and deployed"

# Full deploy: build + push (run just export-stats first if updating stats)
deploy: build-site
    git add -A
    git commit -m "chore: deploy $(date -u +%Y-%m-%d)"
    git push
    @echo "✓ Deployed"

# Generate profile card SVG
card:
    go run ./cmd/card/

# Show current PL
pl:
    go run ./cmd/pl/

# Lint GitHub Actions workflows with actionlint
lint-ci:
    actionlint .github/workflows/*.yml

# Run pipeline health audit locally (mirrors GHA audit.yml)
[script]
audit:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Powerlevel Pipeline Audit ==="
    python3 scripts/audit-local.py
    go build ./cmd/compute/ && echo "  cmd/compute: builds OK" || echo "  cmd/compute: BUILD FAILED"
    test ! -f scripts/compute.py && echo "  compute.py: correctly absent" || echo "  WARNING: compute.py still present"
    echo "=== Audit complete ==="
