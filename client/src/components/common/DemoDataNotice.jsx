import React from 'react';
import { Database, AlertTriangle } from 'lucide-react';

export const DemoDataNotice = ({ isDemo = false, context = 'telemetry' }) => {
  if (!isDemo) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-300/80 bg-amber-50/90 dark:bg-amber-950/50 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] font-mono shadow-2xs backdrop-blur-xs">
      <Database className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      <span className="font-semibold uppercase tracking-wider">DEMO DATA</span>
      <span className="opacity-75 hidden sm:inline">· Backend Offline Fallback</span>
    </div>
  );
};

export default DemoDataNotice;
