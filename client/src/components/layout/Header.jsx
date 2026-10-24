import React, { useState, useEffect } from 'react';
import { Search, Bell, Download, Moon, Sun, Radio, Activity, RefreshCw } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { usePrototype } from '../../context/PrototypeContext';
import DemoDataNotice from '../common/DemoDataNotice';

export const Header = ({
  title = 'Security Overview',
  badge = 'NET-ANOMALY-01',
  subtitle = 'Autonomous Network Anomaly Detection & Telemetry',
  onOpenSearch,
  onExportReport,
  isDemo = false,
}) => {
  const { connectionStatus, latency } = useSocket();
  const { isDarkMode, toggleDarkMode } = usePrototype();
  const [activeRange, setActiveRange] = useState('24h');
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${h}:${m}:${s} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const ranges = ['1h', '6h', '24h', '7d'];

  return (
    <header className="mb-6 space-y-3">
      {/* Top micro metadata bar from screenshot */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800/80 pb-2 gap-2">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-blue-100/70 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-semibold uppercase text-[10px]">
            LAYER NOTE
          </span>
          <span className="truncate max-w-xl text-slate-600 dark:text-slate-400">
            Implementation stack: React + Vite, Tailwind CSS, Recharts, Lucide Icons, Socket.IO, Framer Motion
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span>LATENCY:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{latency}ms</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>SOC-NODE:</span>
            <span className="text-slate-700 dark:text-slate-200 font-bold">us-east-tap-04</span>
          </div>
        </div>
      </div>

      {/* Main Title & Action Bar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Title & Badge */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            {badge && (
              <span className="px-2 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium">
                {badge}
              </span>
            )}
            {isDemo && <DemoDataNotice isDemo={true} />}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Controls & Tools */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Quick Search Shortcut */}
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs shadow-2xs backdrop-blur-md transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search IP, CIDR, hash</span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              ⌘K
            </span>
          </button>

          {/* Live Telemetry Indicator */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-2xs backdrop-blur-md">
            <div className="relative flex items-center justify-center">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-500'
                    : connectionStatus === 'connecting'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
              />
              {connectionStatus === 'connected' && (
                <span className="absolute w-3.5 h-3.5 rounded-full bg-emerald-500/40 animate-ping" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold tracking-wider font-mono uppercase text-slate-700 dark:text-slate-300">
                LIVE TELEMETRY
              </span>
              <span className="text-[9px] text-slate-400 font-mono">
                {connectionStatus === 'connected' ? '(Socket.IO)' : '(Offline)'}
              </span>
            </div>
          </div>

          {/* Sync Timestamp */}
          <div className="hidden xl:flex flex-col text-right font-mono text-[11px] px-2 py-0.5 text-slate-500 dark:text-slate-400">
            <span className="text-[9px] text-slate-400 uppercase">Sync:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{utcTime}</span>
          </div>

          {/* Time range selector */}
          <div className="flex items-center rounded-xl bg-slate-200/60 dark:bg-slate-800/80 p-0.5 border border-slate-300/40 dark:border-slate-700/60">
            {ranges.map((range) => (
              <button
                key={range}
                onClick={() => setActiveRange(range)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activeRange === range
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Notifications bell */}
          <button
            className="relative p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors cursor-pointer"
            title="Active Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-slate-900">
              3
            </span>
          </button>

          {/* Dark/Light mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-2xs transition-colors cursor-pointer"
            title={isDarkMode ? 'Switch to Light Glassmorphism' : 'Switch to Dark Cyber'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Export Report CTA */}
          <button
            onClick={onExportReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
