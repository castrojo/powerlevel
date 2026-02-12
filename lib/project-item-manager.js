import { execGraphQL } from './github-cli.js';

/**
 * Add an issue to a project board
 * Returns the project item ID
 */
export function addIssueToProject(projectId, issueId) {
  const mutation = `
    mutation {
      addProjectV2ItemById(input: {
        projectId: "${projectId}"
        contentId: "${issueId}"
      }) {
        item {
          id
        }
      }
    }
  `;
  
  try {
    const result = execGraphQL(mutation);
    
    if (result.errors) {
      // Check if error is "already exists"
      const alreadyExists = result.errors.some(err => 
        err.message.includes('already exists') || 
        err.message.includes('duplicate')
      );
      
      if (alreadyExists) {
        console.log('  Item already in project, skipping');
        return null;
      }
      
      throw new Error(result.errors[0].message);
    }
    
    return result.data.addProjectV2ItemById.item.id;
  } catch (error) {
    console.error(`Failed to add issue to project: ${error.message}`);
    return null;
  }
}

/**
 * Update a project item field value
 */
export function updateProjectItemField(projectId, itemId, fieldId, optionId) {
  const mutation = `
    mutation {
      updateProjectV2ItemFieldValue(input: {
        projectId: "${projectId}"
        itemId: "${itemId}"
        fieldId: "${fieldId}"
        value: {
          singleSelectOptionId: "${optionId}"
        }
      }) {
        projectV2Item {
          id
        }
      }
    }
  `;
  
  try {
    const result = execGraphQL(mutation);
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to update project field: ${error.message}`);
    return false;
  }
}

/**
 * Get issue node ID from issue number
 */
export function getIssueNodeId(repoPath, issueNumber) {
  const [owner, repo] = repoPath.split('/');
  
  const query = `
    query {
      repository(owner: "${owner}", name: "${repo}") {
        issue(number: ${issueNumber}) {
          id
        }
      }
    }
  `;
  
  try {
    const result = execGraphQL(query);
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    
    return result.data.repository.issue.id;
  } catch (error) {
    console.error(`Failed to get issue node ID: ${error.message}`);
    return null;
  }
}
