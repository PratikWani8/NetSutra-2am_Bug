import { normalizeZeekEvent, parseZeekLogs, generateStableEventId } from '../../src/utils/normalizer';

describe('Zeek Normalizer Unit Tests', () => {
  it('should normalize standard Zeek conn.log fields accurately', () => {
    const raw = {
      ts: 1792843200.5,
      uid: 'CHkAvZ1YdQj12401',
      'id.orig_h': '192.168.1.50',
      'id.orig_p': 51234,
      'id.resp_h': '93.184.216.34',
      'id.resp_p': 443,
      proto: 'tcp',
      service: 'ssl',
      duration: 1.25,
      orig_bytes: 4096,
      resp_bytes: 16384,
      conn_state: 'SF',
      history: 'ShADadFf',
      missed_bytes: 0
    };

    const event = normalizeZeekEvent(raw);
    expect(event).not.toBeNull();
    expect(event?.event_id).toBe('CHkAvZ1YdQj12401');
    expect(event?.source_ip).toBe('192.168.1.50');
    expect(event?.destination_ip).toBe('93.184.216.34');
    expect(event?.source_port).toBe(51234);
    expect(event?.destination_port).toBe(443);
    expect(event?.protocol).toBe('tcp');
    expect(event?.service).toBe('ssl');
    expect(event?.outbound_bytes).toBe(4096);
    expect(event?.inbound_bytes).toBe(16384);
    expect(event?.duration).toBe(1.25);
    expect(event?.conn_state).toBe('SF');
    expect(event?.packets).toBe(8); // history 'ShADadFf'.length
  });

  it('should calculate packets from orig_pkts and resp_pkts when present', () => {
    const rawWithPkts = {
      ts: 1792843200.0,
      uid: 'pkt-test-001',
      'id.orig_h': '192.0.2.10',
      'id.resp_h': '198.51.100.1',
      orig_pkts: 1500,
      resp_pkts: 250,
      history: 'ShADadFf'
    };

    const event = normalizeZeekEvent(rawWithPkts);
    expect(event?.packets).toBe(1750);
    expect(event?.orig_pkts).toBe(1500);
    expect(event?.resp_pkts).toBe(250);
  });

  it('should leave missing fields unavailable (null/undefined) rather than fabricating values', () => {
    const rawSparse = {
      ts: 1792843200.0,
      'id.orig_h': '10.0.0.5',
      'id.resp_h': '10.0.0.1'
    };

    const event = normalizeZeekEvent(rawSparse);
    expect(event).not.toBeNull();
    expect(event?.source_ip).toBe('10.0.0.5');
    expect(event?.destination_ip).toBe('10.0.0.1');
    expect(event?.source_port).toBeNull();
    expect(event?.destination_port).toBeNull();
    expect(event?.service).toBeNull();
    expect(event?.outbound_bytes).toBeNull();
    expect(event?.inbound_bytes).toBeNull();
    expect(event?.conn_state).toBeNull();
  });

  it('should generate deterministic, stable IDs when uid is absent', () => {
    const rawNoUid = {
      ts: 1792843200.0,
      'id.orig_h': '192.168.1.20',
      'id.orig_p': 1234,
      'id.resp_h': '10.0.0.1',
      'id.resp_p': 80,
      proto: 'tcp'
    };

    const event1 = normalizeZeekEvent(rawNoUid);
    const event2 = normalizeZeekEvent(rawNoUid);

    expect(event1?.event_id).toBeDefined();
    expect(event1?.event_id).toBe(event2?.event_id);
  });

  it('should parse newline-delimited JSON logs (NDJSON)', () => {
    const ndjson = `
{"ts":1792843200.1,"uid":"UID01","id.orig_h":"192.168.1.1","id.resp_h":"10.0.0.1"}
# Comment line should be ignored
{"ts":1792843201.2,"uid":"UID02","id.orig_h":"192.168.1.2","id.resp_h":"10.0.0.2"}
`;
    const events = parseZeekLogs(ndjson);
    expect(events.length).toBe(2);
    expect(events[0].event_id).toBe('UID01');
    expect(events[1].event_id).toBe('UID02');
  });

  it('should parse standard JSON array logs', () => {
    const jsonArray = JSON.stringify([
      { ts: 1792843200.1, uid: 'ARR01', 'id.orig_h': '192.168.1.1', 'id.resp_h': '10.0.0.1' },
      { ts: 1792843202.3, uid: 'ARR02', 'id.orig_h': '192.168.1.2', 'id.resp_h': '10.0.0.2' }
    ]);
    const events = parseZeekLogs(jsonArray);
    expect(events.length).toBe(2);
    expect(events[0].event_id).toBe('ARR01');
    expect(events[1].event_id).toBe('ARR02');
  });
});
