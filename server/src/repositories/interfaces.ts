import { NetworkEvent, EventQueryFilter } from '../types/events';
import { Anomaly, AnomalyQueryFilter, Severity } from '../types/anomalies';
import { Incident, IncidentQueryFilter, IncidentStatus } from '../types/incidents';
import { SupportedProvider } from '../types/investigation';
import { PaginatedResult } from '../types/common';

export interface IEventRepository {
  save(event: NetworkEvent): Promise<NetworkEvent>;
  saveBatch(events: NetworkEvent[]): Promise<{ saved: number; errors: number }>;
  findById(id: string): Promise<NetworkEvent | null>;
  findManyByIds(ids: string[]): Promise<NetworkEvent[]>;
  find(filter: EventQueryFilter): Promise<PaginatedResult<NetworkEvent>>;
  count(): Promise<number>;
  getTopTalkers(limit?: number): Promise<{
    sourceIps: Array<{ ip: string; count: number }>;
    destIps: Array<{ ip: string; count: number }>;
  }>;
}

export interface IAnomalyRepository {
  save(anomaly: Anomaly): Promise<Anomaly>;
  saveBatch(anomalies: Anomaly[]): Promise<Anomaly[]>;
  findById(id: string): Promise<Anomaly | null>;
  find(filter: AnomalyQueryFilter): Promise<PaginatedResult<Anomaly>>;
  count(): Promise<number>;
  getSeverityDistribution(): Promise<Record<Severity, number>>;
  getRecent(limit?: number): Promise<Anomaly[]>;
}

export interface IIncidentRepository {
  save(incident: Incident): Promise<Incident>;
  saveBatch(incidents: Incident[]): Promise<Incident[]>;
  findById(id: string): Promise<Incident | null>;
  find(filter: IncidentQueryFilter): Promise<PaginatedResult<Incident>>;
  updateStatus(id: string, status: IncidentStatus): Promise<Incident | null>;
  updateInvestigation(id: string, investigation: Record<string, any>): Promise<Incident | null>;
  countActive(): Promise<number>;
}

export interface ISettingsRepository {
  getSelectedProvider(): Promise<SupportedProvider>;
  setSelectedProvider(provider: SupportedProvider): Promise<void>;
}
