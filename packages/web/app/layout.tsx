import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Lex — Your Personal AI Computer',
  description: 'Your personal AI cloud computer. One command to deploy.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
