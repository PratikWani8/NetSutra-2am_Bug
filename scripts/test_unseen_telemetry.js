#!/usr/bin/env node

/**
 * NetSutra — Unseen Network Telemetry & Ingestion Robustness Verification Suite
 *
 * Tests the system's ability to process previously unseen network events
 * through the existing ingestion pipeline without modifying application code.
 *
 * Verification Areas:
 *  1. Unseen Benign Telemetry Ingestion (Schema validation, normalization, storage)
 *  2. Unseen Anomalous Telemetry Ingestion (Heuristic volume deviation & port scan)
 *  3. Behavioral Anomaly Detection Verification (Detector evaluation of benign vs anomalous)
 *  4. Idempotent Deduplication (Re-submitting duplicate UID does not inflate counts)
 *  5. Edge Cases & Fault Injection:
 *     - Missing required fields (missing IPs safely rejected)
 *     - Invalid payload schema (non-event objects rejected with HTTP 400)
 *     - Malformed JSON lines (gracefully skipped in NDJSON parsing)
 *     - Out-of-range measurements (normalized safely without crashing)
 *  6. Data Isolation Verification (Confirms valid stored data remains uncorrupted)
 *
 * Usage:
 *   node scripts/test_unseen_telemetry.js
 */

const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

// Load production Express app
const { app } = require('../server/dist/app');
const { parseZeekLogs } = require('../server/dist/utils/normalizer');

// In-memory HTTP request dispatcher for standard Express execution
function dispatchRequest(method, url, payload = null, headers = {}) {
  return new Promise((resolve) => {
    const req = new http.IncomingMessage();
    req.method = method;
    req.url = url;
    req.headers = { host: 'localhost', ...headers };

    let bodyStr = null;
    if (payload !== null) {
      bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
      if (!req.headers['content-type']) {
        req.headers['content-type'] = 'application/json';
      }
      req.headers['content-length'] = Buffer.byteLength(bodyStr);
    }

    const res = new http.ServerResponse(req);
    let responseData = '';

    res.write = function (chunk) {
      responseData += chunk;
      return true;
    };

    res.end = function (chunk) {
      if (chunk) responseData += chunk;
      let parsed = responseData;
      try {
        parsed = JSON.parse(responseData);
      } catch {
        // Keep string if not JSON
      }
      resolve({
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: res.getHeaders ? res.getHeaders() : {},
        body: parsed,
        rawBody: responseData,
      });
    };

    if (bodyStr !== null) {
      req.push(bodyStr);
      req.push(null);
    } else {
      req.push(null);
    }

    app.handle(req, res);
  });
}

