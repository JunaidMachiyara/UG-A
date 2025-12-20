
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Database, FileText, PieChart, User, Settings, ShoppingCart, Factory, Truck, Container, ClipboardCheck, Users, MessageSquare, Briefcase, Package, TrendingUp, Upload, CheckSquare, LogOut, Building2, ChevronDown, Menu, X, RefreshCw } from 'lucide-react';
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
    const { currentUser, currentFactory, factories, logout, switchFactory, hasPermission, refreshUser } = useAuth();
    const [showFactorySwitcher, setShowFactorySwitcher] = useState(false);
    const [showHeaderFactorySwitcher, setShowHeaderFactorySwitcher] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
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
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
            
            {/* Sidebar (Mobile / Tablet Only) */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out overflow-hidden lg:hidden ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
                <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <img 
                            src="/logo.jpg" 
                            alt="Usman Global Logo" 
                            className="h-12 w-12 object-contain flex-shrink-0 rounded"
                            onError={(e) => {
                                // Fallback if image doesn't load - hide image
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        <div>
                            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-emerald-600 bg-clip-text text-transparent tracking-tight">Usman Global</h1>
                            <p className="text-xs text-slate-500 mt-0.5">Inventory & ERP System</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                        <X size={20} />
                    </button>
                </div>
                <nav className="flex-1 px-3 py-2 overflow-y-auto min-h-0">
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
                            <SidebarItem to="/csv-validator" icon={CheckSquare} label="CSV Validator" />
                            <SidebarItem to="/import-export" icon={Upload} label="Import/Export" />
                            {/* Hidden: Data Migration tool - not needed for fresh start */}
                            {/* <SidebarItem to="/admin/migration" icon={Database} label="Data Migration" /> */}
                        </>
                    )}
                </nav>
                <div className="p-2 lg:p-4 border-t border-slate-200 shrink-0">
                    {/* Factory Indicator - Hidden on Mobile (moved to Dashboard) */}
                    {currentFactory && (
                        <div className="hidden lg:block bg-indigo-50 border border-indigo-200 rounded-lg p-2 lg:p-3">
                            <div className="flex items-center gap-1.5 lg:gap-2 mb-0.5 lg:mb-1">
                                <Building2 size={12} className="lg:w-4 lg:h-4 text-indigo-600" />
                                <span className="text-[10px] lg:text-xs font-semibold text-indigo-900">Current Factory</span>
                            </div>
                            <div className="text-xs lg:text-sm font-bold text-indigo-700 truncate">{currentFactory.name}</div>
                            <div className="text-[10px] lg:text-xs text-indigo-600 truncate">{currentFactory.location}</div>
                            
                            {/* Factory Switcher for Super Admin - Compact on Mobile */}
                            {currentUser?.role === UserRole.SUPER_ADMIN && factories.length > 1 && (
                                <div className="relative mt-1.5 lg:mt-2">
                                    <button
                                        onClick={() => setShowFactorySwitcher(!showFactorySwitcher)}
                                        className="w-full text-[10px] lg:text-xs bg-white border border-indigo-300 rounded px-1.5 lg:px-2 py-1 lg:py-1.5 text-indigo-700 hover:bg-indigo-50 flex items-center justify-between"
                                    >
                                        <span>Switch Factory</span>
                                        <ChevronDown size={12} className="lg:w-3.5 lg:h-3.5" />
                                    </button>
                                    {showFactorySwitcher && (
                                        <div className="absolute bottom-full left-0 right-0 mb-1 lg:mb-2 bg-white border border-indigo-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                            {factories
                                                .filter(f => f.id !== currentFactory.id)
                                                .map(factory => (
                                                    <button
                                                        key={factory.id}
                                                        onClick={() => {
                                                            switchFactory(factory.id);
                                                            setShowFactorySwitcher(false);
                                                        }}
                                                        className="w-full text-left px-2 lg:px-3 py-1.5 lg:py-2 text-[10px] lg:text-xs hover:bg-indigo-50 first:rounded-t-lg last:rounded-b-lg"
                                                    >
                                                        <div className="font-semibold text-indigo-900 truncate">{factory.name}</div>
                                                        <div className="text-indigo-600 truncate">{factory.location}</div>
                                                    </button>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* User Info & Actions - Mobile */}
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
                       <div className="flex items-center gap-1">
                           <button
                               onClick={async () => {
                                   await refreshUser();
                                   alert('Permissions refreshed! If you still don\'t see new modules, please log out and log back in.');
                               }}
                               className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                               title="Refresh Permissions"
                           >
                               <RefreshCw size={18} />
                           </button>
                           <button
                               onClick={() => {
                                   logout();
                                   window.location.href = '#/';
                               }}
                               className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                               title="Logout"
                           >
                               <LogOut size={18} />
                               <span className="hidden sm:inline font-medium">Logout</span>
                           </button>
                       </div>
                   </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 lg:px-8 shadow-sm">
                    <div className="flex items-center gap-2 md:gap-4">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                        >
                            <Menu size={20} />
                        </button>
                        <h2 className="text-base md:text-lg font-semibold text-slate-800 hidden sm:block">Overview</h2>
                        {/* Factory Selector - Desktop */}
                        {currentFactory && (
                            <div className="hidden lg:block relative">
                                <button
                                    onClick={() => setShowHeaderFactorySwitcher(!showHeaderFactorySwitcher)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 hover:border-indigo-300 rounded-lg text-sm font-medium text-indigo-700 transition-colors"
                                >
                                    <Building2 size={16} />
                                    <span className="max-w-[200px] truncate">{currentFactory.name}</span>
                                    <ChevronDown size={14} className={`transition-transform ${showHeaderFactorySwitcher ? 'rotate-180' : ''}`} />
                                </button>
                                {showHeaderFactorySwitcher && currentUser?.role === UserRole.SUPER_ADMIN && factories.length > 1 && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-indigo-200 rounded-lg shadow-lg z-50 min-w-[250px] max-h-64 overflow-y-auto">
                                        <div className="p-2">
                                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Switch Factory</div>
                                            {factories.map(factory => (
                                                <button
                                                    key={factory.id}
                                                    onClick={() => {
                                                        switchFactory(factory.id);
                                                        setShowHeaderFactorySwitcher(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-md hover:bg-indigo-50 transition-colors ${
                                                        factory.id === currentFactory.id ? 'bg-indigo-100 font-semibold' : ''
                                                    }`}
                                                >
                                                    <div className="text-sm font-medium text-indigo-900 truncate">{factory.name}</div>
                                                    <div className="text-xs text-indigo-600 truncate">{factory.location}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Factory Badge - Mobile/Tablet */}
                        {currentFactory && (
                            <div className="lg:hidden flex items-center gap-2 px-2 md:px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs md:text-sm font-medium">
                                <Building2 size={14} className="md:w-4 md:h-4" />
                                <span className="hidden md:inline">{currentFactory.code}</span>
                            </div>
                        )}
                        {/* Top navigation (Desktop) */}
                        <nav className="hidden lg:flex items-center gap-1 ml-4">
                            {hasPermission(PermissionModule.DASHBOARD, 'view') && (
                                <NavLink
                                    to="/"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <LayoutDashboard size={14} />
                                    <span>Dashboard</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.DATA_ENTRY, 'view') && (
                                <NavLink
                                    to="/entry"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <ShoppingCart size={14} />
                                    <span>Data Entry</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.OFFLOADING, 'view') && (
                                <NavLink
                                    to="/offloading"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <Container size={14} />
                                    <span>Off-Loading</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.LOGISTICS, 'view') && (
                                <NavLink
                                    to="/logistics"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <Truck size={14} />
                                    <span>Logistics</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.CUSTOMS, 'view') && (
                                <NavLink
                                    to="/customs"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <Briefcase size={14} />
                                    <span>Customs</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.POSTING, 'view') && (
                                <NavLink
                                    to="/posting"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <ClipboardCheck size={14} />
                                    <span>Posting</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.ACCOUNTING, 'view') && (
                                <NavLink
                                    to="/accounting"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <FileText size={14} />
                                    <span>Accounting</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.REPORTS, 'view') && (
                                <NavLink
                                    to="/reports"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <PieChart size={14} />
                                    <span>Reports</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.HR, 'view') && (
                                <NavLink
                                    to="/hr"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <Users size={14} />
                                    <span>HR & Fleet</span>
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.CHAT, 'view') && (
                                <NavLink
                                    to="/chat"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <MessageSquare size={14} />
                                    <span>Chat</span>
                                    {unreadCount > 0 && (
                                        <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                            {unreadCount}
                                        </span>
                                    )}
                                </NavLink>
                            )}
                            {hasPermission(PermissionModule.SETUP, 'view') && (
                                <NavLink
                                    to="/setup"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <Database size={14} />
                                    <span>Setup</span>
                                </NavLink>
                            )}
                            {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.FACTORY_ADMIN) && (
                                <NavLink
                                    to="/admin"
                                    className={({ isActive }) =>
                                        `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 border border-slate-300 ${
                                            isActive ? 'bg-blue-600 text-white border-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`
                                    }
                                >
                                    <Settings size={14} />
                                    <span>Admin</span>
                                </NavLink>
                            )}
                            {currentUser?.role === UserRole.SUPER_ADMIN && (
                                <>
                                    {/* Factories and Users moved to Admin page as tabs */}
                                    {/* CSV Validator and Import/Export moved to Admin page as tabs */}
                                    {/* Hidden: Data Migration tool - not needed for fresh start */}
                                    {/* <NavLink
                                        to="/admin/migration"
                                        className={({ isActive }) =>
                                            `px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1 ${
                                                isActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            }`
                                        }
                                    >
                                        <Database size={14} />
                                        <span>Migration</span>
                                    </NavLink> */}
                                </>
                            )}
                        </nav>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="hidden md:block">{getStatusIndicator()}</div>
                        <div className="hidden lg:flex items-center gap-4">
                            <div className="h-4 w-px bg-slate-300"></div>
                            <span className="text-xs md:text-sm text-slate-500">Cash: <span className="text-emerald-600 font-mono font-medium">${(state.accounts.find(a=>a.name.includes('Cash'))?.balance || 0).toLocaleString()}</span></span>
                            <div className="h-4 w-px bg-slate-300"></div>
                            <span className="text-xs md:text-sm text-slate-500">Bank: <span className="text-blue-600 font-mono font-medium">${(state.accounts.find(a=>a.name.includes('Bank'))?.balance || 0).toLocaleString()}</span></span>
                        </div>
                        {/* User Info & Actions - Desktop */}
                        <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-300">
                            <div className="flex items-center gap-2 pr-2">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                                    {currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-slate-700">{currentUser?.displayName || 'User'}</div>
                                    <div className="text-xs text-slate-500">{currentFactory?.name || ''}</div>
                                </div>
                            </div>
                            <button
                                onClick={async () => {
                                    await refreshUser();
                                    alert('Permissions refreshed! If you still don\'t see new modules, please log out and log back in.');
                                }}
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Refresh Permissions"
                            >
                                <RefreshCw size={16} />
                            </button>
                            <button
                                onClick={() => {
                                    logout();
                                    window.location.href = '#/';
                                }}
                                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Logout"
                            >
                                <LogOut size={16} />
                                <span className="font-medium">Logout</span>
                            </button>
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
                    {children}
                </div>
            </main>
        </div>
    );
};
