# GitHub Tracker MVP Implementation Plan

**REQUIRED SUB-SKILL: Use superpowers:executing-plans**

## Frontmatter

### Goal
Create a minimal viable product (MVP) for GitHub Tracker that enables automatic epic creation from implementation plans with bidirectional linking between local plans and GitHub issues. The MVP focuses on the core workflow: detecting repository context, creating GitHub issues, and updating plan files with issue references.

### Architecture
- **Plugin System**: MCP server that exposes two main skills (`create-epic` and `land-the-plane`)
- **Core Libraries**: 
  - `repository-detector.ts`: Detects GitHub repository from git remote
  - `cache-manager.ts`: Manages cached repository information
  - `label-manager.ts`: Ensures required labels exist in repository
  - `github-cli.ts`: Wrapper around `gh` CLI commands
- **Skills**: 
  - `create-epic`: Reads plan file, creates GitHub issues for each task, updates plan with issue links
  - `land-the-plane`: Creates PR from implementation branch with epic context
- **Helper Scripts**: CLI tool for manual epic creation during development

### Tech Stack
- **Runtime**: Node.js with TypeScript
- **Package Manager**: npm
- **GitHub Integration**: GitHub CLI (`gh`) for all GitHub operations
- **MCP SDK**: `@modelcontextprotocol/sdk` for skill exposure
- **File System**: Node.js `fs/promises` for file operations
- **Configuration**: JSON files for cache storage

---

## Tasks

### Task 1: Project Setup and Structure

**Goal**: Set up the basic project structure, TypeScript configuration, and install dependencies.

**Files to create**:
- `package.json`
- `tsconfig.json`
- `src/index.ts` (empty placeholder)
- `.gitignore`
- `README.md`

**Steps**:

1. Initialize npm package:
```bash
npm init -y
```

2. Install dependencies:
```bash
npm install @modelcontextprotocol/sdk
npm install --save-dev typescript @types/node
```

3. Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

4. Update `package.json` with scripts and metadata:
```json
{
  "name": "github-tracker",
  "version": "0.1.0",
  "description": "MCP server for tracking implementation plans with GitHub issues",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["mcp", "github", "planning", "superpowers"],
  "author": "",
  "license": "MIT"
}
```

5. Create `.gitignore`:
```
node_modules/
dist/
*.log
.DS_Store
.opencode/cache/
```

6. Create `src/index.ts` placeholder:
```typescript
// GitHub Tracker MCP Server
// Entry point - to be implemented in Task 8
```

7. Create basic `README.md`:
```markdown
# GitHub Tracker

MCP server for tracking implementation plans with GitHub issues.

## Installation

```bash
npm install
npm run build
```

## Development

```bash
npm run dev
```
```

**Commit message**: `feat: initialize project structure with TypeScript and dependencies`

---

### Task 2: Repository Detector Library

**Goal**: Create a library that detects the GitHub repository from the current directory's git remote.

**Files to create**:
- `src/lib/repository-detector.ts`

**Steps**:

1. Create `src/lib/repository-detector.ts`:
```typescript
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface RepositoryInfo {
  owner: string;
  repo: string;
  remoteUrl: string;
}

export class RepositoryDetector {
  /**
   * Detects GitHub repository information from git remote
   * @param cwd Working directory (defaults to process.cwd())
   * @returns Repository information or null if not a git repo or no remote
   */
  static detect(cwd: string = process.cwd()): RepositoryInfo | null {
    try {
      // Check if we're in a git repository
      if (!this.isGitRepository(cwd)) {
        return null;
      }

      // Get the remote URL
      const remoteUrl = execSync('git remote get-url origin', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();

      // Parse GitHub owner and repo from remote URL
      const parsed = this.parseGitHubUrl(remoteUrl);
      if (!parsed) {
        return null;
      }

      return {
        owner: parsed.owner,
        repo: parsed.repo,
        remoteUrl
      };
    } catch (error) {
      // git command failed or no remote configured
      return null;
    }
  }

  /**
   * Check if directory is a git repository
   */
  private static isGitRepository(cwd: string): boolean {
    try {
      const gitDir = resolve(cwd, '.git');
      return existsSync(gitDir);
    } catch {
      return false;
    }
  }

  /**
   * Parse GitHub owner and repo from various URL formats
   * Supports: https://github.com/owner/repo.git, git@github.com:owner/repo.git
   */
  private static parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    // HTTPS format: https://github.com/owner/repo.git
    const httpsMatch = url.match(/https:\/\/github\.com\/([^\/]+)\/([^\/\.]+)(\.git)?$/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    // SSH format: git@github.com:owner/repo.git
    const sshMatch = url.match(/git@github\.com:([^\/]+)\/([^\/\.]+)(\.git)?$/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    return null;
  }
}
```

