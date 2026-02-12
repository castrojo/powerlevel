/**
 * Destiny-inspired rank system for Powerlevel scores
 * Each rank represents a 5-project tier
 */

const DESTINY_RANKS = [
  {
    min: 1,
    max: 5,
    title: 'Guardian',
    description: "You've taken your first steps into a larger world"
  },
  {
    min: 6,
    max: 10,
    title: 'Iron Lord',
    description: 'Forged in fire, tempered by challenge'
  },
  {
    min: 11,
    max: 15,
    title: 'Vanguard',
    description: 'Leading the charge against entropy'
  },
  {
    min: 16,
    max: 20,
    title: 'Awoken Paladin',
    description: 'Dancing between Light and Dark'
  },
  {
    min: 21,
    max: 25,
    title: 'Ascendant',
    description: 'Your will shapes reality itself'
  },
  {
    min: 26,
    max: 30,
    title: 'Disciple',
    description: 'The architecture of creation bends to you'
  },
  {
    min: 31,
    max: 35,
    title: 'Dredgen',
    description: 'Master of the space between triumph and ruin'
  },
  {
    min: 36,
    max: 40,
    title: 'The Lucent',
    description: 'Even death is but a tool in your arsenal'
  },
  {
    min: 41,
    max: 45,
    title: 'Witness',
    description: 'You perceive the Final Shape'
  },
  {
    min: 46,
    max: 50,
    title: 'Paracausal',
    description: 'Beyond Light and Darkness, beyond fate itself'
  }
];

/**
 * Get the rank for a given Powerlevel score
 * @param {number} powerlevel - The current Powerlevel score
 * @returns {{title: string, description: string, min: number, max: number}}
 */
function getRankForPowerlevel(powerlevel) {
  for (const rank of DESTINY_RANKS) {
    if (powerlevel >= rank.min && powerlevel <= rank.max) {
      return rank;
    }
  }
  
  // If beyond max rank, return Paracausal
  return DESTINY_RANKS[DESTINY_RANKS.length - 1];
}

/**
 * Format project board title with Powerlevel and rank
 * @param {number} powerlevel - The current Powerlevel score
 * @returns {string} - Formatted title like "Powerlevel 5 ~ Guardian"
 */
function formatBoardTitle(powerlevel) {
  const rank = getRankForPowerlevel(powerlevel);
  return `Powerlevel ${powerlevel} ~ ${rank.title}`;
}

/**
 * Get the rank description for project board description field
 * @param {number} powerlevel - The current Powerlevel score
 * @returns {string} - Rank description
 */
function getBoardDescription(powerlevel) {
  const rank = getRankForPowerlevel(powerlevel);
  return rank.description;
}

export {
  DESTINY_RANKS,
  getRankForPowerlevel,
  formatBoardTitle,
  getBoardDescription
};
