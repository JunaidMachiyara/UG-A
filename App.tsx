

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Accounting } from './components/Accounting';
import { DataEntry } from './components/DataEntry';
import { ChatAssistant } from './components/ChatAssistant';
import { SetupModule } from './components/Setup';
import { ContainerOffloading } from './components/ContainerOffloading';
import { PostingModule } from './components/PostingModule';
import { LogisticsModule } from './components/Logistics';
import { ReportsModuleV2 } from './components/ReportsModuleV2'; 
import { HRModule } from './components/HRModule';
import { ChatModule } from './components/ChatModule';
import { CustomsModule } from './components/CustomsModule';
import { DatabaseSetup } from './components/DatabaseSetup';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🔥 App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-red-800 mb-4">⚠️ Application Error</h1>
            <p className="text-red-700 mb-4">Something went wrong while loading the app.</p>
            <div className="bg-white p-4 rounded border border-red-200 mb-4">
              <p className="font-mono text-sm text-red-600">{this.state.error?.message}</p>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Reload Application
            </button>
            <p className="text-xs text-red-600 mt-4">Check the browser console (F12) for more details.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Placeholder components for routes not yet fully implemented
const Placeholder = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p>This module is currently under development.</p>
    </div>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <DataProvider>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/accounting" element={<Accounting />} />
              <Route path="/entry" element={<DataEntry />} />
              <Route path="/production" element={<DataEntry />} />
              <Route path="/offloading" element={<ContainerOffloading />} />
              <Route path="/posting" element={<PostingModule />} />
              
              <Route path="/logistics" element={<LogisticsModule />} />
              <Route path="/customs" element={<CustomsModule />} />
              <Route path="/hr" element={<HRModule />} />
              <Route path="/chat" element={<ChatModule />} />
              <Route path="/setup" element={<SetupModule />} />
              
              <Route path="/reports" element={<ReportsModuleV2 />} />
              
              <Route path="/admin" element={<Placeholder title="Administration" />} />
              <Route path="/db-setup" element={<DatabaseSetup />} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <ChatAssistant />
          </Layout>
        </HashRouter>
      </DataProvider>
    </ErrorBoundary>
  );
};

export default App;

