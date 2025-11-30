/**
 * Partner Service - Handles all Customer/Supplier/Vendor operations
 * Uses proper Firestore collections (NOT a monolith document)
 */

import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { Partner } from '../types';

const COLLECTION_NAME = 'partners';

/**
 * Utility: Convert undefined to null (Firestore requirement)
 */
const sanitizeData = (data: any): any => {
    const sanitized = { ...data };
    Object.keys(sanitized).forEach(key => {
        if (sanitized[key] === undefined) {
            sanitized[key] = null;
        }
    });
    return sanitized;
};

export const PartnerService = {
    /**
     * Create a new partner (Customer/Supplier/Vendor)
     * @param partner - Partner data
     * @returns Promise<string> - Document ID
     */
    createPartner: async (partner: Omit<Partner, 'id'>): Promise<string> => {
        try {
            const partnerData = sanitizeData({
                ...partner,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            const docRef = await addDoc(collection(db, COLLECTION_NAME), partnerData);
            console.log('✅ Partner created:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ Error creating partner:', error);
            throw error;
        }
    },

    /**
     * Get all partners
     * @returns Promise<Partner[]>
     */
    getAllPartners: async (): Promise<Partner[]> => {
        try {
            const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
            const partners: Partner[] = [];
            
            querySnapshot.forEach((doc) => {
                partners.push({
                    id: doc.id,
                    ...doc.data()
                } as Partner);
            });

            console.log(`✅ Loaded ${partners.length} partners`);
            return partners;
        } catch (error) {
            console.error('❌ Error fetching partners:', error);
            throw error;
        }
    },

    /**
     * Get partners by type (CUSTOMER, SUPPLIER, VENDOR)
     * @param type - Partner type
     * @returns Promise<Partner[]>
     */
    getPartnersByType: async (type: string): Promise<Partner[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), where('type', '==', type));
            const querySnapshot = await getDocs(q);
            const partners: Partner[] = [];
            
            querySnapshot.forEach((doc) => {
                partners.push({
                    id: doc.id,
                    ...doc.data()
                } as Partner);
            });

            console.log(`✅ Loaded ${partners.length} ${type}s`);
            return partners;
        } catch (error) {
            console.error(`❌ Error fetching ${type}s:`, error);
            throw error;
        }
    },

    /**
     * Update a partner
     * @param id - Partner ID
     * @param updates - Partial partner data
     */
    updatePartner: async (id: string, updates: Partial<Partner>): Promise<void> => {
        try {
            const partnerRef = doc(db, COLLECTION_NAME, id);
            const sanitizedUpdates = sanitizeData({
                ...updates,
                updatedAt: serverTimestamp()
            });

            await updateDoc(partnerRef, sanitizedUpdates);
            console.log('✅ Partner updated:', id);
        } catch (error) {
            console.error('❌ Error updating partner:', error);
            throw error;
        }
    },

    /**
     * Delete a partner
     * @param id - Partner ID
     */
    deletePartner: async (id: string): Promise<void> => {
        try {
            const partnerRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(partnerRef);
            console.log('✅ Partner deleted:', id);
        } catch (error) {
            console.error('❌ Error deleting partner:', error);
            throw error;
        }
    },

    /**
     * ATOMIC TRANSACTION: Create partner with opening balance
     * This creates the partner AND the ledger entries in ONE transaction
     * @param partner - Partner data
     * @param openingBalance - Opening balance (0 if none)
     */
    createPartnerWithBalance: async (
        partner: Omit<Partner, 'id'>,
        openingBalance: number = 0
    ): Promise<string> => {
        const batch = writeBatch(db);
        
        try {
            // Step 1: Create partner document
            const partnerRef = doc(collection(db, COLLECTION_NAME));
            const partnerData = sanitizeData({
                ...partner,
                balance: openingBalance,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            batch.set(partnerRef, partnerData);

            // Step 2: If there's an opening balance, create journal entries
            if (openingBalance !== 0) {
                const journalRef1 = doc(collection(db, 'journal_entries'));
                const journalRef2 = doc(collection(db, 'journal_entries'));

                const isCustomer = partner.type === 'CUSTOMER';
                const accountType = isCustomer ? 'Accounts Receivable' : 'Accounts Payable';

                batch.set(journalRef1, sanitizeData({
                    date: new Date().toISOString().split('T')[0],
                    transactionId: `OB-${partnerRef.id}`,
                    transactionType: 'OPENING_BALANCE',
                    accountId: isCustomer ? '103' : '201',
                    accountName: accountType,
                    partnerId: partnerRef.id,
                    partnerName: partner.name,
                    debit: isCustomer ? Math.abs(openingBalance) : 0,
                    credit: isCustomer ? 0 : Math.abs(openingBalance),
                    narration: `Opening Balance - ${partner.name}`,
                    createdAt: serverTimestamp()
                }));

                batch.set(journalRef2, sanitizeData({
                    date: new Date().toISOString().split('T')[0],
                    transactionId: `OB-${partnerRef.id}`,
                    transactionType: 'OPENING_BALANCE',
                    accountId: '301',
                    accountName: 'Opening Equity',
                    debit: isCustomer ? 0 : Math.abs(openingBalance),
                    credit: isCustomer ? Math.abs(openingBalance) : 0,
                    narration: `Opening Balance - ${partner.name}`,
                    createdAt: serverTimestamp()
                }));
            }

            // COMMIT ALL OR NOTHING
            await batch.commit();
            console.log('✅ Partner created with opening balance (ATOMIC):', partnerRef.id);
            return partnerRef.id;

        } catch (error) {
            console.error('❌ Transaction failed, all changes rolled back:', error);
            throw error;
        }
    }
};
