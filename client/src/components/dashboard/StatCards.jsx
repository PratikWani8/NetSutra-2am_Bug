import React from 'react';
import { Activity, Zap, ClipboardList, ShieldAlert, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { formatNumber } from '../../utils/formatters';

export const StatCards = ({ summary = {} }) => {
  const totalEvents = summary?.totalEvents ?? 14892410;
  const anomaliesCount = summary?.anomaliesDetected ?? 842;
  const openIncidents = summary?.openIncidents ?? 29;
  const criticalIncidents = summary?.criticalIncidents ?? 4;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Network Events */}
      <GlassCard className="p-5 flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              TOTAL NETWORK EVENTS
            </span>
            <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatNumber(totalEvents)}
            </span>
            <span className="inline-flex items-center text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +12.4%
            </span>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>Throughput: ~172.4 Gbps</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">vs 24h baseline</span>
        </div>
      </GlassCard>

      {/* 2. Anomalies Detected */}
      <GlassCard className="p-5 flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              ANOMALIES DETECTED
            </span>
            <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatNumber(anomaliesCount)}
            </span>
            <span className="inline-flex items-center text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              +5.8% spikes
            </span>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>Entropy confidence</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">94.2% ML score</span>
        </div>
      </GlassCard>

      {/* 3. Open Incidents */}
      <GlassCard className="p-5 flex flex-col justify-between group">
        <div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">
              OPEN INCIDENTS
            </span>
            <div className="w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ClipboardList className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              {formatNumber(openIncidents)}
            </span>
            <span className="inline-flex items-center text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <ArrowDownRight className="w-3.5 h-3.5" />
              -3 resolved
            </span>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>Requires triage:</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">Past 2 hours: 6</span>
        </div>
      </GlassCard>

      {/* 4. Critical Incidents */}
      <GlassCard className="p-5 flex flex-col justify-between group border-rose-200/80 dark:border-rose-900/40">
        <div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
              CRITICAL INCIDENTS
            </span>
            <div className="w-6 h-6 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline gap-2.5">
            <span className="text-2xl sm:text-3xl font-display font-extrabold text-rose-600 dark:text-rose-400 tracking-tight">
              {formatNumber(criticalIncidents)}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-100/90 dark:bg-rose-950/80 text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300">
              +1 uncontained
            </span>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
          <span className="text-rose-700 dark:text-rose-400 font-semibold">Containment Action Req.</span>
          <span className="text-slate-700 dark:text-slate-300 font-medium">4 Active Hosts</span>
        </div>
      </GlassCard>
    </div>
  );
};

export default StatCards;
