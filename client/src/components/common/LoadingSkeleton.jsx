import React from 'react';
import GlassCard from './GlassCard';

export const LoadingSkeleton = ({ type = 'cards' }) => {
  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <GlassCard key={i} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-5 w-5 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
            <div className="h-8 w-36 bg-slate-200 dark:bg-slate-800 rounded mb-3" />
            <div className="h-3 w-44 bg-slate-200 dark:bg-slate-800 rounded" />
          </GlassCard>
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <GlassCard className="p-5 animate-pulse h-80 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-6 w-36 bg-slate-200 dark:bg-slate-800 rounded-full" />
        </div>
        <div className="h-48 w-full bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
        <div className="flex gap-4">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6 animate-pulse">
      <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded-lg" />
        ))}
      </div>
    </GlassCard>
  );
};

export default LoadingSkeleton;
