import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Factory, UserRole, PermissionModule } from '../types';
import { collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
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
                const user = JSON.parse(savedUser);
                const factory = JSON.parse(savedFactory);
                
                // Validate that the user and factory still exist in Firebase
                const userDoc = await getDoc(doc(db, 'users', user.id));
                const factoryDoc = await getDoc(doc(db, 'factories', factory.id));
                
                if (userDoc.exists() && factoryDoc.exists()) {
                    setCurrentUser(user);
                    setCurrentFactory(factory);
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
                refreshFactories
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
