
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { GuaranteeCheque, CustomsDocument, ChequeStatus } from '../types';
import { Briefcase, FileText, Plus, Search, Filter, Edit2, Trash2, Save, X, Upload, Download, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { CURRENT_USER } from '../constants';

const ChequeStatusBadge: React.FC<{ status: ChequeStatus }> = ({ status }) => {
    const colors = {
        'Submitted': 'bg-blue-100 text-blue-700',
        'Returned': 'bg-emerald-100 text-emerald-700',
        'Cashed': 'bg-red-100 text-red-700'
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors[status]}`}>{status}</span>;
};

export const CustomsModule: React.FC = () => {
    const { state, addGuaranteeCheque, updateGuaranteeCheque, deleteEntity, addCustomsDocument } = useData();
    const [activeTab, setActiveTab] = useState<'cheques' | 'documents'>('cheques');

    // --- Cheque State ---
    const [chequeSearch, setChequeSearch] = useState('');
    const [chequeModalOpen, setChequeModalOpen] = useState(false);
    const [editingCheque, setEditingCheque] = useState<Partial<GuaranteeCheque>>({});
    const [filterDestination, setFilterDestination] = useState('');

    // --- Document State ---
    const [docSearch, setDocSearch] = useState('');
    const [docModalOpen, setDocModalOpen] = useState(false);
    const [newDoc, setNewDoc] = useState<Partial<CustomsDocument>>({});

    // --- Cheque Logic ---
    const filteredCheques = state.guaranteeCheques.filter(c => {
        const matchesSearch = 
            c.chequeNo.includes(chequeSearch) || 
            c.containerNo.toLowerCase().includes(chequeSearch.toLowerCase()) ||
            c.shipper.toLowerCase().includes(chequeSearch.toLowerCase());
        const matchesDest = filterDestination ? c.destination === filterDestination : true;
        return matchesSearch && matchesDest;
    }).sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime());

    const handleSaveCheque = () => {
        if (!editingCheque.chequeNo || !editingCheque.amount) {
            alert('Cheque No and Amount are required');
            return;
        }
        
        const cheque: GuaranteeCheque = {
            ...editingCheque as GuaranteeCheque,
            id: editingCheque.id || Math.random().toString(36).substr(2, 9),
            entryDate: editingCheque.entryDate || new Date().toISOString().split('T')[0],
            status: editingCheque.status || 'Submitted'
        };

        if (editingCheque.id) {
            updateGuaranteeCheque(cheque);
        } else {
            addGuaranteeCheque(cheque);
        }
        setChequeModalOpen(false);
        setEditingCheque({});
    };

    const handleEditCheque = (c: GuaranteeCheque) => {
        setEditingCheque(c);
        setChequeModalOpen(true);
    };

    const handleDeleteCheque = (id: string) => {
        if (window.confirm('Are you sure you want to delete this guarantee cheque?')) {
            deleteEntity('guaranteeCheques', id);
        }
    };

    // --- Document Logic ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Simulate Upload
            setNewDoc({
                ...newDoc,
                fileName: file.name,
                fileType: file.type,
                fileUrl: URL.createObjectURL(file), // Local blob for demo
                uploadDate: new Date().toISOString().split('T')[0],
                uploadedBy: CURRENT_USER.name
            });
        }
    };

    const handleSaveDoc = () => {
        if (!newDoc.fileName) return;
        const doc: CustomsDocument = {
            id: Math.random().toString(36).substr(2, 9),
            ...newDoc as CustomsDocument
        };
        addCustomsDocument(doc);
        setDocModalOpen(false);
        setNewDoc({});
    };

    const copyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
    };

    const filteredDocs = state.customsDocuments.filter(d => 
        d.fileName.toLowerCase().includes(docSearch.toLowerCase()) || 
        d.description.toLowerCase().includes(docSearch.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header & Navigation */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Briefcase size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Customs Management</h1>
                        <p className="text-slate-500 text-sm">Manage Guarantees & Documentation</p>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('cheques')} className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'cheques' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Guarantee Cheques</button>
                    <button onClick={() => setActiveTab('documents')} className={`px-6 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'documents' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Documents Library</button>
                </div>
            </div>

            {activeTab === 'cheques' && (
                <div className="space-y-4 animate-in fade-in">
                    {/* Filters */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4 items-center">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                            <input type="text" placeholder="Search Cheque No, Container, Shipper..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-slate-800" value={chequeSearch} onChange={e => setChequeSearch(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                            <Filter size={16} className="text-slate-400" />
                            <select className="bg-white border border-slate-300 rounded-lg py-2 px-3 text-sm text-slate-700 focus:outline-none" value={filterDestination} onChange={e => setFilterDestination(e.target.value)}>
                                <option value="">All Destinations</option>
                                {Array.from(new Set(state.guaranteeCheques.map(c => c.destination))).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <button onClick={() => { setEditingCheque({}); setChequeModalOpen(true); }} className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                            <Plus size={18} /> New Cheque
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Cheque No</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">BOE / Container</th>
                                    <th className="px-6 py-4">Shipper / Dest</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCheques.map(c => (
                                    <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4 text-slate-500">{c.chequeDate}</td>
                                        <td className="px-6 py-4 font-mono font-bold text-slate-700">{c.chequeNo}</td>
                                        <td className="px-6 py-4 font-mono text-slate-800 font-bold">${c.chequeAmount.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-indigo-600">{c.boeNo}</div>
                                            <div className="text-xs text-slate-500">{c.containerNo}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-700">{c.shipper}</div>
                                            <div className="text-xs text-slate-500">{c.destination}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center"><ChequeStatusBadge status={c.status} /></td>
                                        <td className="px-6 py-4 text-center flex justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleEditCheque(c)} className="p-1 hover:bg-slate-200 rounded text-slate-600"><Edit2 size={16}/></button>
                                            <button onClick={() => handleDeleteCheque(c.id)} className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredCheques.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-slate-400 italic">No cheques found matching criteria.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'documents' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                            <input type="text" placeholder="Search documents..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" value={docSearch} onChange={e => setDocSearch(e.target.value)} />
                        </div>
                        <button onClick={() => { setNewDoc({}); setDocModalOpen(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-700">
                            <Upload size={18} /> Upload Document
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {filteredDocs.map(doc => (
                            <div key={doc.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-3 rounded-lg ${doc.fileType.includes('pdf') ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                                        <FileText size={24} />
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => copyLink(doc.fileUrl)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded" title="Copy Link"><Copy size={14}/></button>
                                        <button onClick={() => deleteEntity('customsDocuments', doc.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded" title="Delete"><Trash2 size={14}/></button>
                                    </div>
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm truncate mb-1" title={doc.fileName}>{doc.fileName}</h3>
                                <p className="text-xs text-slate-500 mb-4 line-clamp-2 h-8">{doc.description}</p>
                                <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                                    <span>{doc.uploadDate}</span>
                                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-600 font-medium hover:underline">
                                        View <ExternalLink size={10} />
                                    </a>
                                </div>
                            </div>
                        ))}
                        {filteredDocs.length === 0 && (
                            <div className="col-span-full text-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-400">
                                <FileText size={48} className="mx-auto mb-2 opacity-20" />
                                <p>No documents found.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Cheque Modal */}
            {chequeModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-2xl w-full animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-lg font-bold text-slate-800">{editingCheque.id ? 'Edit Cheque' : 'New Guarantee Cheque'}</h3>
                            <button onClick={() => setChequeModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Cheque No *</label><input type="text" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.chequeNo || ''} onChange={e => setEditingCheque({...editingCheque, chequeNo: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Cheque Date</label><input type="date" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.chequeDate || ''} onChange={e => setEditingCheque({...editingCheque, chequeDate: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Amount *</label><input type="number" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.chequeAmount || ''} onChange={e => setEditingCheque({...editingCheque, chequeAmount: parseFloat(e.target.value)})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">BOE Number</label><input type="text" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.boeNo || ''} onChange={e => setEditingCheque({...editingCheque, boeNo: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Shipper</label><input type="text" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.shipper || ''} onChange={e => setEditingCheque({...editingCheque, shipper: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Destination</label><input type="text" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.destination || ''} onChange={e => setEditingCheque({...editingCheque, destination: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Container No</label><input type="text" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.containerNo || ''} onChange={e => setEditingCheque({...editingCheque, containerNo: e.target.value})} /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-1">Status</label><select className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.status || 'Submitted'} onChange={e => setEditingCheque({...editingCheque, status: e.target.value as ChequeStatus})}><option value="Submitted">Submitted</option><option value="Returned">Returned</option><option value="Cashed">Cashed</option></select></div>
                            <div className="col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Stock Description</label><input type="text" className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800" value={editingCheque.stock || ''} onChange={e => setEditingCheque({...editingCheque, stock: e.target.value})} /></div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setChequeModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
                            <button onClick={handleSaveCheque} className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700">Save Cheque</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Upload Modal */}
            {docModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-lg font-bold text-slate-800">Upload Document</h3>
                            <button onClick={() => setDocModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
                                <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                                <p className="text-sm text-slate-500 font-medium">{newDoc.fileName || 'Click to select file'}</p>
                                <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG supported</p>
                            </div>
                            {newDoc.fileName && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Description / Note</label>
                                    <textarea className="w-full border border-slate-300 rounded p-2 bg-white text-slate-800 text-sm" rows={3} placeholder="e.g. Bill of Lading for Container X" value={newDoc.description || ''} onChange={e => setNewDoc({...newDoc, description: e.target.value})} />
                                </div>
                            )}
                        </div>
                        <button onClick={handleSaveDoc} disabled={!newDoc.fileName} className="w-full bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed">
                            Confirm Upload
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
