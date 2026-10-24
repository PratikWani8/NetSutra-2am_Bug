import { Severity } from './anomalies';

export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export interface IncidentEvidenceItem {
  event_id: string;
  source_ip?: string;
  destination_ip?: string;
  source_port?: number;
  destination_port?: number;
  protocol?: string;
  service?: string;
  outbound_bytes?: number;
  inbound_bytes?: number;
  conn_state?: string;
  timestamp?: string;
  extra?: Record<string, any>;
}

export interface Incident {
  incident_id: string;
  title: string;
  anomaly_ids: string[];
  evidence_event_ids: string[];
  correlation_reasons: string[];
  first_observed: string; // ISO 8601 UTC
  last_observed: string; // ISO 8601 UTC
  severity: Severity;
  summary: string;
  status: IncidentStatus;
  primary_source_ip?: string | null;
  primary_destination_ip?: string | null;
  evidence: Array<Record<string, any>>;
  investigation?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface CorrelationParameters {
  time_window_seconds?: number;
  group_by_source?: boolean;
  group_by_destination?: boolean;
  min_anomalies_per_incident?: number;
}

export interface CorrelateRequest {
  anomalies: any[];
  events?: any[];
  parameters?: CorrelationParameters;
}

export interface CorrelateResponse {
  incidents: any[];
  total_anomalies_correlated: number;
  incident_count: number;
}

export interface IncidentQueryFilter {
  status?: IncidentStatus;
  severity?: Severity;
  time_start?: string;
  time_end?: string;
  source_ip?: string;
  destination_ip?: string;
  page?: number;
  limit?: number;
}
