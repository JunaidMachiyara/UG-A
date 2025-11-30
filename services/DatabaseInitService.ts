/**
 * Database Initialization Service
 * Creates the proper Firestore structure with sample data for testing
 */

import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const DatabaseInitService = {
    /**
     * Check if database has been initialized
     */
    isInitialized: async (): Promise<boolean> => {
        try {
            const partnersSnapshot = await getDocs(collection(db, 'partners'));
            return !partnersSnapshot.empty;
        } catch (error) {
            return false;
        }
    },

    /**
     * Initialize database with proper collections structure
     * Creates sample data to verify everything works
     */
    initializeDatabase: async (): Promise<void> => {
        const batch = writeBatch(db);

        try {
            console.log('🔧 Initializing Firebase database structure...');

            // Create sample customers
            const customer1Ref = doc(collection(db, 'partners'));
            batch.set(customer1Ref, {
                name: 'Sample Customer 1',
                type: 'CUSTOMER',
                balance: 0,
                defaultCurrency: 'USD',
                country: 'United States',
                phone: '+1-555-0001',
                email: 'customer1@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const customer2Ref = doc(collection(db, 'partners'));
            batch.set(customer2Ref, {
                name: 'Sample Customer 2',
                type: 'CUSTOMER',
                balance: 0,
                defaultCurrency: 'USD',
                country: 'United States',
                phone: '+1-555-0002',
                email: 'customer2@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Create sample supplier
            const supplier1Ref = doc(collection(db, 'partners'));
            batch.set(supplier1Ref, {
                name: 'Sample Supplier 1',
                type: 'SUPPLIER',
                balance: 0,
                defaultCurrency: 'USD',
                country: 'China',
                phone: '+86-555-0001',
                email: 'supplier1@example.com',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Create sample chart of accounts
            const accounts = [
                { id: '101', name: 'Cash', type: 'ASSET', balance: 0 },
                { id: '102', name: 'Bank Account', type: 'ASSET', balance: 0 },
                { id: '103', name: 'Accounts Receivable', type: 'ASSET', balance: 0 },
                { id: '104', name: 'Inventory - Raw Material', type: 'ASSET', balance: 0 },
                { id: '105', name: 'Inventory - Finished Goods', type: 'ASSET', balance: 0 },
                { id: '201', name: 'Accounts Payable', type: 'LIABILITY', balance: 0 },
                { id: '301', name: 'Owner\'s Capital', type: 'EQUITY', balance: 0 },
                { id: '401', name: 'Sales Revenue', type: 'REVENUE', balance: 0 },
                { id: '501', name: 'Cost of Goods Sold', type: 'EXPENSE', balance: 0 },
            ];

            accounts.forEach(account => {
                const accountRef = doc(db, 'accounts', account.id);
                batch.set(accountRef, {
                    ...account,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            });

            // Create sample item
            const item1Ref = doc(collection(db, 'items'));
            batch.set(item1Ref, {
                name: 'Sample Product A',
                category: 'Finished Goods',
                stockQty: 0,
                salePrice: 100,
                avgCost: 50,
                weightPerUnit: 1,
                packingType: 'KG',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Commit all changes atomically
            await batch.commit();
            
            console.log('✅ Database initialized successfully!');
            console.log('📦 Created collections:');
            console.log('   - partners (3 sample records)');
            console.log('   - accounts (9 chart of accounts)');
            console.log('   - items (1 sample item)');

        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }
};