**Commit message**: `feat: add repository detector for extracting GitHub repo info from git remote`

---

### Task 3: Cache Manager Library

**Goal**: Create a library for caching repository information to avoid repeated git remote lookups.

**Files to create**:
- `src/lib/cache-manager.ts`

**Steps**:

1. Create `src/lib/cache-manager.ts`:
```typescript
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { RepositoryInfo } from './repository-detector.js';

export interface CacheData {
  repository: RepositoryInfo;
  lastUpdated: string;
}

export class CacheManager {
  private cachePath: string;

  constructor(projectRoot: string) {
    this.cachePath = join(projectRoot, '.opencode', 'cache', 'github-tracker.json');
  }

  /**
   * Read cached repository information
   */
  async read(): Promise<RepositoryInfo | null> {
    try {
      if (!existsSync(this.cachePath)) {
        return null;
      }

      const content = await readFile(this.cachePath, 'utf-8');
      const data: CacheData = JSON.parse(content);
      return data.repository;
    } catch (error) {
      // Cache file doesn't exist or is corrupt
      return null;
    }
  }

  /**
   * Write repository information to cache
   */
  async write(repository: RepositoryInfo): Promise<void> {
    const data: CacheData = {
      repository,
      lastUpdated: new Date().toISOString()
    };

    // Ensure cache directory exists
    const cacheDir = dirname(this.cachePath);
    await mkdir(cacheDir, { recursive: true });

    await writeFile(this.cachePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Get repository info from cache or detect and cache it
   */
  async getOrDetect(detector: () => RepositoryInfo | null): Promise<RepositoryInfo | null> {
    // Try cache first
    let repoInfo = await this.read();
    if (repoInfo) {
      return repoInfo;
    }

    // Detect and cache
    repoInfo = detector();
    if (repoInfo) {
      await this.write(repoInfo);
    }

    return repoInfo;
  }
}
```

**Commit message**: `feat: add cache manager for storing repository information`

---

### Task 4: Label Manager Library

**Goal**: Create a library that ensures required labels exist in the GitHub repository.

**Files to create**:
- `src/lib/label-manager.ts`

**Steps**:

1. Create `src/lib/label-manager.ts`:
```typescript
import { execSync } from 'child_process';
import { RepositoryInfo } from './repository-detector.js';

export interface Label {
  name: string;
  color: string;
  description: string;
}

export class LabelManager {
  private repoInfo: RepositoryInfo;

  constructor(repoInfo: RepositoryInfo) {
    this.repoInfo = repoInfo;
  }

  /**
   * Required labels for the GitHub Tracker system
   */
  private static readonly REQUIRED_LABELS: Label[] = [
    {
      name: 'epic',
      color: '8B4789',
      description: 'Parent issue tracking an implementation plan'
    },
    {
      name: 'plan-task',
      color: '0E8A16',
      description: 'Task from an implementation plan'
    }
  ];

  /**
   * Ensure all required labels exist in the repository
   * Creates missing labels, skips existing ones
   */
  async ensureLabels(): Promise<void> {
    const { owner, repo } = this.repoInfo;
    const repoFlag = `${owner}/${repo}`;

    for (const label of LabelManager.REQUIRED_LABELS) {
      try {
        // Check if label exists
        execSync(`gh label list --repo ${repoFlag} --search "${label.name}" --limit 1 --json name`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore']
        });

        const result = execSync(`gh label list --repo ${repoFlag} --search "${label.name}" --limit 1 --json name`, {
          encoding: 'utf-8'
        }).trim();

        const labels = JSON.parse(result);
        
        if (labels.length > 0 && labels[0].name === label.name) {
          // Label already exists
          continue;
        }

        // Create label
        execSync(
          `gh label create "${label.name}" --repo ${repoFlag} --color ${label.color} --description "${label.description}"`,
          { encoding: 'utf-8', stdio: 'pipe' }
        );
      } catch (error) {
        // Label might already exist or gh CLI error
        // We'll continue anyway - the actual issue creation will fail if there's a real problem
        console.error(`Warning: Could not ensure label "${label.name}": ${error}`);
      }
    }
  }
}
```

