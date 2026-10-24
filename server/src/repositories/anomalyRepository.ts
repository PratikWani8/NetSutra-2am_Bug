import { IAnomalyRepository } from './interfaces';
import { Anomaly, AnomalyQueryFilter, Severity } from '../types/anomalies';
import { PaginatedResult } from '../types/common';
import { opensearchClient, INDEX_ANOMALIES, isOpenSearchConnected } from '../config/opensearch';
import { logger } from '../utils/logger';

export class OpenSearchAnomalyRepository implements IAnomalyRepository {
  private memoryStore: Map<string, Anomaly> = new Map();

  async save(anomaly: Anomaly): Promise<Anomaly> {
    this.memoryStore.set(anomaly.anomaly_id, anomaly);

    if (isOpenSearchConnected()) {
      try {
        await opensearchClient.index({
          index: INDEX_ANOMALIES,
          id: anomaly.anomaly_id,
          body: anomaly,
          refresh: true
        });
      } catch (err: any) {
        logger.warn(`Failed to index anomaly in OpenSearch, saved locally: ${err.message}`);
      }
    }

    return anomaly;
  }

  async saveBatch(anomalies: Anomaly[]): Promise<Anomaly[]> {
    if (!anomalies.length) return [];

    for (const anom of anomalies) {
      this.memoryStore.set(anom.anomaly_id, anom);
    }

    if (isOpenSearchConnected()) {
      try {
        const operations = anomalies.flatMap(doc => [
          { index: { _index: INDEX_ANOMALIES, _id: doc.anomaly_id } },
          doc
        ]);

        await opensearchClient.bulk({
          refresh: true,
          body: operations
        });
      } catch (err: any) {
        logger.warn(`OpenSearch bulk anomaly indexing failed: ${err.message}`);
      }
    }

    return anomalies;
  }

  async findById(id: string): Promise<Anomaly | null> {
    if (isOpenSearchConnected()) {
      try {
        const res = await opensearchClient.get({
          index: INDEX_ANOMALIES,
          id
        });
        if (res.body?._source) {
          return res.body._source as Anomaly;
        }
      } catch (err: any) {
        if (err.statusCode !== 404) {
          logger.debug(`OpenSearch find anomaly failed: ${err.message}`);
        }
      }
    }

    return this.memoryStore.get(id) || null;
  }

  async find(filter: AnomalyQueryFilter): Promise<PaginatedResult<Anomaly>> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(500, filter.limit || 50));
    const from = (page - 1) * limit;

    if (isOpenSearchConnected()) {
      try {
        const must: any[] = [];
        if (filter.severity) {
          must.push({ term: { severity: filter.severity } });
        }
        if (filter.method) {
          must.push({ term: { method: filter.method } });
        }
        if (filter.time_start || filter.time_end) {
          const range: any = {};
          if (filter.time_start) range.gte = filter.time_start;
          if (filter.time_end) range.lte = filter.time_end;
          must.push({ range: { timestamp: range } });
        }

        const query = must.length ? { bool: { must } } : { match_all: {} };

        const res = await opensearchClient.search({
          index: INDEX_ANOMALIES,
          body: {
            from,
            size: limit,
            query,
            sort: [{ timestamp: { order: 'desc' } }]
          }
        });

        const hits = res.body?.hits?.hits || [];
        const total = typeof res.body?.hits?.total === 'number'
          ? res.body.hits.total
          : res.body?.hits?.total?.value || 0;

        return {
          items: hits.map((h: any) => h._source as Anomaly),
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        };
      } catch (err: any) {
        logger.debug(`OpenSearch find anomalies query failed: ${err.message}`);
      }
    }

    // Memory query fallback
    let items = Array.from(this.memoryStore.values());

    if (filter.severity) {
      items = items.filter(a => a.severity === filter.severity);
    }
    if (filter.method) {
      items = items.filter(a => a.method === filter.method);
    }
    if (filter.time_start) {
      const start = new Date(filter.time_start).getTime();
      items = items.filter(a => new Date(a.timestamp).getTime() >= start);
    }
    if (filter.time_end) {
      const end = new Date(filter.time_end).getTime();
      items = items.filter(a => new Date(a.timestamp).getTime() <= end);
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

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

  async count(): Promise<number> {
    if (isOpenSearchConnected()) {
      try {
        const res = await opensearchClient.count({ index: INDEX_ANOMALIES });
        return res.body?.count ?? this.memoryStore.size;
      } catch (err: any) {
        logger.debug(`OpenSearch anomaly count failed: ${err.message}`);
      }
    }
    return this.memoryStore.size;
  }

  async getSeverityDistribution(): Promise<Record<Severity, number>> {
    const distribution: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    if (isOpenSearchConnected()) {
      try {
        const res: any = await (opensearchClient as any).search({
          index: INDEX_ANOMALIES,
          body: {
            size: 0,
            aggs: {
              severities: {
                terms: { field: 'severity' }
              }
            }
          }
        });

        const buckets = (res.body?.aggregations as any)?.severities?.buckets || [];
        for (const bucket of buckets) {
          if (bucket.key in distribution) {
            distribution[bucket.key as Severity] = bucket.doc_count;
          }
        }
        return distribution;
      } catch (err: any) {
        logger.debug(`OpenSearch anomaly severity aggs failed: ${err.message}`);
      }
    }

    for (const anom of this.memoryStore.values()) {
      if (anom.severity in distribution) {
        distribution[anom.severity]++;
      }
    }

    return distribution;
  }

  async getRecent(limit = 10): Promise<Anomaly[]> {
    const res = await this.find({ limit, page: 1 });
    return res.items;
  }

  clearMemory(): void {
    this.memoryStore.clear();
  }
}

export const anomalyRepository = new OpenSearchAnomalyRepository();
