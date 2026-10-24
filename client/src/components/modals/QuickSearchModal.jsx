import React, { useState, useEffect } from 'react';
import { Search, X, Activity, ShieldAlert, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ANOMALIES, DEMO_EVENTS, DEMO_INCIDENTS } from '../../data/mockData';

export const QuickSearchModal = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  const matchingAnomalies = q
    ? DEMO_ANOMALIES.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          a.sourceIp.includes(q) ||
          a.destinationIp.includes(q) ||
          a.vector.toLowerCase().includes(q)
      )
    : [];

  const matchingIncidents = q
    ? DEMO_INCIDENTS.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.title.toLowerCase().includes(q) ||
          i.summary.toLowerCase().includes(q)
      )
    : [];

  const matchingEvents = q
    ? DEMO_EVENTS.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.sourceIp?.includes(q) ||
          e.destinationIp?.includes(q)
      )
    : [];

  const handleSelect = (path) => {
    navigate(path);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-white/80 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Search Bar Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search IP, CIDR, anomaly ID, incident, or vector..."
            autoFocus
            className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none font-mono"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Results List */}
        <div className="max-h-80 overflow-y-auto p-3 space-y-3 text-xs font-mono">
          {!q && (
            <div className="py-8 text-center text-slate-400">
              Type an IP (e.g. <span className="font-bold text-blue-600">10.244.18.91</span>), Anomaly ID (<span className="font-bold text-blue-600">ANOM-8921</span>), or Incident (<span className="font-bold text-blue-600">INC-402</span>) to quickly inspect findings.
            </div>
          )}

          {matchingAnomalies.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-2 mb-1">
                Anomalies ({matchingAnomalies.length})
              </div>
              {matchingAnomalies.map((a) => (
                <div
                  key={a.id}
                  onClick={() => handleSelect(`/anomalies/${a.id}`)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{a.id} · {a.vector}</div>
                      <div className="text-[11px] text-slate-400">{a.sourceIp} → {a.destinationIp}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              ))}
            </div>
          )}

          {matchingIncidents.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-2 mb-1">
                Incidents ({matchingIncidents.length})
              </div>
              {matchingIncidents.map((i) => (
                <div
                  key={i.id}
                  onClick={() => handleSelect(`/incidents/${i.id}`)}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{i.id} · {i.title}</div>
                      <div className="text-[11px] text-slate-400">{i.summary}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              ))}
            </div>
          )}

          {matchingEvents.length > 0 && (
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-2 mb-1">
                Events ({matchingEvents.length})
              </div>
              {matchingEvents.map((e) => (
                <div
                  key={e.id}
                  onClick={() => handleSelect('/events')}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{e.id} · {e.protocol}</div>
                      <div className="text-[11px] text-slate-400">{e.sourceIp} → {e.destinationIp}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </div>
              ))}
            </div>
          )}

          {q && matchingAnomalies.length === 0 && matchingIncidents.length === 0 && matchingEvents.length === 0 && (
            <div className="py-6 text-center text-slate-400">
              No correlated entities found for "{query}".
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickSearchModal;
