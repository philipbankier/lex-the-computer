"use client";
import { useEffect, useState } from 'react';
import { useTabs } from '@/components/tabs/context';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:3001';

type Bookmark = { id: number; type: string; target_id: string | null; name: string; href: string | null; created_at: string };

export default function BookmarksPage() {
  const { open } = useTabs();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const r = await fetch(`${CORE_URL}/api/bookmarks`);
      setBookmarks(await r.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { void refresh(); }, []);

  async function remove(id: number) {
    await fetch(`${CORE_URL}/api/bookmarks/${id}`, { method: 'DELETE' });
    await refresh();
  }

  const tabs = bookmarks.filter((b) => b.type === 'tab');
  const files = bookmarks.filter((b) => b.type === 'file');
  const conversations = bookmarks.filter((b) => b.type === 'conversation');

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Bookmarks</h1>
        <div className="h-32 bg-white/5 rounded animate-pulse" />
      </div>
    );
  }

  if (bookmarks.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Bookmarks</h1>
        <div className="text-center py-16">
          <div className="text-4xl mb-3 opacity-30">&#x1F516;</div>
          <p className="opacity-60 mb-3">No bookmarks yet</p>
          <p className="text-sm opacity-40 mb-4">Bookmark conversations, files, and pages for quick access</p>
          <button onClick={() => open({ title: 'Chats', href: '/chats' })}
            className="px-4 py-2 rounded bg-white/10 hover:bg-white/15 text-sm transition">Start a conversation</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Bookmarks</h1>

      {tabs.length > 0 && (
        <div>
          <div className="text-xs uppercase opacity-50 mb-2 tracking-wide">Bookmarked Tabs</div>
          <div className="grid gap-2">
            {tabs.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-2 rounded bg-white/5 hover:bg-white/10 transition">
                <span className="text-sm opacity-50">&#x1F4C4;</span>
                <button className="flex-1 text-left text-sm hover:underline" onClick={() => b.href && open({ title: b.name, href: b.href })}>
                  {b.name}
                </button>
                <span className="text-xs opacity-30">{new Date(b.created_at).toLocaleDateString()}</span>
                <button onClick={() => remove(b.id)} className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-red-500/20">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <div className="text-xs uppercase opacity-50 mb-2 tracking-wide">Files</div>
          <div className="grid gap-2">
            {files.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-2 rounded bg-white/5 hover:bg-white/10 transition">
                <span className="text-sm opacity-50">&#x1F4C1;</span>
                <button className="flex-1 text-left text-sm hover:underline" onClick={() => open({ title: 'Files', href: '/files' })}>
                  {b.name}
                </button>
                <span className="text-xs opacity-30">{new Date(b.created_at).toLocaleDateString()}</span>
                <button onClick={() => remove(b.id)} className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-red-500/20">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {conversations.length > 0 && (
        <div>
          <div className="text-xs uppercase opacity-50 mb-2 tracking-wide">Conversations</div>
          <div className="grid gap-2">
            {conversations.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-2 rounded bg-white/5 hover:bg-white/10 transition">
                <span className="text-sm opacity-50">&#x1F4AC;</span>
                <button className="flex-1 text-left text-sm hover:underline" onClick={() => open({ title: 'Chats', href: '/chats' })}>
                  {b.name}
                </button>
                <span className="text-xs opacity-30">{new Date(b.created_at).toLocaleDateString()}</span>
                <button onClick={() => remove(b.id)} className="text-xs px-2 py-0.5 rounded bg-white/10 hover:bg-red-500/20">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