**Commit message**: `feat: add label manager to ensure required GitHub labels exist`

---

### Task 5: GitHub CLI Wrapper

**Goal**: Create a wrapper for GitHub CLI commands used to create issues and PRs.

**Files to create**:
- `src/lib/github-cli.ts`

**Steps**:

1. Create `src/lib/github-cli.ts`:
```typescript
import { execSync } from 'child_process';
import { RepositoryInfo } from './repository-detector.js';

export interface IssueOptions {
  title: string;
  body: string;
  labels?: string[];
}

export interface IssueResult {
  number: number;
  url: string;
}

export class GitHubCLI {
  private repoInfo: RepositoryInfo;

  constructor(repoInfo: RepositoryInfo) {
    this.repoInfo = repoInfo;
  }

  /**
   * Create a GitHub issue
   */
  async createIssue(options: IssueOptions): Promise<IssueResult> {
    const { owner, repo } = this.repoInfo;
    const repoFlag = `${owner}/${repo}`;

    // Build label flags
    const labelFlags = options.labels
      ? options.labels.map(l => `--label "${l}"`).join(' ')
      : '';

    // Create issue using gh CLI
    const command = `gh issue create --repo ${repoFlag} --title "${this.escapeQuotes(options.title)}" --body "${this.escapeQuotes(options.body)}" ${labelFlags} --json number,url`;

    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = JSON.parse(output.trim());
      return {
        number: result.number,
        url: result.url
      };
    } catch (error: any) {
      throw new Error(`Failed to create GitHub issue: ${error.message}`);
    }
  }

  /**
   * Create a GitHub pull request
   */
  async createPullRequest(options: {
    title: string;
    body: string;
    base?: string;
    head?: string;
  }): Promise<IssueResult> {
    const { owner, repo } = this.repoInfo;
    const repoFlag = `${owner}/${repo}`;

    const baseFlag = options.base ? `--base ${options.base}` : '';
    const headFlag = options.head ? `--head ${options.head}` : '';

    const command = `gh pr create --repo ${repoFlag} --title "${this.escapeQuotes(options.title)}" --body "${this.escapeQuotes(options.body)}" ${baseFlag} ${headFlag} --json number,url`;

    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const result = JSON.parse(output.trim());
      return {
        number: result.number,
        url: result.url
      };
    } catch (error: any) {
      throw new Error(`Failed to create GitHub PR: ${error.message}`);
    }
  }

  /**
   * Escape quotes in strings for shell commands
   */
  private escapeQuotes(str: string): string {
    return str.replace(/"/g, '\\"');
  }
}
```

**Commit message**: `feat: add GitHub CLI wrapper for creating issues and PRs`

---

### Task 6: Epic Creation Skill

**Goal**: Create the core skill that reads a plan file and creates GitHub issues for each task.

**Files to create**:
- `src/skills/create-epic.ts`
- `src/lib/plan-parser.ts`

**Steps**:

