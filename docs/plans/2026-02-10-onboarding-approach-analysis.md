# Project Onboarding: Skill vs Agent Analysis

## Current State

Onboarding is currently a CLI script (`bin/onboard-project.js`) that:
1. Adds superpowers git remote
2. Creates `.opencode/config.json` with defaults
3. Creates `docs/SUPERPOWERS.md` stub
4. Fetches remote branches

## Option 1: Skill-Based Approach (RECOMMENDED)

### Structure
Create `skills/onboarding-external-project/SKILL.md` in the Powerlevel repo.

### Workflow
```
User: "I want to track projectbluefin/common"
Assistant: I'm using the onboarding-external-project skill
         ↓
1. Ask clarifying questions (project board number?)
2. Verify repo exists via gh CLI
3. Create tracking epic in Powerlevel repo
4. Fetch open issues/epics from external repo
5. Create sub-issues with proper parent relationships
6. Add all to project board
7. Update board title/description if Powerlevel changed
8. Commit and celebrate
```

### Advantages
✅ Interactive - can ask user questions during execution
✅ Single session - user sees progress in real-time
✅ Flexible - can adapt based on user responses
✅ Integrated - uses existing Powerlevel code/cache
✅ Consistent with other Superpowers workflows
✅ User stays in control - can approve decisions
✅ Natural language interface - "track this repo"

### Disadvantages
⚠️ Requires session context - must be invoked by Claude
⚠️ Not automatable via cron/CI (needs interaction)

### Implementation Complexity: LOW
- ~100 lines of SKILL.md
- Reuses existing: `lib/external-tracker.js`, `lib/destiny-ranks.js`, `lib/github-cli.js`
- No new architecture needed

### Best For
- One-time onboarding when user decides to track a project
- Interactive decision-making (which issues to track?)
- Real-time feedback and validation

---

## Option 2: Agent-Based Approach

### Structure
Create specialized agent via Task tool that operates autonomously.

### Workflow
```
User: "Track projectbluefin/common"
Assistant: Launching onboarding agent...
         ↓
[Agent operates in separate session]
1. Analyze external repo (no questions allowed)
2. Make decisions autonomously
3. Create tracking epic + sub-issues
4. Return summary to user

[Back in main session]
Assistant: Agent completed! Created epic #123 with 5 sub-issues.
```

### Advantages
✅ Autonomous - no waiting for user input
✅ Parallelizable - could onboard multiple projects simultaneously
✅ Automatable - could be triggered by webhook/cron
✅ Separation of concerns - doesn't block main session

### Disadvantages
⚠️ Black box - user doesn't see progress until done
⚠️ No clarifications - must make assumptions
⚠️ Over-engineering for simple task
⚠️ Requires agent architecture setup
⚠️ Harder to debug when issues occur
⚠️ Can't ask "which project board?" if repo has multiple

### Implementation Complexity: MEDIUM-HIGH
- Create new agent type in Task tool
- Design agent prompt and boundaries
- Handle agent failure/retry logic
- Add agent result parsing
- More code, more moving parts

### Best For
- Batch onboarding of many projects
- Automated pipelines (CI/CD triggers)
- When user wants to delegate and walk away

---

## Recommendation: SKILL-BASED APPROACH

### Why?

1. **Fits the use case**: Onboarding is an interactive, one-time event. Users want to make decisions (which issues to track? what's the project board?).

2. **Lower complexity**: Reuses 80% of existing code. Skills are simpler to write/maintain than agents.

3. **Better UX**: User sees progress step-by-step, can course-correct if needed.

4. **Consistent with Superpowers philosophy**: Skills guide workflows, agents execute tasks. Onboarding is a guided workflow.

5. **Faster to ship**: Can implement in ~2 hours vs. ~1 day for agent approach.

### When to use Agent instead?

- If you want "auto-discover and track all my repos" feature
- If you build a webhook that auto-tracks new repos
- If you need to onboard 10+ projects in one go

But for the initial MVP, skill is the right choice.

---

## Hybrid Approach (Future Enhancement)

Best of both worlds:

1. **Skill** for interactive onboarding (primary use case)
2. **Agent** for batch operations (advanced use case)
3. Skill can optionally launch agent for heavy lifting

Example:
```
User: "Track projectbluefin/common"
Assistant: Using onboarding skill...
          Found 50 open issues. This will take a while.
          Should I launch an agent to handle this in the background?
User: Yes
Assistant: Launching agent... [agent works autonomously]
          You'll get a notification when done.
```

---

## Implementation Plan

### Phase 1: Core Skill (Recommended for now)
- Create `skills/onboarding-external-project/SKILL.md`
- Define interactive workflow
- Add helper functions to `lib/external-tracker.js` if needed
- Test with projectbluefin/common and castrojo/tap

### Phase 2: Automation Support (Future)
- Create `bin/onboard-external-project.js` CLI wrapper
- Enables scripted onboarding without OpenCode session
- Can be called by CI/CD or cron jobs

### Phase 3: Agent Integration (Optional)
- Create specialized onboarding agent
- Skill can delegate to agent for complex cases
- Agent can handle batch operations

---

## Decision Matrix

| Criteria | Skill | Agent | Winner |
|----------|-------|-------|--------|
| Implementation speed | ✅ Fast | ❌ Slow | Skill |
| User control | ✅ High | ❌ Low | Skill |
| Automation support | ⚠️ Medium | ✅ High | Agent |
| Debugging ease | ✅ Easy | ❌ Hard | Skill |
| Code reuse | ✅ High | ⚠️ Medium | Skill |
| Interactive decisions | ✅ Natural | ❌ Can't ask | Skill |
| Batch operations | ❌ Manual | ✅ Automatic | Agent |
| Consistency | ✅ Superpowers style | ⚠️ New pattern | Skill |

**Score: Skill wins 6-1-1**

---

## Conclusion

**Start with a skill.** It's simpler, faster to implement, and better matches the user experience. If batch automation becomes important later, add an agent as Phase 2.

The skill approach respects the Superpowers philosophy: guide the user through complex workflows with clear steps and decision points, rather than hiding complexity behind autonomous agents.
