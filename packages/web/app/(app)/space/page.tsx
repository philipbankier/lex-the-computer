"use client";
import { useEffect, useState, useCallback, useRef } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:3001';

type SpaceRoute = { id: number; path: string; type: 'page' | 'api'; code: string; is_public: boolean; created_at: string; updated_at: string };
type RouteVersion = { id: number; route_id: number; code: string; version: number; created_at: string };
type SpaceAsset = { id: number; filename: string; path: string; mime_type: string | null; size: number; created_at: string };
type SpaceSettings = { id?: number; handle: string; title: string; description: string; favicon: string; custom_css: string };
type SpaceError = { id: number; route_id: number; error: string; stack: string | null; created_at: string };

type Tab = 'editor' | 'history' | 'assets' | 'settings' | 'errors';

export default function SpacePage() {
  const [routes, setRoutes] = useState<SpaceRoute[]>([]);
  const [selected, setSelected] = useState<SpaceRoute | null>(null);
  const [code, setCode] = useState('');
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>('editor');
  const [showNew, setShowNew] = useState(false);
  const [newPath, setNewPath] = useState('/');
  const [newType, setNewType] = useState<'page' | 'api'>('page');

  // History
  const [versions, setVersions] = useState<RouteVersion[]>([]);

  // Assets
  const [assets, setAssets] = useState<SpaceAsset[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings
  const [settings, setSettings] = useState<SpaceSettings>({ handle: '', title: '', description: '', favicon: '', custom_css: '' });

  // Errors
  const [errors, setErrors] = useState<SpaceError[]>([]);

  // ── Data fetching ──

  const refreshRoutes = useCallback(async () => {
    const r = await fetch(`${CORE_URL}/api/space/routes`);
    const j = await r.json();
    setRoutes(j || []);
  }, []);

  const refreshAssets = useCallback(async () => {
    const r = await fetch(`${CORE_URL}/api/space/assets`);
    const j = await r.json();
    setAssets(j || []);
  }, []);

  const refreshSettings = useCallback(async () => {
    const r = await fetch(`${CORE_URL}/api/space/settings`);
    const j = await r.json();
    setSettings(j || { handle: '', title: '', description: '', favicon: '', custom_css: '' });
  }, []);

  const refreshErrors = useCallback(async () => {
    const r = await fetch(`${CORE_URL}/api/space/errors`);
    const j = await r.json();
    setErrors(j || []);
  }, []);

  const refreshHistory = useCallback(async (routeId: number) => {
    const r = await fetch(`${CORE_URL}/api/space/routes/${routeId}/history`);
    const j = await r.json();
    setVersions(j || []);
  }, []);

  useEffect(() => { void refreshRoutes(); void refreshAssets(); void refreshSettings(); void refreshErrors(); }, [refreshRoutes, refreshAssets, refreshSettings, refreshErrors]);

  // ── Route actions ──

  function selectRoute(route: SpaceRoute) {
    setSelected(route);
    setCode(route.code);
    setDirty(false);
    setTab('editor');
    void refreshHistory(route.id);
  }

  async function createRoute() {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    await fetch(`${CORE_URL}/api/space/routes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: trimmed, type: newType }),
    });
    setShowNew(false);
    setNewPath('/');
    setNewType('page');
    await refreshRoutes();
  }

  async function saveCode() {
    if (!selected) return;
    const r = await fetch(`${CORE_URL}/api/space/routes/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const updated = await r.json();
    setSelected(updated);
    setDirty(false);
    await refreshRoutes();
    await refreshHistory(selected.id);
  }

  async function togglePublic() {
    if (!selected) return;
    const r = await fetch(`${CORE_URL}/api/space/routes/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: !selected.is_public }),
    });
    const updated = await r.json();
    setSelected(updated);
    await refreshRoutes();
  }

  async function deleteRoute() {
    if (!selected) return;
    await fetch(`${CORE_URL}/api/space/routes/${selected.id}`, { method: 'DELETE' });
    setSelected(null);
    setCode('');
    await refreshRoutes();
  }

  async function undoRoute() {
    if (!selected) return;
    const r = await fetch(`${CORE_URL}/api/space/routes/${selected.id}/undo`, { method: 'POST' });
    const updated = await r.json();
    if (updated.code) {
      setSelected(updated);
      setCode(updated.code);
      setDirty(false);
    }
    await refreshHistory(selected.id);
  }

  async function redoRoute() {
    if (!selected) return;
    const r = await fetch(`${CORE_URL}/api/space/routes/${selected.id}/redo`, { method: 'POST' });
    const updated = await r.json();
    if (updated.code) {
      setSelected(updated);
      setCode(updated.code);
      setDirty(false);
    }
    await refreshHistory(selected.id);
  }

  // ── Asset actions ──

  async function uploadAsset(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    await fetch(`${CORE_URL}/api/space/assets`, { method: 'POST', body: formData });
    await refreshAssets();
  }

  async function deleteAsset(id: number) {
    await fetch(`${CORE_URL}/api/space/assets/${id}`, { method: 'DELETE' });
    await refreshAssets();
  }

  // ── Settings actions ──

  async function saveSettings() {
    await fetch(`${CORE_URL}/api/space/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    await refreshSettings();
  }

  // ── Error actions ──

  async function clearErrors() {
    await fetch(`${CORE_URL}/api/space/errors`, { method: 'DELETE' });
    await refreshErrors();
  }

  // ── Keyboard shortcut ──

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (dirty && selected) void saveCode();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // ── Group routes ──

  const pages = routes.filter((r) => r.type === 'page');
  const apis = routes.filter((r) => r.type === 'api');

  const spaceUrl = settings.handle ? `/space/${settings.handle}` : null;

  return (
    <div className="flex h-full">
      {/* Left sidebar — route list */}
      <div className="w-64 border-r border-white/10 flex flex-col shrink-0">
        <div className="p-3 border-b border-white/10 space-y-2">
          <div className="flex gap-2">
            <button className="flex-1 px-2 py-1.5 text-xs rounded bg-white text-black" onClick={() => { setNewType('page'); setShowNew(true); }}>+ Page</button>
            <button className="flex-1 px-2 py-1.5 text-xs rounded bg-white/10" onClick={() => { setNewType('api'); setShowNew(true); }}>+ API</button>
          </div>
          {spaceUrl && <div className="text-xs opacity-50 truncate">{spaceUrl}</div>}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {pages.length > 0 && (
            <div>
              <div className="text-xs font-semibold opacity-50 px-1 mb-1">PAGES</div>
              {pages.map((r) => (
                <button key={r.id} className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${selected?.id === r.id ? 'bg-white/15' : 'hover:bg-white/5'}`} onClick={() => selectRoute(r)}>
                  <span className="opacity-50">&#x25A1;</span>
                  <span className="truncate flex-1">{r.path}</span>
                  {r.is_public && <span className="text-[10px] px-1 rounded bg-green-500/20 text-green-300">public</span>}
                </button>
              ))}
            </div>
          )}
          {apis.length > 0 && (
            <div>
              <div className="text-xs font-semibold opacity-50 px-1 mb-1">APIs</div>
              {apis.map((r) => (
                <button key={r.id} className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 ${selected?.id === r.id ? 'bg-white/15' : 'hover:bg-white/5'}`} onClick={() => selectRoute(r)}>
                  <span className="opacity-50">&#x26A1;</span>
                  <span className="truncate flex-1">{r.path}</span>
                  <span className="text-[10px] px-1 rounded bg-blue-500/20 text-blue-300">api</span>
                </button>
              ))}
            </div>
          )}
          {routes.length === 0 && <div className="text-sm opacity-40 text-center py-4">No routes yet</div>}
        </div>
      </div>

      {/* Right content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Tab bar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10">
          {(['editor', 'history', 'assets', 'settings', 'errors'] as Tab[]).map((t) => (
            <button key={t} className={`px-3 py-1 text-sm rounded ${tab === t ? 'bg-white/15' : 'hover:bg-white/5'}`} onClick={() => setTab(t)}>
              {t === 'errors' ? `Errors${errors.length ? ` (${errors.length})` : ''}` : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Editor tab */}
        {tab === 'editor' && (
          <div className="flex-1 flex flex-col">
            {selected ? (
              <>
                {/* Toolbar */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                  <span className="text-sm font-medium">{selected.path}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${selected.type === 'api' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>{selected.type}</span>
                  <div className="flex-1" />
                  <button className="text-xs px-2 py-1 bg-white/10 rounded" onClick={undoRoute} title="Undo">Undo</button>
                  <button className="text-xs px-2 py-1 bg-white/10 rounded" onClick={redoRoute} title="Redo">Redo</button>
                  <button className={`text-xs px-2 py-1 rounded ${selected.is_public ? 'bg-green-500/20 text-green-300' : 'bg-white/10'}`} onClick={togglePublic}>
                    {selected.is_public ? 'Public' : 'Private'}
                  </button>
                  {spaceUrl && selected.is_public && (
                    <a href={`${CORE_URL}${spaceUrl}${selected.path === '/' ? '' : selected.path}`} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 bg-white/10 rounded">Preview</a>
                  )}
                  <button className={`text-xs px-2 py-1 rounded ${dirty ? 'bg-white text-black' : 'bg-white/10'}`} onClick={saveCode} disabled={!dirty}>Save</button>
                  <button className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded" onClick={deleteRoute}>Delete</button>
                </div>
                {/* Code editor (textarea fallback — Monaco can be added later) */}
                <textarea
                  className="flex-1 w-full p-4 bg-black/30 font-mono text-sm resize-none focus:outline-none"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setDirty(true); }}
                  spellCheck={false}
                />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm opacity-40">
                Select a route or create a new one
              </div>
            )}
          </div>
        )}

        {/* History tab */}
        {tab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {selected ? (
              versions.length > 0 ? (
                versions.slice().reverse().map((v) => (
                  <div key={v.id} className={`p-3 rounded border ${v.code === selected.code ? 'border-white/30 bg-white/5' : 'border-white/10'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">Version {v.version}</div>
                      <div className="text-xs opacity-50">{new Date(v.created_at).toLocaleString()}</div>
                    </div>
                    <pre className="text-xs opacity-60 mt-2 max-h-24 overflow-hidden">{v.code.slice(0, 300)}{v.code.length > 300 ? '...' : ''}</pre>
                  </div>
                ))
              ) : (
                <div className="text-sm opacity-40 text-center py-4">No version history</div>
              )
            ) : (
              <div className="text-sm opacity-40 text-center py-4">Select a route to view history</div>
            )}
          </div>
        )}

        {/* Assets tab */}
        {tab === 'assets' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-sm bg-white text-black rounded" onClick={() => fileInputRef.current?.click()}>Upload Asset</button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAsset(f); e.target.value = ''; }} />
            </div>
            {assets.length > 0 ? (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {assets.map((a) => (
                  <div key={a.id} className="border border-white/10 rounded p-3 space-y-2">
                    {a.mime_type?.startsWith('image/') ? (
                      <img src={`${CORE_URL}/public/space/assets/${a.filename}`} alt={a.filename} className="w-full h-24 object-cover rounded" />
                    ) : (
                      <div className="w-full h-24 bg-white/5 rounded flex items-center justify-center text-xs opacity-50">{a.filename}</div>
                    )}
                    <div className="text-xs truncate">{a.filename}</div>
                    <div className="flex gap-2">
                      <button className="text-xs px-2 py-1 bg-white/10 rounded flex-1" onClick={() => navigator.clipboard.writeText(`${CORE_URL}/public/space/assets/${a.filename}`)}>Copy URL</button>
                      <button className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded" onClick={() => deleteAsset(a.id)}>Del</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm opacity-40 text-center py-4">No assets uploaded</div>
            )}
          </div>
        )}

        {/* Settings tab */}
        {tab === 'settings' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-xl">
            <div className="space-y-1">
              <div className="text-sm">Handle (subdomain)</div>
              <input className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-sm" value={settings.handle} onChange={(e) => setSettings({ ...settings, handle: e.target.value })} placeholder="myhandle" />
              {settings.handle && <div className="text-xs opacity-40">Public URL: /space/{settings.handle}</div>}
            </div>
            <div className="space-y-1">
              <div className="text-sm">Title</div>
              <input className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-sm" value={settings.title} onChange={(e) => setSettings({ ...settings, title: e.target.value })} placeholder="My Space" />
            </div>
            <div className="space-y-1">
              <div className="text-sm">Description</div>
              <textarea className="w-full h-20 px-3 py-2 bg-black/40 border border-white/10 rounded text-sm" value={settings.description} onChange={(e) => setSettings({ ...settings, description: e.target.value })} />
            </div>
            <div className="space-y-1">
              <div className="text-sm">Custom CSS</div>
              <textarea className="w-full h-32 px-3 py-2 bg-black/40 border border-white/10 rounded text-sm font-mono" value={settings.custom_css} onChange={(e) => setSettings({ ...settings, custom_css: e.target.value })} />
            </div>
            <button className="px-4 py-2 bg-white text-black rounded text-sm" onClick={saveSettings}>Save Settings</button>
          </div>
        )}

        {/* Errors tab */}
        {tab === 'errors' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {errors.length > 0 && (
              <div className="flex justify-end">
                <button className="text-xs px-3 py-1.5 bg-red-500/20 text-red-300 rounded" onClick={clearErrors}>Clear All</button>
              </div>
            )}
            {errors.length > 0 ? (
              errors.map((e) => {
                const route = routes.find((r) => r.id === e.route_id);
                return (
                  <div key={e.id} className="border border-red-500/20 rounded p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <button className="text-sm text-red-300 hover:underline" onClick={() => { const r = routes.find((rt) => rt.id === e.route_id); if (r) selectRoute(r); }}>{route?.path || `route #${e.route_id}`}</button>
                      <div className="text-xs opacity-50">{new Date(e.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-sm text-red-400">{e.error}</div>
                    {e.stack && <pre className="text-xs opacity-40 max-h-20 overflow-hidden">{e.stack}</pre>}
                  </div>
                );
              })
            ) : (
              <div className="text-sm opacity-40 text-center py-4">No errors</div>
            )}
          </div>
        )}
      </div>

      {/* New route modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-black border border-white/10 rounded p-4 space-y-3">
            <div className="text-lg font-semibold">New {newType === 'api' ? 'API Endpoint' : 'Page'}</div>
            <div className="space-y-1">
              <div className="text-sm">Path</div>
              <input className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/" autoFocus />
            </div>
            <div className="space-y-1">
              <div className="text-sm">Type</div>
              <div className="flex gap-2">
                <button className={`flex-1 px-3 py-2 rounded text-sm ${newType === 'page' ? 'bg-white text-black' : 'bg-white/10'}`} onClick={() => setNewType('page')}>Page</button>
                <button className={`flex-1 px-3 py-2 rounded text-sm ${newType === 'api' ? 'bg-white text-black' : 'bg-white/10'}`} onClick={() => setNewType('api')}>API</button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 bg-white/10 rounded text-sm" onClick={() => setShowNew(false)}>Cancel</button>
              <button className="px-3 py-1.5 bg-white text-black rounded text-sm" onClick={createRoute}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
