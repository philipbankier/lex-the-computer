"use client";
import { useState } from 'react';
import { useTabs } from '@/components/tabs/context';

const navItems = [
  { title: 'Home', href: '/home', icon: '🏠' },
  { title: 'Files', href: '/files', icon: '📁' },
  { title: 'Chats', href: '/chats', icon: '💬' },
  { title: 'More', href: '', icon: '☰' },
];

const moreItems = [
  { title: 'Automations', href: '/automations' },
  { title: 'Space', href: '/space' },
  { title: 'Skills', href: '/skills' },
  { title: 'Hosting', href: '/hosting' },
  { title: 'Datasets', href: '/datasets' },
  { title: 'System', href: '/system' },
  { title: 'Terminal', href: '/terminal' },
  { title: 'Settings', href: '/settings' },
];

export function MobileNav() {
  const { open, activeHref } = useTabs();
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      {showMore && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-16 left-2 right-2 bg-neutral-900 border border-white/10 rounded-lg p-2 grid grid-cols-2 gap-1"
            onClick={(e) => e.stopPropagation()}>
            {moreItems.map((i) => (
              <button key={i.href} onClick={() => { open(i); setShowMore(false); }}
                className={`text-left px-3 py-2.5 rounded text-sm ${activeHref === i.href ? 'bg-white/15' : 'hover:bg-white/10'}`}>
                {i.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden border-t border-white/10 bg-neutral-900/90 backdrop-blur-lg z-50 safe-area-bottom">
        <div className="flex justify-around py-1.5">
          {navItems.map((i) => (
            <button key={i.title}
              onClick={() => i.href ? open(i) : setShowMore(!showMore)}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-lg min-w-[56px] transition
                ${activeHref === i.href ? 'bg-white/10' : ''}`}>
              <span className="text-base">{i.icon}</span>
              <span className="text-[10px]">{i.title}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
