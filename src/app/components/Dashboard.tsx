import { useState, useRef, useCallback, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  TrendingUp, TrendingDown, AlertTriangle, Phone, FileText,
  Download, Printer, ChevronDown, FileDown, X, Filter,
} from 'lucide-react';
import { useGrid } from '../context/GridContext';
import type { AuditRecord } from '../context/GridContext';

const SHIFTS = ['Morning', 'Afternoon', 'Night'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1);

// ── helpers ───────────────────────────────────────────────────────────────────

const PALETTE = ['#1D4ED8','#7C3AED','#059669','#D97706','#DC2626','#0891B2'];
const BLUES   = ['#1D4ED8','#2563EB','#3B82F6','#60A5FA','#93C5FD'];

function avg(a: number[]) { return a.length === 0 ? 0 : Math.round(a.reduce((x,y)=>x+y,0)/a.length); }
function grade(p: number) { return p>=90?{l:'Excellent',c:'#059669'}:p>=85?{l:'Good',c:'#16A34A'}:p>=75?{l:'Average',c:'#D97706'}:{l:'Needs Work',c:'#DC2626'}; }
function sc(p: number) { return p>=80?'#059669':p>=50?'#D97706':p>0?'#DC2626':'#94A3B8'; }
function sb(p: number) { return p>=80?'#ECFDF5':p>=50?'#FFFBEB':p>0?'#FFF1F2':'#F8FAFC'; }

function BLabel({x=0,y=0,width=0,value=0}:{x?:number;y?:number;width?:number;value?:number}) {
  return <text x={x+width/2} y={y-5} fill="#475569" fontSize={11} fontWeight={700} textAnchor="middle">{value}%</text>;
}

function Card({children, className=''}:{children:React.ReactNode;className?:string}) {
  return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>{children}</div>;
}

