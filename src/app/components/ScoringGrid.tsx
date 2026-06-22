/**
 * ScoringGrid page — two collapsible scoring grid panels.
 * Each panel tracks dirty state independently.
 * Navigation away from the page while unsaved changes exist
 * triggers a blocking prompt.
 */
import {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useBlocker } from "react-router";
import {
  Save,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  UserPlus,
  Plus,
  AlertTriangle,
  Check,
  X,
  TableProperties,
  Hash,
  Edit2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { GridPanel } from "./GridPanel";
import type { GridPanelHandle } from "./GridPanel";
import { useGrid } from "../context/GridContext";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { SEED_SCORE } from "./GridPanel";
import { exportGridsToExcel } from "../lib/excelExport";

// ── Unsaved-changes blocker modal ─────────────────────────────────────────────

function UnsavedModal({
  dirtyGrids,
  onSaveAndContinue,
  onDiscard,
  onCancel,
}: {
  dirtyGrids: string[];
  onSaveAndContinue: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="size-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="size-5 text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-slate-900">
              Unsaved Changes
            </p>
            <p className="text-sm text-slate-500 mt-1">
              You have unsaved changes in{" "}
              <span className="font-semibold text-slate-700">
                {dirtyGrids.join(" and ")}
              </span>
              . What would you like to do?
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSaveAndContinue}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            <Save className="size-4" /> Save &amp; Continue
          </button>
          <button
            onClick={onDiscard}
            className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Discard &amp; Continue
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 rounded-xl text-slate-400 text-sm font-medium hover:text-slate-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Agent shared dialog ────────────────────────────────────────────────────

function AddAgentSharedDialog({
  onAdd,
  onClose,
}: {
  onAdd: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const submit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      onClose();
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <p className="font-bold text-slate-900 mb-1 flex items-center gap-2">
          <UserPlus className="size-5 text-blue-600" />
          Add Agent to Both Grids
        </p>
        <p className="text-xs text-slate-400 mb-4">
          This agent will be added to Scoring Grid 1 and Scoring
          Grid 2.
        </p>
        <input
          autoFocus
          type="text"
          placeholder="Agent full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40"
          >
            Add Agent
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Top-level action trigger types (forwarded to whichever panel is open) ─────

type TopAction = "agent" | "parameter" | "detail" | null;

// ── ScoringGrid page ──────────────────────────────────────────────────────────

export function ScoringGrid() {
  const {
    saveGrid1,
    saveGrid2,
    grid1: savedGrid1,
    grid2: savedGrid2,
  } = useGrid();
  const { agents, addAgent, deleteAgent } = useData(); // for bidirectional agent sync
  const { isAdmin } = useAuth();

  const panel1Ref = useRef<GridPanelHandle>(null);
  const panel2Ref = useRef<GridPanelHandle>(null);

  const [dirty1, setDirty1] = useState(false);
  const [dirty2, setDirty2] = useState(false);
  const [open1, setOpen1] = useState(true);
  const [open2, setOpen2] = useState(true);
  const [saved1, setSaved1] = useState(false);
  const [saved2, setSaved2] = useState(false);

  const [showAddShared, setShowAddShared] = useState(false);
  const [topAction, setTopAction] = useState<TopAction>(null);
  const [consolidatedView, setConsolidatedView] = useState<
    "horizontal" | "vertical"
  >("horizontal");

  // Active agents lists for Grid 1 & Grid 2
  const [g1Agents, setG1Agents] = useState<string[]>(() => {
    if (savedGrid1?.activeAgents) return savedGrid1.activeAgents;
    if (savedGrid1?.rows) return Array.from(new Set(savedGrid1.rows.map(r => r.agentName).filter(Boolean)));
    return ["Agent 1"];
  });
  const [g2Agents, setG2Agents] = useState<string[]>(() => {
    if (savedGrid2?.activeAgents) return savedGrid2.activeAgents;
    if (savedGrid2?.rows) return Array.from(new Set(savedGrid2.rows.map(r => r.agentName).filter(Boolean)));
    return [];
  });

  useEffect(() => {
    if (savedGrid1) {
      if (savedGrid1.activeAgents) {
        setG1Agents(savedGrid1.activeAgents);
      } else if (savedGrid1.rows) {
        setG1Agents(Array.from(new Set(savedGrid1.rows.map(r => r.agentName).filter(Boolean))));
      }
    }
  }, [savedGrid1]);

  useEffect(() => {
    if (savedGrid2) {
      if (savedGrid2.activeAgents) {
        setG2Agents(savedGrid2.activeAgents);
      } else if (savedGrid2.rows) {
        setG2Agents(Array.from(new Set(savedGrid2.rows.map(r => r.agentName).filter(Boolean))));
      }
    }
  }, [savedGrid2]);

  // Keep grid agent lists in sync with any new global agents or global deletions
  useEffect(() => {
    const globalNames = new Set(agents.map(a => a.name));
    const filteredG1 = g1Agents.filter(name => globalNames.has(name));
    const filteredG2 = g2Agents.filter(name => globalNames.has(name));
    
    const unionActive = new Set([...filteredG1, ...filteredG2]);
    const newGlobals = agents.map(a => a.name).filter(name => !unionActive.has(name));
    
    const needsG1Update = filteredG1.length !== g1Agents.length || newGlobals.length > 0;
    const needsG2Update = filteredG2.length !== g2Agents.length || newGlobals.length > 0;
    
    if (needsG1Update) {
      setG1Agents([...new Set([...filteredG1, ...newGlobals])]);
    }
    if (needsG2Update) {
      setG2Agents([...new Set([...filteredG2, ...newGlobals])]);
    }
  }, [agents, g1Agents, g2Agents]);

  // Editable Grid Labels
  const [label1, setLabel1] = useState(() => savedGrid1?.label || "Scoring Grid 1");
  const [label2, setLabel2] = useState(() => savedGrid2?.label || "Scoring Grid 2");
  const [editingLabel1, setEditingLabel1] = useState(false);
  const [label1Draft, setLabel1Draft] = useState('');
  const [editingLabel2, setEditingLabel2] = useState(false);
  const [label2Draft, setLabel2Draft] = useState('');

  useEffect(() => {
    if (savedGrid1?.label) setLabel1(savedGrid1.label);
  }, [savedGrid1]);

  useEffect(() => {
    if (savedGrid2?.label) setLabel2(savedGrid2.label);
  }, [savedGrid2]);

  // Selected Score Card Year, Month, and Week Index (W1-W4)
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toLocaleString('en-US', { month: 'long' }));
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const firstMonday = new Date(monday.getFullYear(), monday.getMonth(), 1);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }
    const diffDays = Math.round((monday.getTime() - firstMonday.getTime()) / (1000 * 60 * 60 * 24));
    let weekIndex = Math.floor(diffDays / 7) + 1;
    return weekIndex <= 0 ? 1 : weekIndex > 4 ? 4 : weekIndex;
  });

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const YEARS = [2024, 2025, 2026, 2027, 2028];

  // Derived week details
  const { weekStart, weekEnd, weekNum, weekKey, weekLabel } = useMemo(() => {
    let monthIdx = MONTHS.indexOf(selectedMonth);
    if (monthIdx === -1) monthIdx = new Date().getMonth();

    // 1st of the selected month
    const firstOfMonth = new Date(selectedYear, monthIdx, 1);
    
    // Find Monday of the first week of that month
    const day = firstOfMonth.getDay();
    const diff = firstOfMonth.getDate() - day + (day === 0 ? -6 : 1);
    const firstMonday = new Date(firstOfMonth.setDate(diff));
    firstMonday.setHours(0, 0, 0, 0);

    // Target Monday for target week index
    const monday = new Date(firstMonday);
    monday.setDate(firstMonday.getDate() + (selectedWeekIdx - 1) * 7);

    // Target Sunday
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // ISO week calculation
    const tempDate = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
    const tempDayNum = tempDate.getUTCDay() || 7;
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - tempDayNum);
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

    return {
      weekStart: monday,
      weekEnd: sunday,
      weekNum: isoWeek,
      weekKey: `${selectedYear}-${selectedMonth}-W${selectedWeekIdx}`,
      weekLabel: `Week ${selectedWeekIdx} of ${selectedMonth} ${selectedYear}`,
    };
  }, [selectedYear, selectedMonth, selectedWeekIdx]);

  const goPrevScoreCard = () => {
    if (selectedWeekIdx > 1) {
      setSelectedWeekIdx(selectedWeekIdx - 1);
    } else {
      let monthIdx = MONTHS.indexOf(selectedMonth);
      if (monthIdx === 0) {
        setSelectedYear(prev => prev - 1);
        setSelectedMonth('December');
      } else {
        setSelectedMonth(MONTHS[monthIdx - 1]);
      }
      setSelectedWeekIdx(4);
    }
  };

  const goNextScoreCard = () => {
    if (selectedWeekIdx < 4) {
      setSelectedWeekIdx(selectedWeekIdx + 1);
    } else {
      let monthIdx = MONTHS.indexOf(selectedMonth);
      if (monthIdx === 11) {
        setSelectedYear(prev => prev + 1);
        setSelectedMonth('January');
      } else {
        setSelectedMonth(MONTHS[monthIdx + 1]);
      }
      setSelectedWeekIdx(1);
    }
  };

  // When a grid adds an agent internally → also add to DataContext (Agents page)
  const handleAgentAdded = useCallback(
    (name: string) => {
      if (name.trim() && !agents.some((a) => a.name === name)) {
        addAgent({
          id: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name,
          email: "",
          team: "Morning",
          status: "active",
        });
      }
    },
    [agents, addAgent],
  );

  // Handle agent deletions from Grid 1 and Grid 2 specifically
  const handleAgentDeletedFromGrid1 = useCallback((name: string) => {
    setG1Agents(prev => {
      const updated = prev.filter(n => n !== name);
      const stillInG2 = g2Agents.includes(name);
      if (!stillInG2) {
        const ga = agents.find(a => a.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (ga) {
          deleteAgent(ga.id);
          toast.info(`"${name}" removed from both grids and deleted globally`);
        }
      } else {
        toast.info(`"${name}" removed from Grid 1 (still active in Grid 2)`);
      }
      return updated;
    });
    setDirty1(true);
  }, [g2Agents, agents, deleteAgent]);

  const handleAgentDeletedFromGrid2 = useCallback((name: string) => {
    setG2Agents(prev => {
      const updated = prev.filter(n => n !== name);
      const stillInG1 = g1Agents.includes(name);
      if (!stillInG1) {
        const ga = agents.find(a => a.name.trim().toLowerCase() === name.trim().toLowerCase());
        if (ga) {
          deleteAgent(ga.id);
          toast.info(`"${name}" removed from both grids and deleted globally`);
        }
      } else {
        toast.info(`"${name}" removed from Grid 2 (still active in Grid 1)`);
      }
      return updated;
    });
    setDirty2(true);
  }, [g1Agents, agents, deleteAgent]);

  // On mount: sync agents already stored in the grids (from localStorage) → DataContext
  // This handles agents added before this sync code existed
  const agentSyncDone = useRef(false);
  useEffect(() => {
    if (agentSyncDone.current) return;
    agentSyncDone.current = true;
    const keys = ["qa_grid_1", "qa_grid_2"];
    keys.forEach((key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const snap = JSON.parse(raw) as {
          rows?: { agentName?: string }[];
        };
        snap.rows?.forEach((r) => {
          const name = r.agentName?.trim();
          if (name) handleAgentAdded(name);
        });
      } catch {
        /* ignore */
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation blocker
  const dirtyGrids: string[] = [
    ...(dirty1 ? [label1] : []),
    ...(dirty2 ? [label2] : []),
  ];
  const blocker = useBlocker(() => dirty1 || dirty2);

  // Save helpers
  const doSave1 = useCallback(() => {
    if (!panel1Ref.current) return;
    const snap = panel1Ref.current.getSnapshot();
    snap.label = label1;
    saveGrid1(snap);
    setDirty1(false);
    setSaved1(true);
    setTimeout(() => setSaved1(false), 2000);
    toast.success(`"${label1}" saved`);
  }, [saveGrid1, label1]);

  const doSave2 = useCallback(() => {
    if (!panel2Ref.current) return;
    const snap = panel2Ref.current.getSnapshot();
    snap.label = label2;
    saveGrid2(snap);
    setDirty2(false);
    setSaved2(true);
    setTimeout(() => setSaved2(false), 2000);
    toast.success(`"${label2}" saved`);
  }, [saveGrid2, label2]);

  // Blocker resolution
  const handleSaveAndContinue = useCallback(() => {
    if (dirty1) doSave1();
    if (dirty2) doSave2();
    blocker.proceed?.();
  }, [dirty1, dirty2, doSave1, doSave2, blocker]);

  const handleDiscard = useCallback(() => {
    // Revert each grid to its last saved (committed) snapshot
    if (panel1Ref.current) {
      panel1Ref.current.resetToSnapshot(savedGrid1 || null);
    }
    if (panel2Ref.current) {
      panel2Ref.current.resetToSnapshot(savedGrid2 || null);
    }

    // Revert active grid agent states
    if (savedGrid1) {
      setG1Agents(savedGrid1.activeAgents || Array.from(new Set(savedGrid1.rows.map(r => r.agentName).filter(Boolean))));
    } else {
      setG1Agents(["Agent 1"]);
    }
    if (savedGrid2) {
      setG2Agents(savedGrid2.activeAgents || Array.from(new Set(savedGrid2.rows.map(r => r.agentName).filter(Boolean))));
    } else {
      setG2Agents([]);
    }

    setDirty1(false);
    setDirty2(false);
    blocker.proceed?.();
  }, [savedGrid1, savedGrid2, blocker]);

  const handleCancel = useCallback(() => {
    blocker.reset?.();
  }, [blocker]);

  // Shared agent push
  const addSharedAgent = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed && !agents.some((a) => a.name.toLowerCase() === trimmed.toLowerCase())) {
      addAgent({
        id: `agent-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: trimmed,
        email: "",
        team: "Morning",
        status: "active",
      });
      toast.success(`${trimmed} added successfully.`);
    }
  }, [agents, addAgent]);

  const handleExportExcel = useCallback(() => {
    const g1 = panel1Ref.current?.getSnapshot();
    const g2 = panel2Ref.current?.getSnapshot();

    if (!g1 || !g2) {
      toast.error("Unable to export. Grids are not fully loaded.");
      return;
    }

    try {
      const cleanLabel1 = label1.replace(/[^a-zA-Z0-9 ]/g, "").trim();
      const cleanLabel2 = label2.replace(/[^a-zA-Z0-9 ]/g, "").trim();
      const fileLabel = `${cleanLabel1}_and_${cleanLabel2}_${weekKey}`.replace(/\s+/g, "_");
      
      exportGridsToExcel(
        { ...g1, label: label1 },
        { ...g2, label: label2 },
        weekKey,
        `${fileLabel}.xlsx`
      );
      toast.success("Excel sheet downloaded successfully!");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export Excel sheet.");
    }
  }, [label1, label2, weekKey]);

  const consolidatedData = useMemo(() => {
    const g1 = panel1Ref.current?.getSnapshot();
    const g2 = panel2Ref.current?.getSnapshot();

    if (!g1 || !g2) {
      return {
        callCount: 0,
        grandTotal: 0,
        columns: [],
      };
    }

    const callCount = [g1, g2].reduce((sum, snap) => {
      const callCol = snap.metaCols.find(
        (c) => c.name.toLowerCase() === "call count",
      );

      if (!callCol) return sum;

      return (
        sum +
        snap.rows.reduce(
          (s, row) =>
            s + Number(row.metaValues?.[callCol.id] || 0),
          0,
        )
      );
    }, 0);

    const columns = g1.scoreParams.map((param) => {
      const total = [g1, g2].reduce((sum, grid) => {
        return (
          sum +
          grid.rows.reduce(
            (rowSum, row) =>
              rowSum +
              (row.checked?.[param.id] ? param.score : 0),
            0,
          )
        );
      }, 0);

      return {
        id: param.id,
        name: param.name,
        total,
      };
    });

    const grandTotal = columns.reduce(
      (sum, col) => sum + col.total,
      0,
    );

    return {
      callCount,
      grandTotal,
      columns,
    };
  }, [panel1Ref.current, panel2Ref.current]);

  // Note: no manual dirty reset needed — GridPanel's firstRender ref handles this correctly

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
            Quality Scores
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Two independent grids — save your changes centrally before navigating away
          </p>
        </div>

        {/* Top-level global action buttons */}
        <div className="flex items-center justify-between flex-wrap gap-3 w-full pb-1">
          {/* Left side actions */}
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowAddShared(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-colors"
                  title="Add an agent to both grids simultaneously"
                >
                  <UserPlus className="size-4" /> Add Agent
                </button>
                
                <button
                  onClick={() => setTopAction("parameter")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-sm transition-colors"
                  title="Add a score / manual parameter to both grids"
                >
                  <Hash className="size-4" /> Add Parameter
                </button>
                
                <button
                  onClick={() => setTopAction("detail")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold shadow-sm transition-colors"
                  title="Add a case-detail column (Week, Date, etc.) to both grids"
                >
                  <TableProperties className="size-4" /> Add Details
                </button>
              </>
            )}
          </div>

          {/* Right side actions */}
          <div className="flex gap-2 flex-wrap">
            {isAdmin && (
              <button
                onClick={() => {
                  if (dirty1) doSave1();
                  if (dirty2) doSave2();
                }}
                disabled={!dirty1 && !dirty2}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all ${
                  dirty1 || dirty2
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                title="Save changes for both grids"
              >
                <Save className="size-4" /> Save Changes
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-sm font-bold shadow-sm transition-colors"
              title="Export both scoring grids to a premium Excel sheet"
            >
              <Download className="size-4" /> Export to Excel
            </button>
          </div>
        </div>
      </div>

      {/* Score Card Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <button
          onClick={goPrevScoreCard}
          className="flex items-center gap-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors shadow-sm"
          title="Go to Previous Score Card"
        >
          <ChevronLeft className="size-4" /> Prev Score Card
        </button>

        <div className="flex flex-wrap items-center gap-3 justify-center">
          {/* Year selector */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Month selector */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Month</label>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Week selector */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Week</label>
            <select
              value={selectedWeekIdx}
              onChange={e => setSelectedWeekIdx(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 cursor-pointer"
            >
              <option value={1}>W1</option>
              <option value={2}>W2</option>
              <option value={3}>W3</option>
              <option value={4}>W4</option>
            </select>
          </div>
        </div>

        <button
          onClick={goNextScoreCard}
          className="flex items-center gap-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors shadow-sm"
          title="Go to Next Score Card"
        >
          Next Score Card <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Which-grid picker for top-level parameter/detail actions */}
      {topAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6">
            <p className="font-bold text-slate-900 mb-1">
              {topAction === "parameter"
                ? "Add Parameter"
                : "Add Detail Column"}
            </p>
            <p className="text-xs text-slate-400 mb-5">
              Choose where to open the dialog:
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  panel1Ref.current?.triggerAction(topAction);
                  setTopAction(null);
                  setOpen1(true);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-colors"
              >
                {label1}
              </button>
              <button
                onClick={() => {
                  panel2Ref.current?.triggerAction(topAction);
                  setTopAction(null);
                  setOpen2(true);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-700 text-white text-sm font-bold hover:bg-slate-600 transition-colors"
              >
                {label2}
              </button>
              <button
                onClick={() => {
                  panel1Ref.current?.triggerAction(topAction);
                  panel2Ref.current?.triggerAction(topAction);
                  setTopAction(null);
                  setOpen1(true);
                  setOpen2(true);
                }}
                className="w-full py-2.5 rounded-xl border-2 border-blue-500 text-blue-600 text-sm font-bold hover:bg-blue-50 transition-colors"
              >
                Both Grids
              </button>
              <button
                onClick={() => setTopAction(null)}
                className="w-full py-2 text-slate-400 text-sm hover:text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scoring Grid 1 ── */}
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Entire header row is clickable to toggle */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen1((o) => !o)}
          onKeyDown={(e) =>
            e.key === "Enter" && setOpen1((o) => !o)
          }
          className={`flex items-center justify-between px-5 py-3.5 cursor-pointer select-none ${dirty1 ? "bg-amber-50 border-b border-amber-200" : "bg-slate-800"}`}
        >
          <div
            className={`flex items-center gap-2 font-bold text-sm ${dirty1 ? "text-amber-800" : "text-white"}`}
          >
            {open1 ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            
            {editingLabel1 && isAdmin ? (
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={label1Draft}
                  onChange={e => setLabel1Draft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (label1Draft.trim()) {
                        setLabel1(label1Draft.trim());
                        setDirty1(true);
                      }
                      setEditingLabel1(false);
                    } else if (e.key === 'Escape') {
                      setEditingLabel1(false);
                    }
                  }}
                  className="px-2 py-0.5 text-slate-800 bg-white border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400 font-semibold"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (label1Draft.trim()) {
                      setLabel1(label1Draft.trim());
                      setDirty1(true);
                    }
                    setEditingLabel1(false);
                  }}
                  className="p-1 rounded bg-green-500 hover:bg-green-600 text-white"
                >
                  <Check className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLabel1(false)}
                  className="p-1 rounded bg-red-500 hover:bg-red-600 text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group/lbl">
                <span>{label1}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLabel1Draft(label1);
                      setEditingLabel1(true);
                    }}
                    className="opacity-0 group-hover/lbl:opacity-100 p-1 rounded hover:bg-white/20 text-slate-400 hover:text-white transition-opacity"
                    title="Rename grid"
                  >
                    <Edit2 className="size-3" />
                  </button>
                )}
              </div>
            )}
            
            {dirty1 && (
              <span className="ml-2 flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle className="size-3" /> Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* Always mounted — CSS hidden to preserve state on collapse */}
        <div className={`bg-white ${open1 ? "" : "hidden"}`}>
          <div className="p-4">
            <GridPanel
              ref={panel1Ref}
              storageKey="qa_grid_1"
              label={label1}
              weekKey={weekKey}
              weekNum={weekNum}
              weekStart={weekStart}
              onDirtyChange={setDirty1}
              externalAgents={g1Agents}
              onAgentDeleted={handleAgentDeletedFromGrid1}
              readOnly={!isAdmin}
            />
          </div>
        </div>
      </div>

      {/* ── Scoring Grid 2 ── */}
      <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setOpen2((o) => !o)}
          onKeyDown={(e) =>
            e.key === "Enter" && setOpen2((o) => !o)
          }
          className={`flex items-center justify-between px-5 py-3.5 cursor-pointer select-none ${dirty2 ? "bg-amber-50 border-b border-amber-200" : "bg-slate-700"}`}
        >
          <div
            className={`flex items-center gap-2 font-bold text-sm ${dirty2 ? "text-amber-800" : "text-white"}`}
          >
            {open2 ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            
            {editingLabel2 && isAdmin ? (
              <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={label2Draft}
                  onChange={e => setLabel2Draft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (label2Draft.trim()) {
                        setLabel2(label2Draft.trim());
                        setDirty2(true);
                      }
                      setEditingLabel2(false);
                    } else if (e.key === 'Escape') {
                      setEditingLabel2(false);
                    }
                  }}
                  className="px-2 py-0.5 text-slate-800 bg-white border border-slate-300 rounded text-xs outline-none focus:ring-1 focus:ring-blue-400 font-semibold"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (label2Draft.trim()) {
                      setLabel2(label2Draft.trim());
                      setDirty2(true);
                    }
                    setEditingLabel2(false);
                  }}
                  className="p-1 rounded bg-green-500 hover:bg-green-600 text-white"
                >
                  <Check className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLabel2(false)}
                  className="p-1 rounded bg-red-500 hover:bg-red-600 text-white"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 group/lbl">
                <span>{label2}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLabel2Draft(label2);
                      setEditingLabel2(true);
                    }}
                    className="opacity-0 group-hover/lbl:opacity-100 p-1 rounded hover:bg-white/20 text-slate-400 hover:text-white transition-opacity"
                    title="Rename grid"
                  >
                    <Edit2 className="size-3" />
                  </button>
                )}
              </div>
            )}
            
            {dirty2 && (
              <span className="ml-2 flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-200 px-2 py-0.5 rounded-full">
                <AlertTriangle className="size-3" /> Unsaved changes
              </span>
            )}
          </div>
        </div>

        {/* Always mounted — CSS hidden to preserve state on collapse */}
        <div className={`bg-white ${open2 ? "" : "hidden"}`}>
          <div className="p-4">
            <GridPanel
              ref={panel2Ref}
              storageKey="qa_grid_2"
              label={label2}
              weekKey={weekKey}
              weekNum={weekNum}
              weekStart={weekStart}
              onDirtyChange={setDirty2}
              externalAgents={g2Agents}
              onAgentDeleted={handleAgentDeletedFromGrid2}
              readOnly={!isAdmin}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-3">
        <button
          onClick={() => setConsolidatedView("horizontal")}
          className={`px-3 py-1 rounded-lg text-sm ${
            consolidatedView === "horizontal"
              ? "bg-blue-600 text-white"
              : "bg-slate-100"
          }`}
        >
          Grid View
        </button>

        <button
          onClick={() => setConsolidatedView("vertical")}
          className={`px-3 py-1 rounded-lg text-sm ${
            consolidatedView === "vertical"
              ? "bg-blue-600 text-white"
              : "bg-slate-100"
          }`}
        >
          List View
        </button>
      </div>

      {/* Consolidation Total Horizontal view*/}
      {consolidatedView === "horizontal" && (
        <div className="overflow-x-auto">
          <table className="border-collapse w-full text-sm">
            <thead>
              <tr>
                <th className="border px-4 py-3 bg-slate-800 text-white">
                  Summary
                </th>

                <th className="border px-3 py-3 bg-amber-700 text-white">
                  Call Count
                </th>

                {consolidatedData.columns.map((col) => (
                  <th
                    key={col.id}
                    className="border px-3 py-3 bg-blue-700 text-white"
                  >
                    {col.name}
                  </th>
                ))}

                <th className="border px-3 py-3 bg-slate-800 text-white">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="border px-4 py-3 font-bold">
                  Consolidated
                </td>

                <td className="border text-center font-bold">
                  {consolidatedData.callCount}
                </td>

                {consolidatedData.columns.map((col) => (
                  <td
                    key={col.id}
                    className="border text-center font-bold"
                  >
                    {col.total}
                  </td>
                ))}

                <td className="border text-center font-black">
                  {consolidatedData.grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {consolidatedView === "vertical" && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border px-3 py-2">Metric</th>
                <th className="border px-3 py-2">Total</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td className="border px-3 py-2">Call Count</td>

                <td className="border px-3 py-2 font-bold">
                  {consolidatedData.callCount}
                </td>
              </tr>

              {consolidatedData.columns.map((col) => (
                <tr key={col.id}>
                  <td className="border px-3 py-2">
                    {col.name}
                  </td>

                  <td className="border px-3 py-2 font-bold">
                    {col.total}
                  </td>
                </tr>
              ))}

              <tr>
                <td className="border px-3 py-2 font-bold">
                  Grand Total
                </td>

                <td className="border px-3 py-2 font-black">
                  {consolidatedData.grandTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Shared Add Agent dialog */}
      {showAddShared && (
        <AddAgentSharedDialog
          onAdd={addSharedAgent}
          onClose={() => setShowAddShared(false)}
        />
      )}

      {/* Navigation blocker modal */}
      {blocker.state === "blocked" && (
        <UnsavedModal
          dirtyGrids={dirtyGrids}
          onSaveAndContinue={handleSaveAndContinue}
          onDiscard={handleDiscard}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}