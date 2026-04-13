"use client";
import { useEffect, useMemo, useState } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type Site = { id: number; name: string; slug: string; is_published: boolean; port?: number | null };
type Service = { id: number; name: string; type: string; port?: number | null; is_running?: boolean };

export default function HostingShell() {
  const tabs = ['Sites', 'Services'] as const;
  const [tab, setTab] = useState<typeof tabs[number]>('Sites');
  return (
    <div className="p-6 space-y-3">
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded ${tab === t ? 'bg-white/15' : 'bg-white/10'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Sites' ? <SitesView /> : <ServicesView />}
    </div>
  );
}

function SitesView() {
  const [sites, setSites] = useState<Site[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [selected, setSelected] = useState<Site | null>(null);
  useEffect(() => { refresh(); }, []);
  async function refresh() {
    const r = await fetch(`${CORE_URL}/api/sites`);
    const j = await r.json();
    setSites(j);
  }
  function autoSlug(v: string) { setName(v); setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')); }
  async function create() {
    await fetch(`${CORE_URL}/api/sites`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, slug }) });
    setCreating(false); setName(''); setSlug(''); await refresh();
  }
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={() => setCreating(true)} className="px-3 py-1.5 bg-white/10 rounded">New Site</button>
      </div>
      {creating && (
        <div className="flex gap-2 items-center">
          <input value={name} onChange={(e) => autoSlug(e.target.value)} placeholder="Name" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
          <button onClick={create} className="px-2 py-1 text-sm rounded bg-white/10">Create</button>
          <button onClick={() => setCreating(false)} className="px-2 py-1 text-sm rounded bg-white/10">Cancel</button>
        </div>
      )}
      {!selected && (
        <div className="grid gap-2">
          {sites.map((s) => (
            <div key={s.id} className="flex justify-between items-center border border-white/10 rounded p-2">
              <div className="space-x-2">
                <span className="font-medium">{s.name}</span>
                <span className="opacity-70">{s.slug}</span>
                {s.port ? <span className="opacity-70">http://localhost:{s.port}</span> : null}
                {s.is_published ? <span className="px-1 py-0.5 text-xs rounded bg-green-600/40">published</span> : <span className="px-1 py-0.5 text-xs rounded bg-white/10">draft</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setSelected(s)} className="px-2 py-1 text-sm rounded bg-white/10">Open</button>
                {s.is_published ? (
                  <button onClick={async () => { await fetch(`${CORE_URL}/api/sites/${s.id}/unpublish`, { method: 'POST' }); await refresh(); }} className="px-2 py-1 text-sm rounded bg-white/10">Unpublish</button>
                ) : (
                  <button onClick={async () => { await fetch(`${CORE_URL}/api/sites/${s.id}/publish`, { method: 'POST' }); await refresh(); }} className="px-2 py-1 text-sm rounded bg-white/10">Publish</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {selected && <SiteEditor site={selected} onBack={() => { setSelected(null); void refresh(); }} />}
    </div>
  );
}

function SiteEditor({ site, onBack }: { site: Site; onBack: () => void }) {
  const [files, setFiles] = useState<{ name: string; type: string }[]>([]);
  const [file, setFile] = useState<string>('index.ts');
  const [content, setContent] = useState('');
  useEffect(() => { void refreshFiles(); void loadFile('index.ts'); }, [site?.id]);
  async function refreshFiles() { const r = await fetch(`${CORE_URL}/api/sites/${site.id}/files`); const j = await r.json(); setFiles(j.entries || []); }
  async function loadFile(p: string) { setFile(p); const r = await fetch(`${CORE_URL}/api/sites/${site.id}/files/content?path=${encodeURIComponent(p)}`); const j = await r.json(); setContent(j.content || ''); }
  async function save() { await fetch(`${CORE_URL}/api/sites/${site.id}/files/content`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: file, content }) }); }
  async function restart() { await fetch(`${CORE_URL}/api/sites/${site.id}/restart`, { method: 'POST' }); }
  async function del() { if (!confirm('Delete site?')) return; await fetch(`${CORE_URL}/api/sites/${site.id}`, { method: 'DELETE' }); onBack(); }
  const previewUrl = useMemo(() => (site.port ? `http://localhost:${site.port}` : ''), [site.port]);
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="border border-white/10 rounded p-2 space-y-1">
        <button onClick={onBack} className="px-2 py-1 text-sm rounded bg-white/10">Back</button>
        <div className="font-medium mt-2">Files</div>
        <div className="space-y-1 text-sm">
          {files.map((f) => (
            <div key={f.name} className="flex justify-between items-center">
              <button onClick={() => loadFile(f.name)} className={`text-left ${file === f.name ? 'underline' : ''}`}>{f.name}</button>
            </div>
          ))}
        </div>
      </div>
      <div className="col-span-2 space-y-2">
        <div className="flex gap-2">
          <button onClick={save} className="px-2 py-1 text-sm rounded bg-white/10">Save</button>
          <button onClick={restart} className="px-2 py-1 text-sm rounded bg-white/10">Restart</button>
          <button onClick={del} className="px-2 py-1 text-sm rounded bg-red-600/80">Delete</button>
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-64 p-2 rounded bg-black/40 border border-white/10 font-mono text-sm" />
        {previewUrl ? (
          <div className="border border-white/10 rounded">
            <iframe src={previewUrl} className="w-full h-64 bg-white" />
          </div>
        ) : (
          <div className="text-sm opacity-70">Publish the site to start preview.</div>
        )}
      </div>
    </div>
  );
}

function ServicesView() {
  const [services, setServices] = useState<Service[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<'http'|'tcp'>('http');
  const [port, setPort] = useState<string>('');
  const [entrypoint, setEntrypoint] = useState('');
  const [workingDir, setWorkingDir] = useState('');
  const [envVars, setEnvVars] = useState('');
  const [logs, setLogs] = useState<{ id: number; lines: string[] } | null>(null);
  useEffect(() => { refresh(); }, []);
  async function refresh() { const r = await fetch(`${CORE_URL}/api/services`); setServices(await r.json()); }
  async function create() {
    const env_vars = envVars ? JSON.parse(envVars) : undefined;
    await fetch(`${CORE_URL}/api/services`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, port: port ? Number(port) : undefined, entrypoint, working_dir: workingDir, env_vars }) });
    setName(''); setPort(''); setEntrypoint(''); setWorkingDir(''); setEnvVars(''); await refresh();
  }
  return (
    <div className="space-y-3">
      <div className="border border-white/10 rounded p-2 space-y-2">
        <div className="font-medium">New Service</div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
          <select value={type} onChange={(e) => setType(e.target.value as any)} className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10">
            <option value="http">http</option>
            <option value="tcp">tcp</option>
          </select>
          <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="Port (optional)" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        </div>
        <div className="flex gap-2">
          <input value={entrypoint} onChange={(e) => setEntrypoint(e.target.value)} placeholder="Entrypoint command" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
          <input value={workingDir} onChange={(e) => setWorkingDir(e.target.value)} placeholder="Working directory" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        </div>
        <div className="flex gap-2">
          <input value={envVars} onChange={(e) => setEnvVars(e.target.value)} placeholder='Env JSON e.g. {"KEY":"VAL"}' className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
          <button onClick={create} className="px-2 py-1 text-sm rounded bg-white/10">Create</button>
        </div>
      </div>
      <div className="grid gap-2">
        {services.map((s) => (
          <div key={s.id} className="flex justify-between items-center border border-white/10 rounded p-2">
            <div className="space-x-2">
              <span className="font-medium">{s.name}</span>
              <span className="opacity-70">{s.type}</span>
              {s.port ? <span className="opacity-70">:{s.port}</span> : null}
              {s.is_running ? <span className="px-1 py-0.5 text-xs rounded bg-green-600/40">running</span> : <span className="px-1 py-0.5 text-xs rounded bg-white/10">stopped</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={async () => { await fetch(`${CORE_URL}/api/services/${s.id}/start`, { method: 'POST' }); await refresh(); }} className="px-2 py-1 text-sm rounded bg-white/10">Start</button>
              <button onClick={async () => { await fetch(`${CORE_URL}/api/services/${s.id}/stop`, { method: 'POST' }); await refresh(); }} className="px-2 py-1 text-sm rounded bg-white/10">Stop</button>
              <button onClick={async () => { await fetch(`${CORE_URL}/api/services/${s.id}/restart`, { method: 'POST' }); await refresh(); }} className="px-2 py-1 text-sm rounded bg-white/10">Restart</button>
              <button onClick={async () => { const r = await fetch(`${CORE_URL}/api/services/${s.id}/logs`); const j = await r.json(); setLogs({ id: s.id, lines: (j.lines||[]).slice(-50) }); }} className="px-2 py-1 text-sm rounded bg-white/10">Logs</button>
            </div>
          </div>
        ))}
      </div>
      {logs && (
        <div className="border border-white/10 rounded p-2">
          <div className="flex justify-between items-center">
            <div className="font-medium">Logs for #{logs.id}</div>
            <button onClick={() => setLogs(null)} className="px-2 py-1 text-sm rounded bg-white/10">Close</button>
          </div>
          <pre className="text-xs mt-2 whitespace-pre-wrap">{logs.lines.join('\n')}</pre>
        </div>
      )}
    </div>
  );
}

