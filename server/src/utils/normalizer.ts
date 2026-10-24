import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { NetworkEvent, ZeekRawEvent } from '../types/events';

/**
 * Deterministically generates or extracts a stable event ID.
 * If Zeek `uid` is present, it is used directly.
 * Otherwise, a SHA-256 hash (truncated to 16 hex characters) of stable connection tuples is used.
 */
export function generateStableEventId(raw: ZeekRawEvent, tsIso: string): string {
  if (raw.event_id && typeof raw.event_id === 'string') {
    return raw.event_id;
  }
  if (raw.uid && typeof raw.uid === 'string') {
    return raw.uid;
  }
  if (typeof raw.id === 'string' && raw.id) {
    return raw.id;
  }

  // Extract connection tuple
  const origH = raw['id.orig_h'] ?? raw.orig_h ?? raw.src_ip ?? (typeof raw.id === 'object' ? raw.id?.orig_h : '');
  const respH = raw['id.resp_h'] ?? raw.resp_h ?? raw.dest_ip ?? (typeof raw.id === 'object' ? raw.id?.resp_h : '');
  const origP = raw['id.orig_p'] ?? raw.orig_p ?? raw.src_port ?? (typeof raw.id === 'object' ? raw.id?.orig_p : '');
  const respP = raw['id.resp_p'] ?? raw.resp_p ?? raw.dest_port ?? (typeof raw.id === 'object' ? raw.id?.resp_p : '');
  const proto = raw.proto ?? raw.protocol ?? '';

  if (origH && respH) {
    const rawTuple = `${tsIso}|${origH}|${origP}|${respH}|${respP}|${proto}`;
    const hash = crypto.createHash('sha256').update(rawTuple).digest('hex').substring(0, 16);
    return `event-${hash}`;
  }

  return `event-${uuidv4().replace(/-/g, '').substring(0, 16)}`;
}

/**
 * Normalizes a raw timestamp (Zeek epoch seconds float, string, or Date) to ISO 8601 UTC.
 */