1. Create `src/lib/plan-parser.ts`:
```typescript
import { readFile } from 'fs/promises';

export interface Task {
  number: number;
  title: string;
  description: string;
}

export interface Plan {
  goal: string;
  architecture: string;
  techStack: string;
  tasks: Task[];
}

export class PlanParser {
  /**
   * Parse implementation plan markdown file
   */
  static async parse(planPath: string): Promise<Plan> {
    const content = await readFile(planPath, 'utf-8');

    // Extract goal from frontmatter
    const goalMatch = content.match(/###\s+Goal\s+(.+?)(?=\n###|\n---|\n##|$)/s);
    const goal = goalMatch ? goalMatch[1].trim() : '';

    // Extract architecture
    const archMatch = content.match(/###\s+Architecture\s+(.+?)(?=\n###|\n---|\n##|$)/s);
    const architecture = archMatch ? archMatch[1].trim() : '';

    // Extract tech stack
    const techMatch = content.match(/###\s+Tech Stack\s+(.+?)(?=\n###|\n---|\n##|$)/s);
    const techStack = techMatch ? techMatch[1].trim() : '';

    // Extract tasks
    const tasks: Task[] = [];
    const taskRegex = /###\s+Task\s+(\d+):\s+(.+?)\n([\s\S]+?)(?=\n###\s+Task|\n---\n|$)/g;
    let match;

    while ((match = taskRegex.exec(content)) !== null) {
      tasks.push({
        number: parseInt(match[1]),
        title: match[2].trim(),
        description: match[3].trim()
      });
    }

    return { goal, architecture, techStack, tasks };
  }
}
```

2. Create `src/skills/create-epic.ts`:
```typescript
import { readFile, writeFile } from 'fs/promises';
import { RepositoryDetector } from '../lib/repository-detector.js';
import { CacheManager } from '../lib/cache-manager.js';
import { LabelManager } from '../lib/label-manager.js';
import { GitHubCLI } from '../lib/github-cli.js';
import { PlanParser } from '../lib/plan-parser.js';
import { resolve, dirname } from 'path';

export interface CreateEpicOptions {
  planPath: string;
  projectRoot?: string;
}

export interface CreateEpicResult {
  epicIssue: { number: number; url: string };
  taskIssues: Array<{ number: number; url: string; taskNumber: number }>;
  updatedPlanPath: string;
}

export class CreateEpicSkill {
  /**
   * Create an epic from an implementation plan
   */
  static async execute(options: CreateEpicOptions): Promise<CreateEpicResult> {
    const projectRoot = options.projectRoot || process.cwd();
    const planPath = resolve(projectRoot, options.planPath);

    // 1. Detect repository
    const cacheManager = new CacheManager(projectRoot);
    const repoInfo = await cacheManager.getOrDetect(() => 
      RepositoryDetector.detect(projectRoot)
    );

    if (!repoInfo) {
      throw new Error('Could not detect GitHub repository. Ensure this is a git repository with a GitHub remote.');
    }

    // 2. Ensure labels exist
    const labelManager = new LabelManager(repoInfo);
    await labelManager.ensureLabels();

    // 3. Parse plan file
    const plan = await PlanParser.parse(planPath);

    // 4. Create epic issue
    const githubCLI = new GitHubCLI(repoInfo);
    const epicBody = this.buildEpicBody(plan, planPath);
    const epicIssue = await githubCLI.createIssue({
      title: `Epic: ${plan.goal.substring(0, 100)}`,
      body: epicBody,
      labels: ['epic']
    });

    // 5. Create task issues
    const taskIssues = [];
    for (const task of plan.tasks) {
      const taskBody = this.buildTaskBody(task, epicIssue.number);
      const taskIssue = await githubCLI.createIssue({
        title: `Task ${task.number}: ${task.title}`,
        body: taskBody,
        labels: ['plan-task']
      });

      taskIssues.push({
        number: taskIssue.number,
        url: taskIssue.url,
        taskNumber: task.number
      });
    }

    // 6. Update plan file with issue links
    await this.updatePlanFile(planPath, epicIssue, taskIssues);

    return {
      epicIssue,
      taskIssues,
      updatedPlanPath: planPath
    };
  }

  /**
   * Build epic issue body
   */
  private static buildEpicBody(plan: Plan, planPath: string): string {
    return `## Plan
