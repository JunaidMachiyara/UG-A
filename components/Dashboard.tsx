
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Treemap, Funnel, FunnelChart, LabelList } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Package, Users, DollarSign, Activity, Factory, TrendingUp, TrendingDown, Wallet, ShoppingCart, CreditCard, AlertCircle, Target, BarChart3, PieChart as PieChartIcon, Layers, Container, FileText, Building2, ChevronDown } from 'lucide-react';
import { CHART_COLORS } from '../constants';
import { AccountType, UserRole, PartnerType } from '../types';

// Format numbers in abbreviated format (1k, 1M, 1B, etc.)
const formatNumber = (num: number): string => {
    if (num === 0) return '0';
    const absNum = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    
    if (absNum >= 1000000000) {
        const value = absNum / 1000000000;
        return `${sign}${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}B`;
    } else if (absNum >= 1000000) {
        const value = absNum / 1000000;
        return `${sign}${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}M`;
    } else if (absNum >= 1000) {
        const value = absNum / 1000;
        return `${sign}${value % 1 === 0 ? value.toFixed(0) : value.toFixed(1)}k`;
    } else {
        // For numbers less than 1000, show up to 2 decimal places if needed
        return num.toLocaleString(undefined, { 
            maximumFractionDigits: absNum % 1 === 0 ? 0 : 2,
            minimumFractionDigits: 0
        });
    }
};

// Animation variants for stagger effect
const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 }
};

// Custom animated tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 backdrop-blur-xl border-2 border-blue-200 rounded-xl p-4 shadow-2xl animate-in fade-in zoom-in duration-200">
                <p className="font-bold text-slate-800 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <p key={index} className="text-sm flex items-center gap-2">
                        <span 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-slate-600">{entry.name}:</span>
                        <span className="font-bold text-slate-900">
                            {typeof entry.value === 'number' 
                                ? `$${formatNumber(entry.value)}` 
                                : entry.value}
                        </span>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

// Animated label for pie chart
const AnimatedPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="white"
            textAnchor={x > cx ? 'start' : 'end'}
            dominantBaseline="central"
            fontSize={12}
            fontWeight="bold"
            className="drop-shadow-lg"
        >
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

// Mobile Stat Card Component
const MobileStatCard = ({ title, value, icon: Icon, accentColor, onClick }: { title: string, value: string, icon: any, accentColor: 'blue' | 'green' | 'orange' | 'red' | 'yellow' | 'purple', onClick?: () => void }) => {
    const colorClasses = {
        blue: 'border-l-blue-500 bg-blue-50',
        green: 'border-l-green-500 bg-green-50',
        orange: 'border-l-orange-500 bg-orange-50',
        red: 'border-l-red-500 bg-red-50',
        yellow: 'border-l-yellow-500 bg-yellow-50',
        purple: 'border-l-purple-500 bg-purple-50'
    };
    
    const iconColors = {
        blue: 'text-blue-600',
        green: 'text-green-600',
        orange: 'text-orange-600',
        red: 'text-red-600',
        yellow: 'text-yellow-600',
        purple: 'text-purple-600'
    };
    
    return (
        <div 
            onClick={onClick}
            className={`bg-white p-4 rounded-lg border-l-4 ${colorClasses[accentColor]} shadow-sm transition-all duration-200 ${
                onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''
            }`}
        >
            <div className="flex items-center gap-3 mb-2">
                <Icon size={20} className={iconColors[accentColor]} />
                <p className="text-xs font-semibold text-slate-600">{title}</p>
            </div>
            <p className="text-xl font-bold text-slate-900">{value}</p>
        </div>
    );
};

