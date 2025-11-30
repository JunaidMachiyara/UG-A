
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Trash2, Edit2, Search, ChevronDown, ChevronUp, Upload, FileSpreadsheet, Users, Building, Package, CreditCard, Briefcase, Calendar, Box, Layers, Tag, Grid, X } from 'lucide-react';
import { PartnerType, AccountType, PackingType } from '../types';
import { EXCHANGE_RATES } from '../constants';
import { EntitySelector } from './EntitySelector';

// --- Types for Generic CRUD ---

export interface SelectOption {
    label: string;
    value: string | number;
}

export interface FieldDef {
    name: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'date';
    // Options can be simple strings or {label, value} objects. Function receives all data AND current form data for filtering.
    options?: (string | SelectOption)[] | ((data: any[], formData: any) => (string | SelectOption)[]); 
    required?: boolean;
    defaultValue?: any | ((data: any[]) => any); 
    placeholder?: string;
    readOnly?: boolean; 
    compute?: (formData: any, allData: any[]) => any; 
    hidden?: (formData: any) => boolean;
}

export interface ColumnDef {
    header: string;
    key: string;
    render?: (row: any) => React.ReactNode;
}

export interface CrudConfig {
    title: string;
    entityKey: string;
    columns: ColumnDef[];
    fields: FieldDef[];
    onSave: (data: any) => void;
    onDelete: (id: string) => void;
}

// --- Generic Form Component (Exported for Reuse) ---

export const GenericForm: React.FC<{ 
    config: CrudConfig; 
    data: any[]; 
    onCancel: () => void; 
    onSuccess: () => void;
    initialOverrides?: any; // NEW: Allow pre-filling fields
}> = ({ config, data, onCancel, onSuccess, initialOverrides }) => {
    const [formData, setFormData] = useState<any>(() => {
        // Calculate default values dynamically on mount
        const initialData: any = {};
        config.fields.forEach(field => {
            if (field.defaultValue !== undefined) {
                if (typeof field.defaultValue === 'function') {
                    initialData[field.name] = field.defaultValue(data);
                } else {
                    initialData[field.name] = field.defaultValue;
                }
            }
        });
        // Apply overrides
        if (initialOverrides) {
            Object.assign(initialData, initialOverrides);
        }
        return initialData;
    });

    const handleChange = (fieldName: string, value: any) => {
        let updatedData = { ...formData, [fieldName]: value };

        // Process computed fields
        config.fields.forEach(field => {
            if (field.compute) {
                updatedData[field.name] = field.compute(updatedData, data);
            }
        });

        setFormData(updatedData);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        // Basic validation for visible fields only
        for (const field of config.fields) {
            const isHidden = field.hidden ? field.hidden(formData) : false;
            if (!isHidden && field.required && !formData[field.name]) {
                alert(`${field.label} is required`);
                return;
            }
        }
        config.onSave({ ...formData, id: Math.random().toString(36).substr(2, 9) }); // Simple ID gen
        onSuccess();
    };

    return (
        <form onSubmit={handleSave} className="space-y-4">
            {config.fields.map((field) => {
                const isHidden = field.hidden ? field.hidden(formData) : false;
                if (isHidden) return null;

                const resolvedOptions = typeof field.options === 'function' 
                    ? field.options(data, formData) 
                    : field.options;
                
                // Map options to {id, name} for EntitySelector
                const entityOptions = resolvedOptions?.map(opt => 
                    typeof opt === 'string' 
                        ? { id: opt, name: opt } 
                        : { id: String(opt.value), name: opt.label }
                );

                return (
                    <div key={field.name}>
                        <label className="block text-sm font-medium text-slate-600 mb-1">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.type === 'select' && entityOptions ? (
                            <EntitySelector 
                                entities={entityOptions}
                                selectedId={String(formData[field.name] || '')}
                                onSelect={(id) => handleChange(field.name, id)}
                                placeholder={`Select ${field.label}...`}
                                disabled={field.readOnly}
                            />
                        ) : (
                            <input
                                type={field.type}
                                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-500 border-slate-300"
                                value={formData[field.name] || ''}
                                onChange={e => handleChange(field.name, field.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                                placeholder={field.placeholder}
                                required={field.required}
                                disabled={field.readOnly}
                            />
                        )}
                    </div>
                );
            })}
            <div className="flex gap-3 pt-4">
                <button 
                    type="button" 
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 bg-white"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                    Save Record
                </button>
            </div>
        </form>
    );
};

// --- Quick Add Modal (Exported for Reuse) ---
export const QuickAddModal: React.FC<{
    config: CrudConfig | null;
    initialOverrides?: any;
    isOpen: boolean;
    onClose: () => void;
    data: any[];
}> = ({ config, initialOverrides, isOpen, onClose, data }) => {
    if (!isOpen || !config) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800">Add New {config.title}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                </div>
                <div className="p-6">
                    <GenericForm 
                        config={config} 
                        data={data} 
                        onCancel={onClose} 
                        onSuccess={onClose} 
                        initialOverrides={initialOverrides}
                    />
                </div>
            </div>
        </div>
    );
};

