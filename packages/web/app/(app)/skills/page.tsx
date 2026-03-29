"use client";
import { useEffect, useState, useCallback } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:3001';

type InstalledSkill = {
  id: number;
  name: string;
  description: string | null;
  author: string | null;
  version: string | null;
  icon: string | null;
  directory: string | null;
  source: string;
  hub_id: number | null;
  is_active: boolean;
  installed_at: string;
};

type HubSkill = {
  id: number;
  name: string;
  description: string | null;
  author: string | null;
  version: string | null;
  icon: string | null;
  tags: string[];
  downloads: number;
  readme: string | null;
  skill_md: string | null;
  isInstalled?: boolean;
};

export default function SkillsPage() {
  const [tab, setTab] = useState<'installed' | 'hub'>('installed');
  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Skills</h1>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => setTab('installed')}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === 'installed' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
        >
          Installed
        </button>
        <button
          onClick={() => setTab('hub')}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${tab === 'hub' ? 'bg-white/15 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
        >
          Hub
        </button>
      </div>
      {tab === 'installed' ? <InstalledTab /> : <HubTab />}
    </div>
  );
}

// --- Installed Tab ---

function InstalledTab() {
  const [skills, setSkills] = useState<InstalledSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${CORE_URL}/api/skills`);
      const data = await r.json();
      setSkills(Array.isArray(data) ? data : []);
    } catch { setSkills([]); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleCreate() {
    if (!name.trim()) return;
    await fetch(`${CORE_URL}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    setCreating(false);
    setName('');
    setDescription('');
    await refresh();
  }

  async function handleToggle(id: number) {
    await fetch(`${CORE_URL}/api/skills/${id}/toggle`, { method: 'PUT' });
    await refresh();
  }

  async function handleUninstall(id: number, skillName: string) {
    if (!confirm(`Uninstall "${skillName}"? This will delete the skill directory.`)) return;
    await fetch(`${CORE_URL}/api/skills/${id}`, { method: 'DELETE' });
    await refresh();
  }

  if (loading) return <div className="opacity-50">Loading skills...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setCreating(!creating)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded text-sm transition-colors"
        >
          + Create Skill
        </button>
        <a href="/files?path=skills" className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded text-sm transition-colors inline-flex items-center">
          Open Folder
        </a>
      </div>

      {creating && (
        <div className="border border-white/10 rounded-lg p-4 space-y-3 bg-white/5">
          <div className="text-sm font-medium">Create New Skill</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Skill name"
            className="w-full px-3 py-2 rounded bg-black/40 border border-white/10 text-sm focus:border-white/30 outline-none"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this skill do?"
            className="w-full h-20 px-3 py-2 rounded bg-black/40 border border-white/10 text-sm resize-none focus:border-white/30 outline-none"
          />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-3 py-1.5 bg-blue-600/60 hover:bg-blue-600/80 rounded text-sm transition-colors">Create</button>
            <button onClick={() => { setCreating(false); setName(''); setDescription(''); }} className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded text-sm transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {skills.length === 0 ? (
        <div className="text-center py-12 opacity-60">
          <div className="text-4xl mb-3">🧩</div>
          <div className="text-sm">No skills installed. Browse the Hub to get started.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {skills.map((s) => (
            <SkillCard
              key={s.id}
              icon={s.icon || '⚙️'}
              name={s.name}
              author={s.author || 'user'}
              description={s.description || ''}
              version={s.version || '1.0.0'}
              isActive={s.is_active}
              source={s.source}
              onToggle={() => handleToggle(s.id)}
              onUninstall={() => handleUninstall(s.id, s.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Hub Tab ---

function HubTab() {
  const [skills, setSkills] = useState<HubSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [installing, setInstalling] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (activeTag) params.set('tags', activeTag);
      const r = await fetch(`${CORE_URL}/api/skills/hub/list?${params}`);
      const data = await r.json();
      setSkills(Array.isArray(data) ? data : []);
    } catch { setSkills([]); }
    setLoading(false);
  }, [query, activeTag]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleInstall(hubId: number) {
    setInstalling(hubId);
    try {
      await fetch(`${CORE_URL}/api/skills/hub/${hubId}/install`, { method: 'POST' });
      await refresh();
    } catch {}
    setInstalling(null);
  }

  // Collect all unique tags
  const allTags = Array.from(new Set(skills.flatMap((s) => s.tags || [])));

  if (loading) return <div className="opacity-50">Loading hub...</div>;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills..."
          className="flex-1 px-3 py-2 rounded bg-black/40 border border-white/10 text-sm focus:border-white/30 outline-none"
        />
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="px-2 py-1 text-xs rounded bg-white/20 text-white"
            >
              All
            </button>
          )}
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`px-2 py-1 text-xs rounded transition-colors ${activeTag === tag ? 'bg-blue-600/60 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Skills grid */}
      {skills.length === 0 ? (
        <div className="text-center py-12 opacity-60">
          <div className="text-sm">No skills found{query ? ` for "${query}"` : ''}.</div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {skills.map((s) => (
              <HubSkillCard
                key={s.id}
                skill={s}
                isExpanded={expandedId === s.id}
                isInstalling={installing === s.id}
                onToggleExpand={() => setExpandedId(expandedId === s.id ? null : s.id)}
                onInstall={() => handleInstall(s.id)}
              />
            ))}
          </div>
          <div className="text-center pt-2">
            <a
              href="https://github.com/lex-the-computer/skills"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              Submit a Skill →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Reusable Skill Card (Installed) ---

function SkillCard({
  icon, name, author, description, version, isActive, source, onToggle, onUninstall,
}: {
  icon: string;
  name: string;
  author: string;
  description: string;
  version: string;
  isActive: boolean;
  source: string;
  onToggle: () => void;
  onUninstall: () => void;
}) {
  return (
    <div className={`border rounded-lg p-4 space-y-2 transition-colors ${isActive ? 'border-white/15 bg-white/5' : 'border-white/10 bg-white/[0.02] opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <div>
            <div className="font-medium text-sm">{name}</div>
            <div className="text-xs text-white/40">{author} · v{version}</div>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`w-8 h-4 rounded-full relative transition-colors ${isActive ? 'bg-green-500/60' : 'bg-white/20'}`}
          title={isActive ? 'Disable' : 'Enable'}
        >
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isActive ? 'left-4' : 'left-0.5'}`} />
        </button>
      </div>
      <div className="text-xs text-white/60 line-clamp-2">{description || 'No description'}</div>
      <div className="flex items-center justify-between pt-1">
        <span className={`text-xs px-1.5 py-0.5 rounded ${source === 'hub' ? 'bg-blue-600/20 text-blue-400' : 'bg-white/10 text-white/50'}`}>
          {source}
        </span>
        <button
          onClick={onUninstall}
          className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
        >
          Uninstall
        </button>
      </div>
    </div>
  );
}

// --- Hub Skill Card ---

function HubSkillCard({
  skill, isExpanded, isInstalling, onToggleExpand, onInstall,
}: {
  skill: HubSkill;
  isExpanded: boolean;
  isInstalling: boolean;
  onToggleExpand: () => void;
  onInstall: () => void;
}) {
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden bg-white/5 hover:border-white/20 transition-colors">
      <div className="p-4 space-y-2 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{skill.icon || '⚙️'}</span>
            <div>
              <div className="font-medium text-sm">{skill.name}</div>
              <div className="text-xs text-white/40">{skill.author} · v{skill.version}</div>
            </div>
          </div>
          {skill.isInstalled ? (
            <span className="text-xs px-2 py-1 rounded bg-green-600/20 text-green-400">Installed ✓</span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onInstall(); }}
              disabled={isInstalling}
              className="text-xs px-3 py-1 rounded bg-blue-600/60 hover:bg-blue-600/80 text-white transition-colors disabled:opacity-50"
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          )}
        </div>
        <div className="text-xs text-white/60 line-clamp-2">{skill.description || 'No description'}</div>
        <div className="flex items-center gap-2">
          {(skill.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50">{tag}</span>
          ))}
          {skill.downloads > 0 && (
            <span className="text-[10px] text-white/30 ml-auto">{skill.downloads} installs</span>
          )}
        </div>
      </div>

      {/* Expanded detail view */}
      {isExpanded && (
        <div className="border-t border-white/10 p-4 space-y-3 bg-black/20">
          {skill.readme && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-white/50">About</div>
              <div className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{skill.readme}</div>
            </div>
          )}
          {skill.skill_md && (
            <details className="text-xs">
              <summary className="cursor-pointer text-white/50 hover:text-white/70 transition-colors">
                View SKILL.md (AI instructions)
              </summary>
              <pre className="mt-2 p-3 rounded bg-black/40 text-white/60 overflow-x-auto text-[11px] leading-relaxed max-h-64 overflow-y-auto">
                {skill.skill_md}
              </pre>
            </details>
          )}
          <div className="flex items-center justify-between pt-1">
            {!skill.isInstalled ? (
              <button
                onClick={onInstall}
                disabled={isInstalling}
                className="text-xs px-3 py-1.5 rounded bg-blue-600/60 hover:bg-blue-600/80 text-white transition-colors disabled:opacity-50"
              >
                {isInstalling ? 'Installing...' : 'Install Skill'}
              </button>
            ) : (
              <span className="text-xs text-green-400">✓ Installed</span>
            )}
            <a
              href="https://github.com/lex-the-computer/skills"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Source ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
