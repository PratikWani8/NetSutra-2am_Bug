import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Activity,
  ShieldAlert,
  AlertTriangle,
  Bot,
  Settings,
  Shield,
  UserCheck,
  Terminal,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';

export const Sidebar = () => {
  const { latency, sensorStatus } = useSocket();

  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: 'LIVE',
      badgeColor: 'bg-blue-600 text-white',
    },
    {
      to: '/events',
      label: 'Network Events',
      icon: Activity,
      badge: '14.8M',
      badgeColor: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    },
    {
      to: '/anomalies',
      label: 'Anomalies',
      icon: ShieldAlert,
      badge: '842',
      badgeColor: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    },
    {
      to: '/incidents',
      label: 'Incidents',
      icon: AlertTriangle,
      badge: '4 CRIT',
      badgeColor: 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800',
    },
    {
      to: '/ai-provider',
      label: 'AI Provider',
      icon: Bot,
      isDot: true,
      dotColor: 'bg-emerald-500',
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
    },
    {
      to: '/security-dev',
      label: 'Security Dev Panel',
      icon: Terminal,
      badge: 'GEMMA',
      badgeColor: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800',
    },
  ];

  return (
    <aside className="w-64 shrink-0 flex flex-col justify-between h-full min-h-screen p-4 border-r border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl">
      {/* Top Brand Section */}
      <div className="space-y-5">
        <div className="flex items-center gap-3 px-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-extrabold text-base tracking-wider text-slate-900 dark:text-white">
                NETSUTRA
              </span>
            </div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-medium">
              SOC COMMAND CENTER V2.4
            </div>
          </div>
        </div>

        {/* Engine Mode Pill */}
        <div className="px-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-mono font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-slate-500 dark:text-slate-400">ENGINE:</span>
            <span>OPEN SOURCE SOC</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600/10 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300 shadow-2xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 opacity-80" />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
                {item.isDot && (
                  <span className={`w-2 h-2 rounded-full ${item.dotColor} animate-pulse`} />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Sensor Probe & User Section */}
      <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
        {/* Core Probe Status */}
        <div className="p-2.5 rounded-xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-500 dark:text-slate-400">CORE PROBE</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {sensorStatus.status || 'Online'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
            <span>{sensorStatus.probe || 'Probe v2.4.1'}</span>
            <span>{latency}ms ping</span>
          </div>
        </div>

        {/* Analyst Profile */}
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/60">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
              sec-op-402
            </div>
            <div className="text-[10px] text-slate-400 truncate">Senior SecOps Analyst</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
