import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Database, PlayCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export const FactoryDataMigration: React.FC = () => {
    const { factories, currentFactory } = useAuth();
    const [selectedFactoryId, setSelectedFactoryId] = useState('');
    const [migrating, setMigrating] = useState(false);
    const [progress, setProgress] = useState<string[]>([]);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const addProgress = (msg: string) => {
        setProgress(prev => [...prev, msg]);
    };

    const collectionsToMigrate = [
        'partners',
        'items',
        'accounts',
        'employees',
        'purchases',
        'salesInvoices',
        'ledger',
        'productions',
        'originalOpenings',
        'bundlePurchases',
        'logisticsEntries',
        'ongoingOrders'
    ];

    const migrateData = async () => {
        if (!selectedFactoryId) {
            alert('Please select a factory');
            return;
        }

        setMigrating(true);
        setProgress([]);
        setResult(null);

        try {
            addProgress('🚀 Starting migration...');
            let totalUpdated = 0;

            for (const collectionName of collectionsToMigrate) {
                addProgress(`\n📦 Processing collection: ${collectionName}`);
                
                const snapshot = await getDocs(collection(db, collectionName));
                
                if (snapshot.empty) {
                    addProgress(`  ⏭️  Empty - skipped`);
                    continue;
                }

                // Filter documents that don't have factoryId
                const docsToUpdate = snapshot.docs.filter(doc => !doc.data().factoryId);
                
                if (docsToUpdate.length === 0) {
                    addProgress(`  ✓ Already migrated (${snapshot.size} docs)`);
                    continue;
                }

                // Update in batches of 500 (Firestore limit)
                const batches = [];
                let currentBatch = writeBatch(db);
                let operationCount = 0;

                docsToUpdate.forEach((document) => {
                    currentBatch.update(document.ref, { factoryId: selectedFactoryId });
                    operationCount++;
                    totalUpdated++;

                    if (operationCount === 500) {
                        batches.push(currentBatch);
                        currentBatch = writeBatch(db);
                        operationCount = 0;
                    }
                });

                if (operationCount > 0) {
                    batches.push(currentBatch);
                }

                // Commit all batches
                for (const batch of batches) {
                    await batch.commit();
                }

                addProgress(`  ✓ Updated ${docsToUpdate.length} documents`);
            }

            addProgress(`\n✅ Migration complete!`);
            addProgress(`📊 Total documents updated: ${totalUpdated}`);
            
            setResult({
                success: true,
                message: `Successfully migrated ${totalUpdated} documents to factory ${factories.find(f => f.id === selectedFactoryId)?.name}`
            });

        } catch (error) {
            console.error('Migration error:', error);
            addProgress(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setResult({
                success: false,
                message: 'Migration failed. Check console for details.'
            });
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                    <Database size={32} />
                    <h2 className="text-2xl font-bold">Factory Data Migration</h2>
                </div>
                <p className="text-purple-100">Add factoryId to existing data</p>
            </div>

            <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertCircle className="text-amber-600 shrink-0 mt-1" size={24} />
                    <div>
                        <h3 className="font-bold text-amber-900 mb-2">⚠️ Important</h3>
                        <p className="text-sm text-amber-800 mb-2">
                            This tool will add <code className="bg-amber-200 px-2 py-1 rounded">factoryId</code> field 
                            to all existing records that don't have one yet.
                        </p>
                        <p className="text-sm text-amber-800">
                            <strong>Choose carefully!</strong> Once assigned, you'll need to manually update if wrong.
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-6">
                <h3 className="font-bold text-lg mb-4">Select Factory for Existing Data</h3>
                <p className="text-sm text-slate-600 mb-4">
                    All existing records without a factory will be assigned to:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {factories.map(factory => (
                        <button
                            key={factory.id}
                            onClick={() => setSelectedFactoryId(factory.id)}
                            disabled={migrating}
                            className={`p-6 rounded-lg border-2 transition-all ${
                                selectedFactoryId === factory.id
                                    ? 'border-indigo-500 bg-indigo-50'
                                    : 'border-slate-200 hover:border-indigo-300'
                            } ${migrating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className="text-center">
                                <div className="text-2xl font-bold text-indigo-900 mb-1">{factory.name}</div>
                                <div className="text-sm text-indigo-600">{factory.code}</div>
                                <div className="text-xs text-slate-500 mt-1">{factory.location}</div>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Collections to migrate:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-700">
                        {collectionsToMigrate.map(col => (
                            <div key={col} className="flex items-center gap-2">
                                <CheckCircle size={14} />
                                <span>{col}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <button
                    onClick={migrateData}
                    disabled={!selectedFactoryId || migrating}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {migrating ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            Migrating...
                        </>
                    ) : (
                        <>
                            <PlayCircle size={20} />
                            Start Migration
                        </>
                    )}
                </button>
            </div>

            {progress.length > 0 && (
                <div className="bg-slate-900 rounded-lg p-4">
                    <h3 className="font-bold text-white mb-3">Migration Log:</h3>
                    <div className="bg-black rounded p-4 max-h-96 overflow-y-auto font-mono text-sm text-green-400 space-y-1">
                        {progress.map((msg, idx) => (
                            <div key={idx}>{msg}</div>
                        ))}
                    </div>
                </div>
            )}

            {result && (
                <div className={`border-l-4 p-6 rounded-lg ${
                    result.success 
                        ? 'bg-green-50 border-green-500' 
                        : 'bg-red-50 border-red-500'
                }`}>
                    <div className="flex items-center gap-2 mb-2">
                        {result.success ? (
                            <CheckCircle className="text-green-600" size={24} />
                        ) : (
                            <AlertCircle className="text-red-600" size={24} />
                        )}
                        <span className={`font-bold text-lg ${
                            result.success ? 'text-green-900' : 'text-red-900'
                        }`}>
                            {result.success ? 'Success!' : 'Failed'}
                        </span>
                    </div>
                    <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                        {result.message}
                    </p>
                </div>
            )}
        </div>
    );
};
