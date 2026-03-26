"use client";
import { useTabs } from '@/components/tabs/context';

export function ChatSidebar() {
  const { chatCollapsed, setChatCollapsed } = useTabs();

  if (chatCollapsed) {
    return (
      <aside className="w-6 md:w-8 shrink-0 border-l border-white/10 flex items-center justify-center">
        <button aria-label="Expand chat" onClick={() => setChatCollapsed(false)} className="rotate-180">❮</button>
      </aside>
    );
  }
  return (
    <aside className="w-80 shrink-0 border-l border-white/10 p-3 hidden lg:flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Chat</div>
        <div className="flex gap-2">
          <button className="text-sm px-2 py-1 bg-white/10 rounded" onClick={() => setChatCollapsed(true)}>Collapse</button>
          <button className="text-sm px-2 py-1 bg-white/10 rounded">New chat</button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm opacity-80">Persona: Default</div>
        <select className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm">
          <option>gpt-4o-mini</option>
          <option>gpt-3.5</option>
        </select>
      </div>
      <div className="flex-1 rounded bg-black/30 border border-white/10" />
      <div className="space-y-2">
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded bg-white/10 text-sm">Browse files</button>
        </div>
        <div className="flex gap-2">
          <input className="flex-1 px-3 py-2 rounded bg-black/40 border border-white/10" placeholder="What can I do for you?" />
          <button className="px-3 py-2 rounded bg-white text-black">Go</button>
        </div>
        <div className="text-xs opacity-60">you.lex.space • you@domain.com • (555) 123-4567</div>
      </div>
    </aside>
  );
}

