import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import GlassCard from '../components/common/GlassCard';

export const NotFoundPage = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <GlassCard className="p-8 max-w-md text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Telemetry Route Not Found (404)</h2>
        <p className="text-xs text-slate-500 leading-relaxed font-mono">
          The requested SOC path does not correspond to an active network endpoint or investigation dossier.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Security Overview</span>
        </Link>
      </GlassCard>
    </div>
  );
};

export default NotFoundPage;
