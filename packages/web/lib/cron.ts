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

