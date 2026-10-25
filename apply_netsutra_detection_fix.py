#!/usr/bin/env python3
"""Apply the NetSutra detection and telemetry correctness patch in the repository root.

Run:
  python apply_netsutra_detection_fix.py
from the root of the NetSutra-2am_Bug checkout.
The script makes .pre-fix backups before editing existing files.
"""
from pathlib import Path
import shutil
import sys

ROOT = Path.cwd()

def read(rel):
    path = ROOT / rel
    if not path.is_file():
        raise FileNotFoundError(f"Required repository file not found: {rel}. Run this from the repository root.")
    return path.read_text(encoding="utf-8")

def backup(rel):
    path = ROOT / rel
    backup_path = path.with_suffix(path.suffix + ".pre-netsutra-fix")
    if not backup_path.exists():
        shutil.copy2(path, backup_path)

def write(rel, content):
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        backup(rel)
    path.write_text(content, encoding="utf-8")

# The complete new module is stored beside this script in the fix ZIP.
module_path = Path(__file__).resolve().parent / "multilog_rules.py"
tests_path = Path(__file__).resolve().parent / "test_multilog_rules.py"
if not module_path.exists() or not tests_path.exists():
    raise FileNotFoundError("Keep multilog_rules.py and test_multilog_rules.py next to this script (as in the ZIP).")

write("ai-service/detection/multilog_rules.py", module_path.read_text(encoding="utf-8"))

# Register the new independent batch-aware rules alongside existing rules.
rel = "ai-service/detection/detector.py"
content = read(rel)
if "from detection.multilog_rules import MultiLogBehaviorDetector" not in content:
    marker = "\n\nclass AnomalyDetectorService:"
    if marker not in content:
        raise RuntimeError("Could not find AnomalyDetectorService insertion point in detector.py")
    content = content.replace(marker, "\nfrom detection.multilog_rules import MultiLogBehaviorDetector" + marker, 1)
if "MultiLogBehaviorDetector()" not in content:
    marker = "            FailedConnectionPatternDetector(),\n        ]"
    if marker not in content:
        raise RuntimeError("Could not find detector registration list in detector.py")
    content = content.replace(marker, "            FailedConnectionPatternDetector(),\n            MultiLogBehaviorDetector(),\n        ]", 1)
write(rel, content)

# Fix Zeek files.log normalization and avoid treating analyzer label (e.g. "HTTP") as an IP.
rel = "server/src/utils/normalizer.ts"
content = read(rel)
if "from 'node:net'" not in content:
    content = content.replace("import crypto from 'crypto';",
                              "import crypto from 'crypto';\nimport { isIP } from 'node:net';", 1)

uid_marker = "  if (raw.uid && typeof raw.uid === 'string') {\n    return raw.uid;\n  }"
if "raw.fuid" not in content:
    if uid_marker not in content:
        raise RuntimeError("Could not find event ID mapping in normalizer.ts")
    content = content.replace(uid_marker, uid_marker + "\n  if (raw.fuid && typeof raw.fuid === 'string') {\n    return `file-${raw.fuid}`;\n  }", 1)

start = content.find("  // Use actual IP addresses only.")
if start < 0:
    start = content.find("  // 1. Source IP")
end = content.find("  // In Zeek conn.log, source and destination IP are required", start)
if start < 0 or end < 0:
    if "const firstValidIp" not in content:
        raise RuntimeError("Could not locate source/destination IP normalization block")
else:
    replacement = """  // Use actual IP addresses only. In Zeek files.log, `source` is an analyzer
  // name (e.g. HTTP), while tx_hosts/rx_hosts carry the endpoint addresses.
  const firstValidIp = (...candidates: unknown[]): string | null => {
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && isIP(candidate.trim())) {
        return candidate.trim();
      }
    }
    return null;
  };
  const txHosts = Array.isArray(raw.tx_hosts) ? raw.tx_hosts : [];
  const rxHosts = Array.isArray(raw.rx_hosts) ? raw.rx_hosts : [];

  // 1. Source IP
  const sourceIp = firstValidIp(
    raw['id.orig_h'], raw.orig_h, raw.src_ip,
    typeof raw.id === 'object' ? raw.id?.orig_h : null,
    raw.source, txHosts[0]
  );

  // 2. Destination IP
  const destinationIp = firstValidIp(
    raw['id.resp_h'], raw.resp_h, raw.dest_ip,
    typeof raw.id === 'object' ? raw.id?.resp_h : null,
    raw.destination, rxHosts[0]
  );

"""
    content = content[:start] + replacement + content[end:]
