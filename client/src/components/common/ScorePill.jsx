import React from 'react';
import clsx from 'clsx';

export const ScorePill = ({ score, size = 'md', className = '' }) => {
  if (score === null || score === undefined) {
    return <span className="text-xs text-slate-400 font-mono">Unavailable</span>;
  }

  const val = typeof score === 'number' ? score : parseFloat(score);

  let style = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  if (val >= 0.9) {
    style = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
  } else if (val >= 0.7) {
    style = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  } else if (val >= 0.5) {
    style = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  } else {
    style = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
  }

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-0.5 font-semibold',
    lg: 'text-sm px-3.5 py-1 font-bold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center font-mono rounded-md border shadow-xs',
        style,
        sizes[size] || sizes.md,
        className
      )}
    >
      {val.toFixed(2)}
    </span>
  );
};

export default ScorePill;
