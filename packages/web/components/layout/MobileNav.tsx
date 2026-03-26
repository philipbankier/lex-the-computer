"use client";
import { useTabs } from '@/components/tabs/context';

const items = [
  { title: 'Home', href: '/home' },
  { title: 'Files', href: '/files' },
  { title: 'Chats', href: '/chats' },
  { title: 'Settings', href: '/settings' },
];

export function MobileNav() {
  const { open } = useTabs();
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden border-t border-white/10 bg-neutral-900/70 backdrop-blur p-2 flex justify-around">
      {items.map((i) => (
        <button key={i.href} onClick={() => open(i)} className="text-sm px-3 py-1.5 rounded bg-white/10">{i.title}</button>
      ))}
    </nav>
  );
}

