export default function ChatsShell() {
  return (
    <div className="flex h-full min-h-[70vh]">
      <aside className="w-72 border-r border-white/10 p-4 space-y-2">
        <div className="flex gap-2 mb-2">
          <button className="px-2 py-1 bg-white/10 rounded text-sm">Filter</button>
          <button className="px-2 py-1 bg-white/10 rounded text-sm">New</button>
        </div>
        <div className="opacity-70 text-sm">No conversations yet</div>
      </aside>
      <section className="flex-1 p-6">
        <div className="opacity-70">Select a conversation to start</div>
      </section>
    </div>
  );
}