export function normalizeTimestamp(rawTs: any): string {
  if (!rawTs) {
    return new Date().toISOString();
  }
  if (typeof rawTs === 'number') {
    // If epoch seconds (standard Zeek), multiply by 1000
    const ms = rawTs < 1e11 ? rawTs * 1000 : rawTs;
    return new Date(ms).toISOString();
  }
  if (typeof rawTs === 'string') {
    const num = parseFloat(rawTs);
    if (!isNaN(num) && !rawTs.includes('T') && !rawTs.includes('-')) {
      const ms = num < 1e11 ? num * 1000 : num;
      return new Date(ms).toISOString();
    }
    const d = new Date(rawTs);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  return new Date().toISOString();
}

/**
 * Parses and normalizes a single raw Zeek record into a NetworkEvent.
 * Leaves missing fields unavailable (null/undefined) rather than fabricating values.
 */
export function normalizeZeekEvent(raw: ZeekRawEvent): NetworkEvent | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  // 1. Source IP
  const sourceIp =
    raw['id.orig_h'] ??
    raw.orig_h ??
    raw.src_ip ??
    raw.source ??
    (typeof raw.id === 'object' ? raw.id?.orig_h : null);

  // 2. Destination IP
  const destinationIp =
    raw['id.resp_h'] ??
    raw.resp_h ??
    raw.dest_ip ??
    raw.destination ??
    (typeof raw.id === 'object' ? raw.id?.resp_h : null);

  // In Zeek conn.log, source and destination IP are required to define a network event
  if (!sourceIp || !destinationIp) {
    return null;
  }

  // 3. Timestamp
  const timestamp = normalizeTimestamp(raw.ts ?? raw.timestamp);

  // 4. Stable Event ID
  const eventId = generateStableEventId(raw, timestamp);

  // 5. Ports
  const rawOrigP =
    raw['id.orig_p'] ??
    raw.orig_p ??
    raw.src_port ??
    (typeof raw.id === 'object' ? raw.id?.orig_p : null);
  const sourcePort = rawOrigP !== null && rawOrigP !== undefined && rawOrigP !== '-' ? Number(rawOrigP) : null;

  const rawRespP =
    raw['id.resp_p'] ??
    raw.resp_p ??
    raw.dest_port ??
    (typeof raw.id === 'object' ? raw.id?.resp_p : null);
  const destinationPort = rawRespP !== null && rawRespP !== undefined && rawRespP !== '-' ? Number(rawRespP) : null;

  // 6. Protocol
  const rawProto = raw.proto ?? raw.protocol;
  const protocol = rawProto && rawProto !== '-' ? String(rawProto).toLowerCase() : null;

  // 7. Service
  const rawService = raw.service;
  const service = rawService && rawService !== '-' ? String(rawService).toLowerCase() : null;

  // 8. Bytes
  const rawOutbound = raw.orig_bytes ?? raw.orig_ip_bytes ?? raw.sent_bytes ?? raw.outbound_bytes;
  const outboundBytes = rawOutbound !== null && rawOutbound !== undefined && rawOutbound !== '-' ? Number(rawOutbound) : null;

  const rawInbound = raw.resp_bytes ?? raw.resp_ip_bytes ?? raw.received_bytes ?? raw.inbound_bytes;
  const inboundBytes = rawInbound !== null && rawInbound !== undefined && rawInbound !== '-' ? Number(rawInbound) : null;

  // 9. Duration
  const rawDuration = raw.duration;
  const duration = rawDuration !== null && rawDuration !== undefined && rawDuration !== '-' ? Number(rawDuration) : null;

  // 10. Connection state
  const rawState = raw.conn_state ?? raw.state;
  const connState = rawState && rawState !== '-' ? String(rawState) : null;

  // 11. History
  const rawHistory = raw.history;
  const history = rawHistory && rawHistory !== '-' ? String(rawHistory) : null;

  // 12. Missed bytes
  const rawMissed = raw.missed_bytes;
  const missedBytes = rawMissed !== null && rawMissed !== undefined && rawMissed !== '-' ? Number(rawMissed) : null;

  // 13. Metadata: keep any remaining non-standard keys
  const standardKeys = new Set([
    'event_id', 'timestamp', 'source_ip', 'destination_ip', 'source_port', 'destination_port',
    'protocol', 'service', 'outbound_bytes', 'inbound_bytes', 'duration', 'conn_state',
    'history', 'missed_bytes', 'id', 'id.orig_h', 'id.orig_p', 'id.resp_h', 'id.resp_p',
    'orig_h', 'orig_p', 'resp_h', 'resp_p', 'src_ip', 'dest_ip', 'src_port', 'dest_port',
    'ts', 'proto', 'orig_bytes', 'resp_bytes', 'orig_ip_bytes', 'resp_ip_bytes', 'sent_bytes',
    'received_bytes', 'state', 'uid'
  ]);

  const metadata: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!standardKeys.has(key) && value !== '-' && value !== undefined) {
      metadata[key] = value;
    }
  }

  return {
    event_id: eventId,
    timestamp,
    source_ip: String(sourceIp),
    destination_ip: String(destinationIp),
    source_port: isNaN(sourcePort as number) ? null : sourcePort,
    destination_port: isNaN(destinationPort as number) ? null : destinationPort,
    protocol,
    service,
    outbound_bytes: isNaN(outboundBytes as number) ? null : outboundBytes,
    inbound_bytes: isNaN(inboundBytes as number) ? null : inboundBytes,
    duration: isNaN(duration as number) ? null : duration,
    conn_state: connState,
    history,
    missed_bytes: isNaN(missedBytes as number) ? null : missedBytes,
    ...(Object.keys(metadata).length > 0 ? { metadata } : {})
  };
}

/**
 * Parses raw text content containing Zeek logs (JSON array or newline-delimited JSON lines).
 */
export function parseZeekLogs(content: string): NetworkEvent[] {
  const trimmed = content.trim();
  if (!trimmed) {
    return [];
  }

  const events: NetworkEvent[] = [];

  // Check if JSON array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsedArray = JSON.parse(trimmed);
      if (Array.isArray(parsedArray)) {
        for (const item of parsedArray) {
          const normalized = normalizeZeekEvent(item);
          if (normalized) {
            events.push(normalized);
          }
        }
      }
      return events;
    } catch {
      // Fallback to line-by-line parsing if array parse fails
    }
  }

  // Parse line-by-line (NDJSON / JSONL format typical of Zeek json streaming)
  const lines = trimmed.split(/\r?\n/);
  for (const line of lines) {
    const lineTrimmed = line.trim();
    if (!lineTrimmed || lineTrimmed.startsWith('#')) {
      continue;
    }
    try {
      const parsed = JSON.parse(lineTrimmed);
      const normalized = normalizeZeekEvent(parsed);
      if (normalized) {
        events.push(normalized);
      }
    } catch {
      // Ignore invalid single line
    }
  }

  return events;
}