function KpiCard({title,value,sub,icon:Icon,color}:{title:string;value:string|number;sub?:string;icon:React.ElementType;color:string}) {
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className="size-11 rounded-xl flex items-center justify-center shrink-0" style={{background:color+'18'}}>
        <Icon className="size-5" style={{color}} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{title}</p>
        <p className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

// ── Download menu ─────────────────────────────────────────────────────────────

function DownloadMenu({ onPDF, onWord, onPrint }: { onPDF:()=>void; onWord:()=>void; onPrint:()=>void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-colors"
      >
        <Download className="size-4" /> Download Report
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-40">
            <button onClick={() => { onPDF(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors">
              <FileDown className="size-4 text-red-500" /> Export as PDF
            </button>
            <button onClick={() => { onWord(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors">
              <FileText className="size-4 text-blue-500" /> Export as Word
            </button>
            <div className="border-t border-slate-100 my-1" />
            <button onClick={() => { onPrint(); setOpen(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
              <Printer className="size-4 text-slate-500" /> Print
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { auditRecords, agentNames } = useGrid();
  const reportRef = useRef<HTMLDivElement>(null);

  // ── Filter state (default = show everything) ──────────────────────────────
  const [selAgents, setSelAgents] = useState<string[]>([]);
  const [selWeeks,  setSelWeeks]  = useState<number[]>([]);
  const [selShifts, setSelShifts] = useState<string[]>([]);
  const [selMonth,  setSelMonth]  = useState(() => {
    return new Date().toLocaleString('en-US', { month: 'long' });
  });
  const [selDay,    setSelDay]    = useState<number | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);

  const anyFilter = selAgents.length > 0 || selWeeks.length > 0 || selShifts.length > 0 || selMonth || selDay;

  const clearAll = () => { setSelAgents([]); setSelWeeks([]); setSelShifts([]); setSelMonth(''); setSelDay(null); };

  // ── Apply filters (default = all records) ─────────────────────────────────
  const records: AuditRecord[] = useMemo(() => {
    if (!anyFilter) return auditRecords; // no filter → show everything
    return auditRecords.filter(r => {
      if (selAgents.length && !selAgents.includes(r.agent))  return false;
      if (selWeeks.length  && !selWeeks.includes(r.week ?? 0)) return false;
      if (selShifts.length && !selShifts.includes(r.shift))  return false;
      if (selMonth && r.month !== selMonth)                   return false;
      if (selDay   && r.day   !== selDay)                     return false;
      return true;
    });
  }, [auditRecords, selAgents, selWeeks, selShifts, selMonth, selDay, anyFilter]);

  const hasData = auditRecords.length > 0;

  // ── KPIs ──
  const kpi = useMemo(() => {
    const total    = records.length;
    const calls    = records.reduce((s,r) => s + r.callCount, 0);
    const above    = records.filter(r => r.score >= 85).length;
    const below    = total - above;
    const fatal    = records.filter(r => r.isFatal).length;
    const fatalPct = total === 0 ? 0 : Math.round(fatal/total*100);
    const overall  = avg(records.map(r => r.score));
    return { total, calls, above, below, fatal, fatalPct, overall };
  }, [records]);

  // ── Weekly trend (W1–W4) ──
  const weeklyData = useMemo(() =>
    [1,2,3,4].map(w => {
      const r = records.filter(x => x.week === w);
      return { week: `W${w}`, score: avg(r.map(x=>x.score)), cases: r.length };
    }), [records]);

  // ── Top advisors ──
  const topAdvisors = useMemo(() => {
    const map: Record<string,number[]> = {};
    records.forEach(r => { if (!map[r.agent]) map[r.agent]=[]; map[r.agent].push(r.score); });
    return Object.entries(map)
      .map(([name,scores]) => ({ name, score: avg(scores), cases: scores.length }))
      .sort((a,b) => b.score-a.score).slice(0,5);
  }, [records]);

  // ── Agent distribution ──
  const agentDist = useMemo(() => {
    const map: Record<string,number[]> = {};
    records.forEach(r => { if (!map[r.agent]) map[r.agent]=[]; map[r.agent].push(r.score); });
    return Object.entries(map).map(([name,scores]) => ({ name: name.replace('Agent ','Ag.'), score: avg(scores) }));
  }, [records]);

  // ── Fatal pie ──
  const fatalPie = useMemo(() => {
    const m: Record<string,number> = {};
    records.filter(r=>r.isFatal).forEach(r => { m[r.agent]=(m[r.agent]??0)+1; });
    const tot = Object.values(m).reduce((a,b)=>a+b,0);
    return Object.entries(m).map(([name,value])=>({ name, value, pct: tot===0?0:Math.round(value/tot*100) }));
  }, [records]);

  const g = grade(kpi.overall);

  // ── Exports ──
  const handlePrint = useCallback(() => window.print(), []);

  const handlePDF = useCallback(() => window.print(), []);

  const handleWord = useCallback(() => {
    const topRows = topAdvisors.map((a,i)=>`<tr><td>${i+1}</td><td>${a.name}</td><td>${a.score}%</td><td>${a.cases}</td></tr>`).join('');
    const fatalRows = fatalPie.length
      ? fatalPie.map(f=>`<tr><td>${f.name}</td><td>${f.value}</td><td>${f.pct}%</td></tr>`).join('')
      : '<tr><td colspan="3" style="color:green">No fatal calls</td></tr>';
    const weekRows = weeklyData.map(w=>`<tr><td>${w.week}</td><td>${w.score}%</td><td>${w.cases}</td></tr>`).join('');
    const agentRows = agentDist.map(a=>`<tr><td>${a.name}</td><td style="color:${a.score>=85?'green':a.score>=75?'orange':'red'}">${a.score}%</td></tr>`).join('');

    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif;font-size:12pt;color:#1E293B;margin:20mm}
h1{font-size:20pt;color:#1D4ED8;text-align:center;border-bottom:3px solid #1D4ED8;padding-bottom:8pt;margin-bottom:16pt}
h2{font-size:14pt;color:#1D4ED8;margin-top:20pt;margin-bottom:8pt;border-left:4px solid #1D4ED8;padding-left:8pt}
table{border-collapse:collapse;width:100%;margin-bottom:16pt}
th{background:#1D4ED8;color:white;padding:8pt;text-align:left}
td{padding:6pt 8pt;border:1px solid #E2E8F0}
tr:nth-child(even) td{background:#F8FAFC}
.kpi{display:inline-block;border:2px solid #E2E8F0;border-radius:6pt;padding:10pt 16pt;margin:4pt;text-align:center;min-width:100pt}
.kv{font-size:20pt;font-weight:bold;color:#1D4ED8}.kl{font-size:9pt;color:#64748B;text-transform:uppercase}
</style></head><body>
<h1>QUALITY DASHBOARD REPORT</h1>
<p><b>Generated:</b> ${new Date().toLocaleString()} &nbsp;|&nbsp; <b>Total Records:</b> ${kpi.total}</p>
<h2>Key Metrics</h2>
<div>
<div class="kpi"><div class="kv">${kpi.total}</div><div class="kl">Total Cases</div></div>
<div class="kpi"><div class="kv">${kpi.calls}</div><div class="kl">Total Calls</div></div>
<div class="kpi"><div class="kv" style="color:#059669">${kpi.overall}%</div><div class="kl">Overall Score</div></div>
<div class="kpi"><div class="kv" style="color:#059669">${kpi.above}</div><div class="kl">Above 85%</div></div>
<div class="kpi"><div class="kv" style="color:#D97706">${kpi.below}</div><div class="kl">Below 85%</div></div>
<div class="kpi"><div class="kv" style="color:#DC2626">${kpi.fatal} (${kpi.fatalPct}%)</div><div class="kl">Fatal Calls</div></div>
</div>
<h2>Weekly Trend (W1–W4)</h2>
<table><tr><th>Week</th><th>Avg Score</th><th>Cases</th></tr>${weekRows}</table>
<h2>Top Advisors</h2>
<table><tr><th>Rank</th><th>Agent</th><th>Score</th><th>Cases</th></tr>${topRows}</table>
<h2>Agent Distribution</h2>
<table><tr><th>Agent</th><th>Avg Score</th></tr>${agentRows}</table>
<h2>Fatal Calls by Agent</h2>
<table><tr><th>Agent</th><th>Count</th><th>%</th></tr>${fatalRows}</table>
</body></html>`;

    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `quality-dashboard-${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }, [kpi, topAdvisors, agentDist, fatalPie, weeklyData]);

  return (
    <>
      {/* Print stylesheet — hides nav, shows only report */}
      <style>{`
        @media print {
          header, nav, .no-print { display: none !important; }
          .print-area { display: block !important; }
          body { background: white; }
        }
      `}</style>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Quality Dashboard</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {hasData
                ? `Based on ${kpi.total} saved audit records`
                : 'Save scoring grid data to populate this dashboard'}
            </p>
          </div>
          <div className="no-print">
            <DownloadMenu onPDF={handlePDF} onWord={handleWord} onPrint={handlePrint} />
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 no-print">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest self-center">
              <Filter className="size-3.5"/> Filters
            </div>

            {/* Agent */}
            <div className="relative">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Agent</p>
              <button onClick={() => setAgentOpen(o => !o)}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 hover:border-blue-300 bg-white min-w-[150px]">
                <span className="flex-1 text-left text-xs font-medium">
                  {selAgents.length === 0 ? 'All Agents' : selAgents.length === 1 ? selAgents[0] : `${selAgents.length} selected`}
                </span>
                <ChevronDown className="size-3.5 text-slate-400 shrink-0"/>
              </button>
              {agentOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setAgentOpen(false)}/>
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 py-2 max-h-56 overflow-y-auto">
                    <button onClick={() => { setSelAgents([]); setAgentOpen(false); }}
                      className="w-full text-left px-4 py-2 text-xs font-bold text-blue-600 hover:bg-slate-50">All Agents</button>
                    <div className="border-t border-slate-100 my-1"/>
                    {agentNames.length === 0
                      ? <p className="px-4 py-2 text-xs text-slate-400">No agents saved yet</p>
                      : agentNames.map(a => (
                          <label key={a} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer text-xs text-slate-700">
                            <input type="checkbox" checked={selAgents.includes(a)}
                              onChange={() => setSelAgents(p => p.includes(a) ? p.filter(x => x !== a) : [...p, a])}
                              className="rounded accent-blue-600"/>
                            {a}
                          </label>
                        ))
                    }
                  </div>
                </>
              )}
            </div>

            {/* Week */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Week</p>
              <div className="flex gap-1.5">
                {[1,2,3,4].map(w => (
                  <button key={w} onClick={() => setSelWeeks(p => p.includes(w) ? p.filter(x => x !== w) : [...p, w])}
                    className={`w-9 h-9 rounded-xl text-xs font-bold border-2 transition-all ${selWeeks.includes(w) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                    W{w}
                  </button>
                ))}
              </div>
            </div>

            {/* Shift */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Shift</p>
              <div className="flex gap-1.5 flex-wrap">
                {SHIFTS.map(s => (
                  <button key={s} onClick={() => setSelShifts(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])}
                    className={`px-3 h-9 rounded-xl text-xs font-bold border-2 transition-all ${selShifts.includes(s) ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Month */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Month</p>
              <select value={selMonth} onChange={e => setSelMonth(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-400 bg-white">
                <option value="">All Months</option>
                {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* Day */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Day</p>
              <select value={selDay ?? ''} onChange={e => setSelDay(e.target.value ? Number(e.target.value) : null)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-blue-400 bg-white">
                <option value="">All Days</option>
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Clear */}
            {anyFilter && (
              <button onClick={clearAll}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors font-medium self-end mb-1.5">
                <X className="size-3.5"/> Clear
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {anyFilter && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
              {selAgents.map(a => <span key={a} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">{a}<button onClick={() => setSelAgents(p => p.filter(x => x !== a))}><X className="size-2.5"/></button></span>)}
              {selWeeks.map(w  => <span key={w}  className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">W{w}<button onClick={() => setSelWeeks(p => p.filter(x => x !== w))}><X className="size-2.5"/></button></span>)}
              {selShifts.map(s => <span key={s}  className="flex items-center gap-1 bg-violet-100 text-violet-700 text-xs font-semibold px-2.5 py-1 rounded-full">{s}<button onClick={() => setSelShifts(p => p.filter(x => x !== s))}><X className="size-2.5"/></button></span>)}
              {selMonth && <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">{selMonth}<button onClick={() => setSelMonth('')}><X className="size-2.5"/></button></span>}
              {selDay   && <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">Day {selDay}<button onClick={() => setSelDay(null)}><X className="size-2.5"/></button></span>}
              <span className="text-xs text-slate-400 self-center">{records.length} record{records.length !== 1 ? 's' : ''} match</span>
            </div>
          )}
        </div>

        {/* Report content */}
        <div ref={reportRef} className="space-y-4 print-area">
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard title="Total Cases Audited" value={kpi.total} icon={FileText}      color="#1D4ED8"/>
            <KpiCard title="Total Calls Audited" value={kpi.calls} icon={Phone}         color="#7C3AED"/>
            <KpiCard title="Score Above 85%"      value={kpi.above} sub={kpi.total?`${Math.round(kpi.above/kpi.total*100)}% of audits`:''} icon={TrendingUp}   color="#059669"/>
            <KpiCard title="Score Below 85%"      value={kpi.below} sub={kpi.total?`${Math.round(kpi.below/kpi.total*100)}% of audits`:''} icon={TrendingDown} color="#D97706"/>
            <KpiCard title="Fatal Call Count"     value={kpi.fatal} icon={AlertTriangle} color="#DC2626"/>
            <KpiCard title="Fatal %"              value={`${kpi.fatalPct}%`} icon={AlertTriangle} color="#9333EA"/>
          </div>

          {/* Row 1: Weekly trend + Overall score + Top advisors */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Weekly trend */}
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-700 mb-0.5 flex items-center gap-2">
                <TrendingUp className="size-4 text-blue-600"/>Weekly Trend
              </p>
              <p className="text-xs text-slate-400 mb-3">Avg score W1–W4</p>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={weeklyData} margin={{top:16,right:8,left:-22,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="week" tick={{fontSize:11,fill:'#94A3B8'}}/>
                  <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94A3B8'}}/>
                  <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}}
                    formatter={(v:number)=>[`${v}%`,'Score']}/>
                  <Line type="monotone" dataKey="score" stroke="#1D4ED8" strokeWidth={2.5}
                    dot={{fill:'#1D4ED8',r:4}} activeDot={{r:6}}/>
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Overall quality score */}
            <Card className="p-5 flex flex-col">
              <p className="text-sm font-bold text-slate-700 mb-0.5">Overall Quality Score</p>
              <p className="text-xs text-slate-400 mb-3">Across all saved records</p>
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <div className="relative size-40">
                  <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#F1F5F9" strokeWidth="14"/>
                    <circle cx="60" cy="60" r="50" fill="none" stroke={g.c} strokeWidth="14"
                      strokeDasharray={`${(kpi.overall/100)*314} 314`} strokeLinecap="round"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-4xl font-black" style={{color:g.c}}>{kpi.overall}%</span>
                  </div>
                </div>
                <span className="text-sm font-bold px-4 py-1.5 rounded-full" style={{background:g.c+'18',color:g.c}}>{g.l}</span>
                <p className="text-xs text-slate-400">{kpi.total} records</p>
              </div>
            </Card>

            {/* Top advisors */}
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-700 mb-0.5">Top Advisors</p>
              <p className="text-xs text-slate-400 mb-4">Ranked by average score</p>
              {topAdvisors.length > 0 ? (
                <div className="space-y-3.5">
                  {topAdvisors.map((a,i) => (
                    <div key={a.name} className="flex items-center gap-3">
                      <div className="size-7 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                        style={{background:i===0?'#D97706':i===1?'#94A3B8':i===2?'#B45309':'#CBD5E1'}}>{i+1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-700 truncate">{a.name}</span>
                          <span className="text-xs font-black text-slate-800 ml-2 tabular-nums">{a.score}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${a.score}%`,background:PALETTE[i%PALETTE.length]}}/>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-300 text-xs">Save a grid to see advisors</div>
              )}
            </Card>
          </div>

          {/* Row 2: Agent distribution + Fatal + Weekly cases */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Agent score distribution */}
            <Card className="p-5 lg:col-span-2">
              <p className="text-sm font-bold text-slate-700 mb-0.5">Agent Score Distribution</p>
              <p className="text-xs text-slate-400 mb-4">Green ≥85% · Amber 75–84% · Red &lt;75%</p>
              {agentDist.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={agentDist} margin={{top:22,right:16,left:-16,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                    <XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}}/>
                    <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94A3B8'}}/>
                    <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}}
                      formatter={(v:number)=>[`${v}%`,'Score']}/>
                    <Bar dataKey="score" radius={[6,6,0,0]}>
                      {agentDist.map((d,i)=><Cell key={i} fill={d.score>=85?'#059669':d.score>=75?'#D97706':'#DC2626'}/>)}
                      <LabelList dataKey="score" content={<BLabel/>}/>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-44 text-slate-300 text-xs">No agent data yet</div>
              )}
            </Card>

            {/* Fatal contribution */}
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-700 mb-0.5">Fatal Calls</p>
              <p className="text-xs text-slate-400 mb-3">By agent</p>
              {fatalPie.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <ResponsiveContainer width="100%" height={120}>
                    <PieChart>
                      <Pie data={fatalPie} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3}>
                        {fatalPie.map((_,i)=><Cell key={i} fill={BLUES[i%BLUES.length]}/>)}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5">
                    {fatalPie.map((d,i) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="size-2.5 rounded-sm shrink-0" style={{background:BLUES[i%BLUES.length]}}/>
                        <span className="text-xs text-slate-600 truncate flex-1">{d.name}</span>
                        <span className="text-xs font-bold text-slate-800">{d.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-44 gap-2">
                  <AlertTriangle className="size-8 text-emerald-300"/>
                  <p className="text-xs font-semibold text-emerald-500">
                    {hasData ? 'No fatal calls 🎉' : 'No data yet'}
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* Row 3: Pass/Fail + Weekly cases */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Pass/fail donut */}
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-700 mb-0.5">Pass / Below-Target</p>
              <p className="text-xs text-slate-400 mb-4">85% threshold</p>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={170}>
                  <PieChart>
                    <Pie data={[{name:'≥85%',value:kpi.above},{name:'<85%',value:kpi.below}]}
                      dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={68}>
                      <Cell fill="#059669"/><Cell fill="#DC2626"/>
                    </Pie>
                    <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-5">
                  {[{l:'Above 85%',v:kpi.above,c:'#059669',I:TrendingUp},{l:'Below 85%',v:kpi.below,c:'#DC2626',I:TrendingDown}].map(({l,v,c,I})=>(
                    <div key={l} className="flex items-center gap-3">
                      <div className="size-10 rounded-xl flex items-center justify-center" style={{background:c+'18'}}><I className="size-5" style={{color:c}}/></div>
                      <div><p className="text-xs text-slate-400 font-medium">{l}</p><p className="text-2xl font-black tabular-nums" style={{color:c}}>{v}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Weekly case volume */}
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-700 mb-0.5">Weekly Case Volume</p>
              <p className="text-xs text-slate-400 mb-4">Number of audits per week</p>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={weeklyData} margin={{top:22,right:8,left:-24,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                  <XAxis dataKey="week" tick={{fontSize:11,fill:'#94A3B8'}}/>
                  <YAxis tick={{fontSize:11,fill:'#94A3B8'}}/>
                  <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}} formatter={(v:number)=>[v,'Cases']}/>
                  <Bar dataKey="cases" fill="#7C3AED" radius={[6,6,0,0]}>
                    <LabelList dataKey="cases" position="top" style={{fontSize:11,fontWeight:700,fill:'#7C3AED'}}/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Empty state */}
          {!hasData && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-2xl p-10 text-center">
              <FileText className="size-12 text-blue-300 mx-auto mb-3"/>
              <h3 className="text-lg font-bold text-slate-600 mb-1">No saved data yet</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto">
                Go to <span className="font-semibold text-blue-600">Scores</span>, fill in agent scores, then click{' '}
                <span className="font-semibold text-blue-600">Save Changes</span> to populate this dashboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
