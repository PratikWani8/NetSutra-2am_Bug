import React, { useState } from 'react';
import { Server, Bot, RefreshCw, Radar, CheckCircle2, ShieldCheck, Cpu } from 'lucide-react';
import GlassCard from '../common/GlassCard';

export const LiveSystemHealth = ({ healthData, onRunProbe, onReloadCache }) => {
  const [isRunningProbe, setIsRunningProbe] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  const handleRunProbe = () => {
    setIsRunningProbe(true);
    setTimeout(() => {
      setIsRunningProbe(false);
      if (onRunProbe) onRunProbe();
    }, 1200);
  };

  const handleReloadCache = () => {
    setIsReloading(true);
    setTimeout(() => {
      setIsReloading(false);
      if (onReloadCache) onReloadCache();
    }, 800);
  };

  const nodes = healthData?.nodes || [
    { id: '1', name: 'Edge-Probe-US-East', uptime: '99.98%', eps: '1.2M EPS', status: 'Healthy' },
    { id: '2', name: 'Edge-Probe-EU-Central', uptime: '99.95%', eps: '890k EPS', status: 'Healthy' },
    { id: '3', name: 'Core-Tap-01 (Mirror)', uptime: '99.9%', eps: '100 Gbps TAP', status: '99.9%' },
  ];

  const ai = healthData?.aiModel || {
    provider: 'gemma-api',
    modelName: 'Gemma 2 Security Guard',
    latencyMs: 142,
    contextWindow: 32768,
    status: 'Warm',
    vramUsage: '18.2 / 24 GB',
    batchRate: '64 tokens/s',
  };

  return (
    <GlassCard className="p-5 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Live System & AI Health</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] font-bold">
            CLUSTERS OK
          </span>
        </div>

        {/* Section: Probe Ingestion Nodes */}
        <div className="space-y-2 mb-4">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
            PROBE INGESTION NODES
          </div>
          <div className="space-y-1.5">
            {nodes.map((node) => (
              <div
                key={node.id}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{node.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-[11px] hidden sm:inline">
                    {node.uptime} uptime · {node.eps}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100/80 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                    {node.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section: AI Provider & Local LLM */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
            AI PROVIDER & LOCAL LLM
          </div>
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-slate-900 dark:text-white">{ai.modelName}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-100/80 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                {ai.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
              <div>
                <span>Latency: </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{ai.latencyMs}ms</span>
              </div>
              <div>
                <span>Ctx Window: </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {ai.contextWindow.toLocaleString()}
                </span>
              </div>
              <div>
                <span>VRAM: </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{ai.vramUsage}</span>
              </div>
              <div>
                <span>Batch: </span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{ai.batchRate}</span>
              </div>
            </div>
          </div>

          {/* Classifier Status */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                Isolation Forest Classifier
              </span>
            </div>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              In sync · 42ms tree inference
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
        <button
          onClick={handleRunProbe}
          disabled={isRunningProbe}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
        >
          <Radar className={`w-3.5 h-3.5 text-blue-600 ${isRunningProbe ? 'animate-spin' : ''}`} />
          <span>{isRunningProbe ? 'Probing...' : 'Run Probe'}</span>
        </button>

        <button
          onClick={handleReloadCache}
          disabled={isReloading}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isReloading ? 'animate-spin' : ''}`} />
          <span>{isReloading ? 'Reloading...' : 'Reload Cache'}</span>
        </button>
      </div>
    </GlassCard>
  );
};

export default LiveSystemHealth;
