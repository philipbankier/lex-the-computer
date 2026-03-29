import { Hono } from 'hono';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

export const systemRouter = new Hono();

systemRouter.get('/stats', async (c) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const uptimeSecs = os.uptime();

  // CPU usage estimate (1-second average across all cores)
  const cpuAvg = os.loadavg()[0];
  const cpuPercent = Math.min(100, Math.round((cpuAvg / cpus.length) * 100));

  // Disk usage
  let diskTotal = 0;
  let diskUsed = 0;
  try {
    const dfOut = execSync('df -B1 / 2>/dev/null', { encoding: 'utf8' });
    const lines = dfOut.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      diskTotal = parseInt(parts[1]) || 0;
      diskUsed = parseInt(parts[2]) || 0;
    }
  } catch { /* ignore */ }

  // Process count
  let processCount = 0;
  try {
    const psOut = execSync('ps aux 2>/dev/null | wc -l', { encoding: 'utf8' });
    processCount = parseInt(psOut.trim()) - 1; // minus header
  } catch { /* ignore */ }

  return c.json({
    cpu: {
      percent: cpuPercent,
      cores: cpus.length,
      model: cpus[0]?.model || 'Unknown',
      loadAvg: os.loadavg(),
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      percent: Math.round((usedMem / totalMem) * 100),
    },
    disk: {
      total: diskTotal,
      used: diskUsed,
      percent: diskTotal ? Math.round((diskUsed / diskTotal) * 100) : 0,
    },
    uptime: uptimeSecs,
    arch: os.arch(),
    platform: os.platform(),
    hostname: os.hostname(),
    nodeVersion: process.version,
    processCount,
  });
});

systemRouter.post('/reboot', async (c) => {
  // Graceful restart — exit process; systemd/Docker will restart
  setTimeout(() => process.exit(0), 500);
  return c.json({ ok: true, message: 'Restarting...' });
});

systemRouter.post('/clear-cache', async (c) => {
  // Try to flush Redis if available
  try {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    await redis.flushdb();
    await redis.quit();
    return c.json({ ok: true, message: 'Cache cleared' });
  } catch {
    return c.json({ ok: false, error: 'Redis not available' }, 500);
  }
});

systemRouter.get('/logs', async (c) => {
  // Return last 100 lines of stdout captured or a placeholder
  try {
    const logPath = '/tmp/lex-core.log';
    const content = await fs.readFile(logPath, 'utf8').catch(() => '');
    const lines = content.split('\n').slice(-100);
    return c.json({ lines });
  } catch {
    return c.json({ lines: ['Log collection not configured. Check container logs.'] });
  }
});
