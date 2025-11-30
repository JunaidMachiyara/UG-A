
import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Package, Users, DollarSign, Activity, Factory } from 'lucide-react';
import { CHART_COLORS } from '../constants';

const StatCard = ({ title, value, subValue, icon: Icon, trend }: { title: string, value: string, subValue: string, icon: any, trend?: 'up' | 'down' }) => (
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${trend === 'down' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                <Icon size={20} />
            </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
            {trend === 'up' && <ArrowUpRight size={16} className="text-emerald-500" />}
            {trend === 'down' && <ArrowDownRight size={16} className="text-red-500" />}
            <span className="text-xs text-slate-500">{subValue}</span>
        </div>
    </div>
);

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

        return { yieldPct, profit, inputCost, outputValue };
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

    // Calculated Metrics
    const cash = state.accounts.find(a => a.name.includes('Cash'))?.balance || 0;
    const bank = state.accounts.find(a => a.name.includes('Bank'))?.balance || 0;
    const receivables = state.accounts.find(a => a.name.includes('Receivable'))?.balance || 0;
    const stockRaw = state.items.filter(i => i.category === 'Raw Material').reduce((acc, i) => acc + (i.stockQty * i.avgCost * i.weightPerUnit), 0); // Approx value logic
    
    // Mock Data for Charts (derived from ledger/items)
    const salesData = [
        { name: 'Mon', revenue: 4000, cost: 2400 },
        { name: 'Tue', revenue: 3000, cost: 1398 },
        { name: 'Wed', revenue: 2000, cost: 9800 },
        { name: 'Thu', revenue: 2780, cost: 3908 },
        { name: 'Fri', revenue: 1890, cost: 4800 },
        { name: 'Sat', revenue: 2390, cost: 3800 },
        { name: 'Sun', revenue: 3490, cost: 4300 },
    ];

    const stockDistribution = [
        { name: 'Raw Materials', value: state.items.filter(i => i.category === 'Raw Material').length },
        { name: 'Finished Goods', value: state.items.filter(i => i.category !== 'Raw Material').length },
    ];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Total Liquidity" 
                    value={`$${(cash + bank).toLocaleString()}`} 
                    subValue="Cash + Bank" 
                    icon={DollarSign} 
                    trend="up" 
                />
                <StatCard 
                    title="Receivables" 
                    value={`$${receivables.toLocaleString()}`} 
                    subValue="Outstanding Invoices" 
                    icon={Users} 
                />
                <StatCard 
                    title="Raw Material Value" 
                    value={`$${stockRaw.toLocaleString()}`} 
                    subValue="Estimated Moving Avg" 
                    icon={Package} 
                    trend="up" 
                />
                <YieldWidget />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Revenue Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Financial Performance</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b'}} />
                                <YAxis stroke="#64748b" tick={{fill: '#64748b'}} />
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#1e293b' }} />
                                <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.primary} fillOpacity={1} fill="url(#colorRev)" />
                                <Area type="monotone" dataKey="cost" stroke={CHART_COLORS.secondary} fillOpacity={1} fill="url(#colorCost)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Stock Distribution */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-800 mb-6">Inventory Categories</h3>
                    <div className="h-64">
                         <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stockDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {stockDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? CHART_COLORS.primary : CHART_COLORS.accent} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b' }} />
                                <Legend wrapperStyle={{ color: '#475569' }}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-3">
                        {state.items.slice(0, 3).map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                                <span className="text-slate-600">{item.name}</span>
                                <span className="font-mono text-slate-800 font-medium">{item.stockQty} {item.packingType}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
