import fs from 'fs';
import path from 'path';
import { ingestionService } from '../services/ingestionService';
import { logger } from '../utils/logger';

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  let filePath = path.resolve(process.cwd(), 'samples/lab_simulation_zeek.log');
  let paceMs = 0;
  let testResilience = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--file' || arg === '-f') {
      filePath = path.resolve(process.cwd(), args[++i]);
    } else if (arg === '--pace' || arg === '-p') {
      paceMs = parseInt(args[++i], 10) || 0;
    } else if (arg === '--test-resilience' || arg === '-r') {
      testResilience = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
NetSutra CLI Ingestion & Simulation Tool

Usage:
  npx tsx src/scripts/ingestCli.ts [options] [path-to-zeek-file]

Options:
  --file, -f <path>       Zeek log file (default: samples/lab_simulation_zeek.log)
  --pace, -p <ms>         Streaming pace per record in ms (default: 0 / instant batch)
  --test-resilience, -r   Inject duplicate records and malformed lines to verify resilience
  --help, -h              Show this help menu
      `);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      filePath = path.resolve(process.cwd(), arg);
    }
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log('========================================================================');
  console.log('  NetSutra Direct Ingestion & Pipeline Simulation');
  console.log('========================================================================');
  console.log(`Source File:       ${filePath}`);
  console.log(`Replay Pace:       ${paceMs > 0 ? paceMs + 'ms per record' : 'Instant Batch'}`);
  console.log(`Resilience Test:   ${testResilience ? 'ENABLED (Injecting duplicates & malformed entries)' : 'Disabled'}`);
  console.log('------------------------------------------------------------------------\n');

  let content = fs.readFileSync(filePath, 'utf8');

  if (testResilience) {
    console.log('[Resilience] Appending malformed line and duplicate event to test error handling...');
    const duplicateLine = '{"ts":1792840000.0,"uid":"lab-sim-base-001","id.orig_h":"192.0.2.10","id.orig_p":40001,"id.resp_h":"198.51.100.1","id.resp_p":443,"proto":"tcp","orig_bytes":2500000}';
    const malformedLine = '{"ts": 1792849999.0, "uid": "corrupted", INVALID_JSON_SYNTAX_HERE';
    const missingIpLine = '{"ts": 1792849999.0, "uid": "missing-ip", "orig_bytes": 1000}';
    content += `\n${duplicateLine}\n${malformedLine}\n${missingIpLine}\n`;
  }

  const startTime = Date.now();

  try {
    if (paceMs > 0) {
      console.log('[Streaming Mode] Ingesting lines progressively at ' + paceMs + 'ms pace...');
      const lines = content.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
      let totalIngested = 0;
      let totalAnomalies = 0;
      let totalIncidents = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const res = await ingestionService.ingestZeekContent(line);
        totalIngested += res.ingested_events;
        totalAnomalies += res.anomalies_detected;
        totalIncidents += res.incidents_created;
        console.log(`  [Progress] Line ${i + 1}/${lines.length} - Ingested: ${res.ingested_events} events.`);
        if (i < lines.length - 1) {
          await sleep(paceMs);
        }
      }

      console.log('\n=== Ingestion Completed ===');
      console.log(`- Elapsed Time:       ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
      console.log(`- Events Ingested:    ${totalIngested}`);
      console.log(`- Anomalies Detected: ${totalAnomalies}`);
      console.log(`- Incidents Created:  ${totalIncidents}`);
    } else {
      const result = await ingestionService.ingestZeekContent(content);
      console.log('\n=== Ingestion Completed ===');
      console.log(`- Elapsed Time:       ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
      console.log(`- Events Ingested:    ${result.ingested_events}`);
      console.log(`- Anomalies Detected: ${result.anomalies_detected}`);
      console.log(`- Incidents Created:  ${result.incidents_created}`);

      if (result.anomalies.length > 0) {
        console.log('\nDetected Anomalies:');
        for (const a of result.anomalies) {
          console.log(`  [${a.severity.toUpperCase()}] ${a.method} (Score: ${a.score}) - ${a.reasons[0] || 'No reason'}`);
        }
      }

      if (result.incidents.length > 0) {
        console.log('\nCorrelated Incidents:');
        for (const inc of result.incidents) {
          console.log(`  [${inc.severity.toUpperCase()}] ${inc.title} (Anomalies: ${inc.anomaly_ids?.length || 0})`);
        }
      }
    }
  } catch (error: any) {
    console.error(`Ingestion failed: ${error.message}`);
    process.exit(1);
  }
}

main();