${planPath}

## Goal
${plan.goal}

## Architecture
${plan.architecture}

## Tech Stack
${plan.techStack}

## Tasks
${plan.tasks.map(t => `- [ ] Task ${t.number}: ${t.title}`).join('\n')}
`;
  }

  /**
   * Build task issue body
   */
  private static buildTaskBody(task: any, epicNumber: number): string {
    return `Part of Epic #${epicNumber}

${task.description}
`;
  }

  /**
   * Update plan file with GitHub issue links
   */
  private static async updatePlanFile(
    planPath: string,
    epicIssue: { number: number; url: string },
    taskIssues: Array<{ number: number; url: string; taskNumber: number }>
  ): Promise<void> {
    let content = await readFile(planPath, 'utf-8');

    // Add epic link after title
    const titleMatch = content.match(/^#\s+.+$/m);
    if (titleMatch) {
      const epicLink = `\n\n**Epic**: [#${epicIssue.number}](${epicIssue.url})`;
      content = content.replace(titleMatch[0], titleMatch[0] + epicLink);
    }

    // Add task links to each task section
    for (const taskIssue of taskIssues) {
      const taskHeaderRegex = new RegExp(`(###\\s+Task\\s+${taskIssue.taskNumber}:.+)$`, 'm');
      const taskLink = ` → [#${taskIssue.number}](${taskIssue.url})`;
      content = content.replace(taskHeaderRegex, `$1${taskLink}`);
    }

    await writeFile(planPath, content, 'utf-8');
  }
}
```

**Commit message**: `feat: add create-epic skill for generating GitHub issues from plans`

---

### Task 7: Land the Plane Skill

**Goal**: Create a skill that helps create a PR from an implementation branch with context from the epic.

**Files to create**:
- `src/skills/land-the-plane.ts`

**Steps**:

1. Create `src/skills/land-the-plane.ts`:
```typescript
import { execSync } from 'child_process';
import { RepositoryDetector } from '../lib/repository-detector.js';
import { CacheManager } from '../lib/cache-manager.js';
import { GitHubCLI } from '../lib/github-cli.js';

export interface LandThePlaneOptions {
  epicNumber?: number;
  baseBranch?: string;
  projectRoot?: string;
}

export interface LandThePlaneResult {
  prNumber: number;
  prUrl: string;
  branch: string;
}

