
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, FileText, PieChart, User, Settings, ShoppingCart, Factory, Truck, Container, ClipboardCheck, Users, MessageSquare, Briefcase, Package, TrendingUp, Upload, CheckSquare, LogOut, Building2, ChevronDown } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { UserRole, PermissionModule } from '../types';
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
    const { currentUser, currentFactory, factories, logout, switchFactory, hasPermission } = useAuth();
    const [showFactorySwitcher, setShowFactorySwitcher] = useState(false);
    
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
                    {hasPermission(PermissionModule.DASHBOARD, 'view') && (
                        <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" />
                    )}
                    
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">Operations</div>
                    {hasPermission(PermissionModule.DATA_ENTRY, 'view') && (
                        <SidebarItem to="/entry" icon={ShoppingCart} label="Data Entry" />
                    )}
                    {hasPermission(PermissionModule.OFFLOADING, 'view') && (
                        <SidebarItem to="/offloading" icon={Container} label="Container Off-Loading" />
                    )}
                    {hasPermission(PermissionModule.LOGISTICS, 'view') && (
                        <SidebarItem to="/logistics" icon={Truck} label="Logistics" />
                    )}
                    {hasPermission(PermissionModule.CUSTOMS, 'view') && (
                        <SidebarItem to="/customs" icon={Briefcase} label="Customs" />
                    )}
                    
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">Finance</div>
                    {hasPermission(PermissionModule.POSTING, 'view') && (
                        <SidebarItem to="/posting" icon={ClipboardCheck} label="Posting" />
                    )}
                    {hasPermission(PermissionModule.ACCOUNTING, 'view') && (
                        <SidebarItem to="/accounting" icon={FileText} label="Accounting" />
                    )}
                    {hasPermission(PermissionModule.REPORTS, 'view') && (
                        <SidebarItem to="/reports" icon={PieChart} label="Reports" />
                    )}
                    
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">System</div>
                    {hasPermission(PermissionModule.HR, 'view') && (
                        <SidebarItem to="/hr" icon={Users} label="HR & Fleet" />
                    )}
                    {hasPermission(PermissionModule.CHAT, 'view') && (
                        <SidebarItem to="/chat" icon={MessageSquare} label="Chat" badge={unreadCount > 0 ? unreadCount : undefined} />
                    )}
                    {hasPermission(PermissionModule.SETUP, 'view') && (
                        <SidebarItem to="/setup" icon={Database} label="Setup" />
                    )}
                    <SidebarItem to="/csv-validator" icon={CheckSquare} label="CSV Validator" />
                    <SidebarItem to="/import-export" icon={Upload} label="Import/Export" />
                    
                    {/* Admin - Available to Super Admin and Factory Admin */}
                    {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.FACTORY_ADMIN) && (
                        <SidebarItem to="/admin" icon={Settings} label="Admin" />
                    )}
                    
                    {/* Factory & User Management - Super Admin Only */}
                    {currentUser?.role === UserRole.SUPER_ADMIN && (
                        <>
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4 mt-6">System Admin</div>
                            <SidebarItem to="/admin/factories" icon={Building2} label="Factories" />
                            <SidebarItem to="/admin/users" icon={Users} label="User Management" />
                            <SidebarItem to="/admin/migration" icon={Database} label="Data Migration" />
                        </>
                    )}
                </nav>
                <div className="p-4 border-t border-slate-200 space-y-3">
                    {/* Factory Indicator */}
                    {currentFactory && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                                <Building2 size={16} className="text-indigo-600" />
                                <span className="text-xs font-semibold text-indigo-900">Current Factory</span>
                            </div>
                            <div className="text-sm font-bold text-indigo-700">{currentFactory.name}</div>
                            <div className="text-xs text-indigo-600">{currentFactory.location}</div>
                            
                            {/* Factory Switcher for Super Admin */}
                            {currentUser?.role === UserRole.SUPER_ADMIN && factories.length > 1 && (
                                <div className="relative mt-2">
                                    <button
                                        onClick={() => setShowFactorySwitcher(!showFactorySwitcher)}
                                        className="w-full text-xs bg-white border border-indigo-300 rounded px-2 py-1.5 text-indigo-700 hover:bg-indigo-50 flex items-center justify-between"
                                    >
                                        <span>Switch Factory</span>
                                        <ChevronDown size={14} />
                                    </button>
                                    {showFactorySwitcher && (
                                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-indigo-200 rounded-lg shadow-lg z-50">
                                            {factories
                                                .filter(f => f.id !== currentFactory.id)
                                                .map(factory => (
                                                    <button
                                                        key={factory.id}
                                                        onClick={() => {
                                                            switchFactory(factory.id);
                                                            setShowFactorySwitcher(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 first:rounded-t-lg last:rounded-b-lg"
                                                    >
                                                        <div className="font-semibold text-indigo-900">{factory.name}</div>
                                                        <div className="text-indigo-600">{factory.location}</div>
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* User Info */}
                   <div className="flex items-center justify-between gap-3">
                       <div className="flex items-center gap-3 flex-1 min-w-0">
                           <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold flex-shrink-0">
                               {currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                           </div>
                           <div className="min-w-0 flex-1">
                               <div className="text-sm font-medium text-slate-700 truncate">{currentUser?.displayName || 'User'}</div>
                               <div className="text-xs text-emerald-600">Online</div>
                           </div>
                       </div>
                       <button
                           onClick={logout}
                           className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                           title="Logout"
                       >
                           <LogOut size={18} />
                       </button>
                   </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-slate-800">Overview</h2>
                        {currentFactory && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                                <Building2 size={16} />
                                {currentFactory.code}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        {getStatusIndicator()}
                        <div className="h-4 w-px bg-slate-300"></div>
                        <span className="text-sm text-slate-500">Cash: <span className="text-emerald-600 font-mono font-medium">${(state.accounts.find(a=>a.name.includes('Cash'))?.balance || 0).toLocaleString()}</span></span>
                        <div className="h-4 w-px bg-slate-300"></div>
                         <span className="text-sm text-slate-500">Bank: <span className="text-blue-600 font-mono font-medium">${(state.accounts.find(a=>a.name.includes('Bank'))?.balance || 0).toLocaleString()}</span></span>
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};
