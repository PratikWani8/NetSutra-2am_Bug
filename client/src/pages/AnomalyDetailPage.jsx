import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldAlert,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Shield,
  FileText,
  Activity,
  Layers,
  Clock,
  Network,
  ExternalLink,
} from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/common/GlassCard';
import SeverityBadge from '../components/common/SeverityBadge';
import ScorePill from '../components/common/ScorePill';
import StatusPill from '../components/common/StatusPill';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import netSutraApi from '../services/api';
import {
  formatFullUtc,
  formatUtcTime,
  formatIpPort,
} from '../utils/formatters';

export const AnomalyDetailPage = () => {
  const { id } = useParams();
  const [anomaly, setAnomaly] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  // AI investigation state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [aiError, setAiError] = useState(null);

  const fetchAnomaly = useCallback(async () => {
    if (!id || id === 'undefined') {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const res = await netSutraApi.getAnomalyById(id);
    if (res.success) {
      setAnomaly(res.data);
      setIsDemo(!!res.isDemo);
      if (res.data?.aiInvestigation) {
        setAiData({ explanation: res.data.aiInvestigation });
      }
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchAnomaly();
  }, [fetchAnomaly]);

  const handleInvestigateWithAi = async (overrideProvider) => {
    const targetId = anomaly?.id || anomaly?.anomaly_id || id;
    if (!targetId || targetId === 'undefined') return;
    setIsAiLoading(true);
    setAiError(null);
    const res = await netSutraApi.investigateAnomaly(targetId, overrideProvider);
    if (res.success && res.data) {
      setAiData(res.data);
    } else {
      setAiError(res.error || { message: 'Failed to complete AI investigation.' });
    }
    setIsAiLoading(false);
  };

  if (isLoading && !anomaly) {
    return (
      <div className="space-y-6">
        <Header title="Anomaly Forensic Inspection" />
        <LoadingSkeleton type="table" />
      </div>
    );
  }

  if (!id || id === 'undefined') {
    return (
      <div className="space-y-6">
        <Header title="Anomaly Forensic Inspection" />
        <GlassCard className="p-8 text-center text-slate-500 space-y-4">
          <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Specific Anomaly Identifier Specified
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The URL did not contain a valid anomaly record ID. Please select an anomaly from the directory to review its forensic telemetry.
          </p>
          <div>
            <Link
              to="/anomalies"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Anomalies Directory</span>
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (!anomaly) {
    return (
      <div className="space-y-6">
        <Header title="Anomaly Forensic Inspection" />
        <GlassCard className="p-8 text-center text-slate-500 space-y-4">
          <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Anomaly record <span className="font-mono font-bold text-blue-600">{id}</span> could not be located on the NetSutra backend.
          </p>
          <div>
            <Link
              to="/anomalies"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Anomalies Directory</span>
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  const anomId = anomaly.id || anomaly.anomaly_id || id;
  const vector = anomaly.vector || anomaly.method || (anomaly.reasons && anomaly.reasons[0]) || 'Network Anomaly';
  const ruleId = anomaly.ruleId || anomaly.rule_id || anomaly.method || 'ANOM-RULE';
  const rawSrc = anomaly.sourceIp || anomaly.source_ip || anomaly.features?.source_ip || anomaly.features?.['id.orig_h'] || anomaly.features?.src_ip || anomaly.evidence?.[0]?.source_ip || anomaly.evidence?.[0]?.['id.orig_h'];
  const srcIp = rawSrc && rawSrc !== 'N/A' && rawSrc !== 'undefined' ? rawSrc : (anomaly.source_ip && anomaly.source_ip !== 'N/A' ? anomaly.source_ip : 'N/A');
  const srcPort = anomaly.sourcePort ?? anomaly.source_port ?? anomaly.features?.source_port ?? anomaly.features?.['id.orig_p'] ?? anomaly.evidence?.[0]?.source_port ?? null;
  const rawDst = anomaly.destinationIp || anomaly.destination_ip || anomaly.features?.destination_ip || anomaly.features?.['id.resp_h'] || anomaly.features?.dest_ip || anomaly.evidence?.[0]?.destination_ip || anomaly.evidence?.[0]?.['id.resp_h'];
  const dstIp = rawDst && rawDst !== 'N/A' && rawDst !== 'undefined' ? rawDst : (anomaly.destination_ip && anomaly.destination_ip !== 'N/A' ? anomaly.destination_ip : 'N/A');
  const dstPort = anomaly.destinationPort ?? anomaly.destination_port ?? anomaly.features?.destination_port ?? anomaly.features?.['id.resp_p'] ?? anomaly.evidence?.[0]?.destination_port ?? null;
  const status = anomaly.investigationStatus || anomaly.status || 'open';
  const detectionMethod = anomaly.detectionMethod || anomaly.method || 'Isolation Forest Multi-vector Analysis';
  const supportingEventIds = anomaly.supportingEventIds || anomaly.evidence_event_ids || [];
  const relatedIncidents = anomaly.relatedIncidents || (anomaly.incident_id ? [anomaly.incident_id] : []);
  const measuredFeatures = anomaly.measuredFeatures || [];
  const rawExp = aiData?.explanation || (aiData?.summary ? aiData : null);
  const explanation = rawExp ? {
    summary: rawExp.summary || 'Statistical telemetry analysis completed.',
    observedEvidence: rawExp.observedEvidence || rawExp.observed_evidence || [],
    possibleExplanations: rawExp.possibleExplanations || rawExp.possible_explanations || [],
    recommendedChecks: rawExp.recommendedChecks || rawExp.recommended_checks || [],
    uncertaintiesAndLimitations: rawExp.uncertaintiesAndLimitations || rawExp.uncertainties || [],
  } : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top navigation & Header */}
      <div className="flex items-center gap-3">
        <Link
          to="/anomalies"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Anomalies</span>
        </Link>
      </div>

      <Header
        title={`Anomaly Forensic: ${anomId}`}
        badge={ruleId}
        subtitle={vector}
        isDemo={isDemo}
      />

      <OfflineBanner onRetry={fetchAnomaly} />

      {/* Mandatory Safety Requirement Alert */}
      <div className="p-4 rounded-2xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-bold uppercase tracking-wider">
            SAFETY DIRECTIVE: NON-CONFIRMATORY TELEMETRY NOTICE
          </div>
          <p className="opacity-90 leading-relaxed">
            Never present an anomaly as confirmed malicious activity solely because it received a high score or an AI explanation. High statistical scores indicate mathematical deviation from baseline models and necessitate analyst triage and validation before containment.
          </p>
        </div>
      </div>

      {/* Anomaly Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Context & Metadata */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {vector}
                  </h2>
                  <div className="text-xs font-mono text-slate-400">
                    Rule ID: {ruleId}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SeverityBadge severity={anomaly.severity} size="sm" showIcon={true} />
                <ScorePill score={anomaly.score} size="md" />
                <StatusPill status={status} size="sm" />
              </div>
            </div>

            {/* Source & Destination Context */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  SOURCE CONTEXT
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatIpPort(srcIp, srcPort)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Originating Endpoint · Flow Initiator
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  DESTINATION CONTEXT
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatIpPort(dstIp, dstPort)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Target Endpoint · Port {dstPort || 'N/A'}
                </div>
              </div>
            </div>

            {/* Detection Method & Timestamps */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  DETECTION METHOD
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {detectionMethod}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  TIMESTAMP (UTC)
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatFullUtc(anomaly.timestamp)}
                </span>
              </div>
            </div>

            {/* Flagged Reasons */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">
                REASONS THE BEHAVIOR WAS FLAGGED
              </span>
              <ul className="space-y-1.5">
                {(anomaly.reasons || []).map((reason, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>

          {/* Measured Features vs Baseline Comparisons Table */}
          <GlassCard className="p-6">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Measured Features & Baseline Comparisons</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="pb-2 font-semibold">MEASURED FEATURE</th>
                    <th className="pb-2 font-semibold">OBSERVED VALUE</th>
                    <th className="pb-2 font-semibold">BASELINE BENCHMARK</th>
                    <th className="pb-2 font-semibold text-right">STATISTICAL DEVIATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {measuredFeatures.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400 text-xs">
                        No individual feature deviation breakdowns recorded.
                      </td>
                    </tr>
                  ) : (
                    measuredFeatures.map((mf, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                          {mf.feature}
                        </td>
                        <td className="py-2.5 text-blue-600 dark:text-blue-400 font-bold">
                          {mf.observed}
                        </td>
                        <td className="py-2.5 text-slate-500">{mf.baseline}</td>
                        <td className="py-2.5 text-right font-bold text-rose-600 dark:text-rose-400">
                          {mf.deviation}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* AI Investigation Section */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Gemma AI Root-Cause Investigation
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Grounded local LLM analysis conditioned strictly on observable network telemetry
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleInvestigateWithAi()}
                  disabled={isAiLoading}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  <span>{isAiLoading ? 'Analyzing...' : 'Investigate with AI'}</span>
                </button>
              </div>
            </div>

            {aiError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-mono space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Provider Error [{typeof aiError === 'string' ? 'ERROR' : aiError.code || '502'}]</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-200/60 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200">
                    No Auto-Fallback Applied
                  </span>
                </div>
                <p className="leading-relaxed">
                  {typeof aiError === 'string' ? aiError : aiError.message}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={async () => {
                      const other = (typeof aiError === 'object' && aiError.details?.provider === 'ollama') || String(typeof aiError === 'string' ? aiError : aiError.message).toLowerCase().includes('ollama') ? 'gemma-api' : 'ollama';
                      await netSutraApi.updateAiProviderSettings(other);
                      handleInvestigateWithAi(other);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors cursor-pointer shadow-xs"
                  >
                    <span>Switch to Other Provider & Retry</span>
                  </button>
                  <Link
                    to="/settings/ai"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs transition-colors"
                  >
                    <span>Configure in AI Settings</span>
                  </Link>
                </div>
              </div>
            )}

            {explanation ? (
              <div className="space-y-4">
                {/* 1. Summary */}
                <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">
                  <div className="font-bold font-mono text-[11px] text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>1. Telemetry Summary Narrative</span>
                  </div>
                  <p>{explanation.summary || explanation.assessment || (typeof explanation === 'string' ? explanation : 'No summary narrative available.')}</p>
                </div>

                {/* 2. Observed Evidence */}
                {explanation.observedEvidence && explanation.observedEvidence.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>2. Concrete Observed Evidence</span>
                    </div>
                    <ul className="space-y-1">
                      {explanation.observedEvidence.map((item, idx) => (
                        <li
                          key={idx}
                          className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs font-mono text-slate-800 dark:text-slate-200 flex items-start gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 3. Possible Explanations */}
                {explanation.possibleExplanations && explanation.possibleExplanations.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                      <span>3. Possible Explanations (Hypothesis Matrix)</span>
                    </div>
                    <ul className="space-y-1">
                      {explanation.possibleExplanations.map((item, idx) => (
                        <li
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. Recommended Checks */}
                {explanation.recommendedChecks && explanation.recommendedChecks.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-700 dark:text-slate-300 font-bold">
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      <span>4. Recommended Forensic Checks</span>
                    </div>
                    <ul className="space-y-1">
                      {explanation.recommendedChecks.map((item, idx) => (
                        <li
                          key={idx}
                          className="p-2.5 rounded-lg bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 5. Uncertainties and Limitations */}
                {explanation.uncertaintiesAndLimitations && explanation.uncertaintiesAndLimitations.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>5. Uncertainties and Limitations</span>
                    </div>
                    <ul className="space-y-1">
                      {explanation.uncertaintiesAndLimitations.map((item, idx) => (
                        <li
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] font-mono text-slate-600 dark:text-slate-400 flex items-start gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs font-mono">
                Click "Investigate with AI" above to run multi-factor correlation analysis.
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right Column: Supporting Events & Incidents */}
        <div className="space-y-6">
          {/* Supporting Event IDs */}
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Supporting Event IDs ({supportingEventIds.length})</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Correlated raw connection events supporting this statistical anomaly
            </p>

            <div className="space-y-1.5">
              {supportingEventIds.length === 0 ? (
                <div className="text-xs text-slate-400 p-2 font-mono">No linked event IDs available.</div>
              ) : (
                supportingEventIds.map((evtId) => (
                  <Link
                    key={evtId}
                    to={`/events?search=${evtId}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-xs font-mono text-blue-600 dark:text-blue-400 transition-colors group"
                  >
                    <span className="font-bold">{evtId}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </Link>
                ))
              )}
            </div>
          </GlassCard>

          {/* Related Incidents */}
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Related Incidents ({relatedIncidents.length})</span>
            </h3>

            {relatedIncidents.length > 0 ? (
              <div className="space-y-2">
                {relatedIncidents.map((incId) => (
                  <Link
                    key={incId}
                    to={`/incidents/${incId}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-xs font-mono group"
                  >
                    <div>
                      <div className="font-bold text-rose-700 dark:text-rose-300">{incId}</div>
                      <div className="text-[11px] text-slate-500">Incident Dossier Active</div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-rose-600 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-xs font-mono text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                No active incident associated with this anomaly.
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AnomalyDetailPage;
