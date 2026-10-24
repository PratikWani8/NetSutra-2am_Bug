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

  const fetchAnomaly = useCallback(async () => {
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

  const handleInvestigateWithAi = async () => {
    setIsAiLoading(true);
    const res = await netSutraApi.investigateAnomaly(id);
    if (res.success) {
      setAiData(res.data);
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

  if (!anomaly) {
    return (
      <div className="space-y-6">
        <Header title="Anomaly Forensic Inspection" />
        <GlassCard className="p-8 text-center text-slate-500">
          Anomaly record {id} could not be located on the NetSutra backend.
        </GlassCard>
      </div>
    );
  }

  const explanation = aiData?.explanation || anomaly.aiInvestigation;

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
        title={`Anomaly Forensic: ${anomaly.id}`}
        badge={anomaly.ruleId || 'ANOM-RULE'}
        subtitle={anomaly.vector}
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
                    {anomaly.vector}
                  </h2>
                  <div className="text-xs font-mono text-slate-400">
                    Rule ID: {anomaly.ruleId || 'N/A'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SeverityBadge severity={anomaly.severity} size="sm" showIcon={true} />
                <ScorePill score={anomaly.score} size="md" />
                <StatusPill status={anomaly.investigationStatus} size="sm" />
              </div>
            </div>

            {/* Source & Destination Context */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  SOURCE CONTEXT
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatIpPort(anomaly.sourceIp, anomaly.sourcePort)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Internal Cluster Pod · Zone: US-East-Ingress
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                  DESTINATION CONTEXT
                </span>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatIpPort(anomaly.destinationIp, anomaly.destinationPort)}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  External Target · Protocol: Port {anomaly.destinationPort || 'N/A'}
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
                  {anomaly.detectionMethod || 'Isolation Forest Multi-vector Analysis'}
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
                  {(anomaly.measuredFeatures || []).map((mf, idx) => (
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
                  ))}
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
                    AI Anomaly Investigation & Hypothesis
                  </h3>
                  <p className="text-xs text-slate-400">
                    Multi-factor LLM reasoning across 5 structured analytical sections
                  </p>
                </div>
              </div>

              <button
                onClick={handleInvestigateWithAi}
                disabled={isAiLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                <span>{isAiLoading ? 'Analyzing Telemetry...' : 'Investigate with AI'}</span>
              </button>
            </div>

            {/* The 5 Required AI Sections */}
            {isAiLoading ? (
              <div className="py-12 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Consulting configured AI Provider ({aiData?.provider || 'Gemma 2'})...
                </div>
              </div>
            ) : explanation ? (
              <div className="space-y-4 pt-2">
                {/* 1. Summary */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>1. Summary</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {explanation.summary}
                  </div>
                </div>

                {/* 2. Observed Evidence */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>2. Observed Evidence</span>
                  </div>
                  <ul className="space-y-1">
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                    <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                    <span>3. Possible Explanations</span>
                  </div>
                  <ul className="space-y-1">
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                    <Shield className="w-3.5 h-3.5 text-blue-600" />
                    <span>4. Recommended Checks</span>
                  </div>
                  <ul className="space-y-1">
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-500 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>5. Uncertainties and Limitations</span>
                  </div>
                  <ul className="space-y-1">
                    {(explanation.uncertaintiesAndLimitations || []).map((item, idx) => (
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
              <span>Supporting Event IDs ({anomaly.supportingEventIds?.length || 0})</span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Correlated raw connection events supporting this statistical anomaly
            </p>

            <div className="space-y-1.5">
              {(anomaly.supportingEventIds || []).map((evtId) => (
                <Link
                  key={evtId}
                  to={`/events?search=${evtId}`}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 text-xs font-mono text-blue-600 dark:text-blue-400 transition-colors group"
                >
                  <span className="font-bold">{evtId}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              ))}
            </div>
          </GlassCard>

          {/* Related Incidents */}
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Related Incidents ({anomaly.relatedIncidents?.length || 0})</span>
            </h3>

            {anomaly.relatedIncidents && anomaly.relatedIncidents.length > 0 ? (
              <div className="space-y-2">
                {anomaly.relatedIncidents.map((incId) => (
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
