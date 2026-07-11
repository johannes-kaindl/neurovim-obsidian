import { Level } from '../types';

export const LEVELS: Level[] = [
  { level: 1,  title: 'SIGNAL LOST',      xp_required: 0,    color: '#ff4444' },
  { level: 2,  title: 'GHOST OPERATOR',   xp_required: 66,   color: '#ffaa00' },
  { level: 3,  title: 'DEEP COVER',       xp_required: 186,  color: '#00aaff' },
  { level: 4,  title: 'NEON WRAITH',      xp_required: 371,  color: '#aa44ff' },
  { level: 5,  title: 'CHROME RAVEN',     xp_required: 601,  color: '#00ff41' },
  { level: 6,  title: 'SIGNAL HUNTER',    xp_required: 800,  color: '#00ccff' },
  { level: 7,  title: 'PROTOCOL READER',  xp_required: 1150, color: '#ff6600' },
  { level: 8,  title: 'PATTERN BREAKER',  xp_required: 1550, color: '#cc00ff' },
  { level: 9,  title: 'CIPHER ANALYST',   xp_required: 2000, color: '#ff0066' },
  { level: 10, title: 'SIGNAL ARCHITECT', xp_required: 2500, color: '#ffffff' },
];

export const UNLOCK_MAP: Record<number, { missions: string[]; loot: string[] }> = {
  2: { missions: ['M-05', 'M-06', 'M-07', 'M-08', 'KATA-02', 'KATA-03', 'KATA-12'],      loot: ['LOOT-01'] },
  3: { missions: ['M-09', 'M-10', 'M-11', 'M-12', 'KATA-04', 'KATA-13'],                 loot: ['LOOT-02'] },
  4: { missions: ['M-13', 'M-14', 'M-15', 'KATA-05'],                                    loot: ['LOOT-03'] },
  5: { missions: ['M-16', 'KATA-06', 'R-01', 'R-02', 'R-03', 'R-04'],                   loot: ['LOOT-04'] },
  6: { missions: ['R-05', 'R-06', 'R-07', 'R-08', 'KATA-07', 'KATA-14'],                 loot: ['LOOT-05'] },
  7: { missions: ['R-09', 'R-10', 'R-11', 'R-12', 'R-13', 'R-14', 'R-15', 'R-16', 'KATA-08', 'KATA-09'], loot: ['LOOT-07'] },
  8: { missions: ['R-17', 'R-18', 'R-19', 'R-20', 'KATA-10'],                            loot: ['LOOT-08'] },
  9: { missions: ['R-21', 'R-22', 'R-23', 'R-24', 'KATA-11'],                            loot: ['LOOT-06'] },
  10: { missions: [],                                                                    loot: ['LOOT-09'] },
};

/** The level whose UNLOCK_MAP first lists `id` (mission or loot), or null if not gated. */
export function unlockLevelFor(id: string): number | null {
  for (const lvl of Object.keys(UNLOCK_MAP).map(Number).sort((a, b) => a - b)) {
    const u = UNLOCK_MAP[lvl];
    if (u.missions.includes(id) || u.loot.includes(id)) return lvl;
  }
  return null;
}
