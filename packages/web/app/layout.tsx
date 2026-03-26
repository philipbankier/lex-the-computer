import './globals.css';
import type { ReactNode } from 'react';
import { TabsProvider } from '@/components/tabs/context';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { TabBar } from '@/components/layout/TabBar';
import { ChatSidebar } from '@/components/layout/ChatSidebar';
import { CommandPalette } from '@/components/layout/CommandPalette';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TabsProvider>
          <div className="flex h-screen w-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <TabBar />
              <div className="flex flex-1 min-h-0">
                <main className="flex-1 min-w-0 overflow-auto">{children}</main>
                <ChatSidebar />
              </div>
            </div>
          </div>
          <MobileNav />
          <CommandPalette />
        </TabsProvider>
      </body>
    </html>
  );
}
