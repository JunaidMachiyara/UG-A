

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
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
import { OriginalStockReport } from './components/reports/OriginalStockReport';
import { ItemPerformanceReport } from './components/reports/ItemPerformanceReport';
import { OrderFulfillmentDashboard } from './components/reports/OrderFulfillmentDashboard';
import { DataImportExport } from './components/DataImportExport';
import { AdminModule } from './components/AdminModule';
import { CSVValidator } from './components/CSVValidator';
import { FactoryManagement } from './components/FactoryManagement';
import { UserManagement } from './components/UserManagement';
import { InitialSetup } from './components/InitialSetup';
import { FactoryDataMigration } from './components/FactoryDataMigration';

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare readonly props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-8">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-red-800 mb-4">Application Error</h1>
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

// Protected Route Wrapper
const ProtectedRoutes: React.FC = () => {
  return (
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
        <Route path="/reports/original-stock" element={<OriginalStockReport />} />
        <Route path="/reports/item-performance" element={<ItemPerformanceReport />} />
        <Route path="/reports/order-fulfillment" element={<OrderFulfillmentDashboard />} />
        
        <Route path="/admin" element={<AdminModule />} />
        <Route path="/admin/factories" element={<FactoryManagement />} />
        <Route path="/admin/users" element={<UserManagement />} />
        <Route path="/admin/migration" element={<FactoryDataMigration />} />
        <Route path="/db-setup" element={<DatabaseSetup />} />
        <Route path="/import-export" element={<DataImportExport />} />
        <Route path="/csv-validator" element={<CSVValidator />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ChatAssistant />
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
};

const AppRouter: React.FC = () => {
  const { isAuthenticated, isLoading, factories } = useAuth();
  const [setupComplete, setSetupComplete] = React.useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-600 to-purple-600">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-xl font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  // Show initial setup if no factories exist
  if (!setupComplete && factories.length === 0 && !isAuthenticated) {
    return <InitialSetup onComplete={() => setSetupComplete(true)} />;
  }

  return (
    <HashRouter>
      {isAuthenticated ? (
        <DataProvider>
          <ProtectedRoutes />
        </DataProvider>
      ) : (
        <Login />
      )}
    </HashRouter>
  );
};

// Import useAuth after AuthProvider is defined
import { useAuth } from './context/AuthContext';

export default App;

