"use client";
import { useState } from 'react';
import { themes, applyTheme, getTheme } from '@/lib/themes';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

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

      {tab === 'AI' && <AISettingsTab />}

      {tab === 'Channels' && <ChannelsTab />}

      {tab === 'Integrations' && <IntegrationsTab />}

      {tab === 'UX' && (
        <div className="grid gap-3">
          <ThemeSection />
          <KeybindingsSection />
          <Section title="Show hidden files">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" /> Toggle</label>
          </Section>
        </div>
      )}

      {tab === 'Advanced' && (
        <div className="grid gap-3">
          <SecretsSection />
          <ApiKeysSection />
          <DomainsSection />
          <SSHSection />
          <Section title="Danger Zone">
            <button className="px-2 py-1 text-sm rounded bg-red-600/80">Delete account</button>
          </Section>
        </div>
      )}
    </div>
  );
}

// ─── AI Settings Tab with sub-nav ──────────────────────────────────
function AISettingsTab() {
  const subs = ['Models', 'Personas', 'Providers', 'Personalization', 'Rules'] as const;
  const [sub, setSub] = useState<typeof subs[number]>('Models');
  return (
    <div className="flex gap-6">
      <div className="w-40 shrink-0 space-y-1">
        {subs.map((s) => (
          <button key={s} onClick={() => setSub(s)} className={`w-full text-left px-3 py-1.5 rounded text-sm ${sub === s ? 'bg-white/15 font-medium' : 'hover:bg-white/5'}`}>{s}</button>
        ))}
      </div>
      <div className="flex-1 grid gap-3">
        {sub === 'Models' && <ModelsSection />}
        {sub === 'Personas' && <PersonasSection />}
        {sub === 'Providers' && <ProvidersSection />}
        {sub === 'Personalization' && <PersonalizationSection />}
        {sub === 'Rules' && <RulesSection />}
      </div>
    </div>
  );
}

// ─── Integrations Tab with sub-tabs ──────────────────────────────────
function IntegrationsTab() {
  const subs = ['Connections', 'Browser', 'Payments'] as const;
  const [sub, setSub] = useState<typeof subs[number]>('Connections');
  return (
    <div className="space-y-3">
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {subs.map((s) => (
          <button key={s} onClick={() => setSub(s)} className={`px-3 py-1.5 text-sm rounded-t ${sub === s ? 'bg-white/10 font-medium' : 'hover:bg-white/5'}`}>{s}</button>
        ))}
      </div>
      {sub === 'Connections' && <div className="grid gap-3"><IntegrationsSection /></div>}
      {sub === 'Browser' && <div className="grid gap-3"><BrowserSection /></div>}
      {sub === 'Payments' && <div className="grid gap-3"><PaymentsSection /></div>}
    </div>
  );
}

