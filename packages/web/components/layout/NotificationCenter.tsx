"use client";
import { useState, useEffect, useRef } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadUnread();
    const interval = setInterval(loadUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) void loadNotifications();
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadUnread() {
    try {
      const res = await fetch(`${CORE_URL}/api/notifications/unread-count`);
      const data = await res.json();
      setUnread(data.count || 0);
    } catch { /* ignore */ }
  }

  async function loadNotifications() {
    try {
      const res = await fetch(`${CORE_URL}/api/notifications?limit=20`);
      setNotifications(await res.json());
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    await fetch(`${CORE_URL}/api/notifications/read-all`, { method: 'POST' });
    setUnread(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-1.5 rounded hover:bg-white/10 transition">
        <span className="text-sm">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-[10px] flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-neutral-900 border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs opacity-60 hover:opacity-100 transition">Mark all read</button>
            )}
          </div>
          <div className="max-h-80 overflow-auto">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-sm opacity-40">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`px-3 py-2 border-b border-white/5 ${n.read ? 'opacity-50' : ''}`}>
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-xs opacity-60 mt-0.5">{n.body}</div>}
                  <div className="text-[10px] opacity-30 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
