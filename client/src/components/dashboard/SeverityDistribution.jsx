import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PieChart as PieIcon, ShieldAlert, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import GlassCard from '../common/GlassCard';

export const SeverityDistribution = ({ distribution, threatIndex = 72, totalCount = 84 }) => {
  const data = [
    { name: 'Critical', value: distribution?.critical?.count || 4, color: '#ef4444', percent: '4.8%' },
    { name: 'High', value: distribution?.high?.count || 18, color: '#f59e0b', percent: '21.4%' },
    { name: 'Medium', value: distribution?.medium?.count || 36, color: '#64748b', percent: '42.8%' },
    { name: 'Low', value: distribution?.low?.count || 26, color: '#3b82f6', percent: '31.0%' },
  ];

  return (
    <GlassCard className="p-5 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PieIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Severity Distribution</h2>
        </div>
        <span className="font-mono text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
          TOTAL: {totalCount} ANOMALIES
        </span>
      </div>

      {/* Donut Chart with Center Metric */}
      <div className="relative h-44 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={52}
              outerRadius={74}
              paddingAngle={4}
              dataKey="value"
              stroke="transparent"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-display font-black text-slate-900 dark:text-white leading-none">
            {threatIndex}
          </span>
          <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mt-1">
            ELEVATED
          </span>
          <span className="text-[9px] text-slate-400 font-mono">Threat Index</span>
        </div>
      </div>

      {/* Legend list */}
      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs font-mono">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-slate-600 dark:text-slate-400 font-medium">{item.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white">{item.value}</span>
              <span className="text-slate-400 text-[11px] w-12 text-right">{item.percent}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recommended Action Pill */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <Link
          to="/incidents"
          className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 hover:bg-rose-100/70 transition-colors group"
        >
          <div className="flex items-center gap-2 truncate">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <div className="text-[11px] font-mono truncate">
              <span className="text-slate-500 dark:text-slate-400">Recommended Action: </span>
              <span className="font-bold text-rose-700 dark:text-rose-300">Triage Critical CIDR Block</span>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-rose-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </Link>
      </div>
    </GlassCard>
  );
};

export default SeverityDistribution;
