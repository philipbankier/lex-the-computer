"use client";
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:3001';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

export default function SystemPage() {
  const [stats, setStats] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'stats' | 'logs' | 'actions'>('stats');

  useEffect(() => { void loadStats(); }, []);

  async function loadStats() {
    setLoading(true);
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(`${CORE_URL}/api/system/stats`).then((r) => r.json()),
        fetch(`${CORE_URL}/api/system/logs`).then((r) => r.json()),
      ]);
      setStats(sRes);
      setLogs(lRes.lines || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function reboot() {
    if (!confirm('Reboot the server? This will restart all services.')) return;
    await fetch(`${CORE_URL}/api/system/reboot`, { method: 'POST' });
    toast.success('Restarting...');
  }

  async function clearCache() {
    const res = await fetch(`${CORE_URL}/api/system/clear-cache`, { method: 'POST' });
    const data = await res.json();
    if (data.ok) toast.success('Cache cleared');
    else toast.error(data.error || 'Failed');
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-lg bg-white/5 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">System</h1>
      <div className="flex gap-2">
        {(['stats', 'logs', 'actions'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm capitalize ${tab === t ? 'bg-white/15' : 'bg-white/10'}`}>{t}</button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard label="CPU" value={`${stats.cpu.percent}%`} detail={`${stats.cpu.cores} cores`} percent={stats.cpu.percent} />
            <StatCard label="Memory" value={formatBytes(stats.memory.used)} detail={`/ ${formatBytes(stats.memory.total)}`} percent={stats.memory.percent} />
            <StatCard label="Disk" value={formatBytes(stats.disk.used)} detail={`/ ${formatBytes(stats.disk.total)}`} percent={stats.disk.percent} />
            <StatCard label="Uptime" value={formatUptime(stats.uptime)} detail="" />
          </div>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <InfoCard label="Platform" value={`${stats.platform} / ${stats.arch}`} />
            <InfoCard label="Hostname" value={stats.hostname} />
            <InfoCard label="Node.js" value={stats.nodeVersion} />
            <InfoCard label="Processes" value={String(stats.processCount)} />
          </div>
          {stats.cpu.model && (
            <div className="text-xs opacity-40">CPU: {stats.cpu.model}</div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="border border-white/10 rounded-lg p-3 max-h-[70vh] overflow-auto font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-center py-8 opacity-40">No logs available</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="py-0.5 opacity-70 hover:opacity-100 whitespace-pre-wrap break-all">{line}</div>
            ))
          )}
        </div>
      )}

      {tab === 'actions' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="p-4 border border-white/10 rounded-lg">
            <div className="font-medium text-sm mb-2">Clear Cache</div>
            <p className="text-xs opacity-60 mb-3">Flush Redis cache. This won't affect your data.</p>
            <button onClick={clearCache} className="px-4 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm transition">Clear Cache</button>
          </div>
          <div className="p-4 border border-red-600/20 rounded-lg">
            <div className="font-medium text-sm mb-2">Reboot Server</div>
            <p className="text-xs opacity-60 mb-3">Restart the Lex process. Active sessions will be interrupted.</p>
            <button onClick={reboot} className="px-4 py-1.5 rounded bg-red-600/40 hover:bg-red-600/60 text-sm transition">Reboot</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, detail, percent }: { label: string; value: string; detail: string; percent?: number }) {
  return (
    <div className="p-3 rounded-lg border border-white/10">
      <div className="text-xs opacity-60 mb-1">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
      {detail && <div className="text-xs opacity-50">{detail}</div>}
      {typeof percent === 'number' && (
        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${percent > 80 ? 'bg-red-500/60' : percent > 50 ? 'bg-yellow-500/50' : 'bg-white/30'}`}
            style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg border border-white/10">
      <div className="text-xs opacity-60 mb-1">{label}</div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}
