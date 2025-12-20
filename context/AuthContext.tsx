import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Factory, UserRole, PermissionModule } from '../types';
import { collection, getDocs, doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';

interface AuthContextType {
    currentUser: User | null;
    currentFactory: Factory | null;
    factories: Factory[];
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
    logout: () => void;
    switchFactory: (factoryId: string) => Promise<void>;
    hasPermission: (module: PermissionModule, action: 'view' | 'create' | 'edit' | 'delete') => boolean;
    refreshFactories: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [currentFactory, setCurrentFactory] = useState<Factory | null>(null);
    const [factories, setFactories] = useState<Factory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load factories on mount
    useEffect(() => {
        const initializeAuth = async () => {
            await loadFactories();
            await loadSessionUser();
        };
        initializeAuth();
    }, []);

    // Real-time listener for current user's data changes (permissions updates)
    useEffect(() => {
        if (!currentUser) return;

        // Set up real-time listener for user document
        const unsubscribe = onSnapshot(
            doc(db, 'users', currentUser.id),
            (userDoc) => {
                if (userDoc.exists()) {
                    const freshUser = { id: userDoc.id, ...userDoc.data() } as User;
                    
                    // Only update if user is still active
                    if (freshUser.isActive) {
                        setCurrentUser(freshUser);
                        localStorage.setItem('currentUser', JSON.stringify(freshUser));
                        
                        // Also refresh factory if it changed
                        if (freshUser.factoryId !== currentUser.factoryId) {
                            getDoc(doc(db, 'factories', freshUser.factoryId)).then(factoryDoc => {
                                if (factoryDoc.exists()) {
                                    const freshFactory = { id: factoryDoc.id, ...factoryDoc.data() } as Factory;
                                    setCurrentFactory(freshFactory);
                                    localStorage.setItem('currentFactory', JSON.stringify(freshFactory));
                                }
                            });
                        }
                    } else {
                        // User is inactive, logout
                        setCurrentUser(null);
                        setCurrentFactory(null);
                        localStorage.removeItem('currentUser');
                        localStorage.removeItem('currentFactory');
                    }
                } else {
                    // User no longer exists, logout
                    setCurrentUser(null);
                    setCurrentFactory(null);
                    localStorage.removeItem('currentUser');
                    localStorage.removeItem('currentFactory');
                }
            },
            (error) => {
                console.error('Error listening to user updates:', error);
            }
        );

        return () => unsubscribe();
    }, [currentUser?.id]);

    const loadFactories = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'factories'));
            const factoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Factory));
            setFactories(factoriesData.filter(f => f.isActive));
            
            // Safety: If no factories exist, clear localStorage to trigger initial setup
            if (factoriesData.length === 0) {
                console.log('No factories found - clearing session');
                localStorage.clear();
                setCurrentUser(null);
                setCurrentFactory(null);
            }
        } catch (error) {
            console.error('Failed to load factories:', error);
        }
    };

    const refreshFactories = async () => {
        await loadFactories();
    };

    const loadSessionUser = async () => {
        try {
            const savedUser = localStorage.getItem('currentUser');
            const savedFactory = localStorage.getItem('currentFactory');
            
            if (savedUser && savedFactory) {
                const cachedUser = JSON.parse(savedUser);
                const cachedFactory = JSON.parse(savedFactory);
                
                // Fetch fresh user data from Firebase (not cached data)
                const userDoc = await getDoc(doc(db, 'users', cachedUser.id));
                const factoryDoc = await getDoc(doc(db, 'factories', cachedFactory.id));
                
                if (userDoc.exists() && factoryDoc.exists()) {
                    // Use fresh data from Firebase, not cached data
                    const freshUser = { id: userDoc.id, ...userDoc.data() } as User;
                    const freshFactory = { id: factoryDoc.id, ...factoryDoc.data() } as Factory;
                    
                    // Only set if user is still active
                    if (freshUser.isActive) {
                        setCurrentUser(freshUser);
                        setCurrentFactory(freshFactory);
                        // Update localStorage with fresh data
                        localStorage.setItem('currentUser', JSON.stringify(freshUser));
                        localStorage.setItem('currentFactory', JSON.stringify(freshFactory));
                    } else {
                        // User is inactive, clear session
                        console.log('User is inactive - clearing session');
                        localStorage.clear();
                        setCurrentUser(null);
                        setCurrentFactory(null);
                    }
                } else {
                    // Session data is stale, clear it
                    console.log('Session data invalid - clearing');
                    localStorage.clear();
                    setCurrentUser(null);
                    setCurrentFactory(null);
                }
            }
        } catch (error) {
            console.error('Failed to load session:', error);
            localStorage.clear();
            setCurrentUser(null);
            setCurrentFactory(null);
        } finally {
            setIsLoading(false);
        }
    };

    const refreshUser = async () => {
        if (!currentUser) return;
        
        try {
            // Fetch fresh user data from Firebase
            const userDoc = await getDoc(doc(db, 'users', currentUser.id));
            if (userDoc.exists()) {
                const freshUser = { id: userDoc.id, ...userDoc.data() } as User;
                
                // Only update if user is still active
                if (freshUser.isActive) {
                    setCurrentUser(freshUser);
                    localStorage.setItem('currentUser', JSON.stringify(freshUser));
                    
                    // Also refresh factory if it changed
                    if (freshUser.factoryId !== currentUser.factoryId) {
                        const factoryDoc = await getDoc(doc(db, 'factories', freshUser.factoryId));
                        if (factoryDoc.exists()) {
                            const freshFactory = { id: factoryDoc.id, ...factoryDoc.data() } as Factory;
                            setCurrentFactory(freshFactory);
                            localStorage.setItem('currentFactory', JSON.stringify(freshFactory));
                        }
                    }
                } else {
                    // User is inactive, logout
                    logout();
                }
            } else {
                // User no longer exists, logout
                logout();
            }
        } catch (error) {
            console.error('Failed to refresh user:', error);
        }
    };

    const login = async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
        try {
            // Query users collection
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
            
            const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.isActive);
            
            if (!user) {
                return { success: false, message: 'Invalid username or password' };
            }

            // Simple password check (in production, use proper hashing)
            if (user.password !== password) {
                return { success: false, message: 'Invalid username or password' };
            }

            // Get user's factory
            const factoryDoc = await getDoc(doc(db, 'factories', user.factoryId));
            if (!factoryDoc.exists()) {
                return { success: false, message: 'Factory not found' };
            }

            const factory = { id: factoryDoc.id, ...factoryDoc.data() } as Factory;

            // Update last login
            await updateDoc(doc(db, 'users', user.id), {
                lastLogin: new Date().toISOString()
            });

            // Save to state and localStorage
            setCurrentUser(user);
            setCurrentFactory(factory);
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.setItem('currentFactory', JSON.stringify(factory));

            return { success: true, message: 'Login successful' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Login failed. Please try again.' };
        }
    };

    const logout = () => {
        setCurrentUser(null);
        setCurrentFactory(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentFactory');
    };

    const switchFactory = async (factoryId: string) => {
        if (!currentUser) return;
        
        // Only Super Admin can switch factories
        if (currentUser.role !== UserRole.SUPER_ADMIN) {
            return;
        }

        const factory = factories.find(f => f.id === factoryId);
        if (factory) {
            setCurrentFactory(factory);
            localStorage.setItem('currentFactory', JSON.stringify(factory));
        }
    };

    const hasPermission = (module: PermissionModule, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
        if (!currentUser) return false;

        // Super Admin has ALL permissions
        if (currentUser.role === UserRole.SUPER_ADMIN) {
            return true;
        }

        // Factory Admin has all permissions EXCEPT managing factories/users
        if (currentUser.role === UserRole.FACTORY_ADMIN) {
            // Cannot access Factory/User management
            if (module === PermissionModule.ADMIN && action !== 'view') {
                // Can view admin module, but specific routes will be restricted
                return true;
            }
            return true;
        }

        // Module User - only allowed modules
        if (currentUser.role === UserRole.MODULE_USER) {
            if (!currentUser.allowedModules || !currentUser.allowedModules.includes(module)) {
                return false;
            }
            // Module users can view and create, but NOT delete
            if (action === 'delete') return false;
            // Can edit their own entries
            return action === 'view' || action === 'create' || action === 'edit';
        }

        // Data Entry (Inventory) - only inventory modules
        if (currentUser.role === UserRole.DATA_ENTRY_INVENTORY) {
            const allowedModules = [
                PermissionModule.DASHBOARD,
                PermissionModule.SALES,
                PermissionModule.PURCHASES,
                PermissionModule.PRODUCTION,
                PermissionModule.LOGISTICS,
                PermissionModule.OFFLOADING,
                PermissionModule.DATA_ENTRY
            ];
            if (action === 'delete') return false;
            return allowedModules.includes(module);
        }

        // Data Entry (Accounting) - only accounting modules
        if (currentUser.role === UserRole.DATA_ENTRY_ACCOUNTING) {
            const allowedModules = [
                PermissionModule.DASHBOARD,
                PermissionModule.ACCOUNTING,
                PermissionModule.DATA_ENTRY,
                PermissionModule.POSTING,
                PermissionModule.REPORTS
            ];
            if (action === 'delete') return false;
            return allowedModules.includes(module);
        }

        return false;
    };

    return (
        <AuthContext.Provider
            value={{
                currentUser,
                currentFactory,
                factories,
                isAuthenticated: !!currentUser,
                isLoading,
                login,
                logout,
                switchFactory,
                hasPermission,
                refreshFactories,
                refreshUser
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
