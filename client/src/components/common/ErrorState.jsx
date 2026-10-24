import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import GlassCard from './GlassCard';

export const ErrorState = ({
  title = 'Failed to Load Telemetry Data',
  message = 'Unable to fetch data from the NetSutra backend service.',
  onRetry,
}) => {
  return (
    <GlassCard className="p-8 text-center flex flex-col items-center justify-center border-rose-200 dark:border-rose-900/60">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-3 shadow-xs">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">{title}</h3>
      <p className="text-xs text-rose-800/80 dark:text-rose-300/80 max-w-sm mt-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Request</span>
        </button>
      )}
    </GlassCard>
  );
};

export default ErrorState;
