import { loadCache, saveCache } from './cache-manager.js';
import { extractPlanFromMessage } from './parser.js';

/**
 * Pattern to detect skill invocations in messages
 */
const SKILL_PATTERNS = [
  { pattern: /using the executing-plans skill/i, skill: 'executing-plans' },
  { pattern: /using the finishing-a-development-branch skill/i, skill: 'finishing-a-development-branch' },
  { pattern: /using the subagent-driven-development skill/i, skill: 'subagent-driven-development' },
  { pattern: /using the writing-plans skill/i, skill: 'writing-plans' },
  { pattern: /using the preparing-upstream-pr skill/i, skill: 'preparing-upstream-pr' },
  { pattern: /send.*upstream/i, skill: 'preparing-upstream-pr' },
  { pattern: /submit.*upstream/i, skill: 'preparing-upstream-pr' },
  { pattern: /ready for upstream/i, skill: 'preparing-upstream-pr' },
  { pattern: /create upstream pr/i, skill: 'preparing-upstream-pr' },
  { pattern: /upstream pull request/i, skill: 'preparing-upstream-pr' },
];

/**
 * Detect skill invocation from message
 * @param {string} message - Message text to analyze
 * @returns {Object|null} { skill, detected } or null
 */
export function detectSkillInvocation(message) {
  for (const { pattern, skill } of SKILL_PATTERNS) {
    if (pattern.test(message)) {
      return { skill, detected: true };
    }
  }
  return null;
}

/**
 * Register session event hooks
 * @param {Object} session - OpenCode session object
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} cwd - Current working directory
 * @param {Object} client - OpenCode SDK client (optional)
 */
export function registerSessionHooks(session, owner, repo, cwd, client = null) {
  if (!session || !session.on) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'warn', message: 'Session does not support event hooks' }
      });
    }
    return;
  }

  // Hook into message events to detect skill usage
  session.on('assistant.message', async (message) => {
    const skillInfo = detectSkillInvocation(message.content || '');
    
    if (skillInfo) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'debug', message: `Detected skill: ${skillInfo.skill}` }
        });
      }
      await handleSkillInvocation(skillInfo.skill, message, owner, repo, cwd, client);
    }
  });

  // Hook into plan file creation
  session.on('file.created', async (file) => {
    if (file.path && file.path.includes('docs/plans/')) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'debug', message: `Plan file created: ${file.path}` }
        });
      }
      await handlePlanCreation(file.path, owner, repo, cwd, client);
    }
  });

  if (client) {
    client.app.log({
      body: { service: 'powerlevel', level: 'info', message: '✓ Registered session event hooks for Superpowers integration' }
    });
  }
}

/**
 * Handle skill invocation event
 */
async function handleSkillInvocation(skill, message, owner, repo, cwd, client = null) {
  const cache = loadCache(owner, repo);
  
  switch (skill) {
    case 'executing-plans':
      await handleExecutingPlans(message, cache, owner, repo, cwd, client);
      break;
    case 'finishing-a-development-branch':
      await handleFinishingBranch(message, cache, owner, repo, cwd, client);
      break;
    case 'subagent-driven-development':
      await handleSubagentDevelopment(message, cache, owner, repo, cwd, client);
      break;
    case 'preparing-upstream-pr':
      await handlePreparingUpstreamPR(message, cache, owner, repo, cwd, client);
      break;
  }
  
  saveCache(owner, repo, cache);
}

/**
 * Handle executing-plans skill invocation
 */
async function handleExecutingPlans(message, cache, owner, repo, cwd, client = null) {
  // Try to extract plan file reference from message
  const planFile = extractPlanFromMessage(message.content);
  
  if (planFile) {
    // Find epic associated with this plan
    const epic = findEpicByPlanFile(cache, planFile);
    
    if (epic) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: `Linked executing-plans to epic #${epic.number}` }
        });
      }
      
      // Track event in epic journey
      if (!epic.journey) {
        epic.journey = [];
      }
      
      epic.journey.push({
        timestamp: new Date().toISOString(),
        event: 'skill_invocation',
        skill: 'executing-plans',
        message: 'Started executing implementation plan'
      });
      
      // Mark epic as dirty for sync
      epic.dirty = true;
      
      // Update epic status to in-progress
      if (epic.labels && !epic.labels.includes('status/in-progress')) {
        epic.labels = epic.labels.filter(l => !l.startsWith('status/'));
        epic.labels.push('status/in-progress');
      }
    }
  }
}

/**
 * Handle finishing-a-development-branch skill invocation
 */
