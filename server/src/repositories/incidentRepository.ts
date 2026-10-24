import { IIncidentRepository } from './interfaces';
import { Incident, IncidentQueryFilter, IncidentStatus } from '../types/incidents';
import { PaginatedResult } from '../types/common';
import { opensearchClient, INDEX_INCIDENTS, isOpenSearchConnected } from '../config/opensearch';
import { logger } from '../utils/logger';

export class OpenSearchIncidentRepository implements IIncidentRepository {
  private memoryStore: Map<string, Incident> = new Map();

  async save(incident: Incident): Promise<Incident> {
    const now = new Date().toISOString();
    const doc: Incident = {
      ...incident,
      created_at: incident.created_at || now,
      updated_at: now
    };

    this.memoryStore.set(doc.incident_id, doc);

    if (isOpenSearchConnected()) {
      try {
        await opensearchClient.index({
          index: INDEX_INCIDENTS,
          id: doc.incident_id,
          body: doc,
          refresh: true
        });
      } catch (err: any) {
        logger.warn(`Failed to index incident in OpenSearch: ${err.message}`);
      }
    }

    return doc;
  }

  async saveBatch(incidents: Incident[]): Promise<Incident[]> {
    if (!incidents.length) return [];

    const now = new Date().toISOString();
    const saved: Incident[] = [];

    for (const inc of incidents) {
      const doc: Incident = {
        ...inc,
        created_at: inc.created_at || now,
        updated_at: now
      };
      this.memoryStore.set(doc.incident_id, doc);
      saved.push(doc);
    }

    if (isOpenSearchConnected()) {
      try {
        const operations = saved.flatMap(doc => [
          { index: { _index: INDEX_INCIDENTS, _id: doc.incident_id } },
          doc
        ]);

        await opensearchClient.bulk({
          refresh: true,
          body: operations
        });
      } catch (err: any) {
        logger.warn(`OpenSearch bulk incident indexing failed: ${err.message}`);
      }
    }

    return saved;
  }

  async findById(id: string): Promise<Incident | null> {
    if (isOpenSearchConnected()) {
      try {
        const res = await opensearchClient.get({
          index: INDEX_INCIDENTS,
          id
        });
        if (res.body?._source) {
          return res.body._source as Incident;
        }
      } catch (err: any) {
        if (err.statusCode !== 404) {
          logger.debug(`OpenSearch find incident failed: ${err.message}`);
        }
      }
    }

    return this.memoryStore.get(id) || null;
  }

  async find(filter: IncidentQueryFilter): Promise<PaginatedResult<Incident>> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(200, filter.limit || 20));
    const from = (page - 1) * limit;

    if (isOpenSearchConnected()) {
      try {
        const must: any[] = [];
        if (filter.status) {
          must.push({ term: { status: filter.status } });
        }
        if (filter.severity) {
          must.push({ term: { severity: filter.severity } });
        }
        if (filter.source_ip) {
          must.push({ term: { primary_source_ip: filter.source_ip } });
        }
        if (filter.destination_ip) {
          must.push({ term: { primary_destination_ip: filter.destination_ip } });
        }
        if (filter.time_start || filter.time_end) {
          const range: any = {};
          if (filter.time_start) range.gte = filter.time_start;
          if (filter.time_end) range.lte = filter.time_end;
          must.push({ range: { first_observed: range } });
        }

        const query = must.length ? { bool: { must } } : { match_all: {} };

        const res = await opensearchClient.search({
          index: INDEX_INCIDENTS,
          body: {
            from,
            size: limit,
            query,
            sort: [{ last_observed: { order: 'desc' } }]
          }
        });

        const hits = res.body?.hits?.hits || [];
        const total = typeof res.body?.hits?.total === 'number'
          ? res.body.hits.total
          : res.body?.hits?.total?.value || 0;

        return {
          items: hits.map((h: any) => h._source as Incident),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        };
      } catch (err: any) {
        logger.debug(`OpenSearch find incidents failed: ${err.message}`);
      }
    }

    // Memory query fallback
    let items = Array.from(this.memoryStore.values());

    if (filter.status) {
      items = items.filter(i => i.status === filter.status);
    }
    if (filter.severity) {
      items = items.filter(i => i.severity === filter.severity);
    }
    if (filter.source_ip) {
      items = items.filter(i => i.primary_source_ip === filter.source_ip);
    }
    if (filter.destination_ip) {
      items = items.filter(i => i.primary_destination_ip === filter.destination_ip);
    }
    if (filter.time_start) {
      const start = new Date(filter.time_start).getTime();
      items = items.filter(i => new Date(i.first_observed).getTime() >= start);
    }
    if (filter.time_end) {
      const end = new Date(filter.time_end).getTime();
      items = items.filter(i => new Date(i.last_observed).getTime() <= end);
    }

    items.sort((a, b) => new Date(b.last_observed).getTime() - new Date(a.last_observed).getTime());

    const total = items.length;
    const paginatedItems = items.slice(from, from + limit);

    return {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    };
  }

  async updateStatus(id: string, status: IncidentStatus): Promise<Incident | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      status,
      updated_at: new Date().toISOString()
    };

    return this.save(updated);
  }

  async updateInvestigation(id: string, investigation: Record<string, any>): Promise<Incident | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updated: Incident = {
      ...existing,
      investigation,
      status: existing.status === 'open' ? 'investigating' : existing.status,
      updated_at: new Date().toISOString()
    };

    return this.save(updated);
  }

  async countActive(): Promise<number> {
    if (isOpenSearchConnected()) {
      try {
        const res = await opensearchClient.count({
          index: INDEX_INCIDENTS,
          body: {
            query: {
              bool: {
                must_not: [
                  { term: { status: 'resolved' } },
                  { term: { status: 'closed' } }
                ]
              }
            }
          }
        });
        return res.body?.count ?? 0;
      } catch (err: any) {
        logger.debug(`OpenSearch incident count failed: ${err.message}`);
      }
    }

    let active = 0;
    for (const inc of this.memoryStore.values()) {
      if (inc.status !== 'resolved' && inc.status !== 'closed') {
        active++;
      }
    }
    return active;
  }

  clearMemory(): void {
    this.memoryStore.clear();
  }
}

export const incidentRepository = new OpenSearchIncidentRepository();
