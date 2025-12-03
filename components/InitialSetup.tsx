import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Building2, User, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export const InitialSetup: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [progress, setProgress] = useState<string[]>([]);

    const addProgress = (msg: string) => {
        setProgress(prev => [...prev, msg]);
    };

    const initializeSystem = async () => {
        setStatus('running');
        setProgress([]);

        try {
            // Step 1: Check if factories already exist
            addProgress('Checking existing factories...');
            const factoriesSnapshot = await getDocs(collection(db, 'factories'));
            
            if (factoriesSnapshot.size > 0) {
                setMessage('Factories already initialized');
                addProgress(`✓ Found ${factoriesSnapshot.size} existing factories`);
                setStatus('success');
                return;
            }

            // Step 2: Create 3 factories
            addProgress('Creating factories...');
            const factories = [
                {
                    name: 'MAAZ',
                    code: 'MAZ',
                    location: 'Dubai, UAE',
                    isActive: true,
                    createdDate: new Date().toISOString()
                },
                {
                    name: 'TALHA',
                    code: 'TLH',
                    location: 'Sharjah, UAE',
                    isActive: true,
                    createdDate: new Date().toISOString()
                },
                {
                    name: 'AL ANWAR',
                    code: 'ANW',
                    location: 'Ajman, UAE',
                    isActive: true,
                    createdDate: new Date().toISOString()
                }
            ];

            const createdFactories = [];
            for (const factory of factories) {
                const docRef = await addDoc(collection(db, 'factories'), factory);
                createdFactories.push({ id: docRef.id, ...factory });
                addProgress(`✓ Created factory: ${factory.name}`);
            }

            // Step 3: Check if admin user exists
            addProgress('Checking for admin user...');
            const usersSnapshot = await getDocs(collection(db, 'users'));
            
            if (usersSnapshot.size === 0) {
                // Create default super admin user
                addProgress('Creating default super admin...');
                await addDoc(collection(db, 'users'), {
                    username: 'admin',
                    password: 'admin123', // Change this immediately after first login!
                    displayName: 'Super Administrator',
                    role: 'SUPER_ADMIN',
                    factoryId: createdFactories[0].id, // MAAZ factory
                    isActive: true,
                    createdDate: new Date().toISOString()
                });
                addProgress('✓ Created super admin (username: admin, password: admin123)');
            } else {
                addProgress(`✓ Found ${usersSnapshot.size} existing users`);
            }

            setMessage('System initialized successfully!');
            setStatus('success');
            
            setTimeout(() => {
                onComplete();
            }, 2000);

        } catch (error) {
            console.error('Initialization error:', error);
            setMessage(error instanceof Error ? error.message : 'Initialization failed');
            setStatus('error');
            addProgress('✗ Error occurred');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
                    <div className="flex items-center justify-center mb-4">
                        <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                            <Building2 size={48} />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-center">System Initialization</h1>
                    <p className="text-center text-indigo-100 mt-2">Multi-Factory ERP Setup</p>
                </div>

                {/* Content */}
                <div className="p-8">
                    {status === 'idle' && (
                        <div className="text-center space-y-6">
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded text-left">
                                <h3 className="font-bold text-blue-900 mb-3">This wizard will initialize:</h3>
                                <ul className="space-y-2 text-sm text-blue-800">
                                    <li className="flex items-center gap-2">
                                        <Building2 size={16} className="text-blue-600" />
                                        <span><strong>3 Factories:</strong> MAAZ, TALHA, AL ANWAR</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <User size={16} className="text-blue-600" />
                                        <span><strong>1 Super Admin:</strong> Full system access</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded text-left">
                                <p className="text-sm text-amber-800">
                                    <strong>⚠️ Note:</strong> Default admin credentials will be:
                                    <br />
                                    <span className="font-mono">Username: admin</span>
                                    <br />
                                    <span className="font-mono">Password: admin123</span>
                                    <br />
                                    <span className="text-red-600 font-semibold">Change this password immediately after first login!</span>
                                </p>
                            </div>

                            <button
                                onClick={initializeSystem}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg font-bold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg"
                            >
                                Initialize System
                            </button>
                        </div>
                    )}

                    {status === 'running' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-center gap-3 mb-6">
                                <Loader2 className="animate-spin text-indigo-600" size={32} />
                                <span className="text-lg font-semibold text-gray-800">Initializing...</span>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                                {progress.map((msg, idx) => (
                                    <div key={idx} className="text-sm text-gray-700 mb-1 font-mono">
                                        {msg}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="text-center space-y-4">
                            <div className="flex items-center justify-center mb-4">
                                <div className="bg-green-100 p-4 rounded-full">
                                    <CheckCircle className="text-green-600" size={48} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-green-800">Setup Complete!</h3>
                            <p className="text-gray-600">{message}</p>
                            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto text-left">
                                {progress.map((msg, idx) => (
                                    <div key={idx} className="text-sm text-gray-700 mb-1 font-mono">
                                        {msg}
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm text-gray-500 mt-4">Redirecting to login...</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="text-center space-y-4">
                            <div className="flex items-center justify-center mb-4">
                                <div className="bg-red-100 p-4 rounded-full">
                                    <AlertCircle className="text-red-600" size={48} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-red-800">Setup Failed</h3>
                            <p className="text-gray-600">{message}</p>
                            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto text-left">
                                {progress.map((msg, idx) => (
                                    <div key={idx} className="text-sm text-gray-700 mb-1 font-mono">
                                        {msg}
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Retry
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