const StatCard = ({ title, value, subValue, icon: Icon, trend, change, delay = 0 }: { title: string, value: string, subValue: string, icon: any, trend?: 'up' | 'down', change?: string, delay?: number }) => {
    const [isVisible, setIsVisible] = useState(false);
    
    useEffect(() => {
        const timer = setTimeout(() => setIsVisible(true), delay);
        return () => clearTimeout(timer);
    }, [delay]);

    return (
        <div 
            className={`bg-gradient-to-br from-white to-slate-50 p-6 rounded-xl border border-slate-200 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:scale-105 cursor-pointer ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            <div className="flex justify-between items-start">
                <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-900 mt-2 mb-1 transition-all duration-300 hover:text-blue-600">
                        {value}
                    </h3>
                    <p className="text-xs text-slate-600">{subValue}</p>
                </div>
                <div className={`p-3 rounded-xl shadow-md transform transition-all duration-300 hover:rotate-12 hover:scale-110 ${
                    trend === 'down' 
                        ? 'bg-gradient-to-br from-red-400 to-red-600 text-white' 
                        : 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
                }`}>
                    <Icon size={24} strokeWidth={2.5} />
                </div>
            </div>
            {change && (
                <div className="mt-4 flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-100 hover:border-blue-300 transition-colors">
                    {trend === 'up' ? (
                        <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm animate-pulse">
                            <TrendingUp size={16} />
                            <span>{change}</span>
                        </div>
                    ) : trend === 'down' ? (
                        <div className="flex items-center gap-1 text-red-600 font-bold text-sm animate-pulse">
                            <TrendingDown size={16} />
                            <span>{change}</span>
                        </div>
                    ) : (
                        <span className="text-slate-500 text-sm font-medium">{change}</span>
                    )}
                </div>
            )}
        </div>
    );
};

// New Yield Widget
const YieldWidget = () => {
    const { state } = useData();
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM

    const stats = useMemo(() => {
        // Inputs
        const openings = state.originalOpenings.filter(o => o.date.startsWith(currentMonth));
        const inputWeight = openings.reduce((s, o) => s + o.weightOpened, 0);
        const inputCost = openings.reduce((s, o) => s + o.totalValue, 0);
        const workingCost = inputWeight * 0.25; // Estimate

        // Outputs
        const production = state.productions.filter(p => p.date.startsWith(currentMonth) && p.qtyProduced > 0);
        const outputWeight = production.reduce((s, p) => s + p.weightProduced, 0);
        const outputValue = production.reduce((s, p) => {
            const item = state.items.find(i => i.id === p.itemId);
            return s + (p.qtyProduced * (item?.avgCost || 0)); // Cost Basis
        }, 0);

        const yieldPct = inputWeight > 0 ? (outputWeight / inputWeight) * 100 : 0;
        const profit = outputValue - (inputCost + workingCost);

        return { 
            yieldPct: yieldPct || 0, 
            profit: profit || 0, 
            inputCost: inputCost || 0, 
            outputValue: outputValue || 0 
        };
    }, [state.originalOpenings, state.productions, state.items, currentMonth]);

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Yield Analysis <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full ml-2">Current Month</span></h3>
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Factory size={20}/></div>
                </div>
                
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <div className="text-3xl font-bold text-slate-800">{stats.yieldPct.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500 uppercase font-bold">Weight Recovery</div>
                    </div>
                    <div className="text-right">
                        <div className={`text-xl font-bold ${stats.profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {stats.profit >= 0 ? '+' : ''}${stats.profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-xs text-slate-500 uppercase font-bold">Net Production Profit</div>
                    </div>
                </div>
            </div>

            {/* Mini Bar Visual */}
            <div className="mt-4 space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                    <span>Input Cost</span>
                    <span>${(stats.inputCost + (stats.inputCost * 0.1)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-slate-400 h-2 rounded-full" style={{ width: '100%' }}></div>
                </div>
                
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>Output Value</span>
                    <span>${stats.outputValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                        className={`h-2 rounded-full ${stats.profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                        style={{ width: `${Math.min((stats.outputValue / (stats.inputCost || 1)) * 100, 100)}%` }}
                    ></div>
                </div>
            </div>
        </div>
    );
}

export const Dashboard: React.FC = () => {
    const { state } = useData();
    const { currentUser, currentFactory, factories, switchFactory } = useAuth();
    const navigate = useNavigate();
    const [yieldTimeFilter, setYieldTimeFilter] = useState<'today' | 'yesterday' | '7days' | '30days'>('yesterday');
    const [workingCostPerKg, setWorkingCostPerKg] = useState<number>(0.17); // Default to 17 cents per kg
    const [showFactorySwitcher, setShowFactorySwitcher] = useState(false);

    // Production Yield Analysis Data
    const productionYieldData = useMemo(() => {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
        const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];

        let startDate = '';
        let endDate = today;
        
        switch (yieldTimeFilter) {
            case 'today': 
                startDate = today; 
                endDate = today;
                break;
            case 'yesterday': 
                startDate = yesterday; 
                endDate = yesterday;
                break;
            case '7days': 
                startDate = sevenDaysAgo; 
                break;
            case '30days': 
                startDate = thirtyDaysAgo; 
                break;
        }

        // Filter bale openings and production by date range (with safe checks)
        const openings = (state.originalOpenings || []).filter(b => b.date >= startDate && b.date <= endDate);
        // IMPORTANT: Exclude re-baling from production reports
        const productions = (state.productions || []).filter(p => 
            p.date >= startDate && 
            p.date <= endDate && 
            p.qtyProduced > 0 && 
            !p.isRebaling // Exclude re-baling transactions
        );

        // Calculate total raw material consumed (from openings)
        const totalRawMaterialKg = openings.reduce((sum, o) => {
            return sum + (o.weightOpened || 0);
        }, 0);

        // Calculate total finished goods produced
        const totalFinishedGoodsKg = productions.reduce((sum, p) => sum + (p.weightProduced || 0), 0);

        // Calculate yield percentage
        const yieldPercentage = totalRawMaterialKg > 0 ? (totalFinishedGoodsKg / totalRawMaterialKg) * 100 : 0;

        // Group by category for detailed breakdown
        const categoryBreakdown = productions.reduce((acc, p) => {
            const item = state.items.find(i => i.id === p.itemId);
            const category = item?.category || 'Unknown';
            const avgCost = item?.avgCost || 0;
            const worth = p.qtyProduced * avgCost;
            
            const existing = acc.find(x => x.category === category);
            if (existing) {
                existing.qty += p.qtyProduced;
                existing.weight += (p.weightProduced || 0);
                existing.worth += worth;
            } else {
                acc.push({
                    category,
                    qty: p.qtyProduced,
                    weight: p.weightProduced || 0,
                    worth
                });
            }
            return acc;
        }, [] as { category: string; qty: number; weight: number; worth: number }[]);

        // Sort by weight descending and take top 10
        const topCategories = categoryBreakdown.sort((a, b) => b.weight - a.weight).slice(0, 10);
        
        // Track original combinations used
        const originalCombinations = openings.reduce((acc, o) => {
            const item = state.items.find(i => i.id === o.itemId);
            const originalType = o.originalType || item?.name || 'Unknown';
            const existing = acc.find(x => x.originalType === originalType);
            if (existing) {
                existing.weight += (o.weightOpened || 0);
                existing.count += 1;
            } else {
                acc.push({
                    originalType,
                    weight: o.weightOpened || 0,
                    count: 1
                });
            }
            return acc;
        }, [] as { originalType: string; weight: number; count: number }[]);
        
        const topOriginals = originalCombinations.sort((a, b) => b.weight - a.weight).slice(0, 10);

        // Calculate Net Profit/Loss: (Production Value) - (Raw Material Cost + Working Cost)
        const rawMaterialCost = totalRawMaterialKg * 1; // $1 per kg for raw material
        const workingCost = totalRawMaterialKg * workingCostPerKg; // Adjustable working cost per kg
        const totalProductionValue = productions.reduce((sum, p) => {
            const item = state.items.find(i => i.id === p.itemId);
            const productionValue = p.qtyProduced * (item?.avgCost || 0);
            return sum + productionValue;
        }, 0);
        const netProfitLoss = totalProductionValue - (rawMaterialCost + workingCost);

        return {
            totalRawMaterialKg,
            totalFinishedGoodsKg,
            yieldPercentage,
            wastageKg: totalRawMaterialKg - totalFinishedGoodsKg,
            wastagePercentage: totalRawMaterialKg > 0 ? ((totalRawMaterialKg - totalFinishedGoodsKg) / totalRawMaterialKg) * 100 : 0,
            netProfitLoss,
            topCategories,
            topOriginals,
            totalCategories: categoryBreakdown.length
        };
    }, [state.originalOpenings, state.productions, state.items, yieldTimeFilter, workingCostPerKg]);

    // Enhanced Financial Metrics
    const metrics = useMemo(() => {
        const cash = state.accounts.find(a => a.code === '1001')?.balance || 0;
        const bank = state.accounts.find(a => a.code === '1010')?.balance || 0;
        
        // Accounts Receivable: Use same calculation as Balance Sheet - sum of positive customer balances (Debtors)
        // This matches the "Debtors (Accounts Receivable)" value from the Balance Sheet
        const customersAR = state.partners
            .filter(p => p.type === PartnerType.CUSTOMER && p.balance > 0)
            .reduce((sum, c) => sum + c.balance, 0);
        const receivables = customersAR;
        
        // Accounts Payable: Use same calculation as Balance Sheet - sum of negative supplier balances (Creditors)
        // This matches the "Creditors (Accounts Payable)" value from the Balance Sheet
        const suppliersAP = state.partners
            .filter(p => [PartnerType.SUPPLIER, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(p.type) && p.balance < 0)
            .reduce((sum, s) => sum + Math.abs(s.balance), 0);
        const payables = suppliersAP;
        
        const assets = state.accounts.filter(a => a.type === AccountType.ASSET).reduce((sum, a) => sum + a.balance, 0);
        const liabilities = state.accounts.filter(a => a.type === AccountType.LIABILITY).reduce((sum, a) => sum + a.balance, 0);
        const equity = state.accounts.filter(a => a.type === AccountType.EQUITY).reduce((sum, a) => sum + a.balance, 0);
        const revenue = state.accounts.filter(a => a.type === AccountType.REVENUE).reduce((sum, a) => sum + Math.abs(a.balance), 0);
        const expenses = state.accounts.filter(a => a.type === AccountType.EXPENSE).reduce((sum, a) => sum + a.balance, 0);
        
        const inventory = state.accounts.filter(a => a.code?.startsWith('12')).reduce((sum, a) => sum + a.balance, 0);
        
        // Raw Materials Inventory: Account code 1200
        const rawMaterialsInventory = state.accounts.find(a => a.code === '1200' || a.name.includes('Raw Material'))?.balance || 0;
        
        // Finished Goods Inventory: Account code 1202
        const finishedGoodsInventory = state.accounts.find(a => a.code === '1202' || a.name.includes('Finished Goods'))?.balance || 0;
        
        const netProfit = revenue - expenses;
        
        // Calculate Net Working Capital properly: Current Assets - Current Liabilities
        // Current Assets: All accounts with code 1000-1999 (all asset accounts are current)
        const currentAssetsAccounts = state.accounts
            .filter(a => {
                if (a.type !== AccountType.ASSET) return false;
                const codeNum = parseInt(a.code || '0');
                return !isNaN(codeNum) && codeNum >= 1000 && codeNum < 2000;
            })
            .reduce((sum, a) => sum + a.balance, 0);
        
        // - Positive supplier balances = Advances to Suppliers (Asset)
        const supplierAdvances = state.partners
            .filter(p => [PartnerType.SUPPLIER, PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT].includes(p.type) && p.balance > 0)
            .reduce((sum, s) => sum + s.balance, 0);
        
        // Total Current Assets = Account balances + Partner receivables + Supplier advances
        const currentAssets = currentAssetsAccounts + customersAR + supplierAdvances;
        
        // Current Liabilities: All accounts with code 2000-2499 (excluding long-term which start at 2500)
        const currentLiabilitiesAccounts = state.accounts
            .filter(a => {
                if (a.type !== AccountType.LIABILITY) return false;
                const codeNum = parseInt(a.code || '0');
                return !isNaN(codeNum) && codeNum >= 2000 && codeNum < 2500;
            })
            .reduce((sum, a) => sum + a.balance, 0);
        
        // Add partner balances to current liabilities:
        // - Negative customer balances = Customer Advances (Liability)
        const customerAdvances = state.partners
            .filter(p => p.type === PartnerType.CUSTOMER && p.balance < 0)
            .reduce((sum, c) => sum + Math.abs(c.balance), 0);
        
        // - Negative supplier balances = Accounts Payable (Creditors) - already calculated above
        
        // Total Current Liabilities = Account balances + Customer advances + Supplier payables
        const currentLiabilities = currentLiabilitiesAccounts + customerAdvances + suppliersAP;
        
        // Net Working Capital = Current Assets - Current Liabilities
        const workingCapital = currentAssets - currentLiabilities;
        
        return {
            cash, bank, receivables, payables, assets, liabilities, equity,
            revenue, expenses, inventory, rawMaterialsInventory, finishedGoodsInventory, netProfit, workingCapital,
            currentAssets, currentLiabilities, // Added for reference
            totalLiquidity: cash + bank,
            currentRatio: currentLiabilities > 0 ? (currentAssets / currentLiabilities) : 0
        };
    }, [state.accounts, state.partners]);

    // Waterfall Chart Data - Cash Flow Analysis
    const waterfallData = useMemo(() => {
        const openingCash = metrics.cash + metrics.bank - 5000; // Mock opening
        return [
            { name: 'Opening Cash', value: openingCash, fill: CHART_COLORS.dark },
            { name: 'Revenue', value: metrics.revenue / 10, fill: CHART_COLORS.secondary },
            { name: 'Expenses', value: -(metrics.expenses / 10), fill: CHART_COLORS.danger },
            { name: 'Receivables', value: -metrics.receivables / 5, fill: CHART_COLORS.accent },
            { name: 'Payables', value: metrics.payables / 5, fill: CHART_COLORS.danger },
            { name: 'Closing Cash', value: metrics.totalLiquidity, fill: CHART_COLORS.primary }
        ];
    }, [metrics]);

    // Account Hierarchy/Treemap Data
    const hierarchyData = useMemo(() => {
        const assetAccounts = state.accounts.filter(a => a.type === AccountType.ASSET && a.balance > 0);
        const liabilityAccounts = state.accounts.filter(a => a.type === AccountType.LIABILITY && a.balance > 0);
        
        return [
            {
                name: 'Assets',
                children: assetAccounts.slice(0, 8).map(a => ({
                    name: a.name.length > 20 ? a.name.substring(0, 20) + '...' : a.name,
                    size: Math.abs(a.balance),
                    fill: CHART_COLORS.primary
                }))
            },
            {
                name: 'Liabilities',
                children: liabilityAccounts.slice(0, 8).map(a => ({
                    name: a.name.length > 20 ? a.name.substring(0, 20) + '...' : a.name,
                    size: Math.abs(a.balance),
                    fill: CHART_COLORS.danger
                }))
            }
        ];
    }, [state.accounts]);

    // Partner Performance Data
    const partnerData = useMemo(() => {
        return state.partners.slice(0, 10).map(p => ({
            name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
            balance: Math.abs(p.balance),
            type: p.type
        })).sort((a, b) => b.balance - a.balance);
    }, [state.partners]);

    // Inventory Funnel
    const inventoryFunnel = useMemo(() => {
        const rawMaterials = state.items.filter(i => i.category === 'Raw Material').reduce((s, i) => s + (i.stockQty || 0), 0);
        const wip = state.items.filter(i => i.name.includes('WIP')).reduce((s, i) => s + (i.stockQty || 0), 0);
        const finished = state.items.filter(i => i.category !== 'Raw Material' && !i.name.includes('WIP')).reduce((s, i) => s + (i.stockQty || 0), 0);
        
        return [
            { name: 'Raw Materials', value: rawMaterials || 1000, fill: '#8884d8' },
            { name: 'Work in Progress', value: wip || 600, fill: '#83a6ed' },
            { name: 'Finished Goods', value: finished || 300, fill: '#8dd1e1' }
        ];
    }, [state.items]);

    // Financial Health Radar
    const healthRadar = useMemo(() => {
        const maxRevenue = 50000;
        const maxAssets = 100000;
        const maxLiquidity = 30000;
        
        return [
            { metric: 'Liquidity', value: Math.min((metrics.totalLiquidity / maxLiquidity) * 100, 100), fullMark: 100 },
            { metric: 'Revenue', value: Math.min((metrics.revenue / maxRevenue) * 100, 100), fullMark: 100 },
            { metric: 'Assets', value: Math.min((metrics.assets / maxAssets) * 100, 100), fullMark: 100 },
            { metric: 'Working Capital', value: Math.min((metrics.workingCapital / maxLiquidity) * 100, 100), fullMark: 100 },
            { metric: 'Net Profit', value: Math.min((metrics.netProfit / maxRevenue) * 100, 100), fullMark: 100 }
        ];
    }, [metrics]);

    // Monthly Trend Data
    const monthlyTrend = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        return months.map((month, idx) => ({
            name: month,
            revenue: Math.random() * 10000 + 5000,
            expenses: Math.random() * 8000 + 3000,
            profit: Math.random() * 3000 + 1000
        }));
    }, []);

    // Account Type Distribution for Pie Chart
    const accountDistribution = useMemo(() => [
        { name: 'Assets', value: state.accounts.filter(a => a.type === AccountType.ASSET).length, color: CHART_COLORS.primary },
        { name: 'Liabilities', value: state.accounts.filter(a => a.type === AccountType.LIABILITY).length, color: CHART_COLORS.danger },
        { name: 'Equity', value: state.accounts.filter(a => a.type === AccountType.EQUITY).length, color: CHART_COLORS.accent },
        { name: 'Revenue', value: state.accounts.filter(a => a.type === AccountType.REVENUE).length, color: CHART_COLORS.secondary },
        { name: 'Expenses', value: state.accounts.filter(a => a.type === AccountType.EXPENSE).length, color: '#f59e0b' }
    ], [state.accounts]);

    const COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.accent, CHART_COLORS.danger, '#f59e0b'];

    // Calculate key metrics for mobile dashboard
    const dashboardMetrics = useMemo(() => {
        const totalCustomers = state.partners.filter(p => p.type === 'CUSTOMER').length;
        const totalSuppliers = state.partners.filter(p => p.type === 'SUPPLIER').length;
        const totalItems = state.items.length;
        const unpostedInvoices = state.salesInvoices.filter(inv => inv.status === 'Unposted').length;
        
        // Calculate Raw Material Stock (items with category 'Raw Material' or similar)
        const rawMaterialStock = state.items
            .filter(i => i.category?.toLowerCase().includes('raw') || i.name?.toLowerCase().includes('raw'))
            .reduce((sum, i) => sum + ((i.stockQty || 0) * (i.weightPerUnit || 1)), 0);
        
        // Calculate Finished Goods Stock (all other items)
        const finishedGoodsStock = state.items
            .filter(i => !i.category?.toLowerCase().includes('raw') && !i.name?.toLowerCase().includes('raw'))
            .reduce((sum, i) => sum + ((i.stockQty || 0) * (i.weightPerUnit || 1)), 0);
        
        return {
            totalCustomers,
            totalSuppliers,
            totalItems,
            unpostedInvoices,
            rawMaterialStock,
            finishedGoodsStock
        };
    }, [state.partners, state.items, state.salesInvoices]);

    return (
        <div className="space-y-6 pb-8">
            {/* Mobile-Optimized Header */}
            <div className="lg:hidden">
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Dashboard Overview</h1>
                        <p className="text-slate-600 text-sm">Welcome back! Here's a snapshot of your business.</p>
                    </div>
                    {/* Factory Selector - Mobile Only */}
                    {currentFactory && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2.5 shrink-0 min-w-[140px]">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Building2 size={14} className="text-indigo-600" />
                                <span className="text-[10px] font-semibold text-indigo-900">Current Factory</span>
                            </div>
                            <div className="text-xs font-bold text-indigo-700 truncate mb-0.5">{currentFactory.name}</div>
                            <div className="text-[10px] text-indigo-600 truncate">{currentFactory.location}</div>
                            
                            {/* Factory Switcher for Super Admin */}
                            {currentUser?.role === UserRole.SUPER_ADMIN && factories.length > 1 && (
                                <div className="relative mt-2">
                                    <button
                                        onClick={() => setShowFactorySwitcher(!showFactorySwitcher)}
                                        className="w-full text-[10px] bg-white border border-indigo-300 rounded px-2 py-1 text-indigo-700 hover:bg-indigo-50 flex items-center justify-between"
                                    >
                                        <span>Switch Factory</span>
                                        <ChevronDown size={12} />
                                    </button>
                                    {showFactorySwitcher && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-indigo-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                                            {factories
                                                .filter(f => f.id !== currentFactory.id)
                                                .map(factory => (
                                                    <button
                                                        key={factory.id}
                                                        onClick={() => {
                                                            switchFactory(factory.id);
                                                            setShowFactorySwitcher(false);
                                                        }}
                                                        className="w-full text-left px-2 py-1.5 text-[10px] hover:bg-indigo-50 first:rounded-t-lg last:rounded-b-lg"
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
                </div>
            </div>
            
            {/* Desktop Header */}
            <div className="hidden lg:block bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 shadow-2xl">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Business Intelligence Dashboard</h1>
                        <p className="text-blue-100">Real-time analytics and performance metrics</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-lg rounded-xl p-4 text-white">
                        <div className="text-sm font-medium opacity-80">Today</div>
                        <div className="text-xl font-bold">{new Date().toLocaleDateString()}</div>
                    </div>
                </div>
            </div>

            {/* Mobile KPI Cards - 2 Column Grid */}
            <div className="lg:hidden grid grid-cols-2 gap-4">
                <MobileStatCard 
                    title="Total Customers"
                    value={dashboardMetrics.totalCustomers.toString()}
                    icon={Users}
                    accentColor="blue"
                    onClick={() => navigate('/setup')}
                />
                <MobileStatCard 
                    title="Total Suppliers"
                    value={dashboardMetrics.totalSuppliers.toString()}
                    icon={ShoppingCart}
                    accentColor="green"
                    onClick={() => navigate('/setup')}
                />
                <MobileStatCard 
                    title="Total Items"
                    value={dashboardMetrics.totalItems.toString()}
                    icon={Package}
                    accentColor="orange"
                    onClick={() => navigate('/setup')}
                />
                <MobileStatCard 
                    title="Unposted Invoices"
                    value={dashboardMetrics.unpostedInvoices.toString()}
                    icon={FileText}
                    accentColor="red"
                    onClick={() => navigate('/posting')}
                />
                <MobileStatCard 
                    title="Raw Material Stock"
                    value={dashboardMetrics.rawMaterialStock >= 1000000 
                        ? `${(dashboardMetrics.rawMaterialStock / 1000000).toFixed(1)}M kg`
                        : dashboardMetrics.rawMaterialStock >= 1000
                        ? `${(dashboardMetrics.rawMaterialStock / 1000).toFixed(1)}k kg`
                        : `${dashboardMetrics.rawMaterialStock.toFixed(1)} kg`}
                    icon={Layers}
                    accentColor="yellow"
                    onClick={() => navigate('/reports')}
                />
                <MobileStatCard 
                    title="Finished Goods Stock"
                    value={dashboardMetrics.finishedGoodsStock >= 1000000 
                        ? `${(dashboardMetrics.finishedGoodsStock / 1000000).toFixed(1)}M kg`
                        : dashboardMetrics.finishedGoodsStock >= 1000
                        ? `${(dashboardMetrics.finishedGoodsStock / 1000).toFixed(1)}k kg`
                        : `${dashboardMetrics.finishedGoodsStock.toFixed(1)} kg`}
                    icon={Container}
                    accentColor="purple"
                    onClick={() => navigate('/reports')}
                />
            </div>

            {/* Quick Actions - Mobile */}
            <div className="lg:hidden space-y-3">
                <h2 className="text-lg font-bold text-slate-800">Quick Actions</h2>
                <div className="grid grid-cols-1 gap-3">
                    <button 
                        onClick={() => navigate('/reports?tab=PROD')}
                        className="flex items-center gap-3 p-4 bg-emerald-600 text-white rounded-xl font-semibold shadow-lg hover:bg-emerald-700 transition-colors"
                    >
                        <Factory size={20} /> + Production Analysis
                    </button>
                    <button 
                        onClick={() => navigate('/reports/item-performance')}
                        className="flex items-center gap-3 p-4 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:bg-blue-700 transition-colors"
                    >
                        <TrendingUp size={20} /> Item Performance
                    </button>
                    <button 
                        onClick={() => navigate('/reports')}
                        className="flex items-center gap-3 p-4 bg-purple-600 text-white rounded-xl font-semibold shadow-lg hover:bg-purple-700 transition-colors opacity-75"
                        disabled
                    >
                        <FileText size={20} /> Sales
                    </button>
                    <button 
                        onClick={() => navigate('/reports/order-fulfillment')}
                        className="flex items-center gap-3 p-4 bg-orange-600 text-white rounded-xl font-semibold shadow-lg hover:bg-orange-700 transition-colors"
                    >
                        <ShoppingCart size={20} /> Orders
                    </button>
                </div>
            </div>

            {/* KPI Cards - 8 Cards in a Single Row */}
            <div className="w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <StatCard 
                    title="Total Liquidity" 
                    value={`$${formatNumber(metrics.totalLiquidity)}`} 
                    subValue="Cash + Bank Accounts" 
                    icon={Wallet} 
                    trend="up"
                    change="+12.5% vs last month"
                    delay={0}
                />
                <StatCard 
                    title="Net Working Capital" 
                    value={`$${formatNumber(metrics.workingCapital)}`} 
                    subValue={`Current Assets ($${formatNumber(metrics.currentAssets || 0)}) - Current Liabilities ($${formatNumber(metrics.currentLiabilities || 0)})`} 
                    icon={TrendingUp} 
                    trend={metrics.workingCapital > 0 ? 'up' : 'down'}
                    change={metrics.workingCapital > 0 ? 'Healthy Position' : 'Needs Attention'}
                    delay={100}
                />
                <StatCard 
                    title="Accounts Receivable" 
                    value={`$${formatNumber(metrics.receivables)}`} 
                    subValue={`From ${state.partners.filter(p => p.type === 'CUSTOMER').length} Customers`}
                    icon={Users} 
                    change="Avg. 30 days"
                    delay={200}
                />
                <StatCard 
                    title="Accounts Payable" 
                    value={`$${formatNumber(metrics.payables)}`} 
                    subValue={`To ${state.partners.filter(p => p.type === 'SUPPLIER').length} Suppliers`}
                    icon={CreditCard} 
                    trend="down"
                    change="Due in 15 days"
                    delay={300}
                />
                <StatCard 
                    title="Total Revenue" 
                    value={`$${formatNumber(metrics.revenue)}`} 
                    subValue="Year to Date" 
                    icon={DollarSign} 
                    trend="up"
                    change="+18.2%"
                    delay={400}
                />
                <StatCard 
                    title="Net Profit" 
                    value={`$${formatNumber(metrics.netProfit)}`} 
                    subValue={`Margin: ${metrics.revenue > 0 ? ((metrics.netProfit / metrics.revenue) * 100).toFixed(1) : 0}%`}
                    icon={Target} 
                    trend={metrics.netProfit > 0 ? 'up' : 'down'}
                    change={metrics.netProfit > 0 ? 'Profitable' : 'Loss'}
                    delay={500}
                />
                <StatCard 
                    title="Inventory Value" 
                    value={`$${formatNumber(metrics.inventory)}`} 
                    subValue={`${state.items.length} Active Items`}
                    icon={Package} 
                    change="Moving Avg Cost"
                    delay={600}
                />
                <StatCard 
                    title="Raw Materials Inventory" 
                    value={`$${formatNumber(metrics.rawMaterialsInventory)}`} 
                    subValue="Inventory - Raw Materials"
                    icon={Layers} 
                    change="From Balance Sheet"
                    delay={700}
                />
                </div>
            </div>

            {/* Production Yield Analysis - FEATURED AT TOP */}
            <div className="bg-gradient-to-br from-white via-amber-50/40 to-orange-50/30 p-8 rounded-3xl border-2 border-amber-200/50 shadow-2xl hover:shadow-3xl transition-all duration-500 animate-in slide-in-from-top-8 fade-in">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-600 rounded-2xl shadow-lg animate-pulse">
                            <Factory className="text-white" size={32} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 via-amber-600 to-orange-600 bg-clip-text text-transparent">
                                Production Yield Analysis
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">Daily production efficiency monitoring</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 items-center">
                        {/* Working Cost Adjustment */}
                        <div className="bg-white/80 backdrop-blur-sm px-4 py-3 rounded-xl shadow-md border border-purple-200">
                            <label className="text-xs font-bold text-purple-700 uppercase mb-1 block">Working Cost</label>
                            <div className="flex items-center gap-3">
                                <select 
                                    value={workingCostPerKg} 
                                    onChange={(e) => setWorkingCostPerKg(parseFloat(e.target.value))}
                                    className="bg-white border border-purple-300 rounded-lg px-3 py-2 text-sm font-mono text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                >
                                    {Array.from({ length: 11 }, (_, i) => {
                                        const value = 0.15 + (i * 0.01); // 0.15 to 0.25 in 0.01 increments
                                        return (
                                            <option key={value} value={value}>
                                                ${value.toFixed(2)}/kg
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                        
                        {/* Time Filter Buttons */}
                        <div className="flex gap-2 bg-white/80 backdrop-blur-sm p-1.5 rounded-xl shadow-md border border-amber-100">
                            {(['today', 'yesterday', '7days', '30days'] as const).map((filter) => (
                                <button
                                    key={filter}
                                    onClick={() => setYieldTimeFilter(filter)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                                        yieldTimeFilter === filter
                                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md scale-105'
                                            : 'text-slate-600 hover:bg-amber-50 hover:text-amber-700'
                                    }`}
                                >
                                    {filter === 'today' ? 'Today' : filter === 'yesterday' ? 'Yesterday' : filter === '7days' ? 'Last 7 Days' : 'Last 30 Days'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                    {/* Key Metrics Cards */}
                    <div className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-amber-100 hover:scale-105 transition-transform">
                        <div className="text-xs font-bold text-amber-600 uppercase mb-2">Raw Material Used</div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{formatNumber(productionYieldData.totalRawMaterialKg)}</div>
                        <div className="text-xs text-slate-500">Kilograms Opened</div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-emerald-100 hover:scale-105 transition-transform">
                        <div className="text-xs font-bold text-emerald-600 uppercase mb-2">Finished Goods</div>
                        <div className="text-3xl font-bold text-slate-900 mb-1">{formatNumber(productionYieldData.totalFinishedGoodsKg)}</div>
                        <div className="text-xs text-slate-500">Kilograms Produced</div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-blue-100 hover:scale-105 transition-transform">
                        <div className="text-xs font-bold text-blue-600 uppercase mb-2">Yield Efficiency</div>
                        <div className="text-3xl font-bold text-blue-600 mb-1">{productionYieldData.yieldPercentage.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">Production Yield</div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-red-100 hover:scale-105 transition-transform">
                        <div className="text-xs font-bold text-red-600 uppercase mb-2">Wastage</div>
                        <div className="text-3xl font-bold text-red-600 mb-1">{productionYieldData.wastagePercentage.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">{productionYieldData.wastageKg.toFixed(0)} Kg Loss</div>
                    </div>

                    <div className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl shadow-lg border border-purple-100 hover:scale-105 transition-transform">
                        <div className="text-xs font-bold text-purple-600 uppercase mb-2">Net Profit/Loss</div>
                        <div className={`text-3xl font-bold mb-1 ${productionYieldData.netProfitLoss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            ${productionYieldData.netProfitLoss.toLocaleString(undefined, {maximumFractionDigits: 0})}
                        </div>
                        <div className="text-xs text-slate-500">Production Value</div>
                    </div>
                </div>

                {/* Production Analysis - Full Width Chart + Compact Original Mix */}
                <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-lg border border-amber-100">
                    <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <TrendingUp size={20} className="text-amber-600" />
                        Top {productionYieldData.topCategories.length} Categories - Production Analysis
                    </h4>
                    
                    {/* Overlapping Bar Chart - Weight and Worth */}
                    <div className="h-[450px] mb-6">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                data={productionYieldData.topCategories} 
                                margin={{ top: 20, right: 30, left: 60, bottom: 100 }}
                                barCategoryGap="20%"
                                barGap={1}
                            >
                                <defs>
                                    <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={1}/>
                                        <stop offset="100%" stopColor="#d97706" stopOpacity={0.9}/>
                                    </linearGradient>
                                    <linearGradient id="worthGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.7}/>
                                        <stop offset="100%" stopColor="#059669" stopOpacity={0.55}/>
                                    </linearGradient>
                                    {/* Add subtle shadow effect */}
                                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feDropShadow dx="0" dy="4" stdDeviation="3" floodOpacity="0.3"/>
                                    </filter>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                                <XAxis 
                                    dataKey="category" 
                                    stroke="#64748b" 
                                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} 
                                    angle={-45} 
                                    textAnchor="end" 
                                    height={120}
                                />
                                <YAxis 
                                    stroke="#64748b" 
                                    tick={{ fill: '#64748b', fontSize: 11 }} 
                                    label={{ 
                                        value: 'Weight (Kg) / Worth ($)', 
                                        angle: -90, 
                                        position: 'insideLeft', 
                                        style: { fill: '#64748b', fontWeight: 'bold', fontSize: 12 } 
                                    }}
                                />
                                <Tooltip 
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-white/98 backdrop-blur-xl border-2 border-amber-300 rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-150">
                                                    <p className="font-bold text-lg text-slate-900 mb-3 pb-2 border-b-2 border-amber-200">{payload[0].payload.category}</p>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between gap-8">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md" />
                                                                <span className="text-sm font-semibold text-slate-600">Weight:</span>
                                                            </div>
                                                            <span className="text-base font-bold text-amber-700">{payload[0].payload.weight.toLocaleString()} Kg</span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-8">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-4 h-4 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md" />
                                                                <span className="text-sm font-semibold text-slate-600">Worth:</span>
                                                            </div>
                                                            <span className="text-base font-bold text-emerald-700">${payload[0].payload.worth.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                                                        </div>
                                                        <div className="pt-2 mt-2 border-t border-slate-200">
                                                            <div className="flex items-center justify-between gap-8">
                                                                <span className="text-xs text-slate-500">Quantity:</span>
                                                                <span className="text-sm font-semibold text-slate-700">{payload[0].payload.qty.toLocaleString()} units</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Legend 
                                    wrapperStyle={{ paddingTop: '20px' }}
                                    iconType="circle"
                                />
                                {/* Weight Bar - Solid Background */}
                                <Bar 
                                    dataKey="weight" 
                                    fill="url(#weightGradient)" 
                                    radius={[10, 10, 0, 0]}
                                    animationDuration={1500}
                                    name="Weight (Kg)"
                                    barSize={40}
                                    filter="url(#shadow)"
                                >
                                    <LabelList 
                                        dataKey="weight" 
                                        position="top" 
                                        formatter={(value: number) => `${formatNumber(value)} Kg`} 
                                        style={{ fontSize: 12, fill: '#78350f', fontWeight: 'bold' }} 
                                        offset={12}
                                    />
                                </Bar>
                                {/* Worth Bar - Translucent Overlay */}
                                <Bar 
                                    dataKey="worth" 
                                    fill="url(#worthGradient)" 
                                    radius={[10, 10, 0, 0]}
                                    animationDuration={1500}
                                    animationBegin={300}
                                    name="Worth ($)"
                                    barSize={40}
                                >
                                    <LabelList 
                                        dataKey="worth" 
                                        position="top" 
                                        formatter={(value: number) => `$${(value/1000).toFixed(1)}K`} 
                                        style={{ fontSize: 12, fill: '#064e3b', fontWeight: 'bold' }} 
                                        offset={2}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    
                    {/* Compact Original Mix Table */}
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 rounded-xl border border-blue-200">
                        <h5 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                            <Package size={16} className="text-blue-600" />
                            Original Recipe Mix (Input Materials)
                        </h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            {productionYieldData.topOriginals.map((orig, idx) => {
                                const originalTypeName = state.originalTypes.find(ot => ot.id === orig.originalType)?.name || orig.originalType;
                                return (
                                    <div key={idx} className="bg-white/80 backdrop-blur-sm p-3 rounded-lg border border-blue-200 hover:shadow-md transition-shadow">
                                        <div className="text-xs font-semibold text-slate-600 truncate" title={originalTypeName}>
                                            {originalTypeName}
                                        </div>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <span className="text-lg font-bold text-blue-900">{orig.weight.toLocaleString()}</span>
                                            <span className="text-xs text-blue-600">Kg</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">Used {orig.count}x</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Waterfall Chart - Cash Flow */}
                <div className="lg:col-span-2 bg-gradient-to-br from-white via-blue-50/30 to-white p-6 rounded-2xl border border-blue-100 shadow-lg hover:shadow-2xl transition-all duration-500 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg shadow-md animate-pulse">
                            <BarChart3 className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-blue-600 bg-clip-text text-transparent">Cash Flow Waterfall</h3>
                            <p className="text-sm text-slate-500">Movement analysis</p>
                        </div>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={1}/>
                                        <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.6}/>
                                    </linearGradient>
                                    <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.secondary} stopOpacity={1}/>
                                        <stop offset="100%" stopColor={CHART_COLORS.secondary} stopOpacity={0.6}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} angle={-15} textAnchor="end" height={80} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={1500} animationBegin={200}>
                                    {waterfallData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Financial Health Radar */}
                <div className="bg-gradient-to-br from-white via-emerald-50/30 to-white p-6 rounded-2xl border border-emerald-100 shadow-lg hover:shadow-2xl transition-all duration-500 animate-in slide-in-from-right-4 fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-lg shadow-md animate-pulse">
                            <Target className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-emerald-600 bg-clip-text text-transparent">Health Score</h3>
                            <p className="text-sm text-slate-500">Business metrics</p>
                        </div>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={healthRadar}>
                                <defs>
                                    <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                                        <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.2}/>
                                    </linearGradient>
                                </defs>
                                <PolarGrid stroke="#e2e8f0" strokeOpacity={0.5} />
                                <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#64748b' }} />
                                <Radar 
                                    name="Score" 
                                    dataKey="value" 
                                    stroke={CHART_COLORS.primary} 
                                    fill="url(#radarGradient)" 
                                    fillOpacity={0.7}
                                    animationDuration={1500}
                                    animationBegin={400}
                                />
                                <Tooltip content={<CustomTooltip />} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Second Row Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Account Hierarchy Treemap */}
                <div className="bg-gradient-to-br from-white via-purple-50/30 to-white p-6 rounded-2xl border border-purple-100 shadow-lg hover:shadow-2xl transition-all duration-500 animate-in slide-in-from-left-4 fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg shadow-md animate-pulse">
                            <Layers className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-purple-600 bg-clip-text text-transparent">Balance Sheet Hierarchy</h3>
                            <p className="text-sm text-slate-500">Asset & liability breakdown</p>
                        </div>
                    </div>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                                data={hierarchyData}
                                dataKey="size"
                                stroke="#fff"
                                strokeWidth={2}
                                fill={CHART_COLORS.primary}
                                content={<CustomTreemapContent />}
                                animationDuration={1500}
                                animationBegin={600}
                            >
                                <Tooltip content={<CustomTooltip />} />
                            </Treemap>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Monthly Trend Line Chart */}
                <div className="bg-gradient-to-br from-white via-indigo-50/30 to-white p-6 rounded-2xl border border-indigo-100 shadow-lg hover:shadow-2xl transition-all duration-500 animate-in slide-in-from-right-4 fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-lg shadow-md animate-pulse">
                            <TrendingUp className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-indigo-600 bg-clip-text text-transparent">Monthly Performance Trend</h3>
                            <p className="text-sm text-slate-500">6-month overview</p>
                        </div>
                    </div>
                    <div className="h-96">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={monthlyTrend} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0.1}/>
                                    </linearGradient>
                                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={CHART_COLORS.danger} stopOpacity={1}/>
                                        <stop offset="100%" stopColor={CHART_COLORS.danger} stopOpacity={0.6}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Area 
                                    type="monotone" 
                                    dataKey="revenue" 
                                    fill="url(#colorRevenue)" 
                                    stroke={CHART_COLORS.secondary}
                                    strokeWidth={2}
                                    animationDuration={1500}
                                    animationBegin={200}
                                />
                                <Bar 
                                    dataKey="expenses" 
                                    fill="url(#colorExpense)" 
                                    radius={[6, 6, 0, 0]}
                                    animationDuration={1500}
                                    animationBegin={400}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="profit" 
                                    stroke={CHART_COLORS.primary} 
                                    strokeWidth={3} 
                                    dot={{ r: 5, fill: CHART_COLORS.primary }}
                                    activeDot={{ r: 8 }}
                                    animationDuration={1500}
                                    animationBegin={600}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Third Row Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Inventory Production Funnel */}
                <div className="bg-gradient-to-br from-white via-amber-50/30 to-white p-6 rounded-2xl border border-amber-100 shadow-lg hover:shadow-2xl transition-all duration-500 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg shadow-md animate-pulse">
                            <Package className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-amber-600 bg-clip-text text-transparent">Production Flow</h3>
                            <p className="text-sm text-slate-500">Inventory stages</p>
                        </div>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart>
                                <Tooltip content={<CustomTooltip />} />
                                <Funnel 
                                    dataKey="value" 
                                    data={inventoryFunnel} 
                                    isAnimationActive
                                    animationDuration={1500}
                                    animationBegin={400}
                                >
                                    <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                                    {inventoryFunnel.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Funnel>
                            </FunnelChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Partner Performance */}
                <div className="bg-gradient-to-br from-white via-rose-50/30 to-white p-6 rounded-2xl border border-rose-100 shadow-lg hover:shadow-2xl transition-all duration-500 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-rose-400 to-rose-600 rounded-lg shadow-md animate-pulse">
                            <Users className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-rose-600 bg-clip-text text-transparent">Top Partners</h3>
                            <p className="text-sm text-slate-500">By outstanding balance</p>
                        </div>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={partnerData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="partnerBarGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.6}/>
                                        <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={1}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis type="number" stroke="#64748b" tick={{ fill: '#64748b' }} />
                                <YAxis dataKey="name" type="category" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 11 }} width={95} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar 
                                    dataKey="balance" 
                                    fill="url(#partnerBarGradient)" 
                                    radius={[0, 6, 6, 0]}
                                    animationDuration={1500}
                                    animationBegin={600}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Account Type Distribution Pie */}
                <div className="bg-gradient-to-br from-white via-cyan-50/30 to-white p-6 rounded-2xl border border-cyan-100 shadow-lg hover:shadow-2xl transition-all duration-500 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-lg shadow-md animate-pulse">
                            <PieChartIcon className="text-white" size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-cyan-600 bg-clip-text text-transparent">Account Distribution</h3>
                            <p className="text-sm text-slate-500">By type</p>
                        </div>
                    </div>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={accountDistribution}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={<AnimatedPieLabel />}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                    animationDuration={1500}
                                    animationBegin={800}
                                >
                                    {accountDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-6 rounded-2xl shadow-lg text-white hover:shadow-2xl hover:scale-105 transition-all duration-500 animate-in fade-in zoom-in">
                    <div className="flex items-center gap-3 mb-4">
                        <Factory size={32} className="animate-pulse" />
                        <h4 className="text-lg font-bold">Total Assets</h4>
                    </div>
                    <div className="text-4xl font-bold mb-2">${formatNumber(metrics.assets)}</div>
                    <div className="text-blue-100 text-sm">Balance Sheet Strength</div>
                </div>
                
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 rounded-2xl shadow-lg text-white hover:shadow-2xl hover:scale-105 transition-all duration-500 animate-in fade-in zoom-in">
                    <div className="flex items-center gap-3 mb-4">
                        <ShoppingCart size={32} className="animate-pulse" />
                        <h4 className="text-lg font-bold">Active Items</h4>
                    </div>
                    <div className="text-4xl font-bold mb-2">{state.items.length}</div>
                    <div className="text-emerald-100 text-sm">Inventory SKUs</div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-6 rounded-2xl shadow-lg text-white hover:shadow-2xl hover:scale-105 transition-all duration-500 animate-in fade-in zoom-in">
                    <div className="flex items-center gap-3 mb-4">
                        <Users size={32} className="animate-pulse" />
                        <h4 className="text-lg font-bold">Business Partners</h4>
                    </div>
                    <div className="text-4xl font-bold mb-2">{state.partners.length}</div>
                    <div className="text-purple-100 text-sm">Customers & Suppliers</div>
                </div>
            </div>
        </div>
    );
};

// Custom Treemap Content Renderer
const CustomTreemapContent = (props: any) => {
    const { x, y, width, height, name, size, fill } = props;
    
    // Create gradient fills based on the base color
    const gradientId = `gradient-${name?.replace(/\s/g, '-')}`;
    const baseColor = fill || CHART_COLORS.primary;
    
    return (
        <g>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={baseColor} stopOpacity={1} />
                    <stop offset="100%" stopColor={baseColor} stopOpacity={0.7} />
                </linearGradient>
            </defs>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: `url(#${gradientId})`,
                    stroke: '#fff',
                    strokeWidth: 2,
                    opacity: 0.9
                }}
            />
            {width > 60 && height > 40 && (
                <>
                    <text
                        x={x + width / 2}
                        y={y + height / 2 - 7}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={12}
                        fontWeight="bold"
                    >
                        {name}
                    </text>
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + 10}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={11}
                    >
                        ${size ? formatNumber(size) : '0'}
                    </text>
                </>
            )}
        </g>
    );
};

// Custom Pie Chart Label Renderer
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill="white"
            textAnchor={x > cx ? 'start' : 'end'}
            dominantBaseline="central"
            fontSize={11}
            fontWeight="bold"
        >
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};
