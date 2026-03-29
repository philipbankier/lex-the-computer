"use client";
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { TabsProvider } from '@/components/tabs/context';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { TabBar } from '@/components/layout/TabBar';
import { ChatSidebar } from '@/components/layout/ChatSidebar';
import { CommandPalette } from '@/components/layout/CommandPalette';
import { ErrorBoundary } from '@/components/layout/ErrorBoundary';
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';
import { Toaster } from 'sonner';
import { applyTheme, getTheme } from '@/lib/themes';

function ThemeInitializer() {
  useEffect(() => {
    const saved = localStorage.getItem('lex-theme');
    if (saved && saved !== 'default') {
      const t = getTheme(saved);
      if (t) applyTheme(t);
    }
  }, []);
  return null;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <TabsProvider>
      <ThemeInitializer />
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <TabBar />
          <div className="flex flex-1 min-h-0">
            <main className="flex-1 min-w-0 overflow-auto">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
            <ChatSidebar />
          </div>
        </div>
      </div>
      <MobileNav />
      <CommandPalette />
      <KeyboardShortcuts />
      <Toaster theme="dark" position="bottom-right" richColors />
    </TabsProvider>
  );
}
