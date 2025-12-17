
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { useData } from '../context/DataContext';
import { Plus, Trash2, Edit2, Search, ChevronDown, ChevronUp, Users, Building, Package, CreditCard, Briefcase, Calendar, Box, Layers, Tag, Grid, X, Download } from 'lucide-react';
import { PartnerType, AccountType, PackingType } from '../types';
import { EXCHANGE_RATES, INITIAL_ACCOUNTS } from '../constants';
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
    validate?: (value: any, formData: any, allData: any[]) => string | null; // Returns error message or null
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
    onUpdate?: (id: string, data: any) => void;
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
            // Backward compatibility: If editing and code field is missing but id exists, use id as code
            if (initialOverrides.id && !initialOverrides.code && config.fields.find(f => f.name === 'code')) {
                initialData.code = initialOverrides.id;
            }
        }
        return initialData;
    });

    // Update form data when initialOverrides changes (for editing)
    useEffect(() => {
        if (initialOverrides) {
            const updatedData: any = {};
            config.fields.forEach(field => {
                if (field.defaultValue !== undefined) {
                    if (typeof field.defaultValue === 'function') {
                        updatedData[field.name] = field.defaultValue(data);
                    } else {
                        updatedData[field.name] = field.defaultValue;
                    }
                }
            });
            Object.assign(updatedData, initialOverrides);
            // Backward compatibility: If editing and code field is missing but id exists, use id as code
            if (initialOverrides.id && !initialOverrides.code && config.fields.find(f => f.name === 'code')) {
                updatedData.code = initialOverrides.id;
            }
            setFormData(updatedData);
        }
    }, [initialOverrides, config, data]);

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        // Basic validation for visible fields only
        for (const field of config.fields) {
            const isHidden = field.hidden ? field.hidden(formData) : false;
            if (!isHidden && field.required && !formData[field.name]) {
                alert(`${field.label} is required`);
                return;
            }
            
            // Run custom validation if provided
            if (!isHidden && field.validate) {
                const error = field.validate(formData[field.name], formData, data);
                if (error) {
                    alert(error);
                    return;
                }
            }
        }
        
        // Check for duplicate code/ID when adding new or editing (if code changed)
        if (config.entityKey === 'items') {
            const newCode = formData.code;
            const existingItem = data.find(item => 
                item.code === newCode && item.id !== formData.id
            );
            if (existingItem) {
                alert(`❌ Item Code "${newCode}" already exists! Please use a unique code.`);
                return;
            }
        }
        
        
        // If editing (has id in formData), call onUpdate, otherwise call onSave
        if (formData.id && config.onUpdate) {
            try {
                console.log('Updating account:', formData.id, formData);
                await config.onUpdate(formData.id, formData);
                console.log('Account updated successfully');
                onSuccess();
            } catch (error: any) {
                console.error('Error updating:', error);
                alert(`Failed to update: ${error.message || 'Unknown error'}`);
            }
        } else {
            try {
                console.log('Saving new account:', formData);
                await config.onSave({ ...formData, id: formData.id || Math.random().toString(36).substr(2, 9) });
                console.log('Account saved successfully');
                onSuccess();
            } catch (error: any) {
                console.error('Error saving:', error);
                alert(`Failed to save: ${error.message || 'Unknown error'}`);
            }
        }
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
                                value={formData[field.name] ?? ''}
                                onChange={e => {
                                    let value = e.target.value;
                                    if (field.type === 'number') {
                                        value = value === '' ? 0 : parseFloat(value);
                                        if (isNaN(value)) value = 0;
                                    }
                                    handleChange(field.name, value);
                                }}
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
                    <h3 className="text-lg font-bold text-slate-800">{initialOverrides ? 'Edit' : 'Add New'} {config.title}</h3>
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
    const [editingEntity, setEditingEntity] = useState<any>(null);
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
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => {
                                                            setEditingEntity(row);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="text-slate-400 hover:text-blue-500 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => config.onDelete(row.id)}
                                                        className="text-slate-400 hover:text-red-500 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
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
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingEntity(null);
                }}
                data={data}
                initialOverrides={editingEntity}
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
            { header: 'ID', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
            { header: 'Name', key: 'name', render: (r) => <div className="font-medium text-slate-800">{r.name}</div> },
            { header: 'Passport', key: 'passportNumber' },
            { header: 'Role', key: 'role', render: (r) => r.role || '-' },
            { header: 'Visa Expiry', key: 'visaRenewalDate', render: (r) => r.visaRenewalDate || '-' },
            { header: 'Status', key: 'status', render: (r) => <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{r.status || 'Active'}</span> },
        ],
        fields: [
            { 
                name: 'id', 
                label: 'Employee ID', 
                type: 'text', 
                required: false,
                placeholder: 'Auto-generated (e.g., EMP-1001)',
                readOnly: true,
                compute: (formData, allData) => {
                    if (formData.id && formData.id.trim() !== '' && !formData.id.match(/^EMP-\d+$/)) {
                        return formData.id;
                    }
                    const prefix = 'EMP';
                    const existingIds = allData
                        .map((e: any) => {
                            const match = e.id?.match(/^EMP-(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(n => n > 0)
                        .sort((a, b) => b - a);
                    const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
                    return `${prefix}-${nextNumber}`;
                }
            },
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


// --- Hook for Configurations (Exported for Reuse) ---
export const useSetupConfigs = () => {
    const { 
        state, 
        addPartner, 
        addItem,
        updateItem,
        addAccount, 
        deleteEntity, 
        addDivision,
        updateDivision,
        addSubDivision,
        updateSubDivision,
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
            { header: 'Code', key: 'code', render: (r) => <span className="font-mono text-xs font-semibold text-blue-600">{(r as any).code || r.id}</span> },
            { header: 'ID', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-400">{r.id}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Type', key: 'type', render: (r) => <span className="text-xs font-mono bg-slate-100 px-1 rounded">{r.type}</span> },
            { header: 'Division', key: 'divisionId', render: (r) => state.divisions.find(d => d.id === r.divisionId)?.name || '-' },
            { header: 'Currency', key: 'defaultCurrency', render: (r) => <span className="font-mono text-xs">{r.defaultCurrency || 'USD'}</span> },
            { header: 'Balance', key: 'balance', render: (r) => <span className={r.balance < 0 ? 'text-red-500' : 'text-emerald-600'}>{r.balance}</span> }
        ],
        fields: [
            { name: 'type', label: 'Partner Type', type: 'select', options: Object.values(PartnerType), required: true },
            { 
                name: 'id', 
                label: 'Partner ID', 
                type: 'text', 
                required: false,
                placeholder: 'Enter ID (e.g., SUP-1001) or leave blank for auto-generation',
                readOnly: false,
                validate: (value: string, formData: any, allData: any[]) => {
                    // If ID is provided, check for duplicates
                    if (value && value.trim() !== '') {
                        const trimmedId = value.trim();
                        // Check if this ID already exists (excluding current record if editing)
                        const existing = allData.find((p: any) => p.id === trimmedId);
                        // If editing, formData.id will be the current ID, so exclude it from duplicate check
                        if (existing && existing.id !== formData.id) {
                            return `Partner ID "${trimmedId}" already exists. Please use a different ID.`;
                        }
                    }
                    return null; // No error
                },
                compute: (formData, allData) => {
                    // If user has manually entered an ID, use it
                    if (formData.id && formData.id.trim() !== '') {
                        return formData.id.trim();
                    }
                    
                    // Auto-generate ID based on partner type if not provided
                    if (!formData.type) return ''; // No type selected yet
                    
                    // Get prefix based on partner type
                    let prefix = 'PTN'; // Default prefix
                    switch(formData.type) {
                        case PartnerType.SUPPLIER: prefix = 'SUP'; break;
                        case PartnerType.CUSTOMER: prefix = 'CUS'; break;
                        case PartnerType.SUB_SUPPLIER: prefix = 'SUB'; break;
                        case PartnerType.VENDOR: prefix = 'VEN'; break;
                        case PartnerType.CLEARING_AGENT: prefix = 'CLA'; break;
                        case PartnerType.FREIGHT_FORWARDER: prefix = 'FFW'; break;
                        case PartnerType.COMMISSION_AGENT: prefix = 'COM'; break;
                    }
                    
                    // Find existing partners of same type to get next number
                    const sameTypePartners = allData.filter((p: any) => p.type === formData.type);
                    const existingIds = sameTypePartners
                        .map((p: any) => {
                            // Extract number from IDs like SUP-1001, CUS-1002, etc.
                            const match = p.id?.match(new RegExp(`^${prefix}-(\\d+)$`));
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(n => n > 0)
                        .sort((a, b) => b - a);
                    
                    const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
                    return `${prefix}-${nextNumber}`;
                }
            },
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
            { 
                name: 'defaultCurrency', 
                label: 'Default Currency', 
                type: 'select', 
                options: (allData, formData) => {
                    // Access current state from closure - state is from useSetupConfigs hook
                    // Return currency codes from state.currencies
                    if (state.currencies && state.currencies.length > 0) {
                        return state.currencies.map(c => c.code);
                    }
                    // Fallback to USD if no currencies
                    return ['USD'];
                }, 
                required: true, 
                defaultValue: 'USD' 
            },
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
            { header: 'Code', key: 'code', render: (r) => <span className="font-mono text-xs text-slate-500">{r.code || r.id}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Location/HQ', key: 'location' }
        ],
        fields: [
            {
                name: 'code',
                label: 'Division Code',
                type: 'text',
                required: false,
                placeholder: 'Enter Code (e.g., DIV-001) or leave blank for auto-generation',
                readOnly: false,
                validate: (value: string, formData: any, allData: any[]) => {
                    if (value && value.trim() !== '') {
                        const trimmedCode = value.trim();
                        const existing = allData.find((d: any) => (d.code || d.id) === trimmedCode && d.id !== formData.id);
                        if (existing) {
                            return `Division Code "${trimmedCode}" already exists. Please use a different code.`;
                        }
                    }
                    return null;
                },
                compute: (formData, allData) => {
                    if (formData.code && formData.code.trim() !== '') {
                        return formData.code.trim();
                    }
                    const prefix = 'DIV';
                    const existingCodes = allData
                        .map((d: any) => {
                            const code = d.code || d.id;
                            const match = code?.match(/^DIV-(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(n => n > 0)
                        .sort((a, b) => b - a);
                    const nextNumber = existingCodes.length > 0 ? existingCodes[0] + 1 : 1001;
                    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
                }
            },
            { name: 'name', label: 'Division Name', type: 'text', required: true },
            { name: 'location', label: 'Location/HQ', type: 'text', required: false }
        ],
        onSave: (data) => addDivision(data),
        onUpdate: (id, data) => updateDivision(id, data),
        onDelete: (id) => deleteEntity('divisions', id)
    };

    const subDivisionConfig: CrudConfig = {
        title: 'Sub-Divisions',
        entityKey: 'subDivisions',
        columns: [
            { header: 'Code', key: 'code', render: (r) => <span className="font-mono text-xs text-slate-500">{r.code || r.id}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Parent Division', key: 'divisionId', render: (r) => {
                const division = state.divisions.find(d => (d.code || d.id) === r.divisionId || d.id === r.divisionId);
                return division?.name || r.divisionId;
            }}
        ],
        fields: [
            {
                name: 'code',
                label: 'Sub-Division Code',
                type: 'text',
                required: false,
                placeholder: 'Enter Code (e.g., SUBDIV-001) or leave blank for auto-generation',
                readOnly: false,
                validate: (value: string, formData: any, allData: any[]) => {
                    if (value && value.trim() !== '') {
                        const trimmedCode = value.trim();
                        const existing = allData.find((sd: any) => (sd.code || sd.id) === trimmedCode && sd.id !== formData.id);
                        if (existing) {
                            return `Sub-Division Code "${trimmedCode}" already exists. Please use a different code.`;
                        }
                    }
                    return null;
                },
                compute: (formData, allData) => {
                    if (formData.code && formData.code.trim() !== '') {
                        return formData.code.trim();
                    }
                    const prefix = 'SUBDIV';
                    const existingCodes = allData
                        .map((sd: any) => {
                            const code = sd.code || sd.id;
                            const match = code?.match(/^SUBDIV-(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(n => n > 0)
                        .sort((a, b) => b - a);
                    const nextNumber = existingCodes.length > 0 ? existingCodes[0] + 1 : 1001;
                    return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
                }
            },
            { name: 'name', label: 'Sub-Division Name', type: 'text', required: true },
            { 
                name: 'divisionId', 
                label: 'Parent Division', 
                type: 'select', 
                options: () => state.divisions.map(d => ({ label: d.name, value: d.code || d.id })),
                required: true 
            }
        ],
        onSave: (data) => addSubDivision(data),
        onUpdate: (id, data) => updateSubDivision(id, data),
        onDelete: (id) => deleteEntity('subDivisions', id)
    };

    const logoConfig: CrudConfig = {
        title: 'Brand Logos',
        entityKey: 'logos',
        columns: [
            { header: 'ID', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
            { header: 'Brand Name', key: 'name' }
        ],
        fields: [ { name: 'name', label: 'Brand Name', type: 'text', required: true } ],
        onSave: (data) => addLogo(data),
        onDelete: (id) => deleteEntity('logos', id)
    };

    const itemConfig: CrudConfig = {
        title: 'Inventory Items (Finished Goods)',
        entityKey: 'items',
        columns: [
            // Show only business code as the visible ID for users
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
                placeholder: 'Enter Item Code or leave blank for auto-generation',
                compute: (formData, allData) => {
                    // If user has manually entered a code, always respect it
                    if (formData.code && String(formData.code).trim() !== '') {
                        return String(formData.code).trim();
                    }

                    // Auto-generate ITEM-XXXX based on last code for THIS factory only
                    const prefix = 'ITEM-';
                    const existingNums = (allData as any[])
                        .map((item: any) => {
                            const match = String(item.code || '').match(/^ITEM-(\d+)$/i);
                            return match ? parseInt(match[1], 10) : 0;
                        })
                        .filter((n: number) => n > 0)
                        .sort((a: number, b: number) => b - a);

                    const nextNumber = existingNums.length > 0 ? existingNums[0] + 1 : 1001;
                    return `${prefix}${nextNumber}`;
                }
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
            { name: 'avgCost', label: 'Avg Production Price (Per Unit)', type: 'number', placeholder: 'Can be negative for waste/garbage' },
            { name: 'salePrice', label: 'Avg Sale Price', type: 'number' },
            { name: 'stockQty', label: 'Opening Stock Qty', type: 'number', placeholder: 'For Opening Balance Only' }
        ],
        onSave: (data) => addItem(data, data.stockQty),
        onUpdate: (id, data) => updateItem(id, data),
        onDelete: (id) => deleteEntity('items', id)
    };

     const warehouseConfig: CrudConfig = {
        title: 'Warehouses',
        entityKey: 'warehouses',
        columns: [
            { header: 'ID', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Location', key: 'location' }
        ],
        fields: [
            { 
                name: 'id', 
                label: 'Warehouse ID', 
                type: 'text', 
                required: false,
                placeholder: 'Auto-generated (e.g., WH-1001)',
                readOnly: true,
                compute: (formData, allData) => {
                    if (formData.id && formData.id.trim() !== '' && !formData.id.match(/^WH-\d+$/)) {
                        return formData.id;
                    }
                    const prefix = 'WH';
                    const existingIds = allData
                        .map((w: any) => {
                            const match = w.id?.match(/^WH-(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(n => n > 0)
                        .sort((a, b) => b - a);
                    const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
                    return `${prefix}-${nextNumber}`;
                }
            },
            { name: 'name', label: 'Warehouse Name', type: 'text', required: true },
            { name: 'location', label: 'Location/Address', type: 'text', required: false },
        ],
        onSave: (data) => addWarehouse(data),
        onDelete: (id) => deleteEntity('warehouses', id)
    };

    const categoryConfig: CrudConfig = {
        title: 'Product Categories',
        entityKey: 'categories',
        columns: [
            { header: 'ID / Code', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
            { header: 'Name', key: 'name' }
        ],
        fields: [
            {
                name: 'id',
                label: 'Category ID',
                type: 'text',
                required: false,
                placeholder: 'Enter ID (e.g., CAT-1001) or leave blank for auto-generation',
                readOnly: false,
                validate: (value: string, formData: any, allData: any[]) => {
                    if (value && value.trim() !== '') {
                        const trimmedId = value.trim();
                        const existing = allData.find((c: any) => c.id === trimmedId);
                        if (existing && existing.id !== formData.id) {
                            return `Category ID "${trimmedId}" already exists. Please use a different ID.`;
                        }
                    }
                    return null;
                },
                compute: (formData, allData) => {
                    // If user entered an ID, respect it
                    if (formData.id && formData.id.trim() !== '') {
                        return formData.id.trim();
                    }

                    // Auto-generate next CAT-XXXX
                    const prefix = 'CAT';
                    const existingIds = allData
                        .map((c: any) => {
                            const match = c.id?.match(/^CAT-(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter((n: number) => n > 0)
                        .sort((a: number, b: number) => b - a);
                    const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
                    return `${prefix}-${nextNumber}`;
                }
            },
            { name: 'name', label: 'Category Name', type: 'text', required: true }
        ],
        onSave: (data) => addCategory(data),
        onDelete: (id) => deleteEntity('categories', id)
    };

    const sectionConfig: CrudConfig = {
        title: 'Factory Sections',
        entityKey: 'sections',
        columns: [
            { header: 'ID / Code', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
            { header: 'Name', key: 'name' }
        ],
        fields: [
            {
                name: 'id',
                label: 'Section ID',
                type: 'text',
                required: false,
                placeholder: 'Enter ID (e.g., SEC-1001) or leave blank for auto-generation',
                readOnly: false,
                validate: (value: string, formData: any, allData: any[]) => {
                    if (value && value.trim() !== '') {
                        const trimmedId = value.trim();
                        const existing = allData.find((s: any) => s.id === trimmedId);
                        if (existing && existing.id !== formData.id) {
                            return `Section ID "${trimmedId}" already exists. Please use a different ID.`;
                        }
                    }
                    return null;
                },
                compute: (formData, allData) => {
                    if (formData.id && formData.id.trim() !== '') {
                        return formData.id.trim();
                    }

                    const prefix = 'SEC';
                    const existingIds = allData
                        .map((s: any) => {
                            const match = s.id?.match(/^SEC-(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter((n: number) => n > 0)
                        .sort((a: number, b: number) => b - a);
                    const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
                    return `${prefix}-${nextNumber}`;
                }
            },
            { name: 'name', label: 'Section Name', type: 'text', required: true }
        ],
        onSave: (data) => addSection(data),
        onDelete: (id) => deleteEntity('sections', id)
    };

    const originalTypeConfig: CrudConfig = {
        title: 'Original Types',
        entityKey: 'originalTypes',
        columns: [
            { header: 'ID', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Packing', key: 'packingType' },
            { header: 'Size (Kg)', key: 'packingSize' }
        ],
        fields: [
            { 
                name: 'id', 
                label: 'Original Type ID', 
                type: 'text', 
                required: false,
                placeholder: 'Enter ID (e.g., OT-1001) or leave blank for auto-generation',
                readOnly: false,
                validate: (value: string, formData: any, allData: any[]) => {
                    // If ID is provided, check for duplicates
                    if (value && value.trim() !== '') {
                        const trimmedId = value.trim();
                        // Check if this ID already exists (excluding current record if editing)
                        const existing = allData.find((ot: any) => ot.id === trimmedId);
                        // If editing, formData.id will be the current ID, so exclude it from duplicate check
                        if (existing && existing.id !== formData.id) {
                            return `Original Type ID "${trimmedId}" already exists. Please use a different ID.`;
                        }
                    }
                    return null; // No error
                },
                compute: (formData, allData) => {
                    // If user has manually entered an ID, use it
                    if (formData.id && formData.id.trim() !== '') {
                        return formData.id.trim();
                    }
                    
                    // Auto-generate ID if not provided
                    const prefix = 'OT';
                    const existingIds = allData
                        .map((ot: any) => {
                            const match = ot.id?.match(/^OT-(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(n => n > 0)
                        .sort((a, b) => b - a);
                    const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
                    return `${prefix}-${nextNumber}`;
                }
            },
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
            // Treat the business ID as a Code for display
            { header: 'Code', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Parent Type', key: 'originalTypeId', render: (r) => state.originalTypes.find(ot => ot.id === r.originalTypeId)?.name || r.originalTypeId }
        ],
        fields: [
            { 
                name: 'id', 
                label: 'Original Product Code', 
                type: 'text', 
                required: false,
                placeholder: 'Enter ID (e.g., ORP-1001) or leave blank for auto-generation',
                readOnly: false,
                compute: (formData, allData) => {
                    if (formData.id && formData.id.trim() !== '' && !formData.id.match(/^ORP-\d+$/)) {
                        return formData.id;
                    }
                    const prefix = 'ORP';
                    const existingIds = allData
                        .map((op: any) => {
                            const match = op.id?.match(/^ORP-(\d+)$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(n => n > 0)
                        .sort((a, b) => b - a);
                    const nextNumber = existingIds.length > 0 ? existingIds[0] + 1 : 1001;
                    return `${prefix}-${nextNumber}`;
                }
            },
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
        warehouseConfig,
        categoryConfig,
        sectionConfig,
        originalTypeConfig,
        originalProductConfig
    };
};

// --- Currency Manager ---
const CurrencyManager: React.FC<{ data: any[] }> = ({ data }) => {
    const { addCurrency, updateCurrency, deleteEntity } = useData();
    const [showForm, setShowForm] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false); // Collapsed by default
    const [editingCurrency, setEditingCurrency] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        symbol: '',
        exchangeRate: 1,
        isBaseCurrency: false
    });

    const resetForm = () => {
        setFormData({ code: '', name: '', symbol: '', exchangeRate: 1, isBaseCurrency: false });
        setEditingCurrency(null);
        setShowForm(false);
    };

    const handleSave = () => {
        if (!formData.code || !formData.name || !formData.symbol || formData.exchangeRate <= 0) {
            alert('Please fill all required fields');
            return;
        }

        if (editingCurrency) {
            updateCurrency(editingCurrency.id, formData);
        } else {
            addCurrency({ ...formData, id: Math.random().toString(36).substr(2, 9) });
        }
        resetForm();
    };

    const handleEdit = (currency: any) => {
        setEditingCurrency(currency);
        setFormData({
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            exchangeRate: currency.exchangeRate,
            isBaseCurrency: currency.isBaseCurrency
        });
        setShowForm(true);
    };

    return (
        <div className="bg-white rounded-xl shadow-md p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4">
                <div 
                    className="flex items-center gap-2 cursor-pointer select-none"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <CreditCard className="text-blue-500" size={24} />
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        Currency Management
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </h3>
                </div>
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(true); // Auto-expand when adding
                        setShowForm(!showForm);
                    }} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <Plus size={18} />
                    {showForm ? 'Cancel' : '+ Add Currency'}
                </button>
            </div>
            
            {!isExpanded && data.length > 0 && (
                <div className="text-sm text-slate-600 mb-2">
                    {data.length} currency{data.length !== 1 ? 'ies' : ''} configured. Click to expand and manage.
                </div>
            )}

            {isExpanded && (
                <div>
                    {/* Search Box */}
                    {data.length > 0 && (
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search currencies..." 
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}

                    {showForm && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Currency Code *</label>
                            <input
                                type="text"
                                placeholder="USD, EUR, GBP..."
                                maxLength={3}
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                className="w-full border border-slate-300 rounded-lg p-2 uppercase"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Symbol *</label>
                            <input
                                type="text"
                                placeholder="$, €, £..."
                                value={formData.symbol}
                                onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Currency Name *</label>
                            <input
                                type="text"
                                placeholder="US Dollar, Euro..."
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg p-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Exchange Rate (1 USD = ?) *</label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={formData.exchangeRate}
                                onChange={e => setFormData({ ...formData, exchangeRate: parseFloat(e.target.value) })}
                                className="w-full border border-slate-300 rounded-lg p-2"
                            />
                        </div>
                        <div className="flex items-center">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isBaseCurrency}
                                    onChange={e => setFormData({ ...formData, isBaseCurrency: e.target.checked })}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm font-medium text-slate-700">Base Currency (USD)</span>
                            </label>
                        </div>
                    </div>
                    <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium">
                        {editingCurrency ? 'Update Currency' : 'Add Currency'}
                    </button>
                </div>
            )}

            {data.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                    <p>No currencies configured. Add currencies to enable multi-currency transactions.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="text-left p-3 text-sm font-semibold text-slate-700">Code</th>
                                <th className="text-left p-3 text-sm font-semibold text-slate-700">Name</th>
                                <th className="text-left p-3 text-sm font-semibold text-slate-700">Symbol</th>
                                <th className="text-right p-3 text-sm font-semibold text-slate-700">Rate (1 USD =)</th>
                                <th className="text-center p-3 text-sm font-semibold text-slate-700">Base</th>
                                <th className="text-right p-3 text-sm font-semibold text-slate-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data
                                .filter(currency => 
                                    currency.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    currency.symbol.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((currency, idx) => (
                                <tr key={currency.id} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                    <td className="p-3 font-mono text-sm font-bold text-slate-800">{currency.code}</td>
                                    <td className="p-3 text-sm text-slate-700">{currency.name}</td>
                                    <td className="p-3 text-sm font-medium text-slate-700">{currency.symbol}</td>
                                    <td className="p-3 text-right font-mono text-sm text-slate-800">{currency.exchangeRate.toFixed(4)}</td>
                                    <td className="p-3 text-center">
                                        {currency.isBaseCurrency && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">BASE</span>}
                                    </td>
                                    <td className="p-3 text-right space-x-2">
                                        <button onClick={() => handleEdit(currency)} className="text-blue-600 hover:text-blue-800 font-medium text-sm">Edit</button>
                                        {!currency.isBaseCurrency && (
                                            <button onClick={() => confirm(`Delete ${currency.name}?`) && deleteEntity('currencies', currency.id)} className="text-red-600 hover:text-red-800 font-medium text-sm">Delete</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
                </div>
            )}
        </div>
    );
};

// --- Chart of Accounts Manager with Bulk Import ---
const ChartOfAccountsManager: React.FC<{ data: any[] }> = ({ data }) => {
    const { addAccount, updateAccount, deleteEntity } = useData();
    const [isImporting, setIsImporting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingAccount, setEditingAccount] = useState<any>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const handleBulkImport = async () => {
        if (!confirm(`Import ${INITIAL_ACCOUNTS.length} professional accounts into this factory?\n\nThis will add:\n• Assets (1000-1999)\n• Liabilities (2000-2999)\n• Equity (3000-3999)\n• Revenue (4000-4999)\n• Expenses (5000-5999)`)) {
            return;
        }

        setIsImporting(true);
        let imported = 0;
        let skipped = 0;
        const existingCodes = new Set(data.map(a => a.code)); // Track codes we've seen

        for (const account of INITIAL_ACCOUNTS) {
            try {
                // Check if account code already exists
                if (!existingCodes.has(account.code)) {
                    addAccount({
                        ...account,
                        id: undefined, // Let Firebase generate new ID
                        currency: 'USD', // Default currency
                        balance: account.balance || 0 // Ensure balance is set
                    });
                    existingCodes.add(account.code); // Mark as imported
                    imported++;
                    
                    // Small delay to avoid overwhelming Firebase
                    if (imported % 20 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } else {
                    skipped++;
                }
            } catch (error) {
                console.error(`Failed to import account ${account.code}:`, error);
            }
        }

        setIsImporting(false);
        alert(`✅ Successfully imported ${imported} accounts!\n${skipped > 0 ? `Skipped ${skipped} existing accounts.` : ''}`);
    };

    const accountConfig: CrudConfig = {
        title: 'Chart of Accounts',
        entityKey: 'accounts',
        columns: [
            { header: 'ID', key: 'id', render: (r) => <span className="font-mono text-xs text-slate-500">{r.id}</span> },
            { header: 'Code', key: 'code', render: (r) => <span className="font-mono text-xs">{r.code}</span> },
            { header: 'Name', key: 'name' },
            { header: 'Type', key: 'type' },
            { header: 'Balance', key: 'balance', render: (r) => <span>${(r.balance || 0).toFixed(2)}</span> }
        ],
        fields: [
            { name: 'type', label: 'Type', type: 'select', options: Object.values(AccountType), required: true },
            { 
                name: 'code', 
                label: 'GL Code', 
                type: 'text', 
                required: true, 
                placeholder: 'Enter code (e.g., 3400) or leave blank for auto',
                compute: (formData, allData) => {
                    // If user manually entered a code, keep it
                    if (formData.code && formData.code.trim() !== '') {
                        return formData.code;
                    }
                    // Otherwise auto-generate based on type
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
            { 
                name: 'currency', 
                label: 'Currency (for Bank/Cash accounts)', 
                type: 'select', 
                options: Object.keys(EXCHANGE_RATES),
                defaultValue: 'USD'
            },
            { name: 'balance', label: 'Opening Balance', type: 'number', defaultValue: 0 }
        ],
        onSave: (data) => addAccount(data),
        onUpdate: (id, data) => updateAccount(id, data),
        onDelete: (id) => deleteEntity('accounts', id)
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-slate-600 hover:text-slate-800"
                    >
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                    <h3 className="text-xl font-bold text-slate-800">Chart of Accounts</h3>
                </div>
                <div className="flex gap-2">
                    {data.length < 50 && (
                        <button
                            onClick={handleBulkImport}
                            disabled={isImporting}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                            <Download size={16} />
                            {isImporting ? 'Importing...' : `Import 166 Accounts`}
                        </button>
                    )}
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Plus size={16} />
                        Add Manual
                    </button>
                </div>
            </div>

            {isExpanded && (
                <>
                    {/* Search Box */}
                    {data.length > 0 && (
                        <div className="relative mb-4">
                            <Search size={18} className="absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search accounts by code, name, or type..." 
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    )}

                    {data.length === 0 && !isImporting && (
                        <div className="text-center py-8 text-slate-500">
                    <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No Chart of Accounts found</p>
                    <p className="text-sm mt-2">Click "Import 166 Accounts" to load the professional accounting structure</p>
                </div>
            )}

            {(showForm || editingAccount) && (
                <div className="mb-4 border-t pt-4">
                    <GenericForm 
                        config={accountConfig} 
                        data={data} 
                        onCancel={() => {
                            setShowForm(false);
                            setEditingAccount(null);
                        }} 
                        onSuccess={() => {
                            setShowForm(false);
                            setEditingAccount(null);
                        }}
                        initialOverrides={editingAccount || undefined}
                    />
                </div>
            )}

            {data.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Code</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Name</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Type</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Balance</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {data
                                .filter(account => 
                                    account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    account.type.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((account) => (
                                <tr key={account.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 font-mono text-xs">{account.code}</td>
                                    <td className="px-4 py-2 text-sm">{account.name}</td>
                                    <td className="px-4 py-2 text-sm">{account.type}</td>
                                    <td className="px-4 py-2 text-sm text-right">${account.balance || 0}</td>
                                    <td className="px-4 py-2 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => setEditingAccount(account)}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Edit Account"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => deleteEntity('accounts', account.id)}
                                                className="text-red-600 hover:text-red-800"
                                                title="Delete Account"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-4 text-sm text-slate-600">
                        Total: {data.filter(account => 
                            account.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            account.type.toLowerCase().includes(searchTerm.toLowerCase())
                        ).length} of {data.length} accounts
                    </div>
                </div>
            )}
                </>
            )}
        </div>
    );
};

// --- Main Setup Component ---

export const SetupModule: React.FC = () => {
    const { state } = useData();
    const configs = useSetupConfigs();

    // Export CSV for Categories or Sections
    const handleExportCSV = (data: { id: string; name: string }[], filename: string) => {
        if (!data || data.length === 0) {
            alert('No data to export');
            return;
        }
        const csv = Papa.unparse(data.map(({ id, name }) => ({ ID: id, Name: name })));
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8">
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
                    <button
                        className="ml-auto flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        onClick={() => handleExportCSV(state.categories, 'categories_export.csv')}
                        title="Export Categories to CSV"
                    >
                        <Download size={14} /> Export Categories
                    </button>
                    </div>
                    <CrudManager config={configs.categoryConfig} data={state.categories} />
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-slate-600">Export Sections:</span>
                        <button
                            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            onClick={() => handleExportCSV(state.sections, 'sections_export.csv')}
                            title="Export Sections to CSV"
                        >
                            <Download size={14} /> Export Sections
                        </button>
                    </div>
                    <CrudManager config={configs.sectionConfig} data={state.sections} />
                    <CrudManager config={configs.itemConfig} data={state.items} />
                    <CrudManager config={configs.warehouseConfig} data={state.warehouses} />
                    
                    <div className="flex items-center gap-2 mb-2 mt-8">
                        <CreditCard className="text-slate-400" size={20} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Financials</h2>
                    </div>
                    <CurrencyManager data={state.currencies} />
                    <ChartOfAccountsManager data={state.accounts} />
                </div>
            </div>
        </div>
    );
};
