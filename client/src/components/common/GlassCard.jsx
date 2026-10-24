import React from 'react';
import clsx from 'clsx';

export const GlassCard = ({
  children,
  className = '',
  hoverEffect = false,
  glow = null, // 'blue' | 'red' | 'emerald' | null
  onClick,
  id,
}) => {
  return (
    <div
      id={id}
      onClick={onClick}
      className={clsx(
        'relative rounded-2xl border transition-all duration-300',
        'bg-white/75 dark:bg-slate-900/75',
        'backdrop-blur-xl',
        'border-white/90 dark:border-slate-800/80',
        'shadow-[0_4px_24px_-2px_rgba(15,23,42,0.06),0_1px_2px_0_rgba(255,255,255,0.8)_inset]',
        'dark:shadow-[0_4px_24px_-2px_rgba(0,0,0,0.4),0_1px_1px_0_rgba(255,255,255,0.05)_inset]',
        hoverEffect && 'hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(15,23,42,0.1)] cursor-pointer',
        glow === 'blue' && 'shadow-glow-blue',
        glow === 'red' && 'shadow-glow-red',
        glow === 'emerald' && 'shadow-glow-emerald',
        className
      )}
    >
      {children}
    </div>
  );
};

export default GlassCard;
