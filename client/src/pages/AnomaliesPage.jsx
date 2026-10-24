import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Search, Filter, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/common/GlassCard';
import SeverityBadge from '../components/common/SeverityBadge';
import ScorePill from '../components/common/ScorePill';
import StatusPill from '../components/common/StatusPill';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import AiInvestigationModal from '../components/anomalies/AiInvestigationModal';
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

  // AI Investigation modal
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const fetchAnomalies = useCallback(async () => {
    setIsLoading(true);
    const res = await netSutraApi.getAnomalies({
      search: searchQuery,
      severity: severityFilter,
      status: statusFilter,
    });

    if (res.success) {
      const data = res.data?.anomalies || res.data || [];
      setAnomalies(data);
      setIsDemo(!!res.isDemo);
    }
    setIsLoading(false);
  }, [searchQuery, severityFilter, statusFilter]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  const mergedAnomalies = React.useMemo(() => {
    if (!liveAnomalies || liveAnomalies.length === 0) return anomalies;
    const existingIds = new Set(anomalies.map((a) => a.id));
    const newItems = liveAnomalies.filter((la) => !existingIds.has(la.id));
    return [...newItems, ...anomalies];
  }, [liveAnomalies, anomalies]);

  const handleQuickInvestigate = async (e, anomaly) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedAnomaly(anomaly);
    setIsAiModalOpen(true);
    setIsAiLoading(true);

    const res = await netSutraApi.investigateAnomaly(anomaly.id);
    if (res.success) {
      setAiData(res.data);
    }
    setIsAiLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Header
        title="Network Anomaly Directory"
        badge="ISOLATION-FOREST-v2"
        subtitle="Unsupervised vector outliers, statistical deviations, and behavioral anomalies"
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
              onClick={fetchAnomalies}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
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
            No network anomalies found matching the current search parameters.
          </GlassCard>
        ) : (
          mergedAnomalies.map((item) => (
            <GlassCard
              key={item.id}
              hoverEffect={true}
              className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 group"
            >
              <Link to={`/anomalies/${item.id}`} className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono font-extrabold text-sm text-slate-900 dark:text-white">
                    {item.id}
                  </span>
                  <SeverityBadge severity={item.severity} size="xs" />
                  <ScorePill score={item.score} size="sm" />
                  <StatusPill status={item.investigationStatus} size="sm" />
                  <span className="text-[11px] font-mono text-slate-400">
                    {formatUtcTime(item.timestamp)} UTC
                  </span>
                </div>

                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {item.vector}
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                  <div>
                    <span>Source: </span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {formatIpPort(item.sourceIp, item.sourcePort)}
                    </strong>
                  </div>
                  <div>→</div>
                  <div>
                    <span>Destination: </span>
                    <strong className="text-slate-800 dark:text-slate-200">
                      {formatIpPort(item.destinationIp, item.destinationPort)}
                    </strong>
                  </div>
                  {item.ruleId && (
                    <div className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      rule: {item.ruleId}
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
                  to={`/anomalies/${item.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-xs font-sans font-semibold hover:opacity-90 transition-opacity"
                >
                  <span>Details</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {/* AI Investigation Modal */}
      <AiInvestigationModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        anomaly={selectedAnomaly}
        investigationData={aiData}
        isLoading={isAiLoading}
      />
    </div>
  );
};

export default AnomaliesPage;
