import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  AlertTriangle,
  Server,
  Cloud,
  Save,
  ShieldCheck,
  RefreshCw,
  Lock,
  Terminal,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/common/GlassCard';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import netSutraApi from '../services/api';

export const AiSettingsPage = () => {
  const [currentProvider, setCurrentProvider] = useState('gemma-api');
  const [selectedProvider, setSelectedProvider] = useState('gemma-api');
  const [providersStatus, setProvidersStatus] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  const fetchProviderSettings = useCallback(async () => {
    setIsLoading(true);
    setFeedbackMessage(null);

    const [settingsRes, statusRes] = await Promise.all([
      netSutraApi.getAiProviderSettings(),
      netSutraApi.getAiProvidersStatus(),
    ]);

    if (settingsRes.success) {
      const active = settingsRes.data?.provider || 'gemma-api';
      setCurrentProvider(active);
      setSelectedProvider(active);
      setIsDemo(!!settingsRes.isDemo);
    }

    if (statusRes.success) {
      const raw = statusRes.data?.providers || statusRes.data;
      let list = [];
      if (Array.isArray(raw)) {
        list = raw.map((p) => ({
          ...p,
          id: p.id,
          available: p.available !== undefined ? Boolean(p.available) : p.status === 'available',
          status: p.status || (p.available ? 'available' : 'unavailable'),
        }));
      } else if (raw && typeof raw === 'object') {
        list = Object.entries(raw).map(([id, info]) => {
          const isAvail =
            typeof info === 'object' && info !== null
              ? (info.available !== undefined ? Boolean(info.available) : info.status === 'available')
              : Boolean(info);
          return {
            id,
            ...(typeof info === 'object' && info !== null ? info : {}),
            available: isAvail,
            status: isAvail ? 'available' : 'unavailable',
          };
        });
      }
      setProvidersStatus(list);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchProviderSettings();
  }, [fetchProviderSettings]);

  const getStatusInfo = (providerId) => {
    if (Array.isArray(providersStatus)) {
      return providersStatus.find((p) => p.id === providerId) || null;
    }
    if (providersStatus && typeof providersStatus === 'object') {
      const raw = providersStatus[providerId];
      if (raw) {
        return {
          id: providerId,
          ...raw,
          available: raw.available !== undefined ? Boolean(raw.available) : raw.status === 'available',
          status: raw.status || (raw.available ? 'available' : 'unavailable'),
        };
      }
    }
    return null;
  };

  const handleSaveProvider = async () => {
    setIsSaving(true);
    setFeedbackMessage(null);

    // Check availability of chosen provider
    const targetStatus = getStatusInfo(selectedProvider);
    if (targetStatus && (targetStatus.available === false || targetStatus.status === 'unavailable')) {
      setFeedbackMessage({
        type: 'error',
        text: `The selected AI provider (${selectedProvider}) is currently unavailable. As required, NetSutra does not switch automatically; you may proceed or select another provider.`,
      });
      setIsSaving(false);
      return;
    }

    const res = await netSutraApi.updateAiProviderSettings(selectedProvider);
    if (res.success) {
      setCurrentProvider(selectedProvider);
      setFeedbackMessage({
        type: 'success',
        text: `AI Provider updated successfully to "${selectedProvider}". Saved via PUT /api/settings/ai-provider.`,
      });
    } else {
      setFeedbackMessage({
        type: 'error',
        text: res.error?.message || 'Failed to update AI provider setting on the backend.',
      });
    }
    setIsSaving(false);
  };

  const providerConfigs = [
    {
      id: 'gemma-api',
      title: 'gemma-api (Google Gemma 2 API)',
      icon: Cloud,
      type: 'Cloud API',
      badge: 'Cloud Secure',
      description:
        'Hosted Gemma 2 model optimized for cybersecurity analysis, telemetry pattern correlation, and root cause explanation.',
      details: [
        'Context window: 32,768 tokens',
        'Average response latency: ~140ms',
        'Managed cloud inference with safety fine-tuning',
      ],
    },
    {
      id: 'ollama',
      title: 'ollama (Local Offline LLM Container)',
      icon: Server,
      type: 'Local LLM',
      badge: 'Air-Gapped / Zero-Egress',
      description:
        'Locally hosted model instance via Ollama container (e.g. Mistral or Llama 3) for zero external data egress and compliance with air-gapped environments.',
      details: [
        'Runs directly on local SOC host / cluster',
        'No external internet or cloud egress required',
        'Private forensic reasoning with local VRAM',
      ],
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Header
        title="AI Provider Settings"
        badge="LLM-ORCHESTRATION"
        subtitle="Configure the reasoning backend for autonomous telemetry triage and anomaly explanations"
        isDemo={isDemo}
      />

      <OfflineBanner onRetry={fetchProviderSettings} />

      {/* Strict Security Directive Box */}
      <div className="p-4 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800 text-blue-950 dark:text-blue-200 flex items-start gap-3 shadow-xs">
        <Lock className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold uppercase tracking-wider">
            SECURITY & CREDENTIAL INTEGRITY POLICY
          </div>
          <p className="opacity-90 leading-relaxed">
            In compliance with strict security requirements, API keys and credentials are never requested, stored, or processed in client-side code. All authentication keys must remain securely configured in the backend environment variables.
          </p>
        </div>
      </div>

      {/* Main Settings Card */}
      <GlassCard className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Select AI Reasoning Provider
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Choose between cloud-hosted Gemma 2 or on-premises local Ollama instance.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">CURRENT ACTIVE:</span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100/90 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 font-bold border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {currentProvider}
            </span>
          </div>
        </div>

        {/* Provider Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providerConfigs.map((cfg) => {
            const Icon = cfg.icon;
            const isSelected = selectedProvider === cfg.id;
            const isCurrent = currentProvider === cfg.id;
            const statusInfo = getStatusInfo(cfg.id);
            const isAvailable = statusInfo ? Boolean(statusInfo.available ?? (statusInfo.status === 'available')) : true;

            return (
              <div
                key={cfg.id}
                onClick={() => setSelectedProvider(cfg.id)}
                className={`relative p-5 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 shadow-md ring-2 ring-blue-500/20'
                    : 'border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {cfg.id}
                      </h3>
                      <span className="text-[11px] font-mono text-slate-400">{cfg.type}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
                        ACTIVE
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        isAvailable
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {isAvailable ? 'AVAILABLE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                  {cfg.description}
                </p>

                <ul className="space-y-1 text-xs font-mono text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  {cfg.details.map((d, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-slate-400" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-800 dark:text-rose-200'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Save Bar */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs font-mono text-slate-400">
            Selected Provider: <strong className="text-slate-800 dark:text-slate-200">{selectedProvider}</strong>
          </div>

          <button
            onClick={handleSaveProvider}
            disabled={isSaving || selectedProvider === currentProvider}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${
              selectedProvider !== currentProvider
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving through Backend...' : 'Save AI Provider Choice'}</span>
          </button>
        </div>
      </GlassCard>

      {/* Security Dev Panel Below Settings */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 text-white shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-indigo-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shrink-0">
              <Terminal className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Security Dev Panel</h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] font-mono font-semibold border border-indigo-400/30">
                  GEMMA-TELEMETRY-LAB
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Developer diagnostics & verified alert findings generated by Gemma AI.
              </p>
            </div>
          </div>

          <Link
            to="/security-dev"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all whitespace-nowrap self-end sm:self-auto"
          >
            <span>Open Full Dev Panel</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Quick Sample Alerts Evaluated by Gemma */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sample Alert 1 */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-400">ANOM-8921</span>
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] font-mono font-bold">
                CRITICAL (0.96)
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-200">
              DNS Tunneling Base64 Exfiltration
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              10.244.18.91:53218 → 198.51.100.4:53 (UDP)
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Gemma Assessment</span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2">
                Active covert data exfiltration detected originating from internal pod. High Shannon entropy (7.84 bits) confirms structured Base64 chunking.
              </p>
            </div>
          </div>

          {/* Sample Alert 2 */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-400">ANOM-8920</span>
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 text-[10px] font-mono font-bold">
                CRITICAL (0.94)
              </span>
            </div>
            <div className="text-xs font-semibold text-slate-200">
              TCP SYN Flood DDoS Burst
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              192.168.10.45:443 → 172.16.8.12:443 (TCP)
            </div>
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Gemma Assessment</span>
              </div>
              <p className="text-[11px] text-slate-300 line-clamp-2">
                Volumetric denial-of-service condition observed against reverse proxy. Asymmetric SYN-to-ACK ratio (28.4:1) with static 0-byte window.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiSettingsPage;
