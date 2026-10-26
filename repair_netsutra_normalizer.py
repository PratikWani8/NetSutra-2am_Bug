#!/usr/bin/env python3
"""Repair repeated normalizer declarations and make the installer idempotent.

Run this from the NetSutra repository root, beside apply_netsutra_detection_fix.py.
It backs up changed files before writing.
"""
from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
NORMALIZER = ROOT / "server" / "src" / "utils" / "normalizer.ts"
INSTALLER = ROOT / "apply_netsutra_detection_fix.py"

if not NORMALIZER.is_file():
    sys.exit("ERROR: server/src/utils/normalizer.ts was not found. Run this from the NetSutra repository root.")
if not INSTALLER.is_file():
    sys.exit("ERROR: apply_netsutra_detection_fix.py was not found beside this script. Run this from the NetSutra repository root.")

def backup(path: Path) -> None:
    backup_path = path.with_suffix(path.suffix + ".pre-normalizer-repair")
    if not backup_path.exists():
        shutil.copy2(path, backup_path)

# 1) The earlier installer searched from the first `// 1. Source IP` comment,
# leaving the helper declarations above that point behind on every rerun.
text = NORMALIZER.read_text(encoding="utf-8")
original = text

helper_pattern = re.compile(
    r"  const firstValidIp = \(\.\.\.candidates: unknown\[\]\): string \| null => \{\n"
    r".*?\n  \};\n",
    re.DOTALL,
)
helper_matches = list(helper_pattern.finditer(text))
if not helper_matches:
    sys.exit("ERROR: Could not find the inserted firstValidIp helper. No files were changed.")

# Keep the first helper declaration and remove later copies.
seen_first_helper = False
def keep_first_helper(match: re.Match[str]) -> str:
    global seen_first_helper
    if not seen_first_helper:
        seen_first_helper = True
        return match.group(0)
    return ""
text = helper_pattern.sub(keep_first_helper, text)

# Keep only one tx_hosts/rx_hosts array declaration, preserving the first.
lines = text.splitlines(keepends=True)
seen_declarations = set()
cleaned = []
for line in lines:
    stripped = line.strip()
    if stripped in {
        "const txHosts = Array.isArray(raw.tx_hosts) ? raw.tx_hosts : [];",
        "const rxHosts = Array.isArray(raw.rx_hosts) ? raw.rx_hosts : [];",
    }:
        if stripped in seen_declarations:
            continue
        seen_declarations.add(stripped)
    cleaned.append(line)
text = "".join(cleaned)

# Validate that the source/destination mappings still exist and references resolve.
required = [
    "const firstValidIp = (...candidates: unknown[]): string | null => {",
    "const txHosts = Array.isArray(raw.tx_hosts) ? raw.tx_hosts : [];",
    "const rxHosts = Array.isArray(raw.rx_hosts) ? raw.rx_hosts : [];",
    "const sourceIp = firstValidIp(",
    "const destinationIp = firstValidIp(",
]
missing = [token for token in required if token not in text]
if missing:
    sys.exit("ERROR: Repair validation failed; missing expected normalizer code: " + ", ".join(missing) + ". No files were changed.")
for token in required[:3]:
    if text.count(token) != 1:
        sys.exit(f"ERROR: Repair validation failed; expected exactly one declaration for {token!r}. No files were changed.")

# 2) Make the main installer replace the whole inserted helper+mapping block,
# not start after the helper. This makes subsequent runs safe/idempotent.
installer_text = INSTALLER.read_text(encoding="utf-8")
old_start = 'start = content.find("  // 1. Source IP")'
new_start = '''start = content.find("  // Use actual IP addresses only.")
if start < 0:
    start = content.find("  // 1. Source IP")'''
installer_updated = installer_text
if new_start not in installer_updated:
    if old_start not in installer_updated:
        sys.exit("ERROR: Could not find the installer insertion anchor to make it rerun-safe. Normalizer was not written.")
    installer_updated = installer_updated.replace(old_start, new_start, 1)

# Backup both files before any write.
if text != original:
    backup(NORMALIZER)
    NORMALIZER.write_text(text, encoding="utf-8")
if installer_updated != installer_text:
    backup(INSTALLER)
    INSTALLER.write_text(installer_updated, encoding="utf-8")

print("Repair complete.")
print(f"  firstValidIp declarations remaining: {text.count('const firstValidIp =')}")
print(f"  txHosts declarations remaining: {text.count('const txHosts =')}")
print(f"  rxHosts declarations remaining: {text.count('const rxHosts =')}")
print("  Installer made safe to rerun:", installer_updated != installer_text)
print("Backups created with .pre-normalizer-repair suffix where needed.")
print("Next run: cd .\\server ; npm run build")
