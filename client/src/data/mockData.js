/**
 * NetSutra Demo Data
 * Used strictly for prototyping and development fallback when the backend is offline.
 * Every dataset is marked with isDemo: true to prevent misrepresenting simulated findings as real security findings.
 */

export const DEMO_SUMMARY = {
  isDemo: true,
  totalEvents: 14892410,
  eventsChangePercent: 12.4,
  eventsBaselineDiff: "+12.4% vs 24h baseline",
  throughputGbps: 172.4,
  anomaliesDetected: 842,
  anomaliesChangePercent: 5.8,
  anomaliesSpikeLabel: "+5.8% spikes",
  entropyConfidenceScore: 94.2,
  openIncidents: 29,
  incidentsResolved: -3,
  triagePendingPast2Hours: 6,
  criticalIncidents: 4,
  uncontainedIncidents: 1,
  activeContainedHosts: 4,
  inspectedVolumeTB: 4.2,
  packetInspectionRate: "124,190 pkts/sec",
  packetLossRate: "0.00% (Zero Drops)",
  threatIndex: 72,
  threatLevel: "ELEVATED",
  recommendedAction: "Triage Critical CIDR Block (198.51.100.0/24)",
  severityDistribution: {
    critical: { count: 4, percentage: 4.8 },
    high: { count: 18, percentage: 21.4 },
    medium: { count: 36, percentage: 42.8 },
    low: { count: 26, percentage: 31.0 }
  },
  systemHealth: {
    clustersStatus: "CLUSTERS OK",
    nodes: [
      { id: "node-1", name: "Edge-Probe-US-East", uptime: "99.98%", eps: "1.2M EPS", status: "Healthy" },
      { id: "node-2", name: "Edge-Probe-EU-Central", uptime: "99.95%", eps: "890k EPS", status: "Healthy" },
      { id: "node-3", name: "Core-Tap-01 (Mirror)", uptime: "99.9%", eps: "100 Gbps TAP", status: "Healthy" }
    ],
    aiModel: {
      provider: "gemma-api",
      modelName: "Gemma 2 Security Guard",
      latencyMs: 142,
      contextWindow: 32768,
      status: "Warm",
      vramUsage: "18.2 / 24 GB",
      batchRate: "64 tokens/s"
    },
    classifier: {
      name: "Isolation Forest Classifier",
      status: "In sync",
      inferenceLatency: "42ms tree inference"
    }
  }
};

export const DEMO_TELEMETRY = [
  { time: "00:00", inbound: 72, outbound: 45, tcpSyn: 12, udpFlood: 4, dnsTunnel: 1 },
  { time: "02:00", inbound: 85, outbound: 52, tcpSyn: 15, udpFlood: 6, dnsTunnel: 2 },
  { time: "04:20", inbound: 184, outbound: 88, tcpSyn: 82, udpFlood: 24, dnsTunnel: 3, label: "Peak (184 Gbps)" },
  { time: "06:00", inbound: 98, outbound: 64, tcpSyn: 22, udpFlood: 8, dnsTunnel: 2 },
  { time: "08:00", inbound: 110, outbound: 78, tcpSyn: 28, udpFlood: 12, dnsTunnel: 5 },
  { time: "10:00", inbound: 142, outbound: 104, tcpSyn: 45, udpFlood: 16, dnsTunnel: 12 },
  { time: "11:35", inbound: 165, outbound: 158, tcpSyn: 54, udpFlood: 38, dnsTunnel: 28, label: "Exfil Spike" },
  { time: "13:00", inbound: 128, outbound: 92, tcpSyn: 35, udpFlood: 14, dnsTunnel: 8 },
  { time: "15:00", inbound: 140, outbound: 86, tcpSyn: 39, udpFlood: 10, dnsTunnel: 6 },
  { time: "18:00", inbound: 160, outbound: 110, tcpSyn: 48, udpFlood: 20, dnsTunnel: 15 },
  { time: "21:00", inbound: 135, outbound: 84, tcpSyn: 32, udpFlood: 9, dnsTunnel: 4 },
  { time: "23:59", inbound: 92, outbound: 58, tcpSyn: 18, udpFlood: 5, dnsTunnel: 2 }
];

