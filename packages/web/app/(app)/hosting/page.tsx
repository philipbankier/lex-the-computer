export default function HostingShell() {
  return (
    <div className="p-6 space-y-3">
      <div className="flex gap-2">
        <button className="px-3 py-1.5 bg-white/10 rounded">New Site</button>
        <button className="px-3 py-1.5 bg-white/10 rounded">More create options</button>
      </div>
      <div className="flex gap-2">
        <input className="px-3 py-1.5 rounded bg-black/40 border border-white/10" placeholder="Search" />
      </div>
      <div className="rounded border border-white/10 h-[60vh]" />
    </div>
  );
}

