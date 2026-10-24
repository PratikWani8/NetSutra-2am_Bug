import React from 'react';
import { WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

export const OfflineBanner = ({ onRetry, isOffline = false }) => {
  const { connectionStatus, reconnect } = useSocket();

  if (!isOffline && connectionStatus === 'connected') {
    return null;
  }

  const handleRetry = () => {
    reconnect();
    if (onRetry) onRetry();
  };

  return (
    <div className="mb-4 rounded-xl border border-amber-300/80 bg-amber-50/90 dark:bg-amber-950/40 dark:border-amber-700/60 p-3.5 backdrop-blur-md shadow-sm transition-all">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0">
            <WifiOff className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <span>Backend Disconnected / Live Telemetry Paused</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-200/70 dark:bg-amber-900 text-amber-800 dark:text-amber-300">
                http://localhost:5000
              </span>
            </div>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              NetSutra is running in offline resilient mode. Real-time Socket.IO events and live database sync will resume automatically once the backend service starts.
            </p>
          </div>
        </div>

        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-xs transition-colors shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
