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
          <IntegrationsSection />
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
          <ApiKeysSection />
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

const PROVIDER_INFO: Record<string, { name: string; icon: string; description: string }> = {
  gmail: { name: 'Gmail', icon: '\u2709\uFE0F', description: 'Search, read, and send emails' },
  'google-calendar': { name: 'Google Calendar', icon: '\uD83D\uDCC5', description: 'View and manage calendar events' },
  'google-drive': { name: 'Google Drive', icon: '\uD83D\uDCC1', description: 'Search, download, and upload files' },
  notion: { name: 'Notion', icon: '\uD83D\uDCD3', description: 'Search and manage pages and databases' },
  dropbox: { name: 'Dropbox', icon: '\uD83D\uDCE6', description: 'Search, download, and upload files' },
  linear: { name: 'Linear', icon: '\uD83D\uDCCB', description: 'Search and manage issues and projects' },
  github: { name: 'GitHub', icon: '\uD83D\uDC19', description: 'Access repos, issues, and pull requests' },
};

function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [notionToken, setNotionToken] = useState('');
  const [showNotion, setShowNotion] = useState(false);
  useState(() => { void refresh(); });

  async function refresh() {
    const [iRes, pRes] = await Promise.all([
      fetch(`${CORE_URL}/api/integrations`),
      fetch(`${CORE_URL}/api/integrations/providers`),
    ]);
    setIntegrations(await iRes.json());
    setProviders(await pRes.json());
  }

  async function disconnect(id: number) {
    if (!confirm('Disconnect this integration?')) return;
    await fetch(`${CORE_URL}/api/integrations/${id}`, { method: 'DELETE' });
    await refresh();
  }

  async function testConnection(id: number) {
    const res = await fetch(`${CORE_URL}/api/integrations/${id}/test`, { method: 'POST' });
    const data = await res.json();
    alert(data.ok ? 'Connection works!' : `Connection failed: ${data.error}`);
  }

  async function connectOAuth(provider: string) {
    window.open(`${CORE_URL}/api/integrations/${provider}/auth`, '_blank', 'width=600,height=700');
    // Listen for completion message
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'integration-connected') {
        window.removeEventListener('message', handler);
        refresh();
      }
    };
    window.addEventListener('message', handler);
  }

  async function connectNotion() {
    if (!notionToken.trim()) return;
    const res = await fetch(`${CORE_URL}/api/integrations/notion/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: notionToken }),
    });
    const data = await res.json();
    if (data.ok) { setNotionToken(''); setShowNotion(false); await refresh(); }
    else alert(`Failed: ${data.error}`);
  }

  const connectedProviders = new Set(integrations.map((i: any) => i.provider));

  return (
    <>
      <Section title="Connected Integrations">
        {integrations.length === 0 && <div className="text-xs opacity-60">No integrations connected yet</div>}
        <div className="grid gap-2">
          {integrations.map((i: any) => {
            const info = PROVIDER_INFO[i.provider] || { name: i.provider, icon: '\uD83D\uDD17', description: '' };
            return (
              <div key={i.id} className="flex items-center gap-3 p-2 rounded bg-white/5">
                <span className="text-lg">{info.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{info.name}</div>
                  <div className="text-xs opacity-60 truncate">{i.account_email || i.account_name || i.label}</div>
                </div>
                <span className={`px-1.5 py-0.5 text-xs rounded ${i.permission === 'read' ? 'bg-blue-600/40' : 'bg-green-600/40'}`}>
                  {i.permission === 'read' ? 'Read Only' : 'Read & Write'}
                </span>
                <button onClick={() => testConnection(i.id)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">Test</button>
                <button onClick={() => disconnect(i.id)} className="px-2 py-1 text-xs rounded bg-red-600/40 hover:bg-red-600/60">Disconnect</button>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Available Integrations">
        <div className="grid gap-2">
          {providers.map((p: any) => {
            const info = PROVIDER_INFO[p.provider] || { name: p.provider, icon: '\uD83D\uDD17', description: '' };
            const isConnected = connectedProviders.has(p.provider);
            return (
              <div key={p.provider} className="flex items-center gap-3 p-2 rounded bg-white/5">
                <span className="text-lg">{info.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{info.name}</div>
                  <div className="text-xs opacity-60">{info.description}</div>
                </div>
                {p.provider === 'notion' ? (
                  showNotion ? (
                    <div className="flex gap-1">
                      <input value={notionToken} onChange={(e) => setNotionToken(e.target.value)} placeholder="Integration token" className="px-2 py-1 text-xs rounded bg-black/40 border border-white/10 w-48" />
                      <button onClick={connectNotion} className="px-2 py-1 text-xs rounded bg-white/10">Save</button>
                      <button onClick={() => setShowNotion(false)} className="px-2 py-1 text-xs rounded bg-white/10">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowNotion(true)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">
                      {isConnected ? '+ Add Another' : 'Connect'}
                    </button>
                  )
                ) : !p.configured ? (
                  <span className="text-xs opacity-40">Configure in .env</span>
                ) : (
                  <button onClick={() => connectOAuth(p.provider)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">
                    {isConnected ? '+ Add Another' : 'Connect'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState('');
  useState(() => { void refresh(); });

  async function refresh() {
    const r = await fetch(`${CORE_URL}/api/api-keys`);
    setKeys(await r.json());
  }

  async function create() {
    if (!name.trim()) return;
    const res = await fetch(`${CORE_URL}/api/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (data.key) { setNewKey(data.key); setName(''); await refresh(); }
  }

  async function revoke(id: number) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    await fetch(`${CORE_URL}/api/api-keys/${id}`, { method: 'DELETE' });
    await refresh();
  }

  async function toggle(id: number, active: boolean) {
    await fetch(`${CORE_URL}/api/api-keys/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !active }),
    });
    await refresh();
  }

  return (
    <Section title="API Keys">
      <div className="text-xs opacity-80 mb-2">Use API keys to access Lex programmatically via the public REST API</div>
      {newKey && (
        <div className="p-2 mb-2 rounded bg-yellow-600/20 border border-yellow-500/30">
          <div className="text-xs font-medium mb-1">New API Key (copy now — you won't see it again)</div>
          <div className="flex gap-2">
            <code className="flex-1 text-xs bg-black/40 p-1 rounded break-all">{newKey}</code>
            <button onClick={() => { navigator.clipboard.writeText(newKey); }} className="px-2 py-1 text-xs rounded bg-white/10">Copy</button>
            <button onClick={() => setNewKey('')} className="px-2 py-1 text-xs rounded bg-white/10">Dismiss</button>
          </div>
        </div>
      )}
      <div className="flex gap-2 mb-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name (e.g. My App)" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" onKeyDown={(e) => e.key === 'Enter' && create()} />
        <button onClick={create} className="px-2 py-1 text-sm rounded bg-white/10">Create</button>
      </div>
      <div className="grid gap-1">
        {keys.map((k: any) => (
          <div key={k.id} className="flex items-center gap-2 p-1.5 rounded bg-white/5 text-sm">
            <span className="font-medium">{k.name}</span>
            <code className="text-xs opacity-60">{k.key_prefix}</code>
            <span className="text-xs opacity-40">{k.last_used_at ? `Used ${new Date(k.last_used_at).toLocaleDateString()}` : 'Never used'}</span>
            <div className="flex-1" />
            <button onClick={() => toggle(k.id, k.is_active)} className={`px-1.5 py-0.5 text-xs rounded ${k.is_active ? 'bg-green-600/40' : 'bg-white/10'}`}>
              {k.is_active ? 'Active' : 'Inactive'}
            </button>
            <button onClick={() => revoke(k.id)} className="px-1.5 py-0.5 text-xs rounded bg-red-600/40 hover:bg-red-600/60">Revoke</button>
          </div>
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
