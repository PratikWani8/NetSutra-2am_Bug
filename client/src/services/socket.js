import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.status = 'disconnected'; // 'connected' | 'connecting' | 'disconnected' | 'error'
    this.statusCallbacks = new Set();
    this.latency = 14; // Default ping display in ms
    this.reconnectTimer = null;
    this.seenIds = new Set(); // ID deduplication
  }

  connect() {
    if (this.socket && this.socket.connected) {
      return;
    }

    this.setStatus('connecting');

    try {
      this.socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        timeout: 5000,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.setStatus('connected');
        this.measureLatency();
      });

      this.socket.on('disconnect', (reason) => {
        this.setStatus('disconnected', reason);
      });

      this.socket.on('connect_error', (error) => {
        this.setStatus('error', error.message);
      });

      // Register standard NetSutra socket events
      const events = [
        'network:event',
        'anomaly:detected',
        'incident:updated',
        'sensor:status',
        'ai:status',
      ];

      events.forEach((eventName) => {
        this.socket.on(eventName, (data) => {
          this.handleIncomingEvent(eventName, data);
        });
      });
    } catch (err) {
      console.warn('[SocketService] Connection init error:', err);
      this.setStatus('error', err.message);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.setStatus('disconnected');
    }
  }

  setStatus(status, meta = null) {
    this.status = status;
    this.statusCallbacks.forEach((cb) => cb(status, meta));
  }

  onStatusChange(callback) {
    this.statusCallbacks.add(callback);
    callback(this.status);
    return () => this.statusCallbacks.delete(callback);
  }

  measureLatency() {
    if (!this.socket || !this.socket.connected) return;
    const start = Date.now();
    this.socket.emit('ping', () => {
      this.latency = Math.max(2, Date.now() - start);
    });
  }

  // Deduplication logic
  trackId(id) {
    if (!id) return true;
    if (this.seenIds.has(id)) {
      return false; // Duplicate
    }
    this.seenIds.add(id);
    if (this.seenIds.size > 2000) {
      // Free oldest records if cache gets large
      const firstEntry = this.seenIds.values().next().value;
      this.seenIds.delete(firstEntry);
    }
    return true; // New record
  }

  handleIncomingEvent(eventName, data) {
    // Check deduplication
    if (data?.id && !this.trackId(data.id)) {
      return; // Skip duplicate record
    }

    const callbacks = this.listeners.get(eventName) || [];
    callbacks.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error(`Error in socket listener for ${eventName}:`, err);
      }
    });
  }

  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);

    return () => {
      const callbacks = this.listeners.get(eventName) || [];
      this.listeners.set(
        eventName,
        callbacks.filter((cb) => cb !== callback)
      );
    };
  }

  // Simulated live event dispatcher for testing & demo purposes
  simulateEvent(eventName, data) {
    this.handleIncomingEvent(eventName, data);
  }
}

export const socketService = new SocketService();
export default socketService;
