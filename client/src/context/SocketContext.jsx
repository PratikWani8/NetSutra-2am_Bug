import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import socketService from '../services/socket';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState(socketService.status);
  const [latency, setLatency] = useState(14);
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveAnomalies, setLiveAnomalies] = useState([]);
  const [incidentUpdates, setIncidentUpdates] = useState([]);
  const [sensorStatus, setSensorStatus] = useState({
    probe: 'Probe v2.4.1',
    status: 'Online',
    ping: 14,
    node: 'us-east-tap-04',
    eps: '1.2M EPS',
    loss: '0.00%',
  });
  const [aiStatus, setAiStatus] = useState({
    provider: 'gemma-api',
    status: 'Warm',
    latency: '142ms',
    inference: '42ms',
  });
  const [isSimulateMode, setIsSimulateMode] = useState(false);

  useEffect(() => {
    socketService.connect();

    const unsubStatus = socketService.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    const unsubNetwork = socketService.on('network:event', (event) => {
      setLiveEvents((prev) => [event, ...prev].slice(0, 50));
    });

    const unsubAnomaly = socketService.on('anomaly:detected', (anomaly) => {
      setLiveAnomalies((prev) => [anomaly, ...prev].slice(0, 30));
    });

    const unsubIncident = socketService.on('incident:updated', (incident) => {
      setIncidentUpdates((prev) => [incident, ...prev].slice(0, 20));
    });

    const unsubSensor = socketService.on('sensor:status', (sensor) => {
      setSensorStatus((prev) => ({ ...prev, ...sensor }));
    });

    const unsubAi = socketService.on('ai:status', (ai) => {
      setAiStatus((prev) => ({ ...prev, ...ai }));
    });

    return () => {
      unsubStatus();
      unsubNetwork();
      unsubAnomaly();
      unsubIncident();
      unsubSensor();
      unsubAi();
    };
  }, []);

  const reconnect = useCallback(() => {
    socketService.disconnect();
    setTimeout(() => {
      socketService.connect();
    }, 500);
  }, []);

  // Trigger test telemetry for prototype exploration
  const simulateLiveEvent = useCallback((type = 'network:event') => {
    const randomId = 'EVT-' + Math.floor(100000 + Math.random() * 900000);
    const mockIps = ['10.244.18.91', '192.168.10.45', '172.16.8.12', '198.51.100.4', '10.0.4.112'];
    const protocols = ['TCP', 'UDP', 'ICMP', 'DNS', 'TLS'];
    const src = mockIps[Math.floor(Math.random() * mockIps.length)];
    const dst = mockIps[Math.floor(Math.random() * mockIps.length)];
    const proto = protocols[Math.floor(Math.random() * protocols.length)];

    if (type === 'anomaly:detected') {
      const anomId = 'ANOM-' + Math.floor(1000 + Math.random() * 9000);
      const newAnomaly = {
        id: anomId,
        timestamp: new Date().toISOString(),
        sourceIp: src,
        sourcePort: Math.floor(1024 + Math.random() * 60000),
        destinationIp: dst,
        destinationPort: 443,
        vector: 'Simulated High-Rate Flow Spike',
        ruleId: 'flow-deviation-auto',
        score: +(0.7 + Math.random() * 0.28).toFixed(2),
        severity: Math.random() > 0.5 ? 'CRITICAL' : 'HIGH',
        investigationStatus: 'open',
      };
      socketService.simulateEvent('anomaly:detected', newAnomaly);
    } else {
      const newEvent = {
        id: randomId,
        timestamp: new Date().toISOString(),
        sourceIp: src,
        sourcePort: Math.floor(1024 + Math.random() * 60000),
        destinationIp: dst,
        destinationPort: proto === 'DNS' ? 53 : proto === 'TLS' ? 443 : 80,
        protocol: proto,
        durationMs: Math.floor(5 + Math.random() * 200),
        bytesIn: Math.floor(200 + Math.random() * 15000),
        bytesOut: Math.floor(100 + Math.random() * 8000),
        packets: Math.floor(1 + Math.random() * 20),
        status: Math.random() > 0.85 ? 'anomalous' : 'normal',
      };
      socketService.simulateEvent('network:event', newEvent);
    }
  }, []);

  return (
    <SocketContext.Provider
      value={{
        connectionStatus,
        latency,
        liveEvents,
        liveAnomalies,
        incidentUpdates,
        sensorStatus,
        aiStatus,
        reconnect,
        simulateLiveEvent,
        isSimulateMode,
        setIsSimulateMode,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
