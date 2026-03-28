"use client";
import { useState } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:3001';

const Section = ({ title, children }: any) => (
  <div className="border border-white/10 rounded p-3 space-y-2">
    <div className="font-medium">{title}</div>
    <div className="opacity-80 text-sm">{children}</div>
  </div>
);

export default function SettingsShell() {
  const tabs = ['AI', 'Channels', 'Integrations', 'UX', 'Advanced'] as const;
  const [tab, setTab] = useState<typeof tabs[number]>('AI');
  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded ${tab === t ? 'bg-white/15' : 'bg-white/10'}`}>{t}</button>
        ))}
      </div>

      {tab === 'AI' && (
        <div className="grid gap-3">
          <ModelsSection />
          <PersonasSection />
          <ProvidersSection />
          <ProfileSection />
          <RulesSection />
        </div>
      )}

      {tab === 'Channels' && (
        <div className="grid gap-3">
          <Section title="Text">Text channel config</Section>
          <Section title="Email">Email channel config</Section>
          <Section title="Telegram">Telegram config</Section>
        </div>
      )}

      {tab === 'Integrations' && (
        <div className="grid gap-3">
          <Section title="Connections">Connected integrations</Section>
          <Section title="Browser">Browser integration</Section>
          <Section title="Payments">Payments providers</Section>
        </div>
      )}

      {tab === 'UX' && (
        <div className="grid gap-3">
          <Section title="Theme">
            <div className="flex gap-2">
              <button className="px-2 py-1 text-sm rounded bg-white/10">Light</button>
              <button className="px-2 py-1 text-sm rounded bg-white/10">Dark</button>
              <button className="px-2 py-1 text-sm rounded bg-white/10">System</button>
            </div>
          </Section>
          <Section title="Keybindings">
            <button className="px-2 py-1 text-sm rounded bg-white/10">Open</button>
          </Section>
          <Section title="Show hidden files">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" /> Toggle</label>
          </Section>
        </div>
      )}

      {tab === 'Advanced' && (
        <div className="grid gap-3">
          <SecretsSection />
          <Section title="Access Tokens">
            <div className="flex gap-2">
              <input placeholder="Name" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
              <button className="px-2 py-1 text-sm rounded bg-white/10">Create</button>
            </div>
          </Section>
          <Section title="Danger Zone">
            <button className="px-2 py-1 text-sm rounded bg-red-600/80">Delete account</button>
          </Section>
        </div>
      )}
    </div>
  );
}

function ModelsSection() {
  const [models, setModels] = useState<any[]>([]);
  useState(() => { void fetch(`${CORE_URL}/api/models`).then((r) => r.json()).then((j) => setModels(j.data || [])); });
  return (
    <Section title="Models">
      <div className="flex flex-wrap gap-2">
        {models.map((m) => (
          <span key={m.id} className="px-2 py-1 rounded bg-white/10">{m.id}</span>
        ))}
      </div>
    </Section>
  );
}

function PersonasSection() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  useState(() => { void refresh(); });
  async function refresh() { const r = await fetch(`${CORE_URL}/api/personas`); setList(await r.json()); }
  async function add() { await fetch(`${CORE_URL}/api/personas`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, prompt }) }); setName(''); setPrompt(''); await refresh(); }
  return (
    <Section title="Personas">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="System prompt" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <button onClick={add} className="px-2 py-1 text-sm rounded bg-white/10">Add</button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {list.map((p) => (
          <span key={p.id} className="px-2 py-1 rounded bg-white/10">{p.name}</span>
        ))}
      </div>
    </Section>
  );
}

function RulesSection() {
  const [list, setList] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const [prompt, setPrompt] = useState('');
  useState(() => { void refresh(); });
  async function refresh() { const r = await fetch(`${CORE_URL}/api/rules`); setList(await r.json()); }
  async function add() { await fetch(`${CORE_URL}/api/rules`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, condition, prompt, is_active: true }) }); setName(''); setCondition(''); setPrompt(''); await refresh(); }
  return (
    <Section title="Rules">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Condition (optional)" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Prompt" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <button onClick={add} className="px-2 py-1 text-sm rounded bg-white/10">Add</button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {list.map((r) => (
          <span key={r.id} className="px-2 py-1 rounded bg-white/10">{r.prompt?.slice(0, 20) || 'rule'}</span>
        ))}
      </div>
    </Section>
  );
}

function ProfileSection() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  useState(() => { void fetch(`${CORE_URL}/api/profile`).then((r) => r.json()).then((j) => { setName(j.name || ''); setBio(j.bio || ''); }); });
  async function save() { await fetch(`${CORE_URL}/api/profile`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, bio }) }); }
  return (
    <Section title="Personalization">
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <button onClick={save} className="px-2 py-1 text-sm rounded bg-white/10">Save</button>
      </div>
    </Section>
  );
}

function ProvidersSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  useState(() => { void refresh(); });
  async function refresh() { const r = await fetch(`${CORE_URL}/api/settings/providers`); setRows(await r.json()); }
  async function save() { await fetch(`${CORE_URL}/api/settings/providers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, api_key: apiKey }) }); setApiKey(''); await refresh(); }
  return (
    <Section title="Providers">
      <div className="flex gap-2 items-center">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10">
          {['openai', 'anthropic', 'google', 'mistral', 'groq', 'openrouter'].map((p) => (<option key={p}>{p}</option>))}
        </select>
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <button onClick={save} className="px-2 py-1 text-sm rounded bg-white/10">Save</button>
      </div>
      <div className="flex gap-2 mt-2 flex-wrap">
        {rows.map((r) => (
          <span key={r.provider} className={`px-2 py-1 rounded ${r.configured ? 'bg-green-600/40' : 'bg-white/10'}`}>{r.provider} {r.configured ? '✓' : '—'}</span>
        ))}
      </div>
    </Section>
  );
}

