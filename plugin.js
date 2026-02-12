import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = join(__dirname, 'projects');

// ── Inline helpers ────────────────────────────────────────────

const RANKS = [
  { min: 0, title: 'Kinderguardian' },
  { min: 1, title: 'Guardian' },
  { min: 3, title: 'Brave' },
  { min: 5, title: 'Heroic' },
  { min: 8, title: 'Legend' },
  { min: 12, title: 'Mythic' },
];

function getRank(score) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (score >= RANKS[i].min) return RANKS[i].title;
  }
  return RANKS[0].title;
}

function loadProjects() {
  if (!existsSync(PROJECTS_DIR)) return [];
  return readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'example-project')
    .map(d => {
      const configPath = join(PROJECTS_DIR, d.name, 'config.json');
      if (!existsSync(configPath)) return null;
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        return { name: d.name, ...config };
      } catch { return null; }
    })
    .filter(Boolean);
}

function detectProject(cwd, projects) {
  let best = null;
  let bestLen = 0;
  for (const p of projects) {
    const repoName = p.repo?.split('/')[1];
    if (repoName && cwd.includes(repoName) && repoName.length > bestLen) {
      best = p;
      bestLen = repoName.length;
    }
  }
  return best;
}

async function gh(...args) {
  try {
    const { stdout } = await execFileAsync('gh', args, { timeout: 15000 });
    return stdout.trim();
  } catch { return null; }
}

async function git(cwd, ...args) {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: 10000 });
    return stdout.trim();
  } catch { return null; }
}

// ── Powerlevel repo sync ──────────────────────────────────────

async function pullPowerlevelRepo() {
  await git(__dirname, 'pull', '--ff-only', '--quiet');
}

async function pushPowerlevelRepo() {
  const status = await git(__dirname, 'status', '--porcelain');
  if (!status) return false;
  await git(__dirname, 'add', '-A');
  await git(__dirname, 'commit', '-m', 'sync: auto-commit powerlevel changes');
  await git(__dirname, 'push', '--quiet');
  return true;
}

// ── Idle sync: close issues from commits ──────────────────────

async function closeCompletedIssues(cwd) {
  const log = await git(cwd, 'log', '--oneline', '-20', '--format=%s');
  if (!log) return [];
  const closed = [];
  for (const line of log.split('\n')) {
    const matches = line.matchAll(/(?:closes?|fixes?|resolves?)\s+#(\d+)/gi);
    for (const m of matches) closed.push(m[1]);
  }
  const unique = [...new Set(closed)];
  const remote = await git(cwd, 'remote', 'get-url', 'origin');
  if (!remote) return [];
  const repoMatch = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!repoMatch) return [];
  const repo = repoMatch[1];
  for (const num of unique) {
    await gh('issue', 'close', num, '--repo', repo);
  }
  return unique;
}

// ── Plugin export ─────────────────────────────────────────────

export default async function PowerlevelPlugin({ client, directory }) {
  // Pull latest from remote (async, non-blocking, best-effort)
  pullPowerlevelRepo().catch(() => {});

  const projects = loadProjects();
  const activeCount = projects.filter(p => p.active !== false).length;
  const rank = getRank(activeCount);
  const powerlevelMsg = `Powerlevel ${activeCount} ~ ${rank}`;
  const currentProject = detectProject(directory, projects);

  return {
    event: async ({ event }) => {
      if (event.type === 'server.connected') {
        client.tui.showToast({
          body: { message: powerlevelMsg, variant: 'success' },
        });
      }
    },

    'session.idle': async () => {
      await pushPowerlevelRepo();
      await closeCompletedIssues(directory);
    },

    'experimental.chat.system.transform': (input) => {
      if (!currentProject) return input;
      const lines = [];

      if (currentProject.upstream) {
        lines.push(
          `## PR SAFETY — MANDATORY RULES`,
          ``,
          `**Current project:** ${currentProject.repo} (fork of ${currentProject.upstream})`,
          ``,
          `You MUST follow these rules for ALL pull request operations:`,
          ``,
          `1. **NEVER run \`gh pr create\` targeting ${currentProject.upstream}.** All PRs go to ${currentProject.repo}.`,
          `2. **ALWAYS use the \`question\` tool** to confirm with the user before ANY PR operation. Show them the exact target repo and let them choose.`,
          `3. **When the user says "open a PR"**, they mean "stage the PR by opening the browser for me to review." Use \`gh pr create --web\` or the \`finishing-a-development-branch\` skill.`,
          `4. **For upstream submissions**, the user must EXPLICITLY say "submit upstream" or "upstream PR." Use the \`preparing-upstream-pr\` skill which opens a browser for manual submission.`,
          `5. **ALWAYS pass \`--repo ${currentProject.repo}\`** when running \`gh pr create\` to prevent GitHub CLI from defaulting to the upstream parent.`,
          ``,
          `Violating these rules is unacceptable. When in doubt, ask the user.`,
          ``,
        );
      } else {
        lines.push(
          `## PR Context`,
          ``,
          `**Current project:** ${currentProject.repo} (standalone — not a fork)`,
          `PRs go to origin (${currentProject.repo}). Use the \`question\` tool to confirm target before creating PRs.`,
          `When the user says "open a PR", they mean "stage the PR by opening the browser." Use \`--web\` flag.`,
          ``,
        );
      }

      return {
        ...input,
        system: lines.join('\n') + '\n\n' + (input.system || ''),
      };
    },
  };
}
