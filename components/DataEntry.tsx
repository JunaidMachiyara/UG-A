
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useLocation, Link } from 'react-router-dom';
import { OriginalOpening, ProductionEntry, PackingType, Purchase, Currency, TransactionType, PurchaseAdditionalCost, PartnerType, BundlePurchaseItem, BundlePurchase, SalesInvoice, SalesInvoiceItem, InvoiceAdditionalCost, OngoingOrder, OngoingOrderItem, PurchaseOriginalItem } from '../types';
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from '../constants';
import { EntitySelector } from './EntitySelector';
import { useSetupConfigs, QuickAddModal, CrudConfig } from './Setup';
import Papa from 'papaparse';
import { 
    Package, 
    Truck, 
    ShoppingCart, 
    Factory, 
    FileText, 
    ArrowRight, 
    Clipboard, 
    Container, 
    Layers,
    Box,
    Plus,
    AlertCircle,
    History,
    Save,
    Trash2,
    X,
    CheckCircle,
    ArrowLeftRight,
    RefreshCw,
    DollarSign,
    Anchor,
    Printer,
    Download,
    ChevronDown,
    Search,
    Edit2,
    Eye,
    TrendingUp,
    List,
    Archive
} from 'lucide-react';

type ModuleType = 'production' | 'purchase' | 'sales';

// Supervisor PIN for secure actions
const SUPERVISOR_PIN = '7860';

