import React from 'react';
import GlassCard from '../common/GlassCard';
import SeverityBadge from '../common/SeverityBadge';
import ScorePill from '../common/ScorePill';

export const ComponentKitBar = () => {
  return (
    <GlassCard className="p-4 mt-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-600" />
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200">
              SOC Component Kit & Status Badge Registry
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Design system token standards for automated telemetry categorization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs font-mono">
          {/* Severity Tokens */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase">SEVERITY:</span>
            <SeverityBadge severity="CRITICAL" size="xs" />
            <SeverityBadge severity="HIGH" size="xs" />
            <SeverityBadge severity="MEDIUM" size="xs" />
            <SeverityBadge severity="LOW" size="xs" />
          </div>

          {/* Score Range Pills */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase">SCORES:</span>
            <ScorePill score={0.24} size="sm" />
            <ScorePill score={0.58} size="sm" />
            <ScorePill score={0.96} size="sm" />
          </div>

          {/* Action Hierarchy */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase">ACTIONS:</span>
            <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[10px] font-bold">
              Mitigate
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold">
              Inspect
            </span>
            <span className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
              Drop
            </span>
          </div>

          {/* Stream Telemetry */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-800 pl-4">
            <span>BUFFER: <strong className="text-slate-800 dark:text-slate-200">0.4%</strong></span>
            <span>DROPS: <strong className="text-emerald-600">0</strong></span>
            <span>SYNC: <strong className="text-emerald-600">OK</strong></span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default ComponentKitBar;
