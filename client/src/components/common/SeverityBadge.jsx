import React from 'react';
import clsx from 'clsx';
import { AlertTriangle, ShieldAlert, AlertCircle, Info } from 'lucide-react';

export const SeverityBadge = ({ severity = 'LOW', size = 'md', showIcon = false, className = '' }) => {
  const norm = String(severity || 'LOW').toUpperCase();

  const configs = {
    CRITICAL: {
      label: 'CRITICAL',
      bg: 'bg-rose-50/90 dark:bg-rose-950/40',
      border: 'border-rose-200/90 dark:border-rose-800/60',
      text: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      icon: ShieldAlert,
    },
    HIGH: {
      label: 'HIGH',
      bg: 'bg-amber-50/90 dark:bg-amber-950/40',
      border: 'border-amber-200/90 dark:border-amber-800/60',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      icon: AlertTriangle,
    },
    MEDIUM: {
      label: 'MEDIUM',
      bg: 'bg-slate-100/90 dark:bg-slate-800/60',
      border: 'border-slate-300/80 dark:border-slate-700/60',
      text: 'text-slate-700 dark:text-slate-300',
      dot: 'bg-slate-400',
      icon: AlertCircle,
    },
    LOW: {
      label: 'LOW',
      bg: 'bg-blue-50/90 dark:bg-blue-950/40',
      border: 'border-blue-200/90 dark:border-blue-800/60',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500',
      icon: Info,
    },
  };

  const current = configs[norm] || configs.LOW;
  const IconComponent = current.icon;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 tracking-wider font-semibold',
    sm: 'text-xs px-2 py-0.5 tracking-wider font-semibold',
    md: 'text-xs px-2.5 py-1 tracking-wider font-semibold',
    lg: 'text-sm px-3.5 py-1.5 tracking-wider font-bold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border shadow-sm backdrop-blur-xs font-mono uppercase transition-colors',
        current.bg,
        current.border,
        current.text,
        sizeClasses[size] || sizeClasses.md,
        className
      )}
    >
      <span className={clsx('w-1.5 h-1.5 rounded-full', current.dot)} />
      {showIcon && <IconComponent className="w-3 h-3" />}
      <span>{current.label}</span>
    </span>
  );
};

export default SeverityBadge;
