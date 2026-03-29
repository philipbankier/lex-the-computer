"use client";
import Link from 'next/link';

const features = [
  { title: 'AI Chat', desc: 'Multi-model streaming chat with @ mentions, personas, and rules', icon: '💬' },
  { title: 'File Manager', desc: 'Full workspace with Monaco editor, terminal, and AI-powered file tools', icon: '📁' },
  { title: 'Agents', desc: 'Cron-scheduled AI agents with multi-channel delivery', icon: '⚡' },
  { title: 'Sites & Hosting', desc: 'Build and deploy websites from chat — Hono + Bun, custom domains', icon: '🌐' },
  { title: 'Skills', desc: 'Extensible skill system — install from hub or create your own', icon: '🧩' },
  { title: 'Integrations', desc: 'Gmail, Calendar, Notion, Drive, Linear, GitHub, Spotify + more', icon: '🔗' },
  { title: 'Multi-Channel', desc: 'Access via Telegram, Discord, Email, SMS — per-channel personas', icon: '📡' },
  { title: 'Commerce', desc: 'Stripe Connect with 0% platform fee — sell products and services', icon: '💳' },
  { title: 'Self-Hosted', desc: 'One command to deploy. Your data, your models, your rules', icon: '🔒' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="text-xl font-bold">Lex</div>
        <div className="flex gap-3">
          <a href="https://github.com/lex-the-computer/lex" target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-sm hover:bg-white/10 rounded">
            GitHub
          </a>
          <Link href="/home" className="px-3 py-1.5 text-sm bg-white text-black rounded font-medium hover:bg-white/90">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold leading-tight">
          Your personal AI computer.
        </h1>
        <p className="text-xl md:text-2xl opacity-60 mt-4 max-w-2xl mx-auto">
          One command to deploy. Chat, files, agents, hosting, commerce — all self-hosted, fully open source.
        </p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <Link href="/home" className="px-6 py-3 bg-white text-black rounded-lg font-medium text-lg hover:bg-white/90">
            Get Started
          </Link>
          <a href="https://github.com/lex-the-computer/lex" target="_blank" rel="noopener noreferrer" className="px-6 py-3 border border-white/20 rounded-lg font-medium text-lg hover:bg-white/10">
            View on GitHub
          </a>
        </div>

        {/* Quick Start */}
        <div className="mt-12 bg-white/5 border border-white/10 rounded-lg p-4 max-w-lg mx-auto text-left">
          <div className="text-xs opacity-40 mb-2">Quick Start</div>
          <pre className="text-sm font-mono overflow-x-auto">
{`git clone https://github.com/lex-the-computer/lex
cd lex
cp .env.example .env
# Add your AI API key to .env
docker compose up`}
          </pre>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Everything you need</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border border-white/10 p-5 bg-white/5 hover:bg-white/[0.07] transition-colors">
              <div className="text-2xl mb-2">{f.icon}</div>
              <div className="font-semibold mb-1">{f.title}</div>
              <div className="text-sm opacity-60">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Built with modern tools</h2>
        <p className="opacity-60 text-sm mb-8">Next.js 16 + Hono + Drizzle + PostgreSQL + Redis + BullMQ + LiteLLM + Caddy</p>
        <div className="flex gap-4 justify-center flex-wrap text-sm opacity-50">
          <span>TypeScript</span>
          <span>·</span>
          <span>Tailwind CSS 4</span>
          <span>·</span>
          <span>shadcn/ui</span>
          <span>·</span>
          <span>Docker Compose</span>
          <span>·</span>
          <span>MIT License</span>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center border-t border-white/10">
        <h2 className="text-3xl font-bold mb-4">Ready to deploy?</h2>
        <p className="opacity-60 mb-8">Works on any machine that runs Docker. Personal VPS from $20/month.</p>
        <Link href="/home" className="px-6 py-3 bg-white text-black rounded-lg font-medium text-lg hover:bg-white/90">
          Get Started
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-6 text-center text-sm opacity-40">
        <div>Lex the Computer — Open Source Personal AI Computer</div>
        <div className="mt-1">MIT License · Built with love and AI</div>
      </footer>
    </div>
  );
}
