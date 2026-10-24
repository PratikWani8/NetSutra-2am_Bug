import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Shield,
  Bot,
  ExternalLink,
  Activity,
  CheckCircle2,
  RefreshCw,
  Edit3,
} from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/common/GlassCard';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusPill from '../components/common/StatusPill';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import netSutraApi from '../services/api';
import { formatFullUtc, formatUtcTime } from '../utils/formatters';

export const IncidentDetailPage = () => {
  const { id } = useParams();
  const [incident, setIncident] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  const fetchIncident = useCallback(async () => {
    setIsLoading(true);
    const res = await netSutraApi.getIncidentById(id);
    if (res.success) {
      setIncident(res.data);
      setIsDemo(!!res.isDemo);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    fetchIncident();
  }, [fetchIncident]);

  const handleStatusChange = async (newStatus) => {
    setIsUpdatingStatus(true);
    setStatusMessage('');

    const res = await netSutraApi.updateIncidentStatus(id, newStatus);
    if (res.success) {
      setIncident((prev) => ({ ...prev, status: newStatus }));
      setStatusMessage(`Status updated to "${newStatus}" successfully via PATCH /api/incidents/${id}/status`);
    } else {
      setStatusMessage(`Failed to update status: ${res.error?.message}`);
    }
    setIsUpdatingStatus(false);
  };

  if (isLoading && !incident) {
    return (
      <div className="space-y-6">
        <Header title="Incident Dossier Inspection" />
        <LoadingSkeleton type="table" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="space-y-6">
        <Header title="Incident Dossier Inspection" />
        <GlassCard className="p-8 text-center text-slate-500">
          Incident record {id} could not be found.
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3">
        <Link
          to="/incidents"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Incidents</span>
        </Link>
      </div>

      <Header
        title={`Incident Dossier: ${incident.id}`}
        badge={incident.severity}
        subtitle={incident.title}
        isDemo={isDemo}
      />

      <OfflineBanner onRetry={fetchIncident} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Incident Details & Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <GlassCard className="p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-200 dark:border-rose-800">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {incident.title}
                  </h2>
                  <div className="text-xs font-mono text-slate-400">
                    Lead Analyst: {incident.assignedAnalyst || 'Unassigned'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <SeverityBadge severity={incident.severity} size="sm" showIcon={true} />
                <StatusPill status={incident.status} size="sm" />
              </div>
            </div>

            {/* Status Update Control (PATCH /api/incidents/:id/status) */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                  <span>Update Incident Status (REST API Sync)</span>
                </span>
                {isUpdatingStatus && <span className="text-blue-600 animate-pulse">Syncing...</span>}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                {['open', 'investigating', 'resolved', 'false_positive'].map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    disabled={isUpdatingStatus || incident.status === st}
                    className={`px-3 py-1.5 rounded-lg border capitalize transition-all cursor-pointer ${
                      incident.status === st
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {statusMessage && (
                <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 pt-1">
                  ✓ {statusMessage}
                </div>
              )}
            </div>

            {/* Context and Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  FIRST OBSERVED (UTC)
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatFullUtc(incident.firstObserved)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  LAST OBSERVED (UTC)
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatFullUtc(incident.lastObserved)}
                </span>
              </div>
            </div>

            {/* Summary narrative */}
            <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold block">
                INCIDENT SUMMARY
              </span>
              <p>{incident.summary}</p>
            </div>
          </GlassCard>

          {/* Evidence Timeline */}
          <GlassCard className="p-6 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Evidence Timeline & Event Milestones</span>
            </h3>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
              {(incident.evidenceTimeline || []).map((tl, idx) => (
                <div key={idx} className="relative flex flex-col sm:flex-row sm:items-baseline gap-2">
                  <span className="absolute -left-6 top-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900" />
                  <span className="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 shrink-0 sm:w-28">
                    {tl.timestamp}
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    {tl.event}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* AI Investigation Findings */}
          {incident.aiFindings && (
            <GlassCard className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200">
                <Bot className="w-4 h-4 text-indigo-600" />
                <span>AI Root-Cause Investigation Findings</span>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-800/40 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                {incident.aiFindings.assessment}
              </div>
            </GlassCard>
          )}
        </div>

        {/* Right Column: Related Anomalies & Affected Hosts */}
        <div className="space-y-6">
          {/* Related Anomalies */}
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Related Anomalies ({(incident.relatedAnomalies || []).length})</span>
            </h3>

            <div className="space-y-2">
              {(incident.relatedAnomalies || []).map((anomId) => (
                <Link
                  key={anomId}
                  to={`/anomalies/${anomId}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 hover:border-blue-300 text-xs font-mono group"
                >
                  <div className="font-bold text-blue-600 dark:text-blue-400">{anomId}</div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              ))}
            </div>
          </GlassCard>

          {/* Affected Hosts */}
          <GlassCard className="p-5 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-600" />
              <span>Affected Hosts ({(incident.affectedHosts || []).length})</span>
            </h3>

            <div className="space-y-1.5 font-mono text-xs">
              {(incident.affectedHosts || []).map((host) => (
                <div
                  key={host}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between"
                >
                  <span className="font-bold text-slate-900 dark:text-white">{host}</span>
                  <span className="text-[10px] text-slate-400">Endpoint</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default IncidentDetailPage;
