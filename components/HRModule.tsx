
import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { EntitySelector } from './EntitySelector';
import { Employee, Task, Enquiry, Vehicle, AttendanceRecord, SalaryPayment } from '../types';
import { Users, Calendar, DollarSign, CheckSquare, HelpCircle, Truck, Plus, Search, Edit2, Trash2, Save, X, AlertTriangle, User, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

type HrTab = 'employees' | 'attendance' | 'payroll' | 'tasks' | 'enquiries' | 'vehicles';

export const HRModule: React.FC = () => {
    const { state, addEmployee, updateEmployee, deleteEntity, saveAttendance, processPayroll, addTask, updateTask, addEnquiry, updateEnquiry, addVehicle, updateVehicle, addVehicleFine } = useData();
    const [activeTab, setActiveTab] = useState<HrTab>('employees');

    // --- SUB-COMPONENTS ---

    const EmployeeManager = () => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [editId, setEditId] = useState<string | null>(null);
        const [formData, setFormData] = useState<Partial<Employee>>({});
        const [searchTerm, setSearchTerm] = useState('');

        const handleEdit = (emp: Employee) => {
            setEditId(emp.id);
            setFormData(emp);
            setIsModalOpen(true);
        };

        const handleAddNew = () => {
            setEditId(null);
            setFormData({
                status: 'Active',
                onDuty: 'Yes',
                companyVisa: 'Yes',
                basicSalary: 0,
                advancesBalance: 0
            });
            setIsModalOpen(true);
        };

        const handleSave = () => {
            if (!formData.name || !formData.passportNumber || !formData.designation) {
                alert('Name, Passport, and Designation are required.');
                return;
            }
            
            // Auto calc Visa Renewal
            let visaRenewal = formData.visaRenewalDate;
            if (formData.visaDate && !visaRenewal) {
                const d = new Date(formData.visaDate);
                d.setFullYear(d.getFullYear() + 2);
                visaRenewal = d.toISOString().split('T')[0];
            }

            const empData = {
                ...formData,
                visaRenewalDate: visaRenewal,
                id: editId || Math.random().toString(36).substr(2, 9)
            } as Employee;

            if (editId) updateEmployee(empData);
            else addEmployee(empData);
            
            setIsModalOpen(false);
        };

        const filtered = state.employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));

        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                        <input type="text" placeholder="Search employees..." className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm bg-white" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <button onClick={handleAddNew} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700"><Plus size={16} /> Add Employee</button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">Designation</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Visa Expiry</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-800">{emp.name}</td>
                                    <td className="px-6 py-4 text-slate-600">{emp.designation}</td>
                                    <td className="px-6 py-4 text-slate-500">{emp.phone}</td>
                                    <td className="px-6 py-4 text-slate-500">{emp.visaExpiry || '-'}</td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${emp.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{emp.status}</span></td>
                                    <td className="px-6 py-4 text-center flex justify-center gap-2">
                                        <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:bg-blue-50 p-1 rounded"><Edit2 size={16} /></button>
                                        <button onClick={() => deleteEntity('employees', emp.id)} className="text-red-400 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
                            <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                                <h3 className="text-lg font-bold text-slate-800">{editId ? 'Edit Employee' : 'New Employee'}</h3>
                                <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400" /></button>
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Personal */}
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-3 border-b pb-1">Personal & Employment</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Full Name *</label><input type="text" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Designation *</label><input type="text" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.designation || ''} onChange={e => setFormData({...formData, designation: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Status</label><select className="w-full border p-2 rounded bg-white text-slate-800" value={formData.status || 'Active'} onChange={e => setFormData({...formData, status: e.target.value as any})}><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Terminated">Terminated</option></select></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Phone</label><input type="text" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Nationality</label><input type="text" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.nationality || ''} onChange={e => setFormData({...formData, nationality: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">On Duty?</label><select className="w-full border p-2 rounded bg-white text-slate-800" value={formData.onDuty || 'Yes'} onChange={e => setFormData({...formData, onDuty: e.target.value as any})}><option value="Yes">Yes</option><option value="No">No</option></select></div>
                                    </div>
                                </div>
                                {/* Visa */}
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-3 border-b pb-1">Legal & Visa</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Passport No *</label><input type="text" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.passportNumber || ''} onChange={e => setFormData({...formData, passportNumber: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Passport Expiry</label><input type="date" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.passportExpiry || ''} onChange={e => setFormData({...formData, passportExpiry: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Visa Issue Date</label><input type="date" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.visaDate || ''} onChange={e => setFormData({...formData, visaDate: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Visa Expiry</label><input type="date" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.visaExpiry || ''} onChange={e => setFormData({...formData, visaExpiry: e.target.value})} /></div>
                                    </div>
                                </div>
                                {/* Financial */}
                                <div>
                                    <h4 className="font-bold text-slate-700 mb-3 border-b pb-1">Financial</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Basic Salary (USD)</label><input type="number" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.basicSalary || 0} onChange={e => setFormData({...formData, basicSalary: parseFloat(e.target.value)})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Bank Name</label><input type="text" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.bankName || ''} onChange={e => setFormData({...formData, bankName: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">IBAN / Account</label><input type="text" className="w-full border p-2 rounded bg-white text-slate-800" value={formData.iban || ''} onChange={e => setFormData({...formData, iban: e.target.value})} /></div>
                                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Current Advances</label><input type="number" className="w-full border p-2 rounded bg-slate-100 text-slate-500" value={formData.advancesBalance || 0} readOnly /></div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded">Cancel</button>
                                <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-bold rounded shadow hover:bg-blue-700">Save Employee</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const AttendanceManager = () => {
        const [currentMonth, setCurrentMonth] = useState(new Date());
        
        const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        
        const changeMonth = (delta: number) => {
            const newDate = new Date(currentMonth);
            newDate.setMonth(newDate.getMonth() + delta);
            setCurrentMonth(newDate);
        };

        const handleMark = (empId: string, day: number, status: AttendanceRecord['status']) => {
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const record: AttendanceRecord = {
                id: Math.random().toString(),
                employeeId: empId,
                date: dateStr,
                status
            };
            saveAttendance(record);
        };

        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft size={20}/></button>
                    <h3 className="text-lg font-bold text-slate-800">{currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
                    <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight size={20}/></button>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-sm">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 min-w-[150px] sticky left-0 bg-slate-50 z-10">Employee</th>
                                {days.map(d => <th key={d} className="px-1 py-3 text-center min-w-[30px]">{d}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {state.employees.filter(e => e.status === 'Active').map(emp => (
                                <tr key={emp.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 font-medium text-slate-800 sticky left-0 bg-white">{emp.name}</td>
                                    {days.map(d => {
                                        const dDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                                        const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                        const record = state.attendance.find(a => a.employeeId === emp.id && a.date === dateStr);
                                        
                                        // Default Logic: Mark Present till today excluding Sundays if no record
                                        const isSunday = dDate.getDay() === 0;
                                        const today = new Date();
                                        const todayZero = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                                        const isFuture = dDate > todayZero;
                                        
                                        let status = record?.status;
                                        let isGhost = false;

                                        if (!status) {
                                            if (!isFuture) {
                                                if (isSunday) {
                                                    status = 'H' as any;
                                                    isGhost = true;
                                                } else {
                                                    status = 'P' as any;
                                                    isGhost = true;
                                                }
                                            } else {
                                                status = '-' as any;
                                            }
                                        }
                                        
                                        let bgClass = 'bg-slate-50 text-slate-400';
                                        if (status === 'P') bgClass = isGhost ? 'bg-emerald-50 text-emerald-600/70 border border-emerald-100' : 'bg-emerald-100 text-emerald-700';
                                        if (status === 'A') bgClass = 'bg-red-100 text-red-700';
                                        if (status === 'HD') bgClass = 'bg-amber-100 text-amber-700';
                                        if (status === 'H') bgClass = 'bg-indigo-50 text-indigo-600';
                                        if (status === 'PL' || status === 'SL') bgClass = 'bg-blue-100 text-blue-700';
                                        
                                        return (
                                            <td key={d} className="px-1 py-1 text-center">
                                                <button 
                                                    className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] ${bgClass} hover:ring-2 ring-blue-300 transition-all`}
                                                    onClick={() => {
                                                        let nextStatus = 'P';
                                                        if (isGhost) {
                                                            // If clicking a Default P, user likely wants to mark Absent
                                                            if (status === 'P') nextStatus = 'A';
                                                            else if (status === 'H') nextStatus = 'P'; // On Sunday, toggle to P
                                                        } else {
                                                            // Standard Cycle
                                                            if (status === 'P') nextStatus = 'A';
                                                            else if (status === 'A') nextStatus = 'HD';
                                                            else if (status === 'HD') nextStatus = 'PL';
                                                            else if (status === 'PL') nextStatus = 'SL';
                                                            else if (status === 'SL') nextStatus = 'H';
                                                            else if (status === 'H') nextStatus = 'P';
                                                        }
                                                        handleMark(emp.id, d, nextStatus as any);
                                                    }}
                                                >
                                                    {status}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const PayrollManager = () => {
        const [payMonth, setPayMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
        const [sourceAccount, setSourceAccount] = useState('');

        const payrollData = useMemo(() => {
            const [year, month] = payMonth.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            
            return state.employees.filter(e => e.status === 'Active').map(emp => {
                // Calculate Days
                const records = state.attendance.filter(a => a.employeeId === emp.id && a.date.startsWith(payMonth));
                const absentDays = records.filter(a => a.status === 'A').length;
                const halfDays = records.filter(a => a.status === 'HD').length;
                const paidDays = daysInMonth - absentDays - (halfDays * 0.5); // Simplified logic
                
                const dailyRate = emp.basicSalary / 30;
                const earned = dailyRate * paidDays;
                
                // Deductions (Already factored into earned, but let's show them)
                const deductionAmount = (absentDays + (halfDays * 0.5)) * dailyRate;
                
                const isPaid = state.salaryPayments.some(p => p.employeeId === emp.id && p.monthYear === payMonth);

                return {
                    emp,
                    basic: emp.basicSalary,
                    days: paidDays,
                    deductions: deductionAmount,
                    advances: emp.advancesBalance, // Full recovery? Or partial? Let's assume user enters
                    netPayable: Math.max(0, earned - Math.min(earned * 0.5, emp.advancesBalance)), // Cap deduction at 50%
                    isPaid
                };
            });
        }, [state.employees, state.attendance, state.salaryPayments, payMonth]);

        const handlePay = (row: any) => {
            if (!sourceAccount) { alert('Select Source Account first'); return; }
            if (row.isPaid) return;

            const payment: SalaryPayment = {
                id: Math.random().toString(),
                employeeId: row.emp.id,
                paymentDate: new Date().toISOString().split('T')[0],
                monthYear: payMonth,
                basicSalary: row.basic,
                payableDays: row.days,
                deductions: row.deductions,
                advancesDeducted: Math.min(row.netPayable * 0.5, row.emp.advancesBalance), // Deduct max 50%
                netPaid: row.netPayable,
                paymentMethod: 'Cash',
                voucherId: `PV-PAY-${Math.random().toString().substr(2, 6)}`
            };
            
            processPayroll(payment, sourceAccount);
            alert(`Paid ${row.emp.name}`);
        };

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-bold text-slate-600">Payroll Month</label>
                        <input type="month" className="border border-slate-300 rounded p-2 bg-slate-50 text-slate-800" value={payMonth} onChange={e => setPayMonth(e.target.value)} />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-bold text-slate-600">Pay From</label>
                        <EntitySelector 
                            entities={state.accounts.filter(a => a.type === 'ASSET' && (a.name.includes('Cash') || a.name.includes('Bank')))} 
                            selectedId={sourceAccount} 
                            onSelect={setSourceAccount} 
                            placeholder="Select Cash/Bank..."
                        />
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4 text-right">Basic</th>
                                <th className="px-6 py-4 text-center">Paid Days</th>
                                <th className="px-6 py-4 text-right text-red-500">Absence Ded.</th>
                                <th className="px-6 py-4 text-right text-amber-600">Advance Bal</th>
                                <th className="px-6 py-4 text-right">Net Payable</th>
                                <th className="px-6 py-4 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {payrollData.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 font-medium text-slate-800">{row.emp.name}</td>
                                    <td className="px-6 py-4 text-right">${row.basic.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center">{row.days.toFixed(1)}</td>
                                    <td className="px-6 py-4 text-right text-red-500">-${row.deductions.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-right text-amber-600">${row.emp.advancesBalance.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-emerald-700">${row.netPayable.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                    <td className="px-6 py-4 text-center">
                                        {row.isPaid ? (
                                            <span className="text-emerald-600 font-bold text-xs flex items-center justify-center gap-1"><CheckSquare size={14}/> Paid</span>
                                        ) : (
                                            <button onClick={() => handlePay(row)} disabled={!sourceAccount} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700 disabled:bg-slate-300">
                                                Pay Now
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const TaskManager = () => {
        const [newTask, setNewTask] = useState('');
        
        const handleAdd = () => {
            if (!newTask) return;
            const t: Task = { id: Math.random().toString(), description: newTask, createdDate: new Date().toISOString().split('T')[0], isDone: false, status: 'Pending' };
            addTask(t);
            setNewTask('');
        };

        const toggle = (task: Task) => {
            updateTask({ ...task, isDone: !task.isDone, status: !task.isDone ? 'Completed' : 'Pending' });
        };

        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex gap-2">
                    <input type="text" className="flex-1 border border-slate-300 rounded-lg p-2 bg-white text-slate-800" placeholder="New Task..." value={newTask} onChange={e => setNewTask(e.target.value)} />
                    <button onClick={handleAdd} className="bg-blue-600 text-white px-6 rounded-lg font-bold">Add</button>
                </div>
                <div className="space-y-2">
                    {state.tasks.sort((a,b) => (a.isDone === b.isDone) ? 0 : a.isDone ? 1 : -1).map(task => (
                        <div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg border ${task.isDone ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                            <button onClick={() => toggle(task)} className={`w-5 h-5 rounded border flex items-center justify-center ${task.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                {task.isDone && <CheckSquare size={14} />}
                            </button>
                            <span className={`flex-1 ${task.isDone ? 'line-through text-slate-500' : 'text-slate-800'}`}>{task.description}</span>
                            <span className="text-xs text-slate-400">{task.createdDate}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const VehicleManager = () => {
        const [showFineModal, setShowFineModal] = useState<string | null>(null);
        const [fineType, setFineType] = useState('');
        const [fineAmount, setFineAmount] = useState('');
        const [fineEmp, setFineEmp] = useState('');

        const handleAddFine = () => {
            if (!showFineModal || !fineAmount || !fineEmp) return;
            addVehicleFine(showFineModal, fineType || 'Fine', parseFloat(fineAmount), fineEmp);
            setShowFineModal(null); setFineType(''); setFineAmount('');
        };

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {state.vehicles.map(v => (
                        <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Truck size={24} /></div>
                                <span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{v.status}</span>
                            </div>
                            <h3 className="font-bold text-lg text-slate-800">{v.plateNumber}</h3>
                            <p className="text-sm text-slate-500 mb-4">{v.model}</p>
                            
                            <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
                                <div className="flex justify-between"><span className="text-slate-500">Registration Exp:</span><span className="font-medium text-red-600">{v.registrationExpiry}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">Driver:</span><span className="font-medium text-slate-800">{state.employees.find(e => e.id === v.assignedToEmployeeId)?.name || 'Unassigned'}</span></div>
                            </div>

                            <button onClick={() => { setShowFineModal(v.id); setFineEmp(v.assignedToEmployeeId || ''); }} className="w-full mt-4 bg-slate-50 text-red-600 border border-red-100 py-2 rounded-lg text-sm font-bold hover:bg-red-50 flex items-center justify-center gap-2">
                                <AlertTriangle size={16} /> Add Fine / Charge
                            </button>
                        </div>
                    ))}
                </div>

                {showFineModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
                            <h3 className="font-bold text-lg text-slate-800 mb-4">Add Vehicle Charge</h3>
                            <div className="space-y-3">
                                <div><label className="text-xs font-bold text-slate-500">Type</label><input type="text" className="w-full border p-2 rounded bg-white text-slate-800" placeholder="Speeding Fine" value={fineType} onChange={e => setFineType(e.target.value)} /></div>
                                <div><label className="text-xs font-bold text-slate-500">Amount (USD)</label><input type="number" className="w-full border p-2 rounded bg-white text-slate-800" value={fineAmount} onChange={e => setFineAmount(e.target.value)} /></div>
                                <div><label className="text-xs font-bold text-slate-500">Charge To Employee</label><EntitySelector entities={state.employees} selectedId={fineEmp} onSelect={setFineEmp} /></div>
                                <button onClick={handleAddFine} className="w-full bg-red-600 text-white font-bold py-2 rounded">Save & Charge Employee</button>
                                <button onClick={() => setShowFineModal(null)} className="w-full text-slate-500 py-2 text-sm">Cancel</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // --- MAIN RENDER ---
    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">HR Management</h1>
                    <p className="text-slate-500">Employees, Payroll, and Fleet</p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
                    {[
                        { id: 'employees', icon: Users, label: 'Employees' },
                        { id: 'attendance', icon: Calendar, label: 'Attendance' },
                        { id: 'payroll', icon: DollarSign, label: 'Payroll' },
                        { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
                        { id: 'vehicles', icon: Truck, label: 'Fleet' }
                    ].map(tab => (
                        <button 
                            key={tab.id} 
                            onClick={() => setActiveTab(tab.id as HrTab)}
                            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="animate-in fade-in duration-300">
                {activeTab === 'employees' && <EmployeeManager />}
                {activeTab === 'attendance' && <AttendanceManager />}
                {activeTab === 'payroll' && <PayrollManager />}
                {activeTab === 'tasks' && <TaskManager />}
                {activeTab === 'vehicles' && <VehicleManager />}
            </div>
        </div>
    );
};
