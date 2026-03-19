export interface Weapon {
  name: string;
  element: string;
  subclass: string;
  super: string;
  level: number;
  icon_path: string;
  primary?: boolean;
}

export interface StatBlock {
  raw: number;
  softCap: number;
  pinnacle: number;
  unit: string;
}

export interface Stats {
  endurance: StatBlock;
  recall: StatBlock;
  synthesis: StatBlock;
  breadth: StatBlock;
  foresight: StatBlock;
  output: StatBlock;
}

export interface PowerlevelData {
  season: string;
  weapons: Record<string, Weapon>;
  stats: Stats;
}

export function computePL(weapons: Record<string, Weapon>): number {
  const levels = Object.values(weapons).map(w => w.level);
  if (levels.length === 0) return 1;
  return Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
}

export function getRank(pl: number): string {
  if (pl >= 100) return 'Mastercrafted ★';
  if (pl >= 90) return 'Gilded';
  if (pl >= 80) return 'Ascendant';
  if (pl >= 70) return 'Unbroken';
  if (pl >= 60) return 'Forged';
  if (pl >= 50) return 'Veteran';
  if (pl >= 40) return 'Battle-Tested';
  if (pl >= 30) return 'Hardened';
  if (pl >= 20) return 'Seasoned';
  if (pl >= 10) return 'Brave';
  return 'New Light';
}

export function levelTier(level: number): string {
  if (level >= 100) return 'masterwork';
  if (level >= 90) return 'gilded';
  if (level >= 80) return 'ascendant';
  if (level >= 70) return 'unbroken';
  if (level >= 60) return 'forged';
  if (level >= 50) return 'veteran';
  if (level >= 40) return 'battle-tested';
  if (level >= 30) return 'hardened';
  if (level >= 20) return 'seasoned';
  if (level >= 10) return 'brave';
  return 'new-light';
}

export function activeSupers(weapons: Record<string, Weapon>): string[] {
  const elementCount: Record<string, number> = {};
  for (const w of Object.values(weapons)) {
    if (w.element) {
      elementCount[w.element] = (elementCount[w.element] || 0) + 1;
    }
  }
  return Object.entries(elementCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([el]) => el);
}

export function statScale(raw: number, softCap: number, pinnacle: number): number {
  if (raw <= 0) return 0;
  if (raw >= pinnacle) return 100;
  if (raw <= softCap) {
    // Linear to 75 at softCap
    return Math.round((raw / softCap) * 75);
  }
  // Log curve from 75 to 100 between softCap and pinnacle
  const t = (raw - softCap) / (pinnacle - softCap);
  return Math.round(75 + 25 * Math.log(1 + t * (Math.E - 1)));
}