// --- Generic CRUD Component ---

const CrudManager: React.FC<{ config: CrudConfig; data: any[] }> = ({ config, data }) => {
    const [isOpen, setIsOpen] = useState(false); // Collapsible card
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = data.filter(item => 
        Object.values(item).some(val => 
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
            <div 
                className="p-4 bg-slate-50 flex justify-between items-center cursor-pointer select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                    {config.title} <span className="text-xs font-normal text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">{data.length}</span>
                </h3>
                {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </div>
            
            {isOpen && (
                <div className="p-4">
                    <div className="flex justify-between items-center mb-4 gap-4">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Plus size={16} /> Add New
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase font-semibold text-xs border-y border-slate-200">
                                <tr>
                                    {config.columns.map((col, idx) => (
                                        <th key={idx} className="px-4 py-3">{col.header}</th>
                                    ))}
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.length === 0 ? (
                                    <tr><td colSpan={config.columns.length + 1} className="p-4 text-center text-slate-500">No records found.</td></tr>
                                ) : (
                                    filteredData.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50 group">
                                            {config.columns.map((col, idx) => (
                                                <td key={idx} className="px-4 py-3">
                                                    {col.render ? col.render(row) : row[col.key]}
                                                </td>
                                            ))}
                                            <td className="px-4 py-3 text-right">
                                                <button 
                                                    onClick={() => config.onDelete(row.id)}
                                                    className="text-slate-400 hover:text-red-500 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            <QuickAddModal 
                config={config}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={data}
            />
        </div>
    );
};

// --- Sub-Modules ---

const HRModule: React.FC = () => {
    const { state, addEmployee, deleteEntity } = useData();
    const [activeTab, setActiveTab] = useState<'employees' | 'attendance'>('employees');

    const empConfig: CrudConfig = {
        title: 'Employee Register',
        entityKey: 'employees',
        columns: [
            { header: 'Name', key: 'name', render: (r) => <div className="font-medium text-slate-800">{r.name}</div> },
            { header: 'Passport', key: 'passportNumber' },
            { header: 'Role', key: 'role', render: (r) => r.role || '-' },
            { header: 'Visa Expiry', key: 'visaRenewalDate', render: (r) => r.visaRenewalDate || '-' },
            { header: 'Status', key: 'status', render: (r) => <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status || 'Active'}</span> },
        ],
        fields: [
            { name: 'name', label: 'Full Name', type: 'text', required: true },
            { name: 'passportNumber', label: 'Passport Number', type: 'text', required: true },
            { name: 'role', label: 'Designation', type: 'text', required: false },
            { name: 'basicSalary', label: 'Basic Salary (USD)', type: 'number', required: false },
            { name: 'status', label: 'Status', type: 'select', options: ['Active', 'On Leave', 'Terminated'], required: false },
            { name: 'joinDate', label: 'Join Date', type: 'date', required: false },
            { name: 'passportExpiry', label: 'Passport Expiry', type: 'date', required: false },
            { name: 'visaDate', label: 'Visa Issue Date', type: 'date', required: false },
            { 
                name: 'visaRenewalDate', 
                label: 'Visa Renewal (Auto +2 Yrs)', 
                type: 'date', 
                required: false,
                readOnly: true,
                compute: (formData) => {
                    if (formData.visaDate) {
                        try {
                            const date = new Date(formData.visaDate);
                            date.setFullYear(date.getFullYear() + 2);
                            return date.toISOString().split('T')[0];
                        } catch (e) {
                            return '';
                        }
                    }
                    return '';
                }
            },
            { name: 'reference', label: 'Reference', type: 'text', required: false },
        ],
        onSave: (data) => addEmployee(data),
        onDelete: (id) => deleteEntity('employees', id)
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <Users className="text-blue-600" />
                <h2 className="text-lg font-bold text-slate-800">HR Management</h2>
                <div className="flex gap-2 ml-auto">
                    <button onClick={() => setActiveTab('employees')} className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'employees' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>Employees</button>
                    <button onClick={() => setActiveTab('attendance')} className={`px-3 py-1 text-sm rounded-md transition-colors ${activeTab === 'attendance' ? 'bg-blue-100 text-blue-700 font-medium' : 'text-slate-500 hover:bg-slate-50'}`}>Attendance</button>
                </div>
            </div>

            {activeTab === 'employees' ? (
                <CrudManager config={empConfig} data={state.employees} />
            ) : (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-lg">
                    <Calendar className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-slate-500">Attendance Grid Mockup</p>
                    <div className="mt-4 grid grid-cols-7 gap-2 max-w-lg mx-auto opacity-50">
                        {Array.from({length: 14}).map((_, i) => (
                            <div key={i} className="h-10 border border-slate-200 bg-slate-50 rounded flex items-center justify-center text-xs">Day {i+1}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const DataImporter: React.FC = () => {
    return (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 mb-6 text-white shadow-lg">
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-lg">
                    <FileSpreadsheet size={24} className="text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">Bulk Data Import</h3>
                    <p className="text-blue-100 text-sm opacity-90">Upload CSV files to import Items, Partners, or Opening Stocks.</p>
                </div>
                <button className="ml-auto bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition-colors">
                    <Upload size={16} /> Upload CSV
                </button>
            </div>
        </div>
    );
};

// --- Hook for Configurations (Exported for Reuse) ---
export const useSetupConfigs = () => {
    const { 
        state, 
        addPartner, 
        addItem, 
        addAccount, 
        deleteEntity, 
        addDivision,
        addSubDivision,
        addLogo,
        addWarehouse,
        addOriginalType,
        addOriginalProduct,
        addCategory,
        addSection
    } = useData();

    const partnerConfig: CrudConfig = {
        title: 'Business Partners',
        entityKey: 'partners',
        columns: [
            { header: 'Name', key: 'name' },
            { header: 'Type', key: 'type', render: (r) => <span className="text-xs font-mono bg-slate-100 px-1 rounded">{r.type}</span> },
            { header: 'Division', key: 'divisionId', render: (r) => state.divisions.find(d => d.id === r.divisionId)?.name || '-' },
            { header: 'Currency', key: 'defaultCurrency', render: (r) => <span className="font-mono text-xs">{r.defaultCurrency || 'USD'}</span> },
            { header: 'Balance', key: 'balance', render: (r) => <span className={r.balance < 0 ? 'text-red-500' : 'text-emerald-600'}>{r.balance}</span> }
        ],
        fields: [
            { name: 'type', label: 'Partner Type', type: 'select', options: Object.values(PartnerType), required: true },
            { name: 'name', label: 'Company Name', type: 'text', required: true },
            { 
                name: 'divisionId', 
                label: 'Division', 
                type: 'select', 
                options: () => state.divisions.map(d => ({ label: d.name, value: d.id })),
                required: false 
            },
            { 
                name: 'subDivisionId', 
                label: 'Sub-Division', 
                type: 'select', 
                options: (_, formData) => state.subDivisions
                    .filter(sd => sd.divisionId === formData.divisionId)
                    .map(sd => ({ label: sd.name, value: sd.id })),
                required: false,
                hidden: (data) => !data.divisionId
            },
            { name: 'defaultCurrency', label: 'Default Currency', type: 'select', options: Object.keys(EXCHANGE_RATES), required: true, defaultValue: 'USD' },
            { name: 'contact', label: 'Contact Person', type: 'text' },
            { name: 'phone', label: 'Phone', type: 'text' },
            { name: 'email', label: 'Email', type: 'text' },
            { name: 'country', label: 'Country', type: 'text' },
            { 
                name: 'creditLimit', 
                label: 'Credit Limit (USD)', 
                type: 'number', 
                hidden: (data) => data.type !== PartnerType.CUSTOMER
            },
            { 
                name: 'taxId', 
                label: 'Tax ID / TRN', 
                type: 'text', 
                hidden: (data) => ![PartnerType.SUPPLIER, PartnerType.VENDOR].includes(data.type)
            },
            { 
                name: 'parentSupplier', 
                label: 'Parent Supplier', 
                type: 'select', 
                options: (allData: any[]) => allData.filter(p => p.type === PartnerType.SUPPLIER).map(p => p.name),
                hidden: (data) => data.type !== PartnerType.SUB_SUPPLIER
            },
            { 
                name: 'commissionRate', 
                label: 'Commission Rate (%)', 
                type: 'number', 
                hidden: (data) => data.type !== PartnerType.COMMISSION_AGENT
            },
             { 
                name: 'licenseNumber', 
                label: 'License Number', 
                type: 'text', 
                hidden: (data) => data.type !== PartnerType.CLEARING_AGENT
            },
             { 
                name: 'scacCode', 
                label: 'SCAC Code', 
                type: 'text', 
                hidden: (data) => data.type !== PartnerType.FREIGHT_FORWARDER
            },
            { name: 'balance', label: 'Opening Balance (USD)', type: 'number', placeholder: 'Positive for Receivable, Negative for Payable' }
        ],
        onSave: (data) => addPartner(data),
        onDelete: (id) => deleteEntity('partners', id)
    };

    const divisionConfig: CrudConfig = {
        title: 'Divisions (Business Units)',
        entityKey: 'divisions',
        columns: [
            { header: 'Name', key: 'name' },
            { header: 'Location/HQ', key: 'location' }
        ],
        fields: [
            { name: 'name', label: 'Division Name', type: 'text', required: true },
            { name: 'location', label: 'Location/HQ', type: 'text', required: false }
        ],
        onSave: (data) => addDivision(data),
        onDelete: (id) => deleteEntity('divisions', id)
    };

    const subDivisionConfig: CrudConfig = {
        title: 'Sub-Divisions',
        entityKey: 'subDivisions',
        columns: [
            { header: 'Name', key: 'name' },
            { header: 'Parent Division', key: 'divisionId', render: (r) => state.divisions.find(d => d.id === r.divisionId)?.name || r.divisionId }
        ],
        fields: [
            { name: 'name', label: 'Sub-Division Name', type: 'text', required: true },
            { 
                name: 'divisionId', 
                label: 'Parent Division', 
                type: 'select', 
                options: () => state.divisions.map(d => ({ label: d.name, value: d.id })),
                required: true 
            }
        ],
        onSave: (data) => addSubDivision(data),
        onDelete: (id) => deleteEntity('subDivisions', id)
    };

    const logoConfig: CrudConfig = {
        title: 'Brand Logos',
        entityKey: 'logos',
        columns: [ { header: 'Brand Name', key: 'name' } ],
        fields: [ { name: 'name', label: 'Brand Name', type: 'text', required: true } ],
        onSave: (data) => addLogo(data),
        onDelete: (id) => deleteEntity('logos', id)
    };

    const itemConfig: CrudConfig = {
        title: 'Inventory Items (Finished Goods)',
        entityKey: 'items',
        columns: [
            { header: 'Code', key: 'code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Category', key: 'category' },
            { header: 'Packing', key: 'packingType' },
            { header: 'Weight', key: 'weightPerUnit', render: (r) => `${r.weightPerUnit} kg` },
            { header: 'Stock', key: 'stockQty' }
        ],
        fields: [
            { 
                name: 'code', 
                label: 'Item Code', 
                type: 'text', 
                required: true, 
                defaultValue: (data: any[]) => `ITEM-${1001 + data.length}` 
            },
            { name: 'name', label: 'Item Name', type: 'text', required: true },
            { 
                name: 'category', 
                label: 'Category', 
                type: 'select', 
                options: () => state.categories.map(c => c.name), 
                required: true 
            },
            { 
                name: 'section', 
                label: 'Section (Optional)', 
                type: 'select', 
                options: () => state.sections.map(s => s.name), 
                required: false 
            },
            { name: 'packingType', label: 'Packing Type', type: 'select', options: Object.values(PackingType), required: true },
            { name: 'weightPerUnit', label: 'Package Size (Kg)', type: 'number', required: true },
            { name: 'avgCost', label: 'Avg Production Price', type: 'number', required: true },
            { name: 'salePrice', label: 'Avg Sale Price', type: 'number' },
            { name: 'stockQty', label: 'Opening Stock Qty', type: 'number', placeholder: 'For Opening Balance Only' }
        ],
        onSave: (data) => addItem(data, data.stockQty),
        onDelete: (id) => deleteEntity('items', id)
    };

    const accountConfig: CrudConfig = {
        title: 'Chart of Accounts',
        entityKey: 'accounts',
        columns: [
            { header: 'Code', key: 'code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Type', key: 'type' },
            { header: 'Balance', key: 'balance' }
        ],
        fields: [
            { name: 'type', label: 'Type', type: 'select', options: Object.values(AccountType), required: true },
            { 
                name: 'code', 
                label: 'GL Code (Auto)', 
                type: 'text', 
                required: true, 
                readOnly: true,
                placeholder: 'Select Type first',
                compute: (formData, allData) => {
                    if (!formData.type) return '';
                    let prefix = '1';
                    switch(formData.type) {
                        case AccountType.ASSET: prefix = '1'; break;
                        case AccountType.LIABILITY: prefix = '2'; break;
                        case AccountType.EQUITY: prefix = '3'; break;
                        case AccountType.REVENUE: prefix = '4'; break;
                        case AccountType.EXPENSE: prefix = '5'; break;
                    }
                    const existingCodes = allData
                        .filter(a => a.code.startsWith(prefix))
                        .map(a => parseInt(a.code))
                        .filter(n => !isNaN(n))
                        .sort((a, b) => b - a);
                    const nextCode = existingCodes.length > 0 ? existingCodes[0] + 1 : parseInt(prefix + '001');
                    return nextCode.toString();
                }
            },
            { name: 'name', label: 'Account Name', type: 'text', required: true },
            { name: 'balance', label: 'Opening Balance', type: 'number' }
        ],
        onSave: (data) => addAccount(data),
        onDelete: (id) => deleteEntity('accounts', id)
    };

     const warehouseConfig: CrudConfig = {
        title: 'Warehouses',
        entityKey: 'warehouses',
        columns: [
            { header: 'Name', key: 'name' },
            { header: 'Location', key: 'location' }
        ],
        fields: [
            { name: 'name', label: 'Warehouse Name', type: 'text', required: true },
            { name: 'location', label: 'Location/Address', type: 'text', required: false },
        ],
        onSave: (data) => addWarehouse(data),
        onDelete: (id) => deleteEntity('warehouses', id)
    };

    const categoryConfig: CrudConfig = {
        title: 'Product Categories',
        entityKey: 'categories',
        columns: [{ header: 'Name', key: 'name' }],
        fields: [{ name: 'name', label: 'Category Name', type: 'text', required: true }],
        onSave: (data) => addCategory(data),
        onDelete: (id) => deleteEntity('categories', id)
    };

    const sectionConfig: CrudConfig = {
        title: 'Factory Sections',
        entityKey: 'sections',
        columns: [{ header: 'Name', key: 'name' }],
        fields: [{ name: 'name', label: 'Section Name', type: 'text', required: true }],
        onSave: (data) => addSection(data),
        onDelete: (id) => deleteEntity('sections', id)
    };

    const originalTypeConfig: CrudConfig = {
        title: 'Original Types',
        entityKey: 'originalTypes',
        columns: [
            { header: 'Name', key: 'name' },
            { header: 'Packing', key: 'packingType' },
            { header: 'Size (Kg)', key: 'packingSize' }
        ],
        fields: [
            { name: 'name', label: 'Type Name (e.g. KSA Mix)', type: 'text', required: true },
            { name: 'packingType', label: 'Packing', type: 'select', options: Object.values(PackingType), required: true },
            { name: 'packingSize', label: 'Standard Weight (Kg)', type: 'number', required: true }
        ],
        onSave: (data) => addOriginalType(data),
        onDelete: (id) => deleteEntity('originalTypes', id)
    };

    const originalProductConfig: CrudConfig = {
        title: 'Original Products',
        entityKey: 'originalProducts',
        columns: [
            { header: 'Name', key: 'name' },
            { header: 'Parent Type', key: 'originalTypeId', render: (r) => state.originalTypes.find(ot => ot.id === r.originalTypeId)?.name || r.originalTypeId }
        ],
        fields: [
            { 
                name: 'originalTypeId', 
                label: 'Original Type', 
                type: 'select', 
                options: () => state.originalTypes.map(ot => ({ label: ot.name, value: ot.id })),
                required: true 
            },
            { name: 'name', label: 'Product Name', type: 'text', required: true }
        ],
        onSave: (data) => addOriginalProduct(data),
        onDelete: (id) => deleteEntity('originalProducts', id)
    };

    return {
        partnerConfig,
        divisionConfig,
        subDivisionConfig,
        logoConfig,
        itemConfig,
        accountConfig,
        warehouseConfig,
        categoryConfig,
        sectionConfig,
        originalTypeConfig,
        originalProductConfig
    };
};

// --- Main Setup Component ---

export const SetupModule: React.FC = () => {
    const { state } = useData();
    const configs = useSetupConfigs();

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <DataImporter />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Users className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Partners & Structure</h2>
                    </div>
                    <CrudManager config={configs.divisionConfig} data={state.divisions} />
                    <CrudManager config={configs.subDivisionConfig} data={state.subDivisions} />
                    <CrudManager config={configs.logoConfig} data={state.logos} />
                    <CrudManager config={configs.partnerConfig} data={state.partners} />
                    <HRModule />
                    
                    <div className="flex items-center gap-2 mb-2 mt-8">
                        <Box className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Raw Material Classifications</h2>
                    </div>
                    <CrudManager config={configs.originalTypeConfig} data={state.originalTypes} />
                    <CrudManager config={configs.originalProductConfig} data={state.originalProducts} />
                </div>

                <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Package className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Finished Goods & Operations</h2>
                    </div>
                    <CrudManager config={configs.categoryConfig} data={state.categories} />
                    <CrudManager config={configs.sectionConfig} data={state.sections} />
                    <CrudManager config={configs.itemConfig} data={state.items} />
                    <CrudManager config={configs.warehouseConfig} data={state.warehouses} />
                    
                    <div className="flex items-center gap-2 mb-2 mt-8">
                        <CreditCard className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Financials</h2>
                    </div>
                    <CrudManager config={configs.accountConfig} data={state.accounts} />
                </div>
            </div>
        </div>
    );
};
