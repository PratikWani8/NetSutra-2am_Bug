import { IEventRepository } from './interfaces';
import { NetworkEvent, EventQueryFilter } from '../types/events';
import { PaginatedResult } from '../types/common';
import { opensearchClient, INDEX_EVENTS, isOpenSearchConnected } from '../config/opensearch';
import { logger } from '../utils/logger';

export class OpenSearchEventRepository implements IEventRepository {
  // In-memory fallback cache for standalone mode / tests
  private memoryStore: Map<string, NetworkEvent> = new Map();

  async save(event: NetworkEvent): Promise<NetworkEvent> {
    this.memoryStore.set(event.event_id, event);

    if (isOpenSearchConnected()) {
      try {
        await opensearchClient.index({
          index: INDEX_EVENTS,
          id: event.event_id,
          body: event,
          refresh: true
        });
      } catch (err: any) {
        logger.warn(`Failed to index event in OpenSearch, cached locally: ${err.message}`);
      }
    }

    return event;
  }

  async saveBatch(events: NetworkEvent[]): Promise<{ saved: number; errors: number }> {
    if (!events.length) {
      return { saved: 0, errors: 0 };
    }

    // Always store in memory cache
    for (const event of events) {
      this.memoryStore.set(event.event_id, event);
    }

    if (isOpenSearchConnected()) {
      try {
        const operations = events.flatMap(doc => [
          { index: { _index: INDEX_EVENTS, _id: doc.event_id } },
          doc
        ]);

        const bulkResponse = await opensearchClient.bulk({
          refresh: true,
          body: operations
        });

        if (bulkResponse.body?.errors) {
          let errorCount = 0;
          for (const item of bulkResponse.body.items) {
            if (item.index?.error) {
              errorCount++;
            }
          }
          return { saved: events.length - errorCount, errors: errorCount };
        }

        return { saved: events.length, errors: 0 };
      } catch (err: any) {
        logger.warn(`OpenSearch bulk index failed, fallback to memory: ${err.message}`);
      }
    }

    return { saved: events.length, errors: 0 };
  }

  async findById(id: string): Promise<NetworkEvent | null> {
    if (isOpenSearchConnected()) {
      try {
        const res = await opensearchClient.get({
          index: INDEX_EVENTS,
          id
        });
        if (res.body?._source) {
          return res.body._source as NetworkEvent;
        }
      } catch (err: any) {
        if (err.statusCode !== 404) {
          logger.debug(`OpenSearch findById error: ${err.message}`);
        }
      }
    }

    return this.memoryStore.get(id) || null;
  }

  async findManyByIds(ids: string[]): Promise<NetworkEvent[]> {
    if (!ids.length) return [];

    if (isOpenSearchConnected()) {
      try {
        const res: any = await (opensearchClient as any).mget({
          index: INDEX_EVENTS,
          body: { ids }
        });
        const docs = res.body?.docs || [];
        const results: NetworkEvent[] = [];
        for (const doc of docs) {
          const docAny = doc as any;
          if (docAny.found && docAny._source) {
            results.push(docAny._source as NetworkEvent);
          }
        }
        if (results.length > 0) {
          return results;
        }
      } catch (err: any) {
        logger.debug(`OpenSearch mget failed: ${err.message}`);
      }
    }

    const memoryResults: NetworkEvent[] = [];
    for (const id of ids) {
      const item = this.memoryStore.get(id);
      if (item) {
        memoryResults.push(item);
      }
    }
    return memoryResults;
  }

  async find(filter: EventQueryFilter): Promise<PaginatedResult<NetworkEvent>> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(1000, filter.limit || 50));
    const from = (page - 1) * limit;

    if (isOpenSearchConnected()) {
      try {
        const must: any[] = [];

        if (filter.time_start || filter.time_end) {
          const range: any = {};
          if (filter.time_start) range.gte = filter.time_start;
          if (filter.time_end) range.lte = filter.time_end;
          must.push({ range: { timestamp: range } });
        }
        if (filter.source_ip) {
          must.push({ term: { source_ip: filter.source_ip } });
        }
        if (filter.destination_ip) {
          must.push({ term: { destination_ip: filter.destination_ip } });
        }
        if (filter.protocol) {
          must.push({ term: { protocol: filter.protocol.toLowerCase() } });
        }
        if (filter.service) {
          must.push({ term: { service: filter.service.toLowerCase() } });
        }

        const query = must.length ? { bool: { must } } : { match_all: {} };

        const res = await opensearchClient.search({
          index: INDEX_EVENTS,
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

        const items: NetworkEvent[] = hits.map((h: any) => h._source);

        return {
          items,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1
        };
      } catch (err: any) {
        logger.debug(`OpenSearch find query failed, fallback to memory: ${err.message}`);
      }
    }

    // Memory query fallback
    let items = Array.from(this.memoryStore.values());

    if (filter.time_start) {
      const startTime = new Date(filter.time_start).getTime();
      items = items.filter(e => new Date(e.timestamp).getTime() >= startTime);
    }
    if (filter.time_end) {
      const endTime = new Date(filter.time_end).getTime();
      items = items.filter(e => new Date(e.timestamp).getTime() <= endTime);
    }
    if (filter.source_ip) {
      items = items.filter(e => e.source_ip === filter.source_ip);
    }
    if (filter.destination_ip) {
      items = items.filter(e => e.destination_ip === filter.destination_ip);
    }
    if (filter.protocol) {
      items = items.filter(e => e.protocol?.toLowerCase() === filter.protocol?.toLowerCase());
    }
    if (filter.service) {
      items = items.filter(e => e.service?.toLowerCase() === filter.service?.toLowerCase());
    }

    // Sort descending by timestamp
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
        const res = await opensearchClient.count({ index: INDEX_EVENTS });
        return res.body?.count ?? this.memoryStore.size;
      } catch (err: any) {
        logger.debug(`OpenSearch count failed: ${err.message}`);
      }
    }
    return this.memoryStore.size;
  }

  async getTopTalkers(limit = 5): Promise<{
    sourceIps: Array<{ ip: string; count: number }>;
    destIps: Array<{ ip: string; count: number }>;
  }> {
    if (isOpenSearchConnected()) {
      try {
        const res: any = await (opensearchClient as any).search({
          index: INDEX_EVENTS,
          body: {
            size: 0,
            aggs: {
              top_sources: {
                terms: { field: 'source_ip', size: limit }
              },
              top_destinations: {
                terms: { field: 'destination_ip', size: limit }
              }
            }
          }
        });

        const aggs: any = res.body?.aggregations;
        const sourceIps = aggs?.top_sources?.buckets?.map((b: any) => ({
          ip: b.key,
          count: b.doc_count
        })) || [];
        const destIps = aggs?.top_destinations?.buckets?.map((b: any) => ({
          ip: b.key,
          count: b.doc_count
        })) || [];

        return { sourceIps, destIps };
      } catch (err: any) {
        logger.debug(`OpenSearch aggs failed: ${err.message}`);
      }
    }

    // In-memory aggregation
    const srcMap = new Map<string, number>();
    const dstMap = new Map<string, number>();

    for (const e of this.memoryStore.values()) {
      srcMap.set(e.source_ip, (srcMap.get(e.source_ip) || 0) + 1);
      dstMap.set(e.destination_ip, (dstMap.get(e.destination_ip) || 0) + 1);
    }

    const sourceIps = Array.from(srcMap.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const destIps = Array.from(dstMap.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return { sourceIps, destIps };
  }

  // Clear memory cache (useful for test isolation)
  clearMemory(): void {
    this.memoryStore.clear();
  }
}

export const eventRepository = new OpenSearchEventRepository();
