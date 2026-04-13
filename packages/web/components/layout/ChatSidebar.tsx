"use client";
import { useEffect, useRef, useState } from 'react';
import { useTabs } from '@/components/tabs/context';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type Message = { id: number; role: 'user' | 'assistant' | 'system' | 'tool'; content: string };

export function ChatSidebar() {
  const { chatCollapsed, setChatCollapsed } = useTabs();
  const [convoId, setConvoId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  async function ensureConvo() {
    if (convoId) return convoId;
    const res = await fetch(`${CORE_URL}/api/chat/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, title: 'Sidebar Chat' }) });
    const convo = await res.json();
    setConvoId(convo.id);
    return convo.id as number;
  }

  async function send() {
    const cid = await ensureConvo();
    const userMsg: Message = { id: Date.now(), role: 'user', content: input } as any;
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setStreaming(true);
    let acc = '';
    const res = await fetch(`${CORE_URL}/api/chat/conversations/${cid}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: userMsg.content, model }) });
    const reader = (res.body as any)?.getReader?.();
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        for (const line of text.split('\n')) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            try { JSON.parse(data); } catch {
              acc += data;
              setMessages((m) => {
                const base = m.filter((mm) => mm.role !== 'assistant' || mm.id !== -1);
                return [...base, { id: -1, role: 'assistant', content: acc } as any];
              });
            }
          }
        }
      }
    }
    setStreaming(false);
  }

  if (chatCollapsed) {
    return (
      <aside className="w-6 md:w-8 shrink-0 border-l border-white/10 flex items-center justify-center">
        <button aria-label="Expand chat" onClick={() => setChatCollapsed(false)} className="rotate-180">❮</button>
      </aside>
    );
  }
  return (
    <aside className="w-80 shrink-0 border-l border-white/10 p-3 hidden lg:flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-medium">Chat</div>
        <div className="flex gap-2">
          <button className="text-sm px-2 py-1 bg-white/10 rounded" onClick={() => setChatCollapsed(true)}>Collapse</button>
          <button className="text-sm px-2 py-1 bg-white/10 rounded" onClick={() => { setConvoId(null); setMessages([]); }}>New chat</button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm opacity-80">Mini chat</div>
        <select className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
          <option>gpt-4o-mini</option>
          <option>claude-3-haiku</option>
        </select>
      </div>
      <div className="flex-1 rounded bg-black/20 border border-white/10 p-2 overflow-auto space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block px-2 py-1 rounded ${m.role === 'user' ? 'bg-white text-black' : 'bg-white/10'}`}>{m.content}</div>
          </div>
        ))}
        {streaming && <div className="opacity-60 text-xs">Thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            className="flex-1 px-3 py-2 rounded bg-black/40 border border-white/10"
            placeholder="Ask something"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (input.trim() && !streaming) void send(); } }}
          />
          <button className="px-3 py-2 rounded bg-white text-black" onClick={send} disabled={!input || streaming}>Go</button>
        </div>
        <div className="text-xs opacity-60">Ctrl/Cmd+Enter to send</div>
      </div>
    </aside>
  );
}
