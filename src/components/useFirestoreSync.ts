/**
 * useFirestoreSync.ts - Custom React Hook for Real-Time Cloud Synchronization
 * Manages Firebase sync status, real-time snapshot streams, force-refresh triggers,
 * and automatic memory leak cleanup on component unmount.
 */

import { useState, useEffect, useCallback } from 'react';
import { firebaseService, SyncStatus } from '../services/firebaseService';
import { syncManager } from '../services/firebase-sync';
import type { AppState } from '../services/storageService';

export interface UseFirestoreSyncOptions {
  onStateSynced?: (state: AppState) => void;
}

export function useFirestoreSync(options?: UseFirestoreSyncOptions) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(firebaseService.getSyncStatus());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number>(Date.now());

  useEffect(() => {
    const unsubscribeStatus = firebaseService.onSyncStatusChange((status) => {
      setSyncStatus(status);
    });

    const unsubscribeStream = syncManager.startListening((state) => {
      setLastSyncedAt(Date.now());
      options?.onStateSynced?.(state);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeStream();
    };
  }, [options]);

  const forceSync = useCallback(async (): Promise<AppState | null> => {
    setIsRefreshing(true);
    try {
      const freshState = await syncManager.resync();
      if (freshState) {
        setLastSyncedAt(Date.now());
        options?.onStateSynced?.(freshState);
      }
      return freshState;
    } catch (error) {
      console.error('[useFirestoreSync] Force sync failed:', error);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [options]);

  return {
    syncStatus,
    isRefreshing,
    lastSyncedAt,
    forceSync
  };
}
