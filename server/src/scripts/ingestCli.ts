import fs from 'fs';
import path from 'path';
import { ingestionService } from '../services/ingestionService';
import { logger } from '../utils/logger';

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: npm run ingest <path-to-zeek-log-file>');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  logger.info(`Reading Zeek log file: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');

  try {
    const result = await ingestionService.ingestZeekContent(content);
    console.log('\n=== Ingestion Completed ===');
    console.log(`- Events Ingested:    ${result.ingested_events}`);
    console.log(`- Anomalies Detected: ${result.anomalies_detected}`);
    console.log(`- Incidents Created:  ${result.incidents_created}`);
    if (result.anomalies.length > 0) {
      console.log('\nDetected Anomalies:');
      for (const a of result.anomalies) {
        console.log(`  [${a.severity.toUpperCase()}] ${a.method} (Score: ${a.score}) - ${a.reasons[0] || 'No reason'}`);
      }
    }
  } catch (error: any) {
    console.error(`Ingestion failed: ${error.message}`);
    process.exit(1);
  }
}

main();
