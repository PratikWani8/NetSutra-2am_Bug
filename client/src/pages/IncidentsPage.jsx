import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Search, Filter, ArrowRight, ShieldAlert, Clock, RefreshCw, UploadCloud } from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/common/GlassCard';
import SeverityBadge from '../components/common/SeverityBadge';
import StatusPill from '../components/common/StatusPill';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import IngestTelemetryModal from '../components/modals/IngestTelemetryModal';
import netSutraApi from '../services/api';
import { useSocket } from '../context/SocketContext';
import { formatUtcTime } from '../utils/formatters';

export const IncidentsPage = () => {
  const { incidentUpdates } = useSocket();
  const [incidents, setIncidents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [isDemo, setIsDemo] = useState(false);
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    const res = await netSutraApi.getIncidents({
      status: statusFilter,
      severity: severityFilter,
    });
    if (res.success) {
      const data =
        res.data?.items ||
        res.data?.incidents ||
        (Array.isArray(res.data) ? res.data : []);
      setIncidents(Array.isArray(data) ? data : []);
      setIsDemo(!!res.isDemo);
    }
    setIsLoading(false);
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Header
        title="Security Incidents Dossier"
        subtitle="Correlated security alerts, multi-anomaly containment, and forensic tracking"
        onOpenIngest={() => setIsIngestOpen(true)}
        isDemo={isDemo}
      />

      <OfflineBanner onRetry={fetchIncidents} />

      {/* Filter Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 uppercase text-[10px]">FILTER STATUS:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="false_positive">False Positive</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setIsIngestOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all cursor-pointer shadow-xs"
              title="Ingest Zeek Logs or Replay Telemetry"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Ingest Logs</span>
            </button>

            <button
              onClick={fetchIncidents}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Incidents List */}
      <div className="space-y-3">
        {isLoading && incidents.length === 0 ? (
          <LoadingSkeleton type="table" />
        ) : incidents.length === 0 ? (
          <GlassCard className="p-12 text-center text-slate-400 font-mono text-xs">
            <p className="mb-3 text-slate-500 dark:text-slate-400">
              No security incidents found matching current triage filters or database is empty.
            </p>
            <button
              onClick={() => setIsIngestOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition shadow-sm cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Ingest / Replay Telemetry</span>
            </button>
          </GlassCard>
        ) : (
          incidents.map((inc, idx) => {
            const incId = inc.id || inc.incident_id || `inc-${idx}`;
            const firstObs = inc.firstObserved || inc.first_observed || inc.created_at;
            const lastObs = inc.lastObserved || inc.last_observed || inc.updated_at;
            const affected = inc.affectedHosts || (inc.primary_source_ip ? [inc.primary_source_ip] : []);
            const analyst = inc.assignedAnalyst || 'SecOps AI Agent';

            return (
              <GlassCard
                key={incId}
                hoverEffect={true}
                className={`p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group ${
                  inc.severity === 'CRITICAL' ? 'border-l-4 border-l-rose-500' : ''
                }`}
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                      {incId}
                    </span>
                    <SeverityBadge severity={inc.severity} size="xs" showIcon={true} />
                    <StatusPill status={inc.status} size="sm" />
                    <span className="text-[11px] font-mono text-slate-400">
                      Observed: {formatUtcTime(firstObs)} → {formatUtcTime(lastObs)} UTC
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {inc.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {inc.summary}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400 pt-1">
                    <div>
                      <span>Affected Hosts: </span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {affected.join(', ') || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span>Assigned: </span>
                      <strong className="text-slate-800 dark:text-slate-200">{analyst}</strong>
                    </div>
                    {inc.containmentStatus && (
                      <div className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {inc.containmentStatus}
                      </div>
                    )}
                  </div>
                </div>

                <div className="self-end md:self-center shrink-0">
                  <Link
                    to={`/incidents/${incId}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <span>Open Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Ingest Telemetry Modal */}
      <IngestTelemetryModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onIngested={() => fetchIncidents()}
      />
    </div>
  );
};

export default IncidentsPage;
