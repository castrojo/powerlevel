// lib/project-board-manager.js
import { execSync } from 'child_process';

/**
 * Get existing project board or create new one
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {Object} config - Configuration object with optional board settings
 * @param {Object} client - OpenCode SDK client (optional)
 * @returns {Promise<Object>} Project board info { id, number, url }
 */
export async function getOrCreateProjectBoard(owner, repo, config = {}, client = null) {
  // Check if board is specified in config
  if (config.projectBoard?.number) {
    try {
      const board = await getProjectBoard(owner, repo, config.projectBoard.number);
      return board;
    } catch (error) {
      if (client) {
        client.app.log({
          body: {
            service: 'powerlevel',
            level: 'warn',
            message: `Configured board #${config.projectBoard.number} not found, creating new one`
          }
        });
      }
    }
  }
  
  // Try to find existing "Superpowers" board
  try {
    const boards = await listProjectBoards(owner, repo);
    const superpowersBoard = boards.find(b => b.title === 'Superpowers');
    if (superpowersBoard) {
      return superpowersBoard;
    }
  } catch (error) {
    if (client) {
      client.app.log({
        body: {
          service: 'powerlevel',
          level: 'debug',
          message: `Could not list boards: ${error.message}`
        }
      });
    }
  }
  
  // Create new board
  return createProjectBoard(owner, repo);
}

/**
 * List project boards for repository
 */
async function listProjectBoards(owner, repo) {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        projectsV2(first: 10) {
          nodes {
            id
            number
            title
            url
          }
        }
      }
    }
  `;
  
  const result = execGhGraphQL(query, { owner, repo });
  return result.repository.projectsV2.nodes;
}

/**
 * Get specific project board by number
 */
async function getProjectBoard(owner, repo, number) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        projectV2(number: $number) {
          id
          number
          title
          url
        }
      }
    }
  `;
  
  const result = execGhGraphQL(query, { owner, repo, number });
  return result.repository.projectV2;
}

/**
 * Create new project board
 */
async function createProjectBoard(owner, repo) {
  // Get repository ID first
  const repoQuery = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        id
      }
    }
  `;
  
  const repoResult = execGhGraphQL(repoQuery, { owner, repo });
  const repoId = repoResult.repository.id;
  
  // Create project
  const mutation = `
    mutation($repoId: ID!, $title: String!) {
      createProjectV2(input: {
        repositoryId: $repoId,
        title: $title
      }) {
        projectV2 {
          id
          number
          title
          url
        }
      }
    }
  `;
  
  const result = execGhGraphQL(mutation, { repoId, title: 'Superpowers' });
  return result.createProjectV2.projectV2;
}

/**
 * Add epic issue to project board
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} projectId - Project board ID
 * @param {number} issueNumber - Epic issue number
 */
export async function addEpicToBoard(owner, repo, projectId, issueNumber) {
  // Get issue ID
  const issueQuery = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
        }
      }
    }
  `;
  
  const issueResult = execGhGraphQL(issueQuery, { owner, repo, number: issueNumber });
  const issueId = issueResult.repository.issue.id;
  
  // Add to project
  const mutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {
        projectId: $projectId,
        contentId: $contentId
      }) {
        item {
          id
        }
      }
    }
  `;
  
  execGhGraphQL(mutation, { projectId, contentId: issueId });
}

/**
 * Execute GitHub GraphQL query using gh CLI
 */
function execGhGraphQL(query, variables) {
  const cmd = `gh api graphql -f query='${query.replace(/'/g, "'\\''")}' ${
    Object.entries(variables)
      .map(([key, value]) => {
        const type = typeof value === 'number' ? '-F' : '-f';
        return `${type} ${key}='${value}'`;
      })
      .join(' ')
  }`;
  
  try {
    const output = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    const result = JSON.parse(output);
    
    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    
    return result.data;
  } catch (error) {
    throw new Error(`GraphQL query failed: ${error.message}`);
  }
}
