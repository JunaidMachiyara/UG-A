
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
import { CustomsModule } from './components/CustomsModule'; // NEW IMPORT

// Placeholder components for routes not yet fully implemented
const Placeholder = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <h2 className="text-2xl font-bold mb-2">{title}</h2>
        <p>This module is currently under development.</p>
    </div>
);

const App: React.FC = () => {
  return (
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
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <ChatAssistant />
        </Layout>
      </HashRouter>
    </DataProvider>
  );
};

export default App;