export const DEMO_ANOMALIES = [
  {
    id: "ANOM-8921",
    timestamp: "2026-10-24T12:44:02.190Z",
    sourceIp: "10.244.18.91",
    sourcePort: 53218,
    destinationIp: "198.51.100.4",
    destinationPort: 53,
    vector: "DNS Tunneling Base64 Exfil",
    ruleId: "dns-entropy-burst-v4",
    score: 0.96,
    severity: "CRITICAL",
    detectionMethod: "Shannon Entropy & Query Length Classifier",
    reasons: [
      "Subdomain query length exceeded 99th percentile (avg 82 characters).",
      "Calculated Shannon entropy of 7.84 exceeds benign threshold of 4.10.",
      "High query frequency to unregistered external authoritative nameserver."
    ],
    measuredFeatures: [
      { feature: "Subdomain Entropy", observed: "7.84 bits", baseline: "3.42 bits", deviation: "+129%" },
      { feature: "Query Frequency", observed: "84 queries/sec", baseline: "1.2 queries/sec", deviation: "+6900%" },
      { feature: "TX Record Size", observed: "482 bytes", baseline: "68 bytes", deviation: "+608%" },
      { feature: "Payload Encoded Ratio", observed: "98.4%", baseline: "3.1%", deviation: "+3074%" }
    ],
    supportingEventIds: ["EVT-904128", "EVT-904135", "EVT-904142", "EVT-904160"],
    relatedIncidents: ["INC-402"],
    investigationStatus: "open",
    aiInvestigation: null
  },
  {
    id: "ANOM-8920",
    timestamp: "2026-10-24T12:43:58.460Z",
    sourceIp: "192.168.10.45",
    sourcePort: 443,
    destinationIp: "172.16.8.12",
    destinationPort: 443,
    vector: "TCP SYN Flood DDoS Burst",
    ruleId: "syn-ack-imbalance-v2",
    score: 0.94,
    severity: "CRITICAL",
    detectionMethod: "Isolation Forest SYN/ACK Ratio Deviation",
    reasons: [
      "SYN without ACK ratio surpassed 24:1 in a 5-second interval.",
      "Connection state table exhaustion warning triggered on edge ingress interface."
    ],
    measuredFeatures: [
      { feature: "SYN/ACK Ratio", observed: "28.4 : 1", baseline: "1.05 : 1", deviation: "+2604%" },
      { feature: "Half-Open Connections", observed: "14,800 conns", baseline: "120 conns", deviation: "+12233%" },
      { feature: "Window Size Variance", observed: "0 bytes (Fixed)", baseline: "1420 bytes avg", deviation: "Fixed 0" }
    ],
    supportingEventIds: ["EVT-903801", "EVT-903802", "EVT-903820"],
    relatedIncidents: ["INC-401"],
    investigationStatus: "open",
    aiInvestigation: null
  },
  {
    id: "ANOM-8919",
    timestamp: "2026-10-24T12:43:12.820Z",
    sourceIp: "10.0.4.112",
    sourcePort: 445,
    destinationIp: "10.0.4.0/24",
    destinationPort: 445,
    vector: "Lateral SMB Port 445 Fanout",
    ruleId: "smb-lateral-sweep",
    score: 0.82,
    severity: "HIGH",
    detectionMethod: "Graph Fanout Degree Heuristic",
    reasons: [
      "Host attempted SMB handshakes to 38 distinct workstation hosts within 12 seconds.",
      "Failed NTLM authentication status codes observed across 24 endpoints."
    ],
    measuredFeatures: [
      { feature: "Subnet Fanout Degree", observed: "38 hosts", baseline: "1.4 hosts", deviation: "+2614%" },
      { feature: "Auth Failures", observed: "24 failed", baseline: "0.1 failed", deviation: "+23900%" }
    ],
    supportingEventIds: ["EVT-903110", "EVT-903115", "EVT-903120"],
    relatedIncidents: ["INC-398"],
    investigationStatus: "investigating",
    aiInvestigation: null
  },
  {
    id: "ANOM-8918",
    timestamp: "2026-10-24T12:42:49.630Z",
    sourceIp: "10.10.1.205",
    sourcePort: 88,
    destinationIp: "10.10.1.5",
    destinationPort: 88,
    vector: "Unusual RC4 Kerberos Ticket Req",
    ruleId: "krb-downgrade-roast",
    score: 0.68,
    severity: "MEDIUM",
    detectionMethod: "Protocol Specification Invariant Monitor",
    reasons: [
      "Client explicitly requested arcfour-hmac-md5 encryption type for TGS ticket.",
      "Target service account has an unusually long SPN registration."
    ],
    measuredFeatures: [
      { feature: "Encryption Suite", observed: "RC4-HMAC (0x17)", baseline: "AES256-CTS (0x12)", deviation: "Downgrade" },
      { feature: "TGS Request Rate", observed: "14 in 30s", baseline: "0.2 in 30s", deviation: "+6900%" }
    ],
    supportingEventIds: ["EVT-902781"],
    relatedIncidents: [],
    investigationStatus: "open",
    aiInvestigation: null
  },
  {
    id: "ANOM-8917",
    timestamp: "2026-10-24T12:41:15.550Z",
    sourceIp: "172.16.14.88",
    sourcePort: 49214,
    destinationIp: "203.0.113.89",
    destinationPort: 8443,
    vector: "Periodic TLS Jitter Beaconing (C2)",
    ruleId: "tls-cadence-c2-v1",
    score: 0.64,
    severity: "MEDIUM",
    detectionMethod: "Fourier Transform & Interval Autocorrelation",
    reasons: [
      "Regular periodic outbound connection pattern every 60.2s with <3% jitter variance.",
      "SNI header does not resolve to known cloud vendor or public web property."
    ],
    measuredFeatures: [
      { feature: "Interval Autocorrelation", observed: "0.941 r-val", baseline: "0.120 r-val", deviation: "+684%" },
      { feature: "Jitter Variance", observed: "±1.8 sec", baseline: "±180.0 sec", deviation: "-99%" }
    ],
    supportingEventIds: ["EVT-901990", "EVT-901995"],
    relatedIncidents: [],
    investigationStatus: "open",
    aiInvestigation: null
  },
  {
    id: "ANOM-8916",
    timestamp: "2026-10-24T12:38:04.100Z",
    sourceIp: "192.168.1.150",
    sourcePort: 51240,
    destinationIp: "198.51.100.88",
    destinationPort: 80,
    vector: "HTTP User-Agent Anomaly",
    ruleId: "ua-outlier-v1",
    score: 0.32,
    severity: "LOW",
    detectionMethod: "Outlier Frequency Analyzer",
    reasons: [
      "Uncommon User-Agent string detected for administrative workstation."
    ],
    measuredFeatures: [
      { feature: "UA Frequency", observed: "1st occurrence", baseline: "Chrome/124.0", deviation: "New UA" }
    ],
    supportingEventIds: ["EVT-899812"],
    relatedIncidents: [],
    investigationStatus: "resolved",
    aiInvestigation: null
  }
];

