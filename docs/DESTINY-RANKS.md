# Destiny Ranks - Powerlevel Progression System

## Overview

The Powerlevel rank system uses Destiny lore to gamify project management. As you take on more projects, you ascend through 10 ranks, each representing 5 projects.

## Rank Progression

### Guardian (Powerlevel 1-5)
*"You've taken your first steps into a larger world"*

Your journey begins. You're learning to manage multiple projects and finding your rhythm.

### Iron Lord (Powerlevel 6-10)
*"Forged in fire, tempered by challenge"*

You've proven your mettle. Managing nearly a dozen projects simultaneously shows true dedication.

### Vanguard (Powerlevel 11-15)
*"Leading the charge against entropy"*

You're not just managing projects—you're leading initiatives. Your organization inspires others.

### Awoken Paladin (Powerlevel 16-20)
*"Dancing between Light and Dark"*

You balance competing priorities with grace. Nearly 20 concurrent projects requires mastery.

### Ascendant (Powerlevel 21-25)
*"Your will shapes reality itself"*

At this level, you're not just executing—you're defining the architecture of multiple ecosystems.

### Disciple (Powerlevel 26-30)
*"The architecture of creation bends to you"*

Systems reshape themselves around your workflow. You operate at scale few can comprehend.

### Dredgen (Powerlevel 31-35)
*"Master of the space between triumph and ruin"*

You thrive in chaos. Where others see overwhelm, you see opportunity.

### The Lucent (Powerlevel 36-40)
*"Even death is but a tool in your arsenal"*

Failed projects fuel your success. Nothing stops your momentum.

### Witness (Powerlevel 41-45)
*"You perceive the Final Shape"*

You see patterns across all your work. The meta-game is clear to you now.

### Paracausal (Powerlevel 46-50)
*"Beyond Light and Darkness, beyond fate itself"*

You've transcended normal limitations. Managing 50 concurrent projects makes you legendary.

## Implementation

### Project Board Integration

The rank system automatically updates your project board:

**Title format:** `Powerlevel 5 ~ Guardian`
**Description:** Rank flavor text (e.g., "You've taken your first steps into a larger world")

### Code Integration

```javascript
const { getRankForPowerlevel, formatBoardTitle, getBoardDescription } = require('./lib/destiny-ranks');

// Calculate current rank
const powerlevel = 5;
const rank = getRankForPowerlevel(powerlevel);
console.log(rank.title); // "Guardian"
console.log(rank.description); // "You've taken your first steps..."

// Format board title
const title = formatBoardTitle(powerlevel);
console.log(title); // "Powerlevel 5 ~ Guardian"

// Get board description
const description = getBoardDescription(powerlevel);
console.log(description); // "You've taken your first steps..."
```

### Badge Integration

The Powerlevel badge also reflects your rank:

```markdown
![Powerlevel](https://img.shields.io/badge/Powerlevel-5%20~%20Guardian-brightgreen)
```

Color scheme:
- **1-9**: Blue (Guardian, Iron Lord)
- **10-24**: Bright Green (Vanguard, Awoken Paladin, Ascendant)
- **25-39**: Red (Disciple, Dredgen, The Lucent)
- **40-50**: Purple (Witness, Paracausal)

## Auto-Update Mechanism

When the Powerlevel score changes (epic completed or added):

1. Calculate new Powerlevel
2. Get rank for new score
3. Update project board title via `gh project edit`
4. Update project board description with rank flavor text
5. Regenerate badge JSON with new rank

This happens automatically during:
- Session start sync
- Epic creation
- Epic completion
- Manual sync commands

## Philosophy

The rank system serves multiple purposes:

1. **Motivation** - Provides clear progression milestones
2. **Context** - Instantly communicates workload scale
3. **Celebration** - Each rank up is an achievement
4. **Identity** - Your rank becomes part of your developer identity

The Destiny theming resonates with:
- **Guardians** as protectors/maintainers
- **Challenges** as project complexities
- **Light/Dark** as success/failure balance
- **Paracausal** as transcending normal limits

## Future Enhancements

- Display rank emblem/icon on project board
- Rank-specific achievement notifications
- Historical rank tracking (time at each rank)
- Custom rank sets (Marvel, Star Wars, etc.)
- Rank comparison across users
- Rank decay for inactive projects

## Credits

Destiny universe and lore © Bungie
Rank system implementation © Powerlevel project
