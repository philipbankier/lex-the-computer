"use client";
import { useState } from 'react';

export default function SystemShell() {
  const [tab, setTab] = useState<'Stats' | 'Restore' | 'Reboot'>('Stats');
  return (
    <div className="p-6 space-y-3">
      <div className="flex gap-2">
        {(['Stats', 'Restore', 'Reboot'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded ${tab === t ? 'bg-white/15' : 'bg-white/10'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Stats' && <div className="h-[60vh] rounded border border-white/10 p-4 opacity-80">CPU, RAM, uptime (placeholder)</div>}
      {tab === 'Restore' && <div className="h-[60vh] rounded border border-white/10 p-4 opacity-80">Restore options</div>}
      {tab === 'Reboot' && <div className="h-[60vh] rounded border border-white/10 p-4 opacity-80">Reboot controls</div>}
    </div>
  );
}

