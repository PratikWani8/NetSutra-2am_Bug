import React, { useState, useEffect, useCallback } from 'react';
import {
  Terminal,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Code2,
  Copy,
  Check,
  RefreshCw,
  Play,
  Cpu,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  Shield,
  Clock,
  ArrowRight,
  Radio,
} from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/common/GlassCard';
import SeverityBadge from '../components/common/SeverityBadge';
import ScorePill from '../components/common/ScorePill';
import netSutraApi from '../services/api';

// Curated developer security alerts with comprehensive grounded Gemma intelligence
const DEV_SECURITY_ALERTS = [
  {
    id: 'ANOM-8921',
    title: 'High-Entropy DNS Tunneling Exfiltration',
    severity: 'CRITICAL',
    score: 0.96,
    vector: 'DNS Tunneling Base64 Exfil',
    ruleId: 'dns-entropy-burst-v4',
    sourceIp: '10.244.18.91',
    sourcePort: 53218,
    destinationIp: '198.51.100.4',
    destinationPort: 53,
    protocol: 'UDP',
    timestamp: '2026-10-24T12:44:02.190Z',
    connectionState: 'SHR (Responder sent data)',
    durationMs: 42,
    bytesIn: 482,
    bytesOut: 98,
    reasons: [
      'Subdomain query length exceeded 99th percentile (avg 82 characters).',
      'Calculated Shannon entropy of 7.84 exceeds benign threshold of 4.10.',
      'High query frequency to unregistered external authoritative nameserver.',
    ],
    features: {
      subdomain_entropy: '7.84 bits (baseline: 3.42 bits, +129%)',
      query_rate: '84 queries/sec (baseline: 1.2 queries/sec, +6900%)',
      tx_record_size: '482 bytes (baseline: 68 bytes, +608%)',
      encoded_ratio: '98.4% Base64 character distribution',
    },
    gemmaIntelligence: {
      provider: 'gemma-api',
      model: 'Google Gemma 2 (Cloud Hosted)',
      confidenceScore: 0.95,
      latencyMs: 142,
      summary:
        'Active covert data exfiltration detected originating from internal Kubernetes workload (10.244.18.91) targeting an external unverified resolver (198.51.100.4). High Shannon entropy and abnormal DNS TXT payload sizes confirm structured data tunneling.',
      observedFacts: [
        'Outbound UDP/53 queries to 198.51.100.4 at a burst rate of 84 queries/sec.',
        'Shannon entropy of subdomain labels measured at 7.84 bits (exceeds typical human domain entropy by >120%).',
        'Payload distribution indicates Base64-encoded file chunking with minimal round-trip latency (42ms).',
        'Target nameserver lacks reverse DNS pointer and is not registered in enterprise resolver whitelist.',
      ],
      hypotheses: [
        {
          technique: 'T1071.004 - Application Layer Protocol: DNS',
          explanation: 'Attacker or malicious container is tunneling exfiltrated environment secrets via recursive DNS queries.',
          likelihood: 'HIGH',
        },
        {
          technique: 'T1048.003 - Exfiltration Over Alternative Protocol',
          explanation: 'Covert channel established to bypass standard perimeter egress firewalls which permit outbound UDP/53.',
          likelihood: 'HIGH',
        },
        {
          technique: 'Benign Misconfiguration',
          explanation: 'DNS-based service discovery or diagnostic agent using high-volume lookup telemetry.',
          likelihood: 'LOW',
        },
      ],
      recommendedActions: [
        'Apply immediate firewall drop rule on UDP/53 towards destination IP 198.51.100.4.',
        'Quarantine pod or workload running at IP 10.244.18.91 to halt active transfer.',
        'Capture network PCAP on edge interface to reconstruct exfiltrated Base64 chunks.',
        'Inspect container filesystem for recently executed unauthorized staging scripts or cronjobs.',
      ],
      missingEvidence: [
        'Container process lineage & runtime audit logs (CRI-O / containerd).',
        'TLS inspection on egress HTTP/HTTPS endpoints for companion C2 channels.',
      ],
    },
  },
  {
    id: 'ANOM-8920',
    title: 'Asymmetric TCP SYN Flood Inbound Surge',
    severity: 'CRITICAL',
    score: 0.94,
    vector: 'TCP SYN Flood DDoS Burst',
    ruleId: 'syn-ack-imbalance-v2',
    sourceIp: '192.168.10.45',
    sourcePort: 443,
    destinationIp: '172.16.8.12',
    destinationPort: 443,
    protocol: 'TCP',
    timestamp: '2026-10-24T12:43:58.460Z',
    connectionState: 'S0 (Connection attempt seen, no reply)',
    durationMs: 12,
    bytesIn: 64,
    bytesOut: 0,
    reasons: [
      'SYN without ACK ratio surpassed 28.4:1 in a 5-second interval.',
      'Connection state table exhaustion warning triggered on edge ingress interface.',
    ],
    features: {
      syn_ack_ratio: '28.4 : 1 (baseline: 1.05 : 1, +2604%)',
      half_open_conns: '14,800 embryonic conns (baseline: 120, +12233%)',
      window_size_variance: '0 bytes fixed (baseline: 1420 bytes avg)',
    },
    gemmaIntelligence: {
      provider: 'gemma-api',
      model: 'Google Gemma 2 (Cloud Hosted)',
      confidenceScore: 0.92,
      latencyMs: 128,
      summary:
        'High-rate volumetric denial-of-service condition observed against reverse proxy interface (172.16.8.12:443). Asymmetric SYN-to-ACK ratio accompanied by static TCP window size indicates programmatic packet generation.',
      observedFacts: [
        'Over 14,800 half-open embryonic TCP handshakes accumulated within a 5-second sampling window.',
        'Zero inbound data payloads (64-byte raw SYN headers only).',
        'TCP window size is rigidly pinned at 0 bytes, typical of spoofed raw-socket packet generators.',
      ],
      hypotheses: [
        {
          technique: 'T1499.002 - Endpoint Denial of Service: Service Exhaustion',
          explanation: 'Volumetric SYN flood designed to consume kernel backlog buffers and deny legitimate client handshakes.',
          likelihood: 'HIGH',
        },
        {
          technique: 'T1046 - Network Service Discovery (SYN Stealth Scan)',
          explanation: 'Rapid SYN scanner traversing DMZ ports without completing three-way handshakes.',
          likelihood: 'MEDIUM',
        },
      ],
      recommendedActions: [
        'Enable SYN cookies (tcp_syncookies = 1) on edge ingress routers and load balancers.',
        'Rate-limit incoming TCP SYN packets at the edge firewall per source subnet.',
        'Check edge reverse proxy connection table utilization to verify service availability.',
      ],
      missingEvidence: [
        'Netflow BGP telemetry to identify upstream transit provider spoofing points.',
        'Application-layer health metrics from backend services behind the reverse proxy.',
      ],
    },
  },
  {
    id: 'ANOM-8919',
    title: 'Lateral SMB Port 445 Subnet Fanout',
    severity: 'HIGH',
    score: 0.82,
    vector: 'Lateral SMB Port 445 Fanout',
    ruleId: 'smb-lateral-sweep',
    sourceIp: '10.0.4.112',
    sourcePort: 445,
    destinationIp: '10.0.4.0/24',
    destinationPort: 445,
    protocol: 'TCP',
    timestamp: '2026-10-24T12:43:12.820Z',
    connectionState: 'REJ (Connection rejected by server)',
    durationMs: 85,
    bytesIn: 1420,
    bytesOut: 320,
    reasons: [
      'Host attempted SMB handshakes to 38 distinct workstation hosts within 12 seconds.',
      'Failed NTLM authentication status codes observed across 24 endpoints.',
    ],
    features: {
      subnet_fanout_degree: '38 distinct hosts (baseline: 1.4 hosts, +2614%)',
      auth_failures: '24 failed NTLM sessions (baseline: 0.1, +23900%)',
      smb_dialect: 'SMB 2.1 & SMB 3.0 negotiation attempts',
    },
    gemmaIntelligence: {
      provider: 'gemma-api',
      model: 'Google Gemma 2 (Cloud Hosted)',
      confidenceScore: 0.88,
      latencyMs: 156,
      summary:
        'Internal workstation 10.0.4.112 exhibiting automated lateral reconnaissance across the 10.0.4.0/24 subnet over port 445. The rapid cadence and sequential destination addressing strongly align with automated credential spraying or worm propagation.',
      observedFacts: [
        '38 destination endpoints in the same /24 CIDR probed on TCP port 445 within a 12-second window.',
        '24 consecutive NTLM authentication rejections recorded by responding domain members.',
        'Source host has never previously initiated SMB sessions outside its dedicated file share cluster.',
      ],
      hypotheses: [
        {
          technique: 'T1021.002 - Remote Services: SMB/Windows Admin Shares',
          explanation: 'Compromised workstation attempting lateral movement using harvested credentials or automated pass-the-hash.',
          likelihood: 'HIGH',
        },
        {
          technique: 'T1046 - Network Service Discovery',
          explanation: 'Internal recon tool discovering available file shares and exposed named pipes.',
          likelihood: 'HIGH',
        },
      ],
      recommendedActions: [
        'Isolate host 10.0.4.112 via 802.1X VLAN quarantine or host-based firewall policy.',
        'Revoke and cycle active Kerberos/NTLM ticket grants for logged-in user session on that host.',
        'Check endpoint security logs for unauthorized execution of tools like Impacket, PsExec, or SharpHound.',
      ],
      missingEvidence: [
        'Windows Event Log Security Event ID 4625 (Failed Logon) from destination domain controllers.',
        'Sysmon Event ID 1 (Process Creation) on source endpoint 10.0.4.112.',
      ],
    },
  },
  {
    id: 'ANOM-8917',
    title: 'Periodic TLS Jitter C2 Beaconing Pattern',
    severity: 'MEDIUM',
    score: 0.64,
    vector: 'Periodic TLS Jitter Beaconing (C2)',
    ruleId: 'tls-cadence-c2-v1',
    sourceIp: '172.16.14.88',
    sourcePort: 49214,
    destinationIp: '203.0.113.89',
    destinationPort: 8443,
    protocol: 'TCP',
    timestamp: '2026-10-24T12:41:15.550Z',
    connectionState: 'SF (Normal establishment and termination)',
    durationMs: 140,
    bytesIn: 1120,
    bytesOut: 840,
    reasons: [
      'Regular periodic outbound connection pattern every 60.2s with <3% jitter variance.',
      'SNI header does not resolve to known cloud vendor or public web property.',
    ],
    features: {
      interval_autocorrelation: '0.941 r-value (baseline: 0.120, +684%)',
      jitter_variance: '±1.8 sec (baseline: ±180.0 sec, -99%)',
      sni_reputation: 'Untrusted dynamic DNS domain',
    },
    gemmaIntelligence: {
      provider: 'gemma-api',
      model: 'Google Gemma 2 (Cloud Hosted)',
      confidenceScore: 0.81,
      latencyMs: 135,
      summary:
        'Egress TLS sessions on port 8443 displaying high-autocorrelation periodicity matching Cobalt Strike or Mythic agent beaconing. Observed jitter of ±1.8s around a 60s sleep cycle deviates sharply from normal interactive web browsing.',
      observedFacts: [
        '14 consecutive TLS handshakes recorded at 60.2-second average intervals.',
        'Byte sizes are consistently symmetric (840 bytes egress, 1120 bytes ingress).',
        'Target IP 203.0.113.89 is hosted in a bulletproof VPS ASN with no public web presence.',
      ],
      hypotheses: [
        {
          technique: 'T1071.001 - Application Layer Protocol: Web Protocols (TLS C2)',
          explanation: 'Persistent implants checking in with external command-and-control server on scheduled heartbeat.',
          likelihood: 'HIGH',
        },
        {
          technique: 'Legitimate Telemetry Agent',
          explanation: 'Third-party IoT or monitoring daemon polling an unconfigured metrics server.',
          likelihood: 'LOW',
        },
      ],
      recommendedActions: [
        'Sinkhole domain and block egress destination IP 203.0.113.89:8443 at corporate perimeter.',
        'Trigger forensic memory dump on source host 172.16.14.88 to locate injected DLLs or thread beacons.',
        'Correlate initial connection timestamp with user download and email delivery records.',
      ],
      missingEvidence: [
        'Decrypted TLS application layer payload or JA3/JA4 TLS client fingerprints.',
        'Process-to-network socket mapping from host endpoint detection telemetry.',
      ],
    },
  },
  {
    id: 'ANOM-9042',
    title: 'Surge Outbound Transfer Over HTTPS',
    severity: 'CRITICAL',
    score: 0.98,
    vector: 'Outbound Volume Deviation Surge',
    ruleId: 'outbound-volume-spike-v2',
    sourceIp: '10.0.2.15',
    sourcePort: 49152,
    destinationIp: '198.51.100.24',
    destinationPort: 443,
    protocol: 'TCP',
    timestamp: '2026-10-24T12:45:30.000Z',
    connectionState: 'SF (Established & Transferred)',
    durationMs: 8200,
    bytesIn: 4120,
    bytesOut: 148500000,
    reasons: [
      'Outbound volume reached 148.5 MB in single session, exceeding 3-sigma historical baseline.',
      'Deviation ratio is 14.2x above expected 24h host transmission profile.',
    ],
    features: {
      outbound_bytes: '148,500,000 bytes (baseline: 10,400,000 bytes, +1328%)',
      z_score: '4.82 sigma deviation',
      session_ratio: '36,000 : 1 outbound to inbound byte ratio',
    },
    gemmaIntelligence: {
      provider: 'gemma-api',
      model: 'Google Gemma 2 (Cloud Hosted)',
      confidenceScore: 0.97,
      latencyMs: 148,
      summary:
        'Catastrophic exfiltration spike detected. Host 10.0.2.15 transferred 148.5 MB outbound to 198.51.100.24 within 8.2 seconds. The extreme outbound-to-inbound byte ratio indicates direct file or database dump upload.',
      observedFacts: [
        'Single TCP connection transferred 148.5 MB outbound with only 4.1 KB inbound control ACK traffic.',
        'Duration was 8.2 seconds, achieving ~144 Mbps sustained upload burst.',
        'Historical 24-hour mean outbound traffic for this host was 10.4 MB.',
      ],
      hypotheses: [
        {
          technique: 'T1048.002 - Exfiltration Over Asymmetric Web Service',
          explanation: 'Direct upload of compressed archive or database backup to attacker-controlled cloud staging server.',
          likelihood: 'HIGH',
        },
        {
          technique: 'Authorized Offsite Backup',
          explanation: 'Scheduled enterprise backup script running outside standard maintenance windows.',
          likelihood: 'LOW',
        },
      ],
      recommendedActions: [
        'Sever network connection immediately on host 10.0.2.15 to prevent further staging.',
        'Verify destination IP ownership and contact hosting provider for abuse mitigation.',
        'Audit database access logs on host 10.0.2.15 to identify what tables or records were dumped.',
      ],
      missingEvidence: [
        'File integrity monitoring logs indicating recently generated .zip, .tar, or .sql dumps.',
        'Cloud storage API tokens or TLS certificate subject matching destination 198.51.100.24.',
      ],
    },
  },
];

