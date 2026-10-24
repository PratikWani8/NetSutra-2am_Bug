import React, { useState, useEffect, useCallback } from 'react';
import Header from '../components/layout/Header';
import StatCards from '../components/dashboard/StatCards';
import FlowTelemetryChart from '../components/dashboard/FlowTelemetryChart';
import SeverityDistribution from '../components/dashboard/SeverityDistribution';
import RecentAnomaliesTable from '../components/dashboard/RecentAnomaliesTable';
import LiveSystemHealth from '../components/dashboard/LiveSystemHealth';
import ComponentKitBar from '../components/dashboard/ComponentKitBar';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import AiInvestigationModal from '../components/anomalies/AiInvestigationModal';
import ExportReportModal from '../components/modals/ExportReportModal';
import QuickSearchModal from '../components/modals/QuickSearchModal';
import netSutraApi from '../services/api';
import { useSocket } from '../context/SocketContext';
import { usePrototype, VIEW_STATES } from '../context/PrototypeContext';

export const DashboardPage = () => {
  const { viewState } = usePrototype();
  const { liveAnomalies, connectionStatus } = useSocket();

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
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
      const serverAnomalies = anomaliesRes.data?.anomalies || anomaliesRes.data || [];
      setAnomalies(serverAnomalies);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Merge live socket anomalies without duplicates
  const mergedAnomalies = React.useMemo(() => {
    if (!liveAnomalies || liveAnomalies.length === 0) return anomalies;
    const existingIds = new Set(anomalies.map((a) => a.id));
    const newItems = liveAnomalies.filter((la) => !existingIds.has(la.id));
    return [...newItems, ...anomalies];
  }, [liveAnomalies, anomalies]);

  const handleInvestigate = async (anomaly) => {
    setSelectedAnomaly(anomaly);
    setAiModalOpen(true);
    setIsAiLoading(true);

    const result = await netSutraApi.investigateAnomaly(anomaly.id);
    if (result.success) {
      setAiInvestigation(result.data);
    }
    setIsAiLoading(false);
  };

  // State Switcher overrides for prototype evaluation
  if (viewState === VIEW_STATES.SKELETON) {
    return (
      <div className="space-y-6">
        <Header onOpenSearch={() => setIsSearchOpen(true)} onExportReport={() => setIsExportOpen(true)} />
        <LoadingSkeleton type="cards" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LoadingSkeleton type="chart" />
          </div>
          <div>
            <LoadingSkeleton type="chart" />
          </div>
        </div>
        <LoadingSkeleton type="table" />
      </div>
    );
  }

  if (viewState === VIEW_STATES.EMPTY) {
    return (
      <div className="space-y-6">
        <Header onOpenSearch={() => setIsSearchOpen(true)} onExportReport={() => setIsExportOpen(true)} />
        <EmptyState
          title="Telemetry Stream Empty"
          message="No anomalous network traffic or security alerts detected during this time window."
          actionLabel="Refresh Ingestion"
          onAction={fetchDashboardData}
        />
      </div>
    );
  }

  if (viewState === VIEW_STATES.ERROR) {
    return (
      <div className="space-y-6">
        <Header onOpenSearch={() => setIsSearchOpen(true)} onExportReport={() => setIsExportOpen(true)} />
        <ErrorState
          title="SOC Service Disconnected (Simulated Error)"
          message="The NetSutra ingestion pipeline responded with an unhandled service error (500). Please check backend logs."
          onRetry={fetchDashboardData}
        />
      </div>
    );
  }

  const isDisconnectedSimulated = viewState === VIEW_STATES.DISCONNECTED;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <Header
        title="Security Overview"
        badge="NET-ANOMALY-01"
        subtitle="Autonomous Network Anomaly Detection & Telemetry"
        onOpenSearch={() => setIsSearchOpen(true)}
        onExportReport={() => setIsExportOpen(true)}
        isDemo={isDemoData}
      />

      {/* Offline / Backend Notice */}
      <OfflineBanner onRetry={fetchDashboardData} isOffline={isDisconnectedSimulated} />

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
            distribution={summary?.severityDistribution}
            threatIndex={summary?.threatIndex ?? 72}
            totalCount={summary?.anomaliesDetected ?? 842}
          />
        </div>
      </div>

      {/* Bottom Section: Recent Anomalies Table + Live System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentAnomaliesTable
            anomalies={mergedAnomalies}
            onInvestigate={handleInvestigate}
          />
        </div>
        <div>
          <LiveSystemHealth
            healthData={summary?.systemHealth}
            onRunProbe={fetchDashboardData}
            onReloadCache={fetchDashboardData}
          />
        </div>
      </div>

      {/* Design System & Badge Registry Footer */}
      <ComponentKitBar />

      {/* AI Investigation Modal */}
      <AiInvestigationModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        anomaly={selectedAnomaly}
        investigationData={aiInvestigation}
        isLoading={isAiLoading}
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
    </div>
  );
};

export default DashboardPage;
