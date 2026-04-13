"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type Conversation = { id: number; title: string | null; model: string | null; persona_id: number | null; created_at: string };
type Message = { id: number; role: 'user' | 'assistant' | 'system' | 'tool'; content: string; name?: string | null; created_at: string };
type FileEntry = { path: string; size: number };

export default function ChatsPage() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [streaming, setStreaming] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionTab, setMentionTab] = useState<'files' | 'tools'>('files');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { void refreshConvos(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, streaming]);

  async function refreshConvos() {
    const res = await fetch(`${CORE_URL}/api/chat/conversations`);
    const data = await res.json();
    setConvos(data);
    if (!current && data[0]) {
      setCurrent(data[0]);
      void openConvo(data[0].id);
    }
  }
  async function refreshFiles() {
    try {
      const res = await fetch(`${CORE_URL}/api/files`);
      const data = await res.json();
      setFiles(data.files || []);
    } catch {}
  }
  async function newConvo() {
    const res = await fetch(`${CORE_URL}/api/chat/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) });
    const convo = await res.json();
    setConvos((c) => [convo, ...c]);
    setCurrent(convo);
    setMessages([]);
  }
  async function openConvo(id: number) {
    const res = await fetch(`${CORE_URL}/api/chat/conversations/${id}`);
    const data = await res.json();
    setCurrent(data.conversation);
    setMessages(data.messages);
  }

  async function send() {
    if (!current) await newConvo();
    const cid = current?.id || (await (await fetch(`${CORE_URL}/api/chat/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })).json()).id;
    if (!cid) return;
    const userMsg: Message = { id: Date.now(), role: 'user', content: input, created_at: new Date().toISOString() } as any;
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setStreaming(true);
    setShowMentions(false);
    let acc = '';
    const fileSnippets: string[] = await getSelectedFileSnippets();
    const res = await fetch(`${CORE_URL}/api/chat/conversations/${cid}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: userMsg.content, model, fileSnippets }) });
    const reader = (res.body as any)?.getReader?.();
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        // Expect SSE frames: lines starting with 'data:'
        for (const line of text.split('\n')) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            // token events are raw tokens, others are JSON
            try {
              const obj = JSON.parse(data);
              if (obj && obj.messageId) {
                // end event
              }
            } catch {
              acc += data;
              setMessages((m) => {
                const base = m.filter((mm) => mm.role !== 'assistant' || mm.id !== -1);
                return [...base, { id: -1, role: 'assistant', content: acc, created_at: new Date().toISOString() } as any];
              });
            }
          }
        }
      }
    }
    setStreaming(false);
    await openConvo(cid);
    // Auto-generate title after first AI response
    const convo = current || (convos.find((c) => c.id === cid) || null);
    const hasTitle = !!convo?.title;
    if (!hasTitle) {
      const first = (acc || userMsg.content || '').trim().split(/\s+/).slice(0, 6).join(' ');
      const suggested_title = first.replace(/[`#*_]/g, '').replace(/[\.,;:!-]+$/, '');
      fetch(`${CORE_URL}/api/chat/conversations/${cid}/title`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suggested_title }) }).catch(() => {});
      void refreshConvos();
    }
  }

  async function getSelectedFileSnippets(): Promise<string[]> {
    const outs: string[] = [];
    for (const p of selectedFiles) {
      try {
        const res = await fetch(`${CORE_URL}/api/files/content?path=${encodeURIComponent(p)}`);
        const data = await res.json();
        if (data?.snippet) outs.push(`Path: ${p}\n\n${data.snippet}`);
      } catch {}
    }
    return outs;
  }

  const title = (c: Conversation) => c.title || `Chat #${c.id}`;

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 border-r border-white/10 p-3 space-y-2">
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded bg-white/10 text-sm" onClick={newConvo} title="New chat (Ctrl/Cmd+N)">New Chat</button>
          <select className="flex-1 bg-black/40 border border-white/10 rounded px-2 text-sm" value={model} onChange={(e) => setModel(e.target.value)}>
            <option>gpt-4o-mini</option>
            <option>claude-3-haiku</option>
          </select>
        </div>
        <input placeholder="Search" className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
        <div className="space-y-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
          {convos.map((c) => (
            <div key={c.id} className={`group w-full text-left px-2 py-1 rounded hover:bg-white/10 ${current?.id === c.id ? 'bg-white/10' : ''} flex items-center justify-between`}>
              <button onClick={() => openConvo(c.id)} className="flex-1 text-left">
                <div className="text-sm truncate">{title(c)}</div>
                <div className="text-xs opacity-60">{c.model}</div>
              </button>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 ml-2">
                <button title="Rename" className="text-xs px-1 py-0.5 bg-white/10 rounded" onClick={async () => {
                  const newTitle = prompt('Rename conversation', title(c) || '') || '';
                  if (!newTitle) return;
                  await fetch(`${CORE_URL}/api/chat/conversations/${c.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
                  void refreshConvos();
                }}>✎</button>
                <button title="Delete" className="text-xs px-1 py-0.5 bg-white/10 rounded" onClick={async () => {
                  if (!confirm('Delete this conversation?')) return;
                  await fetch(`${CORE_URL}/api/chat/conversations/${c.id}`, { method: 'DELETE' });
                  setConvos((prev) => prev.filter((x) => x.id !== c.id));
                  if (current?.id === c.id) { setCurrent(null); setMessages([]); }
                }}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full">
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`max-w-3xl ${m.role === 'user' ? 'ml-auto text-right' : ''}`}>
              <div className={`inline-block px-3 py-2 rounded ${m.role === 'user' ? 'bg-white text-black' : 'bg-white/10'}`}>
                <MessageContent message={m} />
              </div>
            </div>
          ))}
          {streaming && <div className="opacity-70 text-sm">Thinking…</div>}
          <div ref={bottomRef} />
        </div>
        <div className="border-t border-white/10 p-3 space-y-2">
          {(selectedFiles.length > 0 || selectedTools.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((p) => (
                <span key={p} className="text-xs bg-white/10 rounded px-2 py-1">📄 {p} <button className="ml-1" onClick={() => setSelectedFiles((xs) => xs.filter((x) => x !== p))}>×</button></span>
              ))}
              {selectedTools.map((t) => (
                <span key={t} className="text-xs bg-white/10 rounded px-2 py-1">🛠 {t} <button className="ml-1" onClick={() => setSelectedTools((xs) => xs.filter((x) => x !== t))}>×</button></span>
              ))}
            </div>
          )}
          <div className="relative">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  const v = e.target.value;
                  setInput(v);
                  if (v.endsWith('@')) { setShowMentions(true); void refreshFiles(); setMentionTab('files'); }
                }}
                onKeyDown={(e) => {
                  const isCmd = e.metaKey || e.ctrlKey;
                  if (isCmd && e.key === 'Enter') { e.preventDefault(); if (!streaming && input.trim()) void send(); }
                  if (isCmd && (e.key.toLowerCase() === 'n')) { e.preventDefault(); void newConvo(); }
                  if (e.key === 'Escape') { setShowMentions(false); }
                }}
                placeholder="Type a message (type @ for files/tools)"
                rows={2}
                className="flex-1 px-3 py-2 rounded bg-black/40 border border-white/10 w-full"
              />
              <button onClick={send} disabled={!input || streaming} className="px-3 py-2 rounded bg-white text-black" title="Send (Ctrl/Cmd+Enter)">Send</button>
            </div>

            {showMentions && (
              <div className="absolute z-20 bottom-full mb-2 left-0 w-full max-w-xl bg-black/90 border border-white/10 rounded shadow-lg">
                <div className="flex border-b border-white/10">
                  <button onClick={() => setMentionTab('files')} className={`px-3 py-2 text-sm ${mentionTab === 'files' ? 'bg-white/10' : ''}`}>Files</button>
                  <button onClick={() => setMentionTab('tools')} className={`px-3 py-2 text-sm ${mentionTab === 'tools' ? 'bg-white/10' : ''}`}>Tools</button>
                  <div className="ml-auto px-3 py-2 text-xs opacity-60">Esc to close</div>
                </div>
                {mentionTab === 'files' ? (
                  <div className="max-h-56 overflow-auto p-2 space-y-1">
                    {files.length === 0 && <div className="text-xs opacity-60 p-2">No files</div>}
                    {files.map((f) => (
                      <button key={f.path} className="w-full text-left px-2 py-1 rounded hover:bg-white/10 text-sm" onClick={() => {
                        setSelectedFiles((xs) => (xs.includes(f.path) ? xs : [...xs, f.path]));
                        setShowMentions(false);
                        inputRef.current?.focus();
                      }}>📄 {f.path}</button>
                    ))}
                  </div>
                ) : (
                  <div className="p-2 grid grid-cols-2 gap-2">
                    {['web_search','read_webpage','save_webpage'].map((t) => (
                      <button key={t} className="text-left px-2 py-1 rounded hover:bg-white/10 text-sm" onClick={() => {
                        setSelectedTools((xs) => (xs.includes(t) ? xs : [...xs, t]));
                        setShowMentions(false);
                        inputRef.current?.focus();
                      }}>🛠 {t}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="text-xs opacity-60">Model: {model}</div>
        </div>
      </main>
    </div>
  );
}

function MessageContent({ message }: { message: Message }) {
  // Tool call display card
  if (message.role === 'tool') {
    return <ToolCard content={message.content} name={message.name || undefined} />;
  }
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const lang = match?.[1] || '';
          const isBlock = String(children).includes('\n');
          if (!isBlock) {
            return <code className="px-1 py-0.5 rounded bg-black/40 border border-white/10" {...props}>{children}</code>;
          }
          return (
            <SyntaxHighlighter language={lang} style={vscDarkPlus} PreTag="div" customStyle={{ margin: 0 }}>
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          );
        },
      }}
    >
      {message.content}
    </ReactMarkdown>
  );
}

function ToolCard({ content, name }: { content: string; name?: string }) {
  let parsed: any = null;
  try { parsed = JSON.parse(content); } catch {}
  const [open, setOpen] = useState(false);
  if (!parsed) {
    return (
      <div className="text-xs">
        <div className="opacity-60">Tool</div>
        <pre className="whitespace-pre-wrap text-xs">{content}</pre>
      </div>
    );
  }
  const toolName = parsed.tool || name || parsed.name || 'tool';
  return (
    <div className="text-xs">
      <button className="text-left w-full" onClick={() => setOpen((o) => !o)}>
        <div className="font-medium">🛠 {toolName}</div>
        <div className="opacity-60">{open ? 'Hide details' : 'Show details'}</div>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {parsed.input && (
            <div>
              <div className="opacity-60">Input</div>
              <pre className="whitespace-pre-wrap">{typeof parsed.input === 'string' ? parsed.input : JSON.stringify(parsed.input, null, 2)}</pre>
            </div>
          )}
          {parsed.output && (
            <div>
              <div className="opacity-60">Result</div>
              <pre className="whitespace-pre-wrap">{typeof parsed.output === 'string' ? parsed.output : JSON.stringify(parsed.output, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
