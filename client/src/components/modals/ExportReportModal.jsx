import React, { useState } from 'react';
import { X, Download, FileJson, FileSpreadsheet, Check } from 'lucide-react';

export const ExportReportModal = ({ isOpen, onClose }) => {
  const [format, setFormat] = useState('json');
  const [includeAI, setIncludeAI] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExported(true);

      // Create downloadable artifact blob
      const dummyReport = {
        platform: 'NetSutra SOC Command Center v2.4',
        generatedAt: new Date().toISOString(),
        node: 'us-east-tap-04',
        format,
        metrics: {
          totalEvents: 14892410,
          anomaliesDetected: 842,
          openIncidents: 29,
          criticalIncidents: 4,
        },
        notice: 'Non-binding security telemetry summary report.',
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(dummyReport, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `netsutra-soc-report-${Date.now()}.${format}`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setTimeout(() => {
        setExported(false);
        onClose();
      }, 1000);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-white/80 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Export SOC Telemetry Report</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-xs font-mono">
          <div>
            <label className="text-slate-500 uppercase tracking-wider block mb-2 font-semibold">
              Select Export Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFormat('json')}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'json'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <FileJson className="w-4 h-4" />
                <span>JSON Schema</span>
              </button>

              <button
                onClick={() => setFormat('csv')}
                className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  format === 'csv'
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>CSV Records</span>
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeAI}
              onChange={(e) => setIncludeAI(e.target.checked)}
              className="rounded text-blue-600 focus:ring-0"
            />
            <span className="text-slate-700 dark:text-slate-300">
              Include AI investigation summaries & forensic check steps
            </span>
          </label>
        </div>

        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isExporting || exported}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
          >
            {exported ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Downloaded!</span>
              </>
            ) : isExporting ? (
              <span>Preparing Bundle...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Generate Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportReportModal;
