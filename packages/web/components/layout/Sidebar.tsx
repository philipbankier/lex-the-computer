"use client";
import Link from 'next/link';
import { useTabs } from '@/components/tabs/context';

const primary = [
  { title: 'Home', href: '/home' },
  { title: 'Files', href: '/files' },
  { title: 'Chats', href: '/chats' },
  { title: 'Automations', href: '/automations' },
  { title: 'Space', href: '/space' },
  { title: 'Skills', href: '/skills' },
];

const more = [
  { title: 'Hosting', href: '/hosting' },
  { title: 'Datasets', href: '/datasets' },
  { title: 'System', href: '/system' },
  { title: 'Terminal', href: '/terminal' },
  { title: 'Billing', href: '/billing' },
  { title: 'Resources', href: '/resources' },
  { title: 'Bookmarks', href: '/bookmarks' },
  { title: 'Settings', href: '/settings' },
];

export function Sidebar() {
  const { open, setPaletteOpen } = useTabs();
  return (
    <aside className="w-56 shrink-0 border-r border-white/10 p-3 hidden md:flex flex-col gap-2">
      <div className="text-lg font-semibold px-2 py-1">Lex</div>
      <nav className="flex-1 space-y-4">
        <div className="space-y-1">
          {primary.map((i) => (
            <Link key={i.href} href={i.href} onClick={(e) => { e.preventDefault(); open(i); }} className="block px-2 py-1 rounded hover:bg-white/10">
              {i.title}
            </Link>
          ))}
          <button onClick={() => setPaletteOpen(true)} className="w-full text-left px-2 py-1 rounded hover:bg-white/10">Search</button>
        </div>
        <div>
          <div className="px-2 text-xs uppercase opacity-60 mb-1">More</div>
          {more.map((i) => (
            <Link key={i.href} href={i.href} onClick={(e) => { e.preventDefault(); open(i); }} className="block px-2 py-1 rounded hover:bg-white/10">
              {i.title}
            </Link>
          ))}
        </div>
      </nav>
      <form action="/api/auth/logout" method="post">
        <button className="px-2 py-1 text-sm rounded bg-white/10">Logout</button>
      </form>
    </aside>
  );
}