export class LandThePlaneSkill {
  /**
   * Create a PR for the current branch with epic context
   */
  static async execute(options: LandThePlaneOptions = {}): Promise<LandThePlaneResult> {
    const projectRoot = options.projectRoot || process.cwd();

    // 1. Detect repository
    const cacheManager = new CacheManager(projectRoot);
    const repoInfo = await cacheManager.getOrDetect(() =>
      RepositoryDetector.detect(projectRoot)
    );

    if (!repoInfo) {
      throw new Error('Could not detect GitHub repository. Ensure this is a git repository with a GitHub remote.');
    }

    // 2. Get current branch
    const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectRoot,
      encoding: 'utf-8'
    }).trim();

    if (currentBranch === 'main' || currentBranch === 'master') {
      throw new Error('Cannot create PR from main/master branch. Switch to a feature branch first.');
    }

    // 3. Get commit messages for PR description
    const baseBranch = options.baseBranch || 'main';
    const commits = execSync(`git log ${baseBranch}..HEAD --pretty=format:"- %s"`, {
      cwd: projectRoot,
      encoding: 'utf-8'
    }).trim();

    // 4. Build PR body
    const prBody = this.buildPRBody(commits, options.epicNumber);

    // 5. Generate PR title from branch or first commit
    const prTitle = this.generatePRTitle(currentBranch, commits);

    // 6. Create PR
    const githubCLI = new GitHubCLI(repoInfo);
    const pr = await githubCLI.createPullRequest({
      title: prTitle,
      body: prBody,
      base: baseBranch,
      head: currentBranch
    });

    return {
      prNumber: pr.number,
      prUrl: pr.url,
      branch: currentBranch
    };
  }

  /**
   * Build PR body with commits and epic reference
   */
  private static buildPRBody(commits: string, epicNumber?: number): string {
    let body = '## Summary\n\n';

    if (epicNumber) {
      body += `Closes #${epicNumber}\n\n`;
    }

    body += '## Changes\n\n';
    body += commits || 'No commits found';

    return body;
  }

  /**
   * Generate PR title from branch name or commits
   */
  private static generatePRTitle(branch: string, commits: string): string {
    // Try to use branch name if it's descriptive
    const branchTitle = branch
      .replace(/^(feature|feat|fix|bugfix|chore|docs|refactor)\//, '')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .trim();

    if (branchTitle.length > 10) {
      return branchTitle.charAt(0).toUpperCase() + branchTitle.slice(1);
    }

    // Fall back to first commit message
    const firstCommit = commits.split('\n')[0]?.replace(/^-\s*/, '').trim();
    return firstCommit || branch;
  }
}
```

**Commit message**: `feat: add land-the-plane skill for creating PRs with epic context`

---

### Task 8: Main Plugin Entry Point

**Goal**: Create the MCP server entry point that exposes the skills.

**Files to modify**:
- `src/index.ts`

**Steps**:

1. Replace `src/index.ts` content:
```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CreateEpicSkill } from './skills/create-epic.js';
import { LandThePlaneSkill } from './skills/land-the-plane.js';

