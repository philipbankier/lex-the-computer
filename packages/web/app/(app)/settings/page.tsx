"use client";
import { useState } from 'react';

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
          <Section title="Models">Configure models</Section>
          <Section title="Personas">Manage personas</Section>
          <Section title="Providers">Configure AI providers</Section>
          <Section title="Personalization">Personalize responses</Section>
          <Section title="Rules">Automation rules</Section>
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
          <Section title="Secrets">
            <div className="flex gap-2">
              <input placeholder="KEY" className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
              <input placeholder="VALUE" className="flex-1 px-2 py-1 text-sm rounded bg-black/40 border border-white/10" />
              <button className="px-2 py-1 text-sm rounded bg-white/10">Add</button>
            </div>
          </Section>
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

