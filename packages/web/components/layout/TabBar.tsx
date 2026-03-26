"use client";
import { useTabs } from '@/components/tabs/context';
import clsx from 'clsx';

export function TabBar() {
  const { tabs, activeHref, setActive, close } = useTabs();
  return (
    <div className="h-10 border-b border-white/10 flex items-center gap-1 px-2 overflow-x-auto scrollbar-hide">
      {tabs.map((t) => (
        <div key={t.href} className={clsx('flex items-center gap-2 px-3 py-1 rounded cursor-pointer', activeHref === t.href ? 'bg-white/15' : 'hover:bg-white/10')} onClick={() => setActive(t.href)}>
          <span className="text-sm whitespace-nowrap">{t.title}</span>
          <button onClick={(e) => { e.stopPropagation(); close(t.href); }} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      ))}
    </div>
  );
}

