import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  Play,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  FileText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import netSutraApi from '../../services/api';

export const IngestTelemetryModal = ({ isOpen, onClose, onIngested }) => {
  const [tab, setTab] = useState('sample'); // 'sample' | 'upload' | 'paste'
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setResult(null);
    setError(null);
    setSelectedFile(null);
    setRawText('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleIngestSample = async () => {
    setIsIngesting(true);
    setError(null);
    setResult(null);

    const res = await netSutraApi.ingestSampleTelemetry();
    setIsIngesting(false);

    if (res.success) {
      setResult(res.data);
      if (onIngested) onIngested(res.data);
    } else {
      setError(res.error?.message || 'Failed to ingest sample telemetry.');
    }
  };

  const handleUploadFile = async () => {
    if (!selectedFile) {
      setError('Please select a Zeek log file (.json, .log, or .txt).');
      return;
    }

    setIsIngesting(true);
    setError(null);
    setResult(null);

    const res = await netSutraApi.uploadZeekLogs(selectedFile);
    setIsIngesting(false);

    if (res.success) {
      setResult(res.data);
      if (onIngested) onIngested(res.data);
    } else {
      setError(res.error?.message || 'Failed to upload and ingest Zeek file.');
    }
  };

  const handlePasteSubmit = async () => {
    if (!rawText.trim()) {
      setError('Please paste valid Zeek JSON or NDJSON lines.');
      return;
    }

    setIsIngesting(true);
    setError(null);
    setResult(null);

    const res = await netSutraApi.uploadZeekLogs(rawText);
    setIsIngesting(false);

    if (res.success) {
      setResult(res.data);
      if (onIngested) onIngested(res.data);
    } else {
      setError(res.error?.message || 'Failed to parse and ingest pasted log content.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Ingest Network Telemetry
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Feed Zeek conn.log records into the anomaly detection engine
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selectors */}
        {!result && (
          <div className="flex items-center gap-1.5 p-1 my-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-mono">
            <button
              onClick={() => {
                setTab('sample');
                setError(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'sample'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>1-Click Sample</span>
            </button>
            <button
              onClick={() => {
                setTab('upload');
                setError(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'upload'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
            <button
              onClick={() => {
                setTab('paste');
                setError(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tab === 'paste'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Paste Logs</span>
            </button>
          </div>
        )}

        {/* Success Result View */}
        {result && (
          <div className="py-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Telemetry Ingested Successfully!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Records have been normalized, stored, and evaluated by the detection pipeline.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-left font-mono">
              <div>
                <span className="text-[10px] text-slate-400 uppercase">EVENTS</span>
                <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                  {result.ingested_events ?? result.events?.length ?? 10}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">ANOMALIES</span>
                <p className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                  {result.anomalies_detected ?? result.anomalies?.length ?? 0}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase">INCIDENTS</span>
                <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                  {result.incidents_created ?? result.incidents?.length ?? 0}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Ingest More Data
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs cursor-pointer"
              >
                Done / View Dashboard
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Sample Replay */}
        {!result && tab === 'sample' && (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-300">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Synthetic Zeek Attack Telemetry</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                Includes baseline traffic plus active attack vectors:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                <li>5 Baseline HTTPS connections (192.0.2.10 $\rightarrow$ 198.51.100.x)</li>
                <li>Data Exfiltration vector: 150 MB anomalous byte surge (42.5s duration)</li>
                <li>Multi-port reconnaissance scan: probing ports 22, 80, 445, 3389 (`REJ`)</li>
              </ul>
            </div>

            <button
              onClick={handleIngestSample}
              disabled={isIngesting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isIngesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Telemetry through AI Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Replay Sample Telemetry Now</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 2: Upload File */}
        {!result && tab === 'upload' && (
          <div className="space-y-4 py-2">
            <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group">
              <input
                type="file"
                accept=".json,.log,.txt"
                onChange={(e) => {
                  setSelectedFile(e.target.files?.[0] || null);
                  setError(null);
                }}
                className="hidden"
              />
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-blue-600 flex items-center justify-center mb-2">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {selectedFile ? selectedFile.name : 'Choose Zeek log file or drag & drop'}
              </span>
              <span className="text-[11px] text-slate-400 mt-1">
                Accepts Zeek conn.log (ASCII/TSV), JSON array, or NDJSON
              </span>
            </label>

            <button
              onClick={handleUploadFile}
              disabled={isIngesting || !selectedFile}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isIngesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Uploading & Ingesting...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload & Ingest Zeek File</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Tab 3: Paste Logs */}
        {!result && tab === 'paste' && (
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-mono text-slate-500 dark:text-slate-400 mb-1.5">
                Paste JSON Array or Newline-Delimited JSON (NDJSON):
              </label>
              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  setError(null);
                }}
                placeholder='[{"ts": 1792843200.0, "uid": "conn-01", "id.orig_h": "192.168.1.10", "id.resp_h": "10.0.0.5", "proto": "tcp", "conn_state": "SF"}]'
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handlePasteSubmit}
              disabled={isIngesting || !rawText.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isIngesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Parsing & Ingesting Payload...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Submit Raw Telemetry</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs font-mono flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default IngestTelemetryModal;