export const DataEntry: React.FC = () => {
    const { state, addItem, updateStock, addOriginalOpening, deleteOriginalOpening, addProduction, deleteProduction, deleteProductionsByDate, postBaleOpening, addPurchase, updatePurchase, addBundlePurchase, addSalesInvoice, updateSalesInvoice, deleteEntity, addDirectSale, addOngoingOrder, processOrderShipment, postSalesInvoice } = useData();
    const location = useLocation();
    const setupConfigs = useSetupConfigs();
    
    // Item formatter for dropdowns: "Code - Name - Category - Package Size"
    const formatItemOption = (item: any) => {
        const categoryName = state.categories.find(c => c.id === item.category)?.name || item.category;
        return `${item.code} - ${item.name} - ${categoryName} - ${item.weightPerUnit}kg ${item.packingType}`;
    };
    
    const formatItemSelected = (item: any) => {
        return `${item.code} - ${item.name} - ${item.weightPerUnit}kg ${item.packingType}`;
    };
    
    // Helper function to get the next available serial number for an item
    const getNextSerialNumber = (itemId: string): number => {
        // Check tempSerialTracker first (for current session)
        if (tempSerialTracker[itemId]) {
            return tempSerialTracker[itemId];
        }
        
        // Find the highest serial number used in ALL productions for this item
        const itemProductions = state.productions.filter(p => p.itemId === itemId && p.serialEnd);
        if (itemProductions.length > 0) {
            const maxSerial = Math.max(...itemProductions.map(p => p.serialEnd || 0));
            return maxSerial + 1;
        }
        
        // Fall back to item's nextSerial or 1
        const item = state.items.find(i => i.id === itemId);
        return item?.nextSerial || 1;
    };
    
    // --- Quick Add State ---
    const [quickAddConfig, setQuickAddConfig] = useState<CrudConfig | null>(null);
    const [quickAddDefaults, setQuickAddDefaults] = useState<any>(null);
    const [showQuickAddModal, setShowQuickAddModal] = useState(false);

    // --- Auth Modal State ---
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authPin, setAuthPin] = useState('');
    const [pendingPurchaseAction, setPendingPurchaseAction] = useState<{ type: 'DELETE' | 'EDIT', purchaseId: string } | null>(null);

    // Helper to open Quick Add Modal
    const openQuickAdd = (config: CrudConfig, defaults?: any) => {
        setQuickAddConfig(config);
        setQuickAddDefaults(defaults);
        setShowQuickAddModal(true);
    };

    const getQuickAddData = () => {
        if (!quickAddConfig) return [];
        return (state as any)[quickAddConfig.entityKey] || [];
    };

    const [activeModule, setActiveModule] = useState<ModuleType>('production');
    const [activeSubModule, setActiveSubModule] = useState<string>('original-opening');

    // --- Configurations ---
    const getSubModules = (module: ModuleType) => {
        switch (module) {
            case 'production':
                return [
                    { id: 'original-opening', label: 'Original Opening', icon: Package, desc: 'Consume raw material batches' },
                    { id: 'fg-production', label: 'Finished Goods Production', icon: Factory, desc: 'Record output of graded items' },
                    { id: 'produced-production', label: 'Produced Production', icon: Layers, desc: 'View produced entries with filters' },
                    { id: 're-baling', label: 'Re-baling', icon: ArrowLeftRight, desc: 'Convert loose stock or re-process items' }
                ];
            case 'purchase':
                return [
                    { id: 'original-purchase', label: 'Original Purchase', icon: Box, desc: 'Buy raw material batches' },
                    { id: 'bundle-purchase', label: 'Bundle Purchase', icon: Layers, desc: 'Buy pre-sorted finished goods (Stock Lots)' }
                ];
            case 'sales':
                return [
                    { id: 'sales-invoice', label: 'Sales Invoices', icon: FileText, desc: 'Create invoices for customers' },
                    { id: 'direct-sales', label: 'Direct Sales', icon: Truck, desc: 'Sell raw material directly' },
                    { id: 'ongoing-orders', label: 'Ongoing Orders', icon: Clipboard, desc: 'Manage long-term orders' }
                ];
            default: return [];
        }
    };

    // --- Original Opening State ---
    const [ooTab, setOoTab] = useState<'supplier' | 'bales'>('supplier');
    const [ooDate, setOoDate] = useState(new Date().toISOString().split('T')[0]);
    const [ooSupplier, setOoSupplier] = useState('');
    const [ooType, setOoType] = useState(''); // Stores originalTypeId
    const [ooProduct, setOoProduct] = useState(''); // Stores originalProductId
    const [ooBatch, setOoBatch] = useState('');
    const [ooQty, setOoQty] = useState('');
    const [stagedOriginalOpenings, setStagedOriginalOpenings] = useState<OriginalOpening[]>([]);
    const [isProcessingOpenings, setIsProcessingOpenings] = useState(false);
    const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });

    // --- Bales Opening State ---
    const [boDate, setBoDate] = useState(new Date().toISOString().split('T')[0]);
    const [boItemId, setBoItemId] = useState('');
    const [boQty, setBoQty] = useState('');
    const [stagedBaleOpenings, setStagedBaleOpenings] = useState<{ id: string, itemId: string, itemName: string, qty: number, weight: number }[]>([]);
    
    // --- Production State ---
    const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0]);
    const [prodItemId, setProdItemId] = useState('');
    const [prodQty, setProdQty] = useState('');
    const [prodAvgCost, setProdAvgCost] = useState('');
    const [stagedProds, setStagedProds] = useState<ProductionEntry[]>([]);
    const [showProdSummary, setShowProdSummary] = useState(false);
    const [tempSerialTracker, setTempSerialTracker] = useState<Record<string, number>>({});
    const [isProcessingProduction, setIsProcessingProduction] = useState(false);
    
    // Auto-populate AvgCost when item is selected
    useEffect(() => {
        if (prodItemId) {
            const item = state.items.find(i => i.id === prodItemId);
            if (item && item.avgCost !== undefined && item.avgCost !== null) {
                setProdAvgCost(item.avgCost.toString());
            } else {
                setProdAvgCost('');
            }
        } else {
            setProdAvgCost('');
        }
    }, [prodItemId, state.items]);

    // --- Re-baling State ---
    const [rbDate, setRbDate] = useState(new Date().toISOString().split('T')[0]);
    const [rbConsumeId, setRbConsumeId] = useState('');
    const [rbConsumeQty, setRbConsumeQty] = useState('');
    const [rbProduceId, setRbProduceId] = useState('');
    const [rbProduceQty, setRbProduceQty] = useState('');
    const [rbConsumeList, setRbConsumeList] = useState<any[]>([]);
    const [rbProduceList, setRbProduceList] = useState<any[]>([]);

    // --- Original Purchase State ---
    const [purMode, setPurMode] = useState<'create' | 'manage'>('create');
    const [purEditingId, setPurEditingId] = useState<string | null>(null);
    const [purDate, setPurDate] = useState(new Date().toISOString().split('T')[0]);
    const [purBatch, setPurBatch] = useState('11001'); // Auto-populated
    const [purSupplier, setPurSupplier] = useState('');
    const [purCurrency, setPurCurrency] = useState<Currency>('USD');
    const [purExchangeRate, setPurExchangeRate] = useState<number>(1);
    
    // NEW: Multi-Original Type Cart
    const [purOriginalTypeId, setPurOriginalTypeId] = useState('');
    const [purSubSupplierId, setPurSubSupplierId] = useState('');
    const [purOriginalProductId, setPurOriginalProductId] = useState('');
    const [purWeight, setPurWeight] = useState('');
    const [purPrice, setPurPrice] = useState(''); // Gross Price per Kg
    const [purItemDiscount, setPurItemDiscount] = useState(''); // Discount for this item
    const [purItemSurcharge, setPurItemSurcharge] = useState(''); // Surcharge for this item
    const [purCart, setPurCart] = useState<PurchaseOriginalItem[]>([]); // Cart of original types
    
    // Logistics
    const [purContainer, setPurContainer] = useState('');
    const [purDivision, setPurDivision] = useState('');
    const [purSubDivision, setPurSubDivision] = useState('');

    // --- Bundle Purchase State ---
    const [bpDate, setBpDate] = useState(new Date().toISOString().split('T')[0]);
    const [bpBatch, setBpBatch] = useState('101'); // Shorter sequence for Bundles
    const [bpSupplier, setBpSupplier] = useState('');
    const [bpCurrency, setBpCurrency] = useState<Currency>('USD');
    const [bpExchangeRate, setBpExchangeRate] = useState<number>(1);
    const [bpContainer, setBpContainer] = useState('');
    const [bpDivision, setBpDivision] = useState('');
    const [bpSubDivision, setBpSubDivision] = useState('');
    
    // BP Item Cart
    const [bpItemId, setBpItemId] = useState('');
    const [bpItemQty, setBpItemQty] = useState('');
    const [bpItemRate, setBpItemRate] = useState('');
    const [bpCart, setBpCart] = useState<BundlePurchaseItem[]>([]);

    // --- Sales Invoice State ---
    const [siMode, setSiMode] = useState<'create' | 'view'>('create');
    // Sales Invoice View/Update Filters
    const [siFilterDate, setSiFilterDate] = useState('');
    const [siFilterCustomer, setSiFilterCustomer] = useState('');
    const [siId, setSiId] = useState(''); // Internal ID for editing
    const [siInvoiceNo, setSiInvoiceNo] = useState('SINV-1001');
    const [siDate, setSiDate] = useState(new Date().toISOString().split('T')[0]);
    const [siCustomer, setSiCustomer] = useState('');
    const [siLogo, setSiLogo] = useState('');
    const [siColor, setSiColor] = useState('');
    const [siCurrency, setSiCurrency] = useState<Currency>('USD');
    const [siExchangeRate, setSiExchangeRate] = useState<number>(1);
    const [siRateCurrency, setSiRateCurrency] = useState<'customer' | 'base'>('base'); // Toggle: enter rate in customer currency or base currency (USD)
    
    // SI Logistics
    const [siContainer, setSiContainer] = useState('');
    const [siDivision, setSiDivision] = useState('');
    const [siSubDivision, setSiSubDivision] = useState('');
    const [siPortOfDestination, setSiPortOfDestination] = useState('');
    const [siDiscount, setSiDiscount] = useState('');
    const [siSurcharge, setSiSurcharge] = useState('');

    // SI Cart
    const [siItemId, setSiItemId] = useState('');
    const [siItemQty, setSiItemQty] = useState('');
    const [siItemRate, setSiItemRate] = useState('');
    const [siCart, setSiCart] = useState<SalesInvoiceItem[]>([]);
    
    // SI Additional Costs
    const [siCosts, setSiCosts] = useState<InvoiceAdditionalCost[]>([]);
    const [siCostType, setSiCostType] = useState<any>('Freight');
    const [siCostProvider, setSiCostProvider] = useState('');
    const [siCostCustomName, setSiCostCustomName] = useState(''); // Text input for Custom/Other
    const [siCostAmount, setSiCostAmount] = useState('');
    const [siCostCurrency, setSiCostCurrency] = useState<Currency>('USD');
    const [siCostRate, setSiCostRate] = useState(1);

    const [showSiSummary, setShowSiSummary] = useState(false);

    // --- Direct Sales State ---
        // --- Produced Production Report State ---
        const [prodReportStart, setProdReportStart] = useState(new Date().toISOString().split('T')[0]);
        const [prodReportEnd, setProdReportEnd] = useState(new Date().toISOString().split('T')[0]);
        const [prodReportCategory, setProdReportCategory] = useState('');
        const [prodReportItem, setProdReportItem] = useState('');
        const [prodReportSort, setProdReportSort] = useState({ col: 'Timestamp', asc: false });
        const [deleteProdDate, setDeleteProdDate] = useState('');
        const [isDeletingProductions, setIsDeletingProductions] = useState(false);
        const [showDeleteProdUtility, setShowDeleteProdUtility] = useState(false);

        // Helper function to normalize date to YYYY-MM-DD (local timezone)
        const normalizeDate = (dateStr: string): string => {
            if (!dateStr) return '';
            // If already in YYYY-MM-DD format, use as-is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }
            // Parse and convert to YYYY-MM-DD using local timezone
            const dateObj = new Date(dateStr);
            if (!isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            return dateStr; // Return as-is if parsing fails
        };

        // Filter and sort produced entries
        const filteredProducedEntries = useMemo(() => {
            let entries = state.productions.filter(p => {
                // Exclude re-baling entries and entries with qtyProduced <= 0
                if (p.isRebaling || p.qtyProduced <= 0) return false;
                
                // Use production date (p.date) for filtering, not createdAt timestamp
                let entryDateStr = '';
                if (p.date) {
                    entryDateStr = normalizeDate(p.date);
                } else {
                    // Fallback to createdAt if date is missing (shouldn't happen)
                    if (p.createdAt?.seconds) {
                        const dateObj = new Date(p.createdAt.seconds * 1000);
                        const year = dateObj.getFullYear();
                        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                        const day = String(dateObj.getDate()).padStart(2, '0');
                        entryDateStr = `${year}-${month}-${day}`;
                    } else {
                        return false;
                    }
                }
                
                // Normalize filter dates to YYYY-MM-DD format
                const startDateStr = normalizeDate(prodReportStart);
                const endDateStr = normalizeDate(prodReportEnd);
                
                // Compare as strings (YYYY-MM-DD format)
                const matchesDate = entryDateStr >= startDateStr && entryDateStr <= endDateStr;
                const matchesItem = prodReportItem === '' || p.itemId === prodReportItem;
                const matchesCategory = prodReportCategory === '' || (() => {
                    const item = state.items.find(i => i.id === p.itemId);
                    // If item not found, exclude it when category filter is active (can't determine category)
                    if (!item) return false;
                    // If item has no category set, exclude it when category filter is active
                    if (!item.category) return false;
                    // Get the selected category
                    const selectedCategory = state.categories.find(c => c.id === prodReportCategory);
                    if (!selectedCategory) return false; // Selected category not found
                    // Get the item's category object (might be stored as ID or name)
                    const itemCategoryObj = state.categories.find(c => c.id === item.category || c.name === item.category);
                    // Match by:
                    // 1. Direct ID match: item.category === prodReportCategory
                    // 2. Item has category name that matches selected category name
                    // 3. Item has category ID that maps to same category as selected
                    // 4. Item has category name that matches selected category ID (unlikely but possible)
                    return item.category === prodReportCategory || 
                           item.category === selectedCategory.name ||
                           item.category === selectedCategory.id ||
                           (itemCategoryObj && itemCategoryObj.id === prodReportCategory) ||
                           (itemCategoryObj && itemCategoryObj.name === selectedCategory.name);
                })();
                return matchesDate && matchesItem && matchesCategory;
            });
            if (prodReportSort.col) {
                entries = [...entries].sort((a, b) => {
                    let aVal, bVal;
                    switch (prodReportSort.col) {
                        case 'Item Code': aVal = state.items.find(i => i.id === a.itemId)?.code || ''; bVal = state.items.find(i => i.id === b.itemId)?.code || ''; break;
                        case 'Item': aVal = state.items.find(i => i.id === a.itemId)?.name || a.itemId; bVal = state.items.find(i => i.id === b.itemId)?.name || b.itemId; break;
                        case 'Category': {
                            const aItem = state.items.find(i => i.id === a.itemId);
                            const bItem = state.items.find(i => i.id === b.itemId);
                            aVal = aItem?.category ? (state.categories.find(c => c.id === aItem.category)?.name || aItem.category) : '';
                            bVal = bItem?.category ? (state.categories.find(c => c.id === bItem.category)?.name || bItem.category) : '';
                            break;
                        }
                        case 'Bale Size': aVal = state.items.find(i => i.id === a.itemId)?.packingType || ''; bVal = state.items.find(i => i.id === b.itemId)?.packingType || ''; break;
                        case 'Qty': aVal = a.qtyProduced; bVal = b.qtyProduced; break;
                        case 'Weight': aVal = a.weightProduced; bVal = b.weightProduced; break;
                        case 'Avg. Prod. Price': aVal = state.items.find(i => i.id === a.itemId)?.avgProdPrice || 0; bVal = state.items.find(i => i.id === b.itemId)?.avgProdPrice || 0; break;
                        case 'Total': aVal = state.items.find(i => i.id === a.itemId)?.avgProdPrice * a.qtyProduced || 0; bVal = state.items.find(i => i.id === b.itemId)?.avgProdPrice * b.qtyProduced || 0; break;
                        case 'Timestamp': aVal = a.createdAt?.seconds || new Date(a.date).getTime() / 1000; bVal = b.createdAt?.seconds || new Date(b.date).getTime() / 1000; break;
                        default: aVal = ''; bVal = ''; break;
                    }
                    if (aVal < bVal) return prodReportSort.asc ? -1 : 1;
                    if (aVal > bVal) return prodReportSort.asc ? 1 : -1;
                    return 0;
                });
            }
            return entries;
        }, [state.productions, prodReportStart, prodReportEnd, prodReportCategory, prodReportItem, prodReportSort, state.items, state.categories]);

        const handleProdReportSort = (col: string) => {
            setProdReportSort(prev => ({ col, asc: prev.col === col ? !prev.asc : true }));
        };
    const [dsMode, setDsMode] = useState<'create' | 'view'>('create');
    const [dsDate, setDsDate] = useState(new Date().toISOString().split('T')[0]);
    const [dsCustomer, setDsCustomer] = useState('');
    const [dsSupplier, setDsSupplier] = useState('');
    const [dsPurchaseId, setDsPurchaseId] = useState(''); // Selected Batch ID (Original Purchase)
    const [dsQty, setDsQty] = useState(''); // Kg
    const [dsRate, setDsRate] = useState(''); // Per Kg
    const [dsCurrency, setDsCurrency] = useState<Currency>('USD');
    const [dsExchangeRate, setDsExchangeRate] = useState<number>(1);

    // --- Ongoing Orders State ---
    const [ooView, setOoView] = useState<'create' | 'list'>('create');
    const [ooNewOrderNo, setOoNewOrderNo] = useState('OO-1002');
    const [ooNewDate, setOoNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [ooNewCustomer, setOoNewCustomer] = useState('');
    const [ooNewItemId, setOoNewItemId] = useState('');
    const [ooNewItemQty, setOoNewItemQty] = useState('');
    const [ooNewCart, setOoNewCart] = useState<OngoingOrderItem[]>([]);
    
    const [ooFilterStatus, setOoFilterStatus] = useState<string>('All');
    const [shipmentModalOrder, setShipmentModalOrder] = useState<OngoingOrder | null>(null);
    const [shipmentQtys, setShipmentQtys] = useState<Record<string, number>>({}); // itemId -> qty

    // Additional Costs State (Shared Purchase)
    const [additionalCosts, setAdditionalCosts] = useState<PurchaseAdditionalCost[]>([]);
    const [acType, setAcType] = useState<'Freight'|'Clearing'|'Commission'|'Other'>('Freight');
    const [acProvider, setAcProvider] = useState('');
    const [acCustomName, setAcCustomName] = useState(''); // For 'Other' charge type - custom name/description
    const [acCurrency, setAcCurrency] = useState<Currency>('USD');
    const [acExchangeRate, setAcExchangeRate] = useState<number>(1);
    const [acAmount, setAcAmount] = useState('');

    // Purchase Summary/Print Modal
    const [showPurSummary, setShowPurSummary] = useState(false);
    const [purPrinted, setPurPrinted] = useState(false);
    const printableRef = useRef<HTMLDivElement>(null);

    // Auto-populate Batch Number based on history
    useEffect(() => {
        if (activeSubModule === 'original-purchase') {
            const maxBatch = state.purchases
                .map(p => parseInt(p.batchNumber))
                .filter(n => !isNaN(n))
                .reduce((max, curr) => curr > max ? curr : max, 11000);
            setPurBatch((maxBatch + 1).toString());
        } else if (activeSubModule === 'bundle-purchase') {
             const maxBatch = state.bundlePurchases
                .map(p => parseInt(p.batchNumber))
                .filter(n => !isNaN(n))
                .reduce((max, curr) => curr > max ? curr : max, 100);
            setBpBatch((maxBatch + 1).toString());
        } else if (activeSubModule === 'sales-invoice' && siMode === 'create') {
            // Find the highest invoice number and add 1
            const invoiceNumbers = state.salesInvoices
                .map(i => {
                    const match = i.invoiceNo.match(/SINV-(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                })
                .filter(n => !isNaN(n) && n > 0);
            const maxInv = invoiceNumbers.length > 0 ? Math.max(...invoiceNumbers) : 1000;
            setSiInvoiceNo(`SINV-${maxInv + 1}`);
        } else if (activeSubModule === 'ongoing-orders' && ooView === 'create') {
            const maxOo = state.ongoingOrders
                .map(o => parseInt(o.orderNo.replace('OO-', '')))
                .filter(n => !isNaN(n))
                .reduce((max, curr) => curr > max ? curr : max, 1000);
            setOoNewOrderNo(`OO-${maxOo + 1}`);
        }
    }, [state.purchases, state.bundlePurchases, state.salesInvoices, state.ongoingOrders, activeSubModule, siMode, ooView]);

    // Auto-update Currency/Rate when Supplier changes (Original Purchase)
    useEffect(() => {
        if (purSupplier) {
            const p = state.partners.find(x => x.id === purSupplier);
            if (p?.defaultCurrency) setPurCurrency(p.defaultCurrency);
        }
    }, [purSupplier, state.partners]);

    // Auto-update Currency/Rate when Supplier changes (Bundle Purchase)
    useEffect(() => {
        if (bpSupplier) {
            const p = state.partners.find(x => x.id === bpSupplier);
            if (p?.defaultCurrency) setBpCurrency(p.defaultCurrency);
        }
    }, [bpSupplier, state.partners]);
    
    // Auto-Update Customer Details (Sales Invoice)
    useEffect(() => {
        if (siCustomer) {
            const p = state.partners.find(x => x.id === siCustomer);
            if (p && p.defaultCurrency) {
                setSiCurrency(p.defaultCurrency);
                // Immediately update exchange rate when customer currency is set
                const currencyData = state.currencies.find(c => c.code === p.defaultCurrency);
                if (currencyData && currencyData.exchangeRate) {
                    console.log(`💱 Sales Invoice: Updated exchange rate for ${p.defaultCurrency} from Setup:`, currencyData.exchangeRate);
                    setSiExchangeRate(currencyData.exchangeRate);
                } else {
                    // Fallback to constant if not found in state
                    const fallbackRate = EXCHANGE_RATES[p.defaultCurrency] || 1;
                    console.warn(`⚠️ Sales Invoice: Currency ${p.defaultCurrency} not found in state.currencies, using fallback rate:`, fallbackRate);
                    setSiExchangeRate(fallbackRate);
                }
                if (p.divisionId) setSiDivision(p.divisionId);
                if (p.subDivisionId) setSiSubDivision(p.subDivisionId);
            }
        }
    }, [siCustomer, state.partners, state.currencies]);

    // Auto-Update Customer Details (Direct Sales)
    useEffect(() => {
        if (dsCustomer) {
            const p = state.partners.find(x => x.id === dsCustomer);
            if (p?.defaultCurrency) setDsCurrency(p.defaultCurrency);
        }
    }, [dsCustomer, state.partners]);

    // Update rate when currency changes manually - Use rates from Setup (state.currencies) not hardcoded constants
    useEffect(() => {
        // Get exchange rate from state.currencies (updated in Setup) or fallback to constant
        const getExchangeRate = (currency: Currency): number => {
            const currencyData = state.currencies.find(c => c.code === currency);
            if (currencyData && currencyData.exchangeRate) {
                return currencyData.exchangeRate;
            }
            // Fallback to constant if not found in state
            return EXCHANGE_RATES[currency] || 1;
        };
        
        setPurExchangeRate(getExchangeRate(purCurrency));
        setBpExchangeRate(getExchangeRate(bpCurrency));
        setAcExchangeRate(getExchangeRate(acCurrency));
        setSiExchangeRate(getExchangeRate(siCurrency));
        setSiCostRate(getExchangeRate(siCostCurrency));
        setDsExchangeRate(getExchangeRate(dsCurrency));
    }, [purCurrency, bpCurrency, acCurrency, siCurrency, siCostCurrency, dsCurrency, state.currencies]);

    // Derived Lists for Purchase Form
    const filteredProducts = useMemo(() => {
        return state.originalProducts.filter(p => p.originalTypeId === purOriginalTypeId);
    }, [purOriginalTypeId, state.originalProducts]);
    
    // --- Purchase Cart Functions ---
    const handleAddToPurCart = () => {
        if (!purOriginalTypeId || !purWeight || !purPrice) {
            alert('Please fill in Original Type, Weight, and Price');
            return;
        }
        
        const weight = parseFloat(purWeight);
        const grossPricePerKgFCY = parseFloat(purPrice);
        const discountPerKg = purItemDiscount ? parseFloat(purItemDiscount) : 0;
        const surchargePerKg = purItemSurcharge ? parseFloat(purItemSurcharge) : 0;
        
        if (weight <= 0 || grossPricePerKgFCY <= 0) {
            alert('Weight and Price must be greater than 0');
            return;
        }
        
        const typeDef = state.originalTypes.find(t => t.id === purOriginalTypeId);
        const packingSize = typeDef ? typeDef.packingSize : 1;
        const calculatedQty = weight / packingSize;
        
        const netPricePerKgFCY = grossPricePerKgFCY - discountPerKg + surchargePerKg;
        const totalCostFCY = weight * netPricePerKgFCY;
        const totalCostUSD = totalCostFCY / purExchangeRate;
        
        const typeName = state.originalTypes.find(t => t.id === purOriginalTypeId)?.name || 'Unknown';
        const productName = state.originalProducts.find(p => p.id === purOriginalProductId)?.name;
        const finalName = productName ? `${typeName} - ${productName}` : typeName;
        
        const newItem: PurchaseOriginalItem = {
            id: Math.random().toString(36).substr(2, 9),
            originalTypeId: purOriginalTypeId,
            originalType: finalName,
            originalProductId: purOriginalProductId || undefined,
            subSupplierId: purSubSupplierId || undefined, // Convert empty string to undefined
            weightPurchased: weight,
            qtyPurchased: calculatedQty,
            costPerKgFCY: grossPricePerKgFCY,
            discountPerKgFCY: discountPerKg,
            surchargePerKgFCY: surchargePerKg,
            totalCostFCY: totalCostFCY,
            totalCostUSD: totalCostUSD
        };
        
        setPurCart([...purCart, newItem]);
        
        // Clear item fields
        setPurOriginalTypeId('');
        setPurOriginalProductId('');
        setPurSubSupplierId('');
        setPurWeight('');
        setPurPrice('');
        setPurItemDiscount('');
        setPurItemSurcharge('');
    };
    
    const handleRemoveFromPurCart = (id: string) => {
        setPurCart(purCart.filter(item => item.id !== id));
    };
    
    // --- CSV Upload Handler for Original Purchase ---
    const handleOriginalPurchaseCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedItems: PurchaseOriginalItem[] = [];
                const errors: string[] = [];
                
                for (let idx = 0; idx < results.data.length; idx++) {
                    const row = results.data[idx] as any;
                    
                    // Validate required fields
                    if (!row['Original Type ID'] || !row['Weight (Kg)'] || !row['Price per Kg (USD)']) {
                        errors.push(`Row ${idx + 2}: Missing required fields (Original Type ID, Weight (Kg), or Price per Kg (USD))`);
                        continue;
                    }
                    
                    // Find original type by ID or name
                    const originalType = state.originalTypes.find(ot => 
                        ot.id === row['Original Type ID'] || 
                        ot.name === row['Original Type ID']
                    );
                    if (!originalType) {
                        errors.push(`Row ${idx + 2}: Original Type "${row['Original Type ID']}" not found`);
                        continue;
                    }
                    
                    // Find original product (optional)
                    let originalProduct: any = undefined;
                    if (row['Original Product ID'] && row['Original Product ID'].trim() !== '') {
                        originalProduct = state.originalProducts.find(op => 
                            op.id === row['Original Product ID'] || 
                            op.name === row['Original Product ID']
                        );
                        if (!originalProduct) {
                            errors.push(`Row ${idx + 2}: Original Product "${row['Original Product ID']}" not found (will be skipped)`);
                        } else if (originalProduct.originalTypeId !== originalType.id) {
                            errors.push(`Row ${idx + 2}: Original Product "${row['Original Product ID']}" does not belong to Original Type "${row['Original Type ID']}" (will be skipped)`);
                            originalProduct = undefined;
                        }
                    }
                    
                    // Find sub supplier (optional)
                    let subSupplier: any = undefined;
                    if (row['Sub Supplier ID'] && row['Sub Supplier ID'].trim() !== '') {
                        subSupplier = state.partners.find(p => 
                            (p.id === row['Sub Supplier ID'] || 
                             (p as any).code === row['Sub Supplier ID'] ||
                             p.name === row['Sub Supplier ID']) &&
                            p.type === PartnerType.SUB_SUPPLIER
                        );
                        if (!subSupplier) {
                            errors.push(`Row ${idx + 2}: Sub Supplier "${row['Sub Supplier ID']}" not found (will be skipped)`);
                        }
                    }
                    
                    // Validate weight
                    const weight = parseFloat(row['Weight (Kg)']);
                    if (isNaN(weight) || weight <= 0) {
                        errors.push(`Row ${idx + 2}: Invalid weight "${row['Weight (Kg)']}"`);
                        continue;
                    }
                    
                    // Validate price
                    const grossPricePerKgFCY = parseFloat(row['Price per Kg (USD)']);
                    if (isNaN(grossPricePerKgFCY) || grossPricePerKgFCY <= 0) {
                        errors.push(`Row ${idx + 2}: Invalid price "${row['Price per Kg (USD)']}"`);
                        continue;
                    }
                    
                    // Parse discount and surcharge (optional, default to 0)
                    const discountPerKg = row['Discount per Kg (USD)'] && row['Discount per Kg (USD)'].trim() !== '' 
                        ? parseFloat(row['Discount per Kg (USD)']) 
                        : 0;
                    const surchargePerKg = row['Surcharge per Kg (USD)'] && row['Surcharge per Kg (USD)'].trim() !== '' 
                        ? parseFloat(row['Surcharge per Kg (USD)']) 
                        : 0;
                    
                    if (isNaN(discountPerKg) || discountPerKg < 0) {
                        errors.push(`Row ${idx + 2}: Invalid discount "${row['Discount per Kg (USD)']}" (will use 0)`);
                    }
                    if (isNaN(surchargePerKg) || surchargePerKg < 0) {
                        errors.push(`Row ${idx + 2}: Invalid surcharge "${row['Surcharge per Kg (USD)']}" (will use 0)`);
                    }
                    
                    // Calculate quantity from weight and packing size
                    const packingSize = originalType.packingSize ? parseFloat(String(originalType.packingSize)) : 1;
                    const calculatedQty = weight / packingSize;
                    
                    // Calculate net price and totals
                    const netPricePerKgFCY = grossPricePerKgFCY - (isNaN(discountPerKg) ? 0 : discountPerKg) + (isNaN(surchargePerKg) ? 0 : surchargePerKg);
                    const totalCostFCY = weight * netPricePerKgFCY;
                    const totalCostUSD = totalCostFCY / purExchangeRate; // Use current exchange rate from form
                    
                    // Build type name
                    const typeName = originalType.name;
                    const productName = originalProduct?.name;
                    const finalName = productName ? `${typeName} - ${productName}` : typeName;
                    
                    // Update form state if Date, Supplier, Batch, Container, Division are provided in CSV
                    // Use first row's values if form fields are empty
                    if (idx === 0) {
                        if (row['Date'] && row['Date'].trim() !== '' && !purDate) {
                            let purchaseDate = row['Date'].trim();
                            // Handle different date formats
                            if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
                                const dateObj = new Date(purchaseDate);
                                if (!isNaN(dateObj.getTime())) {
                                    const year = dateObj.getFullYear();
                                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                    const day = String(dateObj.getDate()).padStart(2, '0');
                                    purchaseDate = `${year}-${month}-${day}`;
                                }
                            }
                            if (/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
                                setPurDate(purchaseDate);
                            }
                        }
                        
                        if (row['Supplier ID'] && row['Supplier ID'].trim() !== '' && !purSupplier) {
                            const supplier = state.partners.find(p => 
                                p.id === row['Supplier ID'] || 
                                (p as any).code === row['Supplier ID'] ||
                                p.name === row['Supplier ID']
                            );
                            if (supplier) {
                                setPurSupplier(supplier.id);
                            }
                        }
                        
                        if (row['Batch Number'] && row['Batch Number'].trim() !== '' && !purBatch) {
                            setPurBatch(row['Batch Number'].trim());
                        }
                        
                        if (row['Container Number'] && row['Container Number'].trim() !== '' && !purContainer) {
                            setPurContainer(row['Container Number'].trim());
                        }
                        
                        if (row['Division ID'] && row['Division ID'].trim() !== '' && !purDivision) {
                            const division = state.divisions.find(d => 
                                d.id === row['Division ID'] || 
                                (d as any).code === row['Division ID'] ||
                                d.name === row['Division ID']
                            );
                            if (division) {
                                setPurDivision(division.id);
                            }
                        }
                        
                        if (row['Sub Division ID'] && row['Sub Division ID'].trim() !== '' && !purSubDivision) {
                            const subDivision = state.subDivisions.find(sd => 
                                sd.id === row['Sub Division ID'] || 
                                (sd as any).code === row['Sub Division ID'] ||
                                sd.name === row['Sub Division ID']
                            );
                            if (subDivision) {
                                setPurSubDivision(subDivision.id);
                            }
                        }
                    }
                    
                    parsedItems.push({
                        id: Math.random().toString(36).substr(2, 9),
                        originalTypeId: originalType.id,
                        originalType: finalName,
                        originalProductId: originalProduct?.id || undefined,
                        subSupplierId: subSupplier?.id || undefined,
                        weightPurchased: weight,
                        qtyPurchased: calculatedQty,
                        costPerKgFCY: grossPricePerKgFCY,
                        discountPerKgFCY: isNaN(discountPerKg) ? 0 : discountPerKg,
                        surchargePerKgFCY: isNaN(surchargePerKg) ? 0 : surchargePerKg,
                        totalCostFCY: totalCostFCY,
                        totalCostUSD: totalCostUSD
                    });
                }
                
                if (errors.length > 0) {
                    alert(`CSV Upload Errors:\n${errors.join('\n')}\n\nOnly valid rows will be added.`);
                }
                
                if (parsedItems.length > 0) {
                    setPurCart([...purCart, ...parsedItems]);
                    alert(`Successfully loaded ${parsedItems.length} purchase item(s) from CSV.`);
                } else {
                    alert('No valid purchase items found in CSV.');
                }
            },
            error: (err) => {
                alert(`Error parsing CSV: ${err.message}`);
            }
        });
        
        // Reset file input
        e.target.value = '';
    };
    
    // Download CSV Template for Original Purchase
    const downloadOriginalPurchaseTemplate = () => {
        // Get sample data
        const sampleSupplier = state.partners.find(p => p.type === PartnerType.SUPPLIER);
        const sampleOriginalType = state.originalTypes[0];
        const sampleProduct = state.originalProducts.find(op => op.originalTypeId === sampleOriginalType?.id);
        const sampleSubSupplier = state.partners.find(p => p.type === PartnerType.SUB_SUPPLIER);
        const sampleDivision = state.divisions[0];
        const sampleSubDivision = state.subDivisions.find(sd => sd.divisionId === sampleDivision?.id);
        
        const template = [
            ['Date', 'Supplier ID', 'Original Type ID', 'Original Product ID', 'Sub Supplier ID', 'Weight (Kg)', 'Price per Kg (USD)', 'Discount per Kg (USD)', 'Surcharge per Kg (USD)', 'Batch Number', 'Container Number', 'Division ID', 'Sub Division ID'],
            [
                new Date().toISOString().split('T')[0],
                sampleSupplier?.id || sampleSupplier?.name || 'SUP-001',
                sampleOriginalType?.id || sampleOriginalType?.name || 'OT-001',
                sampleProduct?.id || sampleProduct?.name || 'OP-001',
                sampleSubSupplier?.id || sampleSubSupplier?.name || 'SUB-001',
                '10000',
                '2.50',
                '0.10',
                '0.05',
                'BATCH-001',
                'CONT-12345',
                sampleDivision?.id || sampleDivision?.name || 'DIV-001',
                sampleSubDivision?.id || sampleSubDivision?.name || 'SUBDIV-001'
            ],
            [
                new Date().toISOString().split('T')[0],
                sampleSupplier?.id || sampleSupplier?.name || 'SUP-001',
                sampleOriginalType?.id || sampleOriginalType?.name || 'OT-001',
                '', // Optional
                '', // Optional
                '5000',
                '3.00',
                '0.00',
                '0.00',
                'BATCH-002',
                'CONT-12346',
                sampleDivision?.id || sampleDivision?.name || 'DIV-001',
                '' // Optional
            ]
        ];
        
        // Convert to CSV string
        const csv = template.map(row => 
            row.map(cell => {
                const cellStr = String(cell || '');
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',')
        ).join('\n');
        
        // Create download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `original-purchase-template-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };
    
    const filteredProviders = useMemo(() => {
        let relevantTypes: PartnerType[] = [];
        if (acType === 'Freight') relevantTypes = [PartnerType.FREIGHT_FORWARDER];
        else if (acType === 'Clearing') relevantTypes = [PartnerType.CLEARING_AGENT];
        else if (acType === 'Commission') relevantTypes = [PartnerType.COMMISSION_AGENT];
        
        // Always include the Main Supplier as a possible provider
        const possibleProviders = state.partners.filter(p => relevantTypes.includes(p.type));
        
        // Add current supplier if selected
        const activeSupId = activeSubModule === 'original-purchase' ? purSupplier : bpSupplier;
        if (activeSupId) {
            const currentSup = state.partners.find(p => p.id === activeSupId);
            if (currentSup && !possibleProviders.find(p => p.id === currentSup.id)) {
                possibleProviders.unshift(currentSup);
            }
        }
        return possibleProviders;
    }, [acType, state.partners, purSupplier, bpSupplier, activeSubModule]);

    // --- Original Opening Logic ---
    const typesForSupplier = useMemo(() => {
        if (!ooSupplier) return [];

        // Collect all original types from purchases for this supplier
        // This includes both legacy single-item purchases and new multi-item purchases
        const typeKeys = new Set<string>();
        
        state.purchases
            .filter(p => p.supplierId === ooSupplier)
            .forEach(p => {
                // For multi-item purchases, check items[] array
                if (p.items && p.items.length > 0) {
                    p.items.forEach(item => {
                        const typeKey = item.originalTypeId || item.originalType;
                        if (typeKey) typeKeys.add(typeKey);
                    });
                } else {
                    // For legacy single-item purchases, check top-level fields
                    const typeKey = p.originalTypeId || p.originalType;
                    if (typeKey) typeKeys.add(typeKey);
                }
            });

        return Array.from(typeKeys).map(key => {
            const master = state.originalTypes.find(
                ot => ot.id === key || ot.name === key
            );
            return {
                id: key,
                name: master?.name || key
            };
        });
    }, [ooSupplier, state.purchases, state.originalTypes]);

    // Products available for the selected supplier and original type
    const productsForSelection = useMemo(() => {
        if (!ooSupplier || !ooType) return [];
        
        // Get all unique original products from purchases for this supplier and type
        const productIds = new Set<string>();
        
        state.purchases
            .filter(p => p.supplierId === ooSupplier)
            .forEach(p => {
                if (p.items && p.items.length > 0) {
                    p.items.forEach(item => {
                        if ((item.originalTypeId || item.originalType) === ooType && item.originalProductId) {
                            productIds.add(item.originalProductId);
                        }
                    });
                } else if ((p.originalTypeId || p.originalType) === ooType && p.originalProductId) {
                    productIds.add(p.originalProductId);
                }
            });
        
        // Return products that match the IDs found in purchases
        return state.originalProducts
            .filter(p => productIds.has(p.id) && p.originalTypeId === ooType)
            .map(p => ({ id: p.id, name: p.name }));
    }, [ooSupplier, ooType, state.purchases, state.originalProducts]);

    const batchesForSelection = useMemo(() => {
        if (!ooSupplier || !ooType) return [];
        
        const currentFactoryId = state.currentFactory?.id;
        
        // Debug logging
        const allPurchases = state.purchases;
        
        // Filter by factory first (if factory is selected)
        const factoryFilteredPurchases = currentFactoryId 
            ? allPurchases.filter(p => !p.factoryId || p.factoryId === currentFactoryId)
            : allPurchases;
        
        const matchingPurchases = factoryFilteredPurchases.filter(p => {
            // Check supplier match
                if (p.supplierId !== ooSupplier) return false;
            
                // For multi-item purchases, check if any item matches the selected type and product (if selected)
                if (p.items && p.items.length > 0) {
                    return p.items.some(item => {
                    // Try both ID and name matching for flexibility
                    const itemTypeId = item.originalTypeId;
                    const itemTypeName = item.originalType;
                    const typeMatches = itemTypeId === ooType || itemTypeName === ooType;
                        const productMatches = !ooProduct || item.originalProductId === ooProduct;
                        return typeMatches && productMatches;
                    });
                }
                // For legacy single-item purchases, check top-level fields
            const purchaseTypeId = p.originalTypeId;
            const purchaseTypeName = p.originalType;
            const typeMatches = purchaseTypeId === ooType || purchaseTypeName === ooType;
                const productMatches = !ooProduct || p.originalProductId === ooProduct;
                return typeMatches && productMatches;
        });
        
        if (matchingPurchases.length === 0 && allPurchases.length > 0) {
            console.log('🔍 Batch Selection Debug - No Matching Purchases:', {
                ooSupplier,
                ooType,
                ooProduct,
                currentFactoryId,
                totalPurchases: allPurchases.length,
                factoryFilteredPurchases: factoryFilteredPurchases.length,
                purchasesWithSupplier: factoryFilteredPurchases.filter(p => p.supplierId === ooSupplier).length,
                samplePurchase: factoryFilteredPurchases.find(p => p.supplierId === ooSupplier),
                samplePurchaseItems: factoryFilteredPurchases.find(p => p.supplierId === ooSupplier)?.items,
                allSupplierIds: [...new Set(factoryFilteredPurchases.map(p => p.supplierId))],
                allTypeIds: [...new Set(factoryFilteredPurchases.flatMap(p => 
                    p.items?.map(i => i.originalTypeId || i.originalType) || [p.originalTypeId || p.originalType]
                ).filter(Boolean))],
                // Show detailed comparison for first purchase with matching supplier
                detailedComparison: (() => {
                    const sample = factoryFilteredPurchases.find(p => p.supplierId === ooSupplier);
                    if (!sample) return null;
                    if (sample.items && sample.items.length > 0) {
                        return {
                            purchaseId: sample.id,
                            batchNumber: sample.batchNumber,
                            items: sample.items.map(item => ({
                                originalTypeId: item.originalTypeId,
                                originalType: item.originalType,
                                matchesType: (item.originalTypeId === ooType || item.originalType === ooType),
                                ooType
                            }))
                        };
                    }
                    return {
                        purchaseId: sample.id,
                        batchNumber: sample.batchNumber,
                        originalTypeId: sample.originalTypeId,
                        originalType: sample.originalType,
                        matchesType: (sample.originalTypeId === ooType || sample.originalType === ooType),
                        ooType
                    };
                })()
            });
        }
        
        // Only show batches with remaining stock > 0.01 (strict by purchase ID)
        const batchesWithStock = matchingPurchases
            .filter(p => {
                // Calculate opened and sold for this purchase
                const opened = state.originalOpenings
                    .filter(o => o.batchNumber === p.batchNumber && o.supplierId === ooSupplier && o.originalType === ooType)
                    .reduce((sum, o) => sum + o.weightOpened, 0);
                const sold = state.salesInvoices.filter(inv => inv.status === 'Posted').reduce((sum, inv) => {
                    return sum + inv.items.filter(i => i.originalPurchaseId === p.id).reduce((is, item) => is + item.totalKg, 0);
                }, 0);
                // Subtract direct sales for this batch
                const directSold = state.directSales?.filter(ds => ds.batchId === p.id && ds.supplierId === ooSupplier).reduce((sum, ds) => sum + ds.quantity, 0) || 0;
                
                // For multi-item purchases, calculate remaining based on the matching item's weight
                let weightPurchased = p.weightPurchased;
                if (p.items && p.items.length > 0) {
                    const matchingItem = p.items.find(item => (item.originalTypeId || item.originalType) === ooType);
                    if (matchingItem) {
                        weightPurchased = matchingItem.weightPurchased || 0;
                    }
                }
                
                const remaining = weightPurchased - opened - sold - directSold;
                
                // Debug log for batches with no remaining stock
                if (remaining <= 0.01 && matchingPurchases.length > 0) {
                    console.log(`⚠️ Batch ${p.batchNumber} filtered out (no remaining stock):`, {
                        batchNumber: p.batchNumber,
                        weightPurchased,
                        opened,
                        sold,
                        directSold,
                        remaining
                    });
                }
                
                return remaining > 0.01;
            });
        
        if (matchingPurchases.length > 0 && batchesWithStock.length === 0) {
            console.log('🔍 Batch Selection Debug - All Batches Consumed:', {
                matchingPurchasesCount: matchingPurchases.length,
                batchesWithStockCount: batchesWithStock.length,
                sampleBatch: matchingPurchases[0] ? {
                    batchNumber: matchingPurchases[0].batchNumber,
                    weightPurchased: matchingPurchases[0].weightPurchased,
                    items: matchingPurchases[0].items
                } : null
            });
        }
        
        return batchesWithStock
            .map(p => ({ id: p.batchNumber, name: p.batchNumber }));
    }, [ooSupplier, ooType, ooProduct, state.purchases, state.originalOpenings, state.salesInvoices, state.directSales, state.currentFactory?.id]);

    const availableStockInfo = useMemo(() => {
        if (!ooSupplier || !ooType) return { qty: 0, weight: 0, avgCost: 0 };

        // Helper to get consistent type key
        const getTypeKey = (p: any) => p.originalTypeId || p.originalType;
        const itemMatchesType = (item: any) => {
            const typeMatches = (item.originalTypeId || item.originalType) === ooType;
            const productMatches = !ooProduct || item.originalProductId === ooProduct;
            return typeMatches && productMatches;
        };

        // Filter purchases by Supplier AND OriginalType (ID or name) AND (Optional) BatchNumber
        // For multi-item purchases, check items[] array; for legacy, check top-level fields
        const relevantPurchases = state.purchases.filter(p => {
            if (p.supplierId !== ooSupplier) return false;
            if (!ooBatch || p.batchNumber === ooBatch) {
                if (p.items && p.items.length > 0) {
                    return p.items.some(itemMatchesType);
                }
                return getTypeKey(p) === ooType;
            }
            return false;
        });

        // Filter previous openings by Supplier AND OriginalTypeID AND (Optional) OriginalProductID AND (Optional) BatchNumber
        const relevantOpenings = state.originalOpenings.filter(o => 
            o.supplierId === ooSupplier && 
            o.originalType === ooType &&
            (!ooProduct || o.originalProductId === ooProduct) &&
            (!ooBatch || o.batchNumber === ooBatch)
        );

        // Filter direct sales for this batch
        const relevantDirectSales = state.salesInvoices.filter(inv => 
            inv.status === 'Posted' && inv.items.some(item => {
                // Find purchase for item
                const purchase = state.purchases.find(p => p.id === item.originalPurchaseId);
                if (!purchase || purchase.supplierId !== ooSupplier || getTypeKey(purchase) !== ooType) return false;
                if (ooBatch && purchase.batchNumber !== ooBatch) return false;
                // Check product match if product is selected
                if (ooProduct) {
                    if (purchase.items && purchase.items.length > 0) {
                        const matchingItem = purchase.items.find(itemMatchesType);
                        if (!matchingItem) return false;
                    } else if (purchase.originalProductId !== ooProduct) {
                        return false;
                    }
                }
                return true;
            })
        );

        // Sum sold qty/weight for direct sales
        const sold = relevantDirectSales.reduce((acc, inv) => {
            inv.items.forEach(item => {
                const purchase = state.purchases.find(p => p.id === item.originalPurchaseId);
                if (purchase && purchase.supplierId === ooSupplier && getTypeKey(purchase) === ooType && (!ooBatch || purchase.batchNumber === ooBatch)) {
                    // Check product match if product is selected
                    if (ooProduct) {
                        if (purchase.items && purchase.items.length > 0) {
                            const matchingItem = purchase.items.find(itemMatchesType);
                            if (!matchingItem) return;
                        } else if (purchase.originalProductId !== ooProduct) {
                            return;
                        }
                    }
                    acc.qty += item.qty;
                    acc.weight += item.totalKg;
                }
            });
            return acc;
        }, { qty: 0, weight: 0 });

        const purchased = relevantPurchases.reduce((acc, curr) => {
            // For multi-item purchases, only count the matching item's weight/cost
            if (curr.items && curr.items.length > 0) {
                const matchingItem = curr.items.find(itemMatchesType);
                if (matchingItem) {
                    return {
                        qty: acc.qty + (matchingItem.qtyPurchased || 0),
                        weight: acc.weight + (matchingItem.weightPurchased || 0),
                        cost: acc.cost + (matchingItem.totalCostUSD || 0)
                    };
                }
                return acc; // No matching item found, skip this purchase
            }
            // For legacy single-item purchases, use top-level fields
            return {
                qty: acc.qty + curr.qtyPurchased,
                weight: acc.weight + curr.weightPurchased,
                cost: acc.cost + curr.totalLandedCost
            };
        }, { qty: 0, weight: 0, cost: 0 });

        const opened = relevantOpenings.reduce((acc, curr) => ({
                qty: acc.qty + curr.qtyOpened,
                weight: acc.weight + curr.weightOpened
            }), { qty: 0, weight: 0 });

        // Subtract IAO adjustments (Original Stock Adjustments) from available stock
        // These are ledger entries with transactionType = INVENTORY_ADJUSTMENT that affect this stock
        const supplier = state.partners.find(p => p.id === ooSupplier);
        const supplierName = supplier?.name || '';
        const originalType = state.originalTypes.find(ot => ot.id === ooType || ot.name === ooType);
        const typeName = originalType?.name || ooType || '';
        
        const iaoAdjustments = state.ledger
            .filter((entry: any) => {
                if (entry.transactionType !== 'INVENTORY_ADJUSTMENT') return false;
                if (!entry.narration) return false;
                const narration = entry.narration.toLowerCase();
                // Check if this is an Original Stock Adjustment entry
                if (!narration.includes('original stock')) return false;
                // Match supplier name in narration
                if (supplierName && !narration.includes(supplierName.toLowerCase())) return false;
                // Match type name in narration
                if (typeName && !narration.includes(typeName.toLowerCase())) return false;
                return true;
            })
            .reduce((acc: { weight: number }, entry: any) => {
                // Parse weight adjustment from narration
                // Format: "Original Stock Decrease: abc (USMAN INTL AC) (Weight: -500 kg, Worth: $2000.00)"
                const weightMatch = entry.narration.match(/Weight:\s*([+-]?\d+\.?\d*|N\/A)\s*kg/i);
                if (weightMatch && weightMatch[1] !== 'N/A' && weightMatch[1] !== 'n/a') {
                    const weightAdjustment = parseFloat(weightMatch[1]);
                    if (!isNaN(weightAdjustment)) {
                        // Negative adjustments (decreases) reduce available stock
                        // Positive adjustments (increases) add to available stock
                        // Use += because: -300 adjustment means subtract 300, so += (-300) = subtracts 300
                        acc.weight += weightAdjustment;
                    }
                }
                return acc;
            }, { weight: 0 });

        // Subtract direct sales and IAO adjustments from available stock
        const currentQty = purchased.qty - opened.qty - sold.qty;
        const currentWeight = purchased.weight - opened.weight - sold.weight - iaoAdjustments.weight;
        const avgCostPerKg = purchased.weight > 0 ? (purchased.cost / purchased.weight) : 0;

        return { 
            qty: currentQty, 
            weight: currentWeight, 
            avgCost: avgCostPerKg 
        };
    }, [ooSupplier, ooType, ooProduct, ooBatch, state.purchases, state.originalOpenings, state.salesInvoices, state.ledger, state.partners, state.originalTypes]);

    const handleOpeningSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qtyVal = parseFloat(ooQty);
        
        // Strict validation is relaxed to Allow user to proceed but with a warning if stock < 0
        if (qtyVal > availableStockInfo.qty && availableStockInfo.qty > 0) {
           if(!window.confirm(`Warning: You are opening more than the calculated available stock (${availableStockInfo.qty}). Do you want to proceed?`)) {
               return;
           }
        }

        const estWeight = availableStockInfo.qty > 0 
            ? (availableStockInfo.weight / availableStockInfo.qty) * qtyVal 
            : 0;
            
        // Fallback for Kg items: If Unit Qty is 0 but Weight is > 0 (Legacy Data), treat entered qty as weight
        const finalWeight = estWeight || qtyVal;

        const newOpening: OriginalOpening = {
            id: Math.random().toString(36).substr(2, 9),
            date: ooDate,
            supplierId: ooSupplier,
            originalType: ooType,
            originalProductId: ooProduct || undefined,
            batchNumber: ooBatch,
            qtyOpened: qtyVal,
            weightOpened: finalWeight,
            costPerKg: availableStockInfo.avgCost,
            totalValue: finalWeight * availableStockInfo.avgCost,
            factoryId: state.currentFactory?.id || ''
        };
        
        // Add to staging cart instead of immediate save
        setStagedOriginalOpenings([...stagedOriginalOpenings, newOpening]);
        
        // Reset Form
        setOoQty('');
        setOoBatch('');
        setOoProduct('');
        setOoType('');
        
        // No alert - user can add more
    };
    
    // Complete/Submit all staged openings
    const handleCompleteOriginalOpenings = async () => {
        if (stagedOriginalOpenings.length === 0) {
            alert('No openings to submit');
            return;
        }
        
        // Validate all openings before processing
        const invalidOpenings = stagedOriginalOpenings.filter(o => 
            !o.supplierId || !o.originalType || !o.date || o.qtyOpened <= 0
        );
        
        if (invalidOpenings.length > 0) {
            alert(`Cannot save: ${invalidOpenings.length} opening(s) have missing or invalid data. Please check Supplier, Original Type, Date, and Quantity.`);
            return;
        }
        
        // Set loading state
        setIsProcessingOpenings(true);
        setProcessingProgress({ current: 0, total: stagedOriginalOpenings.length });
        
        const count = stagedOriginalOpenings.length;
        let successCount = 0;
        let errorCount = 0;
        
        try {
            // Process each opening sequentially to ensure proper saving
            for (let i = 0; i < stagedOriginalOpenings.length; i++) {
                const opening = stagedOriginalOpenings[i];
                // Update progress
                setProcessingProgress({ current: i + 1, total: count });
                try {
                    await addOriginalOpening(opening);
                    successCount++;
                    console.log(`✅ Opening ${i + 1}/${count} saved successfully`);
                } catch (error) {
                    console.error(`❌ Error adding opening ${i + 1}/${count}:`, error);
                    errorCount++;
                }
            }
            
            // Clear staged openings only if at least some were successful
            if (successCount > 0) {
                setStagedOriginalOpenings([]);
            }
            
            // Show appropriate message
            if (errorCount === 0) {
                alert(`✅ ${successCount} opening(s) recorded successfully!`);
            } else if (successCount > 0) {
                alert(`⚠️ ${successCount} opening(s) recorded successfully, ${errorCount} failed. Please check the console for details.`);
            } else {
                alert(`❌ Failed to record openings. Please check the console for details.`);
            }
        } catch (error) {
            console.error('❌ Error completing openings:', error);
            alert(`❌ An error occurred while saving openings: ${error}. Please check the console for details.`);
        } finally {
            // Always clear loading state
            setIsProcessingOpenings(false);
            setProcessingProgress({ current: 0, total: 0 });
        }
    };
    
    const handleRemoveStagedOpening = (id: string) => {
        setStagedOriginalOpenings(stagedOriginalOpenings.filter(o => o.id !== id));
    };
    
    // --- CSV Upload Handler for Original Opening ---
    const handleOriginalOpeningCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedEntries: OriginalOpening[] = [];
                const errors: string[] = [];
                
                for (let idx = 0; idx < results.data.length; idx++) {
                    const row = results.data[idx] as any;
                    
                    // Validate required fields
                    if (!row['Date'] || !row['Supplier ID'] || !row['Original Type ID'] || !row['Quantity']) {
                        errors.push(`Row ${idx + 2}: Missing required fields (Date, Supplier ID, Original Type ID, or Quantity)`);
                        continue;
                    }
                    
                    // Find supplier by ID or code
                    const supplier = state.partners.find(p => 
                        p.id === row['Supplier ID'] || 
                        (p as any).code === row['Supplier ID'] ||
                        p.name === row['Supplier ID']
                    );
                    if (!supplier) {
                        errors.push(`Row ${idx + 2}: Supplier "${row['Supplier ID']}" not found`);
                        continue;
                    }
                    
                    // Find original type by ID or code
                    const originalType = state.originalTypes.find(ot => 
                        ot.id === row['Original Type ID'] || 
                        ot.name === row['Original Type ID']
                    );
                    if (!originalType) {
                        errors.push(`Row ${idx + 2}: Original Type "${row['Original Type ID']}" not found`);
                        continue;
                    }
                    
                    // Find original product (optional)
                    let originalProduct: any = undefined;
                    if (row['Original Product ID'] && row['Original Product ID'].trim() !== '') {
                        originalProduct = state.originalProducts.find(op => 
                            op.id === row['Original Product ID'] || 
                            op.name === row['Original Product ID']
                        );
                        if (!originalProduct) {
                            errors.push(`Row ${idx + 2}: Original Product "${row['Original Product ID']}" not found (will be skipped)`);
                        }
                    }
                    
                    // Validate quantity
                    const qty = parseFloat(row['Quantity']);
                    if (isNaN(qty) || qty <= 0) {
                        errors.push(`Row ${idx + 2}: Invalid quantity "${row['Quantity']}"`);
                        continue;
                    }
                    
                    // Parse date
                    let openingDate = row['Date'];
                    if (openingDate) {
                        // Handle different date formats
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(openingDate)) {
                            const dateObj = new Date(openingDate);
                            if (!isNaN(dateObj.getTime())) {
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                openingDate = `${year}-${month}-${day}`;
                            } else {
                                errors.push(`Row ${idx + 2}: Invalid date format "${row['Date']}". Use YYYY-MM-DD format.`);
                                continue;
                            }
                        }
                    } else {
                        errors.push(`Row ${idx + 2}: Date is required.`);
                        continue;
                    }
                    
                    // Calculate weight (if not provided, estimate from quantity and packing size)
                    let weight = 0;
                    if (row['Weight (Kg)'] && row['Weight (Kg)'].trim() !== '') {
                        const parsedWeight = parseFloat(row['Weight (Kg)']);
                        if (!isNaN(parsedWeight) && parsedWeight > 0) {
                            weight = parsedWeight;
                        }
                    }
                    
                    // If weight not provided, calculate from quantity and packing size
                    if (weight === 0) {
                        const packingSize = originalType.packingSize ? parseFloat(String(originalType.packingSize)) : 1;
                        weight = qty * packingSize;
                    }
                    
                    // Get available stock info to calculate cost per kg
                    // Find purchases for this supplier and type
                    const relevantPurchases = state.purchases.filter(p => 
                        p.supplierId === supplier.id &&
                        ((p.originalTypeId || p.originalType) === originalType.id)
                    );
                    
                    // Calculate average cost from purchases
                    let avgCostPerKg = 0;
                    if (relevantPurchases.length > 0) {
                        const totalCost = relevantPurchases.reduce((sum, p) => {
                            if (p.items && p.items.length > 0) {
                                const matchingItem = p.items.find(item => 
                                    (item.originalTypeId || item.originalType) === originalType.id
                                );
                                return sum + (matchingItem?.totalCostUSD || 0);
                            }
                            return sum + (p.totalLandedCost || 0);
                        }, 0);
                        
                        const totalWeight = relevantPurchases.reduce((sum, p) => {
                            if (p.items && p.items.length > 0) {
                                const matchingItem = p.items.find(item => 
                                    (item.originalTypeId || item.originalType) === originalType.id
                                );
                                return sum + (matchingItem?.weightPurchased || 0);
                            }
                            return sum + (p.weightPurchased || 0);
                        }, 0);
                        
                        avgCostPerKg = totalWeight > 0 ? totalCost / totalWeight : 0;
                    }
                    
                    // If no purchases found, use 0 (will be calculated from available stock in addOriginalOpening)
                    if (avgCostPerKg === 0) {
                        // Try to get from available stock info (same logic as manual entry)
                        // Note: This is a simplified calculation - the actual cost will be calculated in addOriginalOpening
                        avgCostPerKg = 0; // Will be calculated from available stock
                    }
                    
                    parsedEntries.push({
                        id: Math.random().toString(36).substr(2, 9),
                        date: openingDate,
                        supplierId: supplier.id,
                        originalType: originalType.id,
                        originalProductId: originalProduct?.id || undefined,
                        batchNumber: row['Batch Number'] && row['Batch Number'].trim() !== '' ? row['Batch Number'].trim() : undefined,
                        qtyOpened: qty,
                        weightOpened: weight,
                        costPerKg: avgCostPerKg,
                        totalValue: weight * avgCostPerKg,
                        factoryId: state.currentFactory?.id || ''
                    });
                }
                
                if (errors.length > 0) {
                    alert(`CSV Upload Errors:\n${errors.join('\n')}\n\nOnly valid rows will be added.`);
                }
                
                if (parsedEntries.length > 0) {
                    setStagedOriginalOpenings([...stagedOriginalOpenings, ...parsedEntries]);
                    alert(`Successfully loaded ${parsedEntries.length} original opening entry(ies) from CSV.`);
                } else {
                    alert('No valid original opening entries found in CSV.');
                }
            },
            error: (err) => {
                alert(`Error parsing CSV: ${err.message}`);
            }
        });
        
        // Reset file input
        e.target.value = '';
    };
    
    // Download CSV Template for Original Opening
    const downloadOriginalOpeningTemplate = () => {
        // Get sample data
        const sampleSupplier = state.partners.find(p => p.type === PartnerType.SUPPLIER);
        const sampleOriginalType = state.originalTypes[0];
        const sampleProduct = state.originalProducts.find(op => op.originalTypeId === sampleOriginalType?.id);
        
        const template = [
            ['Date', 'Supplier ID', 'Original Type ID', 'Original Product ID', 'Batch Number', 'Quantity', 'Weight (Kg)'],
            [
                new Date().toISOString().split('T')[0],
                sampleSupplier?.id || sampleSupplier?.name || 'SUP-001',
                sampleOriginalType?.id || sampleOriginalType?.name || 'OT-001',
                sampleProduct?.id || sampleProduct?.name || 'OP-001',
                'BATCH-001',
                '100',
                '500.00'
            ],
            [
                new Date().toISOString().split('T')[0],
                sampleSupplier?.id || sampleSupplier?.name || 'SUP-001',
                sampleOriginalType?.id || sampleOriginalType?.name || 'OT-001',
                '', // Optional
                '', // Optional
                '50',
                '250.00'
            ]
        ];
        
        // Convert to CSV string
        const csv = template.map(row => 
            row.map(cell => {
                const cellStr = String(cell || '');
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',')
        ).join('\n');
        
        // Create download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `original-opening-template-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };
    
    // --- History Table Data ---
    const openingsForDate = useMemo(() => {
        return state.originalOpenings.filter(o => o.date === ooDate && o.supplierId !== 'SUP-INTERNAL-STOCK');
    }, [state.originalOpenings, ooDate]);

    const handleDeleteOpening = (id: string) => {
        if(window.confirm('Delete this opening? This will reverse the accounting entries (restore raw materials and remove WIP/COGS).')) {
            deleteOriginalOpening(id);
            alert('Opening deleted successfully!');
        }
    }

    const handleDeleteProduction = async (id: string) => {
        const pin = prompt('Enter Supervisor PIN to delete production entry:');
        if (pin !== SUPERVISOR_PIN) {
            alert('❌ Invalid PIN! Deletion cancelled.');
            return;
        }
        if(window.confirm('Delete this production? This will reverse all accounting entries (restore Work in Progress, remove Finished Goods and Production Gain).')) {
            await deleteProduction(id);
            alert('✅ Production deleted successfully! Ledger entries reversed.');
        }
    }

    const handleDeleteSalesInvoice = (id: string) => {
        const pin = prompt('Enter Master Key to delete sales invoice:');
        if (pin !== SUPERVISOR_PIN) {
            alert('❌ Invalid Master Key! Deletion cancelled.');
            return;
        }
        if(window.confirm('Delete this sales invoice? This will reverse all accounting entries (restore Finished Goods, Customer AR, and Sales Revenue).')) {
            deleteEntity('salesInvoices', id);
            alert('✅ Sales invoice deleted successfully! All ledger entries and inventory reversed.');
        }
    }

    const handleDeleteDirectSale = (id: string) => {
        const pin = prompt('Enter Master Key to delete direct sale:');
        if (pin !== SUPERVISOR_PIN) {
            alert('❌ Invalid Master Key! Deletion cancelled.');
            return;
        }
        if(window.confirm('Delete this direct sale? This will reverse all accounting entries (restore Raw Material Inventory, Customer AR, and Sales Revenue).')) {
            deleteEntity('salesInvoices', id);
            alert('✅ Direct sale deleted successfully! All ledger entries and inventory reversed.');
        }
    }

    // --- Shared Additional Cost Logic ---
    const handleAddCost = () => {
        // For 'Other' type, require custom name and use supplier ID as provider
        if (acType === 'Other') {
            if (!acCustomName || !acAmount) return;
            const activeSupplierId = activeSubModule === 'original-purchase' ? purSupplier : bpSupplier;
            if (!activeSupplierId) {
                alert('Please select a supplier first. "Other" charges are recorded as payable to the supplier.');
                return;
            }
            const fcy = parseFloat(acAmount);
            const usd = fcy / acExchangeRate;
            const newCost: PurchaseAdditionalCost = {
                id: Math.random().toString(36).substr(2, 9),
                costType: acType,
                providerId: activeSupplierId, // Use supplier ID for 'Other' charges
                customName: acCustomName, // Store custom name (e.g., "VAT", "Custom Duty")
                currency: acCurrency,
                exchangeRate: acExchangeRate,
                amountFCY: fcy,
                amountUSD: usd
            };
            setAdditionalCosts([...additionalCosts, newCost]);
            setAcAmount('');
            setAcCustomName(''); // Reset custom name
        } else {
            // For other types (Freight, Clearing, Commission), use selected provider
            if (!acProvider || !acAmount) return;
            const fcy = parseFloat(acAmount);
            const usd = fcy / acExchangeRate;
            const newCost: PurchaseAdditionalCost = {
                id: Math.random().toString(36).substr(2, 9),
                costType: acType,
                providerId: acProvider,
                currency: acCurrency,
                exchangeRate: acExchangeRate,
                amountFCY: fcy,
                amountUSD: usd
            };
            setAdditionalCosts([...additionalCosts, newCost]);
            setAcAmount('');
        }
    };

    // --- Original Purchase Logic ---
    const handlePreSubmitPurchase = (e: React.FormEvent) => {
        e.preventDefault();
        if (!purSupplier || purCart.length === 0) {
            alert('Please select Supplier and add at least one Original Type to cart');
            return;
        }
        
        // Validation for Container Number
        if (purContainer) {
            // When editing, exclude the current purchase from duplicate check
            const isDuplicateOriginal = state.purchases.some(p => p.containerNumber === purContainer && p.id !== purEditingId);
            const isDuplicateBundle = state.bundlePurchases.some(p => p.containerNumber === purContainer);
            if (isDuplicateOriginal || isDuplicateBundle) {
                alert('Duplicate Container Number found! Please verify.');
                return;
            }
        }

        setPurPrinted(false);
        setShowPurSummary(true);
    };

    const handlePrint = () => {
        window.print();
        setPurPrinted(true);
    };

    const handleFinalPurchaseSave = () => {
        console.log('🔵 handleFinalPurchaseSave called, purEditingId:', purEditingId);
        
        if (purEditingId) {
            // Update existing purchase
            console.log('🔵 Calling handleUpdatePurchase for edit mode');
            handleUpdatePurchase();
            return;
        }

        // Create new purchase
        if (purCart.length === 0) {
            alert('Cart is empty!');
            return;
        }
        
        // Aggregate cart totals
        const totalWeight = purCart.reduce((sum, item) => sum + item.weightPurchased, 0);
        const totalQty = purCart.reduce((sum, item) => sum + item.qtyPurchased, 0);
        const totalMaterialCostFCY = purCart.reduce((sum, item) => sum + item.totalCostFCY, 0);
        const totalMaterialCostUSD = purCart.reduce((sum, item) => sum + item.totalCostUSD, 0);
        const totalAdditionalCostUSD = additionalCosts.reduce((sum, c) => sum + c.amountUSD, 0);
        const totalLandedCostUSD = totalMaterialCostUSD + totalAdditionalCostUSD;
        
        // For backward compatibility, use first item for legacy single-item fields
        const firstItem = purCart[0];

        // Normalize cart items: convert empty strings to undefined for optional fields
        const normalizedCart = purCart.map(item => ({
            ...item,
            originalProductId: item.originalProductId || undefined,
            subSupplierId: item.subSupplierId || undefined // Convert empty string to undefined
        }));

        const newPurchase: Purchase = {
            id: Math.random().toString(36).substr(2, 9),
            batchNumber: purBatch,
            status: 'In Transit',
            date: purDate,
            supplierId: purSupplier,
            
            // NEW: Multi-Original Type Cart
            items: normalizedCart,
            
            // Legacy fields (backward compatibility) - populated from first item
            originalTypeId: firstItem.originalTypeId,
            originalType: firstItem.originalType,
            originalProductId: firstItem.originalProductId,
            
            // Logistics
            containerNumber: purContainer,
            divisionId: purDivision,
            subDivisionId: purSubDivision,

            qtyPurchased: totalQty,
            weightPurchased: totalWeight,
            currency: purCurrency,
            exchangeRate: purExchangeRate,
            
            // Costs breakdown (from first item for legacy fields)
            costPerKgFCY: firstItem.costPerKgFCY,
            discountPerKgFCY: firstItem.discountPerKgFCY || 0,
            surchargePerKgFCY: firstItem.surchargePerKgFCY || 0,

            totalCostFCY: totalMaterialCostFCY,
            additionalCosts: additionalCosts,
            totalLandedCost: totalLandedCostUSD,
              landedCostPerKg: totalLandedCostUSD / totalWeight,
              factoryId: state.currentFactory?.id || ''
        };

        addPurchase(newPurchase);
        
        // Reset Form
        setPurSupplier(''); // Reset supplier field
        setPurCart([]);
        setPurOriginalTypeId('');
        setPurOriginalProductId('');
        setPurWeight('');
        setPurPrice('');
        setPurItemDiscount('');
        setPurItemSurcharge('');
        setPurContainer('');
        setPurDivision('');
        setPurSubDivision('');
        setAdditionalCosts([]);
        setShowPurSummary(false);
        setPurBatch((prev) => (parseInt(prev) + 1).toString()); 
    };

    // --- Secure Action Handlers ---
    const initiatePurchaseAction = (type: 'DELETE' | 'EDIT', purchaseId: string) => {
        setPendingPurchaseAction({ type, purchaseId });
        setAuthPin('');
        setAuthModalOpen(true);
    };

    const confirmPurchaseAuthAction = () => {
        if (authPin.trim() !== SUPERVISOR_PIN) {
            alert('Invalid PIN. Please try again.');
            setAuthPin('');
            return;
        }
        
        if (pendingPurchaseAction) {
            if (pendingPurchaseAction.type === 'DELETE') {
                handleDeletePurchaseConfirmed(pendingPurchaseAction.purchaseId);
            } else if (pendingPurchaseAction.type === 'EDIT') {
                handleEditPurchaseConfirmed(pendingPurchaseAction.purchaseId);
            }
        }
        
        setAuthModalOpen(false);
        setAuthPin('');
        setPendingPurchaseAction(null);
    };

    // --- Purchase Management Functions ---
    const handleEditPurchaseConfirmed = (purchaseId: string) => {
        const purchase = state.purchases.find(p => p.id === purchaseId);
        if (!purchase) return;

        // Switch to form view and mark as editing
        setPurEditingId(purchase.id);
        setPurMode('create');
        setShowPurSummary(false);

        // Top-level fields
        setPurDate(purchase.date);
        setPurBatch(purchase.batchNumber);
        setPurSupplier(purchase.supplierId || '');
        setPurCurrency(purchase.currency);
        setPurExchangeRate(purchase.exchangeRate || 1);
        setPurContainer(purchase.containerNumber || '');
        setPurDivision(purchase.divisionId || '');
        setPurSubDivision(purchase.subDivisionId || '');

        // Build cart from existing items or legacy single-item fields
        let items: PurchaseOriginalItem[] = [];

        if (purchase.items && purchase.items.length > 0) {
            // Already a multi-item purchase - normalize null/empty values
            items = purchase.items.map(item => ({
                ...item,
                originalProductId: item.originalProductId || undefined,
                subSupplierId: item.subSupplierId || undefined, // Preserve null/undefined, convert empty string
                weightPurchased: item.weightPurchased || 0,
                qtyPurchased: item.qtyPurchased || 0,
                costPerKgFCY: item.costPerKgFCY || 0,
                discountPerKgFCY: item.discountPerKgFCY || 0,
                surchargePerKgFCY: item.surchargePerKgFCY || 0,
                totalCostFCY: item.totalCostFCY || 0,
                totalCostUSD: item.totalCostUSD || 0
            }));
        } else if (purchase.originalTypeId) {
            // Legacy single-type purchase – map legacy fields into one cart item
            const typeDef = state.originalTypes.find(t => t.id === purchase.originalTypeId);
            const baseTypeName = typeDef?.name || purchase.originalType || 'Unknown';
            const product = purchase.originalProductId
                ? state.originalProducts.find(p => p.id === purchase.originalProductId)
                : undefined;
            const finalName = product ? `${baseTypeName}${product.name ? ` - ${product.name}` : ''}` : baseTypeName;

            const weight = purchase.weightPurchased || 0;
            const packingSize = typeDef?.packingSize || 1;
            const qty = purchase.qtyPurchased || (weight && packingSize ? weight / Number(packingSize) : 0);

            const costPerKgFCY = purchase.costPerKgFCY || 0;
            const discountPerKg = purchase.discountPerKgFCY || 0;
            const surchargePerKg = purchase.surchargePerKgFCY || 0;
            const netPricePerKg = costPerKgFCY - discountPerKg + surchargePerKg;
            const totalCostFCY = weight * netPricePerKg;
            const fx = purchase.exchangeRate || 1;
            const totalCostUSD = fx !== 0 ? totalCostFCY / fx : 0;

            items = [{
                id: Math.random().toString(36).substr(2, 9),
                originalTypeId: purchase.originalTypeId,
                originalType: finalName,
                originalProductId: purchase.originalProductId,
                subSupplierId: undefined,
                weightPurchased: weight,
                qtyPurchased: qty,
                costPerKgFCY: costPerKgFCY,
                discountPerKgFCY: discountPerKg,
                surchargePerKgFCY: surchargePerKg,
                totalCostFCY: totalCostFCY || purchase.totalCostFCY || 0,
                totalCostUSD: totalCostUSD || (purchase.totalLandedCost ?? 0)
            }];
        }

        setPurCart(items);

        // Pre-fill item editor with first cart line for easier editing
        if (items.length > 0) {
            const first = items[0];
            setPurOriginalTypeId(first.originalTypeId);
            setPurOriginalProductId(first.originalProductId || '');
            setPurSubSupplierId(first.subSupplierId || '');
            setPurWeight(first.weightPurchased ? String(first.weightPurchased) : '');
            setPurPrice(first.costPerKgFCY ? String(first.costPerKgFCY) : '');
            setPurItemDiscount(first.discountPerKgFCY !== undefined ? String(first.discountPerKgFCY) : '');
            setPurItemSurcharge(first.surchargePerKgFCY !== undefined ? String(first.surchargePerKgFCY) : '');
        } else {
            // Clear item-level fields if no items could be derived
            setPurOriginalTypeId('');
            setPurOriginalProductId('');
            setPurSubSupplierId('');
            setPurWeight('');
            setPurPrice('');
            setPurItemDiscount('');
            setPurItemSurcharge('');
        }

        setAdditionalCosts(purchase.additionalCosts || []);
    };

    const handleUpdatePurchase = () => {
        if (!purEditingId || purCart.length === 0) {
            alert('No purchase to update or cart is empty!');
            return;
        }

        // Get the existing purchase to preserve fields like status
        const existingPurchase = state.purchases.find(p => p.id === purEditingId);
        
        if (!existingPurchase) {
            alert('Purchase not found!');
            return;
        }

        // Aggregate cart totals
        const totalWeight = purCart.reduce((sum, item) => sum + item.weightPurchased, 0);
        const totalQty = purCart.reduce((sum, item) => sum + item.qtyPurchased, 0);
        const totalMaterialCostFCY = purCart.reduce((sum, item) => sum + item.totalCostFCY, 0);
        const totalMaterialCostUSD = purCart.reduce((sum, item) => sum + item.totalCostUSD, 0);
        const totalAdditionalCostUSD = additionalCosts.reduce((sum, c) => sum + c.amountUSD, 0);
        const totalLandedCostUSD = totalMaterialCostUSD + totalAdditionalCostUSD;
        const firstItem = purCart[0];

        // Normalize cart items: convert empty strings to undefined for optional fields
        const normalizedCart = purCart.map(item => ({
            ...item,
            originalProductId: item.originalProductId || undefined,
            subSupplierId: item.subSupplierId || undefined // Convert empty string to undefined
        }));

        const updatedPurchase: Purchase = {
            id: purEditingId,
            batchNumber: purBatch,
            status: existingPurchase.status, // Preserve existing status
            date: purDate,
            supplierId: purSupplier,
            factoryId: existingPurchase.factoryId, // Preserve factory
            items: normalizedCart,
            originalTypeId: firstItem.originalTypeId,
            originalType: firstItem.originalType,
            originalProductId: firstItem.originalProductId,
            containerNumber: purContainer,
            divisionId: purDivision,
            subDivisionId: purSubDivision,
            qtyPurchased: totalQty,
            weightPurchased: totalWeight,
            currency: purCurrency,
            exchangeRate: purExchangeRate,
            costPerKgFCY: firstItem.costPerKgFCY,
            discountPerKgFCY: firstItem.discountPerKgFCY || 0,
            surchargePerKgFCY: firstItem.surchargePerKgFCY || 0,
            totalCostFCY: totalMaterialCostFCY,
            additionalCosts: additionalCosts,
            totalLandedCost: totalLandedCostUSD,
            landedCostPerKg: totalLandedCostUSD / totalWeight
        };

        // Persist update (DataContext will also update Firestore and re-post ledger entries)
        updatePurchase(updatedPurchase);

        // Reset form
        setPurEditingId(null);
        setPurSupplier('');
        setPurCart([]);
        setPurOriginalTypeId('');
        setPurOriginalProductId('');
        setPurWeight('');
        setPurPrice('');
        setPurItemDiscount('');
        setPurItemSurcharge('');
        setPurContainer('');
        setPurDivision('');
        setPurSubDivision('');
        setAdditionalCosts([]);
        setShowPurSummary(false);
        setPurMode('manage');
        alert('Purchase updated successfully!');
    };

    const handleDeletePurchaseConfirmed = (purchaseId: string) => {
        // Delete from state and Firebase
        // The deleteEntity function in DataContext handles cascade deletion of ledger entries
        deleteEntity('purchases', purchaseId);
        alert('Purchase deleted successfully! Accounting entries have been removed.');
    };

    const handleCancelEdit = () => {
        setPurEditingId(null);
        setPurSupplier('');
        setPurCart([]);
        setPurOriginalTypeId('');
        setPurOriginalProductId('');
        setPurWeight('');
        setPurPrice('');
        setPurItemDiscount('');
        setPurItemSurcharge('');
        setPurContainer('');
        setPurDivision('');
        setPurSubDivision('');
        setAdditionalCosts([]);
        setPurMode('manage');
    };

    // --- Bundle Purchase Logic ---

    const handleAddBpItem = () => {
        if (!bpItemId || !bpItemQty || !bpItemRate) return;
        const qty = parseFloat(bpItemQty);
        const rate = parseFloat(bpItemRate);
        if (qty <= 0 || rate <= 0) return;

        const newItem: BundlePurchaseItem = {
            id: Math.random().toString(36).substr(2, 9),
            itemId: bpItemId,
            qty,
            rateFCY: rate,
            totalFCY: qty * rate,
            totalUSD: (qty * rate) / bpExchangeRate
        };
        setBpCart([...bpCart, newItem]);
        setBpItemId('');
        setBpItemQty('');
        setBpItemRate('');
    };

    const handleFinalizeBundlePurchase = () => {
        if (!bpSupplier || bpCart.length === 0) {
            alert('Please select Supplier and add at least one item');
            return;
        }

        // Validate Duplicate Container
        if (bpContainer) {
            const isDuplicateOriginal = state.purchases.some(p => p.containerNumber === bpContainer);
            const isDuplicateBundle = state.bundlePurchases.some(p => p.containerNumber === bpContainer);
            if (isDuplicateOriginal || isDuplicateBundle) {
                alert('Container Number already exists!');
                return;
            }
        }

        const totalAmountFCY = bpCart.reduce((s, i) => s + i.totalFCY, 0);
        const totalAmountUSD = bpCart.reduce((s, i) => s + i.totalUSD, 0);

        const bundle: BundlePurchase = {
            id: Math.random().toString(36).substr(2, 9),
            batchNumber: bpBatch,
            date: bpDate,
            supplierId: bpSupplier,
            containerNumber: bpContainer,
            divisionId: bpDivision,
            subDivisionId: bpSubDivision,
            factoryId: state.currentFactory?.id || '',
            currency: bpCurrency,
            exchangeRate: bpExchangeRate,
            items: bpCart,
            additionalCosts: additionalCosts,
            totalAmountFCY,
            totalAmountUSD
        };

        addBundlePurchase(bundle);
        
        // Reset
        setBpCart([]);
        setBpSupplier('');
        setBpContainer('');
        setAdditionalCosts([]);
        setBpBatch((prev) => (parseInt(prev) + 1).toString());
        alert('Bundle Purchase Finalized');
    };

    // --- Sales Invoice Logic ---

    // Auto-populate rate when item is selected - prioritize last sale rate to this customer
    useEffect(() => {
        if (siItemId && activeSubModule === 'sales-invoice' && siCustomer) {
            const item = state.items.find(i => i.id === siItemId);
            if (!item) return;
            
            // Find the last posted invoice for this customer that includes this item
            const lastInvoiceWithItem = state.salesInvoices
                .filter(inv => inv.customerId === siCustomer && inv.status === 'Posted')
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .find(inv => inv.items.some(invItem => invItem.itemId === siItemId));
            
            if (lastInvoiceWithItem) {
                const lastItem = lastInvoiceWithItem.items.find(invItem => invItem.itemId === siItemId);
                if (lastItem) {
                    // Use the rate from the last sale to this customer
                    setSiItemRate(lastItem.rate.toString());
                    return;
                }
            }
            
            // Fallback to item's average sale price
            if (item.salePrice) {
                setSiItemRate(item.salePrice.toString());
            }
        }
    }, [siItemId, siCustomer, activeSubModule, state.items, state.salesInvoices]);

    const handleAddSiItem = () => {
        if (!siItemId || !siItemQty) return;
        const item = state.items.find(i => i.id === siItemId);
        if (!item) return;

        const qty = parseFloat(siItemQty);
        // Rate can be entered in customer currency OR base currency (USD) based on toggle
        // Allow zero and negative values for business requirements
        let rateEntered = siItemRate ? parseFloat(siItemRate) : (item.salePrice !== undefined && item.salePrice !== null ? item.salePrice : 0);
        
        // Only validate that rate is a valid number (not NaN)
        if (isNaN(rateEntered)) {
            const currencyLabel = siRateCurrency === 'customer' ? siCurrency : 'USD';
            alert(`Please enter a valid Rate/Unit (${currencyLabel}) or set a Sale Price in Setup.`);
            return;
        }

        // Convert rate to USD if entered in customer currency
        let rateUSD = rateEntered;
        if (siRateCurrency === 'customer' && siCurrency !== 'USD') {
            // Rate entered in customer currency, convert to USD
            rateUSD = rateEntered / siExchangeRate;
            console.log(`💱 Rate conversion: ${rateEntered} ${siCurrency} ÷ ${siExchangeRate} = ${rateUSD.toFixed(4)} USD`);
        }

        const newItem: SalesInvoiceItem = {
            id: Math.random().toString(36).substr(2, 9),
            itemId: item.id,
            itemName: item.name,
            qty,
            rate: rateUSD, // Always store in USD for accounting
            total: qty * rateUSD, // Total in USD
            totalKg: qty * item.weightPerUnit
        };

        setSiCart([...siCart, newItem]);
        setSiItemId('');
        setSiItemQty('');
        setSiItemRate('');
    };

    const handleAddSiCost = () => {
        if (!siCostAmount) return;
        const amount = parseFloat(siCostAmount);
        
        const newCost: InvoiceAdditionalCost = {
            id: Math.random().toString(36).substr(2, 9),
            costType: siCostType,
            providerId: (siCostType === 'Customs' || siCostType === 'Other') ? undefined : siCostProvider,
            customName: (siCostType === 'Customs' || siCostType === 'Other') ? siCostCustomName : undefined,
            amount: amount,
            currency: siCostCurrency,
            exchangeRate: siCostRate
        };
        setSiCosts([...siCosts, newCost]);
        setSiCostAmount('');
        setSiCostProvider('');
        setSiCostCustomName('');
    };

    const handleFinalizeInvoice = () => {
        if (!siCustomer || siCart.length === 0) {
            alert("Customer and Items are required.");
            return;
        }
        setShowSiSummary(true);
    };

    const saveInvoice = () => {
        const grossTotal = siCart.reduce((s, i) => s + (i.total || 0), 0);
        
        // All sales are in USD, no conversion needed
        const costsTotal = siCosts.reduce((s, c) => s + ((c.amount || 0) * ((c.exchangeRate || 1) / 1)), 0); 
        
        const netTotal = grossTotal - parseFloat(siDiscount || '0') + parseFloat(siSurcharge || '0') + costsTotal;

        const newInvoice: SalesInvoice = {
            id: siId || Math.random().toString(36).substr(2, 9),
            invoiceNo: siInvoiceNo,
            date: siDate,
            status: 'Unposted',
            customerId: siCustomer,
            logoId: siLogo,
            packingColor: siColor,
            containerNumber: siContainer,
            divisionId: siDivision,
            subDivisionId: siSubDivision,
            currency: 'USD', // All sales in USD for accounting
            exchangeRate: 1, // USD base
            customerCurrency: siCurrency, // Store customer's currency for ledger display
            customerExchangeRate: siExchangeRate, // Store customer's exchange rate for ledger display
            discount: parseFloat(siDiscount || '0'),
            surcharge: parseFloat(siSurcharge || '0'),
            items: siCart,
            additionalCosts: siCosts,
            grossTotal,
              netTotal,
              factoryId: state.currentFactory?.id || ''
        };

        if (siId) {
            updateSalesInvoice(newInvoice);
        } else {
            addSalesInvoice(newInvoice);
        }
        
        // Reset
        setShowSiSummary(false);
        setSiId('');
        setSiCustomer('');
        setSiContainer('');
        setSiCart([]);
        setSiCosts([]);
        alert("Invoice Saved Successfully!");
        
        // Increment ID if create mode
        if (!siId) {
            const num = parseInt(siInvoiceNo.replace('SINV-', ''));
            if (!isNaN(num)) setSiInvoiceNo(`SINV-${num + 1}`);
        }
    };

    const handleEditInvoice = (inv: SalesInvoice) => {
        setSiMode('create');
        setSiId(inv.id);
        setSiInvoiceNo(inv.invoiceNo);
        setSiDate(inv.date);
        setSiCustomer(inv.customerId);
        setSiLogo(inv.logoId);
        setSiColor(inv.packingColor || '');
        setSiCurrency((inv as any).customerCurrency || inv.currency || 'USD');
        setSiExchangeRate((inv as any).customerExchangeRate || inv.exchangeRate || 1);
        setSiContainer(inv.containerNumber || '');
        setSiDivision(inv.divisionId || '');
        setSiSubDivision(inv.subDivisionId || '');
        setSiPortOfDestination(inv.portOfDestinationId || '');
        setSiDiscount(inv.discount.toString());
        setSiSurcharge(inv.surcharge.toString());
        setSiCart(inv.items);
        setSiCosts(inv.additionalCosts);
    };

    // --- Direct Sales Logic ---
    const dsBatches = useMemo(() => {
        if (!dsSupplier) return [];
        // Only show batches with stock > 0.01 kg (strict by purchase ID)
        return state.purchases.filter(p => {
            if (p.supplierId !== dsSupplier) return false;
            
            // Helper to check if an opening matches this purchase
            const openingMatchesPurchase = (o: any) => {
                if (o.batchNumber !== p.batchNumber || o.supplierId !== dsSupplier) return false;
                
                // For multi-item purchases, check if opening's originalType matches any item's originalTypeId
                if (p.items && p.items.length > 0) {
                    return p.items.some(item => {
                        const itemTypeId = item.originalTypeId || item.originalType;
                        // Compare opening's originalType with item's originalTypeId (handle both ID and name formats)
                        return o.originalType === itemTypeId || 
                               o.originalType === item.originalType ||
                               (state.originalTypes.find(t => t.id === itemTypeId)?.name === o.originalType);
                    });
                } else {
                    // For legacy single-item purchases, check against purchase's originalTypeId
                    const purchaseTypeId = p.originalTypeId || p.originalType;
                    return o.originalType === purchaseTypeId ||
                           (state.originalTypes.find(t => t.id === purchaseTypeId)?.name === o.originalType);
                }
            };
            
            // Calculate opened and sold for this purchase
            const opened = state.originalOpenings.filter(openingMatchesPurchase).reduce((sum, o) => sum + o.weightOpened, 0);
            const sold = state.salesInvoices.filter(inv => inv.status === 'Posted').reduce((sum, inv) => {
                return sum + inv.items.filter(i => i.originalPurchaseId === p.id).reduce((is, item) => is + item.totalKg, 0);
            }, 0);
            // Subtract direct sales for this batch
            const directSold = state.directSales?.filter(ds => ds.batchId === p.id && ds.supplierId === dsSupplier).reduce((sum, ds) => sum + ds.quantity, 0) || 0;
            
            // Subtract IAO adjustments for this purchase
            const supplier = state.partners.find(partner => partner.id === dsSupplier);
            const supplierName = supplier?.name || '';
            let iaoAdjustmentWeight = 0;
            
            // Get original type name(s) for this purchase
            const purchaseTypeNames: string[] = [];
            if (p.items && p.items.length > 0) {
                p.items.forEach(item => {
                    const type = state.originalTypes.find(ot => ot.id === (item.originalTypeId || item.originalType));
                    if (type) purchaseTypeNames.push(type.name);
                });
            } else {
                const type = state.originalTypes.find(ot => ot.id === (p.originalTypeId || p.originalType));
                if (type) purchaseTypeNames.push(type.name);
            }
            
            // Calculate IAO adjustments for this purchase
            state.ledger.forEach((entry: any) => {
                if (entry.transactionType !== 'INVENTORY_ADJUSTMENT') return;
                if (!entry.narration) return;
                const narration = entry.narration.toLowerCase();
                if (!narration.includes('original stock')) return;
                if (supplierName && !narration.includes(supplierName.toLowerCase())) return;
                if (!purchaseTypeNames.some(typeName => narration.includes(typeName.toLowerCase()))) return;
                
                // Check if this adjustment affects this specific batch
                if (p.batchNumber && !narration.includes(`batch: ${p.batchNumber}`.toLowerCase()) && !narration.includes(`batch ${p.batchNumber}`.toLowerCase())) {
                    // If batch number is specified in narration, it must match
                    if (narration.includes('batch:')) return;
                }
                
                // Parse weight adjustment from narration
                const weightMatch = entry.narration.match(/Weight:\s*([+-]?\d+\.?\d*|N\/A)\s*kg/i);
                if (weightMatch && weightMatch[1] !== 'N/A' && weightMatch[1] !== 'n/a') {
                    const weightAdjustment = parseFloat(weightMatch[1]);
                    if (!isNaN(weightAdjustment)) {
                        // Use += because: -300 adjustment means subtract 300, so += (-300) = subtracts 300
                        iaoAdjustmentWeight += weightAdjustment;
                    }
                }
            });
            
            const remaining = p.weightPurchased - opened - sold - directSold - iaoAdjustmentWeight;
            return remaining > 0.01;
        }).map(p => {
            // Helper to check if an opening matches this purchase (same logic as above)
            const openingMatchesPurchase = (o: any) => {
                if (o.batchNumber !== p.batchNumber || o.supplierId !== dsSupplier) return false;
                
                // For multi-item purchases, check if opening's originalType matches any item's originalTypeId
                if (p.items && p.items.length > 0) {
                    return p.items.some(item => {
                        const itemTypeId = item.originalTypeId || item.originalType;
                        // Compare opening's originalType with item's originalTypeId (handle both ID and name formats)
                        return o.originalType === itemTypeId || 
                               o.originalType === item.originalType ||
                               (state.originalTypes.find(t => t.id === itemTypeId)?.name === o.originalType);
                    });
                } else {
                    // For legacy single-item purchases, check against purchase's originalTypeId
                    const purchaseTypeId = p.originalTypeId || p.originalType;
                    return o.originalType === purchaseTypeId ||
                           (state.originalTypes.find(t => t.id === purchaseTypeId)?.name === o.originalType);
                }
            };
            
            const opened = state.originalOpenings.filter(openingMatchesPurchase).reduce((sum, o) => sum + o.weightOpened, 0);
            const sold = state.salesInvoices.filter(inv => inv.status === 'Posted').reduce((sum, inv) => {
                return sum + inv.items.filter(i => i.originalPurchaseId === p.id).reduce((is, item) => is + item.totalKg, 0);
            }, 0);
            const directSold = state.directSales?.filter(ds => ds.batchId === p.id && ds.supplierId === dsSupplier).reduce((sum, ds) => sum + ds.quantity, 0) || 0;
            
            // Subtract IAO adjustments for this purchase (same logic as above)
            const supplier = state.partners.find(partner => partner.id === dsSupplier);
            const supplierName = supplier?.name || '';
            let iaoAdjustmentWeight = 0;
            
            // Get original type name(s) for this purchase
            const purchaseTypeNames: string[] = [];
            if (p.items && p.items.length > 0) {
                p.items.forEach(item => {
                    const type = state.originalTypes.find(ot => ot.id === (item.originalTypeId || item.originalType));
                    if (type) purchaseTypeNames.push(type.name);
                });
            } else {
                const type = state.originalTypes.find(ot => ot.id === (p.originalTypeId || p.originalType));
                if (type) purchaseTypeNames.push(type.name);
            }
            
            // Calculate IAO adjustments for this purchase
            state.ledger.forEach((entry: any) => {
                if (entry.transactionType !== 'INVENTORY_ADJUSTMENT') return;
                if (!entry.narration) return;
                const narration = entry.narration.toLowerCase();
                if (!narration.includes('original stock')) return;
                if (supplierName && !narration.includes(supplierName.toLowerCase())) return;
                if (!purchaseTypeNames.some(typeName => narration.includes(typeName.toLowerCase()))) return;
                
                // Check if this adjustment affects this specific batch
                if (p.batchNumber && !narration.includes(`batch: ${p.batchNumber}`.toLowerCase()) && !narration.includes(`batch ${p.batchNumber}`.toLowerCase())) {
                    // If batch number is specified in narration, it must match
                    if (narration.includes('batch:')) return;
                }
                
                // Parse weight adjustment from narration
                const weightMatch = entry.narration.match(/Weight:\s*([+-]?\d+\.?\d*|N\/A)\s*kg/i);
                if (weightMatch && weightMatch[1] !== 'N/A' && weightMatch[1] !== 'n/a') {
                    const weightAdjustment = parseFloat(weightMatch[1]);
                    if (!isNaN(weightAdjustment)) {
                        // Use += because: -300 adjustment means subtract 300, so += (-300) = subtracts 300
                        iaoAdjustmentWeight += weightAdjustment;
                    }
                }
            });
            
            const remaining = p.weightPurchased - opened - sold - directSold - iaoAdjustmentWeight;
            return { id: p.id, name: `Batch #${p.batchNumber} (${remaining.toLocaleString()} Kg)`, remaining, landedCostPerKg: p.landedCostPerKg, purchase: p };
        });
    }, [dsSupplier, state.purchases, state.originalOpenings, state.salesInvoices, state.originalTypes, state.directSales, state.ledger, state.partners]);

    const dsSelectedBatch = useMemo(() => dsBatches.find(b => b.id === dsPurchaseId), [dsPurchaseId, dsBatches]);

    const handleRecordDirectSale = () => {
        if (!dsCustomer || !dsPurchaseId || !dsQty || !dsRate) {
            alert('Please fill all required fields.');
            return;
        }
        
        const qty = parseFloat(dsQty);
        if (dsSelectedBatch && qty > dsSelectedBatch.remaining) {
            alert(`Insufficient stock! Max available: ${dsSelectedBatch.remaining} Kg`);
            return;
        }


        const rate = parseFloat(dsRate);
        const netTotal = qty * rate;
        // Calculate raw material cost for this direct sale
        const landedCostPerKg = dsSelectedBatch?.landedCostPerKg || 0;
        let totalRawMaterialCost = qty * landedCostPerKg;
        const profit = netTotal - totalRawMaterialCost;

        // Temporary popup to show key variables after calculation
        alert(
            `Direct Sale Variables:\n` +
            `Total Sales Kg: ${qty}\n` +
            `Batch Landed Cost Per Kg: ${landedCostPerKg}\n` +
            `Total Cost USD: ${totalRawMaterialCost}\n` +
            `Invoice.netTotal: ${netTotal}`
        );

        // Create Sales Invoice Item (Linked to Batch)
        const invoiceItem: SalesInvoiceItem = {
            id: Math.random().toString(36).substr(2, 9),
            itemId: 'DS-001',
            itemName: `Direct Sale - ${dsSelectedBatch?.purchase.originalType}`,
            qty: qty, // Treating Qty as Kg for direct sale simplicity or 1 unit = 1 kg
            rate: rate,
            total: netTotal,
            totalKg: qty,
            originalPurchaseId: dsPurchaseId
        };

        // Generate sequential DS invoice number
        const maxDsInv = state.salesInvoices
            .map(i => i.invoiceNo.startsWith('DS-') ? parseInt(i.invoiceNo.replace('DS-', '')) : 0)
            .filter(n => !isNaN(n))
            .reduce((max, curr) => curr > max ? curr : max, 1000);
        const nextDsInvNo = `DS-${maxDsInv + 1}`;

        const invoice: SalesInvoice = {
            id: Math.random().toString(36).substr(2, 9),
            invoiceNo: nextDsInvNo,
            date: dsDate,
            status: 'Posted',
            customerId: dsCustomer,
            factoryId: state.currentFactory?.id || '',
            logoId: state.logos[0]?.id || '', // Default Logo
            currency: 'USD', // All sales in USD
            exchangeRate: 1, // USD base
            customerCurrency: dsCurrency, // Store customer currency for ledger display
            customerExchangeRate: dsExchangeRate, // Store customer rate for ledger display
            discount: 0,
            surcharge: 0,
            items: [invoiceItem],
            additionalCosts: [],
            grossTotal: netTotal,
            netTotal: netTotal // Customer is debited with full sale value
        };

        // Adjust Raw Material inventory for the batch used in direct sale
        if (dsSelectedBatch && dsSelectedBatch.purchase && dsSelectedBatch.purchase.originalProductId) {
            // Find the item in state.items
            const rawMaterialItem = state.items.find(i => i.id === dsSelectedBatch.purchase.originalProductId);
            if (rawMaterialItem) {
                // Decrease stockQty by qty sold
                updateStock(rawMaterialItem.id, -qty);
            }
        }
        addDirectSale(invoice, landedCostPerKg);
        
        // Reset
        setDsQty('');
        setDsRate('');
        setDsPurchaseId('');
        alert('Direct Sale Recorded Successfully!');
    };

    // --- Ongoing Orders Logic ---
    const handleAddOoItem = () => {
        if (!ooNewItemId || !ooNewItemQty) return;
        const qty = parseFloat(ooNewItemQty);
        if (qty <= 0) return;
        setOoNewCart([...ooNewCart, { itemId: ooNewItemId, quantity: qty, shippedQuantity: 0 }]);
        setOoNewItemId('');
        setOoNewItemQty('');
    };

    const handleSaveOngoingOrder = () => {
        if (!ooNewCustomer || ooNewCart.length === 0) {
            alert('Customer and at least one item required');
            return;
        }
        const order: OngoingOrder = {
            id: Math.random().toString(36).substr(2, 9),
            orderNo: ooNewOrderNo,
            date: ooNewDate,
            customerId: ooNewCustomer,
            status: 'Active',
            items: ooNewCart
        };
        addOngoingOrder(order);
        setOoNewCart([]);
        setOoNewCustomer('');
        setOoNewOrderNo((prev) => 'OO-' + (parseInt(prev.split('-')[1]) + 1));
        alert('Ongoing Order Saved');
    };

    const filteredOngoingOrders = useMemo(() => {
        return state.ongoingOrders.filter(o => ooFilterStatus === 'All' || o.status === ooFilterStatus).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.ongoingOrders, ooFilterStatus]);

    const handleOpenShipmentModal = (order: OngoingOrder) => {
        setShipmentModalOrder(order);
        setShipmentQtys(
            order.items.reduce((acc, item) => ({
                ...acc,
                [item.itemId]: item.quantity - item.shippedQuantity
            }), {})
        );
    };

    const handleConfirmShipment = () => {
        if (!shipmentModalOrder) return;
        
        const itemsToShip = Object.entries(shipmentQtys)
            .filter(([_, qty]) => (qty as number) > 0)
            .map(([itemId, qty]) => ({ itemId, shipQty: qty as number }));

        if (itemsToShip.length === 0) {
            alert('Please enter quantity to ship for at least one item.');
            return;
        }

        processOrderShipment(shipmentModalOrder.id, itemsToShip);
        setShipmentModalOrder(null);
        alert('Shipment Processed & Invoice Created!');
    };


    // --- Bale Opening Logic ---
    const boSelectedItem = state.items.find(i => i.id === boItemId);
    const boAvailableStock = boSelectedItem?.stockQty || 0;
    const boEstimatedWeight = boSelectedItem ? parseFloat(boQty) * boSelectedItem.weightPerUnit : 0;

    const handleStageBaleOpening = (e: React.FormEvent) => {
        e.preventDefault();
        if (!boSelectedItem || !boQty) return;
        const qty = parseFloat(boQty);
        if (qty > boAvailableStock) {
            alert("Cannot open more than available stock!");
            return;
        }
        setStagedBaleOpenings([...stagedBaleOpenings, {
            id: Math.random().toString(36).substr(2, 9),
            itemId: boSelectedItem.id,
            itemName: boSelectedItem.name,
            qty: qty,
            weight: qty * boSelectedItem.weightPerUnit
        }]);
        setBoQty('');
        setBoItemId('');
    };

    const handlePostBaleOpening = () => {
        if (stagedBaleOpenings.length === 0) return;
        postBaleOpening(stagedBaleOpenings.map(s => ({ itemId: s.itemId, qty: s.qty, date: boDate })));
        setStagedBaleOpenings([]);
        alert("Bale Openings Posted Successfully");
    };

    // --- Production Logic ---
    const handleStageProduction = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prodItemId || !prodQty) return;
        const item = state.items.find(i => i.id === prodItemId);
        if (!item) return;
        const qty = parseFloat(prodQty);
        if (isNaN(qty) || qty <= 0) return;

        let serialStart: number | undefined;
        let serialEnd: number | undefined;

        // Apply Serial Logic for Bale, Sack, Box, Bag
        if (item.packingType !== PackingType.KG) {
            const startNum = getNextSerialNumber(item.id);
            serialStart = startNum;
            serialEnd = startNum + qty - 1;
            setTempSerialTracker(prev => ({ ...prev, [item.id]: (serialEnd || 0) + 1 }));
        }

        // Use prodAvgCost if provided, otherwise fall back to item.avgCost
        const avgCostValue = prodAvgCost ? parseFloat(prodAvgCost) : (item.avgCost || 0);
        const productionPrice = isNaN(avgCostValue) ? (item.avgCost || 0) : avgCostValue;

        const newEntry: ProductionEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: prodDate,
            itemId: item.id,
            itemName: item.name,
            packingType: item.packingType,
            qtyProduced: qty,
            weightProduced: qty * item.weightPerUnit,
            serialStart,
            serialEnd,
            factoryId: state.currentFactory?.id || '',
            productionPrice: productionPrice // Use prodAvgCost from form, or item.avgCost as fallback
        };
        setStagedProds([...stagedProds, newEntry]);
        setProdItemId('');
        setProdQty('');
        setProdAvgCost(''); // Clear avgCost field after adding to list
    };

    const handleFinalizeProduction = async () => {
        console.log('🔵 handleFinalizeProduction called');
        console.log('🔵 stagedProds:', stagedProds);
        if (stagedProds.length === 0) {
            console.log('❌ No staged productions');
            return;
        }
        
        if (isProcessingProduction) {
            return; // Prevent multiple clicks
        }
        
        setIsProcessingProduction(true);
        try {
            console.log('✅ Calling addProduction with:', stagedProds);
            // Clear any previous skipped items
            delete (window as any).__skippedProductionItems;
            
            await addProduction(stagedProds);
            setStagedProds([]);
            setTempSerialTracker({});
            setShowProdSummary(false);
            
            // Check for skipped items and show message
            const skippedItems = (window as any).__skippedProductionItems;
            if (skippedItems && skippedItems.length > 0) {
                const skippedList = skippedItems.slice(0, 10).map((s: any) => 
                    `  • ${s.itemName} (Qty: ${s.qty}) - ${s.reason}`
                ).join('\n');
                const moreCount = skippedItems.length > 10 ? `\n  ... and ${skippedItems.length - 10} more items` : '';
                
                alert(`✅ Production Saved Successfully!\n\n⚠️ However, ${skippedItems.length} item(s) were skipped due to invalid prices:\n\n${skippedList}${moreCount}\n\nPlease update the production prices (avgCost) in Setup > Items for these items and re-upload them.`);
                
                // Clear the skipped items from window
                delete (window as any).__skippedProductionItems;
            } else {
                alert("✅ Production Saved Successfully!");
            }
        } catch (error: any) {
            console.error('❌ Error saving production:', error);
            
            // Check if there were skipped items even on error
            const skippedItems = (window as any).__skippedProductionItems;
            if (skippedItems && skippedItems.length > 0) {
                const skippedList = skippedItems.slice(0, 5).map((s: any) => 
                    `  • ${s.itemName} - ${s.reason}`
                ).join('\n');
                alert(`❌ Error saving production: ${error.message || 'Unknown error'}\n\n⚠️ ${skippedItems.length} item(s) were also skipped due to invalid prices:\n${skippedList}${skippedItems.length > 5 ? `\n  ... and ${skippedItems.length - 5} more` : ''}\n\nPlease check the browser console (F12) for details.`);
                delete (window as any).__skippedProductionItems;
            } else {
                alert(`❌ Error saving production: ${error.message || 'Unknown error'}\n\nPlease check the browser console (F12) for details.`);
            }
            // Don't clear stagedProds on error so user can retry
        } finally {
            setIsProcessingProduction(false);
        }
    };

    // --- CSV Upload Handler for Production ---
    const handleProductionCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const parsedEntries: ProductionEntry[] = [];
                const errors: string[] = [];
                
                for (let idx = 0; idx < results.data.length; idx++) {
                    const row = results.data[idx] as any;
                    
                    if (!row['Production Date'] || !row['Item ID'] || !row['Quantity']) {
                        errors.push(`Row ${idx + 2}: Missing required fields (Production Date, Item ID, or Quantity)`);
                        continue;
                    }
                    
                    // Find item by code or ID
                    const item = state.items.find(i => i.code === row['Item ID'] || i.id === row['Item ID']);
                    if (!item) {
                        errors.push(`Row ${idx + 2}: Item "${row['Item ID']}" not found`);
                        continue;
                    }
                    
                    const qty = parseFloat(row['Quantity']);
                    if (isNaN(qty) || qty <= 0) {
                        errors.push(`Row ${idx + 2}: Invalid quantity "${row['Quantity']}"`);
                        continue;
                    }
                    
                    // Parse Production Price from CSV
                    // If not provided, use item's avgCost (AvgProductionPrice from Setup) as fallback
                    let productionPrice: number | undefined;
                    if (row['Production Price'] && row['Production Price'].trim() !== '') {
                        const parsedPrice = parseFloat(row['Production Price']);
                        if (!isNaN(parsedPrice)) {
                            productionPrice = parsedPrice;
                        }
                    }
                    
                    // If Production Price not provided in CSV, use item's avgCost as fallback
                    if (productionPrice === undefined) {
                        productionPrice = item.avgCost || 0;
                    }
                    
                    let serialStart: number | undefined;
                    let serialEnd: number | undefined;
                    
                    // Apply Serial Logic for Bale, Sack, Box, Bag
                    if (item.packingType !== PackingType.KG) {
                        const startNum = getNextSerialNumber(item.id);
                        serialStart = startNum;
                        serialEnd = startNum + qty - 1;
                        setTempSerialTracker(prev => ({ ...prev, [item.id]: (serialEnd || 0) + 1 }));
                    }
                    
                    // Parse and normalize the production date from CSV
                    let productionDate = row['Production Date'];
                    // Ensure date is in YYYY-MM-DD format (avoid timezone issues)
                    if (productionDate) {
                        // Handle different date formats
                        // Try parsing as date first
                        let dateObj: Date | null = null;
                        
                        // Check if already in YYYY-MM-DD format
                        if (/^\d{4}-\d{2}-\d{2}$/.test(productionDate)) {
                            // Already in correct format, use as-is
                            productionDate = productionDate;
                        } else {
                            // Try parsing various date formats
                            dateObj = new Date(productionDate);
                            if (!isNaN(dateObj.getTime())) {
                                // Convert to YYYY-MM-DD format using local timezone (not UTC)
                                const year = dateObj.getFullYear();
                                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                const day = String(dateObj.getDate()).padStart(2, '0');
                                productionDate = `${year}-${month}-${day}`;
                            } else {
                                errors.push(`Row ${idx + 2}: Invalid date format "${row['Production Date']}". Use YYYY-MM-DD format (e.g., 2025-12-16).`);
                                continue;
                            }
                        }
                    } else {
                        errors.push(`Row ${idx + 2}: Production Date is required.`);
                        continue;
                    }
                    
                    parsedEntries.push({
                        id: Math.random().toString(36).substr(2, 9),
                        date: productionDate, // Use normalized date
                        itemId: item.id,
                        itemName: item.name,
                        packingType: item.packingType,
                        qtyProduced: qty,
                        weightProduced: qty * item.weightPerUnit,
                        serialStart,
                        serialEnd,
                        factoryId: state.currentFactory?.id || '',
                        productionPrice: productionPrice // Use Production Price from CSV, or item.avgCost as fallback
                    });
                }
                
                if (errors.length > 0) {
                    alert(`CSV Upload Errors:\n${errors.join('\n')}\n\nOnly valid rows will be added.`);
                }
                
                if (parsedEntries.length > 0) {
                    setStagedProds([...stagedProds, ...parsedEntries]);
                    alert(`Successfully loaded ${parsedEntries.length} production entry(ies) from CSV.`);
                } else {
                    alert('No valid production entries found in CSV.');
                }
            },
            error: (err) => {
                alert(`Error parsing CSV: ${err.message}`);
            }
        });
        
        // Reset file input
        e.target.value = '';
    };

    // --- Re-baling Logic ---
    const handleAddConsume = () => {
        if (!rbConsumeId || !rbConsumeQty) return;
        const item = state.items.find(i => i.id === rbConsumeId);
        if (!item) return;
        const qty = parseFloat(rbConsumeQty);
        // Stock check removed - allow adding items regardless of stock quantity
        setRbConsumeList([...rbConsumeList, {
            id: Math.random().toString(36).substr(2, 9),
            itemId: item.id,
            itemName: item.name,
            qty: qty,
            weight: qty * item.weightPerUnit,
            packingType: item.packingType
        }]);
        setRbConsumeId(''); setRbConsumeQty('');
    };

    const handleAddProduce = () => {
        if (!rbProduceId || !rbProduceQty) return;
        const item = state.items.find(i => i.id === rbProduceId);
        if (!item) return;
        const qty = parseFloat(rbProduceQty);
        
        let serialStart: number | undefined;
        let serialEnd: number | undefined;

        if (item.packingType !== PackingType.KG) {
             const startNum = getNextSerialNumber(item.id);
             serialStart = startNum;
             serialEnd = startNum + qty - 1;
             setTempSerialTracker(prev => ({ ...prev, [item.id]: (serialEnd || 0) + 1 }));
        }

        setRbProduceList([...rbProduceList, {
            id: Math.random().toString(36).substr(2, 9),
            itemId: item.id,
            itemName: item.name,
            qty: qty,
            weight: qty * item.weightPerUnit,
            packingType: item.packingType,
            serialStart,
            serialEnd
        }]);
        setRbProduceId(''); setRbProduceQty('');
    };

    const handleFinalizeRebaling = () => {
        if (rbConsumeList.length === 0 || rbProduceList.length === 0) return;
        const transactionId = Math.random().toString(36).substr(2, 9);
        const entries: ProductionEntry[] = [];
        rbConsumeList.forEach(c => {
            entries.push({
                id: `rb-out-${c.itemId}-${transactionId}`,
                date: rbDate,
                itemId: c.itemId,
                itemName: c.itemName,
                packingType: c.packingType,
                qtyProduced: -Math.abs(c.qty), 
                weightProduced: c.weight,
                isRebaling: true, // Mark as re-baling
                factoryId: state.currentFactory?.id || ''
            });
        });
        rbProduceList.forEach(p => {
             entries.push({
                id: `rb-in-${p.itemId}-${transactionId}`,
                date: rbDate,
                itemId: p.itemId,
                itemName: p.itemName,
                packingType: p.packingType,
                qtyProduced: Math.abs(p.qty),
                weightProduced: p.weight,
                serialStart: p.serialStart,
                serialEnd: p.serialEnd,
                isRebaling: true, // Mark as re-baling
                factoryId: state.currentFactory?.id || ''
            });
        });
        addProduction(entries);
        setRbConsumeList([]); setRbProduceList([]); setTempSerialTracker({});
        alert("Re-baling Transaction Finalized");
    };

    // Re-baling Metrics
    const rbConsumedWeight = rbConsumeList.reduce((acc, curr) => acc + curr.weight, 0);
    const rbProducedWeight = rbProduceList.reduce((acc, curr) => acc + curr.weight, 0);
    const rbDifference = rbConsumedWeight - rbProducedWeight;

    // Helpers
    const getYesterdayProduction = (itemId: string) => {
        const today = new Date(prodDate);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStr = yesterday.toISOString().split('T')[0];
        return state.productions.filter(p => p.date === yStr && p.itemId === itemId).reduce((sum, p) => sum + p.qtyProduced, 0);
    };

    const selectedItem = state.items.find(i => i.id === prodItemId);
    // Patch: Add 'Optional' to Purchases submodules
    let subModules = getSubModules(activeModule);
    if (activeModule === 'purchase') {
        subModules = [
            ...subModules,
            // {
            //     id: 'original-purchase-2',
            //     label: 'Optional',
            //     icon: Box,
            //     desc: 'Replica for future changes',
            // },
        ];
    }
    const currentSubModuleDef = subModules.find(s => s.id === activeSubModule);
    const suppliersWithStock = useMemo(() => {
        const ids = Array.from(new Set(state.purchases.map(p => p.supplierId)));
        return state.partners.filter(p => ids.includes(p.id));
    }, [state.purchases, state.partners]);

    // SI Totals
    const siGrossTotal = siCart.reduce((s, i) => s + i.total, 0);
    const siCostsTotal = siCosts.reduce((s, c) => s + (c.amount * (c.exchangeRate / siExchangeRate)), 0); 
    const siNetTotal = siGrossTotal - parseFloat(siDiscount || '0') + parseFloat(siSurcharge || '0') + siCostsTotal;

    return (
        <div className="space-y-6">
            {/* Top Level Navigation Tabs */}
            <div className="flex gap-4 mb-4 print:hidden">
                {[ { id: 'purchase', label: 'Purchases', icon: ShoppingCart }, { id: 'production', label: 'Production', icon: Factory }, { id: 'sales', label: 'Sales', icon: Truck } ].map((m) => (
                    <button
                        key={m.id}
                        onClick={() => { setActiveModule(m.id as ModuleType); setActiveSubModule(getSubModules(m.id as ModuleType)[0].id); }}
                        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all flex-1 justify-center border ${ activeModule === m.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200' }`}
                    >
                        <m.icon size={20} /> {m.label}
                    </button>
                ))}
            </div>

            {/* Sub-Module Pills Navigation */}
            <div className="bg-white border border-slate-200 rounded-lg p-2 flex overflow-x-auto gap-2 shadow-sm print:hidden">
                {subModules.map((sub) => (
                    <button
                        key={sub.id}
                        onClick={() => setActiveSubModule(sub.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${ activeSubModule === sub.id ? 'bg-slate-100 text-blue-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50' }`}
                    >
                        <sub.icon size={16} /> {sub.label}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-12">
                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm min-h-[500px]">
                        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4 print:hidden">
                            <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                {currentSubModuleDef && <currentSubModuleDef.icon size={24} />}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{currentSubModuleDef?.label}</h2>
                                <p className="text-sm text-slate-500">{currentSubModuleDef?.desc}</p>
                            </div>
                            </div>
                            {activeSubModule === 'produced-production' && (
                                <button
                                    onClick={() => setShowDeleteProdUtility(!showDeleteProdUtility)}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                    <Trash2 size={16} />
                                    {showDeleteProdUtility ? 'Hide Delete Utility' : 'Delete Productions by Date'}
                                </button>
                            )}
                        </div>

                        {/* --- ONGOING ORDERS --- */}
                        {activeSubModule === 'ongoing-orders' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="flex gap-4 mb-6 border-b border-slate-200">
                                    <button className={`pb-2 text-sm font-medium ${ooView === 'create' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`} onClick={() => setOoView('create')}>New Order</button>
                                    <button className={`pb-2 text-sm font-medium ${ooView === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`} onClick={() => setOoView('list')}>Order List</button>
                                </div>

                                {ooView === 'create' ? (
                                    <div className="max-w-4xl mx-auto space-y-6">
                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Customer</label>
                                                <EntitySelector
                                                    entities={state.partners.filter(p => p.type === PartnerType.CUSTOMER)}
                                                    selectedId={ooNewCustomer}
                                                    onSelect={setOoNewCustomer}
                                                    placeholder="Select Customer..."
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig, { type: PartnerType.CUSTOMER })}
                                                />
                                            </div>
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Order #</label><input type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono font-bold" value={ooNewOrderNo} readOnly /></div>
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={ooNewDate} onChange={e => setOoNewDate(e.target.value)} /></div>
                                        </div>

                                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 font-bold text-slate-700">Order Items</div>
                                            <div className="p-6 space-y-4">
                                                <div className="flex gap-4">
                                                    <div className="flex-1">
                                                        <EntitySelector
                                                            entities={state.items.filter(i => i.category !== 'Raw Material')}
                                                            selectedId={ooNewItemId}
                                                            onSelect={setOoNewItemId}
                                                            placeholder="Select Item..."
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                                            formatOption={formatItemOption}
                                                            formatSelected={formatItemSelected}
                                                            searchFields={['code', 'name', 'category']}
                                                        />
                                                    </div>
                                                    <div className="w-32"><input type="number" className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:border-blue-500" placeholder="Qty" value={ooNewItemQty} onChange={e => setOoNewItemQty(e.target.value)} /></div>
                                                    <button onClick={handleAddOoItem} className="bg-blue-600 text-white px-4 rounded-lg font-bold hover:bg-blue-700">Add</button>
                                                </div>
                                                
                                                <div className="space-y-2 mt-4">
                                                    {ooNewCart.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                                                            <span className="font-medium text-slate-800">{state.items.find(i => i.id === item.itemId)?.name}</span>
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-mono text-slate-600 font-bold">{item.quantity} units</span>
                                                                <button onClick={() => setOoNewCart(ooNewCart.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><X size={18} /></button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {ooNewCart.length === 0 && <div className="text-center text-slate-400 py-4 italic">No items added to order</div>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex justify-end">
                                            <button onClick={handleSaveOngoingOrder} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700 flex items-center gap-2">
                                                <Save size={20} /> Save Order
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
                                            <div className="flex items-center gap-2">
                                                <List size={20} className="text-slate-400" />
                                                <select className="bg-white border border-slate-300 rounded-lg p-2 text-sm" value={ooFilterStatus} onChange={e => setOoFilterStatus(e.target.value)}>
                                                    <option value="All">All Statuses</option>
                                                    <option value="Active">Active</option>
                                                    <option value="PartiallyShipped">Partially Shipped</option>
                                                    <option value="Completed">Completed</option>
                                                </select>
                                            </div>
                                        </div>
                                        
                                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-left text-sm">
                                                <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 uppercase text-xs">
                                                    <tr>
                                                        <th className="px-6 py-4">Order ID</th>
                                                        <th className="px-6 py-4">Date</th>
                                                        <th className="px-6 py-4">Customer</th>
                                                        <th className="px-6 py-4 text-center">Status</th>
                                                        <th className="px-6 py-4 text-center">Items</th>
                                                        <th className="px-6 py-4 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {filteredOngoingOrders.map(order => (
                                                        <tr key={order.id} className="hover:bg-slate-50">
                                                            <td className="px-6 py-4 font-mono font-bold text-blue-600">{order.orderNo}</td>
                                                            <td className="px-6 py-4 text-slate-600">{order.date}</td>
                                                            <td className="px-6 py-4 font-medium text-slate-800">{state.partners.find(p => p.id === order.customerId)?.name}</td>
                                                            <td className="px-6 py-4 text-center">
                                                                <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                    order.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                                                                    order.status === 'PartiallyShipped' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                                }`}>{order.status.replace(/([A-Z])/g, ' $1').trim()}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-center text-slate-500">{order.items.length}</td>
                                                            <td className="px-6 py-4 text-right">
                                                                {order.status !== 'Completed' && (
                                                                    <button onClick={() => handleOpenShipmentModal(order)} className="text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                                                                        Convert to Invoice
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {filteredOngoingOrders.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No orders found.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- ORIGINAL OPENING FORM --- */}
                        {activeSubModule === 'original-opening' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="flex gap-4 mb-6 border-b border-slate-200">
                                    <button className={`pb-2 text-sm font-medium ${ooTab === 'supplier' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`} onClick={() => setOoTab('supplier')}>Supplier Opening</button>
                                    <button className={`pb-2 text-sm font-medium ${ooTab === 'bales' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`} onClick={() => setOoTab('bales')}>Bales Opening (Re-process)</button>
                                </div>
                                {ooTab === 'supplier' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        <div className="md:col-span-7 space-y-6">
                                            <form onSubmit={handleOpeningSubmit} className="space-y-6">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-600 mb-1">Entry Date</label>
                                                        <input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 border-slate-300" value={ooDate} onChange={e => setOoDate(e.target.value)} required />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-600 mb-1">Supplier</label>
                                                        <EntitySelector
                                                            entities={suppliersWithStock}
                                                            selectedId={ooSupplier}
                                                            onSelect={(id) => { setOoSupplier(id); setOoType(''); setOoProduct(''); setOoBatch(''); }}
                                                            placeholder="Select Supplier..."
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig, { type: PartnerType.SUPPLIER })}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-600 mb-1">Original Type</label>
                                                        <EntitySelector
                                                            entities={typesForSupplier}
                                                            selectedId={ooType}
                                                            onSelect={(id) => { setOoType(id); setOoProduct(''); setOoBatch(''); }}
                                                            placeholder="Select Type..."
                                                            disabled={!ooSupplier}
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.originalTypeConfig)}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-600 mb-1">Original Product (Optional)</label>
                                                        <EntitySelector
                                                            entities={productsForSelection}
                                                            selectedId={ooProduct}
                                                            onSelect={(id) => { setOoProduct(id); setOoBatch(''); }}
                                                            placeholder="All Products..."
                                                            disabled={!ooType}
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-600 mb-1">Batch Number (Optional)</label>
                                                    <EntitySelector
                                                        entities={batchesForSelection}
                                                        selectedId={ooBatch}
                                                        onSelect={setOoBatch}
                                                        placeholder="All Batches..."
                                                        disabled={!ooType}
                                                    />
                                                </div>
                                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex justify-between items-center">
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-500 uppercase">Available Stock (Not Yet Opened)</p>
                                                        <div className="flex items-baseline gap-2 mt-1">
                                                            {availableStockInfo.qty === 0 && availableStockInfo.weight > 0 ? (
                                                                <span className="text-2xl font-bold text-slate-800">N/A <span className="text-sm font-normal text-slate-500">(Kg Only)</span></span>
                                                            ) : (
                                                                <>
                                                                    <span className="text-2xl font-bold text-slate-800">{availableStockInfo.qty.toLocaleString()}</span>
                                                                    <span className="text-sm text-slate-600">Units</span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-400 mt-1">≈ {availableStockInfo.weight.toLocaleString()} Kg</p>
                                                        <p className="text-xs text-blue-600 mt-1 font-medium">ℹ️ This is physical stock not yet opened/processed</p>
                                                    </div>
                                                    <div className="text-right"><p className="text-xs font-semibold text-slate-500 uppercase">Est. Cost/Kg</p><span className="text-lg font-mono font-medium text-emerald-600">${availableStockInfo.avgCost.toFixed(3)}</span></div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div><label className="block text-sm font-medium text-slate-600 mb-1">Opened (Units/Weight)</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 font-bold" placeholder="0" value={ooQty} onChange={e => setOoQty(e.target.value)} required/></div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-600 mb-1">Total Weight (Auto)</label>
                                                        <input 
                                                            type="text" 
                                                            className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2.5 text-slate-500 cursor-not-allowed" 
                                                            value={
                                                                ooQty && availableStockInfo.qty > 0 
                                                                ? ((availableStockInfo.weight / availableStockInfo.qty) * parseFloat(ooQty)).toFixed(1) + ' Kg' 
                                                                : (ooQty ? ooQty + ' Kg (Est)' : '0 Kg')
                                                            } 
                                                            readOnly
                                                        />
                                                    </div>
                                                </div>
                                                <button type="submit" disabled={!ooQty || !ooType} className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors shadow-sm mt-2">+ Add to List</button>
                                            </form>
                                            
                                            {/* Bulk Upload CSV Section */}
                                            <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                                <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><FileText size={16} /> Bulk Upload (CSV)</h4>
                                                <div className="flex gap-3">
                                                    <label className="flex-1 cursor-pointer">
                                                        <input
                                                            type="file"
                                                            accept=".csv"
                                                            onChange={handleOriginalOpeningCSVUpload}
                                                            className="hidden"
                                                        />
                                                        <span className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-colors">
                                                            <Download size={18} /> Choose CSV File
                                                        </span>
                                                    </label>
                                                    <button
                                                        onClick={downloadOriginalOpeningTemplate}
                                                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-colors"
                                                    >
                                                        <FileText size={18} /> Download Template
                                                    </button>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-2">CSV must include: Date, Supplier ID, Original Type ID, Quantity. Original Product ID, Batch Number, and Weight (Kg) are optional.</p>
                                            </div>
                                            
                                            {/* Staging Cart */}
                                            {stagedOriginalOpenings.length > 0 && (
                                                <div className="mt-6 bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                                                    <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                                                        <Package size={16} /> Staging Cart ({stagedOriginalOpenings.length} items)
                                                    </h4>
                                                    <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                                                        {stagedOriginalOpenings.map(o => {
                                                            const supName = state.partners.find(p => p.id === o.supplierId)?.name || 'Unknown';
                                                            const typeName = state.originalTypes.find(t => t.id === o.originalType)?.name || o.originalType;
                                                            return (
                                                                <div key={o.id} className="bg-white p-2 rounded border border-amber-200 flex justify-between items-center">
                                                                    <div className="text-sm">
                                                                        <div className="font-medium text-slate-700">{supName} - {typeName}</div>
                                                                        <div className="text-xs text-slate-500">{o.qtyOpened} Units ({o.weightOpened.toFixed(1)} kg)</div>
                                                                    </div>
                                                                    <button onClick={() => handleRemoveStagedOpening(o.id)} className="text-red-500 hover:text-red-700 p-1">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <button 
                                                        onClick={handleCompleteOriginalOpenings}
                                                        disabled={isProcessingOpenings}
                                                        className={`w-full font-bold py-3 rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2 ${
                                                            isProcessingOpenings 
                                                                ? 'bg-blue-400 cursor-not-allowed' 
                                                                : 'bg-blue-600 hover:bg-blue-700'
                                                        } text-white`}
                                                    >
                                                        {isProcessingOpenings ? (
                                                            <>
                                                                <RefreshCw size={18} className="animate-spin" />
                                                                <span>
                                                                    Processing... {processingProgress.current > 0 
                                                                        ? `${processingProgress.current}/${processingProgress.total}` 
                                                                        : `${stagedOriginalOpenings.length} entries`}
                                                                </span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircle size={18} />
                                                                <span>Complete & Save All ({stagedOriginalOpenings.length})</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* History Table Column */}
                                        <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col h-full">
                                            <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                                <History size={16} className="text-slate-400" /> Entries for {ooDate}
                                            </h4>
                                            <div className="flex-1 overflow-y-auto min-h-[300px]">
                                                {openingsForDate.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                                                        <Package size={32} className="mb-2 opacity-30" />
                                                        <p className="italic">No entries for this date.</p>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-3">
                                                        {openingsForDate.map(o => {
                                                            const supName = state.partners.find(p => p.id === o.supplierId)?.name || 'Unknown';
                                                            const typeName = state.originalTypes.find(t => t.id === o.originalType)?.name || o.originalType;
                                                            return (
                                                                <div key={o.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="font-medium text-slate-700 text-sm">
                                                                            {supName}
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => handleDeleteOpening(o.id)}
                                                                            className="text-slate-300 hover:text-red-600 transition-colors p-1"
                                                                            title="Delete & Reverse Entry"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                    <div className="text-xs text-slate-500">
                                                                        {typeName} {o.batchNumber && <span className="bg-slate-100 px-1 rounded ml-1">#{o.batchNumber}</span>}
                                                                    </div>
                                                                    <div className="flex justify-between items-end border-t border-slate-100 pt-2 mt-1">
                                                                        <div className="text-xs text-slate-400 font-mono">ID: {o.id.substr(0,6)}</div>
                                                                        <div className="text-right">
                                                                            <span className="font-bold text-slate-800 text-sm">{o.qtyOpened.toLocaleString()} Units</span>
                                                                            <div className="text-xs text-slate-500">{o.weightOpened.toLocaleString()} kg</div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                        <div className="md:col-span-6 space-y-6">
                                            <form onSubmit={handleStageBaleOpening} className="space-y-6">
                                                <div><label className="block text-sm font-medium text-slate-600 mb-1">Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-500 border-slate-300" value={boDate} onChange={e => setBoDate(e.target.value)} /></div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-600 mb-1">Select Finished Good</label>
                                                    <EntitySelector
                                                        entities={state.items.filter(i => i.category !== 'Raw Material')}
                                                        selectedId={boItemId}
                                                        onSelect={setBoItemId}
                                                        placeholder="Select Item..."
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                                        formatOption={formatItemOption}
                                                        formatSelected={formatItemSelected}
                                                        searchFields={['code', 'name', 'category']}
                                                    />
                                                </div>
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between"><span className="text-sm text-slate-500">Stock: {boAvailableStock}</span><span className="text-sm font-bold text-slate-700">{boSelectedItem ? boSelectedItem.packingType : ''}</span></div>
                                                <div><label className="block text-sm font-medium text-slate-600 mb-1">Open Qty</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:border-blue-500 border-slate-300" value={boQty} onChange={e => setBoQty(e.target.value)} /><div className="text-xs text-right mt-1 text-slate-500">{boEstimatedWeight.toFixed(1)} Kg</div></div>
                                                <button type="submit" disabled={!boItemId || !boQty} className="w-full bg-slate-800 text-white py-2 rounded-lg font-medium hover:bg-slate-700 shadow-sm">Add to List</button>
                                            </form>
                                        </div>
                                        <div className="md:col-span-6 flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl p-4">
                                            <div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-slate-700">Staged Entries</h4>{stagedBaleOpenings.length > 0 && ( <button onClick={handlePostBaleOpening} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm font-bold">Post All</button> )}</div>
                                            <div className="flex-1 overflow-y-auto space-y-2 mb-4">{stagedBaleOpenings.map(s => ( <div key={s.id} className="bg-yellow-50 border border-yellow-200 p-2 rounded flex justify-between text-sm"><div><div className="font-medium text-slate-800">{s.itemName}</div><div className="text-xs text-slate-500">{s.qty} units • {s.weight} kg</div></div><button onClick={() => setStagedBaleOpenings(stagedBaleOpenings.filter(x => x.id !== s.id))} className="text-red-400 hover:text-red-600"><X size={14} /></button></div> ))}</div>
                                            <div className="border-t border-slate-200 pt-4"><h5 className="font-semibold text-xs text-slate-500 uppercase mb-2">History ({boDate})</h5><div className="space-y-2 max-h-40 overflow-y-auto">{state.originalOpenings.filter(o => o.date === boDate && o.supplierId === 'SUP-INTERNAL-STOCK').map(o => ( <div key={o.id} className="bg-white border border-emerald-100 p-2 rounded flex justify-between text-sm shadow-sm"><div><div className="font-medium text-slate-800">{o.originalType.replace('FROM-', '')}</div><div className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={10} /> Posted • {o.qtyOpened} units</div></div></div> ))}</div></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* --- DIRECT SALES --- */}
                        {activeSubModule === 'direct-sales' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="flex gap-4 mb-6 border-b border-slate-200">
                                    <button className={`pb-2 text-sm font-medium ${dsMode === 'create' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`} onClick={() => { setDsMode('create'); setDsCustomer(''); setDsSupplier(''); setDsPurchaseId(''); setDsQty(''); setDsRate(''); }}>New Direct Sale</button>
                                    <button className={`pb-2 text-sm font-medium ${dsMode === 'view' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`} onClick={() => setDsMode('view')}>View / Update</button>
                                </div>

                                {dsMode === 'create' ? (
                                    <div className="max-w-2xl mx-auto">
                                        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                            <Truck className="text-blue-600" /> Direct Sale (Raw Material)
                                        </h3>
                                        <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={dsDate} onChange={e => setDsDate(e.target.value)} /></div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Customer</label>
                                            <EntitySelector 
                                                entities={state.partners.filter(p => p.type === PartnerType.CUSTOMER)} 
                                                selectedId={dsCustomer} 
                                                onSelect={setDsCustomer} 
                                                placeholder="Select Customer..." 
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                        <h4 className="font-bold text-slate-700 text-sm uppercase">Select Stock</h4>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Supplier</label>
                                            <EntitySelector 
                                                entities={state.partners.filter(p => p.type === PartnerType.SUPPLIER)} 
                                                selectedId={dsSupplier} 
                                                onSelect={setDsSupplier} 
                                                placeholder="Filter by Supplier..." 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Batch Number (Available Stock)</label>
                                            <EntitySelector 
                                                entities={dsBatches} 
                                                selectedId={dsPurchaseId} 
                                                onSelect={setDsPurchaseId} 
                                                placeholder={dsSupplier ? "Select Batch..." : "Select Supplier First"}
                                                disabled={!dsSupplier}
                                            />
                                        </div>

                                        {dsSelectedBatch && (
                                            <div className="bg-white p-4 rounded-lg border border-blue-100 flex justify-between items-center mt-2">
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase">Landed Cost / Kg</div>
                                                    <div className="text-xl font-mono font-bold text-slate-800">${dsSelectedBatch.landedCostPerKg.toFixed(3)}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-slate-500 uppercase">Available</div>
                                                    <div className="text-lg font-bold text-emerald-600">{dsSelectedBatch.remaining.toLocaleString()} Kg</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Quantity (Kg)</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-bold" value={dsQty} onChange={e => setDsQty(e.target.value)} /></div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Sale Rate (USD / Kg)</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-bold" value={dsRate} onChange={e => setDsRate(e.target.value)} /></div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                         <div>
                                             <label className="block text-xs font-medium text-slate-500 mb-1">Customer Currency</label>
                                             <input type="text" className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-800 text-sm font-mono font-bold" value={dsCurrency} readOnly />
                                             <p className="text-xs text-slate-500 mt-1">For ledger display</p>
                                         </div>
                                         <div>
                                             <label className="block text-xs font-medium text-slate-500 mb-1">Exchange Rate</label>
                                             <input type="number" step="0.0001" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm font-mono" value={dsExchangeRate} onChange={e => setDsExchangeRate(parseFloat(e.target.value) || 1)} />
                                             <p className="text-xs text-slate-500 mt-1">Update if needed</p>
                                         </div>
                                    </div>

                                            <button 
                                                onClick={handleRecordDirectSale} 
                                                disabled={!dsSelectedBatch || !dsQty}
                                                className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 shadow-lg disabled:bg-slate-300 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                            >
                                                <Truck size={18} /> Record Direct Sale
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs">
                                                <tr>
                                                    <th className="px-4 py-3">Date</th>
                                                    <th className="px-4 py-3">Invoice #</th>
                                                    <th className="px-4 py-3">Customer</th>
                                                    <th className="px-4 py-3 text-right">Qty (Kg)</th>
                                                    <th className="px-4 py-3 text-right">Net Total</th>
                                                    <th className="px-4 py-3 text-center">Status</th>
                                                    <th className="px-4 py-3 text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {state.salesInvoices.filter(inv => 
                                                    inv.invoiceNo.startsWith('DS-') || 
                                                    inv.invoiceNo.startsWith('DSINV-') ||
                                                    inv.items.some(item => item.originalPurchaseId) // Also show invoices with originalPurchaseId (direct sales)
                                                ).map(inv => (
                                                    <tr key={inv.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">{inv.date}</td>
                                                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{inv.invoiceNo}</td>
                                                        <td className="px-4 py-3">{state.partners.find(p => p.id === inv.customerId)?.name}</td>
                                                        <td className="px-4 py-3 text-right font-mono">{inv.items.reduce((sum, i) => sum + i.totalKg, 0).toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right font-mono">{inv.netTotal.toLocaleString()} {inv.currency}</td>
                                                        <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${inv.status === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{inv.status}</span></td>
                                                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                                                            <button onClick={() => handleDeleteDirectSale(inv.id)} className="text-red-400 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {state.salesInvoices.filter(inv => 
                                                    inv.invoiceNo.startsWith('DS-') || 
                                                    inv.invoiceNo.startsWith('DSINV-') ||
                                                    inv.items.some(item => item.originalPurchaseId)
                                                ).length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No direct sales found.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                             </div>
                        )}

                        {/* --- ORIGINAL PURCHASE FORM --- */}
                        {activeSubModule === 'original-purchase' && (
                            <div className="animate-in fade-in duration-300 max-w-6xl mx-auto">
                                {/* Mode Toggle */}
                                <div className="mb-6 flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Box className="text-blue-600" /> {purEditingId ? 'Edit Purchase' : (purMode === 'create' ? 'New Raw Material Purchase' : 'Manage Purchases')}
                                    </h3>
                                    {!purEditingId && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPurMode('create')}
                                                className={`px-4 py-2 rounded-lg font-medium transition-all ${purMode === 'create' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                Create New
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPurMode('manage')}
                                                className={`px-4 py-2 rounded-lg font-medium transition-all ${purMode === 'manage' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                Manage Existing
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Manage Mode - List View */}
                                {purMode === 'manage' && !purEditingId && (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                                            <h4 className="font-bold text-slate-800">Purchase List</h4>
                                            <p className="text-xs text-slate-500 mt-1">{state.purchases.length} purchase(s) recorded</p>
                                            {(() => {
                                                console.log('🔍 DataEntry Component - Purchases count:', state.purchases.length);
                                                console.log('🔍 DataEntry Component - First 3 purchases:', state.purchases.slice(0, 3).map(p => ({ id: p.id, batch: p.batchNumber, factoryId: p.factoryId })));
                                                return null;
                                            })()}
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Batch #</th>
                                                        <th className="px-4 py-3 text-left">Date</th>
                                                        <th className="px-4 py-3 text-left">Supplier</th>
                                                        <th className="px-4 py-3 text-left">Original Types</th>
                                                        <th className="px-4 py-3 text-right">Weight (Kg)</th>
                                                        <th className="px-4 py-3 text-right">Value (USD)</th>
                                                        <th className="px-4 py-3 text-center">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {(() => {
                                                        console.log('🔍 Rendering table - purchases.length:', state.purchases.length);
                                                        if (state.purchases.length === 0) {
                                                            console.warn('⚠️ No purchases in state.purchases array!');
                                                            return (
                                                                <tr>
                                                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                                                        No purchases found. Click "Create New" to add your first purchase.
                                                                        <br />
                                                                        <span className="text-xs text-red-400 mt-2 block">
                                                                            Debug: state.purchases.length = {state.purchases.length}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }
                                                        return state.purchases.map(purchase => {
                                                            const supplier = state.partners.find(p => p.id === purchase.supplierId);
                                                            const originalTypes = purchase.items?.length > 0
                                                                ? purchase.items.map(item => state.originalTypes.find(t => t.id === item.originalTypeId)?.name || 'Unknown').join(', ')
                                                                : (state.originalTypes.find(t => t.id === purchase.originalTypeId)?.name || 'Unknown');
                                                            
                                                            return (
                                                                <tr key={purchase.id} className="hover:bg-slate-50">
                                                                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{purchase.batchNumber}</td>
                                                                    <td className="px-4 py-3">{new Date(purchase.date).toLocaleDateString()}</td>
                                                                    <td className="px-4 py-3 font-medium">{supplier?.name || 'Unknown'}</td>
                                                                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={originalTypes}>{originalTypes}</td>
                                                                    <td className="px-4 py-3 text-right font-mono">{purchase.weightPurchased.toLocaleString()}</td>
                                                                    <td className="px-4 py-3 text-right font-mono text-emerald-600">${purchase.totalLandedCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <button
                                                                                onClick={() => initiatePurchaseAction('EDIT', purchase.id)}
                                                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium text-xs transition-all"
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                onClick={() => initiatePurchaseAction('DELETE', purchase.id)}
                                                                                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium text-xs transition-all"
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        });
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Create/Edit Mode - Form View */}
                                {(purMode === 'create' || purEditingId) && (
                                <form onSubmit={handlePreSubmitPurchase} className="space-y-6">
                                    {purEditingId && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                            <p className="text-sm font-medium text-amber-800">
                                                Editing Purchase: <span className="font-bold">{purBatch}</span>
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="mt-2 text-xs text-amber-600 hover:text-amber-800 font-medium"
                                            >
                                                Cancel Edit
                                            </button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-2 md:col-span-1">
                                            <span className="inline-block mb-2 text-green-600 font-semibold text-sm">Note (Active)</span>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Batch Number</label>
                                            <input type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 border-slate-300 font-mono font-bold" value={purBatch} onChange={e => setPurBatch(e.target.value)} required />
                                            <p className="text-xs text-slate-400 mt-1">Auto-generated (Editable)</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Date</label>
                                            <input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 border-slate-300" value={purDate} onChange={e => setPurDate(e.target.value)} required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Supplier</label>
                                            <EntitySelector
                                                entities={state.partners.filter(p => p.type === 'SUPPLIER')}
                                                selectedId={purSupplier}
                                                onSelect={setPurSupplier}
                                                placeholder="Select Supplier..."
                                                required
                                                onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig, { type: PartnerType.SUPPLIER })}
                                            />
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-slate-500 mb-1">Currency</label><select value={purCurrency} onChange={e => setPurCurrency(e.target.value as Currency)} className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-800 text-sm font-mono">{state.currencies.length > 0 ? state.currencies.map(c => ( <option key={c.code} value={c.code}>{c.code}</option> )) : <option value="USD">USD</option>}</select></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Rate</label><input type="number" value={purExchangeRate} onChange={e => setPurExchangeRate(parseFloat(e.target.value))} step="0.0001" className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-800 text-sm font-mono"/></div></div>
                                    </div>

                                    {/* Logistics & Destination */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                        <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase"><Truck size={16} /> Logistics & Destination</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Container Number</label><input type="text" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={purContainer} onChange={e => setPurContainer(e.target.value)} placeholder="e.g. MSCU1234567" /></div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Division</label>
                                                <EntitySelector
                                                    entities={state.divisions}
                                                    selectedId={purDivision}
                                                    onSelect={setPurDivision}
                                                    placeholder="Select..."
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.divisionConfig)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Sub-Division</label>
                                                <EntitySelector
                                                    entities={state.subDivisions.filter(sd => sd.divisionId === purDivision)}
                                                    selectedId={purSubDivision}
                                                    onSelect={setPurSubDivision}
                                                    placeholder="Select..."
                                                    disabled={!purDivision}
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.subDivisionConfig, { divisionId: purDivision })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1 flex items-center gap-2">Original Type <span className="text-green-600 font-semibold text-xs">Active</span></label>
                                            <EntitySelector
                                                entities={state.originalTypes}
                                                selectedId={purOriginalTypeId}
                                                onSelect={(id) => { setPurOriginalTypeId(id); setPurOriginalProductId(''); }}
                                                placeholder="Select Original Type..."
                                                onQuickAdd={() => openQuickAdd(setupConfigs.originalTypeConfig)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Sub Supplier</label>
                                            <EntitySelector
                                                entities={state.partners.filter(p => {
                                                    if (p.type !== PartnerType.SUB_SUPPLIER) return false;
                                                    if (!purSupplier) return false;
                                                    // Match by ID (new format) or by name (legacy format)
                                                    const selectedSupplier = state.partners.find(s => s.id === purSupplier);
                                                    const parentId = p.parentSupplierId || (p as any).parentSupplier;
                                                    return parentId === purSupplier || 
                                                           (selectedSupplier && parentId === selectedSupplier.name);
                                                })}
                                                selectedId={purSubSupplierId}
                                                onSelect={setPurSubSupplierId}
                                                placeholder="Select Sub Supplier..."
                                                disabled={!purSupplier}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Original Product (Optional)</label>
                                            <EntitySelector
                                                entities={filteredProducts}
                                                selectedId={purOriginalProductId}
                                                onSelect={setPurOriginalProductId}
                                                placeholder="Select Product..."
                                                disabled={!purOriginalTypeId}
                                                onQuickAdd={() => openQuickAdd(setupConfigs.originalProductConfig, { originalTypeId: purOriginalTypeId })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Weight (Kg)</label><input type="number" placeholder="0.00" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500" value={purWeight} onChange={e => setPurWeight(e.target.value)}/></div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Price per Kg ({purCurrency})</label><input type="number" placeholder="0.00" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 font-bold" value={purPrice} onChange={e => setPurPrice(e.target.value)}/></div>
                                    </div>

                                    {/* Discount & Surcharge for this item */}
                                    <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">Discount/Kg ({purCurrency})</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={purItemDiscount} onChange={e => setPurItemDiscount(e.target.value)}/></div>
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">Surcharge/Kg ({purCurrency})</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={purItemSurcharge} onChange={e => setPurItemSurcharge(e.target.value)}/></div>
                                        <div className="flex items-end"><button type="button" onClick={handleAddToPurCart} disabled={!purOriginalTypeId || !purWeight || !purPrice} className="w-full bg-blue-600 text-white p-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 flex items-center justify-center gap-1"><Plus size={16}/> Add to Cart</button></div>
                                    </div>

                                    {/* Cart Display */}
                                    {purCart.length > 0 && (
                                        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden">
                                            <div className="bg-slate-700 text-white p-3 font-bold text-sm">Purchase Cart ({purCart.length} type{purCart.length > 1 ? 's' : ''})</div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-100 text-slate-600">
                                                        <tr>
                                                            <th className="p-2 text-left">Original Type</th>
                                                            <th className="p-2 text-left">Sub Supplier</th>
                                                            <th className="p-2 text-right">Weight (Kg)</th>
                                                            <th className="p-2 text-right">Price/Kg</th>
                                                            <th className="p-2 text-right">Discount</th>
                                                            <th className="p-2 text-right">Surcharge</th>
                                                            <th className="p-2 text-right">Total ({purCurrency})</th>
                                                            <th className="p-2 text-right">Total (USD)</th>
                                                            <th className="p-2"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {purCart.map(item => (
                                                            <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50">
                                                                <td className="p-2 font-medium text-slate-700">{item.originalType}</td>
                                                                <td className="p-2 font-medium text-slate-700">{item.subSupplierId ? (state.partners.find(p => p.id === item.subSupplierId)?.name || '-') : '-'}</td>
                                                                <td className="p-2 text-right font-mono">{(item.weightPurchased || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono">{(item.costPerKgFCY || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono text-green-600">{item.discountPerKgFCY ? `-${(item.discountPerKgFCY || 0).toFixed(2)}` : '-'}</td>
                                                                <td className="p-2 text-right font-mono text-orange-600">{item.surchargePerKgFCY ? `+${(item.surchargePerKgFCY || 0).toFixed(2)}` : '-'}</td>
                                                                <td className="p-2 text-right font-mono font-bold">{(item.totalCostFCY || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono font-bold text-blue-600">${(item.totalCostUSD || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right"><button type="button" onClick={() => handleRemoveFromPurCart(item.id)} className="text-red-500 hover:text-red-700"><X size={16}/></button></td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                                                            <td className="p-2">TOTALS</td>
                                                            <td className="p-2 text-right font-mono">{purCart.reduce((s,i)=>s+(i.weightPurchased || 0),0).toFixed(2)}</td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2 text-right font-mono text-blue-700">{purCart.reduce((s,i)=>s+(i.totalCostFCY || 0),0).toFixed(2)}</td>
                                                            <td className="p-2 text-right font-mono text-blue-700">${purCart.reduce((s,i)=>s+(i.totalCostUSD || 0),0).toFixed(2)}</td>
                                                            <td className="p-2"></td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t border-slate-200 pt-6">
                                        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Anchor size={18} className="text-blue-500" /> Landed Cost / Additional Charges</h4>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Charge Type</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acType} onChange={e => { setAcType(e.target.value as any); setAcProvider(''); setAcCustomName(''); }}><option value="Freight">Freight</option><option value="Clearing">Clearing</option><option value="Commission">Commission</option><option value="Other">Other</option></select></div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                                                        {acType === 'Other' ? 'Charge Description' : 'Provider/Agent'}
                                                    </label>
                                                    {acType === 'Other' ? (
                                                        <input
                                                            type="text"
                                                            value={acCustomName}
                                                            onChange={(e) => setAcCustomName(e.target.value)}
                                                            placeholder="e.g., VAT, Custom Duty..."
                                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800"
                                                        />
                                                    ) : (
                                                        <EntitySelector
                                                            entities={filteredProviders}
                                                            selectedId={acProvider}
                                                            onSelect={setAcProvider}
                                                            placeholder="Select..."
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig)}
                                                        />
                                                    )}
                                                    {acType === 'Other' && (
                                                        <p className="text-xs text-slate-400 mt-1">This will be recorded as payable to the supplier</p>
                                                    )}
                                                </div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acCurrency} onChange={e => setAcCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acAmount} onChange={e => setAcAmount(e.target.value)}/></div>
                                                <div className="md:col-span-1 flex items-end"><button type="button" onClick={handleAddCost} disabled={(acType === 'Other' ? !acCustomName : !acProvider) || !acAmount} className="w-full bg-slate-800 text-white p-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:bg-slate-300">Add Cost</button></div>
                                            </div>
                                            <div className="space-y-2">{additionalCosts.map(cost => { const providerName = cost.costType === 'Other' && cost.customName ? cost.customName : state.partners.find(p=>p.id===cost.providerId)?.name; return ( <div key={cost.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-sm"><div className="flex gap-4"><span className="font-semibold text-slate-700 w-24">{cost.costType}</span><span className="text-slate-600">{providerName || 'Unknown'}</span></div><div className="flex items-center gap-4"><span className="font-mono">{cost.amountFCY} {cost.currency}</span><span className="text-slate-400 text-xs">Rate: {cost.exchangeRate}</span><span className="font-mono font-bold text-blue-600 w-20 text-right">${(cost.amountUSD || 0).toFixed(2)}</span><button type="button" onClick={() => setAdditionalCosts(additionalCosts.filter(c => c.id !== cost.id))} className="text-red-400 hover:text-red-600"><X size={14}/></button></div></div> ); })}</div>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
                                        <div className="flex justify-between text-sm"><span className="text-slate-500">Material Cost (Base USD):</span><span className="font-mono font-bold">${purCart.reduce((s,i)=>s+i.totalCostUSD,0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-slate-500">Additional Costs (Base USD):</span><span className="font-mono font-bold">${additionalCosts.reduce((s, c) => s + c.amountUSD, 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                        <div className="flex justify-between text-lg border-t border-blue-200 pt-2 mt-2"><span className="text-blue-800 font-bold">Total Landed Cost (USD):</span><span className="font-mono font-bold text-blue-800">${( purCart.reduce((s,i)=>s+i.totalCostUSD,0) + additionalCosts.reduce((s, c) => s + c.amountUSD, 0) ).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                    </div>
                                    
                                    {/* Bulk Upload CSV Section */}
                                    <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                        <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><FileText size={16} /> Bulk Upload (CSV)</h4>
                                        <div className="flex gap-3">
                                            <label className="flex-1 cursor-pointer">
                                                <input
                                                    type="file"
                                                    accept=".csv"
                                                    onChange={handleOriginalPurchaseCSVUpload}
                                                    className="hidden"
                                                />
                                                <span className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-colors">
                                                    <Download size={18} /> Choose CSV File
                                                </span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={downloadOriginalPurchaseTemplate}
                                                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-colors"
                                            >
                                                <FileText size={18} /> Download Template
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">CSV must include: Original Type ID, Weight (Kg), Price per Kg (USD). Date, Supplier ID, Original Product ID, Sub Supplier ID, Discount/Surcharge, Batch Number, Container Number, and Division IDs are optional.</p>
                                    </div>
                                    
                                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm mt-4 flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!purSupplier || purCart.length === 0}><FileText size={18} /> Review & Submit</button>
                                </form>
                                )}
                            </div>
                        )}

                        {/* --- OPTIONAL FORM --- */}
                        {activeSubModule === 'original-purchase-2' && (
                            <div className="animate-in fade-in duration-300 max-w-6xl mx-auto">
                                {/* Mode Toggle */}
                                <div className="mb-6 flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                        <Box className="text-blue-600" /> {purEditingId ? 'Edit Purchase-2' : (purMode === 'create' ? 'New Raw Material Purchase-2' : 'Manage Purchases-2')}
                                    </h3>
                                    {!purEditingId && (
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setPurMode('create')}
                                                className={`px-4 py-2 rounded-lg font-medium transition-all ${purMode === 'create' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                Create New
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setPurMode('manage')}
                                                className={`px-4 py-2 rounded-lg font-medium transition-all ${purMode === 'manage' ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                            >
                                                Manage Existing
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {/* Welcome Note for Optional */}
                                <div className="mb-4 flex justify-end">
                                    <span className="text-blue-700 font-semibold text-base">Welcome Optional</span>
                                </div>

                                {/* Manage Mode - List View */}
                                {purMode === 'manage' && !purEditingId && (
                                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                                            <h4 className="font-bold text-slate-800">Purchase-2 List</h4>
                                            <p className="text-xs text-slate-500 mt-1">{state.purchases.length} purchase(s) recorded</p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Batch #</th>
                                                        <th className="px-4 py-3 text-left">Date</th>
                                                        <th className="px-4 py-3 text-left">Supplier</th>
                                                        <th className="px-4 py-3 text-left">Original Types</th>
                                                        <th className="px-4 py-3 text-right">Weight (Kg)</th>
                                                        <th className="px-4 py-3 text-right">Value (USD)</th>
                                                        <th className="px-4 py-3 text-center">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {state.purchases.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                                                                No purchases found. Click "Create New" to add your first purchase.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        state.purchases.map(purchase => {
                                                            const supplier = state.partners.find(p => p.id === purchase.supplierId);
                                                            const originalTypes = purchase.items?.length > 0
                                                                ? purchase.items.map(item => state.originalTypes.find(t => t.id === item.originalTypeId)?.name || 'Unknown').join(', ')
                                                                : (state.originalTypes.find(t => t.id === purchase.originalTypeId)?.name || 'Unknown');
                                                            
                                                            return (
                                                                <tr key={purchase.id} className="hover:bg-slate-50">
                                                                    <td className="px-4 py-3 font-mono font-bold text-blue-600">{purchase.batchNumber}</td>
                                                                    <td className="px-4 py-3">{new Date(purchase.date).toLocaleDateString()}</td>
                                                                    <td className="px-4 py-3 font-medium">{supplier?.name || 'Unknown'}</td>
                                                                    <td className="px-4 py-3 text-xs text-slate-600 max-w-xs truncate" title={originalTypes}>{originalTypes}</td>
                                                                    <td className="px-4 py-3 text-right font-mono">{purchase.weightPurchased.toLocaleString()}</td>
                                                                    <td className="px-4 py-3 text-right font-mono text-emerald-600">${purchase.totalLandedCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <button
                                                                                onClick={() => initiatePurchaseAction('EDIT', purchase.id)}
                                                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium text-xs transition-all"
                                                                            >
                                                                                Edit
                                                                            </button>
                                                                            <button
                                                                                onClick={() => initiatePurchaseAction('DELETE', purchase.id)}
                                                                                className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium text-xs transition-all"
                                                                            >
                                                                                Delete
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Create/Edit Mode - Form View */}
                                {(purMode === 'create' || purEditingId) && (
                                <form onSubmit={handlePreSubmitPurchase} className="space-y-6">
                                    {purEditingId && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                            <p className="text-sm font-medium text-amber-800">
                                                Editing Purchase-2: <span className="font-bold">{purBatch}</span>
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="mt-2 text-xs text-amber-600 hover:text-amber-800 font-medium"
                                            >
                                                Cancel Edit
                                            </button>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-2 md:col-span-1"><label className="block text-sm font-medium text-slate-600 mb-1">Batch Number</label><input type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 border-slate-300 font-mono font-bold" value={purBatch} onChange={e => setPurBatch(e.target.value)} required /><p className="text-xs text-slate-400 mt-1">Auto-generated (Editable)</p></div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 border-slate-300" value={purDate} onChange={e => setPurDate(e.target.value)} required /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Supplier</label>
                                            <EntitySelector
                                                entities={state.partners.filter(p => p.type === 'SUPPLIER')}
                                                selectedId={purSupplier}
                                                onSelect={setPurSupplier}
                                                placeholder="Select Supplier..."
                                                required
                                                onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig, { type: PartnerType.SUPPLIER })}
                                            />
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-3"><div><label className="block text-xs font-medium text-slate-500 mb-1">Currency</label><select value={purCurrency} onChange={e => setPurCurrency(e.target.value as Currency)} className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-800 text-sm font-mono">{state.currencies.length > 0 ? state.currencies.map(c => ( <option key={c.code} value={c.code}>{c.code}</option> )) : <option value="USD">USD</option>}</select></div><div><label className="block text-xs font-medium text-slate-500 mb-1">Rate</label><input type="number" value={purExchangeRate} onChange={e => setPurExchangeRate(parseFloat(e.target.value))} step="0.0001" className="w-full bg-white border border-slate-300 rounded-md p-2 text-slate-800 text-sm font-mono"/></div></div>
                                    </div>

                                    {/* Logistics & Destination */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                        <h4 className="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase"><Truck size={16} /> Logistics & Destination</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div><label className="block text-xs font-semibold text-slate-500 mb-1">Container Number</label><input type="text" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={purContainer} onChange={e => setPurContainer(e.target.value)} placeholder="e.g. MSCU1234567" /></div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Division</label>
                                                <EntitySelector
                                                    entities={state.divisions}
                                                    selectedId={purDivision}
                                                    onSelect={setPurDivision}
                                                    placeholder="Select..."
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.divisionConfig)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Sub-Division</label>
                                                <EntitySelector
                                                    entities={state.subDivisions.filter(sd => sd.divisionId === purDivision)}
                                                    selectedId={purSubDivision}
                                                    onSelect={setPurSubDivision}
                                                    placeholder="Select..."
                                                    disabled={!purDivision}
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.subDivisionConfig, { divisionId: purDivision })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Original Type</label>
                                            <EntitySelector
                                                entities={state.originalTypes}
                                                selectedId={purOriginalTypeId}
                                                onSelect={(id) => { setPurOriginalTypeId(id); setPurOriginalProductId(''); }}
                                                placeholder="Select Original Type..."
                                                onQuickAdd={() => openQuickAdd(setupConfigs.originalTypeConfig)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Original Product (Optional)</label>
                                            <EntitySelector
                                                entities={filteredProducts}
                                                selectedId={purOriginalProductId}
                                                onSelect={setPurOriginalProductId}
                                                placeholder="Select Product..."
                                                disabled={!purOriginalTypeId}
                                                onQuickAdd={() => openQuickAdd(setupConfigs.originalProductConfig, { originalTypeId: purOriginalTypeId })}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Weight (Kg)</label><input type="number" placeholder="0.00" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500" value={purWeight} onChange={e => setPurWeight(e.target.value)}/></div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Price per Kg ({purCurrency})</label><input type="number" placeholder="0.00" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 font-bold" value={purPrice} onChange={e => setPurPrice(e.target.value)}/></div>
                                    </div>

                                    {/* Discount & Surcharge for this item */}
                                    <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">Discount/Kg ({purCurrency})</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={purItemDiscount} onChange={e => setPurItemDiscount(e.target.value)}/></div>
                                        <div><label className="block text-xs font-semibold text-slate-500 mb-1">Surcharge/Kg ({purCurrency})</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={purItemSurcharge} onChange={e => setPurItemSurcharge(e.target.value)}/></div>
                                        <div className="flex items-end"><button type="button" onClick={handleAddToPurCart} disabled={!purOriginalTypeId || !purWeight || !purPrice} className="w-full bg-blue-600 text-white p-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-300 flex items-center justify-center gap-1"><Plus size={16}/> Add to Cart</button></div>
                                    </div>

                                    {/* Cart Display */}
                                    {purCart.length > 0 && (
                                        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden">
                                            <div className="bg-slate-700 text-white p-3 font-bold text-sm">Purchase-2 Cart ({purCart.length} type{purCart.length > 1 ? 's' : ''})</div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-slate-100 text-slate-600">
                                                        <tr>
                                                            <th className="p-2 text-left">Original Type</th>
                                                            <th className="p-2 text-right">Weight (Kg)</th>
                                                            <th className="p-2 text-right">Price/Kg</th>
                                                            <th className="p-2 text-right">Discount</th>
                                                            <th className="p-2 text-right">Surcharge</th>
                                                            <th className="p-2 text-right">Total ({purCurrency})</th>
                                                            <th className="p-2 text-right">Total (USD)</th>
                                                            <th className="p-2"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {purCart.map(item => (
                                                            <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-50">
                                                                <td className="p-2 font-medium text-slate-700">{item.originalType}</td>
                                                                <td className="p-2 text-right font-mono">{(item.weightPurchased || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono">{(item.costPerKgFCY || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono text-green-600">{item.discountPerKgFCY ? `-${(item.discountPerKgFCY || 0).toFixed(2)}` : '-'}</td>
                                                                <td className="p-2 text-right font-mono text-orange-600">{item.surchargePerKgFCY ? `+${(item.surchargePerKgFCY || 0).toFixed(2)}` : '-'}</td>
                                                                <td className="p-2 text-right font-mono font-bold">{(item.totalCostFCY || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono font-bold text-blue-600">${(item.totalCostUSD || 0).toFixed(2)}</td>
                                                                <td className="p-2 text-right"><button type="button" onClick={() => handleRemoveFromPurCart(item.id)} className="text-red-500 hover:text-red-700"><X size={16}/></button></td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                                                            <td className="p-2">TOTALS</td>
                                                            <td className="p-2 text-right font-mono">{purCart.reduce((s,i)=>s+(i.weightPurchased || 0),0).toFixed(2)}</td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2 text-right font-mono text-blue-700">{purCart.reduce((s,i)=>s+(i.totalCostFCY || 0),0).toFixed(2)}</td>
                                                            <td className="p-2 text-right font-mono text-blue-700">${purCart.reduce((s,i)=>s+(i.totalCostUSD || 0),0).toFixed(2)}</td>
                                                            <td className="p-2"></td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t border-slate-200 pt-6">
                                        <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Anchor size={18} className="text-blue-500" /> Landed Cost / Additional Charges</h4>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Charge Type</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acType} onChange={e => { setAcType(e.target.value as any); setAcProvider(''); setAcCustomName(''); }}><option value="Freight">Freight</option><option value="Clearing">Clearing</option><option value="Commission">Commission</option><option value="Other">Other</option></select></div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                                                        {acType === 'Other' ? 'Charge Description' : 'Provider/Agent'}
                                                    </label>
                                                    {acType === 'Other' ? (
                                                        <input
                                                            type="text"
                                                            value={acCustomName}
                                                            onChange={(e) => setAcCustomName(e.target.value)}
                                                            placeholder="e.g., VAT, Custom Duty..."
                                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800"
                                                        />
                                                    ) : (
                                                        <EntitySelector
                                                            entities={filteredProviders}
                                                            selectedId={acProvider}
                                                            onSelect={setAcProvider}
                                                            placeholder="Select..."
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig)}
                                                        />
                                                    )}
                                                    {acType === 'Other' && (
                                                        <p className="text-xs text-slate-400 mt-1">This will be recorded as payable to the supplier</p>
                                                    )}
                                                </div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acCurrency} onChange={e => setAcCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acAmount} onChange={e => setAcAmount(e.target.value)}/></div>
                                                <div className="md:col-span-1 flex items-end"><button type="button" onClick={handleAddCost} disabled={(acType === 'Other' ? !acCustomName : !acProvider) || !acAmount} className="w-full bg-slate-800 text-white p-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:bg-slate-300">Add Cost</button></div>
                                            </div>
                                            <div className="space-y-2">{additionalCosts.map(cost => { const providerName = cost.costType === 'Other' && cost.customName ? cost.customName : state.partners.find(p=>p.id===cost.providerId)?.name; return ( <div key={cost.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-sm"><div className="flex gap-4"><span className="font-semibold text-slate-700 w-24">{cost.costType}</span><span className="text-slate-600">{providerName || 'Unknown'}</span></div><div className="flex items-center gap-4"><span className="font-mono">{cost.amountFCY} {cost.currency}</span><span className="text-slate-400 text-xs">Rate: {cost.exchangeRate}</span><span className="font-mono font-bold text-blue-600 w-20 text-right">${(cost.amountUSD || 0).toFixed(2)}</span><button type="button" onClick={() => setAdditionalCosts(additionalCosts.filter(c => c.id !== cost.id))} className="text-red-400 hover:text-red-600"><X size={14}/></button></div></div> ); })}</div>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
                                        <div className="flex justify-between text-sm"><span className="text-slate-500">Material Cost (Base USD):</span><span className="font-mono font-bold">${purCart.reduce((s,i)=>s+i.totalCostUSD,0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-slate-500">Additional Costs (Base USD):</span><span className="font-mono font-bold">${additionalCosts.reduce((s, c) => s + c.amountUSD, 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                        <div className="flex justify-between text-lg border-t border-blue-200 pt-2 mt-2"><span className="text-blue-800 font-bold">Total Landed Cost (USD):</span><span className="font-mono font-bold text-blue-800">${( purCart.reduce((s,i)=>s+i.totalCostUSD,0) + additionalCosts.reduce((s, c) => s + c.amountUSD, 0) ).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                    </div>
                                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm mt-4 flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!purSupplier || purCart.length === 0}><FileText size={18} /> Review & Submit</button>
                                </form>
                                )}
                            </div>
                        )}

                        {/* --- BUNDLE PURCHASE FORM --- */}
                        {activeSubModule === 'bundle-purchase' && (
                            <div className="animate-in fade-in duration-300 max-w-5xl mx-auto">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <Layers className="text-blue-600" /> New Bundle Purchase (Stock Lot)
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    {/* Left: Core Info */}
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                             <div><label className="block text-sm font-medium text-slate-600 mb-1">Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={bpDate} onChange={e => setBpDate(e.target.value)} /></div>
                                             <div><label className="block text-sm font-medium text-slate-600 mb-1">Batch #</label><input type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono font-bold" value={bpBatch} onChange={e => setBpBatch(e.target.value)} /></div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Supplier</label>
                                            <EntitySelector
                                                entities={state.partners.filter(p => p.type === 'SUPPLIER')}
                                                selectedId={bpSupplier}
                                                onSelect={setBpSupplier}
                                                placeholder="Select Supplier..."
                                                onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig, { type: PartnerType.SUPPLIER })}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Currency</label><select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={bpCurrency} onChange={e => setBpCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Rate</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={bpExchangeRate} onChange={e => setBpExchangeRate(parseFloat(e.target.value))} /></div>
                                        </div>
                                    </div>
                                    {/* Right: Logistics */}
                                    <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Container Number</label><input type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={bpContainer} onChange={e => setBpContainer(e.target.value)} placeholder="e.g. MSCU1234567" /></div>
                                        <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Division</label>
                                                <EntitySelector
                                                    entities={state.divisions}
                                                    selectedId={bpDivision}
                                                    onSelect={setBpDivision}
                                                    placeholder="Select..."
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.divisionConfig)}
                                                />
                                             </div>
                                             <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Sub-Division</label>
                                                <EntitySelector
                                                    entities={state.subDivisions.filter(sd => sd.divisionId === bpDivision)}
                                                    selectedId={bpSubDivision}
                                                    onSelect={setBpSubDivision}
                                                    placeholder="Select..."
                                                    disabled={!bpDivision}
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.subDivisionConfig, { divisionId: bpDivision })}
                                                />
                                             </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Item Cart */}
                                <div className="border-t border-slate-200 pt-6 mb-6">
                                    <h4 className="font-bold text-slate-700 mb-4">Item Details (Cart)</h4>
                                    <div className="grid grid-cols-12 gap-3 mb-4 bg-slate-100 p-3 rounded-lg z-10 relative">
                                        <div className="col-span-5">
                                            <EntitySelector
                                                entities={state.items.filter(i => i.category !== 'Raw Material')}
                                                selectedId={bpItemId}
                                                onSelect={setBpItemId}
                                                placeholder="Select Item..."
                                                onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                                formatOption={formatItemOption}
                                                formatSelected={formatItemSelected}
                                                searchFields={['code', 'name', 'category']}
                                            />
                                        </div>
                                        <div className="col-span-2"><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Qty" value={bpItemQty} onChange={e => setBpItemQty(e.target.value)} /></div>
                                        <div className="col-span-3"><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder={`Rate (${bpCurrency})`} value={bpItemRate} onChange={e => setBpItemRate(e.target.value)} /></div>
                                        <div className="col-span-2"><button onClick={handleAddBpItem} className="w-full bg-blue-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-blue-700">Add Item</button></div>
                                    </div>
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Rate ({bpCurrency})</th><th className="px-4 py-2 text-right">Total ({bpCurrency})</th><th className="px-4 py-2 text-center">Action</th></tr>
                                            </thead>
                                            <tbody>
                                                {bpCart.map(item => (
                                                    <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                                        <td className="px-4 py-2">{state.items.find(i => i.id === item.itemId)?.name}</td>
                                                        <td className="px-4 py-2 text-right">{item.qty}</td>
                                                        <td className="px-4 py-2 text-right">{item.rateFCY.toFixed(2)}</td>
                                                        <td className="px-4 py-2 text-right font-medium">{item.totalFCY.toFixed(2)}</td>
                                                        <td className="px-4 py-2 text-center"><button onClick={() => setBpCart(bpCart.filter(x => x.id !== item.id))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td>
                                                    </tr>
                                                ))}
                                                {bpCart.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-slate-400 italic">No items added</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Additional Costs (Shared Logic) */}
                                <div className="border-t border-slate-200 pt-6 mb-6">
                                    <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Anchor size={18} className="text-blue-500" /> Landed Cost / Additional Charges</h4>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Charge Type</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acType} onChange={e => { setAcType(e.target.value as any); setAcProvider(''); setAcCustomName(''); }}><option value="Freight">Freight</option><option value="Clearing">Clearing</option><option value="Commission">Commission</option><option value="Other">Other</option></select></div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">
                                                        {acType === 'Other' ? 'Charge Description' : 'Provider/Agent'}
                                                    </label>
                                                    {acType === 'Other' ? (
                                                        <input
                                                            type="text"
                                                            value={acCustomName}
                                                            onChange={(e) => setAcCustomName(e.target.value)}
                                                            placeholder="e.g., VAT, Custom Duty..."
                                                            className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800"
                                                        />
                                                    ) : (
                                                        <EntitySelector
                                                            entities={filteredProviders}
                                                            selectedId={acProvider}
                                                            onSelect={setAcProvider}
                                                            placeholder="Select..."
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig)}
                                                        />
                                                    )}
                                                    {acType === 'Other' && (
                                                        <p className="text-xs text-slate-400 mt-1">This will be recorded as payable to the supplier</p>
                                                    )}
                                                </div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acCurrency} onChange={e => setAcCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acAmount} onChange={e => setAcAmount(e.target.value)}/></div>
                                                <div className="md:col-span-1 flex items-end"><button type="button" onClick={handleAddCost} disabled={(acType === 'Other' ? !acCustomName : !acProvider) || !acAmount} className="w-full bg-slate-800 text-white p-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:bg-slate-300">Add Cost</button></div>
                                            </div>
                                            <div className="space-y-2">{additionalCosts.map(cost => { const providerName = cost.costType === 'Other' && cost.customName ? cost.customName : state.partners.find(p=>p.id===cost.providerId)?.name; return ( <div key={cost.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-sm"><div className="flex gap-4"><span className="font-semibold text-slate-700 w-24">{cost.costType}</span><span className="text-slate-600">{providerName || 'Unknown'}</span></div><div className="flex items-center gap-4"><span className="font-mono">{cost.amountFCY} {cost.currency}</span><span className="text-slate-400 text-xs">Rate: {cost.exchangeRate}</span><span className="font-mono font-bold text-blue-600 w-20 text-right">${(cost.amountUSD || 0).toFixed(2)}</span><button type="button" onClick={() => setAdditionalCosts(additionalCosts.filter(c => c.id !== cost.id))} className="text-red-400 hover:text-red-600"><X size={14}/></button></div></div> ); })}</div>
                                    </div>
                                </div>

                                {/* Footer & Summary */}
                                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex justify-between items-center mt-6">
                                    <div>
                                        <div className="text-sm text-slate-500">Total Items Cost: <span className="font-bold text-slate-800">${bpCart.reduce((s,i) => s + i.totalUSD, 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                        <div className="text-sm text-slate-500">Total Additional Cost: <span className="font-bold text-slate-800">${additionalCosts.reduce((s,c) => s + c.amountUSD, 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400 uppercase font-bold">Grand Total (USD)</div>
                                        <div className="text-2xl font-mono font-bold text-blue-800">
                                            ${(bpCart.reduce((s,i) => s + i.totalUSD, 0) + additionalCosts.reduce((s,c) => s + c.amountUSD, 0)).toLocaleString(undefined, {maximumFractionDigits: 2})}
                                        </div>
                                    </div>
                                    <button onClick={handleFinalizeBundlePurchase} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-lg shadow-lg hover:bg-emerald-700">Finalize Purchase</button>
                                </div>
                            </div>
                        )}
                        
                        {/* --- SALES INVOICE --- */}
                        {activeSubModule === 'sales-invoice' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="flex gap-4 mb-6 border-b border-slate-200">
                                    <button className={`pb-2 text-sm font-medium ${siMode === 'create' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`} onClick={() => { setSiMode('create'); setSiId(''); setSiCart([]); setSiCosts([]); }}>New Invoice</button>
                                    <button className={`pb-2 text-sm font-medium ${siMode === 'view' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`} onClick={() => setSiMode('view')}>View / Update</button>
                                </div>
                                
                                {siMode === 'create' ? (
                                    <div className="max-w-5xl mx-auto space-y-6">
                                        {/* Core Info */}
                                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Customer</label>
                                                <EntitySelector 
                                                    entities={state.partners.filter(p => p.type === 'CUSTOMER')} 
                                                    selectedId={siCustomer} 
                                                    onSelect={setSiCustomer} 
                                                    placeholder="Select Customer..." 
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig, { type: PartnerType.CUSTOMER })}
                                                />
                                            </div>
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Invoice #</label><input type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono font-bold" value={siInvoiceNo} onChange={e => setSiInvoiceNo(e.target.value)} /></div>
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={siDate} onChange={e => setSiDate(e.target.value)} /></div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Customer Currency</label>
                                                <input type="text" className="w-full bg-slate-100 border border-slate-300 rounded-lg p-2 text-slate-800 font-mono text-sm font-bold" value={siCurrency} readOnly />
                                                <p className="text-xs text-slate-500 mt-1">For ledger display</p>
                                            </div>
                                            
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Branding / Logo <span className="text-red-500">*</span></label>
                                                <EntitySelector 
                                                    entities={state.logos} 
                                                    selectedId={siLogo} 
                                                    onSelect={setSiLogo} 
                                                    placeholder="Select Logo..." 
                                                    onQuickAdd={() => openQuickAdd(setupConfigs.logoConfig)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Packing Color</label>
                                                <select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={siColor} onChange={e => setSiColor(e.target.value)}>
                                                    <option value="">None</option><option value="Blue">Blue</option><option value="Red">Red</option><option value="Green">Green</option><option value="White">White</option><option value="Yellow">Yellow</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1">Exchange Rate</label>
                                                <input type="number" step="0.0001" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono text-sm" value={siExchangeRate} onChange={e => setSiExchangeRate(parseFloat(e.target.value) || 1)} />
                                                <p className="text-xs text-slate-500 mt-1">Update if needed</p>
                                            </div>
                                        </div>
                                        
                                        {/* Logistics */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Truck size={16} /> Logistics & Destination</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Container</label><input type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={siContainer} onChange={e => setSiContainer(e.target.value)} /></div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Division <span className="text-red-500">*</span></label>
                                                    <EntitySelector 
                                                        entities={state.divisions} 
                                                        selectedId={siDivision} 
                                                        onSelect={setSiDivision} 
                                                        placeholder="Select..." 
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.divisionConfig)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Sub-Division</label>
                                                    <EntitySelector 
                                                        entities={state.subDivisions.filter(s => s.divisionId === siDivision)} 
                                                        selectedId={siSubDivision} 
                                                        onSelect={setSiSubDivision} 
                                                        placeholder="Select..." 
                                                        disabled={!siDivision} 
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.subDivisionConfig, { divisionId: siDivision })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Port of Destination</label>
                                                    <EntitySelector 
                                                        entities={state.ports} 
                                                        selectedId={siPortOfDestination} 
                                                        onSelect={setSiPortOfDestination} 
                                                        placeholder="Select Port..." 
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.portConfig)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Discount</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" placeholder="0.00" value={siDiscount} onChange={e => setSiDiscount(e.target.value)} /></div>
                                                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Surcharge</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" placeholder="0.00" value={siSurcharge} onChange={e => setSiSurcharge(e.target.value)} /></div>
                                            </div>
                                        </div>
                                        
                                        {/* Item Cart */}
                                        <div className="border-t border-slate-200 pt-6">
                                             <div className="flex items-center justify-between mb-4">
                                                 <h4 className="font-bold text-slate-700">Item Entry</h4>
                                                 <div className="flex items-center gap-2">
                                                     <span className="text-xs text-slate-500 font-semibold">Rate Currency:</span>
                                                     <select 
                                                         value={siRateCurrency} 
                                                         onChange={e => setSiRateCurrency(e.target.value as 'customer' | 'base')}
                                                         className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-semibold text-slate-700"
                                                         title="Select currency for entering item rates (applies to all items in this invoice)"
                                                     >
                                                         <option value="base">USD (Base Currency)</option>
                                                         <option value="customer">{siCurrency} (Customer Currency)</option>
                                                     </select>
                                                     {siRateCurrency === 'customer' && siCurrency !== 'USD' && (
                                                         <span className="text-xs text-slate-400">
                                                             (Rate ÷ {siExchangeRate.toFixed(4)} = USD)
                                                         </span>
                                                     )}
                                                 </div>
                                             </div>
                                             <div className="bg-slate-100 p-3 rounded-lg mb-4">
                                                 <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                                     <div className="md:col-span-6">
                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Item</label>
                                                        <EntitySelector 
                                                            entities={state.items} 
                                                            selectedId={siItemId} 
                                                            onSelect={setSiItemId} 
                                                            placeholder="Select Item..." 
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                                            formatOption={formatItemOption}
                                                            formatSelected={formatItemSelected}
                                                            searchFields={['code', 'name', 'category']}
                                                        />
                                                     </div>
                                                     <div className="md:col-span-2">
                                                         <label className="block text-xs font-semibold text-slate-500 mb-1">Qty</label>
                                                         <input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="0" value={siItemQty} onChange={e => setSiItemQty(e.target.value)} />
                                                     </div>
                                                     <div className="md:col-span-2">
                                                         <label className="block text-xs font-semibold text-slate-500 mb-1">
                                                             Rate/Unit ({siRateCurrency === 'customer' ? siCurrency : 'USD'})
                                                         </label>
                                                         <input 
                                                             type="number" 
                                                             className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" 
                                                             placeholder="0.00" 
                                                             value={siItemRate} 
                                                             onChange={e => setSiItemRate(e.target.value)} 
                                                         />
                                                         {siRateCurrency === 'customer' && siCurrency !== 'USD' && (
                                                             <p className="text-xs text-slate-400 mt-1">
                                                                 Will convert to USD automatically
                                                             </p>
                                                         )}
                                                     </div>
                                                     <div className="md:col-span-2 flex items-end"><button onClick={handleAddSiItem} className="w-full bg-blue-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-blue-700">Add Item</button></div>
                                                 </div>
                                             </div>
                                             <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                                                 <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Total Kg</th><th className="px-4 py-2 text-right">Rate (USD)</th><th className="px-4 py-2 text-right">Total (USD)</th><th className="px-4 py-2 text-center">Action</th></tr></thead>
                                                 <tbody className="divide-y divide-slate-100">
                                                     {siCart.map(item => ( <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-2">{item.itemName}</td><td className="px-4 py-2 text-right">{item.qty}</td><td className="px-4 py-2 text-right text-slate-500">{item.totalKg}</td><td className="px-4 py-2 text-right">{(item.rate || 0).toFixed(2)}</td><td className="px-4 py-2 text-right font-bold">{(item.total || 0).toFixed(2)}</td><td className="px-4 py-2 text-center"><button onClick={() => setSiCart(siCart.filter(x => x.id !== item.id))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td></tr> ))}
                                                     {siCart.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-slate-400 italic">No items added</td></tr>}
                                                 </tbody>
                                             </table>
                                        </div>
                                        
                                        {/* Additional Costs (Invoice Level) */}
                                        <div className="border-t border-slate-200 pt-6">
                                            <h4 className="font-bold text-slate-700 mb-4">Additional Costs (Pass-through)</h4>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                                <div className="flex flex-wrap md:flex-nowrap gap-3">
                                                    <div className="w-full md:w-32"><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" value={siCostType} onChange={e => {
                                                        setSiCostType(e.target.value);
                                                        // Clear custom name when switching away from Custom/Other
                                                        if (e.target.value !== 'Customs' && e.target.value !== 'Other') {
                                                            setSiCostCustomName('');
                                                        }
                                                        // Clear provider when switching to Custom/Other
                                                        if (e.target.value === 'Customs' || e.target.value === 'Other') {
                                                            setSiCostProvider('');
                                                        }
                                                    }}><option value="Freight">Freight</option><option value="Clearing">Clearing</option><option value="Commission">Commission</option><option value="Customs">Customs</option><option value="Other">Other</option></select></div>
                                                    <div className="w-full md:w-1/3">
                                                        {(siCostType === 'Customs' || siCostType === 'Other') ? (
                                                            <input 
                                                                type="text" 
                                                                className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" 
                                                                placeholder="Enter custom name..." 
                                                                value={siCostCustomName} 
                                                                onChange={e => setSiCostCustomName(e.target.value)} 
                                                            />
                                                        ) : (
                                                            <EntitySelector 
                                                                entities={state.partners.filter(p => [PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT, PartnerType.VENDOR].includes(p.type))} 
                                                                selectedId={siCostProvider} 
                                                                onSelect={setSiCostProvider} 
                                                                placeholder="Provider (Optional)" 
                                                                onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig)}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="w-1/2 md:w-24"><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" value={siCostCurrency} onChange={e => setSiCostCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c=><option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                                    <div className="w-1/2 md:w-32"><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Amount" value={siCostAmount} onChange={e => setSiCostAmount(e.target.value)} /></div>
                                                    <button onClick={handleAddSiCost} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Add</button>
                                                </div>
                                                <div className="space-y-1">
                                                    {siCosts.map(c => ( <div key={c.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-slate-200"><span>{c.costType} {c.customName ? `(${c.customName})` : (c.providerId && `(${state.partners.find(p=>p.id===c.providerId)?.name})`)}</span><div className="flex gap-4 font-mono"><span>{c.amount} {c.currency}</span><button onClick={() => setSiCosts(siCosts.filter(x => x.id !== c.id))} className="text-red-400 hover:text-red-600"><X size={14}/></button></div></div> ))}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-8 pt-4 border-t border-slate-200 flex justify-end">
                                            <button onClick={handleFinalizeInvoice} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 flex items-center gap-2">
                                                <CheckCircle size={20} /> Invoice Complete
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                        {/* Filters */}
                                        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-end">
                                            <div className="flex-1 min-w-[200px]">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Filter by Date</label>
                                                <input 
                                                    type="date" 
                                                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-sm text-slate-800" 
                                                    value={siFilterDate} 
                                                    onChange={e => setSiFilterDate(e.target.value)} 
                                                />
                                            </div>
                                            <div className="flex-1 min-w-[200px]">
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Filter by Customer</label>
                                                <EntitySelector 
                                                    entities={state.partners.filter(p => p.type === PartnerType.CUSTOMER)} 
                                                    selectedId={siFilterCustomer} 
                                                    onSelect={setSiFilterCustomer} 
                                                    placeholder="All Customers" 
                                                />
                                            </div>
                                            <div>
                                                <button 
                                                    onClick={() => {
                                                        setSiFilterDate('');
                                                        setSiFilterCustomer('');
                                                    }} 
                                                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
                                                >
                                                    Clear Filters
                                                </button>
                                            </div>
                                        </div>
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Net Total</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Actions</th></tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {state.salesInvoices
                                                    .filter(inv => {
                                                        // Date filter
                                                        if (siFilterDate && inv.date !== siFilterDate) return false;
                                                        // Customer filter
                                                        if (siFilterCustomer && inv.customerId !== siFilterCustomer) return false;
                                                        return true;
                                                    })
                                                    .map(inv => (
                                                    <tr key={inv.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">{inv.date}</td>
                                                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{inv.invoiceNo}</td>
                                                        <td className="px-4 py-3">{state.partners.find(p => p.id === inv.customerId)?.name}</td>
                                                        <td className="px-4 py-3 text-right font-mono">{inv.netTotal.toLocaleString()} {inv.currency}</td>
                                                        <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${inv.status === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{inv.status}</span></td>
                                                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                                                            {inv.status === 'Posted' && (
                                                                <button 
                                                                    onClick={async () => {
                                                                        if (confirm(`Invoice ${inv.invoiceNo} is Posted.\n\nVerify and create missing ledger entries if needed?`)) {
                                                                            try {
                                                                                await postSalesInvoice(inv);
                                                                                alert(`✅ Invoice ${inv.invoiceNo} processed. Ledger entries verified/created.`);
                                                                            } catch (error) {
                                                                                alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="text-emerald-600 hover:text-emerald-800 font-medium text-xs px-2 py-1 border border-emerald-300 rounded hover:bg-emerald-50" 
                                                                    title="Verify/Create Missing Entries"
                                                                >
                                                                    Create Entries
                                                                </button>
                                                            )}
                                                            <button onClick={() => handleEditInvoice(inv)} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit2 size={16} /></button>
                                                            <button onClick={() => handleDeleteSalesInvoice(inv.id)} className="text-red-400 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {state.salesInvoices.filter(inv => {
                                                    if (siFilterDate && inv.date !== siFilterDate) return false;
                                                    if (siFilterCustomer && inv.customerId !== siFilterCustomer) return false;
                                                    return true;
                                                }).length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No invoices found.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- FINISHED GOODS PRODUCTION FORM --- */}
                                                {/* --- PRODUCED PRODUCTION REPORT TAB --- */}
                                                {activeSubModule === 'produced-production' && (
                                                    <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-12 gap-8">
                                                        <div className="md:col-span-12 mb-6 space-y-4">
                                                            <div className="flex gap-4 items-center">
                                                                <div>
                                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Date Range</label>
                                                                    <input type="date" value={prodReportStart} onChange={e => setProdReportStart(e.target.value)} className="border border-slate-300 rounded-lg p-2 text-sm mr-2" />
                                                                    <input type="date" value={prodReportEnd} onChange={e => setProdReportEnd(e.target.value)} className="border border-slate-300 rounded-lg p-2 text-sm" />
                                                                </div>
                                                                <div className="ml-6 flex items-end gap-2">
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
                                                                        <select value={prodReportCategory} onChange={e => { setProdReportCategory(e.target.value); setProdReportItem(''); }} className="border border-slate-300 rounded-lg p-2 text-sm">
                                                                            <option value="">All Categories</option>
                                                                            {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-xs font-semibold text-slate-500 mb-1">Item</label>
                                                                        <select value={prodReportItem} onChange={e => setProdReportItem(e.target.value)} className="border border-slate-300 rounded-lg p-2 text-sm">
                                                                            <option value="">All Items</option>
                                                                            {state.items
                                                                                .filter(i => prodReportCategory === '' || i.category === prodReportCategory)
                                                                                .map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                                                                        </select>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (filteredProducedEntries.length === 0) {
                                                                                alert('No data to export. Please adjust your filters.');
                                                                                return;
                                                                            }
                                                                            
                                                                            // Prepare CSV data
                                                                            const csvData = [
                                                                                ['Item Code', 'Item', 'Category', 'Bale Size', 'Qty', 'Weight (Kg)', 'Timestamp'],
                                                                                ...filteredProducedEntries.map(entry => {
                                                                                    const item = state.items.find(i => i.id === entry.itemId);
                                                                                    const packageSize = item?.weightPerUnit !== undefined ? Number(item.weightPerUnit) : '';
                                                                                    const timestamp = entry.createdAt 
                                                                                        ? new Date(entry.createdAt.seconds * 1000).toLocaleString()
                                                                                        : (entry.date ? new Date(entry.date + 'T00:00:00').toLocaleString() : '');
                                                                                    // Get category name instead of ID
                                                                                    const categoryName = item?.category 
                                                                                        ? (state.categories.find(c => c.id === item.category)?.name || item.category)
                                                                                        : '-';
                                                                                    
                                                                                    return [
                                                                                        item?.code || '',
                                                                                        item?.name || entry.itemId || '',
                                                                                        categoryName,
                                                                                        packageSize !== null && packageSize !== undefined ? packageSize.toString() : '-',
                                                                                        entry.qtyProduced.toString(),
                                                                                        entry.weightProduced.toString(),
                                                                                        timestamp
                                                                                    ];
                                                                                })
                                                                            ];
                                                                            
                                                                            // Convert to CSV string
                                                                            const csv = csvData.map(row => 
                                                                                row.map(cell => {
                                                                                    // Escape commas and quotes in cell values
                                                                                    const cellStr = String(cell || '');
                                                                                    if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                                                                                        return `"${cellStr.replace(/"/g, '""')}"`;
                                                                                    }
                                                                                    return cellStr;
                                                                                }).join(',')
                                                                            ).join('\n');
                                                                            
                                                                            // Create and download file
                                                                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                                                            const url = window.URL.createObjectURL(blob);
                                                                            const a = document.createElement('a');
                                                                            a.href = url;
                                                                            const dateRange = prodReportStart && prodReportEnd 
                                                                                ? `${prodReportStart}_to_${prodReportEnd}`
                                                                                : new Date().toISOString().split('T')[0];
                                                                            a.download = `produced-production-${dateRange}.csv`;
                                                                            document.body.appendChild(a);
                                                                            a.click();
                                                                            document.body.removeChild(a);
                                                                            window.URL.revokeObjectURL(url);
                                                                        }}
                                                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                                                        title="Export filtered production data to CSV"
                                                                    >
                                                                        <Download size={16} />
                                                                        Export Excel
                                                                    </button>
                                                                </div>
                                                                {/* Cards for Total Packages, Total Worth, and Total Weight */}
                                                                <div className="ml-auto flex gap-4">
                                                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-3 flex flex-col items-center min-w-[140px]">
                                                                        <span className="text-xs text-slate-500 font-semibold mb-1">Total Packages (Qty)</span>
                                                                        <span className="text-2xl font-bold text-blue-700">{filteredProducedEntries.reduce((sum, entry) => sum + entry.qtyProduced, 0)}</span>
                                                                    </div>
                                                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-3 flex flex-col items-center min-w-[140px]">
                                                                        <span className="text-xs text-slate-500 font-semibold mb-1">Total Worth</span>
                                                                        {(() => {
                                                                            const totalWorth = filteredProducedEntries.reduce((sum, entry) => {
                                                                                const item = state.items.find(i => i.id === entry.itemId);
                                                                                // Use productionPrice from entry if explicitly set (even if 0 or negative), otherwise use item.avgCost
                                                                                // productionPrice from CSV should always override item.avgCost
                                                                                const price = entry.productionPrice !== undefined && entry.productionPrice !== null 
                                                                                    ? entry.productionPrice 
                                                                                    : (item?.avgCost || 0);
                                                                                return sum + (entry.qtyProduced * price);
                                                                            }, 0);
                                                                            const isNegative = totalWorth < 0;
                                                                            return (
                                                                                <span className={`text-2xl font-bold ${isNegative ? 'text-red-600' : 'text-purple-700'}`}>
                                                                                    {isNegative ? '-' : ''}${Math.abs(totalWorth).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-6 py-3 flex flex-col items-center min-w-[140px]">
                                                                        <span className="text-xs text-slate-500 font-semibold mb-1">Total Weight</span>
                                                                        <span className="text-2xl font-bold text-emerald-700">{filteredProducedEntries.reduce((sum, entry) => sum + entry.weightProduced, 0)}</span>
                                                                    </div>
                                                                </div>
                                                                {/* Debug Info - Show total entries vs filtered */}
                                                                {(() => {
                                                                    const totalInRange = state.productions.filter(p => {
                                                                        if (p.isRebaling || p.qtyProduced <= 0) return false;
                                                                        const entryDateStr = p.date ? normalizeDate(p.date) : '';
                                                                        const startDateStr = normalizeDate(prodReportStart);
                                                                        const endDateStr = normalizeDate(prodReportEnd);
                                                                        return entryDateStr >= startDateStr && entryDateStr <= endDateStr;
                                                                    }).length;
                                                                    if (totalInRange !== filteredProducedEntries.length && (prodReportCategory !== '' || prodReportItem !== '')) {
                                                                        return (
                                                                            <div className="text-xs text-slate-500 mt-2">
                                                                                Showing {filteredProducedEntries.length} of {totalInRange} entries (filtered by {prodReportCategory ? 'Category' : ''} {prodReportItem ? 'Item' : ''})
                                                                            </div>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                            
                                                            {/* Delete Productions by Date Section */}
                                                            {showDeleteProdUtility && (
                                                            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                                                                <div className="flex items-center gap-3 mb-3">
                                                                    <Trash2 className="text-red-600" size={20} />
                                                                    <h4 className="font-bold text-slate-800">Delete Productions by Date</h4>
                                                                </div>
                                                                <div className="flex gap-3 items-end">
                                                                    <div className="flex-1">
                                                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Select Date to Delete</label>
                                                                        <input
                                                                            type="date"
                                                                            value={deleteProdDate}
                                                                            onChange={e => setDeleteProdDate(e.target.value)}
                                                                            className="w-full border border-slate-300 rounded-lg p-2 text-sm"
                                                                            placeholder="Select date..."
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (!deleteProdDate) {
                                                                                alert('Please select a date to delete.');
                                                                                return;
                                                                            }

                                                                            // Normalize dates for comparison (handle different formats, use local timezone)
                                                                            const normalizeDateForCompare = (dateStr: string): string => {
                                                                                if (!dateStr) return '';
                                                                                if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                                                                    return dateStr;
                                                                                }
                                                                                const dateObj = new Date(dateStr);
                                                                                if (!isNaN(dateObj.getTime())) {
                                                                                    const year = dateObj.getFullYear();
                                                                                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                                                                    const day = String(dateObj.getDate()).padStart(2, '0');
                                                                                    return `${year}-${month}-${day}`;
                                                                                }
                                                                                return dateStr;
                                                                            };
                                                                            
                                                                            const normalizedDeleteDate = normalizeDateForCompare(deleteProdDate);
                                                                            const productionsForDate = state.productions.filter(p => {
                                                                                if (!p.date) return false;
                                                                                const normalizedProdDate = normalizeDateForCompare(p.date);
                                                                                return normalizedProdDate === normalizedDeleteDate;
                                                                            });
                                                                            if (productionsForDate.length === 0) {
                                                                                alert(`No production entries found for ${deleteProdDate}`);
                                                                                return;
                                                                            }

                                                                            const pin = prompt(`Enter Supervisor PIN to delete ${productionsForDate.length} production entries for ${deleteProdDate}:`);
                                                                            if (pin !== SUPERVISOR_PIN) {
                                                                                alert('❌ Invalid PIN! Deletion cancelled.');
                                                                                return;
                                                                            }

                                                                            const confirmText = prompt(
                                                                                `⚠️ WARNING: This will delete ALL ${productionsForDate.length} production entries for ${deleteProdDate}.\n\n` +
                                                                                `This will also delete all associated ledger entries.\n\n` +
                                                                                `This action cannot be undone.\n\n` +
                                                                                `Type "DELETE ${deleteProdDate}" to confirm:`
                                                                            );

                                                                            if (confirmText !== `DELETE ${deleteProdDate}`) {
                                                                                alert('Confirmation text does not match. Operation cancelled.');
                                                                                return;
                                                                            }

                                                                            setIsDeletingProductions(true);
                                                                            try {
                                                                                await deleteProductionsByDate(deleteProdDate);
                                                                                setDeleteProdDate('');
                                                                            } catch (error: any) {
                                                                                console.error('❌ Error deleting productions:', error);
                                                                                alert(`❌ Error deleting productions: ${error.message || 'Unknown error'}`);
                                                                            } finally {
                                                                                setIsDeletingProductions(false);
                                                                            }
                                                                        }}
                                                                        disabled={!deleteProdDate || isDeletingProductions}
                                                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                                    >
                                                                        {isDeletingProductions ? (
                                                                            <>
                                                                                <RefreshCw size={16} className="animate-spin" /> Deleting...
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Trash2 size={16} /> Delete All for Date
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                                <p className="text-xs text-red-600 mt-2">
                                                                    ⚠️ This will delete ALL production entries for the selected date and their associated ledger entries. Requires Supervisor PIN.
                                                                </p>
                                                            </div>
                                                            )}
                                                        </div>
                                                        <div className="md:col-span-12">
                                                            <div className="overflow-x-auto">
                                                                <table className="w-full text-sm text-left">
                                                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                                                                        <tr>
                                                                            {['Item Code','Item','Category','Bale Size','Qty','Weight','Timestamp'].map((col, idx) => {
                                                                                return (
                                                                                    <th key={col} className="px-4 py-2 cursor-pointer" onClick={() => handleProdReportSort(col)}>
                                                                                        {col}
                                                                                        {prodReportSort.col === col && (prodReportSort.asc ? ' ▲' : ' ▼')}
                                                                                    </th>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-slate-100">
                                                                        {filteredProducedEntries.length === 0 ? (
                                                                            <tr><td colSpan={7} className="text-center py-8 text-slate-400">No production entries found.</td></tr>
                                                                        ) : (
                                                                            filteredProducedEntries.map(entry => {
                                                                                const item = state.items.find(i => i.id === entry.itemId);
                                                                                const packageSize = item?.weightPerUnit !== undefined ? Number(item.weightPerUnit) : null;
                                                                                // Get category name instead of ID
                                                                                const categoryName = item?.category 
                                                                                    ? (state.categories.find(c => c.id === item.category)?.name || item.category)
                                                                                    : '-';
                                                                                return (
                                                                                    <tr key={entry.id} className="hover:bg-slate-50">
                                                                                        <td className="px-4 py-2 font-mono text-sm text-slate-600">{item?.code || '-'}</td>
                                                                                        <td className="px-4 py-2 font-medium text-slate-700">{item?.name || entry.itemId}</td>
                                                                                        <td className="px-4 py-2">{categoryName}</td>
                                                                                        <td className="px-4 py-2">{packageSize !== null ? packageSize : '-'}</td>
                                                                                        <td className="px-4 py-2">{entry.qtyProduced}</td>
                                                                                        <td className="px-4 py-2">{entry.weightProduced}</td>
                                                                                        <td className="px-4 py-2">{entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleString() : '-'}</td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                        {activeSubModule === 'fg-production' && (
                            <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-12 gap-8">
                                    <div className="md:col-span-7 space-y-6">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Production Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500" value={prodDate} onChange={e => { setProdDate(e.target.value); setStagedProds([]); }} required /></div>
                                        
                                        {/* Bulk Upload CSV Section */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                            <h4 className="font-semibold text-slate-700 mb-3 flex items-center gap-2"><FileText size={16} /> Bulk Upload (CSV)</h4>
                                            <div className="flex gap-3">
                                                <label className="flex-1 cursor-pointer">
                                                    <input
                                                        type="file"
                                                        accept=".csv"
                                                        onChange={handleProductionCSVUpload}
                                                        className="hidden"
                                                    />
                                                    <span className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-colors">
                                                        <Download size={18} /> Choose CSV File
                                                    </span>
                                                </label>
                                                <a
                                                    href="/production_template.csv"
                                                    download
                                                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow transition-colors"
                                                    style={{ textDecoration: 'none' }}
                                                >
                                                    <FileText size={18} /> Template
                                                </a>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">CSV must include: Production Date, Item ID, Quantity. Production Price is optional (will use Avg Production Price from Setup if not provided)</p>
                                        </div>
                                        
                                        <div className="relative">
                                            <div className="absolute inset-0 flex items-center">
                                                <div className="w-full border-t border-slate-300"></div>
                                            </div>
                                            <div className="relative flex justify-center text-xs uppercase">
                                                <span className="bg-white px-2 text-slate-500">OR ADD MANUALLY</span>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Select Item</label>
                                            <EntitySelector
                                                entities={state.items.filter(i => i.category !== 'Raw Material')}
                                                selectedId={prodItemId}
                                                onSelect={setProdItemId}
                                                placeholder="Choose Finished Good..."
                                                onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                                formatOption={formatItemOption}
                                                formatSelected={formatItemSelected}
                                                searchFields={['code', 'name', 'category']}
                                            />
                                            <div className="flex justify-between mt-1 text-xs">
                                                {selectedItem && ( <span className="text-slate-500">Packing: {selectedItem.packingType} {selectedItem.packingType !== 'Kg' && ` (Next Serial: #${tempSerialTracker[selectedItem.id] || selectedItem.nextSerial || 1})`}</span> )}
                                            </div>
                                        </div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Quantity (Units)</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 font-bold" placeholder="0" value={prodQty} onChange={e => setProdQty(e.target.value)} /></div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Avg Cost (USD per Unit)</label><input type="number" step="0.01" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 font-bold" placeholder="0.00" value={prodAvgCost} onChange={e => setProdAvgCost(e.target.value)} /></div>
                                        <button onClick={handleStageProduction} disabled={!prodItemId || !prodQty} className="w-full bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"><Plus size={18} /> Add to List</button>
                                    </div>
                                    <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-slate-700">Staged Entries</h4><span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold">{stagedProds.length}</span></div>
                                        <div className="flex-1 overflow-y-auto min-h-[200px] mb-4">{stagedProds.length === 0 ? ( <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm"><Layers size={32} className="mb-2 opacity-30" /><p>No items added yet</p></div> ) : ( <div className="space-y-2">{stagedProds.map((entry, idx) => {
                                            const item = state.items.find(i => i.id === entry.itemId);
                                            // Get category name instead of ID
                                            const categoryName = item?.category 
                                                ? (state.categories.find(c => c.id === item.category)?.name || item.category)
                                                : '';
                                            return (
                                                <div key={entry.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group">
                                                    <div>
                                                        <div className="font-medium text-slate-800 text-sm">{item?.code || entry.itemId} - {entry.itemName}</div>
                                                        <div className="text-xs text-slate-500 flex gap-2">
                                                            <span>{categoryName}</span>
                                                            <span>•</span>
                                                            <span>{entry.qtyProduced} {entry.packingType}s ({item?.weightPerUnit || 0}Kg each)</span>
                                                            {entry.serialStart && ( <span className="text-emerald-600 font-mono bg-emerald-50 px-1 rounded">#{entry.serialStart} - #{entry.serialEnd}</span> )}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setStagedProds(stagedProds.filter(p => p.id !== entry.id))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                                                </div>
                                            );
                                        })}</div> )}</div>
                                        <div className="border-t border-slate-200 pt-4 mt-auto"><div className="flex justify-between text-sm mb-4 font-medium text-slate-700"><span>Total Units:</span><span>{stagedProds.reduce((sum, p) => sum + p.qtyProduced, 0)}</span></div><button onClick={() => setShowProdSummary(true)} disabled={stagedProds.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"><Save size={18} /> Finalize & Save</button></div>
                                    </div>
                                <div className="md:col-span-12 mt-8 pt-6 border-t border-slate-200"><h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><History size={16} className="text-slate-400" /> Saved Entries ({prodDate})</h4><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase text-xs"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Qty</th><th className="px-4 py-2">Weight</th><th className="px-4 py-2">Serials</th><th className="px-4 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{state.productions.filter(p => p.date === prodDate).map(p => ( <tr key={p.id} className="hover:bg-slate-50"><td className="px-4 py-2 font-medium text-slate-700">{p.itemName}</td><td className="px-4 py-2">{p.qtyProduced} {p.packingType}</td><td className="px-4 py-2 text-slate-500">{p.weightProduced} kg</td><td className="px-4 py-2 font-mono text-xs text-slate-600">{p.serialStart ? `#${p.serialStart} - #${p.serialEnd}` : '-'}</td><td className="px-4 py-2 text-right"><button onClick={() => handleDeleteProduction(p.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors" title="Delete"><Trash2 size={14} /></button></td></tr> ))} {state.productions.filter(p => p.date === prodDate).length === 0 && ( <tr><td colSpan={5} className="text-center py-4 text-slate-400 text-xs italic">No production saved for this date.</td></tr> )}</tbody></table></div></div>
                            </div>
                        )}

                        {/* --- RE-BALING FORM --- */}
                        {activeSubModule === 're-baling' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="mb-6 flex justify-between items-center"><div className="w-48"><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Transaction Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm focus:outline-none focus:border-blue-500" value={rbDate} onChange={e => setRbDate(e.target.value)} /></div><div className="flex gap-4 text-sm font-medium"><div className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">Consumed: {rbConsumedWeight.toFixed(1)} Kg</div><div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">Produced: {rbProducedWeight.toFixed(1)} Kg</div><div className={`px-3 py-1 rounded-lg border ${rbDifference > 0 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{rbDifference > 0 ? 'Loss' : 'Gain'}: {Math.abs(rbDifference).toFixed(1)} Kg</div></div></div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[400px]">
                                    <div className="flex flex-col border-r border-slate-100 pr-8">
                                        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2"><ArrowRight className="text-amber-500" /> Items to Consume</h3>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Select Item</label>
                                                    <EntitySelector
                                                        entities={state.items}
                                                        selectedId={rbConsumeId}
                                                        onSelect={setRbConsumeId}
                                                        placeholder="Select Item..."
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                                        formatOption={formatItemOption}
                                                        formatSelected={formatItemSelected}
                                                        searchFields={['code', 'name', 'category']}
                                                    />
                                                </div>
                                                <div className="flex gap-2"><div className="flex-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Qty</label><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-500" placeholder="0" value={rbConsumeQty} onChange={e => setRbConsumeQty(e.target.value)} /></div><button onClick={handleAddConsume} disabled={!rbConsumeId || !rbConsumeQty} className="mt-5 px-4 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">Add</button></div>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-2">{rbConsumeList.map(item => ( <div key={item.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-white text-sm"><div><div className="font-medium text-slate-700">{item.itemName}</div><div className="text-xs text-slate-400">{item.qty} {item.packingType} • {item.weight} Kg</div></div><button onClick={() => setRbConsumeList(rbConsumeList.filter(x => x.id !== item.id))} className="text-slate-300 hover:text-red-500"><X size={16} /></button></div> ))} {rbConsumeList.length === 0 && <div className="text-center text-slate-400 text-xs italic py-4">No items to consume</div>}</div>
                                    </div>
                                    <div className="flex flex-col pl-2">
                                        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2"><Factory className="text-blue-500" /> Items to Produce</h3>
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Select Item</label>
                                                    <EntitySelector
                                                        entities={state.items}
                                                        selectedId={rbProduceId}
                                                        onSelect={setRbProduceId}
                                                        placeholder="Select Item..."
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                                        formatOption={formatItemOption}
                                                        formatSelected={formatItemSelected}
                                                        searchFields={['code', 'name', 'category']}
                                                    />
                                                </div>
                                                <div className="flex gap-2"><div className="flex-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Qty</label><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:border-blue-500" placeholder="0" value={rbProduceQty} onChange={e => setRbProduceQty(e.target.value)} /></div><button onClick={handleAddProduce} disabled={!rbProduceId || !rbProduceQty} className="mt-5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Add</button></div>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto space-y-2">{rbProduceList.map(item => ( <div key={item.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-lg bg-white text-sm"><div><div className="font-medium text-slate-700">{item.itemName}</div><div className="text-xs text-slate-400">{item.qty} {item.packingType} • {item.weight} Kg {item.serialStart && <span className="ml-2 bg-blue-50 text-blue-600 px-1 rounded">#{item.serialStart}-#{item.serialEnd}</span>}</div></div><button onClick={() => setRbProduceList(rbProduceList.filter(x => x.id !== item.id))} className="text-slate-300 hover:text-red-500"><X size={16} /></button></div> ))} {rbProduceList.length === 0 && <div className="text-center text-slate-400 text-xs italic py-4">No items produced</div>}</div>
                                    </div>
                                </div>
                                <div className="mt-6 pt-6 border-t border-slate-200"><button onClick={handleFinalizeRebaling} disabled={rbConsumeList.length === 0 || rbProduceList.length === 0} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-slate-800 disabled:bg-slate-300 disabled:shadow-none transition-all">Finalize Re-baling Transaction</button></div>
                            </div>
                        )}

                        {/* --- PLACEHOLDERS FOR OTHER SUB-MODULES --- */}
                        {activeSubModule !== 'original-opening' && activeSubModule !== 'fg-production' && activeSubModule !== 're-baling' && activeSubModule !== 'original-purchase' && activeSubModule !== 'bundle-purchase' && activeSubModule !== 'sales-invoice' && activeSubModule !== 'direct-sales' && activeSubModule !== 'ongoing-orders' && (
                             <div className="flex flex-col items-center justify-center h-96 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg animate-in fade-in duration-300">
                                <currentSubModuleDef.icon size={48} className="mb-4 opacity-20" />
                                <h3 className="font-semibold text-lg text-slate-600">{currentSubModuleDef?.label}</h3>
                                <p className="text-sm mt-2 max-w-sm text-center px-4">The specialized form logic for <span className="font-mono text-blue-500">{activeSubModule}</span> would be implemented here.</p>
                                <button className="mt-6 bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">Load Form Template</button>
                            </div>
                        )}

                    </div>
                </div>
            </div>

            {/* Quick Add Modal */}
            <QuickAddModal
                config={quickAddConfig}
                initialOverrides={quickAddDefaults}
                isOpen={showQuickAddModal}
                onClose={() => setShowQuickAddModal(false)}
                data={getQuickAddData()}
            />

            {/* Production Summary Modal */}
            {showProdSummary && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] animate-in zoom-in-95 duration-200 flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <CheckCircle className="text-emerald-500" /> Confirm Production ({stagedProds.length} entries)
                            </h3>
                            <button onClick={() => setShowProdSummary(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto min-h-0">
                            <p className="text-sm text-slate-500 mb-4">Please review the staged items before saving. Compare with yesterday's output to ensure consistency.</p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-xs sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">Item</th>
                                            <th className="px-4 py-3 text-right">Qty (Today)</th>
                                            <th className="px-4 py-3 text-right">Yesterday</th>
                                            <th className="px-4 py-3 text-right">Variance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {stagedProds.map(p => { 
                                            const yesterdayQty = getYesterdayProduction(p.itemId); 
                                            const variance = p.qtyProduced - yesterdayQty; 
                                            return ( 
                                                <tr key={p.id}>
                                                    <td className="px-4 py-3 font-medium text-slate-800">{p.itemName}</td>
                                                    <td className="px-4 py-3 text-right font-bold">{p.qtyProduced}</td>
                                                    <td className="px-4 py-3 text-right text-slate-500">{yesterdayQty}</td>
                                                    <td className={`px-4 py-3 text-right ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                        {variance > 0 ? '+' : ''}{variance}
                                                    </td>
                                                </tr> 
                                            ); 
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {isProcessingProduction && (
                                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                                    <RefreshCw className="animate-spin text-blue-600" size={20} />
                                    <div>
                                        <p className="text-sm font-medium text-blue-900">Processing production entries...</p>
                                        <p className="text-xs text-blue-700 mt-1">Please wait while we save {stagedProds.length} entries to the ledger. Do not close this window.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => setShowProdSummary(false)} 
                                disabled={isProcessingProduction}
                                className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleFinalizeProduction} 
                                disabled={isProcessingProduction}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isProcessingProduction && (
                                    <RefreshCw className="animate-spin" size={18} />
                                )}
                                {isProcessingProduction ? 'Processing...' : 'Save & Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

             {/* Purchase Summary/Print Modal */}
            {showPurSummary && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FileText className="text-blue-600" /> Review Invoice Details</h3><button onClick={() => setShowPurSummary(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
                        <div className="flex-1 overflow-y-auto p-8 bg-white" ref={printableRef}>
                            <div className="flex justify-between items-start mb-8 border-b border-slate-100 pb-8"><div><h1 className="text-3xl font-bold text-slate-800">PURCHASE RECORD</h1><p className="text-slate-500 mt-1">Status: <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">In Transit</span></p></div><div className="text-right"><h2 className="text-xl font-mono font-bold text-slate-600">#{purBatch}</h2><p className="text-sm text-slate-500">{purDate}</p></div></div>
                            <div className="mb-8 p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-4">
                                <div><h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Supplier</h4><div className="text-lg font-bold text-slate-800">{state.partners.find(p=>p.id===purSupplier)?.name}</div><div className="text-sm text-slate-500">{state.partners.find(p=>p.id===purSupplier)?.country}</div></div>
                                <div><h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Logistics</h4><div className="text-sm text-slate-800 font-medium">Container: {purContainer || 'N/A'}</div><div className="text-sm text-slate-500">Div: {state.divisions.find(d=>d.id===purDivision)?.name || '-'} / {state.subDivisions.find(s=>s.id===purSubDivision)?.name || '-'}</div></div>
                            </div>
                            <table className="w-full text-sm text-left mb-8"><thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold border-b border-slate-200"><tr><th className="px-4 py-3 text-right">Sub Supplier</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Weight (Kg)</th><th className="px-4 py-3 text-right">Net Rate ({purCurrency})</th><th className="px-4 py-3 text-right">Total ({purCurrency})</th></tr></thead><tbody className="divide-y divide-slate-100">{purCart.map(item => ( <tr key={item.id}><td className="px-4 py-3 text-right">{item.subSupplierId ? (state.partners.find(p => p.id === item.subSupplierId)?.name || '-') : '-'}</td><td className="px-4 py-3 font-medium">{item.originalType}</td><td className="px-4 py-3 text-right">{(item.weightPurchased || 0).toFixed(2)}</td><td className="px-4 py-3 text-right">{(item.costPerKgFCY - (item.discountPerKgFCY||0) + (item.surchargePerKgFCY||0)).toFixed(2)}</td><td className="px-4 py-3 text-right font-bold">{(item.totalCostFCY || 0).toFixed(2)}</td></tr> ))}<tr className="bg-blue-50 font-bold"><td className="px-4 py-3" colSpan={4}>TOTAL</td><td className="px-4 py-3 text-right">{purCart.reduce((s,i)=>s+(i.totalCostFCY || 0),0).toFixed(2)}</td></tr></tbody></table>
                            
                             <div className="border-t border-slate-200 pt-6"><h4 className="font-bold text-slate-700 mb-4">Landed Cost Calculation (Base USD)</h4><div className="space-y-2 text-sm max-w-sm ml-auto">
                                <div className="flex justify-between border-b border-slate-100 pb-1 mb-1"><span className="text-slate-700 font-medium">Net Material Cost:</span><span className="font-mono text-slate-800 font-medium">${purCart.reduce((s,i)=>s+(i.totalCostUSD || 0),0).toFixed(2)}</span></div>
                                {additionalCosts.map(ac => ( <div key={ac.id} className="flex justify-between"><span className="text-slate-500">{ac.costType} ({state.partners.find(p=>p.id===ac.providerId)?.name}):</span><span className="font-mono text-slate-800">${(ac.amountUSD || 0).toFixed(2)}</span></div> ))} 
                                <div className="flex justify-between border-t border-slate-300 pt-2 font-bold text-lg"><span className="text-blue-800">Total Landed Cost:</span><span className="font-mono text-blue-800">${( purCart.reduce((s,i)=>s+i.totalCostUSD,0) + additionalCosts.reduce((s, c) => s + c.amountUSD, 0) ).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Cost per Kg:</span><span className="font-mono">${(( purCart.reduce((s,i)=>s+i.totalCostUSD,0) + additionalCosts.reduce((s, c) => s + c.amountUSD, 0) ) / purCart.reduce((s,i)=>s+i.weightPurchased,0)).toFixed(3)}</span></div></div>
                             </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center"><button onClick={() => setShowPurSummary(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancel</button><div className="flex gap-3"><button onClick={handlePrint} disabled={purPrinted} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"><Printer size={18} /> {purPrinted ? 'Ready to Save' : 'Print Invoice'}</button><button type="button" onClick={handleFinalPurchaseSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm flex items-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"><Download size={18} /> Save & Exit</button></div></div>
                    </div>
                </div>
            )}

            {/* Auth Modal for Purchase Edit/Delete */}
            {authModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <AlertCircle className="text-amber-500" /> 
                                Supervisor Authorization Required
                            </h3>
                            <p className="text-sm text-slate-500 mt-2">
                                {pendingPurchaseAction?.type === 'DELETE' ? 'Deleting' : 'Editing'} a purchase requires supervisor PIN.
                            </p>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-slate-600 mb-2">Enter PIN</label>
                            <input
                                type="password"
                                value={authPin}
                                onChange={(e) => setAuthPin(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && confirmPurchaseAuthAction()}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="••••"
                                maxLength={4}
                                autoFocus
                                autoComplete="off"
                                data-form-type="other"
                                data-lpignore="true"
                            />
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setAuthModalOpen(false);
                                    setAuthPin('');
                                    setPendingPurchaseAction(null);
                                }}
                                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmPurchaseAuthAction}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Sales Invoice Summary Modal */}
            {showSiSummary && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                            <h3 className="text-2xl font-bold">Sales Invoice Summary</h3>
                            <p className="text-sm text-blue-100 mt-1">Review and confirm invoice details</p>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Invoice Header */}
                            <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                                <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Invoice Number</p>
                                    <p className="text-lg font-bold text-slate-800">{siInvoiceNo}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Date</p>
                                    <p className="text-lg font-bold text-slate-800">{siDate}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Customer</p>
                                    <p className="text-lg font-bold text-slate-800">{state.partners.find(p => p.id === siCustomer)?.name}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-semibold uppercase">Container</p>
                                    <p className="text-lg font-bold text-slate-800">{siContainer || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <h4 className="font-bold text-slate-700 mb-3">Items</h4>
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Item</th>
                                            <th className="px-3 py-2 text-center">Qty</th>
                                            <th className="px-3 py-2 text-center">Kg</th>
                                            <th className="px-3 py-2 text-right">Rate</th>
                                            <th className="px-3 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {siCart.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-3 py-2">{state.items.find(i => i.id === item.itemId)?.name}</td>
                                                <td className="px-3 py-2 text-center">{item.qty || 0}</td>
                                                <td className="px-3 py-2 text-center">{item.totalKg || 0}</td>
                                                <td className="px-3 py-2 text-right font-mono">{(item.ratePerUnit || 0).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold">{(item.total || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {siCart.length > 0 && (
                                            <tr className="bg-slate-50 font-semibold">
                                                <td className="px-3 py-2 text-right">Totals:</td>
                                                <td className="px-3 py-2 text-center">
                                                    {siCart.reduce((sum, item) => sum + (item.qty || 0), 0)}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    {siCart.reduce((sum, item) => sum + (item.totalKg || 0), 0)}
                                                </td>
                                                <td className="px-3 py-2" />
                                                <td className="px-3 py-2" />
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Summary */}
                            <div className="bg-slate-50 p-4 rounded-lg">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-600">Gross Total</span>
                                        <span className="font-mono font-bold">{siCurrency} {siCart.reduce((s, i) => s + (i.total || 0), 0).toFixed(2)}</span>
                                    </div>
                                    {parseFloat(siDiscount || '0') > 0 && (
                                        <div className="flex justify-between text-sm text-red-600">
                                            <span>Discount</span>
                                            <span className="font-mono">-{parseFloat(siDiscount || '0').toFixed(2)}</span>
                                        </div>
                                    )}
                                    {parseFloat(siSurcharge || '0') > 0 && (
                                        <div className="flex justify-between text-sm text-emerald-600">
                                            <span>Surcharge</span>
                                            <span className="font-mono">+{parseFloat(siSurcharge || '0').toFixed(2)}</span>
                                        </div>
                                    )}
                                    {siCosts.length > 0 && (
                                        <div className="flex justify-between text-sm text-blue-600">
                                            <span>Additional Costs</span>
                                            <span className="font-mono">+{siCosts.reduce((s, c) => s + ((c.amount || 0) * ((c.exchangeRate || 1) / (siExchangeRate || 1))), 0).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-lg font-bold text-slate-800 pt-2 border-t border-slate-300">
                                        <span>Net Total</span>
                                        <span className="font-mono">{siCurrency} {(siCart.reduce((s, i) => s + (i.total || 0), 0) - parseFloat(siDiscount || '0') + parseFloat(siSurcharge || '0') + siCosts.reduce((s, c) => s + ((c.amount || 0) * ((c.exchangeRate || 1) / (siExchangeRate || 1))), 0)).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowSiSummary(false)}
                                className="px-6 py-2 text-slate-600 hover:text-slate-800 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveInvoice}
                                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-2"
                            >
                                <CheckCircle size={18} /> Confirm & Save Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};            
