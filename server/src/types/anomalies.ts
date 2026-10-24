import { NetworkEvent } from './events';

export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type BaselineConfidence = 'low' | 'medium' | 'high';

export interface Anomaly {
  anomaly_id: string;
  timestamp: string; // ISO 8601 UTC
  score: number;
  severity: Severity;
  method: string;
  reasons: string[];
  features: Record<string, any>;
  evidence_event_ids: string[];
  baseline_confidence: BaselineConfidence;
  source_ip?: string;
  destination_ip?: string;
  source_port?: number | null;
  destination_port?: number | null;
}

export interface DetectionParameters {
  min_baseline_events?: number;
  volume_zscore_threshold?: number;
  volume_ratio_threshold?: number;
  frequency_burst_threshold?: number;
  failed_connection_ratio_threshold?: number;
  window_seconds?: number;
  min_score?: number;
}

export interface DetectionRequest {
  events: NetworkEvent[];
  baseline_events?: NetworkEvent[];
  parameters?: DetectionParameters;
}

export interface DetectionResponse {
  anomalies: Anomaly[];
  total_events_analyzed: number;
  anomalies_detected: number;
  baseline_events_used: number;
  baseline_confidence: BaselineConfidence;
}

export interface AnomalyQueryFilter {
  severity?: Severity;
  method?: string;
  source_ip?: string;
  destination_ip?: string;
  time_start?: string;
  time_end?: string;
  page?: number;
  limit?: number;
}
