import { execSync } from 'child_process';

/**
 * Execute a GraphQL query using gh CLI
 */
function execGraphQL(query, variables = {}) {
  // Build variable flags: -F key=value for each variable
  const varFlags = Object.entries(variables)
    .map(([key, value]) => `-F ${key}=${JSON.stringify(value)}`)
    .join(' ');
  
  try {
    const result = execSync(
      `gh api graphql -f query='${query}' ${varFlags}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(result);
  } catch (error) {
    throw new Error(`GraphQL query failed: ${error.message}`);
  }
}

/**
 * Get project fields with their IDs and options
 */
export function getProjectFields(owner, projectNumber) {
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          title
          fields(first: 20) {
            nodes {
              ... on ProjectV2Field {
                id
                name
                dataType
              }
              ... on ProjectV2SingleSelectField {
                id
                name
                dataType
                options {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const result = execGraphQL(query, { owner, number: projectNumber });
    
    if (!result.data || !result.data.user || !result.data.user.projectV2) {
      return null;
    }
    
    const project = result.data.user.projectV2;
    const fields = {};
    
    for (const field of project.fields.nodes) {
      fields[field.name] = {
        id: field.id,
        name: field.name,
        dataType: field.dataType,
        options: field.options || null
      };
    }
    
    return {
      projectId: project.id,
      fields
    };
  } catch (error) {
    console.error(`Failed to get project fields: ${error.message}`);
    return null;
  }
}

/**
 * Map label to field value
 * Returns { fieldName, optionId } or null
 */
export function mapLabelToField(label, projectFields) {
  if (!projectFields || !projectFields.fields) {
    return null;
  }
  
  const fields = projectFields.fields;
  
  // Priority mapping
  const priorityMap = {
    'priority/p0': { field: 'Priority', value: 'P0 - Critical' },
    'priority/p1': { field: 'Priority', value: 'P1 - High' },
    'priority/p2': { field: 'Priority', value: 'P2 - Normal' },
    'priority/p3': { field: 'Priority', value: 'P3 - Low' }
  };
  
  // Status mapping
  const statusMap = {
    'status/planning': { field: 'Status', value: 'Todo' },
    'status/in-progress': { field: 'Status', value: 'In Progress' },
    'status/review': { field: 'Status', value: 'In Progress' },
    'status/done': { field: 'Status', value: 'Done' }
  };
  
  let mapping = null;
  if (priorityMap[label]) {
    mapping = priorityMap[label];
  } else if (statusMap[label]) {
    mapping = statusMap[label];
  } else {
    return null;
  }
  
  const field = fields[mapping.field];
  if (!field || !field.options) {
    return null;
  }
  
  const option = field.options.find(opt => opt.name === mapping.value);
  if (!option) {
    return null;
  }
  
  return {
    fieldId: field.id,
    fieldName: field.name,
    optionId: option.id,
    optionName: option.name
  };
}
