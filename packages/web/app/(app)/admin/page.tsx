"use client";
import { useEffect, useState } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type SystemStats = {
  system: { cpus: number; totalMemory: number; freeMemory: number; uptime: number; platform: string; arch: string; hostname: string };
  counts: { users: number; conversations: number; agents: number };
  containers: { total: number; running: number; stopped: number };
  multiUser: boolean;
};

type AdminUser = {
  id: number; email: string; handle?: string; name?: string; role: string; is_disabled: boolean; created_at: string;
};

type Container = {
  id: number; user_id: number; container_id?: string; status: string; hostname?: string;
  cpu_limit: string; memory_limit: string; last_active_at?: string;
};

type Billing = { totalRevenue: number; totalOrders: number };

function formatBytes(bytes: number) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export default function AdminPage() {
  const [tab, setTab] = useState<'overview' | 'users' | 'containers' | 'billing'>('overview');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [containers, setContainers] = useState<Container[]>([]);
  const [billing, setBilling] = useState<Billing | null>(null);
  const [error, setError] = useState('');

  async function loadStats() {
    try {
      const r = await fetch(`${CORE_URL}/api/admin/stats`);
      if (!r.ok) { setError('Admin access denied'); return; }
      setStats(await r.json());
    } catch { setError('Failed to connect'); }
  }

  async function loadUsers() {
    const r = await fetch(`${CORE_URL}/api/admin/users`);
    if (r.ok) setUsers(await r.json());
  }

  async function loadContainers() {
    const r = await fetch(`${CORE_URL}/api/admin/containers`);
    if (r.ok) setContainers(await r.json());
  }

  async function loadBilling() {
    const r = await fetch(`${CORE_URL}/api/admin/billing`);
    if (r.ok) setBilling(await r.json());
  }

  useEffect(() => {
    void loadStats();
    void loadUsers();
    void loadContainers();
    void loadBilling();
  }, []);

  async function toggleUser(id: number, disabled: boolean) {
    await fetch(`${CORE_URL}/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_disabled: !disabled }),
    });
    await loadUsers();
  }

  async function setRole(id: number, role: string) {
    await fetch(`${CORE_URL}/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    await loadUsers();
  }

  async function containerAction(userId: number, action: 'start' | 'stop') {
    await fetch(`${CORE_URL}/api/admin/containers/${userId}/${action}`, { method: 'POST' });
    await loadContainers();
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-xl font-semibold mb-4">Admin Dashboard</div>
        <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm">{error}</div>
      </div>
    );
  }

  const tabs = ['overview', 'users', 'containers', 'billing'] as const;

  return (
    <div className="p-6 space-y-4">
      <div className="text-xl font-semibold">Admin Dashboard</div>

      <div className="flex gap-2 border-b border-white/10 pb-2">
        {tabs.map((t) => (
          <button
            key={t}
            className={`px-3 py-1.5 text-sm rounded-t capitalize ${tab === t ? 'bg-white/10 font-medium' : 'hover:bg-white/5'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && stats && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <StatCard title="Users" value={stats.counts.users} />
          <StatCard title="Conversations" value={stats.counts.conversations} />
          <StatCard title="Automations" value={stats.counts.agents} />
          <StatCard title="CPUs" value={stats.system.cpus} />
          <StatCard title="Memory" value={`${formatBytes(stats.system.freeMemory)} / ${formatBytes(stats.system.totalMemory)}`} sub="free / total" />
          <StatCard title="Uptime" value={formatUptime(stats.system.uptime)} />
          {stats.multiUser && (
            <>
              <StatCard title="Containers Running" value={stats.containers.running} />
              <StatCard title="Containers Stopped" value={stats.containers.stopped} />
              <StatCard title="Containers Total" value={stats.containers.total} />
            </>
          )}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left opacity-60">
                <th className="py-2 pr-3">ID</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Joined</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/5">
                  <td className="py-2 pr-3">{u.id}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3">{u.name || u.handle || '—'}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={u.role}
                      onChange={(e) => setRole(u.id, e.target.value)}
                      className="text-xs bg-black border border-white/10 rounded px-1 py-0.5"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${u.is_disabled ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                      {u.is_disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-xs opacity-60">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="py-2">
                    <button
                      onClick={() => toggleUser(u.id, u.is_disabled)}
                      className="text-xs px-2 py-1 bg-white/10 hover:bg-white/15 rounded"
                    >
                      {u.is_disabled ? 'Enable' : 'Disable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Containers */}
      {tab === 'containers' && (
        <div className="space-y-3">
          {containers.length === 0 ? (
            <div className="text-center py-8 opacity-40">
              {stats?.multiUser ? 'No containers provisioned yet.' : 'Multi-user mode is not enabled (MULTI_USER=true).'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left opacity-60">
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Container</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">CPU</th>
                    <th className="py-2 pr-3">Memory</th>
                    <th className="py-2 pr-3">Last Active</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {containers.map((ct) => (
                    <tr key={ct.id} className="border-b border-white/5">
                      <td className="py-2 pr-3">{ct.user_id}</td>
                      <td className="py-2 pr-3 text-xs font-mono truncate max-w-[150px]">{ct.container_id?.slice(0, 12) || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${ct.status === 'running' ? 'bg-green-500/20' : ct.status === 'stopped' ? 'bg-yellow-500/20' : 'bg-red-500/20'}`}>
                          {ct.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{ct.cpu_limit}</td>
                      <td className="py-2 pr-3">{ct.memory_limit}</td>
                      <td className="py-2 pr-3 text-xs opacity-60">{ct.last_active_at ? new Date(ct.last_active_at).toLocaleString() : '—'}</td>
                      <td className="py-2 flex gap-1">
                        {ct.status !== 'running' && (
                          <button onClick={() => containerAction(ct.user_id, 'start')} className="text-xs px-2 py-1 bg-green-500/20 hover:bg-green-500/30 rounded">
                            Start
                          </button>
                        )}
                        {ct.status === 'running' && (
                          <button onClick={() => containerAction(ct.user_id, 'stop')} className="text-xs px-2 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 rounded">
                            Stop
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Billing */}
      {tab === 'billing' && billing && (
        <div className="grid gap-3 md:grid-cols-2">
          <StatCard title="Total Revenue" value={`$${(billing.totalRevenue / 100).toFixed(2)}`} />
          <StatCard title="Total Orders" value={billing.totalOrders} />
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded border border-white/10 p-4 bg-black/20">
      <div className="text-xs opacity-60 uppercase tracking-wide">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs opacity-40 mt-0.5">{sub}</div>}
    </div>
  );
}
