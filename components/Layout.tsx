
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, FileText, PieChart, User, Settings, ShoppingCart, Factory, Truck, Container, ClipboardCheck, Users, MessageSquare, Briefcase, Package, TrendingUp, Upload, CheckSquare } from 'lucide-react';
import { useData } from '../context/DataContext';
import { CURRENT_USER } from '../constants';

const SidebarItem = ({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: number }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
        <NavLink to={to} className={`flex items-center justify-between px-4 py-3 rounded-lg mb-1 transition-colors ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-200/50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
            <div className="flex items-center gap-3">
                <Icon size={20} />
                <span className="font-medium">{label}</span>
            </div>
            {badge ? (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {badge}
                </span>
            ) : null}
        </NavLink>
    );
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { state, isFirestoreLoaded, firestoreStatus, firestoreError } = useData();
    
    // Calculate global unread chat messages
    const unreadCount = state.chatMessages.filter(m => !m.readBy.includes(CURRENT_USER.id)).length;
    
    // Database Status Indicator
    const getStatusIndicator = () => {
        switch (firestoreStatus) {
            case 'loading':
                return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-yellow-700 font-medium">Loading from Firebase...</span>
                    </div>
                );
            case 'loaded':
                return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        <span className="text-xs text-emerald-700 font-medium">🔥 Live Sync Active</span>
                    </div>
                );
            case 'error':
                return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-xs text-red-700 font-medium">Error: {firestoreError}</span>
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                        <span className="text-xs text-slate-600 font-medium">Disconnected</span>
                    </div>
                );
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent tracking-tight">Usman Global</h1>
                    <p className="text-xs text-slate-500 mt-1">Inventory & ERP System</p>
                </div>
                <nav className="flex-1 px-3 py-2 overflow-y-auto">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-2">Main</div>
                    <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
                    
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">Operations</div>
                    <SidebarItem to="/entry" icon={ShoppingCart} label="Data Entry" />
                    <SidebarItem to="/offloading" icon={Container} label="Container Off-Loading" />
                    <SidebarItem to="/logistics" icon={Truck} label="Logistics" />
                    <SidebarItem to="/customs" icon={Briefcase} label="Customs" /> 
                    
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">Finance</div>
                    <SidebarItem to="/posting" icon={ClipboardCheck} label="Posting" />
                    <SidebarItem to="/accounting" icon={FileText} label="Accounting" />
                    <SidebarItem to="/reports" icon={PieChart} label="Reports" />
                    
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">System</div>
                    <SidebarItem to="/hr" icon={Users} label="HR & Fleet" />
                    <SidebarItem to="/chat" icon={MessageSquare} label="Chat" badge={unreadCount > 0 ? unreadCount : undefined} />
                    <SidebarItem to="/setup" icon={Database} label="Setup" />
                    <SidebarItem to="/csv-validator" icon={CheckSquare} label="CSV Validator" />
                    <SidebarItem to="/import-export" icon={Upload} label="Import/Export" />
                    <SidebarItem to="/admin" icon={Settings} label="Admin" />
                </nav>
                <div className="p-4 border-t border-slate-200">
                   <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">U</div>
                       <div>
                           <div className="text-sm font-medium text-slate-700">Admin User</div>
                           <div className="text-xs text-emerald-600">Online</div>
                       </div>
                   </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-800">
                        Overview
                    </h2>
                    <div className="flex items-center gap-4">
                        {getStatusIndicator()}
                        <div className="h-4 w-px bg-slate-300"></div>
                        <span className="text-sm text-slate-500">Cash: <span className="text-emerald-600 font-mono font-medium">${state.accounts.find(a=>a.name.includes('Cash'))?.balance.toLocaleString() ?? 0}</span></span>
                        <div className="h-4 w-px bg-slate-300"></div>
                         <span className="text-sm text-slate-500">Bank: <span className="text-blue-600 font-mono font-medium">${state.accounts.find(a=>a.name.includes('Bank'))?.balance.toLocaleString() ?? 0}</span></span>
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};
