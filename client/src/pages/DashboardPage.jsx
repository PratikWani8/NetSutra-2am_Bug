import React, { useState, useEffect, useCallback } from 'react';
import { UploadCloud, Play } from 'lucide-react';
import Header from '../components/layout/Header';
import StatCards from '../components/dashboard/StatCards';
import FlowTelemetryChart from '../components/dashboard/FlowTelemetryChart';
import SeverityDistribution from '../components/dashboard/SeverityDistribution';
import RecentAnomaliesTable from '../components/dashboard/RecentAnomaliesTable';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import AiInvestigationModal from '../components/anomalies/AiInvestigationModal';
import ExportReportModal from '../components/modals/ExportReportModal';
import QuickSearchModal from '../components/modals/QuickSearchModal';
import IngestTelemetryModal from '../components/modals/IngestTelemetryModal';
import netSutraApi from '../services/api';
import { useSocket } from '../context/SocketContext';

export const DashboardPage = () => {
  const { liveAnomalies } = useSocket();

  const [summary, setSummary] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDemoData, setIsDemoData] = useState(false);

  // Modals state
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiInvestigation, setAiInvestigation] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [summaryRes, anomaliesRes] = await Promise.all([
      netSutraApi.getDashboardSummary(),
      netSutraApi.getAnomalies({ limit: 10 }),
    ]);

    if (summaryRes.success) {
      setSummary(summaryRes.data);
      setIsDemoData(!!summaryRes.isDemo);
    } else {
      setError(summaryRes.error?.message || 'Failed to load dashboard summary');
    }

    if (anomaliesRes.success) {
      const serverAnomalies =
        anomaliesRes.data?.items ||
        anomaliesRes.data?.anomalies ||
        (Array.isArray(anomaliesRes.data) ? anomaliesRes.data : []);
      setAnomalies(Array.isArray(serverAnomalies) ? serverAnomalies : []);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Merge live socket anomalies without duplicates
  const mergedAnomalies = React.useMemo(() => {
    const baseList = Array.isArray(anomalies) ? anomalies : [];
    if (!liveAnomalies || liveAnomalies.length === 0) return baseList;
    const existingIds = new Set(baseList.map((a) => a.id || a.anomaly_id));
    const liveList = Array.isArray(liveAnomalies) ? liveAnomalies : [];
    const newItems = liveList.filter((la) => !existingIds.has(la.id || la.anomaly_id));
    return [...newItems, ...baseList];
  }, [liveAnomalies, anomalies]);

  const handleInvestigate = async (anomaly, overrideProvider) => {
    if (anomaly) setSelectedAnomaly(anomaly);
    const targetAnomaly = anomaly || selectedAnomaly;
    setAiModalOpen(true);
    setIsAiLoading(true);
    setAiError(null);

    const result = await netSutraApi.investigateAnomaly(
      targetAnomaly.id || targetAnomaly.anomaly_id,
      overrideProvider
    );
    if (result.success && result.data) {
      setAiInvestigation(result.data);
    } else {
      setAiError(result.error || { message: 'Failed to complete AI investigation.' });
    }
    setIsAiLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <Header
        title="Security Overview"
        subtitle="Autonomous Network Anomaly Detection & Telemetry"
        onOpenSearch={() => setIsSearchOpen(true)}
        onExportReport={() => setIsExportOpen(true)}
        onOpenIngest={() => setIsIngestOpen(true)}
        isDemo={isDemoData}
      />

      {/* Offline / Backend Notice */}
      <OfflineBanner onRetry={fetchDashboardData} isOffline={false} />

      {/* Zero telemetry banner prompt */}
      {!isLoading && mergedAnomalies.length === 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                No Network Telemetry Ingested Yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                The database is clean. Replay sample Zeek attack logs (baseline + exfiltration + scans) or upload your own log file.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsIngestOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all self-end sm:self-auto"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Ingest Telemetry (1-Click)</span>
          </button>
        </div>
      )}

      {/* Top Stat Cards */}
      {isLoading ? (
        <LoadingSkeleton type="cards" />
      ) : (
        <StatCards summary={summary} />
      )}

      {/* Middle Section: Flow Telemetry Chart + Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FlowTelemetryChart />
        </div>
        <div>
          <SeverityDistribution
            distribution={summary?.severityDistribution || summary?.severity_breakdown}
            threatIndex={summary?.threatIndex ?? (summary?.total_anomalies ? Math.min(100, summary.total_anomalies * 5) : (isDemoData ? 72 : 0))}
            totalCount={summary?.anomaliesDetected ?? summary?.total_anomalies ?? (isDemoData ? 842 : 0)}
          />
        </div>
      </div>

      {/* Bottom Section: Recent Anomalies Table (Clean Full Width) */}
      <RecentAnomaliesTable
        anomalies={mergedAnomalies}
        onInvestigate={handleInvestigate}
      />

      {/* AI Investigation Modal */}
      <AiInvestigationModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        anomaly={selectedAnomaly}
        investigationData={aiInvestigation}
        isLoading={isAiLoading}
        error={aiError}
        onSwitchProvider={async (newProvider) => {
          await netSutraApi.updateAiProviderSettings(newProvider);
          handleInvestigate(selectedAnomaly, newProvider);
        }}
        onRetry={() => handleInvestigate(selectedAnomaly)}
      />

      {/* Export Report Modal */}
      <ExportReportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />

      {/* Quick Search Modal */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Ingest Telemetry Modal */}
      <IngestTelemetryModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onIngested={fetchDashboardData}
      />
    </div>
  );
};

export default DashboardPage;
