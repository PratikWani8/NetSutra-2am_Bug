import React, { useState } from 'react';
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Shield,
  FileText,
  Server,
  Cloud,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import GlassCard from '../common/GlassCard';
import SeverityBadge from '../common/SeverityBadge';
import ScorePill from '../common/ScorePill';

export const AiInvestigationModal = ({
  isOpen,
  onClose,
  anomaly,
  investigationData,
  isLoading,
  error,
  activeProvider = 'gemma-api',
  onSwitchProvider,
  onRetry,
}) => {
  const [showTelemetryBaseline, setShowTelemetryBaseline] = useState(false);

  if (!isOpen) return null;

  const rawExp =
    investigationData?.explanation ||
    (investigationData?.summary ? investigationData : null);

  const explanation = rawExp
    ? {
        summary: rawExp.summary || 'Statistical telemetry analysis completed.',
        observedEvidence: rawExp.observedEvidence || rawExp.observed_evidence || [],
        possibleExplanations: rawExp.possibleExplanations || rawExp.possible_explanations || [],
        recommendedChecks: rawExp.recommendedChecks || rawExp.recommended_checks || [],
        uncertaintiesAndLimitations: rawExp.uncertaintiesAndLimitations || rawExp.uncertainties || [],
      }
    : null;

  const currentProviderId = investigationData?.provider || activeProvider || 'gemma-api';
  const otherProviderId = currentProviderId === 'ollama' ? 'gemma-api' : 'ollama';

  const errMessage = typeof error === 'string' ? error : error?.message || '';
  const isOllamaError =
    errMessage.toLowerCase().includes('ollama') ||
    currentProviderId === 'ollama' ||
    error?.code === 'OLLAMA_ERROR';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-white/80 dark:border-slate-800 shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  AI Root Cause Investigation
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {anomaly?.id || anomaly?.anomaly_id || 'ANOMALY'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Target Provider: <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{currentProviderId}</span> · Non-binding statistical analysis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm">
          {/* Critical Safety Notice (Mandatory Requirement) */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold uppercase tracking-wide">
                Safety Disclaimer & Operational Guidance
              </div>
              <p className="opacity-90 leading-relaxed">
                Anomalies and AI explanations represent probabilistic statistical deviations from baseline behavior, not confirmed malicious attacks or incidents. Always corroborate these findings with network logs, process telemetry, and authorized analyst verification before initiating containment.
              </p>
            </div>
          </div>

          {/* Provider Specific Error with Manual Switching Action */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-mono space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Provider Failure: {isOllamaError ? 'Ollama (Local LLM)' : 'Gemma API (Cloud)'} [{typeof error === 'string' ? 'PROVIDER_ERROR' : error.code || '502'}]
                  </span>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                  No Auto-Fallback Applied
                </span>
              </div>

              <p className="leading-relaxed text-slate-800 dark:text-slate-200">
                {errMessage || 'The selected AI provider encountered a communication or configuration failure.'}
              </p>

              {/* Actionable Guidance per provider */}
              <div className="p-2.5 rounded-lg bg-white/70 dark:bg-slate-900/70 text-[11px] text-slate-700 dark:text-slate-300 space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">Actionable Diagnostics:</div>
                {isOllamaError ? (
                  <p>
                    • Ensure the local Ollama daemon is running: <code>ollama serve</code><br />
                    • Verify the configured model is installed: <code>ollama pull gemma2</code><br />
                    • Check connection to <code>http://localhost:11434</code>.
                  </p>
                ) : (
                  <p>
                    • Verify that <code>GEMMA_API_KEY</code> is configured in <code>ai-service/.env</code>.<br />
                    • Check that your Google AI Studio API key has quota and valid permissions.<br />
                    • If operating in an air-gapped environment, switch to local Ollama.
                  </p>
                )}
              </div>

              {/* Action Buttons to Switch Provider or Retry */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                {onSwitchProvider && (
                  <button
                    onClick={() => onSwitchProvider(otherProviderId)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    {otherProviderId === 'ollama' ? <Server className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                    <span>Switch to {otherProviderId === 'ollama' ? 'Local Ollama' : 'Gemma API (Cloud)'}</span>
                  </button>
                )}

                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Provider</span>
                  </button>
                )}

                <Link
                  to="/settings/ai"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 text-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Configure Providers in Settings</span>
                </Link>

                <button
                  onClick={() => setShowTelemetryBaseline(!showTelemetryBaseline)}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  <span>{showTelemetryBaseline ? 'Hide' : 'View'} Grounded Telemetry Baseline</span>
                  {showTelemetryBaseline ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Collapsible Telemetry Baseline view */}
              {showTelemetryBaseline && (
                <div className="mt-3 p-3 rounded-lg bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5">
                  <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[10px]">
                    Preserved Incident Telemetry & Evidence (Offline Safe)
                  </div>
                  <div><strong>Anomaly ID:</strong> {anomaly?.id || anomaly?.anomaly_id || 'N/A'}</div>
                  <div><strong>Detection Method:</strong> {anomaly?.method || anomaly?.vector || 'Behavioral Analysis'}</div>
                  <div><strong>Confidence Score:</strong> {anomaly?.score || 'N/A'} ({anomaly?.severity || 'MEDIUM'})</div>
                  <div><strong>Endpoints:</strong> {anomaly?.source_ip || anomaly?.sourceIp || 'Source'} → {anomaly?.destination_ip || anomaly?.destinationIp || 'Destination'}</div>
                  {anomaly?.reasons && anomaly.reasons.length > 0 && (
                    <div>
                      <strong>Reasons:</strong>
                      <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                        {anomaly.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Synthesizing Telemetry Vectors & Baseline Metrics...
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Querying configured AI provider for correlation analysis
              </p>
            </div>
          ) : !explanation ? (
            <div className="py-12 text-center text-slate-500">
              No AI investigation available yet. Click "Investigate with AI" to generate an assessment.
            </div>
          ) : (
            <div className="space-y-5">
              {/* 1. Summary */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>1. Investigation Summary</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 text-xs sm:text-sm leading-relaxed">
                  {explanation.summary}
                </div>
              </div>

              {/* 2. Observed Evidence */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>2. Observed Evidence</span>
                </div>
                <ul className="space-y-1.5">
                  {(explanation.observedEvidence || []).map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 3. Possible Explanations */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                  <span>3. Possible Explanations</span>
                </div>
                <ul className="space-y-1.5">
                  {(explanation.possibleExplanations || []).map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 4. Recommended Checks */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  <Shield className="w-3.5 h-3.5 text-blue-600" />
                  <span>4. Recommended Forensic Checks</span>
                </div>
                <ul className="space-y-1.5">
                  {(explanation.recommendedChecks || []).map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 5. Uncertainties and Limitations */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>5. Uncertainties & Limitations</span>
                </div>
                <ul className="space-y-1.5">
                  {(explanation.uncertaintiesAndLimitations || []).map((item, idx) => (
                    <li
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 font-mono text-[11px]"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/60">
          <div className="text-xs font-mono text-slate-400">
            {investigationData?.generatedAt ? `Generated at ${investigationData.generatedAt}` : ''}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiInvestigationModal;
