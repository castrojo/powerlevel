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
  return projects.find(p => {
    const repoName = p.repo?.split('/')[1];
    return repoName && cwd.includes(repoName);
  });
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
      const lines = [
        '<!-- Powerlevel Context -->',
        `<!-- Project: ${currentProject.repo}${currentProject.upstream ? ` | Upstream: ${currentProject.upstream}` : ''} -->`,
        currentProject.upstream
          ? '<!-- This is a fork. PRs go to upstream. Fork-only changes stay on origin/main. -->'
          : '<!-- This is a standalone repo. PRs go to origin. -->',
        '<!-- END Powerlevel Context -->',
      ];
      return {
        ...input,
        system: lines.join('\n') + '\n\n' + (input.system || ''),
      };
    },
  };
}
