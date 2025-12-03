import { useAuth } from '../context/AuthContext';

/**
 * Hook to automatically add factoryId to data
 * Usage: const { addFactoryId } = useFactoryData();
 * const newPartner = addFactoryId({ name: 'ABC Corp', ... });
 */
export const useFactoryData = () => {
    const { currentFactory } = useAuth();

    const addFactoryId = <T extends Record<string, any>>(data: T): T & { factoryId: string } => {
        if (!currentFactory) {
            throw new Error('No factory selected');
        }
        return {
            ...data,
            factoryId: currentFactory.id
        };
    };

    const getFactoryId = (): string => {
        if (!currentFactory) {
            throw new Error('No factory selected');
        }
        return currentFactory.id;
    };

    return {
        addFactoryId,
        getFactoryId,
        currentFactoryId: currentFactory?.id || null
    };
};
