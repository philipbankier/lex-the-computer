export default function AutomationsShell() {
  const tabs = ['None', 'Email', 'SMS', 'Telegram', 'Paused'];
  return (
    <div className="p-6 space-y-3">
      <div className="flex gap-2">
        <button className="px-3 py-1.5 bg-white/10 rounded">New agent</button>
      </div>
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button key={t} className="px-2 py-1 text-sm rounded bg-white/10">{t}</button>
        ))}
      </div>
      <div className="rounded border border-white/10 h-[60vh]" />
    </div>
  );
}

