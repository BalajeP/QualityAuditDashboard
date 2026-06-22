import { useState, useMemo, useRef, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import {
  FileText, Users, TrendingUp, TrendingDown,
  AlertTriangle, Phone, ChevronDown, X, Filter, FileDown,
} from 'lucide-react';
import { useGrid } from "../context/GridContext";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const AGENTS   = Array.from({ length: 10 }, (_, i) => `Agent ${i + 1}`);
const MONTHS   = ['January','February','March','April','May','June'];
const WEEKS    = [1, 2, 3, 4];
const SHIFTS   = ['Morning','Afternoon','Night'];
const TENURES  = ['0m-3m','3m-6m','6m-1yr','1yr-2yr','2yr+'];
const FATAL_REASONS = ['Rude Behavior','Conference Call','First Call to Customer'];
const BLUES   = ['#1D4ED8','#2563EB','#3B82F6','#60A5FA','#93C5FD'];
const PALETTE = ['#1D4ED8','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#65A30D','#DB2777','#9333EA','#16A34A'];

function sRand(seed: number, lo: number, hi: number) {
  const x = Math.sin(seed + 1) * 10000;
  return lo + Math.floor((x - Math.floor(x)) * (hi - lo + 1));
}

interface AR { id:string; agent:string; week:number; month:string; score:number; callCount:number; isFatal:boolean; fatalReason:string; shift:string; tenure:string; }
const AGENT_META: Record<string,{shift:string;tenure:string}> = {};
AGENTS.forEach((a,i)=>{ AGENT_META[a]={shift:SHIFTS[i%3],tenure:TENURES[i%5]}; });
let rid=0; const ALL:AR[]=[];
AGENTS.forEach((agent,ai)=>{ MONTHS.forEach((month,mi)=>{ WEEKS.forEach(week=>{ const cnt=sRand(ai*100+mi*10+week,2,5); for(let j=0;j<cnt;j++){const seed=ai*1000+mi*100+week*10+j;const score=sRand(seed,62,99);const fatal=score<72&&sRand(seed+77,0,3)===0;ALL.push({id:`r${rid++}`,agent,week,month,score,callCount:sRand(seed+50,8,45),isFatal:fatal,fatalReason:fatal?FATAL_REASONS[sRand(seed+11,0,2)]:'',shift:AGENT_META[agent].shift,tenure:AGENT_META[agent].tenure});}}); }); });

function avg(a:number[]){return a.length===0?0:Math.round(a.reduce((x,y)=>x+y,0)/a.length);}
function grade(p:number){return p>=90?{label:'Excellent',c:'#059669'}:p>=85?{label:'Good',c:'#16A34A'}:p>=75?{label:'Average',c:'#D97706'}:{label:'Needs Work',c:'#DC2626'};}

function Card({children,className=''}:{children:React.ReactNode;className?:string}){return <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`}>{children}</div>;}
function KpiCard({title,value,sub,icon:Icon,color}:{title:string;value:string|number;sub?:string;icon:React.ElementType;color:string}){return(<Card className="p-5 flex items-start gap-4"><div className="size-11 rounded-xl flex items-center justify-center shrink-0" style={{background:color+'18'}}><Icon className="size-5" style={{color}}/></div><div className="min-w-0"><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{title}</p><p className="text-2xl font-black text-slate-900 mt-0.5 tabular-nums">{value}</p>{sub&&<p className="text-[11px] text-slate-400 mt-1">{sub}</p>}</div></Card>);}
function Empty({h=180}:{h?:number}){return(<div className="flex flex-col items-center justify-center text-slate-300 gap-2" style={{height:h}}><Filter className="size-7"/><p className="text-xs font-medium">Select filters to view data</p></div>);}
function BLabel({x=0,y=0,width=0,value=0}:{x?:number;y?:number;width?:number;value?:number}){return <text x={x+width/2} y={y-5} fill="#475569" fontSize={11} fontWeight={700} textAnchor="middle">{value}%</text>;}

export function Reports() {
  const { auditRecords: gridRecords, agentNames: gridAgents } = useGrid();
  const ref=useRef<HTMLDivElement>(null);
  const [selAgents,setSelAgents]=useState<string[]>([]);
  const [selWeeks,setSelWeeks]=useState<number[]>([]);
  const [selMonth,setSelMonth]=useState('');
  const [agentOpen,setAgentOpen]=useState(false);
  const active=selMonth!=='';

  // Use real grid records if available, else fall back to built-in mock
  const dataSource = gridRecords.length > 0 ? gridRecords : ALL;
  const agentList  = gridAgents.length  > 0 ? gridAgents  : AGENTS;

  const filtered=useMemo(()=>{
    if(!active)return[];
    return dataSource.filter(r=>{
      if(selMonth&&r.month!==selMonth)return false;
      if(selWeeks.length&&!selWeeks.includes(r.week??0))return false;
      if(selAgents.length&&!selAgents.includes(r.agent))return false;
      return true;
    });
  },[active,selMonth,selWeeks,selAgents,dataSource]);

  const kpi=useMemo(()=>{
    const total=filtered.length,calls=filtered.reduce((s,r)=>s+r.callCount,0);
    const above=filtered.filter(r=>r.score>=85).length,below=total-above;
    const fatal=filtered.filter(r=>r.isFatal).length,fatalPct=total===0?0:Math.round(fatal/total*100);
    const overall=avg(filtered.map(r=>r.score));
    return{total,calls,above,below,fatal,fatalPct,overall};
  },[filtered]);

  const weeklyData=useMemo(()=>WEEKS.map(w=>{const r=filtered.filter(x=>x.week===w);return{week:`Wk ${w}`,score:avg(r.map(x=>x.score)),cases:r.length};}), [filtered]);
  const tenurityData=useMemo(()=>TENURES.map(t=>{const r=filtered.filter(x=>x.tenure===t);return{name:t,score:avg(r.map(x=>x.score)),n:r.length};}).filter(d=>d.n>0),[filtered]);
  const shiftData=useMemo(()=>SHIFTS.map((s,i)=>{const r=filtered.filter(x=>x.shift===s);return{name:s,score:avg(r.map(x=>x.score)),n:r.length,fill:PALETTE[i]};}).filter(d=>d.n>0),[filtered]);
  const topAdvisors=useMemo(()=>{const pool=selAgents.length?selAgents:agentList;return pool.map(a=>{const r=filtered.filter(x=>x.agent===a);return{name:a,score:avg(r.map(x=>x.score)),cases:r.length};}).filter(d=>d.cases>0).sort((a,b)=>b.score-a.score).slice(0,5);},[filtered,selAgents]);
  const fatalPie=useMemo(()=>{const m:Record<string,number>={};filtered.filter(r=>r.isFatal).forEach(r=>{m[r.fatalReason]=(m[r.fatalReason]??0)+1;});const tot=Object.values(m).reduce((a,b)=>a+b,0);return Object.entries(m).map(([name,value])=>({name,value,pct:tot===0?0:Math.round(value/tot*100)}));},[filtered]);
  const agentDist=useMemo(()=>{const pool=selAgents.length?selAgents:agentList;return pool.map(a=>{const r=filtered.filter(x=>x.agent===a);return{name:a.replace('Agent ','Ag.'),score:avg(r.map(x=>x.score))};}).filter(d=>d.score>0);},[filtered,selAgents]);
  const g=grade(kpi.overall);

  const exportPDF=useCallback(async()=>{
    if(!ref.current)return;
    const canvas=await html2canvas(ref.current,{scale:1.5,useCORS:true,logging:false});
    const img=canvas.toDataURL('image/png');
    const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const pw=pdf.internal.pageSize.getWidth(),ph=pdf.internal.pageSize.getHeight();
    const ih=(canvas.height/canvas.width)*pw;let y=0;
    while(y<ih){if(y>0)pdf.addPage();pdf.addImage(img,'PNG',0,-y,pw,ih);y+=ph;}
    pdf.save(`quality-report-${selMonth||'all'}.pdf`);
  },[selMonth]);

  const exportWord=useCallback(()=>{
    const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Arial}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px}th{background:#1D4ED8;color:white}h1{color:#1D4ED8}</style></head><body><h1>QUALITY DASHBOARD</h1><p><b>Month:</b> ${selMonth||'All'} | <b>Weeks:</b> ${selWeeks.length?selWeeks.join(', '):'All'} | <b>Agents:</b> ${selAgents.length?selAgents.join(', '):'All'}</p><h2>Key Metrics</h2><table><tr><th>Metric</th><th>Value</th></tr><tr><td>Total Cases</td><td>${kpi.total}</td></tr><tr><td>Total Calls</td><td>${kpi.calls}</td></tr><tr><td>Above 85%</td><td>${kpi.above}</td></tr><tr><td>Below 85%</td><td>${kpi.below}</td></tr><tr><td>Fatal Count</td><td>${kpi.fatal}</td></tr><tr><td>Fatal %</td><td>${kpi.fatalPct}%</td></tr><tr><td>Overall Score</td><td>${kpi.overall}%</td></tr></table><h2>Top Advisors</h2><table><tr><th>Agent</th><th>Score</th><th>Cases</th></tr>${topAdvisors.map(a=>`<tr><td>${a.name}</td><td>${a.score}%</td><td>${a.cases}</td></tr>`).join('')}</table><h2>Shiftwise</h2><table><tr><th>Shift</th><th>Score</th></tr>${shiftData.map(s=>`<tr><td>${s.name}</td><td>${s.score}%</td></tr>`).join('')}</table><h2>Fatal</h2><table><tr><th>Reason</th><th>Count</th><th>%</th></tr>${fatalPie.map(f=>`<tr><td>${f.name}</td><td>${f.value}</td><td>${f.pct}%</td></tr>`).join('')}</table></body></html>`;
    const blob=new Blob(['﻿',html],{type:'application/msword'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`quality-report-${selMonth||'all'}.doc`;a.click();URL.revokeObjectURL(url);
  },[kpi,topAdvisors,shiftData,fatalPie,selMonth,selWeeks,selAgents]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Quality Dashboard</h2>
          <p className="text-sm text-slate-400 mt-0.5">Select a month to generate the report</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPDF} disabled={!active} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-35 disabled:cursor-not-allowed"><FileDown className="size-4"/> Export PDF</button>
          <button onClick={exportWord} disabled={!active} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-35 disabled:cursor-not-allowed"><FileText className="size-4"/> Export Word</button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-5 items-end">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Month</p>
            <select value={selMonth} onChange={e=>setSelMonth(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 bg-white min-w-[150px] font-medium">
              <option value="">All Months</option>
              {MONTHS.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Week</p>
            <div className="flex gap-2">
              {WEEKS.map(w=>(
                <button key={w} onClick={()=>setSelWeeks(p=>p.includes(w)?p.filter(x=>x!==w):[...p,w])}
                  className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition-all ${selWeeks.includes(w)?'bg-blue-600 border-blue-600 text-white shadow-sm':'border-slate-200 text-slate-500 hover:border-blue-300 bg-white'}`}>
                  W{w}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Agent</p>
            <button onClick={()=>setAgentOpen(o=>!o)} className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:border-blue-300 transition-colors min-w-[170px] bg-white font-medium">
              <Users className="size-3.5 text-slate-400 shrink-0"/>
              <span className="flex-1 text-left">{selAgents.length===0?'All Agents':selAgents.length===1?selAgents[0]:`${selAgents.length} selected`}</span>
              <ChevronDown className="size-3.5 text-slate-400 shrink-0"/>
            </button>
            {agentOpen&&(
              <div className="absolute top-full left-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 py-2 max-h-60 overflow-y-auto">
                <button onClick={()=>{setSelAgents([]);setAgentOpen(false);}} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 font-bold text-blue-600">All Agents</button>
                <div className="border-t border-slate-100 my-1"/>
                {agentList.map(a=>(
                  <label key={a} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm text-slate-700">
                    <input type="checkbox" checked={selAgents.includes(a)} onChange={()=>setSelAgents(p=>p.includes(a)?p.filter(x=>x!==a):[...p,a])} className="rounded accent-blue-600 size-3.5"/>
                    {a}
                  </label>
                ))}
              </div>
            )}
          </div>
          {active&&<button onClick={()=>{setSelMonth('');setSelWeeks([]);setSelAgents([]);}} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors font-semibold pb-2"><X className="size-3.5"/>Clear all</button>}
        </div>
        {selAgents.length>0&&(
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
            {selAgents.map(a=>(
              <span key={a} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {a}<button onClick={()=>setSelAgents(p=>p.filter(x=>x!==a))}><X className="size-3"/></button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {agentOpen&&<div className="fixed inset-0 z-20" onClick={()=>setAgentOpen(false)}/>}

      {/* Report body */}
      <div ref={ref} className="space-y-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard title="Total Cases Audited" value={active?kpi.total:'—'} sub={active?selMonth||'All months':'Select a month'} icon={FileText} color="#1D4ED8"/>
          <KpiCard title="Total Calls Audited" value={active?kpi.calls:'—'} sub={active?'Sum of call counts':''} icon={Phone} color="#7C3AED"/>
          <KpiCard title="Score Above 85%" value={active?kpi.above:'—'} sub={active&&kpi.total?`${Math.round(kpi.above/kpi.total*100)}% of audits`:''} icon={TrendingUp} color="#059669"/>
          <KpiCard title="Score Below 85%" value={active?kpi.below:'—'} sub={active&&kpi.total?`${Math.round(kpi.below/kpi.total*100)}% of audits`:''} icon={TrendingDown} color="#D97706"/>
          <KpiCard title="Fatal Call Count" value={active?kpi.fatal:'—'} sub={active?'Score < 72%':''} icon={AlertTriangle} color="#DC2626"/>
          <KpiCard title="Fatal %" value={active?`${kpi.fatalPct}%`:'—'} sub={active?'Of total audits':''} icon={AlertTriangle} color="#9333EA"/>
        </div>

        {/* Row 1: trend + overall + tenurity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-0.5 flex items-center gap-2"><TrendingUp className="size-4 text-blue-600"/>Weekly Trend</p>
            <p className="text-xs text-slate-400 mb-3">Avg score per week</p>
            {active&&filtered.length>0?(
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={weeklyData} margin={{top:16,right:8,left:-22,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
                  <XAxis dataKey="week" tick={{fontSize:11,fill:'#94A3B8'}}/>
                  <YAxis domain={[50,100]} tick={{fontSize:11,fill:'#94A3B8'}}/>
                  <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}} formatter={(v:number)=>[`${v}%`,'Score']}/>
                  <Line type="monotone" dataKey="score" stroke="#1D4ED8" strokeWidth={2.5} dot={{fill:'#1D4ED8',r:4}} activeDot={{r:6}}/>
                </LineChart>
              </ResponsiveContainer>
            ):<Empty/>}
          </Card>

          <Card className="p-5 flex flex-col">
            <p className="text-sm font-bold text-slate-700 mb-0.5">Overall Quality Score</p>
            <p className="text-xs text-slate-400 mb-3">Across all selected filters</p>
            {active&&filtered.length>0?(
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
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-bold px-4 py-1.5 rounded-full" style={{background:g.c+'18',color:g.c}}>{g.label}</span>
                  <p className="text-xs text-slate-400">{filtered.length} audits · {kpi.total} cases</p>
                </div>
              </div>
            ):<Empty/>}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-0.5">Tenurity Wise Score</p>
            <p className="text-xs text-slate-400 mb-3">Avg score by agent tenure</p>
            {active&&tenurityData.length>0?(
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={tenurityData} margin={{top:20,right:8,left:-26,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:10,fill:'#94A3B8'}}/>
                  <YAxis domain={[0,100]} tick={{fontSize:10,fill:'#94A3B8'}}/>
                  <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}} formatter={(v:number)=>[`${v}%`,'Score']}/>
                  <Bar dataKey="score" fill="#1D4ED8" radius={[6,6,0,0]}>
                    <LabelList dataKey="score" content={<BLabel/>}/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ):<Empty/>}
          </Card>
        </div>

        {/* Row 2: shift + top advisors + fatal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-0.5">Shiftwise CQ Score</p>
            <p className="text-xs text-slate-400 mb-3">Avg quality per shift</p>
            {active&&shiftData.length>0?(
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={shiftData} margin={{top:20,right:8,left:-26,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                  <XAxis dataKey="name" tick={{fontSize:12,fill:'#94A3B8'}}/>
                  <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94A3B8'}}/>
                  <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}} formatter={(v:number)=>[`${v}%`,'Score']}/>
                  <Bar dataKey="score" radius={[8,8,0,0]}>
                    {shiftData.map((d,i)=><Cell key={i} fill={d.fill}/>)}
                    <LabelList dataKey="score" content={<BLabel/>}/>
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ):<Empty h={200}/>}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-0.5">Top Advisors in Quality</p>
            <p className="text-xs text-slate-400 mb-4">Ranked by average score</p>
            {active&&topAdvisors.length>0?(
              <div className="space-y-3.5">
                {topAdvisors.map((a,i)=>(
                  <div key={a.name} className="flex items-center gap-3">
                    <div className="size-7 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
                      style={{background:i===0?'#D97706':i===1?'#94A3B8':i===2?'#B45309':'#CBD5E1'}}>
                      {i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-700 truncate">{a.name}</span>
                        <span className="text-xs font-black text-slate-800 ml-2 tabular-nums">{a.score}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${a.score}%`,background:PALETTE[i]}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ):<Empty h={200}/>}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-0.5">Fatal Contribution</p>
            <p className="text-xs text-slate-400 mb-3">Breakdown by fatal reason</p>
            {active?(fatalPie.length>0?(
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={fatalPie} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3}>
                      {fatalPie.map((_,i)=><Cell key={i} fill={BLUES[i%BLUES.length]}/>)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2.5 flex-1">
                  {fatalPie.map((d,i)=>(
                    <div key={d.name} className="flex items-start gap-2">
                      <div className="size-3 rounded-sm shrink-0 mt-0.5" style={{background:BLUES[i%BLUES.length]}}/>
                      <div><p className="text-[11px] font-semibold text-slate-700">{d.name}</p><p className="text-[11px] text-slate-400">{d.value} · {d.pct}%</p></div>
                    </div>
                  ))}
                </div>
              </div>
            ):(
              <div className="flex flex-col items-center justify-center h-44 gap-2">
                <AlertTriangle className="size-8 text-emerald-300"/>
                <p className="text-xs font-semibold text-emerald-500">No fatal calls — great job!</p>
              </div>
            )):<Empty h={200}/>}
          </Card>
        </div>

        {/* Row 3: agent dist */}
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-700 mb-0.5">Agent Score Distribution</p>
          <p className="text-xs text-slate-400 mb-4">Green ≥85% · Amber 75–84% · Red &lt;75%</p>
          {active&&agentDist.length>0?(
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentDist} margin={{top:22,right:16,left:-16,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false}/>
                <XAxis dataKey="name" tick={{fontSize:11,fill:'#94A3B8'}}/>
                <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94A3B8'}}/>
                <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}} formatter={(v:number)=>[`${v}%`,'Score']}/>
                <Bar dataKey="score" radius={[6,6,0,0]}>
                  {agentDist.map((d,i)=><Cell key={i} fill={d.score>=85?'#059669':d.score>=75?'#D97706':'#DC2626'}/>)}
                  <LabelList dataKey="score" content={<BLabel/>}/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ):<Empty h={220}/>}
        </Card>

        {/* Row 4: weekly volume + pass/fail */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-0.5">Weekly Case Volume</p>
            <p className="text-xs text-slate-400 mb-4">Number of audits per week</p>
            {active&&filtered.length>0?(
              <ResponsiveContainer width="100%" height={190}>
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
            ):<Empty/>}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-bold text-slate-700 mb-0.5">Pass / Below-Target Split</p>
            <p className="text-xs text-slate-400 mb-4">85% threshold</p>
            {active&&filtered.length>0?(
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={190}>
                  <PieChart>
                    <Pie data={[{name:'≥85%',value:kpi.above,fill:'#059669'},{name:'<85%',value:kpi.below,fill:'#DC2626'}]} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={72}>
                      <Cell fill="#059669"/><Cell fill="#DC2626"/>
                    </Pie>
                    <Tooltip contentStyle={{borderRadius:12,border:'1px solid #E2E8F0',fontSize:12}}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-5">
                  {[{label:'Above 85%',val:kpi.above,c:'#059669',Icon:TrendingUp},{label:'Below 85%',val:kpi.below,c:'#DC2626',Icon:TrendingDown}].map(({label,val,c,Icon})=>(
                    <div key={label} className="flex items-center gap-3">
                      <div className="size-10 rounded-xl flex items-center justify-center" style={{background:c+'18'}}><Icon className="size-5" style={{color:c}}/></div>
                      <div><p className="text-xs text-slate-400 font-medium">{label}</p><p className="text-2xl font-black tabular-nums" style={{color:c}}>{val}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            ):<Empty/>}
          </Card>
        </div>

        {!active&&(
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-200 rounded-2xl p-12 text-center">
            <Filter className="size-12 text-blue-300 mx-auto mb-4"/>
            <h3 className="text-lg font-bold text-slate-600 mb-2">No data to display</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">Select a <span className="font-semibold text-blue-600">Month</span> from the filter bar to load your quality dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}
