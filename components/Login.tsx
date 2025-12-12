import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, User, Lock, AlertCircle, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Please enter both username and password');
            return;
        }

        setLoading(true);
        const result = await login(username, password);
        setLoading(false);

        if (!result.success) {
            setError(result.message);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
                    <div className="flex items-center justify-center mb-4">
                        <img 
                            src="/logo.jpg" 
                            alt="Usman Global Logo" 
                            className="h-20 w-20 object-contain rounded-lg bg-white/10 p-2"
                            onError={(e) => {
                                // Fallback if image doesn't load - show icon instead
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('.fallback-icon')) {
                                    const icon = document.createElement('div');
                                    icon.className = 'fallback-icon bg-white/20 p-4 rounded-full backdrop-blur-sm';
                                    icon.innerHTML = '<svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>';
                                    parent.appendChild(icon);
                                }
                            }}
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-center">Usman Global</h1>
                    <p className="text-center text-indigo-100 mt-2">Inventory & ERP System</p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="text-red-600" size={20} />
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Username
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="text-gray-400" size={20} />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                placeholder="Enter your username"
                                disabled={loading}
                                autoComplete="username"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="text-gray-400" size={20} />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                placeholder="Enter your password"
                                disabled={loading}
                                autoComplete="current-password"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-bold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                Logging in...
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                Sign In
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                        Multi-Factory ERP System • Version 2.0
                    </p>
                </div>
            </div>
        </div>
    );
};
