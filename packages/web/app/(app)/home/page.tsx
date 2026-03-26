export default function HomeShell() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Bookmarks</h1>
      <p className="text-sm opacity-80">Quick access to your bookmarked tabs and recent files</p>
      <div className="flex gap-2">
        <button className="px-3 py-1.5 bg-white/10 rounded">New Chat</button>
        <button className="px-3 py-1.5 bg-white/10 rounded">Upload File</button>
      </div>
      <div className="h-64 rounded border border-white/10" />
    </div>
  );
}

