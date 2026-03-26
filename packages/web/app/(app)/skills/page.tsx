"use client";
import { useState } from 'react';

export default function SkillsShell() {
  const [tab, setTab] = useState<'installed' | 'hub'>('installed');
  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <button onClick={() => setTab('installed')} className={`px-3 py-1.5 rounded ${tab === 'installed' ? 'bg-white/15' : 'bg-white/10'}`}>Installed</button>
        <button onClick={() => setTab('hub')} className={`px-3 py-1.5 rounded ${tab === 'hub' ? 'bg-white/15' : 'bg-white/10'}`}>Hub</button>
      </div>
      {tab === 'installed' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-white/10 rounded">Open folder</button>
            <button className="px-3 py-1.5 bg-white/10 rounded">Create skill</button>
          </div>
          <div className="opacity-70">No skills installed</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input className="px-3 py-1.5 rounded bg-black/40 border border-white/10" placeholder="Search" />
            <button className="px-3 py-1.5 bg-white/10 rounded">Sort</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* empty grid */}
          </div>
        </div>
      )}
    </div>
  );
}

