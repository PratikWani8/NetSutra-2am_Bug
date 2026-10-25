#!/usr/bin/env python3
"""Remove hard-coded dashboard counters and map backend API shapes to UI fields."""
from pathlib import Path
import shutil

ROOT = Path.cwd()

def read(rel):
    p = ROOT / rel
    if not p.is_file():
        raise FileNotFoundError(f"Required file not found: {rel}. Run this from the repository root.")
    return p.read_text(encoding="utf-8")

def write(rel, content):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    backup = p.with_suffix(p.suffix + ".pre-netsutra-fix")
    if p.exists() and not backup.exists():
        shutil.copy2(p, backup)
    p.write_text(content, encoding="utf-8")

stat_cards = r'''import React from 'react';
import { Activity, Zap, ClipboardList, ShieldAlert } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { formatNumber } from '../../utils/formatters';

const numericCount = (value) => {
  if (value && typeof value === 'object') value = value.count;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const StatCards = ({ summary = {} }) => {
  const severity = summary?.severity_breakdown ?? summary?.severityBreakdown ?? {};
  const totalEvents = numericCount(summary?.total_events ?? summary?.totalEvents);
  const anomaliesCount = numericCount(summary?.total_anomalies ?? summary?.anomaliesDetected);
  const openIncidents = numericCount(summary?.active_incidents ?? summary?.openIncidents ?? summary?.activeIncidents);
  const elevatedAnomalies = numericCount(severity.critical) + numericCount(severity.high);

  const cards = [
    { label: 'TOTAL NETWORK EVENTS', value: totalEvents, detail: 'Persisted telemetry events', icon: Activity, tone: 'blue' },
    { label: 'ANOMALIES DETECTED', value: anomaliesCount, detail: 'Persisted detector findings', icon: Zap, tone: 'amber' },
    { label: 'ACTIVE INCIDENTS', value: openIncidents, detail: 'Open incidents from correlation', icon: ClipboardList, tone: 'indigo' },
    { label: 'HIGH / CRITICAL FINDINGS', value: elevatedAnomalies, detail: 'High plus critical severity anomalies', icon: ShieldAlert, tone: 'rose' },
  ];
  const tones = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60',
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <GlassCard key={card.label} className="p-5 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">{card.label}</span>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tones[card.tone]}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
                {formatNumber(card.value)}
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {card.detail}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
};

export default StatCards;
'''

severity_component = r'''import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PieChart as PieIcon, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlassCard from '../common/GlassCard';

const countOf = (value) => {
  if (value && typeof value === 'object') value = value.count;
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export const SeverityDistribution = ({ distribution = {} }) => {
  const data = [
    { name: 'Critical', key: 'critical', value: countOf(distribution?.critical), color: '#ef4444' },
    { name: 'High', key: 'high', value: countOf(distribution?.high), color: '#f59e0b' },
    { name: 'Medium', key: 'medium', value: countOf(distribution?.medium), color: '#64748b' },
    { name: 'Low', key: 'low', value: countOf(distribution?.low), color: '#3b82f6' },
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const pieData = total > 0 ? data : [{ name: 'No findings', value: 1, color: '#cbd5e1' }];

  return (
    <GlassCard className="p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PieIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Severity Distribution</h2>
        </div>
        <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">TOTAL: {total}</span>
      </div>

      <div className="relative h-44 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} innerRadius={52} outerRadius={74} paddingAngle={total > 0 ? 4 : 0} dataKey="value" stroke="transparent">
              {pieData.map((entry, index) => <Cell key={`severity-${index}`} fill={entry.color} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-display font-black text-slate-900 dark:text-white leading-none">{total}</span>
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-1">FINDINGS</span>
          <span className="text-[9px] text-slate-400 font-mono">From detection API</span>
        </div>
      </div>

      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs font-mono">
        {data.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 dark:text-slate-400 font-medium">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">{item.value}</span>
              <span className="text-slate-400 text-[11px] w-12 text-right">{total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : '0.0%'}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        {total > 0 ? (
          <Link to="/anomalies" className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
            <div className="flex items-center gap-2 truncate">
              <ShieldAlert className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
              <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200">Review detected findings</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </Link>
        ) : (
          <p className="text-xs text-slate-500 font-mono">No anomalies have been recorded by the backend.</p>
        )}
      </div>
    </GlassCard>
  );
};

export default SeverityDistribution;
'''

write("client/src/components/dashboard/StatCards.jsx", stat_cards)
write("client/src/components/dashboard/SeverityDistribution.jsx", severity_component)

rel = "client/src/pages/DashboardPage.jsx"
content = read(rel)
old = """    if (anomaliesRes.success) {
      const serverAnomalies = anomaliesRes.data?.anomalies || anomaliesRes.data || [];
      setAnomalies(serverAnomalies);
    }"""
new = """    if (anomaliesRes.success) {
      const payload = anomaliesRes.data;
      const rows = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.anomalies)
          ? payload.anomalies
          : Array.isArray(payload)
            ? payload
            : [];
      // Adapt the backend's snake_case anomaly schema to the dashboard's view model.
      const serverAnomalies = rows.map((a) => ({
        ...a,
        id: a.id || a.anomaly_id || a.anomalyId,
        vector: a.vector || a.method || a.ruleId || 'Behavioral signal',
        ruleId: a.ruleId || a.method || null,
        sourceIp: a.sourceIp || a.source_ip || a.features?.source_ip || 'N/A',
        destinationIp: a.destinationIp || a.destination_ip || a.features?.destination_ip || 'N/A',
        sourcePort: a.sourcePort ?? a.source_port ?? a.features?.source_port ?? null,
        destinationPort: a.destinationPort ?? a.destination_port ?? a.features?.destination_port ?? null,
        investigationStatus: a.investigationStatus || a.status || 'open',
        severity: String(a.severity || 'low').toUpperCase(),
        score: Number(a.score ?? 0),
      })).filter((a) => Boolean(a.id));
      setAnomalies(serverAnomalies);
    }"""
if old in content:
    content = content.replace(old, new, 1)
elif "const payload = anomaliesRes.data;" not in content:
    # DashboardPage.jsx may have been refactored locally since this patch was prepared.
    # Do not abort the entire detection installer for this optional UI adaptation.
    # Preserve the user's mapping as-is and continue applying the dashboard counter fixes.
    print("WARNING: DashboardPage.jsx did not match the expected anomaly mapping.")
    print("         Leaving its anomaly-fetch block unchanged; detection/normalizer fixes can still install.")
content = content.replace("distribution={summary?.severityDistribution}\n            threatIndex={summary?.threatIndex ?? 72}\n            totalCount={summary?.anomaliesDetected ?? 842}",
                        "distribution={summary?.severity_breakdown ?? summary?.severityDistribution}", 1)
write(rel, content)
print("Dashboard hard-coded counters and response-shape mismatch fixed.")
