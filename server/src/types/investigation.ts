export type SupportedProvider = 'gemma-api' | 'ollama';

export interface IncidentContext {
  incident_id: string;
  anomaly_ids: string[];
  evidence: Array<Record<string, any>>;
  summary: string;
  title?: string;
  severity?: string;
}

export interface InvestigateRequest {
  provider: SupportedProvider;
  incident: IncidentContext;
}

export interface InvestigateResponse {
  incident_id: string;
  provider: string;
  model: string;
  summary: string;
  observed_evidence: string[];
  possible_explanations: string[];
  recommended_checks: string[];
  uncertainties: string[];
  created_at: string;
}