function SecretsSection() {
  const [list, setList] = useState<{ key: string }[]>([]);
  const [keyName, setKeyName] = useState('');
  const [value, setValue] = useState('');
  const [envText, setEnvText] = useState('');
  useState(() => { void refresh(); });
  async function refresh() { const r = await fetch(`${CORE_URL}/api/secrets`); const j = await r.json(); setList(j.secrets || []); }
  async function add() { await fetch(`${CORE_URL}/api/secrets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: keyName, value }) }); setKeyName(''); setValue(''); await refresh(); }
  async function remove(k: string) { await fetch(`${CORE_URL}/api/secrets/${encodeURIComponent(k)}`, { method: 'DELETE' }); await refresh(); }
  async function pasteEnv() {
    const lines = envText.split(/\r?\n/).filter(Boolean);
    for (const ln of lines) {
      const m = ln.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const k = m[1];
      const v = m[2].replace(/^"|"$/g, '').replace(/^'|'$/g, '');
      await fetch(`${CORE_URL}/api/secrets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k, value: v }) });
    }
    setEnvText(''); await refresh();
  }
  return (
    <Section title="Secrets">
      <div className="text-xs opacity-80 mb-2">Environment variables available to your sites and services</div>
      <div className="flex gap-2 mb-2">
        <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder="KEY" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="VALUE" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <button onClick={add} className="px-2 py-1 text-sm rounded bg-white/10">Add</button>
      </div>
      <div className="flex gap-2 mb-2">
        <textarea value={envText} onChange={(e) => setEnvText(e.target.value)} placeholder={"Paste .env contents here"} className="w-full h-24 p-2 text-sm rounded bg-black/40 border border-white/10" />
      </div>
      <div className="flex gap-2 mb-2">
        <button onClick={pasteEnv} className="px-2 py-1 text-sm rounded bg-white/10">Paste .env</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {list.map((s) => (
          <span key={s.key} className="px-2 py-1 rounded bg-white/10 text-sm">
            {s.key}
            <button onClick={() => remove(s.key)} className="ml-2 text-red-400">×</button>
          </span>
        ))}
      </div>
    </Section>
  );
}