// Create MCP server
const server = new Server(
  {
    name: 'github-tracker',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create-epic',
        description: 'Create a GitHub epic from an implementation plan. Reads a plan markdown file and creates a parent epic issue and child task issues, then updates the plan with issue links.',
        inputSchema: {
          type: 'object',
          properties: {
            planPath: {
              type: 'string',
              description: 'Path to the implementation plan markdown file (relative to project root)',
            },
          },
          required: ['planPath'],
        },
      },
      {
        name: 'land-the-plane',
        description: 'Create a pull request from the current branch with epic context. Analyzes commits and creates a PR with proper formatting and epic references.',
        inputSchema: {
          type: 'object',
          properties: {
            epicNumber: {
              type: 'number',
              description: 'GitHub issue number of the epic this PR closes (optional)',
            },
            baseBranch: {
              type: 'string',
              description: 'Base branch for the PR (defaults to "main")',
            },
          },
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'create-epic') {
      const result = await CreateEpicSkill.execute({
        planPath: args.planPath as string,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    if (name === 'land-the-plane') {
      const result = await LandThePlaneSkill.execute({
        epicNumber: args.epicNumber as number | undefined,
        baseBranch: args.baseBranch as string | undefined,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('GitHub Tracker MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

2. Update `package.json` to add bin entry:
```json
{
  "bin": {
    "github-tracker": "./dist/index.js"
  }
}
```

**Commit message**: `feat: add MCP server entry point with create-epic and land-the-plane tools`

---

### Task 9: Epic Creation Helper Script

**Goal**: Create a standalone CLI script for manual testing during development.

**Files to create**:
- `src/cli.ts`

**Steps**:

1. Create `src/cli.ts`:
```typescript
#!/usr/bin/env node
import { CreateEpicSkill } from './skills/create-epic.js';
import { LandThePlaneSkill } from './skills/land-the-plane.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (command === 'create-epic') {
    const planPath = args[1];
    if (!planPath) {
      console.error('Usage: github-tracker create-epic <plan-path>');
      process.exit(1);
    }

    console.log('Creating epic from plan:', planPath);
    const result = await CreateEpicSkill.execute({ planPath });
    
    console.log('\n✅ Epic created successfully!');
    console.log(`Epic: #${result.epicIssue.number} - ${result.epicIssue.url}`);
    console.log(`\nTasks created:`);
    result.taskIssues.forEach(task => {
      console.log(`  Task ${task.taskNumber}: #${task.number} - ${task.url}`);
    });
    console.log(`\nPlan updated: ${result.updatedPlanPath}`);
  } else if (command === 'land-the-plane') {
    const epicNumber = args[1] ? parseInt(args[1]) : undefined;
    
    console.log('Creating pull request...');
    const result = await LandThePlaneSkill.execute({ epicNumber });
    
    console.log('\n✅ Pull request created successfully!');
    console.log(`PR: #${result.prNumber} - ${result.prUrl}`);
    console.log(`Branch: ${result.branch}`);
  } else {
    console.error('Usage:');
    console.error('  github-tracker create-epic <plan-path>');
    console.error('  github-tracker land-the-plane [epic-number]');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
```

2. Update `package.json` to add CLI script:
```json
{
  "bin": {
    "github-tracker": "./dist/index.js",
    "github-tracker-cli": "./dist/cli.js"
  }
}
```

3. Build the project:
```bash
npm run build
```

**Commit message**: `feat: add CLI helper script for manual epic creation and PR creation`

---

### Task 10: Test MVP with This Plan

**Goal**: Use the CLI to create an epic from this very implementation plan, validating the entire MVP workflow.

**Files to modify**:
- This plan file (will be updated automatically)

**Steps**:

1. Build the project:
```bash
npm run build
```

2. Run the CLI tool on this plan:
```bash
node dist/cli.js create-epic .opencode/plans/2026-02-09-github-tracker-mvp.md
```

3. Verify the output:
   - Epic issue created on GitHub
   - 10 task issues created on GitHub
   - This plan file updated with issue links

4. Test the verification:
```bash
# Check that the plan file now has issue links
grep -E '\[#[0-9]+\]' .opencode/plans/2026-02-09-github-tracker-mvp.md
```

5. Commit the updated plan:
```bash
git add .opencode/plans/2026-02-09-github-tracker-mvp.md
git commit -m "docs: update plan with GitHub issue links"
```

**Commit message**: `test: validate MVP by creating epic from implementation plan`

---

## MVP Completion Checklist

- [ ] All TypeScript files compile without errors
- [ ] Epic creation creates parent issue with 'epic' label
- [ ] Task issues created with 'plan-task' label and reference to epic
- [ ] Plan file updated with issue links
- [ ] GitHub CLI integration works
- [ ] Repository detection works from git remote
- [ ] Cache stores repository info
- [ ] Labels automatically created if missing
- [ ] MCP server exposes create-epic tool
- [ ] MCP server exposes land-the-plane tool
- [ ] CLI tool works for manual testing
- [ ] Successfully tested on this implementation plan

---

## Post-MVP Features

Create GitHub issues for these enhancements after MVP is complete:

1. **Bidirectional Sync**: Update issue status in plan file when GitHub issues are closed
2. **Task Status Tracking**: Add checkboxes to plan file that update GitHub issue status
3. **Plan Templates**: Create standard templates for common plan types
4. **Multi-Epic Support**: Support multiple epics in a single plan file
5. **Subtask Breakdown**: Allow tasks to have subtasks mapped to GitHub issue comments
6. **Time Estimates**: Parse time estimates from tasks and add to GitHub issues
7. **Progress Dashboard**: Generate progress reports from GitHub issues
8. **Dependency Tracking**: Support task dependencies (e.g., Task 3 blocks Task 5)
9. **Automated PR Description**: Generate PR descriptions from completed tasks
10. **GitHub Projects Integration**: Automatically add issues to GitHub Projects board
11. **Plan Validation**: Validate plan format before creating issues
12. **Dry Run Mode**: Preview issues before creating them
13. **Bulk Updates**: Update multiple issues at once when plan changes
14. **Custom Labels**: Allow custom labels per plan
15. **Epic Completion Automation**: Auto-close epic when all tasks complete


---

**Epic:** #1 (https://github.com/castrojo/opencode-superpower-github/issues/1)