export const DEMO_EVENTS = [
  {
    id: "EVT-904128",
    timestamp: "2026-10-24T12:44:02.190Z",
    sourceIp: "10.244.18.91",
    sourcePort: 53218,
    destinationIp: "198.51.100.4",
    destinationPort: 53,
    protocol: "UDP",
    durationMs: 42,
    bytesIn: 482,
    bytesOut: 98,
    packets: 4,
    flags: "N/A",
    status: "anomalous"
  },
  {
    id: "EVT-904125",
    timestamp: "2026-10-24T12:43:59.880Z",
    sourceIp: "192.168.10.45",
    sourcePort: 443,
    destinationIp: "172.16.8.12",
    destinationPort: 443,
    protocol: "TCP",
    durationMs: 12,
    bytesIn: 64,
    bytesOut: 0,
    packets: 1,
    flags: "SYN",
    status: "anomalous"
  },
  {
    id: "EVT-904120",
    timestamp: "2026-10-24T12:43:55.120Z",
    sourceIp: "10.0.1.50",
    sourcePort: 41200,
    destinationIp: "10.0.1.1",
    destinationPort: 443,
    protocol: "TCP",
    durationMs: 1204,
    bytesIn: 18402,
    bytesOut: 4520,
    packets: 32,
    flags: "ACK, PSH",
    status: "normal"
  },
  {
    id: "EVT-904118",
    timestamp: "2026-10-24T12:43:52.010Z",
    sourceIp: "10.0.4.112",
    sourcePort: 445,
    destinationIp: "10.0.4.19",
    destinationPort: 445,
    protocol: "TCP",
    durationMs: 85,
    bytesIn: 1420,
    bytesOut: 320,
    packets: 6,
    flags: "SYN, ACK",
    status: "anomalous"
  },
  {
    id: "EVT-904115",
    timestamp: "2026-10-24T12:43:48.330Z",
    sourceIp: "172.16.1.100",
    sourcePort: 38920,
    destinationIp: "8.8.8.8",
    destinationPort: 53,
    protocol: "UDP",
    durationMs: 18,
    bytesIn: 142,
    bytesOut: 68,
    packets: 2,
    flags: "N/A",
    status: "normal"
  },
  {
    id: "EVT-904112",
    timestamp: "2026-10-24T12:43:40.500Z",
    sourceIp: "10.10.1.205",
    sourcePort: 88,
    destinationIp: "10.10.1.5",
    destinationPort: 88,
    protocol: "TCP",
    durationMs: 24,
    bytesIn: 1280,
    bytesOut: 840,
    packets: 8,
    flags: "ACK",
    status: "anomalous"
  },
  {
    id: "EVT-904108",
    timestamp: "2026-10-24T12:43:35.220Z",
    sourceIp: "192.168.1.102",
    sourcePort: null, // Test missing port
    destinationIp: "192.168.1.1",
    destinationPort: null,
    protocol: "ICMP",
    durationMs: null, // Test missing duration
    bytesIn: 64,
    bytesOut: 64,
    packets: 2,
    flags: "Echo Request",
    status: "normal"
  },
  {
    id: "EVT-904105",
    timestamp: "2026-10-24T12:43:28.110Z",
    sourceIp: "10.244.18.91",
    sourcePort: 53210,
    destinationIp: "198.51.100.4",
    destinationPort: 53,
    protocol: "UDP",
    durationMs: 38,
    bytesIn: 480,
    bytesOut: 98,
    packets: 4,
    flags: "N/A",
    status: "anomalous"
  }
];

