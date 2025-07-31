// hooks/useEnhancedCrud.ts
import { useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { BaseRepository, BaseEntity } from '@/lib/localDb/baseRepository';
import { syncManager } from '@/lib/localDb/syncManager';
import { initDb } from '@/lib/localDb/index';

export interface EnhancedCrudConfig<T extends BaseEntity> {
  repository: BaseRepository<T>;
  displayName: string;
}

export function useEnhancedCrud<T extends BaseEntity>(config: EnhancedCrudConfig<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [filteredItems, setFilteredItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState({
    isConnected: false,
    isSyncing: false,
    pendingCount: 0,
    lastSync: null as Date | null
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await config.repository.getAll();
      setItems(data);
      setFilteredItems(data);
    } catch (error: any) {
      console.error(`Failed to fetch ${config.displayName}:`, error);
      Alert.alert('خطأ', `فشل في جلب البيانات: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [config.repository, config.displayName]);

  const updateSyncStatus = useCallback(async () => {
    try {
      const pendingCount = await syncManager.getPendingSyncCount();
      setSyncStatus(prev => ({
        ...prev,
        isConnected: syncManager.isConnected,
        isSyncing: syncManager.isSyncing,
        pendingCount
      }));
    } catch (error) {
      console.error('Failed to update sync status:', error);
    }
  }, []);

  const performSync = useCallback(async () => {
    if (!syncManager.isConnected) {
      Alert.alert('غير متصل', 'يرجى التحقق من اتصال الإنترنت');
      return;
    }

    try {
      setSyncStatus(prev => ({ ...prev, isSyncing: true }));
      const result = await syncManager.syncAll();
      
      if (result.success) {
        setSyncStatus(prev => ({ ...prev, lastSync: new Date() }));
        await fetchData(); // Refresh data after sync
        if (result.synced > 0) {
          Alert.alert('نجح', `تم مزامنة ${result.synced} عنصر بنجاح`);
        }
      } else {
        Alert.alert('خطأ في المزامنة', result.errors.join('\n'));
      }
    } catch (error: any) {
      Alert.alert('خطأ', `فشل في المزامنة: ${error.message}`);
    } finally {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
      await updateSyncStatus();
    }
  }, [fetchData, updateSyncStatus]);

  // Initialize and setup
  useEffect(() => {
    const initialize = async () => {
      try {
        await initDb();
        await fetchData();
        await updateSyncStatus();
        
        // Auto-sync if connected
        if (syncManager.isConnected) {
          performSync();
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    initialize();

    // Update sync status periodically
    const interval = setInterval(updateSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchData, updateSyncStatus, performSync]);

  // Filter items based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredItems(items);
    } else {
      setFilteredItems(
        items.filter(item =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, items]);

  const createItem = async (data: Partial<T>) => {
    try {
      await config.repository.insert(data);
      await fetchData();
      await updateSyncStatus();
      
      // Auto-sync if connected
      if (syncManager.isConnected) {
        setTimeout(performSync, 1000);
      }
    } catch (error: any) {
      Alert.alert('خطأ', error.message);
      throw error;
    }
  };

  const updateItem = async (id: number, data: Partial<T>) => {
    try {
      await config.repository.update(id, data);
      await fetchData();
      await updateSyncStatus();
      
      // Auto-sync if connected
      if (syncManager.isConnected) {
        setTimeout(performSync, 1000);
      }
    } catch (error: any) {
      Alert.alert('خطأ', error.message);
      throw error;
    }
  };

  const deleteItem = async (id: number) => {
    Alert.alert(
      'تأكيد الحذف',
      `هل تريد حذف هذا ${config.displayName}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              await config.repository.delete(id);
              await fetchData();
              await updateSyncStatus();
              
              // Auto-sync if connected
              if (syncManager.isConnected) {
                setTimeout(performSync, 1000);
              }
            } catch (error: any) {
              Alert.alert('خطأ', error.message);
            }
          }
        }
      ]
    );
  };

  const refresh = async () => {
    await fetchData();
    await updateSyncStatus();
  };

  return {
    items,
    filteredItems,
    loading,
    searchQuery,
    setSearchQuery,
    syncStatus,
    createItem,
    updateItem,
    deleteItem,
    refresh,
    sync: performSync
  };
}