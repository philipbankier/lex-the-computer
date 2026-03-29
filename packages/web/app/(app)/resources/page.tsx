export default function ResourcesPage() {
  const links = [
    { title: 'Documentation', desc: 'Learn how to set up and use Lex', icon: '\uD83D\uDCD6', url: '/docs' },
    { title: 'API Reference', desc: 'REST API docs for developers and MCP integration', icon: '\uD83D\uDD27', url: '/docs/api' },
    { title: 'Skills Guide', desc: 'How to create, install, and share custom skills', icon: '\uD83E\uDDE9', url: '/docs/skills' },
    { title: 'Getting Started', desc: 'Quick start guide — deploy in 5 minutes', icon: '\uD83D\uDE80', url: '/docs/getting-started' },
    { title: 'Community Discord', desc: 'Join the Lex community for help and discussion', icon: '\uD83D\uDCAC', url: 'https://discord.gg/lex-computer' },
    { title: 'GitHub', desc: 'Source code, issues, and contributions', icon: '\uD83D\uDC19', url: 'https://github.com/lex-the-computer/lex' },
    { title: 'Changelog', desc: 'See what\'s new in the latest release', icon: '\uD83D\uDCCB', url: '/docs/changelog' },
    { title: 'Self-Hosting Guide', desc: 'Deploy on your own VPS or server', icon: '\uD83D\uDD12', url: '/docs/self-hosting' },
  ];

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-2">Resources</h1>
      <p className="text-sm opacity-50 mb-6">Documentation, guides, and community links</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <a key={l.title} href={l.url} target={l.url.startsWith('http') ? '_blank' : undefined} rel={l.url.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="p-4 rounded-lg border border-white/10 hover:border-white/25 hover:bg-white/5 transition block">
            <span className="text-2xl">{l.icon}</span>
            <div className="font-medium text-sm mt-2">{l.title}</div>
            <div className="text-xs opacity-60 mt-1">{l.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
