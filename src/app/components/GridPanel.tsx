/**
 * GridPanel — a fully self-contained scoring grid.
 * Used twice (Grid 1 + Grid 2) inside the ScoringGrid page.
 * The parent tracks dirty state via onDirtyChange and calls save()
 * from the exposed imperative handle (gridRef.current.getSnapshot()).
 */
import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef, useRef } from 'react';
import {
  Plus, Trash2, Edit2, Check, X, UserPlus,
  CheckSquare, Square, Copy, Hash, FileText, ChevronRight,
  Calendar, TableProperties,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  ScoreGroup, ScoreParam, ManualParam, MetaColumn,
  AgentRow, GridSnapshot,
} from '../context/GridContext';
import { supabaseSave, supabaseLoad } from '../../lib/supabase';
import { useData } from '../context/DataContext';

// ── localStorage helpers ───────────────────────────────────────────────────────

function lsGet(key: string): GridSnapshot | null {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
}
function lsSave(key: string, snap: GridSnapshot) {
  try { localStorage.setItem(key, JSON.stringify(snap)); } catch { /* quota */ }
}

// Load a specific field from saved snapshot, or fall back to deep-cloned seed
function loadField<T>(storageKey: string, field: keyof GridSnapshot, fallback: T): T {
  const snap = lsGet(storageKey);
  const val  = snap?.[field];
  return (Array.isArray(val) && val.length > 0) ? (val as unknown as T) : JSON.parse(JSON.stringify(fallback)) as T;
}

// Load rows — Grid 1 gets a default "Agent 1", Grid 2 starts empty so grids are visually distinct
function loadRows(storageKey: string): AgentRow[] {
  const snap = lsGet(storageKey);
  if (snap?.rows && snap.rows.length > 0) return snap.rows;
  if (storageKey === 'qa_grid_1') {
    return [{ ...makeRow(SEED_SCORE, SEED_MANUAL, SEED_META), agentName: 'Agent 1' }];
  }
  return [];
}

// ── Migration helpers (handle snapshots saved before new columns were added) ──

const SHIFT_COL: MetaColumn = { id: 'mc-shift', name: 'Shift', type: 'text' };

/** Ensure the Shift column exists in metaCols (migration for old snapshots) */
function migrateMetaCols(cols: MetaColumn[]): MetaColumn[] {
  const cleanCols = cols.filter(c => !c.name.toLowerCase().includes('week'));
  if (cleanCols.some(c => c.name.toLowerCase().includes('shift'))) return cleanCols;
  return [SHIFT_COL, ...cleanCols]; // prepend Shift as the first meta column
}

/** Ensure all rows have a metaValue entry for every current meta column and a weekKey */
function migrateRows(rows: AgentRow[], cols: MetaColumn[]): AgentRow[] {
  const weekCol = cols.find(c => c.name.toLowerCase().includes('week'));
  return rows.map(r => {
    const meta = { ...r.metaValues };
    cols.forEach(c => { if (!(c.id in meta)) meta[c.id] = ''; });
    
    // Assign a weekKey for backward compatibility if it does not exist
    let wKey = r.weekKey;
    if (!wKey && weekCol) {
      const wVal = meta[weekCol.id];
      if (wVal) {
        const num = wVal.match(/\d+/);
        wKey = `2026-W${num ? num[0] : '25'}`;
      } else {
        wKey = '2026-W25';
      }
    }
    return { ...r, weekKey: wKey || '2026-W25', metaValues: meta };
  });
}

// ── Colour palette ────────────────────────────────────────────────────────────

const PALETTE_COLORS = [
  { bg: '#EFF6FF', header: '#1D4ED8', light: '#DBEAFE', text: '#1E40AF' },
  { bg: '#F5F3FF', header: '#6D28D9', light: '#EDE9FE', text: '#5B21B6' },
  { bg: '#ECFDF5', header: '#047857', light: '#D1FAE5', text: '#065F46' },
  { bg: '#FFFBEB', header: '#B45309', light: '#FEF3C7', text: '#92400E' },
  { bg: '#FFF1F2', header: '#BE123C', light: '#FFE4E6', text: '#9F1239' },
  { bg: '#ECFEFF', header: '#0E7490', light: '#CFFAFE', text: '#155E75' },
];
const pal = (i: number) => PALETTE_COLORS[i % PALETTE_COLORS.length];

function uid() { return `id-${Math.random().toString(36).slice(2, 9)}`; }

// ── Seed data (each panel starts with fresh copies) ───────────────────────────

export const SEED_GROUPS: ScoreGroup[] = [
  { id: 'g-co', name: 'Call Opening',         colorIdx: 0 },
  { id: 'g-cs', name: 'Communication Skills', colorIdx: 1 },
  { id: 'g-ch', name: 'Call Handling',        colorIdx: 2 },
  { id: 'g-pa', name: 'Process Adherence',    colorIdx: 3 },
];
export const SEED_SCORE: ScoreParam[] = [
  { id: 'sp1',  name: 'Greeting',             score: 2, groupId: 'g-co' },
  { id: 'sp2',  name: 'Attention Statement',  score: 2, groupId: 'g-co' },
  { id: 'sp3',  name: 'State Problem',        score: 2, groupId: 'g-co' },
  { id: 'sp4',  name: 'Professionalism',      score: 2, groupId: 'g-co' },
  { id: 'sp5',  name: 'Active Listening',     score: 2, groupId: 'g-cs' },
  { id: 'sp6',  name: 'Empathy',              score: 2, groupId: 'g-cs' },
  { id: 'sp7',  name: 'Silence Avoidance',    score: 2, groupId: 'g-cs' },
  { id: 'sp8',  name: 'Tone of Speech',       score: 2, groupId: 'g-cs' },
  { id: 'sp9',  name: 'Protocol',             score: 2, groupId: 'g-ch' },
  { id: 'sp10', name: 'Attentiveness',        score: 2, groupId: 'g-ch' },
  { id: 'sp11', name: 'Scripting',            score: 2, groupId: 'g-ch' },
  { id: 'sp12', name: 'First Call Resolution',score: 2, groupId: 'g-ch' },
  { id: 'sp13', name: 'Service Assist',       score: 2, groupId: 'g-pa' },
  { id: 'sp14', name: 'Conference Call',      score: 2, groupId: 'g-pa' },
  { id: 'sp15', name: 'Escalation',           score: 2, groupId: 'g-pa' },
  { id: 'sp16', name: 'Compliance',           score: 2, groupId: 'g-pa' },
];
export const SEED_MANUAL: ManualParam[] = [
  { id: 'mp1', name: 'Confirmation' },
  { id: 'mp2', name: 'Road / HC' },
  { id: 'mp3', name: 'Remark' },
  { id: 'mp4', name: 'Call ID' },
];
export const SEED_META: MetaColumn[] = [
  { id: 'mc-shift', name: 'Shift',          type: 'text'   }, // Morning/Afternoon/Night
  { id: 'mc-audit', name: 'Audit Date',     type: 'date'   },
  { id: 'mc-caseid',name: 'Case ID',        type: 'text'   },
  { id: 'mc-reg',   name: 'Case Reg. Date', type: 'date'   },
  { id: 'mc-calls', name: 'Call Count',     type: 'number' },
];

