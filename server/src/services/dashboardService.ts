import { eventRepository } from '../repositories/eventRepository';
import { anomalyRepository } from '../repositories/anomalyRepository';
import { incidentRepository } from '../repositories/incidentRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { Severity } from '../types/anomalies';
import { SupportedProvider } from '../types/investigation';

export interface DashboardSummary {
  total_events: number;
  total_anomalies: number;
  active_incidents: number;
  severity_breakdown: Record<Severity, number>;
  top_source_ips: Array<{ ip: string; count: number }>;
  top_destination_ips: Array<{ ip: string; count: number }>;
  recent_anomalies: any[];
  selected_ai_provider: SupportedProvider;
  timestamp: string;
}

export class DashboardService {
  async getSummary(): Promise<DashboardSummary> {
    const [
      totalEvents,
      totalAnomalies,
      activeIncidents,
      severityBreakdown,
      topTalkers,
      recentAnomalies,
      selectedProvider
    ] = await Promise.all([
      eventRepository.count(),
      anomalyRepository.count(),
      incidentRepository.countActive(),
      anomalyRepository.getSeverityDistribution(),
      eventRepository.getTopTalkers(5),
      anomalyRepository.getRecent(10),
      settingsRepository.getSelectedProvider()
    ]);

    return {
      total_events: totalEvents,
      total_anomalies: totalAnomalies,
      active_incidents: activeIncidents,
      severity_breakdown: severityBreakdown,
      top_source_ips: topTalkers.sourceIps,
      top_destination_ips: topTalkers.destIps,
      recent_anomalies: recentAnomalies,
      selected_ai_provider: selectedProvider,
      timestamp: new Date().toISOString()
    };
  }
}

export const dashboardService = new DashboardService();
