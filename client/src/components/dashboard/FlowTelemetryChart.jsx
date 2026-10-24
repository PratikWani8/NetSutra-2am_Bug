import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Activity, ShieldAlert } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import { DEMO_TELEMETRY } from '../../data/mockData';

export const FlowTelemetryChart = ({ data = DEMO_TELEMETRY }) => {
  const [selectedProtocol, setSelectedProtocol] = useState('ALL');

  const protocols = [
    { id: 'ALL', label: 'All Protocols' },
    { id: 'TCP', label: 'TCP/SYN' },
    { id: 'UDP', label: 'UDP Flood' },
    { id: 'DNS', label: 'DNS Tunnel' },
  ];

  // Adjust telemetry series based on selected protocol
  const chartData = (data || DEMO_TELEMETRY).map((item) => {
    if (selectedProtocol === 'TCP') {
      return { ...item, displayInbound: item.tcpSyn * 2, displayOutbound: item.tcpSyn * 1.2 };
    }
    if (selectedProtocol === 'UDP') {
      return { ...item, displayInbound: item.udpFlood * 4, displayOutbound: item.udpFlood * 2.5 };
    }
    if (selectedProtocol === 'DNS') {
      return { ...item, displayInbound: item.dnsTunnel * 8, displayOutbound: item.dnsTunnel * 5 };
    }
    return { ...item, displayInbound: item.inbound, displayOutbound: item.outbound };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="p-3 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-xl backdrop-blur-md text-xs font-mono">
          <div className="font-bold text-slate-800 dark:text-slate-100 mb-1.5 flex items-center justify-between gap-4">
            <span>{label} UTC</span>
            {payload[0]?.payload?.label && (
              <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                {payload[0].payload.label}
              </span>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 text-blue-600 dark:text-blue-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                Inbound:
              </span>
              <span className="font-bold">{payload[0].value} Gbps</span>
            </div>
            <div className="flex items-center justify-between gap-4 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Outbound:
              </span>
              <span className="font-bold">{payload[1]?.value} Gbps</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <GlassCard className="p-5 flex flex-col justify-between">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Network Activity & Flow Telemetry
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Inbound (Blue) vs Outbound (Slate) Throughput (Gbps)
          </p>
        </div>

        {/* Protocol filter tabs */}
        <div className="flex items-center rounded-xl bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200/60 dark:border-slate-700/60 text-xs font-mono">
          {protocols.map((proto) => (
            <button
              key={proto.id}
              onClick={() => setSelectedProtocol(proto.id)}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                selectedProtocol === proto.id
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {proto.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Container */}
      <div className="h-64 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="inboundGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="outboundGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#64748b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#64748b" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.15)" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#94a3b8"
              fontSize={11}
              fontFamily="JetBrains Mono"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#94a3b8"
              fontSize={11}
              fontFamily="JetBrains Mono"
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${val}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="displayInbound"
              stroke="#2563eb"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#inboundGradient)"
            />
            <Area
              type="monotone"
              dataKey="displayOutbound"
              stroke="#64748b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#outboundGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom telemetry indicators from screenshot */}
      <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
            TOTAL INSPECTED VOLUME
          </span>
          <span className="font-extrabold text-slate-900 dark:text-white text-sm">4.2 TB</span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
            PACKET INSPECTION RATE
          </span>
          <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
            124,190 pkts/sec
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
            PACKET LOSS / DROPS
          </span>
          <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
            0.00% (Zero Drops)
          </span>
        </div>
      </div>
    </GlassCard>
  );
};

export default FlowTelemetryChart;