// Executes Python detector on a candidate event batch
function evaluateWithPythonDetector(events) {
  const pythonScript = `
import sys, json
sys.path.insert(0, 'ai-service')
from detection.detector import AnomalyDetectorService
from schemas.telemetry import NetworkEvent
from schemas.anomaly import DetectionRequest
from datetime import datetime, timezone

raw_events = json.loads(sys.argv[1])
events = []
for r in raw_events:
    ev = NetworkEvent(
        event_id=r.get('uid') or r.get('event_id') or 'ev-1',
        timestamp=datetime.fromtimestamp(r['ts'], tz=timezone.utc),
        source_ip=r['id.orig_h'],
        destination_ip=r['id.resp_h'],
        source_port=r.get('id.orig_p'),
        destination_port=r.get('id.resp_p'),
        protocol=r.get('proto'),
        service=r.get('service'),
        outbound_bytes=r.get('orig_bytes'),
        inbound_bytes=r.get('resp_bytes'),
        duration=r.get('duration'),
        conn_state=r.get('conn_state')
    )
    events.append(ev)

detector = AnomalyDetectorService()
req = DetectionRequest(events=events, baseline_events=[])
res = detector.detect(req)

out = {
    "total_events_analyzed": res.total_events_analyzed,
    "anomalies_detected": res.anomalies_detected,
    "anomalies": [
        {
            "anomaly_id": a.anomaly_id,
            "method": a.method,
            "severity": a.severity.value,
            "score": a.score,
            "reasons": a.reasons
        } for a in res.anomalies
    ]
}
print(json.dumps(out))
`;

  const proc = spawnSync('python', ['-c', pythonScript, JSON.stringify(events)], {
    encoding: 'utf8',
  });

  if (proc.status !== 0) {
    throw new Error(`Python detector execution failed: ${proc.stderr}`);
  }

  return JSON.parse(proc.stdout.trim());
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('  NetSutra Unseen Telemetry & Ingestion Robustness Test Suite');
  console.log('========================================================================');
  console.log('Target API:       Existing Ingestion Endpoint (/api/events/ingest)');
  console.log('Target Storage:   Event Repository (/api/events)');
  console.log('Detector Engine:  AnomalyDetectorService (Unsupervised Isolation Forest)');
  console.log('Mode:             Application Code Unmodified (Strict Re-use)');
  console.log('------------------------------------------------------------------------\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, description, details = '') {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passedTests++;
    } else {
      console.log(`  ✗ FAIL: ${description}`);
      if (details) console.log(`    Detail: ${details}`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: Unseen Benign Network Event
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Ingesting Unseen Benign Network Event');
  console.log('Payload Type: Synthetic Test Fixture (Clearly Labeled)');

  const unseenBenignEvent = {
    _label: 'SYNTHETIC TEST FIXTURE: UNSEEN BENCHMARK BENIGN',
    ts: 1792851200.0,
    uid: 'unseen-benign-evt-001',
    'id.orig_h': '10.199.42.10', // Completely new source IP not used in demo
    'id.orig_p': 49880,
    'id.resp_h': '198.51.100.155', // Completely new destination IP not used in demo
    'id.resp_p': 443,
    proto: 'tcp',
    service: 'ssl',
    duration: 1.85,
    orig_bytes: 42500, // 42.5 KB (Normal web traffic, below 10MB heuristic)
    resp_bytes: 185000,
    conn_state: 'SF',
    history: 'ShADadFf',
    missed_bytes: 0,
  };

  console.log(`  Submitting event UID: ${unseenBenignEvent.uid} (${unseenBenignEvent['id.orig_h']} -> ${unseenBenignEvent['id.resp_h']})`);
  const postRes1 = await dispatchRequest('POST', '/api/events/ingest', [unseenBenignEvent]);

  assert(
    postRes1.statusCode === 201,
    'Ingestion endpoint returns HTTP 201 Created for valid unseen event',
    `Received status ${postRes1.statusCode}`
  );
  assert(
    postRes1.body?.data?.ingested_events === 1,
    'Ingestion response confirms 1 event ingested',
    JSON.stringify(postRes1.body)
  );

  // Storage Verification via GET /api/events
  console.log('\n[TEST 1.1] Verifying Storage & Schema Normalization in Repository');
  const getRes1 = await dispatchRequest('GET', `/api/events?source_ip=${unseenBenignEvent['id.orig_h']}`);

  assert(getRes1.statusCode === 200, 'GET /api/events returns HTTP 200 OK');
  const retrievedEvent = getRes1.body?.data?.items?.find((e) => e.event_id === unseenBenignEvent.uid);
  assert(
    !!retrievedEvent,
    `Retrieved stored event matches submitted UID '${unseenBenignEvent.uid}'`,
    `Items found: ${getRes1.body?.data?.items?.length || 0}`
  );
  assert(
    retrievedEvent?.source_ip === '10.199.42.10' &&
    retrievedEvent?.destination_ip === '198.51.100.155' &&
    retrievedEvent?.source_port === 49880 &&
    retrievedEvent?.destination_port === 443 &&
    retrievedEvent?.outbound_bytes === 42500 &&
    retrievedEvent?.conn_state === 'SF',
    'Stored record strictly adheres to normalized schema without corrupted fields'
  );

  // -------------------------------------------------------------------------
  // TEST 2: Detection Evaluation on Benign Event
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Evaluating Unseen Benign Event against Behavioral Detector');
  const benignDetection = evaluateWithPythonDetector([unseenBenignEvent]);
  console.log(`  Detector Output: ${benignDetection.anomalies_detected} anomalies detected from ${benignDetection.total_events_analyzed} event(s).`);
  assert(
    benignDetection.anomalies_detected === 0,
    'Detector correctly DOES NOT trigger alerts for normal baseline traffic (under 10MB heuristic, state SF)'
  );

  // -------------------------------------------------------------------------
  // TEST 3: Unseen Anomalous Events (Should Trigger Detector)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Ingesting & Evaluating Unseen Anomalous Network Events');
  console.log('Scenario A: 48 MB Outbound Exfiltration Flow');

  const unseenExfilEvent = {
    _label: 'SYNTHETIC TEST FIXTURE: UNSEEN EXFILTRATION OUTLIER',
    ts: 1792851210.0,
    uid: 'unseen-exfil-evt-002',
    'id.orig_h': '10.199.42.10',
    'id.orig_p': 49882,
    'id.resp_h': '203.0.113.240', // External unknown host
    'id.resp_p': 8443,
    proto: 'tcp',
    service: 'ssl',
    duration: 68.4,
    orig_bytes: 48000000, // 48 MB (Massive outlier exceeding 10MB heuristic limit)
    resp_bytes: 12000,
    conn_state: 'SF',
  };

  const postRes3A = await dispatchRequest('POST', '/api/events/ingest', [unseenExfilEvent]);
  assert(postRes3A.statusCode === 201, 'Anomalous exfiltration flow successfully ingested via HTTP 201');

  const exfilDetection = evaluateWithPythonDetector([unseenExfilEvent]);
  console.log(`  Detector Output: ${exfilDetection.anomalies_detected} anomalies detected.`);
  assert(
    exfilDetection.anomalies_detected >= 1,
    'Detector successfully flags high-volume deviation anomaly for unseen exfiltration event'
  );
  const volumeAnomaly = exfilDetection.anomalies.find((a) => a.method === 'outbound_volume_deviation');
  assert(
    !!volumeAnomaly && volumeAnomaly.score >= 0.60,
    `Volume deviation rule fired with expected score (Score: ${volumeAnomaly?.score})`
  );

  console.log('Scenario B: Horizontal Port Scan Reconnaissance (Repeated Connection Failures)');
  const unseenScanEvents = [
    { ts: 1792851220.0, uid: 'unseen-scan-001', 'id.orig_h': '10.199.42.10', 'id.orig_p': 49890, 'id.resp_h': '192.168.99.1', 'id.resp_p': 22, proto: 'tcp', orig_bytes: 0, resp_bytes: 0, conn_state: 'REJ' },
    { ts: 1792851221.0, uid: 'unseen-scan-002', 'id.orig_h': '10.199.42.10', 'id.orig_p': 49891, 'id.resp_h': '192.168.99.1', 'id.resp_p': 80, proto: 'tcp', orig_bytes: 0, resp_bytes: 0, conn_state: 'REJ' },
    { ts: 1792851222.0, uid: 'unseen-scan-003', 'id.orig_h': '10.199.42.10', 'id.orig_p': 49892, 'id.resp_h': '192.168.99.1', 'id.resp_p': 445, proto: 'tcp', orig_bytes: 0, resp_bytes: 0, conn_state: 'REJ' },
    { ts: 1792851223.0, uid: 'unseen-scan-004', 'id.orig_h': '10.199.42.10', 'id.orig_p': 49893, 'id.resp_h': '192.168.99.1', 'id.resp_p': 3389, proto: 'tcp', orig_bytes: 0, resp_bytes: 0, conn_state: 'REJ' },
  ];

  const postRes3B = await dispatchRequest('POST', '/api/events/ingest', unseenScanEvents);
  assert(postRes3B.statusCode === 201 && postRes3B.body?.data?.ingested_events === 4, 'Batch scan events ingested via HTTP 201');

  const scanDetection = evaluateWithPythonDetector(unseenScanEvents);
  console.log(`  Detector Output: ${scanDetection.anomalies_detected} anomalies detected.`);
  assert(
    scanDetection.anomalies_detected >= 1,
    'Detector successfully flags failed connection pattern anomaly for repeated REJ states'
  );
  const scanAnomaly = scanDetection.anomalies.find((a) => a.method === 'failed_connection_pattern');
  assert(
    !!scanAnomaly && scanAnomaly.score >= 0.70,
    `Failed connection pattern rule fired with expected score (Score: ${scanAnomaly?.score})`
  );

  // -------------------------------------------------------------------------
  // TEST 4: Idempotent Deduplication (Submitting Duplicate Events)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing Idempotent Deduplication on Re-submission');
  const duplicateSubmission = await dispatchRequest('POST', '/api/events/ingest', [unseenBenignEvent]);
  assert(duplicateSubmission.statusCode === 201, 'Re-submitting existing event returns HTTP 201 without throwing error');

  const getRes4 = await dispatchRequest('GET', `/api/events?source_ip=${unseenBenignEvent['id.orig_h']}`);
  const matchingEvents = (getRes4.body?.data?.items || []).filter((e) => e.event_id === unseenBenignEvent.uid);
  assert(
    matchingEvents.length === 1,
    `Repository correctly deduplicates by event ID: exactly 1 record exists for UID '${unseenBenignEvent.uid}' (no inflation)`,
    `Found count: ${matchingEvents.length}`
  );

  // -------------------------------------------------------------------------
  // TEST 5: Edge Cases, Malformed Payloads & Schema Violations
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing Edge Cases & Schema Violation Handling');

  // 5a. Missing Required Fields (Missing IP addresses)
  console.log('Scenario 5a: Missing Source and Destination IPs');
  const missingIpRecord = {
    ts: 1792851230.0,
    uid: 'invalid-missing-ip',
    orig_bytes: 1200,
    resp_bytes: 3400,
  };
  const postRes5A = await dispatchRequest('POST', '/api/events/ingest', [missingIpRecord]);
  assert(
    postRes5A.statusCode === 201 && postRes5A.body?.data?.ingested_events === 0,
    'Record with missing IP addresses is safely rejected (ingested_events: 0) without server crash',
    JSON.stringify(postRes5A.body)
  );

  // 5b. Invalid Payload Root Structure (Non-event object without 'events' array)
  console.log('Scenario 5b: Invalid Payload Root Structure ({ not_events: true })');
  const postRes5B = await dispatchRequest('POST', '/api/events/ingest', { not_events: true, arbitrary_data: 12345 });
  assert(
    postRes5B.statusCode === 400,
    'Non-event payload rejected with HTTP 400 Bad Request',
    `Status: ${postRes5B.statusCode}`
  );
  assert(
    postRes5B.body?.error?.code === 'INVALID_PAYLOAD',
    `Useful error code returned: '${postRes5B.body?.error?.code}' - "${postRes5B.body?.error?.message}"`
  );

  // 5c. Empty Body Object
  console.log('Scenario 5c: Empty Payload Object ({})');
  const postRes5C = await dispatchRequest('POST', '/api/events/ingest', {});
  assert(
    postRes5C.statusCode === 400 && postRes5C.body?.error?.code === 'INVALID_PAYLOAD',
    'Empty JSON object rejected with HTTP 400 INVALID_PAYLOAD'
  );

  // 5d. Malformed JSON Lines in NDJSON Parser
  console.log('Scenario 5d: Malformed NDJSON String Content Handling');
  const rawNdjson = [
    '# Zeek Header Comment',
    '{"ts":1792851240.0,"uid":"valid-ndjson-001","id.orig_h":"10.199.42.20","id.resp_h":"198.51.100.200","proto":"tcp","orig_bytes":500}',
    '{"ts":1792851241.0, "uid": "corrupted", INVALID_JSON_SYNTAX_HERE', // Corrupt line
    '{"ts":1792851242.0,"uid":"valid-ndjson-002","id.orig_h":"10.199.42.20","id.resp_h":"198.51.100.201","proto":"tcp","orig_bytes":600}',
  ].join('\n');

  const parsedEvents = parseZeekLogs(rawNdjson);
  assert(
    parsedEvents.length === 2,
    `Zeek parser gracefully skips malformed line, retaining both valid events (${parsedEvents.length}/2)`,
    `Parsed count: ${parsedEvents.length}`
  );
  assert(
    parsedEvents[0].event_id === 'valid-ndjson-001' && parsedEvents[1].event_id === 'valid-ndjson-002',
    'Valid events in NDJSON payload are correctly extracted without corruption'
  );

  // Ingest via raw valid event array extracted from NDJSON
  const rawValidEvents = [
    { ts: 1792851240.0, uid: 'valid-ndjson-001', 'id.orig_h': '10.199.42.20', 'id.resp_h': '198.51.100.200', proto: 'tcp', orig_bytes: 500 },
    { ts: 1792851242.0, uid: 'valid-ndjson-002', 'id.orig_h': '10.199.42.20', 'id.resp_h': '198.51.100.201', proto: 'tcp', orig_bytes: 600 },
  ];
  const postRes5D = await dispatchRequest('POST', '/api/events/ingest', rawValidEvents);
  assert(postRes5D.statusCode === 201 && postRes5D.body?.data?.ingested_events === 2, 'Parsed valid events ingested successfully via HTTP 201');

  // 5e. Out-of-Range Measurements
  console.log('Scenario 5e: Out-of-range non-numeric Port and String Bytes');
  const weirdTypesEvent = {
    ts: 1792851250.0,
    uid: 'unseen-types-evt',
    'id.orig_h': '10.199.42.30',
    'id.resp_h': '198.51.100.250',
    'id.orig_p': 'non_numeric_port', // Invalid port type
    proto: 'tcp',
    orig_bytes: 'not_a_number', // Invalid bytes
    conn_state: 'SF',
  };
  const postRes5E = await dispatchRequest('POST', '/api/events/ingest', [weirdTypesEvent]);
  assert(
    postRes5E.statusCode === 201,
    'Event with non-numeric fields is safely parsed and normalized without throwing unhandled exceptions'
  );

  // -------------------------------------------------------------------------
  // TEST 6: Data Integrity & Non-corruption Verification
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Confirming Valid Stored Data Remains Completely Uncorrupted');
  const finalCheck = await dispatchRequest('GET', `/api/events?source_ip=${unseenBenignEvent['id.orig_h']}`);
  const event1Check = finalCheck.body?.data?.items?.find((e) => e.event_id === unseenBenignEvent.uid);
  assert(
    event1Check &&
    event1Check.source_ip === '10.199.42.10' &&
    event1Check.destination_ip === '198.51.100.155' &&
    event1Check.outbound_bytes === 42500,
    'Initial valid record remains unaltered and intact after all fault-injection tests'
  );

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log('  Test Execution Summary');
  console.log('========================================================================');
  console.log(`Total Assertions Evaluated: ${totalTests}`);
  console.log(`Passed:                     ${passedTests}`);
  console.log(`Failed:                     ${totalTests - passedTests}`);
  console.log(`Success Rate:               ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('========================================================================\n');

  if (passedTests === totalTests) {
    console.log('✓ All verification criteria satisfied. System processed unseen telemetry cleanly without application code changes.\n');
    process.exit(0);
  } else {
    console.error('✗ Some assertions failed.');
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