export const DEMO_INCIDENTS = [
  {
    id: "INC-402",
    title: "Suspicious High-Entropy DNS Exfiltration via Pod",
    severity: "CRITICAL",
    status: "investigating",
    firstObserved: "2026-10-24T12:40:10.000Z",
    lastObserved: "2026-10-24T12:44:02.190Z",
    assignedAnalyst: "sec-op-402 (Senior SecOps Analyst)",
    affectedHosts: ["10.244.18.91", "198.51.100.4"],
    relatedAnomalies: ["ANOM-8921"],
    summary: "Active high-entropy DNS tunnel detected streaming Base64-like encoded records to unlisted authoritative resolver.",
    containmentStatus: "Uncontained - Egress block pending",
    evidenceTimeline: [
      { timestamp: "12:40:10 UTC", event: "Initial DNS TXT query burst initiated from internal pod 10.244.18.91" },
      { timestamp: "12:41:45 UTC", event: "Shannon entropy score crossed 6.5, alerting Isolation Forest classifier" },
      { timestamp: "12:43:10 UTC", event: "Query frequency escalated to 84 queries/sec; anomaly score reached 0.96" },
      { timestamp: "12:44:02 UTC", event: "Incident INC-402 created and flagged for urgent containment" }
    ],
    aiFindings: {
      provider: "gemma-api",
      assessment: "Strong indication of automated covert data transfer. Recommend applying immediate firewall egress drop on UDP/53 destination 198.51.100.4."
    }
  },
  {
    id: "INC-401",
    title: "Inbound TCP SYN Flood on DMZ Reverse Proxy",
    severity: "CRITICAL",
    status: "open",
    firstObserved: "2026-10-24T12:42:00.000Z",
    lastObserved: "2026-10-24T12:43:58.460Z",
    assignedAnalyst: "Unassigned",
    affectedHosts: ["192.168.10.45", "172.16.8.12"],
    relatedAnomalies: ["ANOM-8920"],
    summary: "Large-scale TCP SYN flood targeting external HTTPS port 443 with asymmetric SYN:ACK ratio.",
    containmentStatus: "Mitigated via SYN cookies",
    evidenceTimeline: [
      { timestamp: "12:42:00 UTC", event: "Spike in embryonic connections registered on edge firewall" },
      { timestamp: "12:43:58 UTC", event: "Anomaly ANOM-8920 raised with score 0.94" }
    ],
    aiFindings: null
  },
  {
    id: "INC-398",
    title: "Internal Lateral Reconnaissance over SMB",
    severity: "HIGH",
    status: "investigating",
    firstObserved: "2026-10-24T12:35:10.000Z",
    lastObserved: "2026-10-24T12:43:12.820Z",
    assignedAnalyst: "sec-op-114",
    affectedHosts: ["10.0.4.112"],
    relatedAnomalies: ["ANOM-8919"],
    summary: "Single workstation scanning multiple adjacent subnet hosts on port 445.",
    containmentStatus: "Host quarantined from corporate VLAN",
    evidenceTimeline: [
      { timestamp: "12:35:10 UTC", event: "Port 445 connections initiated across 10.0.4.0/24 subnet" },
      { timestamp: "12:43:12 UTC", event: "High degree fanout heuristic triggered ANOM-8919" }
    ],
    aiFindings: null
  },
  {
    id: "INC-392",
    title: "Anomalous Kerberos Ticket Encryption Downgrade",
    severity: "MEDIUM",
    status: "resolved",
    firstObserved: "2026-10-24T11:20:00.000Z",
    lastObserved: "2026-10-24T11:45:00.000Z",
    assignedAnalyst: "sec-op-402",
    affectedHosts: ["10.10.1.205"],
    relatedAnomalies: ["ANOM-8918"],
    summary: "Legacy service account requested RC4-HMAC ticket. Confirmed as legacy payroll application during triage.",
    containmentStatus: "Closed as Approved Exception",
    evidenceTimeline: [
      { timestamp: "11:20:00 UTC", event: "RC4 Kerberos request received" },
      { timestamp: "11:45:00 UTC", event: "Analyst verified legacy application change ticket RFC-8192" }
    ],
    aiFindings: null
  }
];

export const DEMO_AI_PROVIDERS = [
  {
    id: "gemma-api",
    name: "Gemma Security Guard (API)",
    type: "cloud_api",
    status: "available",
    latency: "142ms",
    description: "Cloud-hosted Gemma 2 model fine-tuned for cybersecurity analysis and root cause investigation.",
    isDefault: true
  },
  {
    id: "ollama",
    name: "Ollama Local LLM",
    type: "local",
    status: "available",
    latency: "38ms",
    description: "Locally running LLM container via Ollama (e.g., Llama 3 / Mistral) with zero external network egress.",
    isDefault: false
  }
];