function PaymentsSection() {
  return (
    <Section title="Payments (Stripe Connect)">
      <div className="text-xs opacity-80 mb-2">Connect your Stripe account to sell products and services with 0% platform fee</div>
      <a href={`${CORE_URL}/api/sell/connect`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 inline-block">Connect Stripe Account</a>
    </Section>
  );
}

// ─── Channels Tab with new UX pattern ──────────────────────────────────
function ChannelsTab() {
  return (
    <div className="grid gap-3">
      <ChannelsSection />
    </div>
  );
}

const CHANNEL_TYPES_FOR_CONFIG = [
  { type: 'chat', name: 'Chat', icon: '\uD83D\uDCAC', detail: 'Web chat interface' },
  { type: 'text', name: 'Text', icon: '\uD83D\uDCF1', detail: 'SMS / phone number' },
  { type: 'email', name: 'Email', icon: '\u2709\uFE0F', detail: 'Email channel' },
  { type: 'telegram', name: 'Telegram', icon: '\u2708\uFE0F', detail: 'Telegram bot' },
  { type: 'discord', name: 'Discord', icon: '\uD83C\uDFAE', detail: 'Discord bot' },
];

function ModelsSection() {
  const [models, setModels] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);

  useState(() => {
    void Promise.all([
      fetch(`${CORE_URL}/api/models`).then((r) => r.json()).then((j) => setModels(j.data || [])),
      fetch(`${CORE_URL}/api/personas`).then((r) => r.json()).then((j) => setPersonas(j || [])),
      fetch(`${CORE_URL}/api/channel-configs`).then((r) => r.json()).then((j) => setConfigs(j || [])),
    ]);
  });

  function getConfig(channelType: string) {
    return configs.find((c: any) => c.channel_type === channelType) || {};
  }

  async function updateConfig(channelType: string, field: string, value: string | number | null) {
    const res = await fetch(`${CORE_URL}/api/channel-configs/${channelType}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    });
    const updated = await res.json();
    setConfigs((prev) => {
      const filtered = prev.filter((c: any) => c.channel_type !== channelType);
      return [...filtered, updated];
    });
  }

  return (
    <Section title="Models">
      <div className="text-xs opacity-60 mb-3">Configure which model and persona to use for each channel</div>
      <div className="space-y-2">
        {CHANNEL_TYPES_FOR_CONFIG.map((ch) => {
          const cfg = getConfig(ch.type);
          return (
            <div key={ch.type} className="flex items-center gap-3 p-2.5 rounded bg-white/5">
              <span className="text-lg w-7 text-center">{ch.icon}</span>
              <div className="w-24">
                <div className="text-sm font-medium">{ch.name}</div>
                <div className="text-[10px] opacity-40">{ch.detail}</div>
              </div>
              <select
                value={cfg.persona_id || ''}
                onChange={(e) => updateConfig(ch.type, 'persona_id', e.target.value ? Number(e.target.value) : null)}
                className="px-2 py-1 text-xs rounded bg-black/40 border border-white/10 min-w-[120px]"
              >
                <option value="">Default persona</option>
                {personas.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select
                value={cfg.model || ''}
                onChange={(e) => updateConfig(ch.type, 'model', e.target.value || null)}
                className="px-2 py-1 text-xs rounded bg-black/40 border border-white/10 min-w-[160px]"
              >
                <option value="">Default model</option>
                {models.map((m: any) => <option key={m.id} value={m.id}>{m.id}</option>)}
              </select>
            </div>
          );
        })}
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

const SOCIAL_PLATFORMS = [
  { key: 'twitter', label: 'X / Twitter', icon: '\uD835\uDD4F' },
  { key: 'linkedin', label: 'LinkedIn', icon: 'in' },
  { key: 'github', label: 'GitHub', icon: '\uD83D\uDC19' },
  { key: 'instagram', label: 'Instagram', icon: '\uD83D\uDCF7' },
  { key: 'bluesky', label: 'Bluesky', icon: '\uD83E\uDD4B' },
  { key: 'substack', label: 'Substack', icon: '\u270D\uFE0F' },
];

function PersonalizationSection() {
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState<Record<string, string>>({});
  const [language, setLanguage] = useState('');
  const [timezone, setTimezone] = useState('');
  const [shareLocation, setShareLocation] = useState(false);

  useState(() => {
    void fetch(`${CORE_URL}/api/profile`).then((r) => r.json()).then((j) => {
      setName(j.name || '');
      setBio(j.bio || '');
      setSocials(j.social_links || {});
      setLanguage(j.language || '');
      setTimezone(j.timezone || '');
      setShareLocation(j.share_location || false);
    });
  });

  async function save() {
    await fetch(`${CORE_URL}/api/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, bio, social_links: socials, language, timezone, share_location: shareLocation }),
    });
  }

  return (
    <Section title="Personalization">
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="text-sm">Name</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-2 py-1.5 text-sm rounded bg-black/40 border border-white/10" />
        </div>
        <div className="space-y-1">
          <div className="text-sm">Bio</div>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio..." className="w-full h-20 px-2 py-1.5 text-sm rounded bg-black/40 border border-white/10" />
        </div>

        <div className="space-y-1">
          <div className="text-sm">Social Profiles</div>
          <div className="flex flex-wrap gap-2">
            {SOCIAL_PLATFORMS.map((p) => (
              <div key={p.key} className="flex items-center gap-1.5">
                <span className="text-sm w-5 text-center">{p.icon}</span>
                <input
                  value={socials[p.key] || ''}
                  onChange={(e) => setSocials({ ...socials, [p.key]: e.target.value })}
                  placeholder={p.label}
                  className="w-36 px-2 py-1 text-xs rounded bg-black/40 border border-white/10"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="space-y-1 flex-1">
            <div className="text-sm">Language</div>
            <input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. Canadian English" className="w-full px-2 py-1.5 text-sm rounded bg-black/40 border border-white/10" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="text-sm">Time Zone</div>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. America/New_York" className="w-full px-2 py-1.5 text-sm rounded bg-black/40 border border-white/10" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" checked={shareLocation} onChange={(e) => setShareLocation(e.target.checked)} id="share-location" />
          <label htmlFor="share-location" className="text-sm">Share location for local context</label>
        </div>

        <button onClick={save} className="px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/15">Save</button>
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
  'google-tasks': { name: 'Google Tasks', icon: '\u2705', description: 'Manage task lists and tasks' },
  notion: { name: 'Notion', icon: '\uD83D\uDCD3', description: 'Search and manage pages and databases' },
  dropbox: { name: 'Dropbox', icon: '\uD83D\uDCE6', description: 'Search, download, and upload files' },
  linear: { name: 'Linear', icon: '\uD83D\uDCCB', description: 'Search and manage issues and projects' },
  github: { name: 'GitHub', icon: '\uD83D\uDC19', description: 'Access repos, issues, and pull requests' },
  airtable: { name: 'Airtable', icon: '\uD83D\uDDC3\uFE0F', description: 'Access bases, tables, and records' },
  spotify: { name: 'Spotify', icon: '\uD83C\uDFB5', description: 'Search tracks, control playback, manage playlists' },
  onedrive: { name: 'OneDrive', icon: '\u2601\uFE0F', description: 'Search, download, and upload files' },
  outlook: { name: 'Outlook', icon: '\uD83D\uDCE7', description: 'Search, read, and send emails' },
};

const TOKEN_BASED_PROVIDERS = ['notion', 'airtable'];

function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenFor, setShowTokenFor] = useState<string | null>(null);
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

  async function connectToken(provider: string) {
    if (!tokenInput.trim()) return;
    const res = await fetch(`${CORE_URL}/api/integrations/${provider}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput }),
    });
    const data = await res.json();
    if (data.ok) { setTokenInput(''); setShowTokenFor(null); await refresh(); }
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
                {TOKEN_BASED_PROVIDERS.includes(p.provider) ? (
                  showTokenFor === p.provider ? (
                    <div className="flex gap-1">
                      <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder={`${p.provider === 'airtable' ? 'API' : 'Integration'} token`} className="px-2 py-1 text-xs rounded bg-black/40 border border-white/10 w-48" />
                      <button onClick={() => connectToken(p.provider)} className="px-2 py-1 text-xs rounded bg-white/10">Save</button>
                      <button onClick={() => setShowTokenFor(null)} className="px-2 py-1 text-xs rounded bg-white/10">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowTokenFor(p.provider)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">
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

// ─── Phase 8: Channels Section ──────────────────────────────────────

const CHANNEL_INFO: Record<string, { name: string; icon: string; description: string }> = {
  telegram: { name: 'Telegram', icon: '\u2708\uFE0F', description: 'Chat with your AI via Telegram bot' },
  email: { name: 'Email', icon: '\u2709\uFE0F', description: 'Send emails to your AI and get replies' },
  discord: { name: 'Discord', icon: '\uD83C\uDFAE', description: 'Chat with your AI via Discord DMs' },
  sms: { name: 'SMS', icon: '\uD83D\uDCF1', description: 'Text your AI via SMS (Twilio)' },
};

function ChannelsSection() {
  const [channels, setChannels] = useState<any[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [pairingState, setPairingState] = useState<{ type: string; code?: string; inviteUrl?: string; email?: string; instructions?: string } | null>(null);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsPairing, setSmsPairing] = useState(false);

  useState(() => { void refresh(); });

  async function refresh() {
    const [chRes, avRes, pRes, mRes] = await Promise.all([
      fetch(`${CORE_URL}/api/channels`),
      fetch(`${CORE_URL}/api/channels/available`),
      fetch(`${CORE_URL}/api/personas`),
      fetch(`${CORE_URL}/api/models`),
    ]);
    setChannels(await chRes.json());
    setAvailable(await avRes.json());
    setPersonas(await pRes.json());
    const mData = await mRes.json();
    setModels(mData.data || []);
  }

  async function startPairing(type: string) {
    const res = await fetch(`${CORE_URL}/api/channels/${type}/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const data = await res.json();
    setPairingState({ type, ...data });
  }

  async function startSmsPairing() {
    if (!smsPhone.trim()) return;
    const res = await fetch(`${CORE_URL}/api/channels/sms/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: smsPhone }),
    });
    const data = await res.json();
    if (data.error) { alert(data.error); return; }
    setSmsPairing(true);
  }

  async function verifySms() {
    const res = await fetch(`${CORE_URL}/api/channels/sms/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: smsPhone, code: smsCode }),
    });
    const data = await res.json();
    if (data.ok) { setSmsPairing(false); setSmsPhone(''); setSmsCode(''); await refresh(); }
    else alert(data.error || 'Verification failed');
  }

  async function disconnect(id: number) {
    if (!confirm('Disconnect this channel?')) return;
    await fetch(`${CORE_URL}/api/channels/${id}`, { method: 'DELETE' });
    await refresh();
  }

  async function testChannel(id: number) {
    const res = await fetch(`${CORE_URL}/api/channels/${id}/test`, { method: 'POST' });
    const data = await res.json();
    alert(data.ok ? 'Test message sent!' : `Test failed: ${data.error}`);
  }

  async function updateChannel(id: number, updates: any) {
    await fetch(`${CORE_URL}/api/channels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await refresh();
  }

  async function toggleActive(id: number, active: boolean) {
    await fetch(`${CORE_URL}/api/channels/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !active }),
    });
    await refresh();
  }

  const connectedTypes = new Set(channels.map((c: any) => c.type));

  return (
    <>
      {/* Connected Channels — "Ask [Persona] with [Model] over [channel]" pattern */}
      {channels.length > 0 && (
        <Section title="Connected Channels">
          <div className="grid gap-3">
            {channels.map((ch: any) => {
              const info = CHANNEL_INFO[ch.type] || { name: ch.type, icon: '\uD83D\uDD17', description: '' };
              const personaName = personas.find((p: any) => p.id === ch.persona_id)?.name || 'Default';
              return (
                <div key={ch.id} className="p-3 rounded-lg border border-white/10 bg-white/5 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{info.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{info.name}</div>
                      <div className="text-xs opacity-50 truncate">
                        {ch.config?.username || ch.config?.email || ch.config?.phone || 'Connected'}
                      </div>
                    </div>
                    <button onClick={() => toggleActive(ch.id, ch.is_active)} className={`px-1.5 py-0.5 text-xs rounded ${ch.is_active ? 'bg-green-600/40' : 'bg-white/10'}`}>
                      {ch.is_active ? 'Active' : 'Paused'}
                    </button>
                    <button onClick={() => testChannel(ch.id)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">Test</button>
                    <button onClick={() => disconnect(ch.id)} className="px-2 py-1 text-xs rounded bg-red-600/40 hover:bg-red-600/60">Disconnect</button>
                  </div>
                  {/* "Ask [Persona] with [Model] over [channel]" */}
                  <div className="flex items-center gap-1.5 text-sm ml-8 flex-wrap">
                    <span className="opacity-60">Ask</span>
                    <select
                      value={ch.persona_id || ''}
                      onChange={(e) => updateChannel(ch.id, { persona_id: e.target.value ? Number(e.target.value) : null })}
                      className="px-2 py-0.5 text-xs rounded bg-black/40 border border-white/10"
                    >
                      <option value="">Default</option>
                      {personas.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <span className="opacity-60">with</span>
                    <select
                      value={ch.model || ''}
                      onChange={(e) => updateChannel(ch.id, { model: e.target.value || null })}
                      className="px-2 py-0.5 text-xs rounded bg-black/40 border border-white/10"
                    >
                      <option value="">Default model</option>
                      {models.map((m: any) => <option key={m.id} value={m.id}>{m.id}</option>)}
                    </select>
                    <span className="opacity-60">over</span>
                    <span className="font-medium">{info.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* Available Channels */}
      <Section title="Available Channels">
        <div className="grid gap-2">
          {available.map((av: any) => {
            const info = CHANNEL_INFO[av.type] || { name: av.type, icon: '\uD83D\uDD17', description: '' };
            const isConnected = connectedTypes.has(av.type);
            return (
              <div key={av.type} className="p-2 rounded bg-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{info.name}</div>
                    <div className="text-xs opacity-60">{info.description}</div>
                  </div>
                  {!av.configured ? (
                    <span className="text-xs opacity-40">Set {av.envHint} in .env</span>
                  ) : isConnected ? (
                    <button onClick={() => av.type === 'sms' ? setSmsPairing(true) : startPairing(av.type)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">+ Add</button>
                  ) : av.type === 'sms' ? (
                    <button onClick={() => setSmsPairing(true)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">Connect</button>
                  ) : (
                    <button onClick={() => startPairing(av.type)} className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">Connect</button>
                  )}
                </div>

                {/* Pairing flow for Telegram/Discord */}
                {pairingState && pairingState.type === av.type && (av.type === 'telegram' || av.type === 'discord') && (
                  <div className="mt-2 p-2 rounded bg-black/30 border border-white/10 text-xs space-y-1">
                    <div className="font-medium">Pairing Code: <code className="bg-white/10 px-1 py-0.5 rounded">{pairingState.code}</code></div>
                    <div className="opacity-60">{pairingState.instructions}</div>
                    {pairingState.inviteUrl && (
                      <div><a href={pairingState.inviteUrl} target="_blank" rel="noreferrer" className="text-blue-400 underline">Add bot to server</a></div>
                    )}
                    <div className="opacity-40">Expires in 10 minutes</div>
                    <button onClick={() => { setPairingState(null); refresh(); }} className="px-2 py-1 rounded bg-white/10">Done</button>
                  </div>
                )}

                {/* Email auto-setup info */}
                {pairingState && pairingState.type === 'email' && av.type === 'email' && (
                  <div className="mt-2 p-2 rounded bg-black/30 border border-white/10 text-xs space-y-1">
                    <div className="font-medium">Your email: <code className="bg-white/10 px-1 py-0.5 rounded">{pairingState.email}</code></div>
                    <div className="opacity-60">{pairingState.instructions}</div>
                    <button onClick={() => { setPairingState(null); refresh(); }} className="px-2 py-1 rounded bg-white/10">Done</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* SMS Pairing Flow */}
      {smsPairing && (
        <Section title="Connect Phone Number">
          <div className="space-y-2 text-sm">
            <div className="flex gap-2">
              <input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="+1234567890" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
              <button onClick={startSmsPairing} className="px-2 py-1 text-sm rounded bg-white/10">Send Code</button>
            </div>
            <div className="flex gap-2">
              <input value={smsCode} onChange={(e) => setSmsCode(e.target.value)} placeholder="Verification code" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
              <button onClick={verifySms} className="px-2 py-1 text-sm rounded bg-white/10">Verify</button>
              <button onClick={() => { setSmsPairing(false); setSmsPhone(''); setSmsCode(''); }} className="px-2 py-1 text-sm rounded bg-white/10">Cancel</button>
            </div>
          </div>
        </Section>
      )}
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

// ─── Phase 10: Browser Section ──────────────────────────────────────

function BrowserSection() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loginUrl, setLoginUrl] = useState('');
  useState(() => { void refresh(); });

  async function refresh() {
    const r = await fetch(`${CORE_URL}/api/browser/sessions`);
    setSessions(await r.json());
  }

  async function deleteSession(id: number) {
    await fetch(`${CORE_URL}/api/browser/sessions/${id}`, { method: 'DELETE' });
    await refresh();
  }

  async function loginToSite() {
    if (!loginUrl.trim()) return;
    await fetch(`${CORE_URL}/api/browser/navigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: loginUrl }),
    });
    await fetch(`${CORE_URL}/api/browser/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site_url: loginUrl }),
    });
    setLoginUrl('');
    await refresh();
  }

  return (
    <Section title="AI Browser">
      <div className="text-xs opacity-80 mb-2">Manage browser sessions for the AI to access logged-in sites</div>
      <div className="flex gap-2 mb-2">
        <input value={loginUrl} onChange={(e) => setLoginUrl(e.target.value)} placeholder="https://example.com" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
        <button onClick={loginToSite} className="px-2 py-1 text-sm rounded bg-white/10">Log into site</button>
      </div>
      {sessions.length > 0 && (
        <div className="grid gap-1">
          {sessions.map((s: any) => (
            <div key={s.id} className="flex items-center gap-2 p-1.5 rounded bg-white/5 text-sm">
              <span className="flex-1 truncate">{s.label || s.site_url}</span>
              <span className="text-xs opacity-40">{s.last_used ? new Date(s.last_used).toLocaleDateString() : ''}</span>
              <button onClick={() => deleteSession(s.id)} className="px-1.5 py-0.5 text-xs rounded bg-red-600/40 hover:bg-red-600/60">Delete</button>
            </div>
          ))}
        </div>
      )}
      {sessions.length === 0 && <div className="text-xs opacity-60">No browser sessions saved</div>}
    </Section>
  );
}

// ─── Phase 10: SSH Section ──────────────────────────────────────

function SSHSection() {
  const [keys, setKeys] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [showForm, setShowForm] = useState(false);
  useState(() => { void refresh(); });

  async function refresh() {
    const r = await fetch(`${CORE_URL}/api/ssh/keys`);
    setKeys(await r.json());
  }

  async function addKey() {
    if (!name.trim() || !host.trim() || !username.trim()) return;
    await fetch(`${CORE_URL}/api/ssh/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, host, port: Number(port), username, private_key: privateKey || undefined }),
    });
    setName(''); setHost(''); setPort('22'); setUsername(''); setPrivateKey('');
    setShowForm(false);
    await refresh();
  }

  async function removeKey(id: number) {
    if (!confirm('Remove this SSH connection?')) return;
    await fetch(`${CORE_URL}/api/ssh/keys/${id}`, { method: 'DELETE' });
    await refresh();
  }

  async function testKey(id: number) {
    const res = await fetch(`${CORE_URL}/api/ssh/keys/${id}/test`, { method: 'POST' });
    const data = await res.json();
    alert(data.ok ? 'Connection successful!' : `Connection failed: ${data.error}`);
  }

  return (
    <Section title="SSH Connections">
      <div className="text-xs opacity-80 mb-2">Manage SSH connections for remote server access</div>
      {keys.length > 0 && (
        <div className="grid gap-1 mb-2">
          {keys.map((k: any) => (
            <div key={k.id} className="flex items-center gap-2 p-1.5 rounded bg-white/5 text-sm">
              <span className="font-medium">{k.name}</span>
              <code className="text-xs opacity-60">{k.username}@{k.host}:{k.port}</code>
              <span className="text-xs opacity-40">{k.last_connected ? `Last: ${new Date(k.last_connected).toLocaleDateString()}` : 'Never used'}</span>
              <div className="flex-1" />
              <button onClick={() => testKey(k.id)} className="px-1.5 py-0.5 text-xs rounded bg-white/10 hover:bg-white/20">Test</button>
              <button onClick={() => removeKey(k.id)} className="px-1.5 py-0.5 text-xs rounded bg-red-600/40 hover:bg-red-600/60">Remove</button>
            </div>
          ))}
        </div>
      )}
      {showForm ? (
        <div className="space-y-2 p-2 rounded bg-white/5">
          <div className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. My VPS)" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
            <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="Host" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
            <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="22" className="w-16 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
          </div>
          <div className="flex gap-2">
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
          </div>
          <textarea value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="Private key (PEM format, optional)" className="w-full h-20 px-2 py-1 text-sm rounded bg-black/40 border border-white/10 font-mono" />
          <div className="flex gap-2">
            <button onClick={addKey} className="px-2 py-1 text-sm rounded bg-white/10">Add Connection</button>
            <button onClick={() => setShowForm(false)} className="px-2 py-1 text-sm rounded bg-white/10">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="px-2 py-1 text-sm rounded bg-white/10">Add SSH Connection</button>
      )}
    </Section>
  );
}

function ThemeSection() {
  const [active, setActive] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('lex-theme') || 'default';
    return 'default';
  });

  function selectTheme(name: string) {
    setActive(name);
    if (name === 'default') {
      applyTheme(null);
      localStorage.setItem('lex-theme', 'default');
    } else {
      const t = getTheme(name);
      if (t) { applyTheme(t); localStorage.setItem('lex-theme', name); }
    }
  }

  return (
    <Section title="Theme">
      <div className="mb-3">
        <button onClick={() => selectTheme('default')}
          className={`px-3 py-1.5 text-sm rounded mr-2 ${active === 'default' ? 'bg-white/20 ring-1 ring-white/30' : 'bg-white/10'}`}>
          Default Dark
        </button>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
        {themes.map((t) => (
          <button key={t.name} onClick={() => selectTheme(t.name)}
            className={`p-2 rounded-lg border text-left transition ${active === t.name ? 'border-white ring-1 ring-white/30' : 'border-white/10 hover:border-white/30'}`}>
            <div className="flex gap-1 mb-1.5">
              <div className="w-3 h-3 rounded-full" style={{ background: t.colors.bg }} />
              <div className="w-3 h-3 rounded-full" style={{ background: t.colors.primary }} />
              <div className="w-3 h-3 rounded-full" style={{ background: t.colors.accent }} />
            </div>
            <div className="text-xs font-medium truncate">{t.name}</div>
            <div className="text-[10px] opacity-50">{t.mode}</div>
          </button>
        ))}
      </div>
    </Section>
  );
}

const DEFAULT_KEYBINDINGS = [
  { action: 'Command Palette', shortcut: 'Ctrl+K', key: 'k' },
  { action: 'New Conversation', shortcut: 'Ctrl+N', key: 'n' },
  { action: 'Send Message', shortcut: 'Ctrl+Enter', key: 'Enter' },
  { action: 'Toggle Sidebar', shortcut: 'Ctrl+/', key: '/' },
  { action: 'Save', shortcut: 'Ctrl+S', key: 's' },
];

function KeybindingsSection() {
  return (
    <Section title="Keyboard Shortcuts">
      <div className="space-y-1">
        {DEFAULT_KEYBINDINGS.map((kb) => (
          <div key={kb.action} className="flex items-center justify-between p-1.5 rounded hover:bg-white/5">
            <span className="text-sm">{kb.action}</span>
            <kbd className="px-2 py-0.5 text-xs rounded bg-white/10 font-mono">{kb.shortcut}</kbd>
          </div>
        ))}
      </div>
    </Section>
  );
}

function DomainsSection() {
  const [domains, setDomains] = useState<any[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [targetType, setTargetType] = useState('site');
  const [dnsInfo, setDnsInfo] = useState<any>(null);

  useState(() => { void refreshDomains(); });
  async function refreshDomains() { const r = await fetch(`${CORE_URL}/api/domains`); setDomains(await r.json()); }

  async function addDomain() {
    if (!newDomain) return;
    const res = await fetch(`${CORE_URL}/api/domains`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: newDomain, target_type: targetType }) });
    const data = await res.json();
    setDnsInfo(data.dns_instructions);
    setNewDomain('');
    await refreshDomains();
  }

  async function verifyDomain(id: number) {
    const res = await fetch(`${CORE_URL}/api/domains/${id}/verify`, { method: 'POST' });
    const data = await res.json();
    if (data.verified) {
      await refreshDomains();
      setDnsInfo(null);
    } else {
      setDnsInfo(data);
    }
  }

  async function removeDomain(id: number) {
    await fetch(`${CORE_URL}/api/domains/${id}`, { method: 'DELETE' });
    await refreshDomains();
  }

  return (
    <Section title="Custom Domains">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10">
            <option value="site">Site</option>
            <option value="space">Space</option>
            <option value="service">Service</option>
          </select>
          <button onClick={addDomain} className="px-2 py-1 text-sm rounded bg-white/10">Add</button>
        </div>
        {dnsInfo && (
          <div className="p-2 rounded bg-blue-500/10 text-xs space-y-1">
            <div className="font-medium">DNS Configuration Required:</div>
            {dnsInfo.cname && <div>CNAME: {dnsInfo.cname.name} → {dnsInfo.cname.value}</div>}
            {dnsInfo.txt && <div>TXT: {dnsInfo.txt.name} = {dnsInfo.txt.value}</div>}
            {dnsInfo.expected_record && <div>Expected TXT: {dnsInfo.expected_record.name} = {dnsInfo.expected_record.value}</div>}
          </div>
        )}
        {domains.map((d: any) => (
          <div key={d.id} className="flex items-center justify-between p-2 rounded bg-black/20">
            <div>
              <div className="text-sm font-medium">{d.domain}</div>
              <div className="text-xs opacity-60">{d.target_type} · {d.verified ? 'Verified' : 'Pending'} · SSL: {d.ssl_status}</div>
            </div>
            <div className="flex gap-2">
              {!d.verified && <button onClick={() => verifyDomain(d.id)} className="px-2 py-1 text-xs rounded bg-white/10">Verify</button>}
              <button onClick={() => removeDomain(d.id)} className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
