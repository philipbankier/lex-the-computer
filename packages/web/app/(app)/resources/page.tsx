export default function ResourcesPage() {
  const links = [
    { title: 'Documentation', desc: 'Learn how to use Lex', icon: '📖', url: '#' },
    { title: 'API Reference', desc: 'REST API docs for developers', icon: '🔧', url: '#' },
    { title: 'Skills Guide', desc: 'How to create custom skills', icon: '🧩', url: '#' },
    { title: 'Community', desc: 'Join the Lex community', icon: '💬', url: '#' },
    { title: 'GitHub', desc: 'Source code and issues', icon: '🐙', url: '#' },
    { title: 'Changelog', desc: 'See what\'s new', icon: '📋', url: '#' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Resources</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <div key={l.title} className="p-4 rounded-lg border border-white/10 hover:border-white/20 transition">
            <span className="text-2xl">{l.icon}</span>
            <div className="font-medium text-sm mt-2">{l.title}</div>
            <div className="text-xs opacity-60 mt-1">{l.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
