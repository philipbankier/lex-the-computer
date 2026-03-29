"use client";
import { useEffect, useRef, useState } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:3001';

export default function TerminalShell() {
  const [log, setLog] = useState<string>('');
  const [connected, setConnected] = useState<boolean>(false);
  const [sshKeys, setSshKeys] = useState<any[]>([]);
  const [sshOutput, setSshOutput] = useState<string>('');
  const [sshCmd, setSshCmd] = useState('');
  const [activeSSH, setActiveSSH] = useState<string | null>(null);
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
    // Load SSH keys
    fetch(`${CORE_URL}/api/ssh/keys`).then(r => r.json()).then(setSshKeys).catch(() => {});
    return () => { try { ws?.close(); } catch {} };
  }, []);

  function append(s: string) { setLog((x) => x + s); }
  function send(s: string) { wsRef.current?.send(JSON.stringify({ type: 'input', data: s })); }

  async function runSSHCommand() {
    if (!activeSSH || !sshCmd.trim()) return;
    setSshOutput(prev => prev + `$ ${sshCmd}\n`);
    try {
      const res = await fetch(`${CORE_URL}/api/ssh/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: activeSSH, command: sshCmd }),
      });
      const data = await res.json();
      if (data.error) {
        setSshOutput(prev => prev + `Error: ${data.error}\n`);
      } else {
        setSshOutput(prev => prev + (data.stdout || '') + (data.stderr ? `\nSTDERR: ${data.stderr}` : '') + '\n');
      }
    } catch (e: any) {
      setSshOutput(prev => prev + `Error: ${e.message}\n`);
    }
    setSshCmd('');
  }

  return (
    <div className="flex h-full">
      {/* SSH Sidebar */}
      <div className="w-56 border-r border-white/10 p-3 space-y-2 shrink-0">
        <div className="text-sm font-medium opacity-80">SSH Connections</div>
        {sshKeys.length === 0 && <div className="text-xs opacity-40">No SSH connections saved. Add in Settings.</div>}
        {sshKeys.map((k: any) => (
          <button
            key={k.id}
            onClick={() => { setActiveSSH(k.name); setSshOutput(`Connected to ${k.username}@${k.host}\n`); }}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${activeSSH === k.name ? 'bg-white/15' : 'bg-white/5 hover:bg-white/10'}`}
          >
            <div className="font-medium truncate">{k.name}</div>
            <div className="text-xs opacity-50 truncate">{k.username}@{k.host}</div>
          </button>
        ))}
        {activeSSH && (
          <button onClick={() => { setActiveSSH(null); setSshOutput(''); }} className="w-full px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20">
            Disconnect
          </button>
        )}
      </div>

      {/* Terminal Area */}
      <div className="flex-1 p-6">
        {activeSSH ? (
          <>
            <div className="text-sm font-medium mb-2 opacity-80">SSH: {activeSSH}</div>
            <div className="h-[60vh] rounded bg-black/70 border border-white/10 p-2 font-mono text-sm overflow-auto whitespace-pre-wrap">{sshOutput || 'Ready. Type a command below.'}</div>
            <div className="mt-2 flex items-center gap-2">
              <input
                value={sshCmd}
                onChange={(e) => setSshCmd(e.target.value)}
                placeholder="Type command and press Enter"
                className="flex-1 px-2 py-1 bg-black/40 border border-white/10 rounded font-mono"
                onKeyDown={(e) => { if (e.key === 'Enter') runSSHCommand(); }}
              />
              <span className="text-xs text-green-500">SSH</span>
            </div>
          </>
        ) : (
          <>
            <div className="h-[64vh] rounded bg-black/70 border border-white/10 p-2 font-mono text-sm overflow-auto whitespace-pre-wrap">{log || 'Connecting...'}</div>
            <div className="mt-2 flex items-center gap-2">
              <input ref={inputRef} disabled={!connected} placeholder={connected? 'Type a command and press Enter' : 'Not connected'} className="flex-1 px-2 py-1 bg-black/40 border border-white/10 rounded" onKeyDown={(e) => {
                if (e.key === 'Enter') { const v = inputRef.current?.value || ''; if (!v) return; send(v + '\n'); inputRef.current!.value = ''; }
              }} />
              <span className={`text-xs ${connected?'text-green-500':'text-red-500'}`}>{connected? 'connected' : 'disconnected'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
