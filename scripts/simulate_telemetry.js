#!/usr/bin/env node

/**
 * NetSutra - Automated Lab Telemetry Simulation & Progressive Replay Script
 *
 * Replays authorized Zeek connection logs into the NetSutra ingestion pipeline.
 * Supports streaming at a configurable pace, preserving original event timestamps
 * while logging separate wall-clock replay timestamps for real-time dashboard updates.
 *
 * Usage:
 *   node scripts/simulate_telemetry.js [options]
 *
 * Options:
 *   --file <path>        Path to Zeek log file (default: server/samples/lab_simulation_zeek.log)
 *   --url <endpoint>     Target ingestion endpoint (default: http://localhost:5000/api/events/ingest)
 *   --pace <ms>          Delay between records in milliseconds (default: 300, 0 for instant batch)
 *   --batch              Send all events in a single batch instead of streaming
 *   --test-resilience    Inject malformed lines and duplicate uids to test error handling
 *   --help               Show help menu
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const DEFAULT_LOG_FILE = path.resolve(__dirname, '../server/samples/lab_simulation_zeek.log');
const DEFAULT_ENDPOINT = 'http://localhost:5000/api/events/ingest';
const DEFAULT_PACE_MS = 300;

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: DEFAULT_LOG_FILE,
    url: DEFAULT_ENDPOINT,
    pace: DEFAULT_PACE_MS,
    batch: false,
    resilience: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
      case '-f':
        options.file = path.resolve(process.cwd(), args[++i]);
        break;
      case '--url':
      case '-u':
        options.url = args[++i];
        break;
      case '--pace':
      case '-p':
        options.pace = parseInt(args[++i], 10) || 0;
        break;
      case '--batch':
      case '-b':
        options.batch = true;
        options.pace = 0;
        break;
      case '--test-resilience':
      case '-r':
        options.resilience = true;
        break;
      case '--help':
      case '-h':
        console.log(`
NetSutra Lab Telemetry Replay Simulator

Options:
  --file, -f <path>       Zeek log file (default: server/samples/lab_simulation_zeek.log)
  --url, -u <url>         Ingestion API URL (default: http://localhost:5000/api/events/ingest)
  --pace, -p <ms>         Replay delay per record in ms (default: 300ms)
  --batch, -b             Send all records as a single batch
  --test-resilience, -r   Inject duplicate records and malformed lines to test stability
  --help, -h              Show this help message
        `);
        process.exit(0);
    }
  }

  return options;
}

function parseZeekEntries(filePath, injectResilience = false) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Log file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const entries = [];

  if (raw.startsWith('[') && raw.endsWith(']')) {
    const arr = JSON.parse(raw);
    for (const item of arr) {
      if (item && typeof item === 'object' && !item._comment) {
        entries.push(item);
      }
    }
  } else {
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      try {
        const item = JSON.parse(trimmed);
        if (item && typeof item === 'object') {
          entries.push(item);
        }
      } catch (err) {
        // Skip unparseable in source
      }
    }
  }

  if (injectResilience && entries.length > 0) {
    console.log('[Resilience Mode] Injecting duplicate event and malformed records...');
    // 1. Duplicate of the first event
    const duplicate = JSON.parse(JSON.stringify(entries[0]));
    // 2. Corrupt line marker
    const malformedEntry = { _malformed: true, raw: '{"ts": "corrupted_timestamp", missing_braces' };
    // 3. Entry missing required IPs
    const missingIpEntry = { ts: 1792849999.0, uid: 'lab-missing-ips', orig_bytes: 500 };

    entries.push(duplicate);
    entries.push(malformedEntry);
    entries.push(missingIpEntry);
  }

  return entries;
}

function sendHttpRequest(targetUrl, payload) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

    const req = http.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
        timeout: 15000,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch {
            resolve({ statusCode: res.statusCode, body: responseBody });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('HTTP request timed out after 15000ms'));
    });

    req.write(bodyStr);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms) {
  return (ms / 1000).toFixed(2) + 's';
}

async function runSimulation() {
  const options = parseArgs();
  console.log('========================================================================');
  console.log('  NetSutra Lab Telemetry Replay & Anomaly Detection Simulation');
  console.log('========================================================================');
  console.log(`Source File:       ${options.file}`);
  console.log(`Target Endpoint:   ${options.url}`);
  console.log(`Replay Pace:       ${options.batch ? 'Batch Mode (Instant)' : options.pace + 'ms / event'}`);
  console.log(`Resilience Test:   ${options.resilience ? 'ENABLED (Injecting duplicates & malformed entries)' : 'Disabled'}`);
  console.log('------------------------------------------------------------------------\n');

  let entries;
  try {
    entries = parseZeekEntries(options.file, options.resilience);
    console.log(`Loaded ${entries.length} candidate Zeek telemetry records.\n`);
  } catch (err) {
    console.error(`Failed to load telemetry file: ${err.message}`);
    process.exit(1);
  }

  const startTime = Date.now();
  let totalIngested = 0;
  let totalAnomalies = 0;
  let totalIncidents = 0;
  const detectorAlerts = [];

  if (options.batch) {
    console.log(`[Replay Mode: Batch] Sending all ${entries.length} records in a single payload...`);
    try {
      const res = await sendHttpRequest(options.url, entries);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const data = res.body.data || res.body;
        totalIngested = data.ingested_events || 0;
        totalAnomalies = data.anomalies_detected || (data.anomalies ? data.anomalies.length : 0);
        totalIncidents = data.incidents_created || (data.incidents ? data.incidents.length : 0);
        if (data.anomalies) detectorAlerts.push(...data.anomalies);
        console.log(`[Batch Success] HTTP ${res.statusCode} - Ingested: ${totalIngested}, Anomalies: ${totalAnomalies}, Incidents: ${totalIncidents}`);
      } else {
        console.error(`[Batch Error] HTTP ${res.statusCode}:`, res.body);
      }
    } catch (err) {
      console.warn(`[Batch Warning] Target service unreachable (${err.message}).`);
      console.log('Tip: Ensure the NetSutra backend is running with "npm run dev --prefix server" or run in direct test mode.');
    }
  } else {
    console.log('[Replay Mode: Progressive Streaming]');
    console.log('Streaming events progressively. Dashboard will update in real time via Socket.IO.\n');

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const elapsedWallClock = Date.now() - startTime;
      const originalTs = entry.ts ? new Date(entry.ts < 1e11 ? entry.ts * 1000 : entry.ts).toISOString() : 'N/A';
      const uid = entry.uid || entry.event_id || `rec-${i + 1}`;

      // Check if testing malformed entry
      let payload;
      if (entry._malformed) {
        console.log(`[Replay +${formatDuration(elapsedWallClock)}] [${i + 1}/${entries.length}] Injecting intentionally malformed line...`);
        payload = entry.raw;
      } else {
        console.log(
          `[Replay +${formatDuration(elapsedWallClock)}] [${i + 1}/${entries.length}] UID: ${uid.padEnd(20)} | Orig TS: ${originalTs} | Flow: ${entry['id.orig_h'] || entry.source_ip || '?'}:${entry['id.orig_p'] || '?'} -> ${entry['id.resp_h'] || entry.destination_ip || '?'}:${entry['id.resp_p'] || '?'}`
        );
        payload = [entry];
      }

      try {
        const res = await sendHttpRequest(options.url, payload);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const data = res.body.data || res.body;
          const ingested = data.ingested_events || 0;
          const anoms = data.anomalies_detected || (data.anomalies ? data.anomalies.length : 0);
          const incs = data.incidents_created || (data.incidents ? data.incidents.length : 0);
          totalIngested += ingested;
          totalAnomalies += anoms;
          totalIncidents += incs;
          if (data.anomalies && data.anomalies.length > 0) {
            detectorAlerts.push(...data.anomalies);
            for (const a of data.anomalies) {
              console.log(`    >>> [ALERT GENERATED] ${a.severity ? a.severity.toUpperCase() : 'ALERT'}: ${a.method} (Score: ${a.score})`);
            }
          }
        } else {
          console.log(`    --- [Server Response] HTTP ${res.statusCode}`);
        }
      } catch (err) {
        console.log(`    --- [Dispatch Failed] ${err.message}`);
      }

      if (options.pace > 0 && i < entries.length - 1) {
        await sleep(options.pace);
      }
    }
  }

  const totalTime = Date.now() - startTime;
  console.log('\n========================================================================');
  console.log('  Simulation Run Summary');
  console.log('========================================================================');
  console.log(`Elapsed Replay Wall Time:   ${formatDuration(totalTime)}`);
  console.log(`Records Submitted:          ${entries.length}`);
  console.log(`Records Ingested:           ${totalIngested}`);
  console.log(`Anomalies Flagged by AI:    ${totalAnomalies}`);
  console.log(`Incidents Correlated:       ${totalIncidents}`);
  console.log('========================================================================\n');
}

runSimulation();
