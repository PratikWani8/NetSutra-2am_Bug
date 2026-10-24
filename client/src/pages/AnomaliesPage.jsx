import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Search, Filter, ArrowRight, Sparkles, RefreshCw, UploadCloud } from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/common/GlassCard';
import SeverityBadge from '../components/common/SeverityBadge';
import ScorePill from '../components/common/ScorePill';
import StatusPill from '../components/common/StatusPill';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import AiInvestigationModal from '../components/anomalies/AiInvestigationModal';
import IngestTelemetryModal from '../components/modals/IngestTelemetryModal';
import netSutraApi from '../services/api';
import { useSocket } from '../context/SocketContext';
import { formatUtcTime, formatIpPort } from '../utils/formatters';

export const AnomaliesPage = () => {
  const { liveAnomalies } = useSocket();
  const [anomalies, setAnomalies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isDemo, setIsDemo] = useState(false);
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // AI Investigation modal
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  const fetchAnomalies = useCallback(async () => {
    setIsLoading(true);
    const res = await netSutraApi.getAnomalies({
      search: searchQuery,
      severity: severityFilter,
      status: statusFilter,
    });

    if (res.success) {
      const data =
        res.data?.items ||
        res.data?.anomalies ||
        (Array.isArray(res.data) ? res.data : []);
      setAnomalies(Array.isArray(data) ? data : []);
      setIsDemo(!!res.isDemo);
    }
    setIsLoading(false);
  }, [searchQuery, severityFilter, statusFilter]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  const mergedAnomalies = React.useMemo(() => {
    const baseList = Array.isArray(anomalies) ? anomalies : [];
    if (!liveAnomalies || liveAnomalies.length === 0) return baseList;
    const existingIds = new Set(baseList.map((a) => a.id || a.anomaly_id));
    const liveList = Array.isArray(liveAnomalies) ? liveAnomalies : [];
    const newItems = liveList.filter((la) => !existingIds.has(la.id || la.anomaly_id));
    return [...newItems, ...baseList];
  }, [liveAnomalies, anomalies]);

  const handleQuickInvestigate = async (e, anomaly, overrideProvider) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetAnomaly = anomaly || selectedAnomaly;
    const anomId = targetAnomaly?.id || targetAnomaly?.anomaly_id;
    if (targetAnomaly) setSelectedAnomaly({ ...targetAnomaly, id: anomId, anomaly_id: anomId });
    setIsAiModalOpen(true);
    setIsAiLoading(true);
    setAiError(null);

    const res = await netSutraApi.investigateAnomaly(anomId, overrideProvider);
    if (res.success && res.data) {
      setAiData(res.data);
    } else {
      setAiError(res.error || { message: 'Failed to complete AI investigation.' });
    }
    setIsAiLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Header
        title="Network Anomaly Directory"
        subtitle="Unsupervised vector outliers, statistical deviations, and behavioral anomalies"
        onOpenIngest={() => setIsIngestOpen(true)}
        isDemo={isDemo}
      />

      <OfflineBanner onRetry={fetchAnomalies} />

      {/* Filter and search bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs font-mono">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Anomaly ID, rule, IP address, or vector..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>

            <button
              onClick={() => setIsIngestOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-all cursor-pointer shadow-xs"
              title="Ingest Zeek Logs or Replay Telemetry"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Ingest Logs</span>
            </button>

            <button
              onClick={fetchAnomalies}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Anomalies List */}
      <div className="space-y-3">
        {isLoading && mergedAnomalies.length === 0 ? (
          <LoadingSkeleton type="table" />
        ) : mergedAnomalies.length === 0 ? (
          <GlassCard className="p-12 text-center text-slate-400 font-mono text-xs">
            <p className="mb-3 text-slate-500 dark:text-slate-400">
              No network anomalies found matching the current search parameters or database is empty.
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
          mergedAnomalies.map((item, idx) => {
            const anomId = item.id || item.anomaly_id || `anom-${idx}`;
            const vector = item.vector || item.method || item.reasons?.[0] || 'Behavioral Outlier';
            const rawSrc = item.sourceIp || item.source_ip || item.features?.source_ip || item.features?.['id.orig_h'] || item.features?.src_ip || item.evidence?.[0]?.source_ip || item.evidence?.[0]?.['id.orig_h'];
            const srcIp = rawSrc && rawSrc !== 'N/A' && rawSrc !== 'undefined' ? rawSrc : (item.source_ip && item.source_ip !== 'N/A' ? item.source_ip : 'N/A');
            const srcPort = item.sourcePort ?? item.source_port ?? item.features?.source_port ?? item.features?.['id.orig_p'] ?? item.evidence?.[0]?.source_port;
            const rawDst = item.destinationIp || item.destination_ip || item.features?.destination_ip || item.features?.['id.resp_h'] || item.features?.dest_ip || item.evidence?.[0]?.destination_ip || item.evidence?.[0]?.['id.resp_h'];
            const dstIp = rawDst && rawDst !== 'N/A' && rawDst !== 'undefined' ? rawDst : (item.destination_ip && item.destination_ip !== 'N/A' ? item.destination_ip : 'N/A');
            const dstPort = item.destinationPort ?? item.destination_port ?? item.features?.destination_port ?? item.features?.['id.resp_p'] ?? item.evidence?.[0]?.destination_port;
            const ruleId = item.ruleId || item.rule_id || item.method;
            const status = item.investigationStatus || item.status || 'open';

            return (
              <GlassCard
                key={anomId}
                hoverEffect={true}
                className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
              >
                <Link to={`/anomalies/${anomId}`} className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                      {anomId}
                    </span>
                    <SeverityBadge severity={item.severity} size="xs" />
                    <ScorePill score={item.score} size="sm" />
                    <StatusPill status={status} size="sm" />
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatUtcTime(item.timestamp)} UTC
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {vector}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                    <div>
                      <span>Source: </span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatIpPort(srcIp, srcPort)}
                      </strong>
                    </div>
                    <div>→</div>
                    <div>
                      <span>Destination: </span>
                      <strong className="text-slate-800 dark:text-slate-200">
                        {formatIpPort(dstIp, dstPort)}
                      </strong>
                    </div>
                    {ruleId && (
                      <div className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        rule: {ruleId}
                      </div>
                    )}
                  </div>
                </Link>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={(e) => handleQuickInvestigate(e, item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-mono font-semibold hover:bg-blue-100/70 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Investigate with AI</span>
                  </button>

                  <Link
                    to={`/anomalies/${anomId}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-sans font-semibold hover:opacity-90 transition-opacity"
                  >
                    <span>Details</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* AI Investigation Modal */}
      <AiInvestigationModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        anomaly={selectedAnomaly}
        investigationData={aiData}
        isLoading={isAiLoading}
        error={aiError}
        onSwitchProvider={async (newProvider) => {
          await netSutraApi.updateAiProviderSettings(newProvider);
          handleQuickInvestigate(null, selectedAnomaly, newProvider);
        }}
        onRetry={() => handleQuickInvestigate(null, selectedAnomaly)}
      />

      {/* Ingest Telemetry Modal */}
      <IngestTelemetryModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onIngested={() => fetchAnomalies()}
      />
    </div>
  );
};

export default AnomaliesPage;
