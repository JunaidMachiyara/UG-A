
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useLocation, Link } from 'react-router-dom';
import { OriginalOpening, ProductionEntry, PackingType, Purchase, Currency, TransactionType, PurchaseAdditionalCost, PartnerType, BundlePurchaseItem, BundlePurchase, SalesInvoice, SalesInvoiceItem, InvoiceAdditionalCost, OngoingOrder, OngoingOrderItem, PurchaseOriginalItem } from '../types';
import { EXCHANGE_RATES, CURRENCY_SYMBOLS } from '../constants';
import { EntitySelector } from './EntitySelector';
import { useSetupConfigs, QuickAddModal, CrudConfig } from './Setup';
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

export const DataEntry: React.FC = () => {
    const { state, addItem, updateStock, addOriginalOpening, deleteOriginalOpening, addProduction, postBaleOpening, addPurchase, addBundlePurchase, addSalesInvoice, updateSalesInvoice, deleteEntity, addDirectSale, addOngoingOrder, processOrderShipment } = useData();
    const location = useLocation();
    const setupConfigs = useSetupConfigs();
    
    // --- Quick Add State ---
    const [quickAddConfig, setQuickAddConfig] = useState<CrudConfig | null>(null);
    const [quickAddDefaults, setQuickAddDefaults] = useState<any>(null);
    const [showQuickAddModal, setShowQuickAddModal] = useState(false);

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
    const [ooBatch, setOoBatch] = useState('');
    const [ooQty, setOoQty] = useState('');

    // --- Bales Opening State ---
    const [boDate, setBoDate] = useState(new Date().toISOString().split('T')[0]);
    const [boItemId, setBoItemId] = useState('');
    const [boQty, setBoQty] = useState('');
    const [stagedBaleOpenings, setStagedBaleOpenings] = useState<{ id: string, itemId: string, itemName: string, qty: number, weight: number }[]>([]);
    
    // --- Production State ---
    const [prodDate, setProdDate] = useState(new Date().toISOString().split('T')[0]);
    const [prodItemId, setProdItemId] = useState('');
    const [prodQty, setProdQty] = useState('');
    const [stagedProds, setStagedProds] = useState<ProductionEntry[]>([]);
    const [showProdSummary, setShowProdSummary] = useState(false);
    const [tempSerialTracker, setTempSerialTracker] = useState<Record<string, number>>({});

    // --- Re-baling State ---
    const [rbDate, setRbDate] = useState(new Date().toISOString().split('T')[0]);
    const [rbConsumeId, setRbConsumeId] = useState('');
    const [rbConsumeQty, setRbConsumeQty] = useState('');
    const [rbProduceId, setRbProduceId] = useState('');
    const [rbProduceQty, setRbProduceQty] = useState('');
    const [rbConsumeList, setRbConsumeList] = useState<any[]>([]);
    const [rbProduceList, setRbProduceList] = useState<any[]>([]);

    // --- Original Purchase State ---
    const [purDate, setPurDate] = useState(new Date().toISOString().split('T')[0]);
    const [purBatch, setPurBatch] = useState('11001'); // Auto-populated
    const [purSupplier, setPurSupplier] = useState('');
    const [purCurrency, setPurCurrency] = useState<Currency>('USD');
    const [purExchangeRate, setPurExchangeRate] = useState<number>(1);
    
    // NEW: Multi-Original Type Cart
    const [purOriginalTypeId, setPurOriginalTypeId] = useState('');
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
    const [siId, setSiId] = useState(''); // Internal ID for editing
    const [siInvoiceNo, setSiInvoiceNo] = useState('SINV-1001');
    const [siDate, setSiDate] = useState(new Date().toISOString().split('T')[0]);
    const [siCustomer, setSiCustomer] = useState('');
    const [siLogo, setSiLogo] = useState('');
    const [siColor, setSiColor] = useState('');
    const [siCurrency, setSiCurrency] = useState<Currency>('USD');
    const [siExchangeRate, setSiExchangeRate] = useState<number>(1);
    
    // SI Logistics
    const [siContainer, setSiContainer] = useState('');
    const [siDivision, setSiDivision] = useState('');
    const [siSubDivision, setSiSubDivision] = useState('');
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
    const [siCostAmount, setSiCostAmount] = useState('');
    const [siCostCurrency, setSiCostCurrency] = useState<Currency>('USD');
    const [siCostRate, setSiCostRate] = useState(1);

    const [showSiSummary, setShowSiSummary] = useState(false);

    // --- Direct Sales State ---
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
            const maxInv = state.salesInvoices
                .map(i => parseInt(i.invoiceNo.replace('SINV-', '')))
                .filter(n => !isNaN(n))
                .reduce((max, curr) => curr > max ? curr : max, 1000);
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
            if (p) {
                if (p.defaultCurrency) setSiCurrency(p.defaultCurrency);
                if (p.divisionId) setSiDivision(p.divisionId);
                if (p.subDivisionId) setSiSubDivision(p.subDivisionId);
            }
        }
    }, [siCustomer, state.partners]);

    // Update rate when currency changes manually
    useEffect(() => {
        setPurExchangeRate(EXCHANGE_RATES[purCurrency] || 1);
        setBpExchangeRate(EXCHANGE_RATES[bpCurrency] || 1);
        setAcExchangeRate(EXCHANGE_RATES[acCurrency] || 1);
        setSiExchangeRate(EXCHANGE_RATES[siCurrency] || 1);
        setSiCostRate(EXCHANGE_RATES[siCostCurrency] || 1);
        setDsExchangeRate(EXCHANGE_RATES[dsCurrency] || 1);
    }, [purCurrency, bpCurrency, acCurrency, siCurrency, siCostCurrency, dsCurrency]);

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
            originalProductId: purOriginalProductId,
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
        setPurWeight('');
        setPurPrice('');
        setPurItemDiscount('');
        setPurItemSurcharge('');
    };
    
    const handleRemoveFromPurCart = (id: string) => {
        setPurCart(purCart.filter(item => item.id !== id));
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
        // Find unique OriginalTypeIDs bought from this supplier
        const typeIds = Array.from(new Set(state.purchases.filter(p => p.supplierId === ooSupplier).map(p => p.originalTypeId)));
        return state.originalTypes.filter(ot => typeIds.includes(ot.id));
    }, [ooSupplier, state.purchases, state.originalTypes]);

    const batchesForSelection = useMemo(() => {
        if (!ooSupplier || !ooType) return [];
        return Array.from(new Set(state.purchases
            .filter(p => p.supplierId === ooSupplier && p.originalTypeId === ooType)
            .map(p => p.batchNumber)
        )).filter(Boolean).map(b => ({ id: b, name: b }));
    }, [ooSupplier, ooType, state.purchases]);

    const availableStockInfo = useMemo(() => {
        if (!ooSupplier || !ooType) return { qty: 0, weight: 0, avgCost: 0 };

        // Filter purchases by Supplier AND OriginalTypeId AND (Optional) BatchNumber
        const relevantPurchases = state.purchases.filter(p => 
            p.supplierId === ooSupplier && 
            p.originalTypeId === ooType && 
            (!ooBatch || p.batchNumber === ooBatch)
        );

        // Filter previous openings by Supplier AND OriginalTypeID AND (Optional) BatchNumber
        const relevantOpenings = state.originalOpenings.filter(o => 
            o.supplierId === ooSupplier && 
            o.originalType === ooType &&
            (!ooBatch || o.batchNumber === ooBatch)
        );

        const purchased = relevantPurchases.reduce((acc, curr) => ({
                qty: acc.qty + curr.qtyPurchased,
                weight: acc.weight + curr.weightPurchased,
                cost: acc.cost + curr.totalLandedCost
            }), { qty: 0, weight: 0, cost: 0 });

        const opened = relevantOpenings.reduce((acc, curr) => ({
                qty: acc.qty + curr.qtyOpened,
                weight: acc.weight + curr.weightOpened
            }), { qty: 0, weight: 0 });

        const currentQty = purchased.qty - opened.qty;
        const currentWeight = purchased.weight - opened.weight;
        const avgCostPerKg = purchased.weight > 0 ? (purchased.cost / purchased.weight) : 0;

        return { 
            qty: currentQty, 
            weight: currentWeight, 
            avgCost: avgCostPerKg 
        };
    }, [ooSupplier, ooType, ooBatch, state.purchases, state.originalOpenings]);

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
            batchNumber: ooBatch,
            qtyOpened: qtyVal,
            weightOpened: finalWeight,
            costPerKg: availableStockInfo.avgCost,
            totalValue: finalWeight * availableStockInfo.avgCost
        };
        addOriginalOpening(newOpening);
        
        // Reset Form
        setOoQty('');
        setOoBatch('');
        setOoType('');
        
        alert("Opening Recorded & Journal Posted");
    };
    
    // --- History Table Data ---
    const openingsForDate = useMemo(() => {
        return state.originalOpenings.filter(o => o.date === ooDate && o.supplierId !== 'SUP-INTERNAL-STOCK');
    }, [state.originalOpenings, ooDate]);

    const handleDeleteOpening = (id: string) => {
        if(window.confirm('Are you sure? This will reverse the Journal Entry associated with this opening.')) {
            deleteOriginalOpening(id);
        }
    }

    // --- Shared Additional Cost Logic ---
    const handleAddCost = () => {
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
            const isDuplicateOriginal = state.purchases.some(p => p.containerNumber === purContainer);
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

        const newPurchase: Purchase = {
            id: Math.random().toString(36).substr(2, 9),
            batchNumber: purBatch,
            status: 'In Transit',
            date: purDate,
            supplierId: purSupplier,
            
            // NEW: Multi-Original Type Cart
            items: purCart,
            
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
            landedCostPerKg: totalLandedCostUSD / totalWeight
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

    const handleAddSiItem = () => {
        if (!siItemId || !siItemQty) return;
        const item = state.items.find(i => i.id === siItemId);
        if (!item) return;

        const qty = parseFloat(siItemQty);
        // Default rate logic: if not provided, use salePrice from item master. If that's missing, alert.
        let rate = siItemRate ? parseFloat(siItemRate) : (item.salePrice || 0);
        
        if (rate <= 0) {
            alert("Please enter a Rate or set a Sale Price in Setup.");
            return;
        }

        const newItem: SalesInvoiceItem = {
            id: Math.random().toString(36).substr(2, 9),
            itemId: item.id,
            itemName: item.name,
            qty,
            rate,
            total: qty * rate,
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
            providerId: siCostProvider,
            amount: amount,
            currency: siCostCurrency,
            exchangeRate: siCostRate
        };
        setSiCosts([...siCosts, newCost]);
        setSiCostAmount('');
        setSiCostProvider('');
    };

    const handleFinalizeInvoice = () => {
        if (!siCustomer || siCart.length === 0) {
            alert("Customer and Items are required.");
            return;
        }
        setShowSiSummary(true);
    };

    const saveInvoice = () => {
        const grossTotal = siCart.reduce((s, i) => s + i.total, 0);
        
        // Calculate costs in Invoice Currency for Net Total display (approx)
        // Note: Real accounting handles this via GL. Here we just sum up for the document.
        // Assuming costs are pass-through and added to invoice.
        // Convert costs to Invoice Currency:
        const costsTotal = siCosts.reduce((s, c) => s + (c.amount * (c.exchangeRate / siExchangeRate)), 0); 
        
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
            currency: siCurrency,
            exchangeRate: siExchangeRate,
            discount: parseFloat(siDiscount || '0'),
            surcharge: parseFloat(siSurcharge || '0'),
            items: siCart,
            additionalCosts: siCosts,
            grossTotal,
            netTotal
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
        setSiCurrency(inv.currency);
        setSiExchangeRate(inv.exchangeRate);
        setSiContainer(inv.containerNumber || '');
        setSiDivision(inv.divisionId || '');
        setSiSubDivision(inv.subDivisionId || '');
        setSiDiscount(inv.discount.toString());
        setSiSurcharge(inv.surcharge.toString());
        setSiCart(inv.items);
        setSiCosts(inv.additionalCosts);
    };

    // --- Direct Sales Logic ---
    const dsBatches = useMemo(() => {
        if (!dsSupplier) return [];
        // Only show batches with stock > 0.01 kg
        return state.purchases.filter(p => {
             if (p.supplierId !== dsSupplier) return false;
             
             // Calculate Available Stock for THIS batch
             const opened = state.originalOpenings.filter(o => o.batchNumber === p.batchNumber && o.supplierId === dsSupplier).reduce((sum: number, o) => sum + o.weightOpened, 0);
             const sold = state.salesInvoices.filter(inv => inv.status === 'Posted').reduce((sum: number, inv) => {
                 return sum + inv.items.filter(i => i.originalPurchaseId === p.id).reduce((is: number, item) => is + item.totalKg, 0);
             }, 0);
             
             return (p.weightPurchased - opened - sold) > 0.01;
        }).map(p => {
             const opened = state.originalOpenings.filter(o => o.batchNumber === p.batchNumber && o.supplierId === dsSupplier).reduce((sum: number, o) => sum + o.weightOpened, 0);
             const sold = state.salesInvoices.filter(inv => inv.status === 'Posted').reduce((sum: number, inv) => {
                 return sum + inv.items.filter(i => i.originalPurchaseId === p.id).reduce((is: number, item) => is + item.totalKg, 0);
             }, 0);
             const remaining = p.weightPurchased - opened - sold;
             return { id: p.id, name: `Batch #${p.batchNumber} (${remaining.toLocaleString()} Kg)`, remaining, landedCostPerKg: p.landedCostPerKg, purchase: p };
        });
    }, [dsSupplier, state.purchases, state.originalOpenings, state.salesInvoices]);

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

        const invoice: SalesInvoice = {
            id: Math.random().toString(36).substr(2, 9),
            invoiceNo: `DSINV-${Math.floor(Math.random() * 10000)}`,
            date: dsDate,
            status: 'Posted',
            customerId: dsCustomer,
            logoId: state.logos[0]?.id || '', // Default Logo
            currency: dsCurrency,
            exchangeRate: dsExchangeRate,
            discount: 0,
            surcharge: 0,
            items: [invoiceItem],
            additionalCosts: [],
            grossTotal: netTotal,
            netTotal: netTotal
        };

        addDirectSale(invoice, dsSelectedBatch?.landedCostPerKg || 0);
        
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
            const startNum = tempSerialTracker[item.id] ?? (item.nextSerial || 1);
            serialStart = startNum;
            serialEnd = startNum + qty - 1;
            setTempSerialTracker(prev => ({ ...prev, [item.id]: (serialEnd || 0) + 1 }));
        }

        const newEntry: ProductionEntry = {
            id: Math.random().toString(36).substr(2, 9),
            date: prodDate,
            itemId: item.id,
            itemName: item.name,
            packingType: item.packingType,
            qtyProduced: qty,
            weightProduced: qty * item.weightPerUnit,
            serialStart,
            serialEnd
        };
        setStagedProds([...stagedProds, newEntry]);
        setProdItemId('');
        setProdQty('');
    };

    const handleFinalizeProduction = () => {
        if (stagedProds.length === 0) return;
        addProduction(stagedProds);
        setStagedProds([]);
        setTempSerialTracker({});
        setShowProdSummary(false);
        alert("Production Saved Successfully");
    };

    // --- Re-baling Logic ---
    const handleAddConsume = () => {
        if (!rbConsumeId || !rbConsumeQty) return;
        const item = state.items.find(i => i.id === rbConsumeId);
        if (!item) return;
        const qty = parseFloat(rbConsumeQty);
        if (qty > item.stockQty) { alert(`Insufficient Stock! Available: ${item.stockQty}`); return; }
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
             const startNum = tempSerialTracker[item.id] ?? (item.nextSerial || 1);
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
                weightProduced: c.weight
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
                serialEnd: p.serialEnd
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
    const subModules = getSubModules(activeModule);
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
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4 print:hidden">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                {currentSubModuleDef && <currentSubModuleDef.icon size={24} />}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{currentSubModuleDef?.label}</h2>
                                <p className="text-sm text-slate-500">{currentSubModuleDef?.desc}</p>
                            </div>
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
                                                            onSelect={(id) => { setOoSupplier(id); setOoType(''); setOoBatch(''); }}
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
                                                            onSelect={(id) => { setOoType(id); setOoBatch(''); }}
                                                            placeholder="Select Type..."
                                                            disabled={!ooSupplier}
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.originalTypeConfig)}
                                                        />
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
                                                </div>
                                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex justify-between items-center">
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-500 uppercase">Available Stock</p>
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
                                                <button type="submit" disabled={!ooQty || !ooType} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors shadow-sm mt-2">Submit The Entry</button>
                                            </form>
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
                             <div className="animate-in fade-in duration-300 max-w-2xl mx-auto">
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
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Sale Rate ({dsCurrency} / Kg)</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-bold" value={dsRate} onChange={e => setDsRate(e.target.value)} /></div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                         <div><label className="block text-xs font-medium text-slate-500 mb-1">Currency</label><select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm" value={dsCurrency} onChange={e => setDsCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                         <div><label className="block text-xs font-medium text-slate-500 mb-1">Exchange Rate</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 text-sm" value={dsExchangeRate} onChange={e => setDsExchangeRate(parseFloat(e.target.value))} /></div>
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
                        )}

                        {/* --- ORIGINAL PURCHASE FORM --- */}
                        {activeSubModule === 'original-purchase' && (
                            <div className="animate-in fade-in duration-300 max-w-4xl mx-auto">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <Box className="text-blue-600" /> New Raw Material Purchase
                                </h3>
                                <form onSubmit={handlePreSubmitPurchase} className="space-y-6">
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
                                            <div className="bg-slate-700 text-white p-3 font-bold text-sm">Purchase Cart ({purCart.length} type{purCart.length > 1 ? 's' : ''})</div>
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
                                                                <td className="p-2 text-right font-mono">{item.weightPurchased.toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono">{item.costPerKgFCY.toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono text-green-600">{item.discountPerKgFCY ? `-${item.discountPerKgFCY.toFixed(2)}` : '-'}</td>
                                                                <td className="p-2 text-right font-mono text-orange-600">{item.surchargePerKgFCY ? `+${item.surchargePerKgFCY.toFixed(2)}` : '-'}</td>
                                                                <td className="p-2 text-right font-mono font-bold">{item.totalCostFCY.toFixed(2)}</td>
                                                                <td className="p-2 text-right font-mono font-bold text-blue-600">${item.totalCostUSD.toFixed(2)}</td>
                                                                <td className="p-2 text-right"><button type="button" onClick={() => handleRemoveFromPurCart(item.id)} className="text-red-500 hover:text-red-700"><X size={16}/></button></td>
                                                            </tr>
                                                        ))}
                                                        <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                                                            <td className="p-2">TOTALS</td>
                                                            <td className="p-2 text-right font-mono">{purCart.reduce((s,i)=>s+i.weightPurchased,0).toFixed(2)}</td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2"></td>
                                                            <td className="p-2 text-right font-mono text-blue-700">{purCart.reduce((s,i)=>s+i.totalCostFCY,0).toFixed(2)}</td>
                                                            <td className="p-2 text-right font-mono text-blue-700">${purCart.reduce((s,i)=>s+i.totalCostUSD,0).toFixed(2)}</td>
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
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Charge Type</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acType} onChange={e => setAcType(e.target.value as any)}><option value="Freight">Freight</option><option value="Clearing">Clearing</option><option value="Commission">Commission</option><option value="Other">Other</option></select></div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Provider/Agent</label>
                                                    <EntitySelector
                                                        entities={filteredProviders}
                                                        selectedId={acProvider}
                                                        onSelect={setAcProvider}
                                                        placeholder="Select..."
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig)}
                                                    />
                                                </div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acCurrency} onChange={e => setAcCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acAmount} onChange={e => setAcAmount(e.target.value)}/></div>
                                                <div className="md:col-span-1 flex items-end"><button type="button" onClick={handleAddCost} disabled={!acProvider || !acAmount} className="w-full bg-slate-800 text-white p-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:bg-slate-300">Add Cost</button></div>
                                            </div>
                                            <div className="space-y-2">{additionalCosts.map(cost => ( <div key={cost.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-sm"><div className="flex gap-4"><span className="font-semibold text-slate-700 w-24">{cost.costType}</span><span className="text-slate-600">{state.partners.find(p=>p.id===cost.providerId)?.name}</span></div><div className="flex items-center gap-4"><span className="font-mono">{cost.amountFCY} {cost.currency}</span><span className="text-slate-400 text-xs">Rate: {cost.exchangeRate}</span><span className="font-mono font-bold text-blue-600 w-20 text-right">${cost.amountUSD.toFixed(2)}</span><button type="button" onClick={() => setAdditionalCosts(additionalCosts.filter(c => c.id !== cost.id))} className="text-red-400 hover:text-red-600"><X size={14}/></button></div></div> ))}</div>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-2">
                                        <div className="flex justify-between text-sm"><span className="text-slate-500">Material Cost (Base USD):</span><span className="font-mono font-bold">${purCart.reduce((s,i)=>s+i.totalCostUSD,0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                        <div className="flex justify-between text-sm"><span className="text-slate-500">Additional Costs (Base USD):</span><span className="font-mono font-bold">${additionalCosts.reduce((s, c) => s + c.amountUSD, 0).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                        <div className="flex justify-between text-lg border-t border-blue-200 pt-2 mt-2"><span className="text-blue-800 font-bold">Total Landed Cost (USD):</span><span className="font-mono font-bold text-blue-800">${( purCart.reduce((s,i)=>s+i.totalCostUSD,0) + additionalCosts.reduce((s, c) => s + c.amountUSD, 0) ).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                    </div>
                                    <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors shadow-sm mt-4 flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed" disabled={!purSupplier || purCart.length === 0}><FileText size={18} /> Review & Submit</button>
                                </form>
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
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Currency</label><select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={bpCurrency} onChange={e => setBpCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c} value={c}>{c}</option>) : <option value="USD">USD</option>}</select></div>
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
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Charge Type</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acType} onChange={e => setAcType(e.target.value as any)}><option value="Freight">Freight</option><option value="Clearing">Clearing</option><option value="Commission">Commission</option><option value="Other">Other</option></select></div>
                                                <div className="md:col-span-1">
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Provider/Agent</label>
                                                    <EntitySelector
                                                        entities={filteredProviders}
                                                        selectedId={acProvider}
                                                        onSelect={setAcProvider}
                                                        placeholder="Select..."
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig)}
                                                    />
                                                </div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Currency</label><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acCurrency} onChange={e => setAcCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                                <div className="md:col-span-1"><label className="block text-xs font-semibold text-slate-500 mb-1">Amount</label><input type="number" placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-800" value={acAmount} onChange={e => setAcAmount(e.target.value)}/></div>
                                                <div className="md:col-span-1 flex items-end"><button type="button" onClick={handleAddCost} disabled={!acProvider || !acAmount} className="w-full bg-slate-800 text-white p-2 rounded-lg text-sm font-medium hover:bg-slate-700 disabled:bg-slate-300">Add Cost</button></div>
                                            </div>
                                            <div className="space-y-2">{additionalCosts.map(cost => ( <div key={cost.id} className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-sm"><div className="flex gap-4"><span className="font-semibold text-slate-700 w-24">{cost.costType}</span><span className="text-slate-600">{state.partners.find(p=>p.id===cost.providerId)?.name}</span></div><div className="flex items-center gap-4"><span className="font-mono">{cost.amountFCY} {cost.currency}</span><span className="text-slate-400 text-xs">Rate: {cost.exchangeRate}</span><span className="font-mono font-bold text-blue-600 w-20 text-right">${cost.amountUSD.toFixed(2)}</span><button type="button" onClick={() => setAdditionalCosts(additionalCosts.filter(c => c.id !== cost.id))} className="text-red-400 hover:text-red-600"><X size={14}/></button></div></div> ))}</div>
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
                                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Invoice #</label><input type="text" className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-800 font-mono font-bold" value={siInvoiceNo} readOnly /></div>
                                            <div><label className="block text-sm font-medium text-slate-600 mb-1">Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={siDate} onChange={e => setSiDate(e.target.value)} /></div>
                                            
                                            <div>
                                                <label className="block text-sm font-medium text-slate-600 mb-1">Branding / Logo</label>
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
                                            <div className="grid grid-cols-2 gap-2">
                                                 <div><label className="block text-xs font-medium text-slate-500 mb-1">Currency</label><select className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono text-sm" value={siCurrency} onChange={e => setSiCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c => <option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                                 <div><label className="block text-xs font-medium text-slate-500 mb-1">Rate</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono text-sm" value={siExchangeRate} onChange={e => setSiExchangeRate(parseFloat(e.target.value))} /></div>
                                            </div>
                                        </div>
                                        
                                        {/* Logistics */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                            <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Truck size={16} /> Logistics & Destination</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                <div><label className="block text-xs font-semibold text-slate-500 mb-1">Container</label><input type="text" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" value={siContainer} onChange={e => setSiContainer(e.target.value)} /></div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-500 mb-1">Division</label>
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
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div><label className="block text-xs font-semibold text-slate-500 mb-1">Discount</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" placeholder="0.00" value={siDiscount} onChange={e => setSiDiscount(e.target.value)} /></div>
                                                    <div><label className="block text-xs font-semibold text-slate-500 mb-1">Surcharge</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800" placeholder="0.00" value={siSurcharge} onChange={e => setSiSurcharge(e.target.value)} /></div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Item Cart */}
                                        <div className="border-t border-slate-200 pt-6">
                                             <h4 className="font-bold text-slate-700 mb-4">Item Entry</h4>
                                             <div className="bg-slate-100 p-3 rounded-lg flex flex-wrap md:flex-nowrap gap-3 mb-4 z-10 relative">
                                                 <div className="w-full md:w-1/3">
                                                    <EntitySelector 
                                                        entities={state.items} 
                                                        selectedId={siItemId} 
                                                        onSelect={setSiItemId} 
                                                        placeholder="Select Item..." 
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                                    />
                                                 </div>
                                                 <div className="w-1/2 md:w-24"><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Qty" value={siItemQty} onChange={e => setSiItemQty(e.target.value)} /></div>
                                                 <div className="w-1/2 md:w-32"><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Rate/Unit" value={siItemRate} onChange={e => setSiItemRate(e.target.value)} /></div>
                                                 <div className="w-full md:w-auto"><button onClick={handleAddSiItem} className="w-full bg-blue-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-blue-700">Add Item</button></div>
                                             </div>
                                             <table className="w-full text-sm text-left border border-slate-200 rounded-lg overflow-hidden">
                                                 <thead className="bg-slate-50 font-bold text-slate-600 border-b border-slate-200"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Total Kg</th><th className="px-4 py-2 text-right">Rate ({siCurrency})</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-center">Action</th></tr></thead>
                                                 <tbody className="divide-y divide-slate-100">
                                                     {siCart.map(item => ( <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-2">{item.itemName}</td><td className="px-4 py-2 text-right">{item.qty}</td><td className="px-4 py-2 text-right text-slate-500">{item.totalKg}</td><td className="px-4 py-2 text-right">{item.rate.toFixed(2)}</td><td className="px-4 py-2 text-right font-bold">{item.total.toFixed(2)}</td><td className="px-4 py-2 text-center"><button onClick={() => setSiCart(siCart.filter(x => x.id !== item.id))} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></td></tr> ))}
                                                     {siCart.length === 0 && <tr><td colSpan={6} className="text-center py-4 text-slate-400 italic">No items added</td></tr>}
                                                 </tbody>
                                             </table>
                                        </div>
                                        
                                        {/* Additional Costs (Invoice Level) */}
                                        <div className="border-t border-slate-200 pt-6">
                                            <h4 className="font-bold text-slate-700 mb-4">Additional Costs (Pass-through)</h4>
                                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                                                <div className="flex flex-wrap md:flex-nowrap gap-3">
                                                    <div className="w-full md:w-32"><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" value={siCostType} onChange={e => setSiCostType(e.target.value)}><option value="Freight">Freight</option><option value="Clearing">Clearing</option><option value="Commission">Commission</option><option value="Customs">Customs</option><option value="Other">Other</option></select></div>
                                                    <div className="w-full md:w-1/3">
                                                        <EntitySelector 
                                                            entities={state.partners.filter(p => [PartnerType.FREIGHT_FORWARDER, PartnerType.CLEARING_AGENT, PartnerType.COMMISSION_AGENT, PartnerType.VENDOR].includes(p.type))} 
                                                            selectedId={siCostProvider} 
                                                            onSelect={setSiCostProvider} 
                                                            placeholder="Provider (Optional)" 
                                                            onQuickAdd={() => openQuickAdd(setupConfigs.partnerConfig)}
                                                        />
                                                    </div>
                                                    <div className="w-1/2 md:w-24"><select className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" value={siCostCurrency} onChange={e => setSiCostCurrency(e.target.value as Currency)}>{state.currencies.length > 0 ? state.currencies.map(c=><option key={c.code} value={c.code}>{c.code}</option>) : <option value="USD">USD</option>}</select></div>
                                                    <div className="w-1/2 md:w-32"><input type="number" className="w-full p-2 border border-slate-300 rounded-lg text-sm bg-white" placeholder="Amount" value={siCostAmount} onChange={e => setSiCostAmount(e.target.value)} /></div>
                                                    <button onClick={handleAddSiCost} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700">Add</button>
                                                </div>
                                                <div className="space-y-1">
                                                    {siCosts.map(c => ( <div key={c.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-slate-200"><span>{c.costType} {c.providerId && `(${state.partners.find(p=>p.id===c.providerId)?.name})`}</span><div className="flex gap-4 font-mono"><span>{c.amount} {c.currency}</span><button onClick={() => setSiCosts(siCosts.filter(x => x.id !== c.id))} className="text-red-400 hover:text-red-600"><X size={14}/></button></div></div> ))}
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
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3 text-right">Net Total</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Actions</th></tr></thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {state.salesInvoices.map(inv => (
                                                    <tr key={inv.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3">{inv.date}</td>
                                                        <td className="px-4 py-3 font-mono font-bold text-blue-600">{inv.invoiceNo}</td>
                                                        <td className="px-4 py-3">{state.partners.find(p => p.id === inv.customerId)?.name}</td>
                                                        <td className="px-4 py-3 text-right font-mono">{inv.netTotal.toLocaleString()} {inv.currency}</td>
                                                        <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${inv.status === 'Posted' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}`}>{inv.status}</span></td>
                                                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                                                            <button onClick={() => handleEditInvoice(inv)} className="text-blue-500 hover:text-blue-700" title="Edit"><Edit2 size={16} /></button>
                                                            <button onClick={() => deleteEntity('salesInvoices', inv.id)} className="text-red-400 hover:text-red-600" title="Delete"><Trash2 size={16} /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {state.salesInvoices.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No invoices found.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- FINISHED GOODS PRODUCTION FORM --- */}
                        {activeSubModule === 'fg-production' && (
                            <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-12 gap-8">
                                    <div className="md:col-span-7 space-y-6">
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Production Date</label><input type="date" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500" value={prodDate} onChange={e => { setProdDate(e.target.value); setStagedProds([]); }} required /></div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 mb-1">Select Item</label>
                                            <EntitySelector
                                                entities={state.items.filter(i => i.category !== 'Raw Material')}
                                                selectedId={prodItemId}
                                                onSelect={setProdItemId}
                                                placeholder="Choose Finished Good..."
                                                onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
                                            />
                                            <div className="flex justify-between mt-1 text-xs">
                                                {selectedItem && ( <span className="text-slate-500">Packing: {selectedItem.packingType} {selectedItem.packingType !== 'Kg' && ` (Next Serial: #${tempSerialTracker[selectedItem.id] || selectedItem.nextSerial || 1})`}</span> )}
                                            </div>
                                        </div>
                                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Quantity (Units)</label><input type="number" className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 focus:outline-none focus:border-blue-500 font-bold" placeholder="0" value={prodQty} onChange={e => setProdQty(e.target.value)} /></div>
                                        <button onClick={handleStageProduction} disabled={!prodItemId || !prodQty} className="w-full bg-white border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"><Plus size={18} /> Add to List</button>
                                    </div>
                                    <div className="md:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-4"><h4 className="font-semibold text-slate-700">Staged Entries</h4><span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-bold">{stagedProds.length}</span></div>
                                        <div className="flex-1 overflow-y-auto min-h-[200px] mb-4">{stagedProds.length === 0 ? ( <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm"><Layers size={32} className="mb-2 opacity-30" /><p>No items added yet</p></div> ) : ( <div className="space-y-2">{stagedProds.map((entry, idx) => ( <div key={entry.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center group"><div><div className="font-medium text-slate-800 text-sm">{entry.itemName}</div><div className="text-xs text-slate-500 flex gap-2"><span>{entry.qtyProduced} {entry.packingType}s</span>{entry.serialStart && ( <span className="text-emerald-600 font-mono bg-emerald-50 px-1 rounded">#{entry.serialStart} - #{entry.serialEnd}</span> )}</div></div><button onClick={() => setStagedProds(stagedProds.filter(p => p.id !== entry.id))} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button></div> ))}</div> )}</div>
                                        <div className="border-t border-slate-200 pt-4 mt-auto"><div className="flex justify-between text-sm mb-4 font-medium text-slate-700"><span>Total Units:</span><span>{stagedProds.reduce((sum, p) => sum + p.qtyProduced, 0)}</span></div><button onClick={() => setShowProdSummary(true)} disabled={stagedProds.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"><Save size={18} /> Finalize & Save</button></div>
                                    </div>
                                <div className="md:col-span-12 mt-8 pt-6 border-t border-slate-200"><h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2"><History size={16} className="text-slate-400" /> Saved Entries ({prodDate})</h4><div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500 uppercase text-xs"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Qty</th><th className="px-4 py-2">Weight</th><th className="px-4 py-2">Serials</th></tr></thead><tbody className="divide-y divide-slate-100">{state.productions.filter(p => p.date === prodDate).map(p => ( <tr key={p.id} className="hover:bg-slate-50"><td className="px-4 py-2 font-medium text-slate-700">{p.itemName}</td><td className="px-4 py-2">{p.qtyProduced} {p.packingType}</td><td className="px-4 py-2 text-slate-500">{p.weightProduced} kg</td><td className="px-4 py-2 font-mono text-xs text-slate-600">{p.serialStart ? `#${p.serialStart} - #${p.serialEnd}` : '-'}</td></tr> ))} {state.productions.filter(p => p.date === prodDate).length === 0 && ( <tr><td colSpan={4} className="text-center py-4 text-slate-400 text-xs italic">No production saved for this date.</td></tr> )}</tbody></table></div></div>
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
                                                        entities={state.items.filter(i => i.stockQty > 0)}
                                                        selectedId={rbConsumeId}
                                                        onSelect={setRbConsumeId}
                                                        placeholder="Select Item..."
                                                        onQuickAdd={() => openQuickAdd(setupConfigs.itemConfig)}
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
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center"><h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CheckCircle className="text-emerald-500" /> Confirm Production</h3><button onClick={() => setShowProdSummary(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button></div>
                        <div className="p-6"><p className="text-sm text-slate-500 mb-4">Please review the staged items before saving. Compare with yesterday's output to ensure consistency.</p><table className="w-full text-sm text-left mb-6"><thead className="bg-slate-50 text-slate-500 uppercase text-xs"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3 text-right">Qty (Today)</th><th className="px-4 py-3 text-right">Yesterday</th><th className="px-4 py-3 text-right">Variance</th></tr></thead><tbody className="divide-y divide-slate-100">{stagedProds.map(p => { const yesterdayQty = getYesterdayProduction(p.itemId); const variance = p.qtyProduced - yesterdayQty; return ( <tr key={p.id}><td className="px-4 py-3 font-medium text-slate-800">{p.itemName}</td><td className="px-4 py-3 text-right font-bold">{p.qtyProduced}</td><td className="px-4 py-3 text-right text-slate-500">{yesterdayQty}</td><td className={`px-4 py-3 text-right ${variance > 0 ? 'text-emerald-600' : variance < 0 ? 'text-red-500' : 'text-slate-400'}`}>{variance > 0 ? '+' : ''}{variance}</td></tr> ); })}</tbody></table><div className="flex justify-end gap-3"><button onClick={() => setShowProdSummary(false)} className="px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium">Cancel</button><button onClick={handleFinalizeProduction} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold shadow-sm">Save & Continue</button></div></div>
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
                            <table className="w-full text-sm text-left mb-8"><thead className="bg-slate-100 text-slate-600 uppercase text-xs font-bold border-b border-slate-200"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Weight (Kg)</th><th className="px-4 py-3 text-right">Net Rate ({purCurrency})</th><th className="px-4 py-3 text-right">Total ({purCurrency})</th></tr></thead><tbody className="divide-y divide-slate-100">{purCart.map(item => ( <tr key={item.id}><td className="px-4 py-3 font-medium">{item.originalType}</td><td className="px-4 py-3 text-right">{item.weightPurchased.toFixed(2)}</td><td className="px-4 py-3 text-right">{(item.costPerKgFCY - (item.discountPerKgFCY||0) + (item.surchargePerKgFCY||0)).toFixed(2)}</td><td className="px-4 py-3 text-right font-bold">{item.totalCostFCY.toFixed(2)}</td></tr> ))}<tr className="bg-blue-50 font-bold"><td className="px-4 py-3" colSpan={3}>TOTAL</td><td className="px-4 py-3 text-right">{purCart.reduce((s,i)=>s+i.totalCostFCY,0).toFixed(2)}</td></tr></tbody></table>
                            
                             <div className="border-t border-slate-200 pt-6"><h4 className="font-bold text-slate-700 mb-4">Landed Cost Calculation (Base USD)</h4><div className="space-y-2 text-sm max-w-sm ml-auto">
                                <div className="flex justify-between border-b border-slate-100 pb-1 mb-1"><span className="text-slate-700 font-medium">Net Material Cost:</span><span className="font-mono text-slate-800 font-medium">${purCart.reduce((s,i)=>s+i.totalCostUSD,0).toFixed(2)}</span></div>
                                {additionalCosts.map(ac => ( <div key={ac.id} className="flex justify-between"><span className="text-slate-500">{ac.costType} ({state.partners.find(p=>p.id===ac.providerId)?.name}):</span><span className="font-mono text-slate-800">${ac.amountUSD.toFixed(2)}</span></div> ))} 
                                <div className="flex justify-between border-t border-slate-300 pt-2 font-bold text-lg"><span className="text-blue-800">Total Landed Cost:</span><span className="font-mono text-blue-800">${( purCart.reduce((s,i)=>s+i.totalCostUSD,0) + additionalCosts.reduce((s, c) => s + c.amountUSD, 0) ).toLocaleString(undefined, {maximumFractionDigits: 2})}</span></div>
                                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>Cost per Kg:</span><span className="font-mono">${(( purCart.reduce((s,i)=>s+i.totalCostUSD,0) + additionalCosts.reduce((s, c) => s + c.amountUSD, 0) ) / purCart.reduce((s,i)=>s+i.weightPurchased,0)).toFixed(3)}</span></div></div>
                             </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center"><button onClick={() => setShowPurSummary(false)} className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium">Cancel</button><div className="flex gap-3"><button onClick={handlePrint} disabled={purPrinted} className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"><Printer size={18} /> {purPrinted ? 'Ready to Save' : 'Print Invoice'}</button><button onClick={handleFinalPurchaseSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm flex items-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed"><Download size={18} /> Save & Exit</button></div></div>
                    </div>
                </div>
            )}
            
            {/* Sales Invoice Summary Modal (Mock PDF) */}
        </div>
    );
};
            