function makeRow(sParams: ScoreParam[], mParams: ManualParam[], mCols: MetaColumn[]): AgentRow {
  const checked: Record<string, boolean> = {};
  const manualValues: Record<string, string> = {};
  const metaValues: Record<string, string> = {};
  sParams.forEach(p => { checked[p.id] = false; });
  mParams.forEach(p => { manualValues[p.id] = ''; });
  mCols.forEach(c => { metaValues[c.id] = ''; });
  return { rowId: uid(), agentName: '', checked, manualValues, metaValues };
}

function scorePct(s: number, m: number) { return m === 0 ? 0 : Math.round((s / m) * 100); }
function scoreColor(p: number) { return p >= 80 ? '#059669' : p >= 50 ? '#D97706' : p > 0 ? '#DC2626' : '#94A3B8'; }
function scoreBg(p: number)    { return p >= 80 ? '#ECFDF5' : p >= 50 ? '#FFFBEB' : p > 0 ? '#FFF1F2' : '#F8FAFC'; }

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="font-semibold text-slate-800 text-base flex items-center gap-2">{title}</div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
function FL({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{children}</p>;
}

// ── All the small modals ──────────────────────────────────────────────────────

function EditSubheaderModal({ name, score, isScore, onSave, onClose }: { name: string; score: number; isScore: boolean; onSave: (name: string, score: number) => void; onClose: () => void }) {
  const [dName, setDName] = useState(name); const [dScore, setDScore] = useState(score);
  const save = () => { if (dName.trim()) { onSave(dName.trim(), dScore); onClose(); } };
  return (
    <Modal title={<><Edit2 className="size-4 text-blue-600" />Edit Column</>} onClose={onClose}>
      <div className="space-y-4">
        <div><FL>Column Name</FL><input autoFocus value={dName} onChange={e => setDName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
        {isScore && <div><FL>Score Value</FL><input type="number" min={0} max={20} value={dScore} onChange={e => setDScore(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>}
        <div className="flex gap-2 pt-1"><button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button><button onClick={save} disabled={!dName.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40">Save</button></div>
      </div>
    </Modal>
  );
}

function EditGroupModal({ name, onSave, onClose }: { name: string; onSave: (n: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(name); const save = () => { if (draft.trim()) { onSave(draft.trim()); onClose(); } };
  return (
    <Modal title={<><Edit2 className="size-4 text-blue-600" />Rename Header</>} onClose={onClose}>
      <div className="space-y-4">
        <div><FL>Header Name</FL><input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
        <div className="flex gap-2 pt-1"><button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button><button onClick={save} disabled={!draft.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40">Save</button></div>
      </div>
    </Modal>
  );
}

function EditAgentModal({ name, onSave, onClose }: { name: string; onSave: (n: string) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(name); const save = () => { if (draft.trim()) { onSave(draft.trim()); onClose(); } };
  return (
    <Modal title={<><Edit2 className="size-4 text-blue-600" />Edit Agent Name</>} onClose={onClose}>
      <div className="space-y-4">
        <div><FL>Agent Name</FL><input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></div>
        <div className="flex gap-2 pt-1"><button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button><button onClick={save} disabled={!draft.trim()} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40">Save</button></div>
      </div>
    </Modal>
  );
}

function ManualCellModal({ agentName, paramName, value, onSave, onDelete, onClose }: { agentName: string; paramName: string; value: string; onSave: (v: string) => void; onDelete: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Modal title={<><span className="text-slate-800">{paramName}</span><ChevronRight className="size-4 text-slate-300" /><span className="text-slate-500 font-normal text-sm">{agentName}</span></>} onClose={onClose}>
      <div className="space-y-4">
        <div><FL>Details</FL><textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={4} placeholder="Enter details…" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none leading-relaxed" /></div>
        <div className="flex gap-2">
          {value && <button onClick={() => { onDelete(); onClose(); }} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50"><Trash2 className="size-3.5" />Delete</button>}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button>
          <button onClick={() => { onSave(draft.trim()); onClose(); }} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 flex items-center justify-center gap-1.5"><Check className="size-4" />Save</button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmDelete({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title={<><Trash2 className="size-4 text-red-500" /><span className="text-red-600">Confirm Delete</span></>} onClose={onCancel}>
      <div className="space-y-5">
        <p className="text-sm text-slate-600">Delete <span className="font-semibold text-slate-800">"{label}"</span>? This cannot be undone.</p>
        <div className="flex gap-2"><button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button><button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700">Delete</button></div>
      </div>
    </Modal>
  );
}

function ConfirmUncheck({ agentName, paramName, onConfirm, onCancel }: { agentName: string; paramName: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal title={<><Square className="size-4 text-orange-500" /><span className="text-orange-600">Uncheck Parameter?</span></>} onClose={onCancel}>
      <div className="space-y-5">
        <p className="text-sm text-slate-600">Remove <span className="font-semibold text-slate-800">"{paramName}"</span> from <span className="font-semibold text-slate-800">{agentName}</span>'s score?</p>
        <div className="flex gap-2"><button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button><button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600">Confirm</button></div>
      </div>
    </Modal>
  );
}

// ── Add Parameter Dialog ──────────────────────────────────────────────────────

const NEW_HDR = '__new__';
function AddParamDialog({ groups, fixedGroupId, onAddScore, onAddManual, onClose }: {
  groups: ScoreGroup[]; fixedGroupId?: string;
  onAddScore: (groupId: string, name: string, score: number, newGroupName?: string) => void;
  onAddManual: (name: string) => void; onClose: () => void;
}) {
  const [step, setStep] = useState<'pick'|'score'|'manual'>(fixedGroupId ? 'score' : 'pick');
  const [gId, setGId] = useState(fixedGroupId ?? groups[0]?.id ?? '');
  const [newHdr, setNewHdr] = useState(''); const [pName, setPName] = useState(''); const [pScore, setPScore] = useState(2); const [mName, setMName] = useState('');
  const isNew = gId === NEW_HDR;
  const subScore = () => { if (!pName.trim()) return; isNew ? onAddScore('', pName.trim(), pScore, newHdr.trim()||'New Group') : onAddScore(gId, pName.trim(), pScore); onClose(); };
  const subManual = () => { if (!mName.trim()) return; onAddManual(mName.trim()); onClose(); };
  return (
    <Modal title={step==='pick'?<><Plus className="size-4 text-emerald-600"/>Add Parameter</>:step==='score'?<><Hash className="size-4 text-blue-600"/>Add Score Column</>:<><FileText className="size-4 text-violet-600"/>Add Info Tab</>} onClose={onClose}>
      {step==='pick'&&(
        <div className="space-y-4">
          <p className="text-sm text-slate-500">What would you like to add?</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={()=>setStep('score')} className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"><div className="size-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200"><Hash className="size-6 text-blue-600"/></div><div className="text-center"><p className="font-bold text-slate-800 text-sm">Score</p><p className="text-xs text-slate-400 mt-0.5">Checkbox · numeric</p></div></button>
            <button onClick={()=>setStep('manual')} className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-all group"><div className="size-12 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200"><FileText className="size-6 text-violet-600"/></div><div className="text-center"><p className="font-bold text-slate-800 text-sm">Manual</p><p className="text-xs text-slate-400 mt-0.5">Free text · info</p></div></button>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50">Cancel</button>
        </div>
      )}
      {step==='score'&&(
        <div className="space-y-4">
          {!fixedGroupId&&(
            <div>
              <FL>Header</FL>
              <select value={gId} onChange={e=>{setGId(e.target.value);setNewHdr('');}} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white">
                {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                <option value={NEW_HDR}>＋ Create new header…</option>
              </select>
              {isNew&&<div className="mt-2 flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-blue-300 bg-blue-50"><Plus className="size-4 text-blue-500 shrink-0"/><input autoFocus type="text" placeholder="New header name…" value={newHdr} onChange={e=>setNewHdr(e.target.value)} className="flex-1 bg-transparent text-sm outline-none font-medium text-slate-800 placeholder-blue-300"/>{newHdr.trim()&&<Check className="size-4 text-blue-500"/>}</div>}
            </div>
          )}
          {fixedGroupId&&<div className="px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-700 font-medium">Adding to: {groups.find(g=>g.id===fixedGroupId)?.name}</div>}
          <div><FL>Subheader (column name)</FL><input autoFocus={!!fixedGroupId} value={pName} onChange={e=>setPName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&subScore()} placeholder="e.g. Hold Procedure" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"/></div>
          <div><FL>Default Score</FL><input type="number" min={0} max={20} value={pScore} onChange={e=>setPScore(Number(e.target.value))} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"/></div>
          <div className="flex gap-2 pt-1">{!fixedGroupId&&<button onClick={()=>setStep('pick')} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Back</button>}<button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button><button onClick={subScore} disabled={!pName.trim()||(isNew&&!newHdr.trim())} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40">Add Column</button></div>
        </div>
      )}
      {step==='manual'&&(
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-700">This tab will appear under <span className="font-bold">Additional Info</span>.</div>
          <div><FL>Tab Name</FL><input autoFocus value={mName} onChange={e=>setMName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&subManual()} placeholder="e.g. Confirmation, Remark" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"/></div>
          <div className="flex gap-2 pt-1"><button onClick={()=>setStep('pick')} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Back</button><button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button><button onClick={subManual} disabled={!mName.trim()} className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-40">Add Tab</button></div>
        </div>
      )}
    </Modal>
  );
}

function AddMetaColDialog({ onAdd, onClose }: { onAdd: (name: string, type: MetaType) => void; onClose: () => void }) {
  const [name, setName] = useState(''); const [type, setType] = useState<MetaType>('text');
  const submit = () => { if (name.trim()) { onAdd(name.trim(), type); onClose(); } };
  const opts: {v:MetaType;l:string;d:string;icon:React.ReactNode}[] = [
    {v:'text',l:'Text',d:'Free text',icon:<FileText className="size-4"/>},
    {v:'number',l:'Number',d:'Numeric',icon:<Hash className="size-4"/>},
    {v:'date',l:'Date',d:'Calendar picker',icon:<Calendar className="size-4"/>},
  ];
  return (
    <Modal title={<><TableProperties className="size-4 text-amber-600"/>Add Case Detail Column</>} onClose={onClose}>
      <div className="space-y-4">
        <div><FL>Column Name</FL><input autoFocus value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="e.g. Supervisor…" className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"/></div>
        <div><FL>Input Type</FL><div className="grid grid-cols-3 gap-2">{opts.map(o=><button key={o.v} onClick={()=>setType(o.v)} className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all ${type===o.v?'border-amber-500 bg-amber-50 text-amber-700':'border-slate-200 text-slate-500 hover:border-amber-300 bg-slate-50'}`}>{o.icon}<span className="text-xs font-bold">{o.l}</span><span className="text-[10px] opacity-60 text-center leading-tight">{o.d}</span></button>)}</div></div>
        <div className="flex gap-2 pt-1"><button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">Cancel</button><button onClick={submit} disabled={!name.trim()} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold hover:bg-amber-600 disabled:opacity-40">Add Column</button></div>
      </div>
    </Modal>
  );
}



// ── GridPanel imperative handle ───────────────────────────────────────────────

export interface GridPanelHandle {
  getSnapshot:      () => GridSnapshot;
  triggerAction:    (action: 'agent' | 'parameter' | 'detail') => void;
  /** Revert grid state to a given snapshot (used by Discard & Continue) */
  resetToSnapshot:  (snap: GridSnapshot | null) => void;
  /** Names of all agents currently in this grid */
  getAgentNames:    () => string[];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface GridPanelProps {
  storageKey: string;
  label: string;
  weekKey: string;
  weekNum: number;
  weekStart: Date;
  onDirtyChange: (dirty: boolean) => void;
  externalAgents?: string[];
  onAgentDeleted?: (name: string) => void;
  readOnly?: boolean;
}

// ── Seed factory ──────────────────────────────────────────────────────────────

function seedSnap(storageKey: string): GridSnapshot {
  return {
    label: storageKey === 'qa_grid_1' ? 'Scoring Grid 1' : 'Scoring Grid 2',
    groups:      JSON.parse(JSON.stringify(SEED_GROUPS)),
    scoreParams: JSON.parse(JSON.stringify(SEED_SCORE)),
    manualParams:JSON.parse(JSON.stringify(SEED_MANUAL)),
    metaCols:    JSON.parse(JSON.stringify(SEED_META)),
    rows: storageKey === 'qa_grid_1' 
      ? [{ ...makeRow(SEED_SCORE, SEED_MANUAL, SEED_META), agentName: 'Agent 1', weekKey: '2026-W25' }]
      : [],
    activeAgents: storageKey === 'qa_grid_1' ? ['Agent 1'] : [],
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const GridPanel = forwardRef<GridPanelHandle, GridPanelProps>(function GridPanel(
  { storageKey, label, weekKey, weekNum, weekStart, onDirtyChange, externalAgents, onAgentDeleted, readOnly = false },
  ref,
) {
  // ── Determine Supabase key from storageKey ──────────────────────────────────
  const dbKey = (storageKey === 'qa_grid_1' ? 'grid_1' : 'grid_2') as 'grid_1' | 'grid_2';

  const { agents: globalAgents, deleteAgent: deleteGlobalAgent, updateAgent: updateGlobalAgent } = useData();
  const isSyncing = useRef(false);
  const isReverting = useRef(false);

  const weekIndex = useMemo(() => {
    if (!weekStart) return 1;
    const d = new Date(weekStart);
    const firstMonday = new Date(d.getFullYear(), d.getMonth(), 1);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }
    const diffDays = Math.round((d.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
    let idx = Math.floor(diffDays / 7) + 1;
    return idx <= 0 ? 1 : idx;
  }, [weekStart]);

  // ── Lazy state init — reads localStorage ONCE on mount, applies migrations ───
  const [groups, setGroups]     = useState<ScoreGroup[]>  (() => loadField(storageKey, 'groups',      SEED_GROUPS));
  const [scoreParams, setScore] = useState<ScoreParam[]>  (() => loadField(storageKey, 'scoreParams', SEED_SCORE));
  const [manualParams, setMnl]  = useState<ManualParam[]> (() => loadField(storageKey, 'manualParams',SEED_MANUAL));
  const [metaCols, setMeta]     = useState<MetaColumn[]>  (() => {
    // Migrate: ensure Shift column exists (old snapshots won't have it)
    return migrateMetaCols(loadField(storageKey, 'metaCols', SEED_META));
  });
  const [rows, setRows]         = useState<AgentRow[]>    (() => {
    const cols  = migrateMetaCols(loadField(storageKey, 'metaCols', SEED_META));
    const raws  = loadRows(storageKey);
    return migrateRows(raws, cols); // ensure each row has a value for every col
  });

  // Scroll state for sticky Agent column contraction
  const [isScrolled, setIsScrolled] = useState(false);
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollLeft > 10);
  };

  // ── Refs ────────────────────────────────────────────────────────────────────
  const firstRender  = useRef(true);   // skip persistence effect on first render
  const fromSupabase = useRef(false);  // true while Supabase is hydrating state
  const snapRef      = useRef<GridSnapshot>({ label, groups, scoreParams, manualParams, metaCols, rows });
  snapRef.current    = { label, groups, scoreParams, manualParams, metaCols, rows }; // always fresh

  // ── Persist on every USER-driven state change ────────────────────────────────
  // Skips: (a) first render — that's just the initial LS/seed load
  //        (b) Supabase hydration — would falsely mark grid as "dirty"
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (fromSupabase.current) { fromSupabase.current = false; return; } // hydration — not a user change
    if (isReverting.current) {
      return; // Skip auto-save/dirty trigger on discard revert
    }
    if (isSyncing.current) {
      isSyncing.current = false;
      const snap = snapRef.current;
      lsSave(storageKey, snap);
      supabaseSave(dbKey, snap).catch(() => {});
      return;
    }
    const snap = snapRef.current;
    lsSave(storageKey, snap);
    onDirtyChange(true);
    supabaseSave(dbKey, snap).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, scoreParams, manualParams, metaCols, rows]);

  // ── Flush to LS before browser unloads (F5 / Ctrl+R safety net) ────────────
  useEffect(() => {
    const flush = () => lsSave(storageKey, snapRef.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // ── Hydrate from Supabase on mount ───────────────────────────────────────────
  // Sets fromSupabase=true so the persistence effect knows this isn't a user change
  useEffect(() => {
    supabaseLoad(dbKey).then(remote => {
      if (!remote) return;
      const snap = remote as GridSnapshot;
      if (!snap.rows?.length || !snap.scoreParams?.length) return;
      // Apply migrations (Supabase data may also be old)
      const migratedMeta = migrateMetaCols(snap.metaCols ?? []);
      const migratedRows = migrateRows(snap.rows, migratedMeta);
      const migrated: GridSnapshot = { ...snap, metaCols: migratedMeta, rows: migratedRows };
      fromSupabase.current = true;
      setGroups(migrated.groups);
      setScore(migrated.scoreParams);
      setMnl(migrated.manualParams);
      setMeta(migrated.metaCols);
      setRows(migrated.rows);
      lsSave(storageKey, migrated);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Modals (all modal state — completely independent per grid instance) ──────
  const [addPG, setAddPG]               = useState<string|null|undefined>(undefined);
  const [showAddMeta, setShowAddMeta]   = useState(false);
  const [editSP, setEditSP]             = useState<ScoreParam|null>(null);
  const [editMP, setEditMP]             = useState<ManualParam|null>(null);
  const [editMC, setEditMC]             = useState<MetaColumn|null>(null);
  const [editGrp, setEditGrp]           = useState<ScoreGroup|null>(null);
  const [editAgt, setEditAgt]           = useState<string|null>(null);
  const [delSP, setDelSP]               = useState<ScoreParam|null>(null);
  const [delMP, setDelMP]               = useState<ManualParam|null>(null);
  const [delMC, setDelMC]               = useState<MetaColumn|null>(null);
  const [delGrp, setDelGrp]             = useState<ScoreGroup|null>(null);
  const [delAgt, setDelAgt]             = useState<string|null>(null);
  const [mnlModal, setMnlModal]         = useState<{rowId:string;paramId:string}|null>(null);
  const [unchk, setUnchk]               = useState<{rowId:string;paramId:string;agentName:string;paramName:string}|null>(null);

  // Expose imperative handle to parent
  useImperativeHandle(ref, () => ({
    getSnapshot:  () => ({ label, groups, scoreParams, manualParams, metaCols, rows, activeAgents: externalAgents }),
    getAgentNames:() => externalAgents || [],
    triggerAction:(action: 'agent' | 'parameter' | 'detail') => {
      if (action === 'parameter') setAddPG(null);
      if (action === 'detail')    setShowAddMeta(true);
    },
    resetToSnapshot:(snap: GridSnapshot | null) => {
      const target = snap || seedSnap(storageKey);
      const migratedMeta = migrateMetaCols(target.metaCols ?? []);
      const migratedRows = migrateRows(target.rows ?? [], migratedMeta);
      
      isReverting.current = true;
      
      setGroups(target.groups);
      setScore(target.scoreParams);
      setMnl(target.manualParams);
      setMeta(migratedMeta);
      setRows(migratedRows);
      
      const updatedSnap = { ...target, metaCols: migratedMeta, rows: migratedRows, activeAgents: target.activeAgents || externalAgents };
      lsSave(storageKey, updatedSnap);
      supabaseSave(dbKey, updatedSnap).catch(() => {});
      
      onDirtyChange(false);
      
      setTimeout(() => {
        isReverting.current = false;
      }, 50);
    },
  }), [label, groups, scoreParams, manualParams, metaCols, rows, storageKey, onDirtyChange, externalAgents, dbKey]);

  // Sync external agents and automatically generate rows for the selected calendar week
  useEffect(() => {
    if (!externalAgents || !weekKey) return;
    setRows(prev => {
      const allowedNames = new Set(externalAgents);

      // 1. Separate current week rows from other weeks' rows, filtering both to keep only allowed agents
      const otherWeekRows = prev.filter(r => r.weekKey !== weekKey && (!r.agentName || allowedNames.has(r.agentName)));
      const filteredCurrentWeekRows = prev.filter(r => r.weekKey === weekKey && (!r.agentName || allowedNames.has(r.agentName)));
      
      // 2. Find which external agents are missing a row for this week
      const existingNames = new Set(filteredCurrentWeekRows.map(r => r.agentName));
      const toAdd = externalAgents.filter(name => name.trim() && !existingNames.has(name));
      const newRows = toAdd.map(name => {
        const row = makeRow(scoreParams, manualParams, metaCols);
        row.agentName = name;
        row.weekKey = weekKey;
        
        // Find week col and set its value to e.g. W3 (weekIndex)
        const weekCol = metaCols.find(c => c.name.toLowerCase().includes('week'));
        if (weekCol) {
          row.metaValues[weekCol.id] = `W${weekIndex}`;
        }
        
        // Find audit date col and set its value to monday
        const auditCol = metaCols.find(c => c.name.toLowerCase().includes('audit'));
        if (auditCol && weekStart) {
          row.metaValues[auditCol.id] = weekStart.toISOString().split('T')[0];
        }
        
        return row;
      });
      
      const updated = [...otherWeekRows, ...filteredCurrentWeekRows, ...newRows];
      
      // Check if anything actually changed to prevent infinite state updates
      const prevSerialized = JSON.stringify(prev);
      const nextSerialized = JSON.stringify(updated);
      if (prevSerialized === nextSerialized) return prev;
      
      isSyncing.current = true;
      return updated;
    });
  }, [externalAgents, weekKey, weekNum, weekStart, scoreParams, manualParams, metaCols, weekIndex]);

  // Keep row Week values synchronized with the header selection automatically
  useEffect(() => {
    if (!weekKey || !metaCols) return;
    const weekStr = weekKey.split('-').pop(); // e.g. 'W3'
    if (!weekStr) return;

    setRows(prev => {
      const weekCol = metaCols.find(c => c.name.toLowerCase().includes('week'));
      if (!weekCol) return prev;

      let changed = false;
      const updated = prev.map(r => {
        if (r.weekKey === weekKey && r.metaValues[weekCol.id] !== weekStr) {
          changed = true;
          return {
            ...r,
            metaValues: {
              ...r.metaValues,
              [weekCol.id]: weekStr
            }
          };
        }
        return r;
      });

      if (!changed) return prev;
      isSyncing.current = true;
      return updated;
    });
  }, [weekKey, metaCols]);

  // ── Derived ──
  const visibleRows = useMemo(() => {
    return rows.filter(r => r.weekKey === weekKey);
  }, [rows, weekKey]);

  const globalMax  = scoreParams.reduce((s, p) => s + p.score, 0);
  const rowTotal   = (row: AgentRow) => scoreParams.reduce((s, p) => s + (row.checked[p.id] ? p.score : 0), 0);
  const gParams    = (gId: string) => scoreParams.filter(p => p.groupId === gId);
  const colTotal   = (pId: string) => visibleRows.reduce((s, r) => s + (r.checked[pId] ? (scoreParams.find(p => p.id === pId)?.score ?? 0) : 0), 0);

  // ── Mutations ──
  const addSP = useCallback((gId: string, name: string, score: number, newGrpName?: string) => {
    let rid = gId;
    if (newGrpName) {
      const ci = groups.length % PALETTE_COLORS.length;
      const ng: ScoreGroup = { id: uid(), name: newGrpName, colorIdx: ci };
      setGroups(p => [...p, ng]); rid = ng.id;
    }
    const np: ScoreParam = { id: uid(), name, score, groupId: rid };
    setScore(p => [...p, np]);
    setRows(p => p.map(r => ({ ...r, checked: { ...r.checked, [np.id]: false } })));
    toast.success(`"${name}" added`);
  }, [groups]);

  const addMP = useCallback((name: string) => {
    const np: ManualParam = { id: uid(), name };
    setMnl(p => [...p, np]);
    setRows(p => p.map(r => ({ ...r, manualValues: { ...r.manualValues, [np.id]: '' } })));
    toast.success(`"${name}" added to Additional Info`);
  }, []);

  const addMC = useCallback((name: string, type: MetaType) => {
    const nc: MetaColumn = { id: uid(), name, type };
    setMeta(p => [...p, nc]);
    setRows(p => p.map(r => ({ ...r, metaValues: { ...r.metaValues, [nc.id]: '' } })));
    toast.success(`"${name}" column added`);
  }, []);



  const delGroup = (gId: string) => {
    const ids = scoreParams.filter(p => p.groupId === gId).map(p => p.id);
    setGroups(p => p.filter(g => g.id !== gId));
    setScore(p => p.filter(x => x.groupId !== gId));
    setRows(p => p.map(r => { const c = { ...r.checked }; ids.forEach(id => delete c[id]); return { ...r, checked: c }; }));
  };

  const toggleCheck = (rowId: string, paramId: string) => {
    const row = rows.find(r => r.rowId === rowId)!;
    if (row.checked[paramId]) {
      const p = scoreParams.find(p => p.id === paramId)!;
      setUnchk({ rowId, paramId, agentName: row.agentName, paramName: p.name });
    } else {
      setRows(p => p.map(r => r.rowId !== rowId ? r : { ...r, checked: { ...r.checked, [paramId]: true } }));
    }
  };

  const confirmUnchk = () => {
    if (!unchk) return;
    setRows(p => p.map(r => r.rowId !== unchk.rowId ? r : { ...r, checked: { ...r.checked, [unchk.paramId]: false } }));
    toast.info(`"${unchk.paramName}" unchecked for ${unchk.agentName}`);
    setUnchk(null);
  };

  const setMV = (rowId: string, paramId: string, v: string) =>
    setRows(p => p.map(r => r.rowId !== rowId ? r : { ...r, manualValues: { ...r.manualValues, [paramId]: v } }));
  const setMetaV = (rowId: string, colId: string, v: string) =>
    setRows(p => p.map(r => r.rowId !== rowId ? r : { ...r, metaValues: { ...r.metaValues, [colId]: v } }));

  const mnlRow   = mnlModal ? rows.find(r => r.rowId === mnlModal.rowId) : null;
  const mnlParam = mnlModal ? manualParams.find(p => p.id === mnlModal.paramId) : null;

  const th = 'border border-slate-200 text-center align-middle';

  return (
    <>
      {/* Fixed Header Section */}
      <div className="mb-3">
        {!readOnly ? (
          <div className="flex gap-2 flex-wrap mb-3 px-1">
            <button onClick={() => setShowAddMeta(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm focus:ring-2 focus:ring-amber-200 outline-none" > <TableProperties className="size-3.5" /> Add Detail </button>
            <button onClick={() => setAddPG(null)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm focus:ring-2 focus:ring-emerald-200 outline-none" > <Plus className="size-3.5" /> Add Parameter </button>
          </div>
        ) : (
          <div className="mb-3 px-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-xs font-bold shadow-sm">
              <span className="size-2 rounded-full bg-slate-400 animate-pulse" />
              View Only Mode
            </span>
          </div>
        )}
    
        {visibleRows.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {visibleRows.map((row) => {
              const t = rowTotal(row);
              const p = scorePct(t, globalMax);
    
              return (
                <div key={row.rowId} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border" style={{ background: scoreBg(p), borderColor: scoreColor(p) + "33", color: scoreColor(p), }} >
                  <span className="text-slate-700 font-semibold"> {row.agentName || "—"} </span>
                  <span className="font-bold">{t}</span>
                  <span className="opacity-60"> /{globalMax} · {p}% </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
        <div className="overflow-x-auto" onScroll={handleScroll}>
          <table className="border-collapse w-full text-sm">
            <thead>
              <tr>
                <th 
                  rowSpan={2} 
                  className={`border border-slate-200 px-4 py-3 text-left text-white text-xs font-bold uppercase tracking-widest sticky left-0 z-20 transition-all duration-300 ${isScrolled ? 'min-w-[64px] max-w-[64px] text-center' : 'min-w-[190px] max-w-[190px]'}`} 
                  style={{ background: '#0F172A' }}
                >
                  {isScrolled ? 'A' : 'Agent'}
                </th>
    
                {/* Meta columns */}
                {metaCols.map(col => (
                  <th key={col.id} rowSpan={2} className="border border-slate-200 px-1 py-0 min-w-[95px] align-middle group/mh" style={{ background: '#92400E' }}>
                    <div className="flex flex-col items-center gap-1 py-2 px-1">
                      <div className="flex items-center gap-1">
                        {col.type==='date'&&<Calendar className="size-3 text-amber-200 shrink-0"/>}
                        {col.type==='number'&&<Hash className="size-3 text-amber-200 shrink-0"/>}
                        {col.type==='text'&&<FileText className="size-3 text-amber-200 shrink-0"/>}
                        <span className="text-amber-100 text-xs font-bold text-center leading-tight">{col.name}</span>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/mh:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button onClick={() => setEditMC(col)} className="size-5 flex items-center justify-center rounded hover:bg-white/20 text-amber-300 hover:text-white transition-colors focus:ring-1 focus:ring-amber-200 outline-none"><Edit2 className="size-3"/></button>
                          <button onClick={() => setDelMC(col)} className="size-5 flex items-center justify-center rounded hover:bg-red-500/50 text-amber-300 hover:text-white transition-colors focus:ring-1 focus:ring-red-400 outline-none"><Trash2 className="size-3"/></button>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
    
                {/* Score group headers */}
                {groups.map(g => {
                  const gps = gParams(g.id); const c = pal(g.colorIdx);
                  return (
                    <th key={g.id} colSpan={Math.max(gps.length,1)} className={`${th} px-2 py-0`} style={{ background: c.header }}>
                      <div className="flex items-center justify-center gap-1 py-2">
                        <span className="text-white text-xs font-bold uppercase tracking-wide">{g.name}</span>
                        {!readOnly && (
                          <>
                            <button onClick={() => setEditGrp(g)} className="size-5 flex items-center justify-center rounded hover:bg-white/20 text-white/60 hover:text-white transition-colors ml-1 focus:ring-1 focus:ring-white outline-none"><Edit2 className="size-3"/></button>
                            <button onClick={() => setAddPG(g.id)} className="size-5 flex items-center justify-center rounded hover:bg-white/20 text-white/60 hover:text-white transition-colors focus:ring-1 focus:ring-white outline-none"><Plus className="size-3"/></button>
                            <button onClick={() => setDelGrp(g)} className="size-5 flex items-center justify-center rounded hover:bg-red-500/60 text-white/40 hover:text-white transition-colors focus:ring-1 focus:ring-red-400 outline-none"><Trash2 className="size-3"/></button>
                          </>
                        )}
                      </div>
                    </th>
                  );
                })}
    
                <th rowSpan={2} className={`${th} text-white text-xs font-bold uppercase tracking-wide px-2 min-w-[70px]`} style={{ background: '#0F172A' }}>Total</th>
                {manualParams.length>0&&<th colSpan={manualParams.length} className={`${th} px-2 py-1.5 text-xs font-bold uppercase tracking-wide`} style={{ background: '#6D28D9', color: 'white' }}>Additional Info</th>}
              </tr>
              <tr>
                {/* Score sub-param headers */}
                {groups.flatMap(g => {
                  const gps = gParams(g.id); const c = pal(g.colorIdx);
                  if (gps.length===0) return [<th key={`${g.id}-e`} className={`${th} px-1 py-1 min-w-[85px]`} style={{background:c.light}}><span className="text-xs text-slate-400 italic">No columns</span></th>];
                  return gps.map(p => (
                    <th key={p.id} className={`${th} px-1 py-0 min-w-[85px]`} style={{background:c.light}}>
                      <div className="flex flex-col items-center gap-1.5 py-2 px-1">
                        <span className="text-xs font-semibold text-center leading-tight" style={{color:c.text}}>{p.name}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold px-1 py-0.5 rounded-md border font-mono" style={{background:'white',borderColor:c.text+'30',color:c.text}}>[{p.score}]</span>
                          {!readOnly && (
                            <>
                              <button onClick={() => setEditSP(p)} className="size-5 flex items-center justify-center rounded hover:bg-white text-slate-300 hover:text-slate-600 transition-colors focus:ring-1 focus:ring-slate-400 outline-none"><Edit2 className="size-3"/></button>
                              <button onClick={() => setDelSP(p)} className="size-5 flex items-center justify-center rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors focus:ring-1 focus:ring-red-400 outline-none"><Trash2 className="size-3"/></button>
                            </>
                          )}
                        </div>
                      </div>
                    </th>
                  ));
                })}
                {/* Manual param headers */}
                {manualParams.map(p => (
                  <th key={p.id} className={`${th} px-1.5 py-0 min-w-[110px]`} style={{background:'#EDE9FE'}}>
                    <div className="flex flex-col items-center gap-1.5 py-2 px-1">
                      <span className="text-xs font-semibold text-violet-800 text-center">{p.name}</span>
                      {!readOnly && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditMP(p)} className="size-5 flex items-center justify-center rounded hover:bg-violet-200 text-violet-300 hover:text-violet-700 transition-colors focus:ring-1 focus:ring-violet-400 outline-none"><Edit2 className="size-3"/></button>
                          <button onClick={() => setDelMP(p)} className="size-5 flex items-center justify-center rounded hover:bg-red-100 text-violet-300 hover:text-red-500 transition-colors focus:ring-1 focus:ring-red-400 outline-none"><Trash2 className="size-3"/></button>
                        </div>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(row => {
                const t = rowTotal(row); const p = scorePct(t, globalMax);
                return (
                  <tr key={row.rowId} className="hover:bg-slate-50/50 transition-colors group/row">
                    {/* Agent cell */}
                    <td 
                      className={`border border-slate-200 bg-white sticky left-0 z-10 px-3 py-2.5 transition-all duration-300 ${isScrolled ? 'min-w-[64px] max-w-[64px] text-center' : 'min-w-[190px] max-w-[190px]'}`}
                      title={row.agentName}
                    >
                      <div className="flex items-center gap-2.5 justify-center">
                        <div 
                          className="size-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 cursor-help" 
                          style={{background:'linear-gradient(135deg,#3B82F6,#6366F1)'}}
                          title={row.agentName}
                        >
                          {(row.agentName||'?').charAt(0).toUpperCase()}
                        </div>
                        <div className={`min-w-0 flex-1 transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none hidden' : 'opacity-100 text-left'}`}>
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-slate-800 text-sm truncate">{row.agentName||<em className="text-slate-400 font-normal">Unnamed</em>}</span>
                            {!readOnly && (
                              <>
                                <button onClick={() => setEditAgt(row.rowId)} className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 outline-none focus:ring-1 focus:ring-blue-400 size-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all shrink-0"><Edit2 className="size-3"/></button>
                                <button onClick={() => setDelAgt(row.rowId)} className="opacity-0 group-hover/row:opacity-100 focus:opacity-100 outline-none focus:ring-1 focus:ring-red-400 size-5 flex items-center justify-center rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all shrink-0"><Trash2 className="size-3"/></button>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-black tabular-nums" style={{color:scoreColor(p)}}>{t}</span>
                            <span className="text-xs text-slate-400">/{globalMax}</span>
                            <span className="text-xs font-bold px-1.5 py-px rounded-full" style={{background:scoreBg(p),color:scoreColor(p)}}>{p}%</span>
                          </div>
                        </div>
                      </div>
                    </td>
    
                    {/* Meta cells */}
                    {metaCols.map(col => {
                      const val = row.metaValues?.[col.id]??'';
                      const base = 'w-full bg-transparent text-xs text-slate-800 outline-none placeholder-amber-300 text-center tabular-nums';
                      return (
                        <td key={`${row.rowId}-${col.id}`} className="border border-slate-200 align-middle px-1 py-1.5 min-w-[95px]" style={{background:'#FFFBEB'}}>
                          {/* Shift column — Morning/Afternoon/Night dropdown */}
                          {col.name.toLowerCase().includes('shift')
                            ? (
                              <select value={val} onChange={e=>setMetaV(row.rowId,col.id,e.target.value)}
                                disabled={readOnly}
                                className="w-full bg-transparent text-xs text-slate-800 outline-none text-center cursor-pointer disabled:cursor-not-allowed">
                                <option value="">—</option>
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                                <option value="Night">Night</option>
                              </select>
                            )
                            /* Week column — static uneditable text (controlled by header week) */
                            : col.name.toLowerCase().includes('week')
                            ? (
                              <div className="w-full text-center text-xs text-slate-500 font-bold select-none py-1">
                                {`W${weekIndex}`}
                              </div>
                            )
                            : col.type==='date'
                              ? <input type="date" value={val} onChange={e=>setMetaV(row.rowId,col.id,e.target.value)} disabled={readOnly} className={`${base} cursor-pointer disabled:cursor-not-allowed`} style={{colorScheme:'light'}}/>
                              : col.type==='number'
                                ? <input type="number" value={val} onChange={e=>setMetaV(row.rowId,col.id,e.target.value)} disabled={readOnly} placeholder="—" className={`${base} disabled:cursor-not-allowed`}/>
                                : <input type="text" value={val} onChange={e=>setMetaV(row.rowId,col.id,e.target.value)} disabled={readOnly} placeholder="—" className={`${base} disabled:cursor-not-allowed`}/>
                          }
                        </td>
                      );
                    })}
    
                    {/* Score checkboxes */}
                    {groups.flatMap(g => {
                      const gps = gParams(g.id); const c = pal(g.colorIdx);
                      if (gps.length===0) return [<td key={`${row.rowId}-${g.id}-e`} className="border border-slate-200" style={{background:c.light}}/>];
                      return gps.map(param => {
                        const checked = row.checked[param.id];
                        return (
                          <td key={`${row.rowId}-${param.id}`} className="border border-slate-200 text-center align-middle p-1 transition-colors" style={{background:checked?c.light:'white'}}>
                            <button 
                              onClick={() => !readOnly && toggleCheck(row.rowId, param.id)} 
                              disabled={readOnly}
                              title={readOnly ? 'View Only' : checked?`Uncheck (−${param.score})`:`Check (+${param.score})`} 
                              className="flex flex-col items-center gap-0.5 w-full group transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-md p-0.5 disabled:cursor-not-allowed"
                            >
                              {checked?<CheckSquare className="size-5" style={{color:c.header}}/>:<Square className="size-5 text-slate-300 group-hover:text-slate-400"/>}
                              <span className="text-xs font-bold tabular-nums font-mono" style={{color:checked?c.header:'#CBD5E1'}}>{checked?`+${param.score}`:`[${param.score}]`}</span>
                            </button>
                          </td>
                        );
                      });
                    })}
    
                    {/* Row total */}
                    <td className="border border-slate-200 text-center align-middle px-2 py-1.5" style={{background:'#0F172A'}}>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-xl font-black tabular-nums" style={{color:scoreColor(p)}}>{t}</span>
                        <span className="text-xs text-slate-500">/{globalMax}</span>
                        <span className="text-xs font-bold px-1.5 py-px rounded-full mt-0.5" style={{background:scoreColor(p)+'22',color:scoreColor(p)}}>{p}%</span>
                      </div>
                    </td>
    
                    {/* Manual cells */}
                    {manualParams.map(mp => {
                      const val = row.manualValues[mp.id]??'';
                      return (
                        <td key={`${row.rowId}-${mp.id}`} className="border border-slate-200 align-top px-1.5 py-1.5 max-w-[200px]" style={{background:'#FAF9FF'}}>
                          {val ? (
                            <div className="flex items-start gap-2">
                              <p className="text-xs text-slate-700 flex-1 leading-relaxed break-words" style={{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',wordBreak:'break-word',minWidth:0,maxWidth:'130px'}} title={val}>{val}</p>
                              <div className="flex items-center gap-1 shrink-0 mt-0.5 focus-within:opacity-100">
                                {!readOnly && <button onClick={() => setMnlModal({rowId:row.rowId,paramId:mp.id})} className="size-6 flex items-center justify-center rounded-lg hover:bg-violet-100 text-slate-300 hover:text-violet-600 focus:ring-1 focus:ring-violet-400 outline-none"><Edit2 className="size-3.5"/></button>}
                                <button onClick={() => { navigator.clipboard.writeText(val); toast.success('Copied!'); }} className="size-6 flex items-center justify-center rounded-lg hover:bg-blue-100 text-slate-300 hover:text-blue-600 focus:ring-1 focus:ring-blue-400 outline-none"><Copy className="size-3.5"/></button>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => !readOnly && setMnlModal({rowId:row.rowId,paramId:mp.id})} 
                              disabled={readOnly}
                              className="w-full text-left text-xs text-slate-300 hover:text-violet-500 italic transition-colors py-0.5 focus:ring-1 focus:ring-violet-400 outline-none disabled:cursor-not-allowed"
                            >
                              {readOnly ? '—' : 'Click to add…'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
    
              {/* Footer totals */}
              <tr className="border-t-2 border-slate-300" style={{background:'#F1F5F9'}}>
                <td className="border border-slate-200 px-2 py-1.5 text-xs font-bold text-slate-500 uppercase tracking-widest sticky left-0 z-10 font-mono transition-all duration-300" style={{background:'#F1F5F9', minWidth: isScrolled ? '64px' : '190px', maxWidth: isScrolled ? '64px' : '190px'}}>{isScrolled ? 'Tot' : 'Column Totals'}</td>
                {metaCols.map(col => <td key={col.id} className="border border-slate-200" style={{background:'#FEF3C7'}}/>)}
                {groups.flatMap(g => {
                  const gps = gParams(g.id);
                  if (gps.length===0) return [<td key={`${g.id}-ef`} className="border border-slate-200"/>];
                  return gps.map(p => {
                    const ct=colTotal(p.id); const ctM=visibleRows.length*p.score; const cp=scorePct(ct,ctM);
                    return (<td key={p.id} className="border border-slate-200 text-center py-1.5"><div className="flex flex-col items-center"><span className="font-bold text-sm" style={{color:scoreColor(cp)}}>{ct}</span><span className="text-xs text-slate-400">/{ctM}</span></div></td>);
                  });
                })}
                <td className="border border-slate-200 text-center py-1.5" style={{background:'#1E293B'}}><div className="flex flex-col items-center"><span className="font-black text-lg text-white">{visibleRows.reduce((s,r)=>s+rowTotal(r),0)}</span><span className="text-xs text-slate-500">/{visibleRows.length*globalMax}</span></div></td>
                {manualParams.map(p => <td key={p.id} className="border border-slate-200" style={{background:'#FAF9FF'}}/>)}
              </tr>
            </tbody>
          </table>
    
          {/* Modals */}
          {showAddMeta&&<AddMetaColDialog onAdd={addMC} onClose={()=>setShowAddMeta(false)}/>}
          {addPG!==undefined&&<AddParamDialog groups={groups} fixedGroupId={addPG??undefined} onAddScore={addSP} onAddManual={addMP} onClose={()=>setAddPG(undefined)}/>}
          {editSP&&<EditSubheaderModal name={editSP.name} score={editSP.score} isScore onSave={(n,s)=>setScore(p=>p.map(x=>x.id===editSP.id?{...x,name:n,score:s}:x))} onClose={()=>setEditSP(null)}/>}
          {editMP&&<EditSubheaderModal name={editMP.name} score={0} isScore={false} onSave={n=>setMnl(p=>p.map(x=>x.id===editMP.id?{...x,name:n}:x))} onClose={()=>setEditMP(null)}/>}
          {editMC&&<EditSubheaderModal name={editMC.name} score={0} isScore={false} onSave={n=>setMeta(p=>p.map(x=>x.id===editMC.id?{...x,name:n}:x))} onClose={()=>setEditMC(null)}/>}

          {editGrp&&<EditGroupModal name={editGrp.name} onSave={n=>setGroups(p=>p.map(g=>g.id===editGrp.id?{...g,name:n}:g))} onClose={()=>setEditGrp(null)}/>}
          {editAgt&&<EditAgentModal name={rows.find(r=>r.rowId===editAgt)?.agentName??''} onSave={n=>{
            const oldName = rows.find(r=>r.rowId===editAgt)?.agentName;
            if (oldName && oldName.trim() !== n.trim()) {
              const globalAgent = globalAgents.find(a => a.name.trim().toLowerCase() === oldName.trim().toLowerCase());
              if (globalAgent) {
                updateGlobalAgent({ ...globalAgent, name: n.trim() });
              }
            }
            setRows(p=>p.map(r=>r.rowId===editAgt?{...r,agentName:n}:r));
          }} onClose={()=>setEditAgt(null)}/>}
          {delSP&&<ConfirmDelete label={delSP.name} onConfirm={()=>{setScore(p=>p.filter(x=>x.id!==delSP.id));setRows(p=>p.map(r=>{const c={...r.checked};delete c[delSP.id];return{...r,checked:c};}));toast.success('Column deleted');setDelSP(null);}} onCancel={()=>setDelSP(null)}/>}
          {delMP&&<ConfirmDelete label={delMP.name} onConfirm={()=>{setMnl(p=>p.filter(x=>x.id!==delMP.id));setRows(p=>p.map(r=>{const m={...r.manualValues};delete m[delMP.id];return{...r,manualValues:m};}));toast.success('Tab deleted');setDelMP(null);}} onCancel={()=>setDelMP(null)}/>}
          {delMC&&<ConfirmDelete label={delMC.name} onConfirm={()=>{setMeta(p=>p.filter(x=>x.id!==delMC.id));setRows(p=>p.map(r=>{const m={...r.metaValues};delete m[delMC.id];return{...r,metaValues:m};}));toast.success('Column deleted');setDelMC(null);}} onCancel={()=>setDelMC(null)}/>}
          {delGrp&&<ConfirmDelete label={`${delGrp.name} (and all columns)`} onConfirm={()=>{delGroup(delGrp.id);toast.success('Group deleted');setDelGrp(null);}} onCancel={()=>setDelGrp(null)}/>}
          {delAgt&&<ConfirmDelete label={rows.find(r=>r.rowId===delAgt)?.agentName??'Agent'} onConfirm={()=>{
            const row = rows.find(r=>r.rowId===delAgt);
            if (row?.agentName) {
              onAgentDeleted?.(row.agentName);
              setRows(p=>p.filter(r=>r.agentName!==row.agentName));
            }
            toast.success('Agent removed');
            setDelAgt(null);
          }} onCancel={()=>setDelAgt(null)}/>}
          {mnlModal&&mnlRow&&mnlParam&&<ManualCellModal agentName={mnlRow.agentName} paramName={mnlParam.name} value={mnlRow.manualValues[mnlModal.paramId]??''} onSave={v=>setMV(mnlModal.rowId,mnlModal.paramId,v)} onDelete={()=>setMV(mnlModal.rowId,mnlModal.paramId,'')} onClose={()=>setMnlModal(null)}/>}
          {unchk&&<ConfirmUncheck agentName={unchk.agentName} paramName={unchk.paramName} onConfirm={confirmUnchk} onCancel={()=>setUnchk(null)}/>}
        </div>
    </>
  );
});
