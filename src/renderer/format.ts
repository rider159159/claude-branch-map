export function shortenPath(p: string | null | undefined, segments = 3): string {
  if (!p) return '(unknown)';
  const parts = p.split(/[\\/]/).filter(Boolean);
  if (parts.length <= segments) return p;
  return '…/' + parts.slice(-segments).join('/');
}

const UNITS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60_000, 'second'],
  [3_600_000, 'minute'],
  [86_400_000, 'hour'],
  [604_800_000, 'day'],
  [2_629_800_000, 'week'],
  [31_557_600_000, 'month'],
  [Infinity, 'year'],
];

const FACTORS: Partial<Record<Intl.RelativeTimeFormatUnit, number>> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
  month: 2_629_800_000,
  year: 31_557_600_000,
};

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

export function relativeTime(ts: number): string {
  if (!ts) return '—';
  const diff = ts - Date.now();
  const abs = Math.abs(diff);
  for (const [limit, unit] of UNITS) {
    if (abs < limit) {
      const factor = FACTORS[unit] ?? 1000;
      const value = Math.round(diff / factor);
      return rtf.format(value, unit);
    }
  }
  return new Date(ts).toLocaleString();
}

export function absoluteTime(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString();
}
