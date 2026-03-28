// Minimal cron helpers without external deps.

export const DAILY_9AM = '0 9 * * *';
export const WEEKLY_MON = '0 9 * * 1';
export const MONTHLY_1ST = '0 9 1 * *';

export function parseCronToHuman(cron: string): string {
  switch (cron) {
    case DAILY_9AM:
      return 'Every day at 9:00 AM';
    case WEEKLY_MON:
      return 'Every Monday at 9:00 AM';
    case MONTHLY_1ST:
      return 'On the 1st of every month at 9:00 AM';
    default:
      return `Cron: ${cron}`;
  }
}

export function getNextRun(cron: string): Date {
  const now = new Date();
  if (cron === DAILY_9AM) {
    const d = new Date(now);
    d.setHours(9, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return d;
  }
  if (cron === WEEKLY_MON) {
    const d = new Date(now);
    d.setHours(9, 0, 0, 0);
    // JS getDay() 0=Sun..6=Sat; we want Monday=1
    const day = d.getDay();
    const diff = (1 - day + 7) % 7 || 7; // next Monday
    d.setDate(d.getDate() + (d <= now ? diff : diff - 7));
    if (d <= now) d.setDate(d.getDate() + 7);
    return d;
  }
  if (cron === MONTHLY_1ST) {
    const d = new Date(now.getFullYear(), now.getMonth(), 1, 9, 0, 0, 0);
    if (d <= now) d.setMonth(d.getMonth() + 1);
    return d;
  }
  // Fallback: 1 hour later
  return new Date(now.getTime() + 60 * 60 * 1000);
}

