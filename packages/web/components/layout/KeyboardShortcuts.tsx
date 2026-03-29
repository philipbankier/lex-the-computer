"use client";
import { useEffect } from 'react';
import { useTabs } from '@/components/tabs/context';

export function KeyboardShortcuts() {
  const { open, setPaletteOpen, chatCollapsed, setChatCollapsed } = useTabs();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          open({ title: 'Chats', href: '/chats' });
          break;
        case '/':
          e.preventDefault();
          setChatCollapsed(!chatCollapsed);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setPaletteOpen, chatCollapsed, setChatCollapsed]);

  return null;
}
