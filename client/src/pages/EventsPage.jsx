import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Radio,
  RefreshCw,
  Clock,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import Header from '../components/layout/Header';
import GlassCard from '../components/common/GlassCard';
import OfflineBanner from '../components/common/OfflineBanner';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import EmptyState from '../components/common/EmptyState';
import netSutraApi from '../services/api';
import { useSocket } from '../context/SocketContext';
import { usePrototype, VIEW_STATES } from '../context/PrototypeContext';
import {
  formatUtcTime,
  formatBytes,
  formatDuration,
  formatIpPort,
} from '../utils/formatters';

export const EventsPage = () => {
  const { viewState } = usePrototype();
  const { liveEvents, connectionStatus } = useSocket();

  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [isLiveStreamActive, setIsLiveStreamActive] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const pageSize = 10;

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    const res = await netSutraApi.getEvents({
      search: searchQuery,
      protocol: protocolFilter,
      sortBy,
      sortOrder,
      page,
      limit: pageSize,
    });

    if (res.success) {
      const data = res.data?.events || res.data || [];
      setEvents(data);
      setTotal(res.data?.total ?? data.length);
      setIsDemo(!!res.isDemo);
    }
    setIsLoading(false);
  }, [searchQuery, protocolFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Merge live socket events if streaming is active
  const displayedEvents = React.useMemo(() => {
    if (!isLiveStreamActive || !liveEvents || liveEvents.length === 0) {
      return events;
    }
    const existingIds = new Set(events.map((e) => e.id));
    const newItems = liveEvents.filter((le) => !existingIds.has(le.id));
    return [...newItems, ...events];
  }, [isLiveStreamActive, liveEvents, events]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (viewState === VIEW_STATES.SKELETON) {
    return (
      <div className="space-y-6">
        <Header title="Network Events Telemetry" subtitle="Raw event stream and packet inspect flow" />
        <LoadingSkeleton type="table" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Header
        title="Network Events Telemetry"
        badge="RAW-FLOW-V2"
        subtitle="Ingested network connection flows, protocol headers, and packet measurements"
        isDemo={isDemo}
      />

      <OfflineBanner onRetry={fetchEvents} />

      {/* Control & Filter Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs font-mono">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search by IP (e.g. 10.244.18.91), Event ID, or destination..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Protocol dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 uppercase text-[10px] hidden sm:inline">PROTOCOL:</span>
            <select
              value={protocolFilter}
              onChange={(e) => {
                setProtocolFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <option value="ALL">All Protocols</option>
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ICMP">ICMP</option>
              <option value="DNS">DNS</option>
              <option value="HTTP">HTTP</option>
            </select>

            {/* Live stream toggle */}
            <button
              onClick={() => setIsLiveStreamActive(!isLiveStreamActive)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all cursor-pointer ${
                isLiveStreamActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${isLiveStreamActive ? 'animate-pulse text-emerald-500' : ''}`} />
              <span>{isLiveStreamActive ? 'Live Stream: ON' : 'Live Stream: PAUSED'}</span>
            </button>

            <button
              onClick={fetchEvents}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Events Data Table */}
      <GlassCard className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('timestamp')}
                  className="pb-2.5 font-semibold cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <div className="flex items-center gap-1">
                    <span>TIMESTAMP (UTC)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="pb-2.5 font-semibold">EVENT ID</th>
                <th className="pb-2.5 font-semibold">SOURCE IP:PORT</th>
                <th className="pb-2.5 font-semibold">DESTINATION IP:PORT</th>
                <th className="pb-2.5 font-semibold">PROTOCOL</th>
                <th
                  onClick={() => handleSort('durationMs')}
                  className="pb-2.5 font-semibold cursor-pointer hover:text-slate-700"
                >
                  <div className="flex items-center gap-1">
                    <span>DURATION</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('bytesIn')}
                  className="pb-2.5 font-semibold text-right cursor-pointer hover:text-slate-700"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>BYTES (IN/OUT)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="pb-2.5 font-semibold text-right">PACKETS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/60 text-xs font-mono">
              {isLoading && displayedEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    Loading network connection records...
                  </td>
                </tr>
              ) : displayedEvents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    No network events match the specified query filters.
                  </td>
                </tr>
              ) : (
                displayedEvents.map((e) => (
                  <tr
                    key={e.id}
                    className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors ${
                      e.status === 'anomalous' ? 'bg-amber-50/30 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <td className="py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatUtcTime(e.timestamp)}
                    </td>
                    <td className="py-3 text-slate-500 dark:text-slate-400 font-bold whitespace-nowrap">
                      {e.id || 'Unavailable'}
                    </td>
                    <td className="py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatIpPort(e.sourceIp, e.sourcePort)}
                    </td>
                    <td className="py-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatIpPort(e.destinationIp, e.destinationPort)}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                        {e.protocol || 'Unavailable'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatDuration(e.durationMs)}
                    </td>
                    <td className="py-3 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {e.bytesIn !== null && e.bytesIn !== undefined ? (
                        <span>
                          {formatBytes(e.bytesIn)} / {formatBytes(e.bytesOut)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Unavailable</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {e.packets !== null && e.packets !== undefined ? e.packets : 'Unavailable'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
          <div>
            Showing {displayedEvents.length} records · Strict missing-data contract applied
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={displayedEvents.length < pageSize}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default EventsPage;