async function handleFinishingBranch(message, cache, owner, repo, cwd, client = null) {
  // Try to find active epic based on current working directory or recent activity
  const activeEpic = findActiveEpic(cache, cwd);
  
  if (activeEpic) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: `Linked finishing-branch to epic #${activeEpic.number}` }
      });
    }
    
    // Track event in epic journey
    if (!activeEpic.journey) {
      activeEpic.journey = [];
    }
    
    activeEpic.journey.push({
      timestamp: new Date().toISOString(),
      event: 'skill_invocation',
      skill: 'finishing-a-development-branch',
      message: 'Started finishing development branch'
    });
    
    // Mark epic as dirty for sync
    activeEpic.dirty = true;
    
    // Update epic status to review
    if (activeEpic.labels && !activeEpic.labels.includes('status/review')) {
      activeEpic.labels = activeEpic.labels.filter(l => !l.startsWith('status/'));
      activeEpic.labels.push('status/review');
    }
  }
}

/**
 * Handle subagent-driven-development skill invocation
 */
async function handleSubagentDevelopment(message, cache, owner, repo, cwd, client = null) {
  const planFile = extractPlanFromMessage(message.content);
  
  if (planFile) {
    const epic = findEpicByPlanFile(cache, planFile);
    
    if (epic) {
      if (client) {
        client.app.log({
          body: { service: 'powerlevel', level: 'info', message: `Linked subagent-driven-development to epic #${epic.number}` }
        });
      }
      
      if (!epic.journey) {
        epic.journey = [];
      }
      
      epic.journey.push({
        timestamp: new Date().toISOString(),
        event: 'skill_invocation',
        skill: 'subagent-driven-development',
        message: 'Started subagent-driven development'
      });
      
      epic.dirty = true;
    }
  }
}

/**
 * Handle preparing-upstream-pr skill invocation
 */
async function handlePreparingUpstreamPR(message, cache, owner, repo, cwd, client = null) {
  // Try to find active epic based on current working directory or recent activity
  const activeEpic = findActiveEpic(cache, cwd);
  
  if (activeEpic) {
    if (client) {
      client.app.log({
        body: { service: 'powerlevel', level: 'info', message: `Linked preparing-upstream-pr to epic #${activeEpic.number}` }
      });
    }
    
    // Track event in epic journey
    if (!activeEpic.journey) {
      activeEpic.journey = [];
    }
    
    activeEpic.journey.push({
      timestamp: new Date().toISOString(),
      event: 'skill_invocation',
      skill: 'preparing-upstream-pr',
      message: 'Preparing upstream pull request (squashed, verified, manual submit)'
    });
    
    // Mark epic as dirty for sync
    activeEpic.dirty = true;
    
    // Update epic status to review (awaiting upstream merge)
    if (activeEpic.labels && !activeEpic.labels.includes('status/review')) {
      activeEpic.labels = activeEpic.labels.filter(l => !l.startsWith('status/'));
      activeEpic.labels.push('status/review');
    }
  }
}


/**
 * Handle plan file creation
 */
async function handlePlanCreation(planPath, owner, repo, cwd, client = null) {
  if (client) {
    client.app.log({
      body: { service: 'powerlevel', level: 'debug', message: `Plan created: ${planPath}` }
    });
  }
  // This will be handled by epic-creation skill
}

/**
 * Find epic by plan file path
 */
function findEpicByPlanFile(cache, planFile) {
  if (!cache.epics) return null;
  
  return Object.values(cache.epics).find(epic => 
    epic.plan_file === planFile || 
    epic.plan_file?.includes(planFile)
  );
}

/**
 * Find active epic (most recently updated with in-progress status)
 */
function findActiveEpic(cache, cwd) {
  if (!cache.epics) return null;
  
  const inProgressEpics = Object.values(cache.epics).filter(epic =>
    epic.state !== 'closed' &&
    epic.labels?.some(l => l === 'status/in-progress')
  );
  
  if (inProgressEpics.length === 0) {
    // Fall back to most recently updated open epic
    const openEpics = Object.values(cache.epics).filter(epic => epic.state !== 'closed');
    if (openEpics.length > 0) {
      return openEpics.sort((a, b) => 
        new Date(b.updated_at) - new Date(a.updated_at)
      )[0];
    }
    return null;
  }
  
  // Return most recently updated in-progress epic
  return inProgressEpics.sort((a, b) => 
    new Date(b.updated_at) - new Date(a.updated_at)
  )[0];
}
