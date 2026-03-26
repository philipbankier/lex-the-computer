"use client";
import { useEffect, useState } from 'react';
import { useTabs } from '@/components/tabs/context';

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen } = useTabs();
  const [mode, setMode] = useState<'commands' | 'files'>('commands');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMode('commands');
        setPaletteOpen(!paletteOpen);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setMode('files');
        setPaletteOpen(!paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen, setPaletteOpen]);

  if (!paletteOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-40" onClick={() => setPaletteOpen(false)}>
      <div className="w-[600px] bg-neutral-900 border border-white/10 rounded p-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm mb-2">{mode === 'commands' ? 'Command Palette' : 'Go to File'}</div>
        <input autoFocus placeholder={mode === 'commands' ? 'Search for a command to run...' : 'Search for files by name'} className="w-full px-3 py-2 rounded bg-black/40 border border-white/10" />
      </div>
    </div>
  );
}
