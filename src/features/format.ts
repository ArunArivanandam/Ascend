/** Altitude is shown as whole metres. */
export function formatAltitude(altitude: number): string {
  return `${Math.round(altitude).toLocaleString('en-US')} m`;
}

export function formatMinutes(minutes: number): string {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatDaysToTarget(days: number): string {
  if (days > 1) return `${days} days to your summit date`;
  if (days === 1) return '1 day to your summit date';
  if (days === 0) return 'Your summit date is today';
  return days === -1 ? 'Summit date was yesterday' : `Summit date was ${-days} days ago`;
}

/** "15 Feb 2027" for a YYYY-MM-DD local date. */
export function formatLongDate(localDate: string): string {
  return new Date(`${localDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "× 1.10" style multiplier. */
export function formatMultiplier(value: number): string {
  return value.toFixed(2);
}