write(rel, content)

# Make detection-service failure visible instead of returning a misleading successful zero.
rel = "server/src/services/ingestionService.ts"
content = read(rel)
old_interface = """  anomalies: Anomaly[];
  incidents: Incident[];
}"""
new_interface = """  anomalies: Anomaly[];
  incidents: Incident[];
  detection_status: 'completed' | 'failed' | 'not_run';
  detection_error?: string;
}"""
if "detection_status:" not in content:
    if old_interface not in content:
        raise RuntimeError("Could not locate IngestionResult interface")
    content = content.replace(old_interface, new_interface, 1)

empty_return = """        anomalies: [],
        incidents: []
      };"""
if "detection_status: 'not_run'" not in content:
    if empty_return not in content:
        raise RuntimeError("Could not locate empty ingestion return")
    content = content.replace(empty_return, """        anomalies: [],
        incidents: [],
        detection_status: 'not_run'
      };""", 1)

marker = """    let detectedAnomalies: Anomaly[] = [];
    let correlatedIncidents: Incident[] = [];"""
if "let detectionStatus:" not in content:
    if marker not in content:
        raise RuntimeError("Could not locate detection variables")
    content = content.replace(marker, marker + """
    let detectionStatus: 'completed' | 'failed' | 'not_run' = options.skipDetection ? 'not_run' : 'completed';
    let detectionError: string | undefined;""", 1)

old_catch = """      } catch (detErr: any) {
        logger.warn(`Detection service call failed during ingestion: ${detErr.message}`);
      }"""
if "detectionError = " not in content:
    if old_catch not in content:
        raise RuntimeError("Could not locate swallowed detection error block")
    content = content.replace(old_catch, """      } catch (detErr: any) {
        detectionStatus = 'failed';
        detectionError = 'Anomaly detection failed; telemetry was ingested but was not successfully evaluated.';
        logger.error(`Detection service call failed during ingestion: ${detErr.message}`);
      }""", 1)

old_return = """      anomalies: detectedAnomalies,
      incidents: correlatedIncidents
    };"""
if "detection_status: detectionStatus" not in content:
    if old_return not in content:
        raise RuntimeError("Could not locate final ingestion return")
    content = content.replace(old_return, """      anomalies: detectedAnomalies,
      incidents: correlatedIncidents,
      detection_status: detectionStatus,
      ...(detectionError ? { detection_error: detectionError } : {})
    };""", 1)
write(rel, content)

# Fix frontend dashboard fallbacks that could display made-up counts and ignore API rows.
dashboard_script = Path(__file__).resolve().parent / "apply_dashboard_fix.py"
if not dashboard_script.exists():
    raise FileNotFoundError("Keep apply_dashboard_fix.py next to apply_netsutra_detection_fix.py (as in the ZIP).")
import subprocess
subprocess.run([sys.executable, str(dashboard_script)], check=True)

# Install regression tests; Python's built-in unittest needs no test runner package.
test_dest = ROOT / "ai-service/tests/test_multilog_rules.py"
test_dest.parent.mkdir(parents=True, exist_ok=True)
if test_dest.exists():
    backup("ai-service/tests/test_multilog_rules.py")
test_dest.write_text(tests_path.read_text(encoding="utf-8"), encoding="utf-8")

print("NetSutra detection fix applied.")
print("Changed: ai-service/detection/multilog_rules.py, ai-service/detection/detector.py,")
print("         server/src/utils/normalizer.ts, server/src/services/ingestionService.ts")
print("         client/src/components/dashboard/StatCards.jsx, client/src/components/dashboard/SeverityDistribution.jsx")
print("         client/src/pages/DashboardPage.jsx")
print("Added:   ai-service/tests/test_multilog_rules.py")
print("Backups: existing files were copied to *.pre-netsutra-fix")
print("")
print("Next:")
print("  1) Run the Python tests from ai-service: python -m unittest discover -s tests -p 'test_multilog_rules.py'")
print("  2) Rebuild/restart both backend and AI service.")
print("  3) Upload each log as a full batch (do not use --pace for multi-event pattern tests).")
print("  4) Check the ingestion response: detection_status must be 'completed'; 'failed' is not a zero-alert success.")
