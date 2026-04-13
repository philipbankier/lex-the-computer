"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import { useTabs } from '@/components/tabs/context';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type SearchResult = {
  type: 'conversation' | 'file' | 'automation' | 'skill' | 'nav';
  title: string;
  subtitle?: string;
  href?: string;
  icon: string;
};

const NAV_ITEMS: SearchResult[] = [
  { type: 'nav', title: 'Home', href: '/home', icon: '🏠' },
  { type: 'nav', title: 'Files', href: '/files', icon: '📁' },
  { type: 'nav', title: 'Chats', href: '/chats', icon: '💬' },
  { type: 'nav', title: 'Automations', href: '/automations', icon: '⚡' },
  { type: 'nav', title: 'Space', href: '/space', icon: '🌐' },
  { type: 'nav', title: 'Skills', href: '/skills', icon: '🧩' },
  { type: 'nav', title: 'Settings', href: '/settings', icon: '⚙️' },
  { type: 'nav', title: 'Terminal', href: '/terminal', icon: '💻' },
  { type: 'nav', title: 'Hosting', href: '/hosting', icon: '🖥️' },
  { type: 'nav', title: 'Datasets', href: '/datasets', icon: '📊' },
  { type: 'nav', title: 'System', href: '/system', icon: '🔧' },
  { type: 'nav', title: 'Settings → AI', href: '/settings', subtitle: 'Models, Personas, Providers', icon: '🤖' },
  { type: 'nav', title: 'Settings → Channels', href: '/settings', subtitle: 'Telegram, Email, Discord', icon: '📡' },
  { type: 'nav', title: 'Settings → UX', href: '/settings', subtitle: 'Theme, Keybindings', icon: '🎨' },
  { type: 'nav', title: 'Sell', href: '/sell', subtitle: 'Stripe Commerce, Products, Orders', icon: '💳' },
  { type: 'nav', title: 'Admin', href: '/admin', subtitle: 'Users, Containers, System Stats', icon: '🛡️' },
];

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, open } = useTabs();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, setPaletteOpen]);

  useEffect(() => {
    if (paletteOpen) {
      setQuery('');
      setResults(NAV_ITEMS.slice(0, 8));
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [paletteOpen]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(NAV_ITEMS.slice(0, 8));
      return;
    }

    // Filter nav items first
    const lq = q.toLowerCase();
    const navMatches = NAV_ITEMS.filter((n) =>
      n.title.toLowerCase().includes(lq) || (n.subtitle?.toLowerCase().includes(lq))
    );

    setResults(navMatches.slice(0, 4));
    setSearching(true);

    try {
      const res = await fetch(`${CORE_URL}/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const apiResults: SearchResult[] = [];

      (data.conversations || []).forEach((c: any) => {
        apiResults.push({ type: 'conversation', title: c.title || 'Untitled', subtitle: new Date(c.updated_at).toLocaleDateString(), href: '/chats', icon: '💬' });
      });
      (data.files || []).forEach((f: any) => {
        apiResults.push({ type: 'file', title: f.name, subtitle: f.path, href: '/files', icon: '📄' });
      });
      (data.automations || []).forEach((a: any) => {
        apiResults.push({ type: 'automation', title: a.name, subtitle: a.schedule, href: '/automations', icon: '⚡' });
      });
      (data.skills || []).forEach((s: any) => {
        apiResults.push({ type: 'skill', title: s.name, subtitle: s.description?.slice(0, 60), href: '/skills', icon: '🧩' });
      });

      setResults([...navMatches.slice(0, 3), ...apiResults]);
    } catch { /* ignore */ }
    setSearching(false);
  }, []);

  function onQueryChange(q: string) {
    setQuery(q);
    setSelectedIdx(0);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(q), 200);
  }

  function selectResult(r: SearchResult) {
    if (r.href) {
      open({ title: r.title.replace('Settings → ', ''), href: r.href });
    }
    setPaletteOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      e.preventDefault();
      selectResult(results[selectedIdx]);
    } else if (e.key === 'Escape') {
      setPaletteOpen(false);
    }
  }

  if (!paletteOpen) return null;

  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    const key = r.type === 'nav' ? 'Navigation' : r.type === 'conversation' ? 'Conversations' : r.type === 'file' ? 'Files' : r.type === 'automation' ? 'Automations' : 'Skills';
    (grouped[key] ||= []).push(r);
  }

  let flatIdx = 0;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-32" onClick={() => setPaletteOpen(false)}>
      <div className="w-[600px] max-w-[calc(100vw-2rem)] bg-neutral-900 border border-white/10 rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-3 border-b border-white/10">
          <input ref={inputRef} autoFocus value={query} onChange={(e) => onQueryChange(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search conversations, files, automations, settings..."
            className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 outline-none text-sm" />
        </div>
        <div className="max-h-[50vh] overflow-auto py-1">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wide opacity-40">{group}</div>
              {items.map((r) => {
                const idx = flatIdx++;
                return (
                  <button key={`${r.type}-${r.title}-${idx}`} onClick={() => selectResult(r)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 transition ${idx === selectedIdx ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                    <span className="text-base">{r.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{r.title}</div>
                      {r.subtitle && <div className="text-xs opacity-40 truncate">{r.subtitle}</div>}
                    </div>
                    <span className="text-[10px] opacity-30 capitalize">{r.type}</span>
                  </button>
                );
              })}
            </div>
          ))}
          {results.length === 0 && !searching && (
            <div className="text-center py-6 opacity-40 text-sm">No results found</div>
          )}
          {searching && (
            <div className="text-center py-3 opacity-40 text-xs">Searching...</div>
          )}
        </div>
        <div className="px-3 py-2 border-t border-white/10 flex gap-3 text-[10px] opacity-40">
          <span>↑↓ Navigate</span>
          <span>Enter Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
