import React from 'react';
import { Activity, Zap, ClipboardList, ShieldAlert } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { formatNumber } from '../../utils/formatters';

const numericCount = (value) => {
  if (value && typeof value === 'object') value = value.count;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const StatCards = ({ summary = {} }) => {
  const severity = summary?.severity_breakdown ?? summary?.severityBreakdown ?? {};
  const totalEvents = numericCount(summary?.total_events ?? summary?.totalEvents);
  const anomaliesCount = numericCount(summary?.total_anomalies ?? summary?.anomaliesDetected);
  const openIncidents = numericCount(summary?.active_incidents ?? summary?.openIncidents ?? summary?.activeIncidents);
  const elevatedAnomalies = numericCount(severity.critical) + numericCount(severity.high);

  const cards = [
    { label: 'TOTAL NETWORK EVENTS', value: totalEvents, detail: 'Persisted telemetry events', icon: Activity, tone: 'blue' },
    { label: 'ANOMALIES DETECTED', value: anomaliesCount, detail: 'Persisted detector findings', icon: Zap, tone: 'amber' },
    { label: 'ACTIVE INCIDENTS', value: openIncidents, detail: 'Open incidents from correlation', icon: ClipboardList, tone: 'indigo' },
    { label: 'HIGH / CRITICAL FINDINGS', value: elevatedAnomalies, detail: 'High plus critical severity anomalies', icon: ShieldAlert, tone: 'rose' },
  ];
  const tones = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60',
    indigo: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60',
    rose: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60',
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <GlassCard key={card.label} className="p-5 flex flex-col justify-between min-h-[140px]">
            <div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">{card.label}</span>
                <div className={`w-7 h-7 rounded-md flex items-center justify-center ${tones[card.tone]}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white tracking-tight">
                {formatNumber(card.value)}
              </div>
            </div>
            <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              {card.detail}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
};

export default StatCards;
