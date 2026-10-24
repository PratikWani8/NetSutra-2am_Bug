import React from 'react';
import clsx from 'clsx';
import { Clock, Search, CheckCircle2, XCircle } from 'lucide-react';

export const StatusPill = ({ status = 'open', size = 'md', className = '' }) => {
  const norm = String(status || 'open').toLowerCase();

  const configs = {
    open: {
      label: 'Open',
      bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      icon: Clock,
      dot: 'bg-amber-500',
    },
    investigating: {
      label: 'Investigating',
      bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      icon: Search,
      dot: 'bg-blue-500 animate-pulse',
    },
    resolved: {
      label: 'Resolved',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      icon: CheckCircle2,
      dot: 'bg-emerald-500',
    },
    false_positive: {
      label: 'False Positive',
      bg: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      icon: XCircle,
      dot: 'bg-slate-400',
    },
  };

  const current = configs[norm] || configs.open;
  const IconComponent = current.icon;

  const sizes = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border shadow-2xs font-sans capitalize',
        current.bg,
        sizes[size] || sizes.md,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', current.dot)} />
      <span>{current.label}</span>
    </span>
  );
};

export default StatusPill;
