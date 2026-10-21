/**
 * App-wide dispatcher for the Firestore snapshot streams owned by
 * firebaseService. Firestore handles normal network reconnection itself;
 * this manager only restarts a stream if Firestore reports a terminal error.
 */

import { firebaseService } from './firebaseService';
import type { SyncStatus } from './firebaseService';
import { storageService } from './storageService';
import type { AppState } from './storageService';

export interface SyncEventDetail {
  state: AppState;
  source: 'remote_firestore' | 'local_broadcast';
  timestamp: number;
}

export const SYNC_INTERVAL_MS = 5_000;

export class FirebaseSyncManager {
  private static instance: FirebaseSyncManager;
  private unsubscribeFirestore: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private isListening = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private periodicSyncTimer: ReturnType<typeof setInterval> | null = null;
  private isResyncing = false;
  private reconnectDelayMs = 1000;
  private generation = 0;
  private stateCallback: ((state: AppState) => void) | null = null;

  private constructor() {
    this.setupNetworkWatchers();
  }

  public static getInstance(): FirebaseSyncManager {
    if (!FirebaseSyncManager.instance) {
      FirebaseSyncManager.instance = new FirebaseSyncManager();
    }
    return FirebaseSyncManager.instance;
  }

  private setupNetworkWatchers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', this.handleNetworkOnline);
    window.addEventListener('offline', this.handleNetworkOffline);
  }

  private handleNetworkOnline = () => {
    // Active Firestore listeners reconnect automatically. Restart only after
    // a terminal listener error has already closed the stream.
    if (this.isListening && !this.unsubscribeFirestore) {
      this.clearReconnectTimer();
      this.startFirestoreListener(this.generation);
    }
  };

  private handleNetworkOffline = () => {
    // Firestore's persistent local cache keeps reads available and queues
    // writes while offline; retain the listener for automatic resumption.
  };

  public startListening(onStateUpdate: (state: AppState) => void): () => void {
    this.stopListening();
    this.isListening = true;
    this.stateCallback = onStateUpdate;
    const generation = ++this.generation;

    this.unsubscribeStatus = firebaseService.onSyncStatusChange((status) => {
      this.dispatchStatus(status);
    });
    this.startFirestoreListener(generation);
    this.startPeriodicSync(generation);

    return () => {
      if (generation === this.generation) this.stopListening();
    };
  }

  private startFirestoreListener(generation: number) {
    if (!this.isListening || generation !== this.generation || this.unsubscribeFirestore) return;

    try {
      let unsubscribe: (() => void) | null = null;
      let erroredBeforeAssignment = false;
      unsubscribe = firebaseService.subscribeToRemoteState(
        (remoteState, source = 'remote_firestore') => {
          if (!this.isListening || generation !== this.generation) return;
          const filtered = storageService.filterOutDeleted(remoteState);
          this.dispatchState(filtered, source);
        },
        () => {
          this.reconnectDelayMs = 1000;
          this.clearReconnectTimer();
        },
        (error) => {
          if (!this.isListening || generation !== this.generation) return;
          console.error('[FirebaseSync] Firestore stream closed:', error);
          this.unsubscribeFirestore = null;
          if (!unsubscribe) erroredBeforeAssignment = true;
          this.scheduleReconnect(generation);
        }
      );
      if (erroredBeforeAssignment) {
        unsubscribe?.();
      } else {
        this.unsubscribeFirestore = unsubscribe;
      }
    } catch (error) {
      console.error('[FirebaseSync] Could not start Firestore stream:', error);
      this.scheduleReconnect(generation);
    }
  }

  private dispatchState(state: AppState, source: SyncEventDetail['source']) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<SyncEventDetail>('alsari:state-sync', {
        detail: { state, source, timestamp: Date.now() }
      }));
    }
    this.stateCallback?.(state);
  }

  private dispatchStatus(status: SyncStatus) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<SyncStatus>('alsari:sync-status', { detail: status }));
    }
  }

  private startPeriodicSync(generation: number) {
    this.clearPeriodicSyncTimer();
    this.periodicSyncTimer = setInterval(() => {
      if (!this.isListening || generation !== this.generation || this.isResyncing) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      this.isResyncing = true;
      void this.reconcile(generation)
        .catch((error) => console.warn('[FirebaseSync] Periodic reconciliation failed:', error))
        .finally(() => {
          if (generation === this.generation) this.isResyncing = false;
        });
    }, SYNC_INTERVAL_MS);
  }

  private clearPeriodicSyncTimer() {
    if (!this.periodicSyncTimer) return;
    clearInterval(this.periodicSyncTimer);
    this.periodicSyncTimer = null;
  }

  private scheduleReconnect(generation: number) {
    if (!this.isListening || generation !== this.generation || this.reconnectTimer) return;
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 30000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.startFirestoreListener(generation);
    }, delay);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  public stopListening() {
    this.isListening = false;
    this.generation += 1;
    this.stateCallback = null;
    this.clearReconnectTimer();
    this.clearPeriodicSyncTimer();
    this.isResyncing = false;
    this.unsubscribeFirestore?.();
    this.unsubscribeFirestore = null;
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = null;
  }

  public async resync(): Promise<AppState | null> {
    return this.reconcile(this.generation);
  }

  private async reconcile(generation: number): Promise<AppState | null> {
    const remote = await (firebaseService as any).fetchFreshRemoteState?.() || await firebaseService.fetchRemoteState({ includeEmpty: true });
    if (!remote || !this.isListening || generation !== this.generation) return null;
    console.log('[FirebaseSync] Reconciliation fetched remote state:', remote);
    const filtered = storageService.filterOutDeleted(remote);
    storageService.saveState(filtered);
    this.dispatchState(filtered, 'remote_firestore');
    return filtered;
  }
}

export const syncManager = FirebaseSyncManager.getInstance();