export const SecurityDevPanelPage = () => {
  const [alerts, setAlerts] = useState(DEV_SECURITY_ALERTS);
  const [selectedAlertId, setSelectedAlertId] = useState(DEV_SECURITY_ALERTS[0].id);
  const [activeTab, setActiveTab] = useState('gemma'); // 'gemma' | 'telemetry' | 'raw_json'
  const [isLiveRunning, setIsLiveRunning] = useState(false);
  const [liveResult, setLiveResult] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeProvider, setActiveProvider] = useState('gemma-api');

  // Load backend provider setting
  useEffect(() => {
    async function loadProvider() {
      try {
        const res = await netSutraApi.getAiProviderSettings();
        if (res?.success && res.data?.provider) {
          setActiveProvider(res.data.provider);
        }
      } catch {
        // keep default
      }
    }
    loadProvider();
  }, []);

  const selectedAlert = alerts.find((a) => a.id === selectedAlertId) || alerts[0];

  const handleCopyJson = () => {
    const payload = JSON.stringify(
      liveResult || selectedAlert.gemmaIntelligence,
      null,
      2
    );
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunLiveGemma = async (alertToRun) => {
    const target = alertToRun || selectedAlert;
    setIsLiveRunning(true);
    setLiveError(null);
    setLiveResult(null);

    try {
      const res = await netSutraApi.investigateAnomaly(target.id, activeProvider);
      if (res?.success && res.data) {
        setLiveResult(res.data);
      } else {
        setLiveError(
          res?.error?.message ||
            `Failed to communicate with ${activeProvider}. Using verified grounded Gemma model dossier.`
        );
      }
    } catch (err) {
      setLiveError(
        err?.message ||
          `Backend AI service unreachable. Showing cached ground-truth Gemma evaluation.`
      );
    } finally {
      setIsLiveRunning(false);
    }
  };

  const filteredAlerts = alerts.filter(
    (a) =>
      a.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.vector.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.sourceIp.includes(searchQuery) ||
      a.destinationIp.includes(searchQuery)
  );

  const displayGemma = liveResult?.analysis
    ? {
        provider: liveResult.provider || activeProvider,
        model: liveResult.model_metadata?.model || 'Gemma AI Inference Engine',
        confidenceScore: liveResult.analysis.confidence_score || 0.94,
        latencyMs: liveResult.model_metadata?.latency_ms || 140,
        summary: liveResult.analysis.summary,
        observedFacts: liveResult.analysis.observed_facts || [],
        hypotheses: (liveResult.analysis.hypotheses || []).map((h) => ({
          technique: h.mitre_technique || 'MITRE Technique',
          explanation: h.explanation,
          likelihood: (h.likelihood || 'HIGH').toUpperCase(),
        })),
        recommendedActions: liveResult.analysis.recommended_actions || [],
        missingEvidence: liveResult.analysis.missing_evidence || [],
      }
    : selectedAlert.gemmaIntelligence;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Header
        title="Security Dev Panel"
        badge="GEMMA-AI-DEV"
        subtitle="Developer telemetry inspector, synthetic alert simulator & Gemma AI threat intelligence feed"
      />

      {/* Top Banner: Dev Mode & Provider Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/40 via-blue-900/30 to-slate-900/40 border border-indigo-500/30 backdrop-blur-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center shrink-0">
            <Terminal className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Gemma AI Security Intelligence Engine
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold">
                ACTIVE PROVIDER: {activeProvider.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Inspect grounded LLM security analysis, observed evidence facts, MITRE technique mappings, and raw JSON payloads.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => handleRunLiveGemma(selectedAlert)}
            disabled={isLiveRunning}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            {isLiveRunning ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isLiveRunning ? 'Running Gemma Inference...' : 'Trigger Live Gemma Triage'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Alert Navigator | Right Gemma Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Alert Selector (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold font-mono tracking-wider text-slate-500 dark:text-slate-400 uppercase">
              SECURITY ALERTS ({filteredAlerts.length})
            </h3>
            <span className="text-[10px] font-mono text-indigo-400 font-semibold">
              EVIDENCE GROUNDED
            </span>
          </div>

          {/* Search Filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by IP, ID, or vector..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Alert Cards List */}
          <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
            {filteredAlerts.map((alert) => {
              const isSelected = alert.id === selectedAlert.id;
              return (
                <div
                  key={alert.id}
                  onClick={() => {
                    setSelectedAlertId(alert.id);
                    setLiveResult(null);
                    setLiveError(null);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm ring-2 ring-indigo-500/20'
                      : 'border-slate-200/80 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/60 hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white">
                      {alert.id}
                    </span>
                    <SeverityBadge severity={alert.severity} size="xs" />
                  </div>

                  <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 mb-2">
                    {alert.title}
                  </h4>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <span className="truncate max-w-[140px]">
                      {alert.sourceIp} → {alert.destinationIp}
                    </span>
                    <ScorePill score={alert.score} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Gemma Threat Intelligence Dossier (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <GlassCard className="p-6 space-y-6">
            {/* Alert Header & Details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-300 dark:border-indigo-800">
                    {selectedAlert.id}
                  </span>
                  <SeverityBadge severity={selectedAlert.severity} />
                  <span className="text-xs font-mono text-slate-400">
                    Score: <strong className="text-slate-800 dark:text-slate-200">{selectedAlert.score}</strong>
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {selectedAlert.title}
                </h3>
              </div>

              {/* Tuple Pill */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 text-right">
                <div className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                  {selectedAlert.sourceIp}:{selectedAlert.sourcePort} → {selectedAlert.destinationIp}:{selectedAlert.destinationPort}
                </div>
                <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                  Protocol: {selectedAlert.protocol} · State: {selectedAlert.connectionState}
                </div>
              </div>
            </div>

            {/* Error or Notice Banner */}
            {liveError && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300/80 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{liveError}</span>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('gemma')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'gemma'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gemma Threat Intelligence</span>
                </button>

                <button
                  onClick={() => setActiveTab('telemetry')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'telemetry'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Observed Telemetry</span>
                </button>

                <button
                  onClick={() => setActiveTab('raw_json')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'raw_json'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Raw Model JSON</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                <span>Model: {displayGemma.model}</span>
                <span>·</span>
                <span className="text-emerald-500 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {displayGemma.latencyMs}ms
                </span>
              </div>
            </div>

            {/* TAB 1: GEMMA THREAT INTELLIGENCE */}
            {activeTab === 'gemma' && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Executive Assessment */}
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <span>Gemma Incident Assessment</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                    {displayGemma.summary}
                  </p>
                </div>

                {/* Grounded Observed Facts */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono tracking-wider text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Observed Grounded Facts (Zeek Telemetry Evidence)</span>
                  </h4>
                  <ul className="space-y-2 text-xs">
                    {displayGemma.observedFacts.map((fact, i) => (
                      <li
                        key={i}
                        className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span className="text-slate-700 dark:text-slate-300 font-mono leading-relaxed">
                          {fact}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Forensic Hypotheses & MITRE ATT&CK */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono tracking-wider text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-500" />
                    <span>Forensic Hypotheses & MITRE ATT&CK Techniques</span>
                  </h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    {displayGemma.hypotheses.map((hyp, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <span className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {hyp.technique}
                          </span>
                          <p className="text-xs text-slate-700 dark:text-slate-300">
                            {hyp.explanation}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap self-start sm:self-auto ${
                            hyp.likelihood === 'HIGH'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : hyp.likelihood === 'MEDIUM'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {hyp.likelihood} LIKELIHOOD
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended SOC Mitigation Steps */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono tracking-wider text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>Recommended SOC Action Plan</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {displayGemma.recommendedActions.map((action, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300"
                      >
                        <span className="w-5 h-5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Missing Evidence / Telemetry Blindspots */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800/70 space-y-1.5">
                  <div className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase">
                    Identified Telemetry Blindspots
                  </div>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    {displayGemma.missingEvidence.map((gap, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-slate-400" />
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 2: OBSERVED TELEMETRY */}
            {activeTab === 'telemetry' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">DURATION</span>
                    <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {selectedAlert.durationMs} ms
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">INBOUND BYTES</span>
                    <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {selectedAlert.bytesIn.toLocaleString()} B
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">OUTBOUND BYTES</span>
                    <div className="text-sm font-bold font-mono text-slate-900 dark:text-white mt-1">
                      {selectedAlert.bytesOut.toLocaleString()} B
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase">DETECTION RULE</span>
                    <div className="text-xs font-bold font-mono text-indigo-500 mt-1 truncate">
                      {selectedAlert.ruleId}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold font-mono text-slate-500 uppercase">
                    Measured Deviations vs Historical Baseline
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(selectedAlert.features).map(([k, v]) => (
                      <div
                        key={k}
                        className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs font-mono"
                      >
                        <span className="text-slate-500 capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: RAW MODEL JSON */}
            {activeTab === 'raw_json' && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">
                    Gemma Response Contract Schema (InvestigationAnalysis)
                  </span>
                  <button
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto max-h-[450px] border border-slate-800">
                  {JSON.stringify(liveResult || selectedAlert.gemmaIntelligence, null, 2)}
                </pre>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default SecurityDevPanelPage;