
import React, { useMemo, useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ComposedChart, Treemap, Funnel, FunnelChart, LabelList } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Package, Users, DollarSign, Activity, Factory, TrendingUp, TrendingDown, Wallet, ShoppingCart, CreditCard, AlertCircle, Target, BarChart3, PieChart as PieChartIcon, Layers } from 'lucide-react';
import { CHART_COLORS } from '../constants';
import { AccountType } from '../types';

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
                                ? `$${entry.value.toLocaleString()}` 
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

    // Enhanced Financial Metrics
    const metrics = useMemo(() => {
        const cash = state.accounts.find(a => a.code === '1001')?.balance || 0;
        const bank = state.accounts.find(a => a.code === '1010')?.balance || 0;
        const receivables = state.accounts.find(a => a.code === '1100')?.balance || 0;
        const payables = state.accounts.find(a => a.code === '2000')?.balance || 0;
        
        const assets = state.accounts.filter(a => a.type === AccountType.ASSET).reduce((sum, a) => sum + a.balance, 0);
        const liabilities = state.accounts.filter(a => a.type === AccountType.LIABILITY).reduce((sum, a) => sum + a.balance, 0);
        const equity = state.accounts.filter(a => a.type === AccountType.EQUITY).reduce((sum, a) => sum + a.balance, 0);
        const revenue = state.accounts.filter(a => a.type === AccountType.REVENUE).reduce((sum, a) => sum + Math.abs(a.balance), 0);
        const expenses = state.accounts.filter(a => a.type === AccountType.EXPENSE).reduce((sum, a) => sum + a.balance, 0);
        
        const inventory = state.accounts.filter(a => a.code?.startsWith('12')).reduce((sum, a) => sum + a.balance, 0);
        const netProfit = revenue - expenses;
        const workingCapital = (cash + bank + receivables + inventory) - payables;
        
        return {
            cash, bank, receivables, payables, assets, liabilities, equity,
            revenue, expenses, inventory, netProfit, workingCapital,
            totalLiquidity: cash + bank,
            currentRatio: payables > 0 ? ((cash + bank + receivables) / payables) : 0
        };
    }, [state.accounts]);

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

    return (
        <div className="space-y-6 pb-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 shadow-2xl">
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

            {/* KPI Cards Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Liquidity" 
                    value={`$${metrics.totalLiquidity.toLocaleString()}`} 
                    subValue="Cash + Bank Accounts" 
                    icon={Wallet} 
                    trend="up"
                    change="+12.5% vs last month"
                    delay={0}
                />
                <StatCard 
                    title="Net Working Capital" 
                    value={`$${metrics.workingCapital.toLocaleString()}`} 
                    subValue="Current Assets - Liabilities" 
                    icon={TrendingUp} 
                    trend={metrics.workingCapital > 0 ? 'up' : 'down'}
                    change={metrics.workingCapital > 0 ? 'Healthy Position' : 'Needs Attention'}
                    delay={100}
                />
                <StatCard 
                    title="Accounts Receivable" 
                    value={`$${metrics.receivables.toLocaleString()}`} 
                    subValue={`From ${state.partners.filter(p => p.type === 'CUSTOMER').length} Customers`}
                    icon={Users} 
                    change="Avg. 30 days"
                    delay={200}
                />
                <StatCard 
                    title="Accounts Payable" 
                    value={`$${metrics.payables.toLocaleString()}`} 
                    subValue={`To ${state.partners.filter(p => p.type === 'SUPPLIER').length} Suppliers`}
                    icon={CreditCard} 
                    trend="down"
                    change="Due in 15 days"
                    delay={300}
                />
            </div>

            {/* KPI Cards Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Revenue" 
                    value={`$${metrics.revenue.toLocaleString()}`} 
                    subValue="Year to Date" 
                    icon={DollarSign} 
                    trend="up"
                    change="+18.2%"
                    delay={400}
                />
                <StatCard 
                    title="Net Profit" 
                    value={`$${metrics.netProfit.toLocaleString()}`} 
                    subValue={`Margin: ${metrics.revenue > 0 ? ((metrics.netProfit / metrics.revenue) * 100).toFixed(1) : 0}%`}
                    icon={Target} 
                    trend={metrics.netProfit > 0 ? 'up' : 'down'}
                    change={metrics.netProfit > 0 ? 'Profitable' : 'Loss'}
                    delay={500}
                />
                <StatCard 
                    title="Inventory Value" 
                    value={`$${metrics.inventory.toLocaleString()}`} 
                    subValue={`${state.items.length} Active Items`}
                    icon={Package} 
                    change="Moving Avg Cost"
                    delay={600}
                />
                <StatCard 
                    title="Current Ratio" 
                    value={metrics.currentRatio.toFixed(2)} 
                    subValue="Liquidity Health Indicator" 
                    icon={Activity} 
                    trend={metrics.currentRatio >= 1.5 ? 'up' : 'down'}
                    change={metrics.currentRatio >= 1.5 ? 'Excellent' : 'Fair'}
                    delay={700}
                />
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
                    <div className="text-4xl font-bold mb-2">${metrics.assets.toLocaleString()}</div>
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
                        ${size?.toLocaleString()}
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
