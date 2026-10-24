import React from 'react';
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
