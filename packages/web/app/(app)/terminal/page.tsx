"use client";
import { useEffect, useRef, useState } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:3001';

export default function TerminalShell() {
  const [log, setLog] = useState<string>('');
  const [connected, setConnected] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = CORE_URL.replace('http', 'ws') + '/api/terminal/ws';
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => { setConnected(true); append(`Connected to ${wsUrl}\n`); };
      ws.onmessage = (ev) => append(typeof ev.data === 'string' ? ev.data : String(ev.data));
      ws.onclose = () => { setConnected(false); append('\n[disconnected]\n'); };
      ws.onerror = () => { setConnected(false); };
      wsRef.current = ws;
    } catch (e) {
      append('WebSocket not available');
    }
    return () => { try { ws?.close(); } catch {} };
  }, []);

  function append(s: string) { setLog((x) => x + s); }
  function send(s: string) { wsRef.current?.send(JSON.stringify({ type: 'input', data: s })); }

  return (
    <div className="p-6">
      <div className="h-[64vh] rounded bg-black/70 border border-white/10 p-2 font-mono text-sm overflow-auto whitespace-pre-wrap">{log || 'Connecting...'}</div>
      <div className="mt-2 flex items-center gap-2">
        <input ref={inputRef} disabled={!connected} placeholder={connected? 'Type a command and press Enter' : 'Not connected'} className="flex-1 px-2 py-1 bg-black/40 border border-white/10 rounded" onKeyDown={(e) => {
          if (e.key === 'Enter') { const v = inputRef.current?.value || ''; if (!v) return; send(v + '\n'); inputRef.current!.value = ''; }
        }} />
        <span className={`text-xs ${connected?'text-green-500':'text-red-500'}`}>{connected? 'connected' : 'disconnected'}</span>
      </div>
    </div>
  );
}
