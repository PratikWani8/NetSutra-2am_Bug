import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, ArrowRight, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import GlassCard from '../common/GlassCard';
import SeverityBadge from '../common/SeverityBadge';
import ScorePill from '../common/ScorePill';
import { formatUtcTime, formatIpPort } from '../../utils/formatters';

export const RecentAnomaliesTable = ({ anomalies = [], onInvestigate }) => {
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const safeAnomalies = Array.isArray(anomalies)
    ? anomalies
    : (anomalies?.items || anomalies?.anomalies || []);

  let filtered = [...safeAnomalies];
  if (severityFilter !== 'ALL') {
    filtered = filtered.filter(
      (a) => (a.severity || '').toUpperCase() === severityFilter.toUpperCase()
    );
  }
  if (statusFilter !== 'ALL') {
    filtered = filtered.filter((a) => {
      const status = (a.investigationStatus || a.status || '').toLowerCase();
      return status === statusFilter.toLowerCase();
    });
  }

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const displayed = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <GlassCard className="p-5 flex flex-col justify-between">
      {/* Header & Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <AtSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Recent Anomalies & Telemetry Stream
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time isolation forest vector matches (Auto-refresh: 1s)
          </p>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-2xs focus:outline-none cursor-pointer"
          >
            <option value="ALL">Status: All</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              <th className="pb-2 font-semibold">TIMESTAMP (UTC)</th>
              <th className="pb-2 font-semibold">SOURCE IP:PORT</th>
              <th className="pb-2 font-semibold">DESTINATION IP:PORT</th>
              <th className="pb-2 font-semibold">ANOMALY VECTOR</th>
              <th className="pb-2 font-semibold text-center">SCORE</th>
              <th className="pb-2 font-semibold text-center">SEV</th>
              <th className="pb-2 font-semibold text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 dark:divide-slate-800/60 text-xs font-mono">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-slate-400 text-xs font-mono">
                  No anomalies match the selected filters.
                </td>
              </tr>
            ) : (
              displayed.map((item, idx) => {
                const itemId = item.id || item.anomaly_id || `anom-${idx}`;
                const rawSrc = item.sourceIp || item.source_ip || item.features?.source_ip || item.features?.['id.orig_h'] || item.features?.src_ip || item.evidence?.[0]?.source_ip || item.evidence?.[0]?.['id.orig_h'];
                const srcIp = rawSrc && rawSrc !== 'N/A' && rawSrc !== 'undefined' ? rawSrc : (item.source_ip && item.source_ip !== 'N/A' ? item.source_ip : 'N/A');
                const srcPort = item.sourcePort ?? item.source_port ?? item.features?.source_port ?? item.features?.['id.orig_p'] ?? item.evidence?.[0]?.source_port;
                const rawDst = item.destinationIp || item.destination_ip || item.features?.destination_ip || item.features?.['id.resp_h'] || item.features?.dest_ip || item.evidence?.[0]?.destination_ip || item.evidence?.[0]?.['id.resp_h'];
                const dstIp = rawDst && rawDst !== 'N/A' && rawDst !== 'undefined' ? rawDst : (item.destination_ip && item.destination_ip !== 'N/A' ? item.destination_ip : 'N/A');
                const dstPort = item.destinationPort ?? item.destination_port ?? item.features?.destination_port ?? item.features?.['id.resp_p'] ?? item.evidence?.[0]?.destination_port;
                const vector = item.vector || item.method || (item.reasons && item.reasons[0]) || 'Network Anomaly';
                const rule = item.ruleId || item.rule_id || item.method;

                return (
                <tr
                  key={itemId}
                  className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors group"
                >
                  <td className="py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatUtcTime(item.timestamp)}
                  </td>
                  <td className="py-2.5 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {formatIpPort(srcIp, srcPort)}
                  </td>
                  <td className="py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {formatIpPort(dstIp, dstPort)}
                  </td>
                  <td className="py-2.5 max-w-xs truncate">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {vector}
                    </div>
                    {rule && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">
                        rule: {rule}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 text-center">
                    <ScorePill score={item.score} size="sm" />
                  </td>
                  <td className="py-2.5 text-center">
                    <SeverityBadge severity={item.severity} size="xs" />
                  </td>
                  <td className="py-2.5 text-right whitespace-nowrap">
                    <Link
                      to={`/anomalies/${itemId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-sans font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      <span>Inspect</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                  </td>
                </tr>
                  );
                })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination */}
      <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
        <span>
          Showing {displayed.length} of {filtered.length} correlated events
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-3 h-3" />
            <span>Prev</span>
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Next</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </GlassCard>
  );
};

export default RecentAnomaliesTable;
