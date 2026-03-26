export default function FilesShell() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <button className="px-3 py-1.5 bg-white/10 rounded">Upload</button>
          <button className="px-3 py-1.5 bg-white/10 rounded">Search files</button>
          <button className="px-3 py-1.5 bg-white/10 rounded">View</button>
          <button className="px-3 py-1.5 bg-white/10 rounded">New</button>
          <button className="px-3 py-1.5 bg-white/10 rounded">Trash</button>
        </div>
      </div>
      <div className="rounded border border-white/10 h-[60vh]">
        <div className="px-3 py-2 border-b border-white/10 text-sm opacity-80">Name</div>
      </div>
    </div>
  );
}

