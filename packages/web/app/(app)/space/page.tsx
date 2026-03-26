export default function SpaceShell() {
  return (
    <div className="p-6 space-y-3">
      <div className="flex items-center gap-3">
        <div className="text-sm opacity-80">handle.lex.space</div>
        <button className="px-2 py-1 text-sm rounded bg-white/10">New page</button>
        <button className="px-2 py-1 text-sm rounded bg-white/10">Open</button>
        <button className="px-2 py-1 text-sm rounded bg-white/10">Refresh</button>
        <button className="px-2 py-1 text-sm rounded bg-white/10">Share</button>
        <button className="px-2 py-1 text-sm rounded bg-white/10">Make private</button>
        <select className="px-2 py-1 text-sm rounded bg-black/40 border border-white/10">
          <option>Route</option>
        </select>
      </div>
      <div className="border border-white/10 rounded h-[60vh]" />
    </div>
  );
}

