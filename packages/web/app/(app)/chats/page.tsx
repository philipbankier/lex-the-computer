"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type Conversation = { id: string; title: string | null; created_at: string; updated_at: string; message_count: number };
type Message = { id: number; role: 'user' | 'assistant' | 'system' | 'tool'; content: string; name?: string | null; created_at: string };
type FileEntry = { path: string; size: number };

export default function ChatsPage() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [current, setCurrent] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
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
      selectConvo(data[0]);
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
    const res = await fetch(`${CORE_URL}/api/chat/conversations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const convo = await res.json();
    setConvos((c) => [convo, ...c]);
    setCurrent(convo);
    setMessages([]);
  }
  function selectConvo(convo: Conversation) {
    setCurrent(convo);
    setMessages([]);
  }

  async function send() {
    const conversationId = current?.id || null;
    const userMsg: Message = { id: Date.now(), role: 'user', content: input, created_at: new Date().toISOString() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setStreaming(true);
    setShowMentions(false);

    const attachments: { path: string; snippet?: string }[] = [];
    for (const p of selectedFiles) {
      try {
        const res = await fetch(`${CORE_URL}/api/files/content?path=${encodeURIComponent(p)}`);
        const data = await res.json();
        if (data?.snippet) attachments.push({ path: p, snippet: data.snippet });
      } catch {}
    }

    let acc = '';
    try {
      const res = await fetch(`${CORE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          conversation_id: conversationId,
          attachments: attachments.length > 0 ? attachments : undefined,
        }),
      });

      const newConvId = res.headers.get('X-Conversation-Id');
      if (newConvId && (!current || current.id !== newConvId)) {
        const convo: Conversation = { id: newConvId, title: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), message_count: 0 };
        setCurrent(convo);
        void refreshConvos();
      }

      const reader = (res.body as any)?.getReader?.();
      const decoder = new TextDecoder();
      let currentEvent = '';

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (currentEvent === 'token') {
                acc += data;
                setMessages((m) => {
                  const base = m.filter((mm) => mm.role !== 'assistant' || mm.id !== -1);
                  return [...base, { id: -1, role: 'assistant', content: acc, created_at: new Date().toISOString() }];
                });
              } else if (currentEvent === 'start') {
                // start event — could contain model info as JSON
              } else if (currentEvent === 'end') {
                // end event — finalize message
              } else if (currentEvent === 'error') {
                try {
                  const err = JSON.parse(data);
                  acc += `\n\n_Error: ${err.error || 'Stream interrupted'}_`;
                } catch {
                  acc += `\n\n_Error: ${data}_`;
                }
                setMessages((m) => {
                  const base = m.filter((mm) => mm.role !== 'assistant' || mm.id !== -1);
                  return [...base, { id: -1, role: 'assistant', content: acc, created_at: new Date().toISOString() }];
                });
              }
            }
          }
        }
      }
    } catch {
      setMessages((m) => [...m, { id: -2, role: 'assistant', content: '_Failed to reach the server._', created_at: new Date().toISOString() }]);
    }
    setStreaming(false);
    setSelectedFiles([]);
    setSelectedTools([]);

    if (acc && current && !current.title) {
      void refreshConvos();
    }
  }

  const title = (c: Conversation) => c.title || `Chat #${c.id.slice(0, 8)}`;

  return (
    <div className="flex h-full">
      <aside className="w-64 shrink-0 border-r border-white/10 p-3 space-y-2">
        <div className="flex gap-2">
          <button className="px-2 py-1 rounded bg-white/10 text-sm" onClick={newConvo} title="New chat (Ctrl/Cmd+N)">New Chat</button>
        </div>
        <input placeholder="Search" className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
        <div className="space-y-1 overflow-auto" style={{ maxHeight: 'calc(100vh - 160px)' }}>
          {convos.map((c) => (
            <div key={c.id} className={`group w-full text-left px-2 py-1 rounded hover:bg-white/10 ${current?.id === c.id ? 'bg-white/10' : ''} flex items-center justify-between`}>
              <button onClick={() => selectConvo(c)} className="flex-1 text-left">
                <div className="text-sm truncate">{title(c)}</div>
                <div className="text-xs opacity-60">{c.message_count} messages</div>
              </button>
              <div className="opacity-0 group-hover:opacity-100 flex gap-1 ml-2">
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
          {messages.length === 0 && current && (
            <div className="text-center py-12 opacity-40 text-sm">Start a conversation</div>
          )}
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
        </div>
      </main>
    </div>
  );
}

function MessageContent({ message }: { message: Message }) {
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
