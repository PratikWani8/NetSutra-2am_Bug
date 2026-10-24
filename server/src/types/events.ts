export interface NetworkEvent {
  event_id: string;
  timestamp: string; // ISO 8601 UTC
  source_ip: string;
  destination_ip: string;
  source_port?: number | null;
  destination_port?: number | null;
  protocol?: string | null;
  service?: string | null;
  outbound_bytes?: number | null;
  inbound_bytes?: number | null;
  duration?: number | null;
  conn_state?: string | null;
  history?: string | null;
  missed_bytes?: number | null;
  metadata?: Record<string, any>;
}

export interface ZeekRawEvent {
  uid?: string;
  id?: string | { orig_h?: string; orig_p?: number; resp_h?: string; resp_p?: number };
  'id.orig_h'?: string;
  'id.orig_p'?: number | string;
  'id.resp_h'?: string;
  'id.resp_p'?: number | string;
  orig_h?: string;
  orig_p?: number | string;
  resp_h?: string;
  resp_p?: number | string;
  src_ip?: string;
  dest_ip?: string;
  src_port?: number | string;
  dest_port?: number | string;
  ts?: number | string;
  proto?: string;
  protocol?: string;
  service?: string;
  orig_bytes?: number | string;
  orig_ip_bytes?: number | string;
  sent_bytes?: number | string;
  resp_bytes?: number | string;
  resp_ip_bytes?: number | string;
  received_bytes?: number | string;
  duration?: number | string;
  conn_state?: string;
  state?: string;
  history?: string;
  missed_bytes?: number | string;
  [key: string]: any;
}

export interface EventQueryFilter {
  time_start?: string;
  time_end?: string;
  source_ip?: string;
  destination_ip?: string;
  protocol?: string;
  service?: string;
  page?: number;
  limit?: number;
}
