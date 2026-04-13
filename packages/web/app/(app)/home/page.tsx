"use client";
import { useState, useEffect } from 'react';
import { useTabs } from '@/components/tabs/context';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const { open } = useTabs();
  const [profile, setProfile] = useState<any>({ name: '' });
  const [conversations, setConversations] = useState<any[]>([]);
  const [automations, setAutomations] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [pRes, cRes, aRes] = await Promise.all([
        fetch(`${CORE_URL}/api/profile`).then((r) => r.json()),
        fetch(`${CORE_URL}/api/chat/conversations`).then((r) => r.json()),
        fetch(`${CORE_URL}/api/automations`).then((r) => r.json()),
      ]);
      setProfile(pRes);
      setConversations((cRes.conversations || cRes || []).slice(0, 5));
      const autos = aRes.automations || aRes || [];
      setAutomations(autos.filter((a: any) => a.is_active).slice(0, 3));
      // Try to get runs
      try {
        const sRes = await fetch(`${CORE_URL}/api/system/stats`).then((r) => r.json());
        setStats(sRes);
      } catch { /* ignore */ }
    } catch { /* ignore */ }
    setLoading(false);
  }

  const quickActions = [
    { icon: '💬', label: 'New Chat', href: '/chats' },
    { icon: '📁', label: 'Upload File', href: '/files' },
    { icon: '🌐', label: 'Create Site', href: '/hosting' },
    { icon: '⚡', label: 'Create Automation', href: '/automations' },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 rounded bg-white/5 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-lg bg-white/5 animate-pulse" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-48 rounded-lg bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Greeting */}
      <h1 className="text-2xl font-semibold">
        {getGreeting()}{profile.name ? `, ${profile.name}` : ''}
      </h1>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((a) => (
          <button key={a.href} onClick={() => open({ title: a.label.replace('New ', '').replace('Create ', '').replace('Upload ', ''), href: a.href })}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-white/10 hover:bg-white/5 transition text-center">
            <span className="text-2xl">{a.icon}</span>
            <span className="text-sm font-medium">{a.label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Conversations */}
        <div className="border border-white/10 rounded-lg p-4">
          <div className="font-medium mb-3">Recent Conversations</div>
          {conversations.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm opacity-60 mb-2">No conversations yet</p>
              <button onClick={() => open({ title: 'Chats', href: '/chats' })}
                className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15 transition">Start your first chat</button>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((c: any) => (
                <button key={c.id} onClick={() => open({ title: 'Chats', href: '/chats' })}
                  className="w-full text-left p-2 rounded hover:bg-white/5 transition">
                  <div className="text-sm font-medium truncate">{c.title || 'Untitled'}</div>
                  <div className="text-xs opacity-50">{new Date(c.updated_at || c.created_at).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Automations */}
        <div className="border border-white/10 rounded-lg p-4">
          <div className="font-medium mb-3">Active Automations</div>
          {automations.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm opacity-60 mb-2">No automations set up</p>
              <button onClick={() => open({ title: 'Automations', href: '/automations' })}
                className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15 transition">Create your first automation</button>
            </div>
          ) : (
            <div className="space-y-1">
              {automations.map((a: any) => (
                <div key={a.id} className="p-2 rounded bg-white/5">
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs opacity-50">{a.schedule} · {a.delivery || 'chat'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storage Usage */}
        {stats && (
          <div className="border border-white/10 rounded-lg p-4">
            <div className="font-medium mb-3">Storage</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Disk</span>
                <span>{formatBytes(stats.disk.used)} / {formatBytes(stats.disk.total)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-white/40 rounded-full transition-all" style={{ width: `${stats.disk.percent}%` }} />
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-60">Memory</span>
                <span>{formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-white/40 rounded-full transition-all" style={{ width: `${stats.memory.percent}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="border border-white/10 rounded-lg p-4">
          <div className="font-medium mb-3">Quick Links</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { title: 'Settings', href: '/settings' },
              { title: 'Terminal', href: '/terminal' },
              { title: 'Skills', href: '/skills' },
              { title: 'Space', href: '/space' },
            ].map((l) => (
              <button key={l.href} onClick={() => open(l)}
                className="text-left p-2 text-sm rounded hover:bg-white/5 transition opacity-80 hover:opacity-100">
                {l.title}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
