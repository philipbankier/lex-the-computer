"use client";
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Tab = { title: string; href: string };

type Ctx = {
  tabs: Tab[];
  activeHref: string;
  open: (tab: Tab) => void;
  close: (href: string) => void;
  setActive: (href: string) => void;
  chatCollapsed: boolean;
  setChatCollapsed: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
};

const TabsCtx = createContext<Ctx | null>(null);

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (tabs.length === 0) {
      setTabs([{ title: 'Home', href: '/home' }]);
      if (pathname !== '/home') router.replace('/home');
    }
  }, []);

  const open = (tab: Tab) => {
    setTabs((prev) => (prev.find((t) => t.href === tab.href) ? prev : [...prev, tab]));
    router.push(tab.href);
  };
  const close = (href: string) => {
    setTabs((prev) => prev.filter((t) => t.href !== href));
    if (pathname === href) {
      const remaining = tabs.filter((t) => t.href !== href);
      const fallback = remaining[remaining.length - 1] || { href: '/home' };
      router.push(fallback.href);
    }
  };
  const setActive = (href: string) => router.push(href);

  const value = useMemo<Ctx>(() => ({
    tabs,
    activeHref: pathname,
    open,
    close,
    setActive,
    chatCollapsed,
    setChatCollapsed,
    paletteOpen,
    setPaletteOpen,
  }), [tabs, pathname, chatCollapsed, paletteOpen]);

  return <TabsCtx.Provider value={value}>{children}</TabsCtx.Provider>;
}

export function useTabs() {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('useTabs must be used within TabsProvider');
  return ctx;
}

