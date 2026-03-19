# castrojo/powerlevel — Justfile

# Default: run the terminal dashboard
default:
    go run ./cmd/pl/

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

# Export sanitized JSON for website
export:
    go run ./cmd/exporter/
    @echo "✓ src/data/powerlevel.json updated"

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

# Update weapon levels (opens data file, then exports)
level-up:
    $EDITOR data/powerlevel-data.json
    just export
    @echo "✓ Levels updated and exported"

# Full deploy: export + build + push
deploy: export build-site
    git add -A
    git commit -m "chore: deploy $(date -u +%Y-%m-%d)"
    git push
    @echo "✓ Deployed"

# Show current PL
pl:
    go run ./cmd/pl/
