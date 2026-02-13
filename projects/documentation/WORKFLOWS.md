# Bluefin Documentation Workflows

This document describes the key workflows and processes for the `projectbluefin/documentation` repository.

## Repository Architecture

### Single-Branch Model

- **`main`** - Production branch (deploys to https://docs.projectbluefin.io/)
  - All PRs merge directly to main
  - Automatic deployment via GitHub Pages on push
  - No staging environment (development server used for testing)

### Technology Stack

- **Framework**: Docusaurus 3.8.1 (TypeScript)
- **Package Manager**: npm (local development), bun (CI/CD)
- **React**: Version 19.x
- **Node.js**: Version 18+ required
- **Deployment**: GitHub Pages (automatic)

## Build System

### Critical Timing Requirements

**NEVER CANCEL BUILD COMMANDS** - Set explicit timeouts:

- `npm install`: 60 seconds (set 120+ second timeout)
  - Use `npm install --legacy-peer-deps` if React peer dependency conflicts occur
- `npm run build`: 7-15 seconds (set 60+ second timeout)
  - Includes automatic data fetching: release feeds, YouTube playlists, GitHub profiles
- `npm run typecheck`: 2 seconds (set 30+ second timeout)
  - Some TypeScript errors may be tolerated by the build process
- `npm run prettier-lint`: 3 seconds (set 30+ second timeout)
  - Many warnings expected on existing files - this is normal

### Development Commands

All commands run from repository root:

```bash
# Install dependencies (NEVER CANCEL - 60s runtime)
npm install
# If peer dependency conflicts occur:
npm install --legacy-peer-deps

# Start development server (includes data fetching)
npm run start

# Build production site (includes data fetching)
npm run build

# Serve built site locally
npm run serve

# Validate TypeScript
npm run typecheck

# Check formatting (warnings expected)
npm run prettier-lint

# Fix formatting
npm run prettier

# Fetch all data manually
npm run fetch-data
# Or individual sources:
npm run fetch-feeds              # Release feeds from GitHub
npm run fetch-playlists          # YouTube playlist metadata
npm run fetch-github-profiles    # GitHub profiles for donations page
```

### Docker Development

Alternative containerized development:

```bash
# Start containerized dev server (NEVER CANCEL)
docker compose up

# Stop server
docker compose down
```

## Development Server Management

### Reliable Server Operation

**Use detached mode for persistent development server:**

```bash
# Stop any existing server
pkill -f docusaurus && sleep 2

# Start detached server
npx docusaurus start --host 0.0.0.0 --no-open
# (use mode: "detached" with sessionId: "docusaurus-detached")
```

**Verify server started:**

```bash
sleep 35 && curl -s http://localhost:3000/ | grep '<title>'
ps aux | grep docusaurus | grep -v grep
ss -tlnp | grep :3000
```

**Stop server:**

```bash
pkill -f docusaurus
```

### Why Detached Mode

- Process runs with `setsid` (detaches from terminal)
- Survives shell session termination
- Designed for long-running services
- Cannot be stopped with `stop_bash` - use `pkill` instead

### Best Practices from Docusaurus

- **Development**: Use `docusaurus start` for live preview with hot-reload
- **Production testing**: Use `npm run build && npm run serve` for static files
- **Never use dev server in production** - always serve static build
- **CI/CD**: Build static files and deploy to CDN/static hosting

## Content Structure

### Documentation Files

- **Documentation**: 28 files in `docs/` directory (Markdown/MDX)
- **Blog Posts**: 21 files in `blog/` directory
  - Author metadata in `blog/authors.yaml`
  - Format includes: name, page, title, url, image_url, and optional socials
  - Socials: bluesky, mastodon, github, linkedin, youtube, blog
- **Changelogs**: Manual welcome content in `changelogs/` directory
  - Displayed alongside auto-generated release feeds
  - Author metadata in `changelogs/authors.yaml`
- **Static Assets**: Images and files in `static/` directory

### Auto-Generated Data

JSON files generated at build time via `npm run fetch-data`:

- `static/feeds/bluefin-releases.json` - ublue-os/bluefin releases (stable, gts tags)
- `static/feeds/bluefin-lts-releases.json` - ublue-os/bluefin-lts releases (lts tag)
- `static/data/playlist-metadata.json` - YouTube playlist metadata for music page
- `static/data/github-profiles.json` - GitHub user profiles for donations page

### React Components

- **FeedItems**: Displays changelog entries from release feeds
- **PackageSummary**: Shows current versions of tracked packages
- **CommunityFeeds**: Community content aggregation
- **MusicPlaylist**: YouTube playlist display with metadata
- **GitHubProfileCard**: Displays GitHub profiles with social links

### Configuration Files

- `docusaurus.config.ts` - Main Docusaurus configuration
- `sidebars.ts` - Navigation structure (TypeScript)
- `package.json` - Dependencies and scripts
- `Justfile` - Just command runner recipes
- `src/config/packageConfig.ts` - Package tracking configuration

## Changelog Package Tracking

Centrally managed in `src/config/packageConfig.ts` for consistency.

### Tracked Packages

- Kernel (main and HWE variants)
- GNOME
- Mesa
- Podman
- NVIDIA
- Docker
- systemd
- bootc

### Adding a New Package

Edit `src/config/packageConfig.ts` and add to `PACKAGE_PATTERNS` array:

```typescript
{
  name: "PackageName",
  pattern: /regex to extract version/,
  changePattern?: /optional regex for transitions/,
}
```

### Pattern Types

**Standard format**: `<td><strong>PackageName</strong></td><td>version</td>`

```typescript
pattern: /<td><strong>Docker<\/strong><\/td>\s*<td>([^<]+)/;
```

**"All Images" format**: `<td>🔄</td><td>packagename</td><td>oldversion</td><td>newversion</td>`

```typescript
pattern: /<td>🔄<\/td>\s*<td>packagename<\/td>\s*<td>[^<]*<\/td>\s*<td>([^<]+)/,
changePattern: /<td>🔄<\/td>\s*<td>packagename<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)/,
```

## Validation Workflow

**Always run before committing:**

1. **TypeScript validation**:

   ```bash
   npm run typecheck
   ```

2. **Code formatting**:

   ```bash
   npm run prettier-lint
   # Fix issues:
   npm run prettier
   ```

3. **Build test**:

   ```bash
   npm run build
   ```

4. **Manual validation** (REQUIRED):

   ```bash
   npm run start
   # Navigate to changed pages in browser
   # Verify content renders correctly
   # Test navigation and links
   # Check changelog cards if modified
   ```

5. **Production test**:
   ```bash
   npm run serve
   # Verify static site works correctly
   ```

## Content Guidelines

### Writing Style

- Avoid terms like "simply" or "easy" (see justsimply.dev)
- Use imperative tone: "Run this command", "Do not do this"
- Include clear, tested examples
- Link to upstream documentation when appropriate
- Document should be consumable in one sitting

### File Organization

- Use `.md` or `.mdx` extensions
- Place images in `static/img/` directory
- Reference images: `/img/filename.ext`
- Use descriptive filenames

### Blog Posts

- Issues labeled with `blog` generate blog posts
- Add author info to `blog/authors.yaml`
- Use appropriate tags for categorization

### Documentation Philosophy

- **Link to upstream docs** rather than duplicating content
- **Never create new pages** unless explicitly told to do so
- **Images page removed** (commit 52e6fee) - do not recreate

## Deployment

### GitHub Pages

- **Trigger**: Push to `main` branch
- **URL**: https://docs.projectbluefin.io/
- **Process**: Automatic via GitHub Actions
- **Build time**: ~7-15 seconds (includes data fetching)

### CI/CD

- Uses `bun` as package manager in pipeline
- Builds static files for deployment
- No manual deployment needed

## Common Issues

### Build Timeouts

Builds can take 7-15+ seconds due to data fetching (feeds, playlists, profiles). Always:

- Set generous timeouts (60+ seconds)
- Never cancel build commands

### Dependency Conflicts

If `npm install` fails:

```bash
npm install --legacy-peer-deps
```

### Formatting Warnings

`npm run prettier-lint` shows many warnings for existing files - **this is normal**

### TypeScript Errors

Some TypeScript errors in components may be tolerated by build process

### Missing Dependencies

If build fails:

```bash
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Port Conflicts

Development server uses port 3000 by default

### Data Fetching Failures

Check network connectivity to:

- GitHub API (for release feeds and profiles)
- YouTube API (for playlist metadata)
- Set `GITHUB_TOKEN` or `GH_TOKEN` to increase rate limits

## Key Documentation Areas

- Installation guides: `docs/installation.md`, `docs/downloads.md`
- Developer experience: `docs/bluefin-dx.md`, `docs/bluefin-gdx.md`, `docs/devcontainers.md`
- FAQ: `docs/FAQ.md`
- Hardware guides: `docs/t2-mac.md`
- Community: `docs/communication.md`, `docs/code-of-conduct.md`, `docs/values.md`
- Gaming: `docs/gaming.md`
- LTS information: `docs/lts.md`
- Music playlists: `docs/music.md` (uses MusicPlaylist component)
- Donations: `docs/donations.mdx` (uses GitHubProfileCard component)

## Attribution Requirements

AI agents must disclose tool and model in commit footer:

```text
Assisted-by: [Model Name] via [Tool Name]
```

Example:

```text
Assisted-by: Claude Sonnet 4.5 via OpenCode
```

## Recovery Steps

If problems occur:

1. Clear build cache: `npm run clear`
2. Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install --legacy-peer-deps`
3. Check TypeScript: `npm run typecheck`
4. Verify formatting: `npm run prettier-lint`
5. Test data fetching: `npm run fetch-data`

## Repository Context

- **Main repo**: https://github.com/projectbluefin/documentation
- **Bluefin OS images**: https://github.com/ublue-os/bluefin
- **Bluefin LTS images**: https://github.com/ublue-os/bluefin-lts
- **Deployed site**: https://docs.projectbluefin.io/
- **Commit convention**: Conventional Commits spec (conventional-commits/conventionalcommits.org)
