"use client";
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL || 'http://localhost:8000';

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch(`${CORE_URL}/api/datasets`);
      setDatasets(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 rounded-lg bg-white/5 animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Datasets</h1>
        <button onClick={() => setShowUpload(true)} className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/15 text-sm transition">
          Upload Dataset
        </button>
      </div>

      {showUpload && <UploadPanel onDone={() => { setShowUpload(false); refresh(); }} />}

      {!selected ? (
        datasets.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3 opacity-30">📊</div>
            <p className="opacity-60 mb-3">No datasets yet</p>
            <button onClick={() => setShowUpload(true)} className="px-4 py-2 rounded bg-white/10 hover:bg-white/15 text-sm transition">
              Upload your first dataset
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {datasets.map((ds) => (
              <button key={ds.id} onClick={() => setSelected(ds)}
                className="text-left p-4 rounded-lg border border-white/10 hover:border-white/20 transition">
                <div className="font-medium text-sm">{ds.name}</div>
                {ds.description && <div className="text-xs opacity-60 mt-1 line-clamp-2">{ds.description}</div>}
                <div className="flex gap-3 mt-2 text-xs opacity-50">
                  <span>{ds.row_count?.toLocaleString() || 0} rows</span>
                  <span>{((ds.schema_def as any[]) || []).length} columns</span>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        <DatasetExplorer dataset={selected} onBack={() => setSelected(null)} onDelete={() => { setSelected(null); refresh(); }} />
      )}
    </div>
  );
}

function UploadPanel({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    if (!file || !name.trim()) return;
    setUploading(true);
    try {
      const text = await file.text();
      const res = await fetch(`${CORE_URL}/api/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc, data: text, filename: file.name }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success('Dataset created');
      onDone();
    } catch (err: any) { toast.error(err.message); }
    finally { setUploading(false); }
  }

  return (
    <div className="p-4 rounded-lg border border-white/10 space-y-3">
      <div className="font-medium text-sm">Upload Dataset</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dataset name"
        className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 outline-none text-sm" />
      <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)"
        className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 outline-none text-sm" />
      <div className="flex items-center gap-3">
        <button onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 rounded bg-white/10 text-sm hover:bg-white/15 transition">
          {file ? file.name : 'Choose file (CSV/JSON)'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.json,.tsv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <div className="flex gap-2">
        <button onClick={upload} disabled={uploading || !file || !name.trim()}
          className="px-4 py-1.5 rounded bg-white text-black text-sm font-medium disabled:opacity-50 transition">
          {uploading ? 'Uploading...' : 'Create'}
        </button>
        <button onClick={onDone} className="px-4 py-1.5 rounded bg-white/10 text-sm transition">Cancel</button>
      </div>
    </div>
  );
}

function DatasetExplorer({ dataset, onBack, onDelete }: { dataset: any; onBack: () => void; onDelete: () => void }) {
  const [tab, setTab] = useState<'schema' | 'data' | 'query' | 'chart'>('data');
  const [preview, setPreview] = useState<{ rows: any[]; columns: string[] } | null>(null);
  const [sql, setSql] = useState(`SELECT * FROM data LIMIT 100`);
  const [queryResult, setQueryResult] = useState<{ rows: any[]; columns: string[] } | null>(null);
  const [queryError, setQueryError] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'table'>('table');
  const [loading, setLoading] = useState(true);

  useEffect(() => { void loadPreview(); }, [dataset.id]);

  async function loadPreview() {
    setLoading(true);
    try {
      const res = await fetch(`${CORE_URL}/api/datasets/${dataset.id}/preview`);
      setPreview(await res.json());
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function runQuery() {
    setQueryError('');
    try {
      const res = await fetch(`${CORE_URL}/api/datasets/${dataset.id}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });
      const data = await res.json();
      if (data.error) { setQueryError(data.error); return; }
      setQueryResult(data);
      toast.success(`${data.rows.length} rows returned`);
    } catch (err: any) { setQueryError(err.message); }
  }

  async function deleteDs() {
    if (!confirm('Delete this dataset? This cannot be undone.')) return;
    await fetch(`${CORE_URL}/api/datasets/${dataset.id}`, { method: 'DELETE' });
    toast.success('Dataset deleted');
    onDelete();
  }

  const schema = (dataset.schema_def as any[]) || [];
  const displayData = tab === 'query' ? queryResult : preview;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="px-2 py-1 rounded bg-white/10 text-sm">← Back</button>
        <h2 className="font-semibold flex-1">{dataset.name}</h2>
        <span className="text-xs opacity-50">{dataset.row_count?.toLocaleString()} rows</span>
        <button onClick={deleteDs} className="px-2 py-1 rounded bg-red-600/40 text-xs hover:bg-red-600/60 transition">Delete</button>
      </div>

      <div className="flex gap-2">
        {(['data', 'schema', 'query', 'chart'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded text-sm capitalize ${tab === t ? 'bg-white/15' : 'bg-white/10'}`}>{t}</button>
        ))}
      </div>

      {tab === 'schema' && (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-white/5"><th className="text-left p-2 font-medium">Column</th><th className="text-left p-2 font-medium">Type</th></tr></thead>
            <tbody>
              {schema.map((col: any, i: number) => (
                <tr key={i} className="border-t border-white/5">
                  <td className="p-2 font-mono text-xs">{col.name}</td>
                  <td className="p-2 opacity-60 text-xs">{col.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'data' && (
        loading ? (
          <div className="h-64 rounded-lg bg-white/5 animate-pulse" />
        ) : preview && preview.rows.length > 0 ? (
          <DataTable columns={preview.columns} rows={preview.rows} />
        ) : (
          <div className="text-center py-8 opacity-60 text-sm">No data to display</div>
        )
      )}

      {tab === 'query' && (
        <div className="space-y-3">
          <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={4}
            className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 font-mono text-sm outline-none resize-y" />
          <div className="flex gap-2">
            <button onClick={runQuery} className="px-4 py-1.5 rounded bg-white text-black text-sm font-medium transition">Run Query</button>
          </div>
          {queryError && <div className="p-2 rounded bg-red-600/20 text-sm text-red-400">{queryError}</div>}
          {queryResult && queryResult.rows.length > 0 && <DataTable columns={queryResult.columns} rows={queryResult.rows} />}
        </div>
      )}

      {tab === 'chart' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['table', 'bar', 'line'] as const).map((ct) => (
              <button key={ct} onClick={() => setChartType(ct)}
                className={`px-3 py-1.5 rounded text-sm capitalize ${chartType === ct ? 'bg-white/15' : 'bg-white/10'}`}>{ct}</button>
            ))}
          </div>
          {displayData && displayData.rows.length > 0 ? (
            chartType === 'table' ? (
              <DataTable columns={displayData.columns} rows={displayData.rows} />
            ) : (
              <SimpleChart type={chartType} columns={displayData.columns} rows={displayData.rows} />
            )
          ) : (
            <div className="text-center py-8 opacity-60 text-sm">Run a query first to see charts</div>
          )}
        </div>
      )}
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: any[] }) {
  return (
    <div className="border border-white/10 rounded-lg overflow-x-auto max-h-[60vh]">
      <table className="w-full text-xs">
        <thead className="sticky top-0">
          <tr className="bg-white/5">
            {columns.map((col) => (
              <th key={col} className="text-left p-2 font-medium whitespace-nowrap">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]">
              {columns.map((col) => (
                <td key={col} className="p-2 whitespace-nowrap max-w-[200px] truncate">{String(row[col] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SimpleChart({ type, columns, rows }: { type: 'bar' | 'line'; columns: string[]; rows: any[] }) {
  // Simple CSS-based chart using the first two columns as label + value
  const labelCol = columns[0];
  const valueCol = columns.find((c, i) => i > 0 && typeof rows[0]?.[c] === 'number') || columns[1];
  if (!labelCol || !valueCol) return <div className="text-sm opacity-60">Need at least 2 columns (label + numeric value)</div>;

  const values = rows.map((r) => Number(r[valueCol]) || 0);
  const labels = rows.map((r) => String(r[labelCol] ?? ''));
  const max = Math.max(...values, 1);

  if (type === 'bar') {
    return (
      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {labels.slice(0, 50).map((label, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs w-24 truncate opacity-60">{label}</span>
            <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
              <div className="h-full bg-white/20 rounded transition-all" style={{ width: `${(values[i] / max) * 100}%` }} />
            </div>
            <span className="text-xs opacity-50 w-16 text-right">{values[i].toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  // Line chart using SVG
  const w = 600, h = 200, pad = 30;
  const xStep = (w - pad * 2) / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => `${pad + i * xStep},${h - pad - ((v / max) * (h - pad * 2))}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[600px] h-[200px]">
      <polyline fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" points={points} />
      {values.map((v, i) => (
        <circle key={i} cx={pad + i * xStep} cy={h - pad - ((v / max) * (h - pad * 2))} r="3" fill="rgba(255,255,255,0.6)" />
      ))}
    </svg>
  );
}
