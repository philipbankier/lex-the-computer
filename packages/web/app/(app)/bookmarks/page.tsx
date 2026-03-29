"use client";
import { useTabs } from '@/components/tabs/context';

export default function BookmarksPage() {
  const { open } = useTabs();
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Bookmarks</h1>
      <div className="text-center py-16">
        <div className="text-4xl mb-3 opacity-30">🔖</div>
        <p className="opacity-60 mb-3">No bookmarks yet</p>
        <p className="text-sm opacity-40 mb-4">Bookmark conversations, files, and pages for quick access</p>
        <button onClick={() => open({ title: 'Chats', href: '/chats' })}
          className="px-4 py-2 rounded bg-white/10 hover:bg-white/15 text-sm transition">Start a conversation</button>
      </div>
    </div>
  );
}
