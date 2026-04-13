"use client";
import { useEffect, useState } from 'react';
import { parseCronToHuman } from '@/lib/cron';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type Automation = { id: string; name: string; instruction: string; schedule: string; enabled: boolean; delivery: string; created_at: string | null; updated_at: string | null };

export default function AutomationsShell() {
  const [list, setList] = useState<Automation[]>([]);
  const [filter, setFilter] = useState<'None' | 'Email' | 'SMS' | 'Telegram' | 'Paused'>('None');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<{ id?: string; name: string; instruction: string; schedule: string; delivery: string }>({ name: '', instruction: '', schedule: '0 9 * * *', delivery: 'chat' });

  async function refresh() {
    const r = await fetch(`${CORE_URL}/api/automations`);
    const j = await r.json();
    setList(j || []);
  }
  useEffect(() => { void refresh(); }, []);

  function openNew() { setForm({ name: '', instruction: '', schedule: '0 9 * * *', delivery: 'chat' }); setShowForm(true); }
  function openEdit(a: Automation) { setForm({ id: a.id, name: a.name, instruction: a.instruction, schedule: a.schedule, delivery: a.delivery || 'chat' }); setShowForm(true); }

  async function save() {
    if (form.id) {
      await fetch(`${CORE_URL}/api/automations/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, instruction: form.instruction, schedule: form.schedule, delivery: form.delivery }) });
    } else {
      await fetch(`${CORE_URL}/api/automations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, instruction: form.instruction, schedule: form.schedule, delivery: form.delivery }) });
    }
    setShowForm(false);
    await refresh();
  }

  async function toggle(a: Automation) {
    await fetch(`${CORE_URL}/api/automations/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !a.enabled }) });
    await refresh();
  }

  async function remove(a: Automation) {
    if (!confirm(`Delete automation "${a.name}"?`)) return;
    await fetch(`${CORE_URL}/api/automations/${a.id}`, { method: 'DELETE' });
    await refresh();
  }

  const tabs: typeof filter[] = ['None', 'Email', 'SMS', 'Telegram', 'Paused'];
  const filtered = list.filter((a) => {
    if (filter === 'Paused') return !a.enabled;
    if (filter === 'None') return true;
    const dm = (a.delivery || 'chat').toLowerCase();
    return dm === filter.toLowerCase();
  });

  return (
    <div className="p-6 space-y-3">
      <div className="flex gap-2">
        <button className="px-3 py-1.5 bg-white text-black rounded" onClick={openNew}>New Automation</button>
      </div>
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t} className={`px-2 py-1 text-sm rounded ${filter === t ? 'bg-white text-black' : 'bg-white/10'}`} onClick={() => setFilter(t)}>{t}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((a) => (
          <div key={a.id} className="rounded border border-white/10 p-3 space-y-2 bg-black/20">
            <div className="flex items-center justify-between">
              <div className="font-medium">{a.name}</div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${a.enabled ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{a.enabled ? 'Active' : 'Paused'}</span>
                <button className="text-xs px-2 py-1 bg-white/10 rounded" onClick={() => toggle(a)}>{a.enabled ? 'Pause' : 'Activate'}</button>
              </div>
            </div>
            <div className="text-sm opacity-80">{parseCronToHuman(a.schedule)}</div>
            <div className="text-xs opacity-60">Delivery: {a.delivery || 'chat'}</div>
            <div className="flex gap-2">
              <button className="text-xs px-2 py-1 bg-white/10 rounded" onClick={() => openEdit(a)}>Edit</button>
              <button className="text-xs px-2 py-1 bg-red-600/40 rounded" onClick={() => remove(a)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-black border border-white/10 rounded p-4 space-y-3">
            <div className="text-lg font-semibold">{form.id ? 'Edit Automation' : 'New Automation'}</div>
            <div className="space-y-1">
              <div className="text-sm">Name</div>
              <input className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <div className="text-sm">Instruction</div>
              <textarea className="w-full h-32 px-3 py-2 bg-black/40 border border-white/10 rounded" value={form.instruction} onChange={(e) => setForm({ ...form, instruction: e.target.value })} />
            </div>
            <div className="space-y-1">
              <div className="text-sm">Schedule (cron)</div>
              <input className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} />
              <div className="flex gap-2 text-xs">
                <button className="px-2 py-1 bg-white/10 rounded" onClick={() => setForm({ ...form, schedule: '0 9 * * *' })}>Every day</button>
                <button className="px-2 py-1 bg-white/10 rounded" onClick={() => setForm({ ...form, schedule: '0 9 * * 1' })}>Every week</button>
                <button className="px-2 py-1 bg-white/10 rounded" onClick={() => setForm({ ...form, schedule: '0 9 1 * *' })}>Every month</button>
              </div>
              <div className="text-xs opacity-60">{parseCronToHuman(form.schedule)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-sm">Delivery</div>
              <select className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded" value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })}>
                <option value="chat">Chat</option>
                <option value="email">Email</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 bg-white/10 rounded" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="px-3 py-1.5 bg-white text-black rounded" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
