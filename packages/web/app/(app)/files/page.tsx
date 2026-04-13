"use client";
import { useEffect, useMemo, useRef, useState } from 'react';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

type Entry = { name: string; path: string; type: 'file'|'dir'|'other'; size: number; modified: string|null };

export default function FilesShell() {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tree, setTree] = useState<Record<string, Entry[]>>({});
  const [view, setView] = useState<'list'|'grid'>('list');
  const [selected, setSelected] = useState<Entry|null>(null);
  const [preview, setPreview] = useState<{ path: string; content?: string }|null>(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void loadDir(''); }, []);
  useEffect(() => { void loadDir(currentPath); }, [currentPath]);

  async function loadDir(p: string) {
    const r = await fetch(`${CORE_URL}/api/files?path=${encodeURIComponent(p)}`);
    const j = await r.json();
    setEntries(j.entries || []);
    setTree((t) => ({ ...t, [p]: (j.entries || []).filter((e: Entry) => e.type === 'dir') }));
  }

  function crumbs() {
    const parts = currentPath.split('/').filter(Boolean);
    const cr = [{ label: 'workspace', path: '' } as const, ...parts.map((_, i) => ({ label: parts[i], path: parts.slice(0, i+1).join('/') }))];
    return cr;
  }

  async function openFile(e: Entry) {
    setSelected(e);
    if (e.type !== 'file') return;
    const ext = e.name.split('.').pop()?.toLowerCase();
    if (['png','jpg','jpeg','gif','webp','mp4','mp3','wav','ogg','pdf','mov','webm'].includes(ext || '')) { setPreview({ path: e.path }); return; }
    const r = await fetch(`${CORE_URL}/api/files/content?path=${encodeURIComponent(e.path)}`);
    const j = await r.json();
    setPreview({ path: e.path, content: j.snippet });
  }

  async function newFile() {
    const name = prompt('New file name');
    if (!name) return;
    const rel = [currentPath, name].filter(Boolean).join('/');
    await fetch(`${CORE_URL}/api/files/content`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: rel, content: '' })});
    await loadDir(currentPath);
  }

  async function newFolder() {
    const name = prompt('New folder name');
    if (!name) return;
    const rel = [currentPath, name].filter(Boolean).join('/');
    await fetch(`${CORE_URL}/api/files/mkdir`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: rel })});
    await loadDir(currentPath);
  }

  async function renameEntry(e: Entry) {
    const np = prompt('Rename to', e.name);
    if (!np) return;
    const dest = [currentPath, np].filter(Boolean).join('/');
    await fetch(`${CORE_URL}/api/files/content`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: e.path, newPath: dest })});
    await loadDir(currentPath);
  }

  async function deleteEntry(e: Entry) {
    if (!confirm(`Delete ${e.name}?`)) return;
    await fetch(`${CORE_URL}/api/files`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: e.path })});
    setSelected(null); setPreview(null);
    await loadDir(currentPath);
  }

  async function download(e: Entry) {
    if (e.type === 'file') {
      window.open(`${CORE_URL}/api/files/download?path=${encodeURIComponent(e.path)}`, '_blank');
    } else if (e.type === 'dir') {
      window.open(`${CORE_URL}/api/files/download-zip?path=${encodeURIComponent(e.path)}`, '_blank');
    }
  }

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const files = ev.dataTransfer.files;
    if (!files || !files.length) return;
    const fd = new FormData();
    fd.append('dir', currentPath);
    Array.from(files).forEach((f) => fd.append('file', f));
    void fetch(`${CORE_URL}/api/files/upload`, { method:'POST', body: fd }).then(() => loadDir(currentPath));
  }

  function onUploadClick() { fileInputRef.current?.click(); }
  function onFileInputChange(ev: any) {
    const files = ev.target.files; if (!files || !files.length) return;
    const fd = new FormData(); fd.append('dir', currentPath); Array.from(files).forEach((f: any) => fd.append('file', f as Blob));
    void fetch(`${CORE_URL}/api/files/upload`, { method:'POST', body: fd }).then(() => loadDir(currentPath));
  }

  const sorted = useMemo(() => [...entries].sort((a,b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1), [entries]);

  async function doSearch() {
    const r = await fetch(`${CORE_URL}/api/files/search?q=${encodeURIComponent(search)}&type=content`);
    const j = await r.json();
    alert(`Found ${j.results?.length || 0} matches`);
  }

  return (
    <div className="p-6 grid grid-cols-[260px_1fr] gap-4" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <input ref={fileInputRef} type="file" className="hidden" multiple onChange={onFileInputChange} />
      <div className="border border-white/10 rounded p-2 overflow-auto h-[70vh]">
        <TreeNode label="workspace" path="" tree={tree} onExpand={async (p: string) => void loadDir(p)} onClick={(p: string) => setCurrentPath(p)} current={currentPath} />
        {(tree[''] || []).map((e) => (
          <Dir key={e.path} entry={e} depth={1} tree={tree} onExpand={async (p: string) => void loadDir(p)} onClick={(p: string) => setCurrentPath(p)} current={currentPath} />
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-2">
            <button onClick={onUploadClick} className="px-3 py-1.5 bg-white/10 rounded">Upload</button>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="px-2 py-1 bg-black/40 border border-white/10 rounded text-sm" />
            <button onClick={doSearch} className="px-3 py-1.5 bg-white/10 rounded">Go</button>
            <button onClick={() => setView(view === 'list' ? 'grid' : 'list')} className="px-3 py-1.5 bg-white/10 rounded">{view === 'list' ? 'Grid' : 'List'}</button>
            <button onClick={newFile} className="px-3 py-1.5 bg-white/10 rounded">New File</button>
            <button onClick={newFolder} className="px-3 py-1.5 bg-white/10 rounded">New Folder</button>
          </div>
        </div>
        <div className="text-sm opacity-80 mb-2">
          {crumbs().map((c, i) => (
            <span key={c.path}>
              <button onClick={() => setCurrentPath(c.path)} className="hover:underline">{c.label}</button>
              {i < crumbs().length - 1 ? ' / ' : ''}
            </span>
          ))}
        </div>

        {view === 'list' ? (
          <div className="rounded border border-white/10 h-[56vh] overflow-auto">
            <div className="px-3 py-2 border-b border-white/10 text-sm opacity-80 grid grid-cols-[1fr_120px_200px_160px] gap-3">
              <div>Name</div><div>Size</div><div>Modified</div><div>Actions</div>
            </div>
            {sorted.map((e) => (
              <div key={e.path} className={`px-3 py-2 grid grid-cols-[1fr_120px_200px_160px] gap-3 hover:bg-white/5 cursor-pointer ${selected?.path===e.path?'bg-white/10':''}`}
                onClick={() => e.type==='dir'? setCurrentPath(e.path) : openFile(e)}>
                <div>{e.type==='dir'?'📁':'📄'} {e.name}</div>
                <div>{e.type==='dir'?'—':formatBytes(e.size)}</div>
                <div>{e.modified?.replace('T',' ').replace('Z','') || ''}</div>
                <div className="flex gap-2">
                  <button onClick={(ev)=>{ev.stopPropagation(); void download(e);}} className="px-2 py-1 text-xs bg-white/10 rounded">Download</button>
                  <button onClick={(ev)=>{ev.stopPropagation(); void renameEntry(e);}} className="px-2 py-1 text-xs bg-white/10 rounded">Rename</button>
                  <button onClick={(ev)=>{ev.stopPropagation(); void deleteEntry(e);}} className="px-2 py-1 text-xs bg-red-600/70 rounded">Delete</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 h-[56vh] overflow-auto">
            {sorted.map((e) => (
              <div key={e.path} onClick={() => e.type==='dir'? setCurrentPath(e.path) : openFile(e)} className="p-3 border border-white/10 rounded hover:bg-white/5 cursor-pointer">
                <div className="text-4xl mb-2">{e.type==='dir'?'📁':'📄'}</div>
                <div className="truncate">{e.name}</div>
              </div>
            ))}
          </div>
        )}

        {preview && (
          <div className="mt-4 border border-white/10 rounded p-2">
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium">{preview.path}</div>
              <div className="flex gap-2">
                <button onClick={() => window.open(`${CORE_URL}/api/files/download?path=${encodeURIComponent(preview.path)}`)} className="px-2 py-1 text-xs bg-white/10 rounded">Download</button>
                <button onClick={() => window.location.href='/chats'} className="px-2 py-1 text-xs bg-white/10 rounded">Chat about this file</button>
              </div>
            </div>
            <FileViewer preview={preview} onSave={async (content) => {
              await fetch(`${CORE_URL}/api/files/content`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ path: preview.path, content })});
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(n: number) { if (!n) return '0 B'; const u = ['B','KB','MB','GB']; let i=0; while (n>1024&&i<u.length-1){n/=1024;i++;} return `${n.toFixed(1)} ${u[i]}`; }

function TreeNode({ label, path: p, onExpand, onClick, current }: any) {
  return (
    <div className="px-1 py-1">
      <button onClick={() => onClick(p)} className={`text-sm ${current===p?'underline':''}`}>📁 {label}</button>
    </div>
  );
}
function Dir({ entry, depth, tree, onExpand, onClick, current }: any) {
  const children = tree[entry.path] || [];
  return (
    <div className="pl-2">
      <div className="flex items-center gap-1">
        <button onClick={() => onExpand(entry.path)} className="text-xs px-1 py-0.5 bg-white/10 rounded">+</button>
        <button onClick={() => onClick(entry.path)} className={`text-sm ${current===entry.path?'underline':''}`}>📁 {entry.name}</button>
      </div>
      <div className="pl-4">
        {children.map((c: Entry) => (
          c.type==='dir' ? (
            <Dir key={c.path} entry={c} depth={depth+1} tree={tree} onExpand={onExpand} onClick={onClick} current={current} />
          ) : null
        ))}
      </div>
    </div>
  );
}

function FileViewer({ preview, onSave }: { preview: { path: string; content?: string }, onSave: (content: string) => Promise<void> }) {
  const ext = preview.path.split('.').pop()?.toLowerCase();
  const [content, setContent] = useState(preview.content || '');
  useEffect(() => { setContent(preview.content || ''); }, [preview.path]);
  if (!ext || !preview) return null;
  if (['png','jpg','jpeg','gif','webp'].includes(ext)) return (<img src={`${CORE_URL}/api/files/download?path=${encodeURIComponent(preview.path)}`} className="max-h-[60vh] object-contain" />);
  if (['mp4','mov','webm'].includes(ext)) return (<video src={`${CORE_URL}/api/files/download?path=${encodeURIComponent(preview.path)}`} controls className="max-h-[60vh]" />);
  if (['mp3','wav','ogg'].includes(ext)) return (<audio src={`${CORE_URL}/api/files/download?path=${encodeURIComponent(preview.path)}`} controls />);
  if (ext === 'pdf') return (<iframe src={`${CORE_URL}/api/files/download?path=${encodeURIComponent(preview.path)}`} className="w-full h-[60vh]" />);
  if (ext === 'md') return (
    <div className="grid grid-cols-2 gap-3">
      <textarea value={content} onChange={(e)=>setContent(e.target.value)} className="w-full h-[60vh] bg-black/40 border border-white/10 rounded p-2 font-mono text-sm" />
      <Markdown content={content} />
      <div className="col-span-2"><button onClick={()=>onSave(content)} className="px-3 py-1.5 bg-white/10 rounded">Save</button></div>
    </div>
  );
  return (
    <div>
      <textarea value={content} onChange={(e)=>setContent(e.target.value)} className="w-full h-[60vh] bg-black/40 border border-white/10 rounded p-2 font-mono text-sm" />
      <div className="mt-2"><button onClick={()=>onSave(content)} className="px-3 py-1.5 bg-white/10 rounded">Save</button></div>
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  // Simple client-side markdown using react-markdown
  const ReactMarkdown = require('react-markdown');
  const remarkGfm = require('remark-gfm');
  return <div className="prose prose-invert max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>;
}
