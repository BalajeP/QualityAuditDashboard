import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabaseSave } from '../../lib/supabase';
import { useData } from './DataContext';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ScoreGroup  { id: string; name: string; colorIdx: number; }
export interface ScoreParam  { id: string; name: string; score: number; groupId: string; }
export interface ManualParam { id: string; name: string; }
export type MetaType = 'text' | 'number' | 'date';
export interface MetaColumn  { id: string; name: string; type: MetaType; }
export interface AgentRow {
  rowId: string;
  agentName: string;
  weekKey?:     string;
  checked:      Record<string, boolean>;
  manualValues: Record<string, string>;
  metaValues:   Record<string, string>;
}
export interface GridSnapshot {
  label?:      string;
  groups:      ScoreGroup[];
  scoreParams: ScoreParam[];
  manualParams:ManualParam[];
  metaCols:    MetaColumn[];
  rows:        AgentRow[];
  activeAgents?: string[];
}

// ─── Audit record (used by Dashboard) ────────────────────────────────────────

export interface AuditRecord {
  agent:     string;
  gridId:    1 | 2;
  score:     number;
  callCount: number;
  week:      number | null;
  month:     string;
  isFatal:   boolean;
  shift:     string;       // Morning | Afternoon | Night | ''
  day:       number | null; // day of month from audit date
}

function monthFromDate(iso: string): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('en-US', { month: 'long' }); } catch { return ''; }
}

export function snapshotToRecords(snap: GridSnapshot, gridId: 1 | 2): AuditRecord[] {
  const globalMax = snap.scoreParams.reduce((s, p) => s + p.score, 0);
  return snap.rows
    .filter(r => r.agentName.trim())
    .map(r => {
      const total    = snap.scoreParams.reduce((s, p) => s + (r.checked[p.id] ? p.score : 0), 0);
      const pct      = globalMax === 0 ? 0 : Math.round((total / globalMax) * 100);
      const dateCol  = snap.metaCols.find(c => c.name.toLowerCase().includes('audit'));
      const callCol  = snap.metaCols.find(c => c.name.toLowerCase().includes('call count'));
      const shiftCol = snap.metaCols.find(c => c.name.toLowerCase().includes('shift'));
      const dateVal  = dateCol  ? (r.metaValues[dateCol.id]  ?? '') : '';
      const shiftVal = shiftCol ? (r.metaValues[shiftCol.id] ?? '') : '';
      
      // Resolve week from row weekKey (e.g. 2026-July-W3 or 2026-W25)
      let weekNum: number | null = null;
      if (r.weekKey) {
        const wMatch = r.weekKey.match(/-W(\d+)/);
        if (wMatch) {
          weekNum = parseInt(wMatch[1], 10);
        }
      }

      const callVal  = callCol ? parseInt(r.metaValues[callCol.id] ?? '', 10) : 1;
      const dayVal   = dateVal ? new Date(dateVal).getDate() : null;
      const recordMonth = r.weekKey ? r.weekKey.split('-')[1] : monthFromDate(dateVal);
      return {
        agent:     r.agentName,
        gridId,
        score:     pct,
        callCount: isNaN(callVal) || callVal < 1 ? 1 : callVal,
        week:      weekNum,
        month:     recordMonth,
        isFatal:   pct < 72,
        shift:     shiftVal,
        day:       isNaN(dayVal as number) ? null : dayVal,
      };
    });
}

// ─── localStorage keys for SAVED (committed) snapshots ───────────────────────

const LS_SAVED_1 = 'qa_saved_grid1_v1';
const LS_SAVED_2 = 'qa_saved_grid2_v1';

function readSaved(key: string): GridSnapshot | null {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch { return null; }
}
function writeSaved(key: string, snap: GridSnapshot) {
  try { localStorage.setItem(key, JSON.stringify(snap)); } catch { /* quota */ }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface GridContextType {
  grid1: GridSnapshot | null;
  grid2: GridSnapshot | null;
  saveGrid1: (snap: GridSnapshot) => void;
  saveGrid2: (snap: GridSnapshot) => void;
  auditRecords: AuditRecord[];
  agentNames:   string[];
}

const GridContext = createContext<GridContextType>({
  grid1: null, grid2: null,
  saveGrid1: () => {}, saveGrid2: () => {},
  auditRecords: [], agentNames: [],
});

export function GridProvider({ children }: { children: ReactNode }) {
  const { agents } = useData();

  // Restore from localStorage on startup so Dashboard survives refresh (fallback to active copy)
  const [grid1, setGrid1] = useState<GridSnapshot | null>(() => readSaved(LS_SAVED_1) || readSaved('qa_grid_1'));
  const [grid2, setGrid2] = useState<GridSnapshot | null>(() => readSaved(LS_SAVED_2) || readSaved('qa_grid_2'));

  // Sync state if an agent is deleted from DataContext
  useEffect(() => {
    if (!agents) return;
    const allowedNames = new Set(agents.map(a => a.name));

    setGrid1(prev => {
      if (!prev) return prev;
      const filtered = prev.rows.filter(r => !r.agentName || allowedNames.has(r.agentName));
      if (filtered.length === prev.rows.length) return prev;
      const updated = { ...prev, rows: filtered };
      writeSaved(LS_SAVED_1, updated);
      return updated;
    });

    setGrid2(prev => {
      if (!prev) return prev;
      const filtered = prev.rows.filter(r => !r.agentName || allowedNames.has(r.agentName));
      if (filtered.length === prev.rows.length) return prev;
      const updated = { ...prev, rows: filtered };
      writeSaved(LS_SAVED_2, updated);
      return updated;
    });
  }, [agents]);

  const saveGrid1 = (snap: GridSnapshot) => {
    setGrid1(snap);
    writeSaved(LS_SAVED_1, snap);
    supabaseSave('grid_1', snap);   // fire-and-forget to Supabase too
  };
  const saveGrid2 = (snap: GridSnapshot) => {
    setGrid2(snap);
    writeSaved(LS_SAVED_2, snap);
    supabaseSave('grid_2', snap);
  };

  const auditRecords: AuditRecord[] = [
    ...(grid1 ? snapshotToRecords(grid1, 1) : []),
    ...(grid2 ? snapshotToRecords(grid2, 2) : []),
  ];
  const agentNames = Array.from(new Set([
    ...(grid1?.rows.map(r => r.agentName).filter(Boolean) ?? []),
    ...(grid2?.rows.map(r => r.agentName).filter(Boolean) ?? []),
  ]));

  return (
    <GridContext.Provider value={{ grid1, grid2, saveGrid1, saveGrid2, auditRecords, agentNames }}>
      {children}
    </GridContext.Provider>
  );
}

export function useGrid() { return useContext(GridContext); }
