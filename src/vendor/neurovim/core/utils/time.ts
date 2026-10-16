export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * The player's calendar day (`YYYY-MM-DD`) in the runtime's local zone — the day "today"
 * means wherever the clock is read. Not `toISOString()`: that is the UTC day, which lies a day
 * off between local midnight and the zone offset (00:00–02:00 in Berlin in summer).
 */
export function localDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
