import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Menu, X, Shield } from 'lucide-react';
import Sidebar from './components/layout/Sidebar';
import DashboardPage from './pages/DashboardPage';
import EventsPage from './pages/EventsPage';
import AnomaliesPage from './pages/AnomaliesPage';
import AnomalyDetailPage from './pages/AnomalyDetailPage';
import IncidentsPage from './pages/IncidentsPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import AiSettingsPage from './pages/AiSettingsPage';
import NotFoundPage from './pages/NotFoundPage';
import { SocketProvider } from './context/SocketContext';
import { PrototypeProvider } from './context/PrototypeContext';

function AppLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f1f5f9] dark:bg-[#0b0f17] text-slate-800 dark:text-slate-100 font-sans relative selection:bg-blue-600 selection:text-white">
      {/* Mobile Top Header Bar for hamburger menu */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-display font-extrabold text-sm tracking-wider text-slate-900 dark:text-white">
            NETSUTRA
          </span>
        </div>
        <button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
        >
          {mobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen overflow-y-auto">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-64 h-full bg-white dark:bg-slate-900 z-50">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 pt-18 lg:pt-8 min-w-0">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/anomalies" element={<AnomaliesPage />} />
          <Route path="/anomalies/:id" element={<AnomalyDetailPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
          <Route path="/ai-provider" element={<AiSettingsPage />} />
          <Route path="/settings" element={<AiSettingsPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <PrototypeProvider>
        <SocketProvider>
          <AppLayout />
        </SocketProvider>
      </PrototypeProvider>
    </BrowserRouter>
  );
}

export default App;
