import React, { useState } from 'react';
import { DatabaseInitService } from '../services/DatabaseInitService';
import { Database, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export const DatabaseSetup: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'checking' | 'initialized' | 'not-initialized'>('idle');
    const [isInitializing, setIsInitializing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkInitialization = async () => {
        setStatus('checking');
        setError(null);
        try {
            const initialized = await DatabaseInitService.isInitialized();
            setStatus(initialized ? 'initialized' : 'not-initialized');
        } catch (err: any) {
            setError(err.message);
            setStatus('idle');
        }
    };

    const initializeDatabase = async () => {
        setIsInitializing(true);
        setError(null);
        try {
            await DatabaseInitService.initializeDatabase();
            setStatus('initialized');
            alert('✅ Database initialized successfully! You can now start using the app.');
        } catch (err: any) {
            setError(err.message);
            alert('❌ Error: ' + err.message);
        } finally {
            setIsInitializing(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
                <div className="flex items-center gap-3 mb-6">
                    <Database className="text-blue-600" size={32} />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Database Setup</h2>
                        <p className="text-sm text-slate-500">Initialize your new Firebase database structure</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Status */}
                    {status === 'idle' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-blue-800 text-sm">Click below to check if your database has been initialized.</p>
                        </div>
                    )}

                    {status === 'checking' && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                            <Loader className="animate-spin text-yellow-600" size={20} />
                            <p className="text-yellow-800 text-sm">Checking database status...</p>
                        </div>
                    )}

                    {status === 'initialized' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                            <CheckCircle className="text-emerald-600" size={20} />
                            <p className="text-emerald-800 text-sm font-medium">✅ Database is already initialized and ready!</p>
                        </div>
                    )}

                    {status === 'not-initialized' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-start gap-3 mb-4">
                                <AlertCircle className="text-orange-600 flex-shrink-0 mt-0.5" size={20} />
                                <div>
                                    <p className="text-orange-800 text-sm font-medium mb-2">Database not initialized</p>
                                    <p className="text-orange-700 text-xs">Your Firebase database is empty. Click the button below to create the proper structure with sample data.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-800 text-sm font-medium">Error: {error}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        {status === 'idle' || status === 'initialized' ? (
                            <button
                                onClick={checkInitialization}
                                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                            >
                                Check Database Status
                            </button>
                        ) : null}

                        {status === 'not-initialized' && (
                            <button
                                onClick={initializeDatabase}
                                disabled={isInitializing}
                                className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isInitializing ? (
                                    <>
                                        <Loader className="animate-spin" size={18} />
                                        Initializing...
                                    </>
                                ) : (
                                    'Initialize Database Now'
                                )}
                            </button>
                        )}
                    </div>

                    {/* Info */}
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">What will be created:</h3>
                        <ul className="text-xs text-slate-600 space-y-1">
                            <li>✓ <strong>Partners collection:</strong> 3 sample customers/suppliers</li>
                            <li>✓ <strong>Accounts collection:</strong> 9 chart of accounts (Cash, AR, AP, etc.)</li>
                            <li>✓ <strong>Items collection:</strong> 1 sample product</li>
                            <li>✓ <strong>Journal entries collection:</strong> Ready for transactions</li>
                        </ul>
                        <p className="text-xs text-slate-500 mt-3">
                            <strong>Note:</strong> This uses the new proper structure (separate collections) instead of the old monolith approach.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
