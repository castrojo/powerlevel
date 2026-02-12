// lib/project-board-manager.js
import { execGraphQL } from './github-cli.js';
import { logWarn, logDebug } from './logger.js';

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
      logWarn(client, `Configured board #${config.projectBoard.number} not found, creating new one`);
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
    logDebug(client, `Could not list boards: ${error.message}`);
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
  
  const rawResult = execGraphQL(query, { owner, repo });
  if (rawResult.errors) throw new Error(`GraphQL errors: ${JSON.stringify(rawResult.errors)}`);
  const result = rawResult.data;
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
  
  const rawResult = execGraphQL(query, { owner, repo, number });
  if (rawResult.errors) throw new Error(`GraphQL errors: ${JSON.stringify(rawResult.errors)}`);
  const result = rawResult.data;
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
  
  const rawRepoResult = execGraphQL(repoQuery, { owner, repo });
  if (rawRepoResult.errors) throw new Error(`GraphQL errors: ${JSON.stringify(rawRepoResult.errors)}`);
  const repoResult = rawRepoResult.data;
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
  
  const rawResult = execGraphQL(mutation, { repoId, title: 'Superpowers' });
  if (rawResult.errors) throw new Error(`GraphQL errors: ${JSON.stringify(rawResult.errors)}`);
  const result = rawResult.data;
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
  
  const rawIssueResult = execGraphQL(issueQuery, { owner, repo, number: issueNumber });
  if (rawIssueResult.errors) throw new Error(`GraphQL errors: ${JSON.stringify(rawIssueResult.errors)}`);
  const issueResult = rawIssueResult.data;
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
  
  const result = execGraphQL(mutation, { projectId, contentId: issueId });
  if (result.errors) throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
}
