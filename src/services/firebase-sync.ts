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

export class FirebaseSyncManager {
  private static instance: FirebaseSyncManager;
  private unsubscribeFirestore: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private isListening = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelayMs = 1000;
  private generation = 0;
  private stateCallback: ((state: AppState) => void) | null = null;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

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
    if (this.isListening && !firebaseService.isQuotaExceeded()) {
      this.clearReconnectTimer();
      this.startFirestoreListener(this.generation);
    }
  };

  private handleNetworkOffline = () => {
    this.dispatchStatus('offline');
  };

  public startListening(onStateUpdate: (state: AppState) => void): () => void {
    this.stopListening();
    this.isListening = true;
    this.stateCallback = onStateUpdate;
    const generation = ++this.generation;

    if (!navigator.onLine || firebaseService.isQuotaExceeded()) {
      this.dispatchStatus('offline');
    }

    this.unsubscribeStatus = firebaseService.onSyncStatusChange((status) => {
      this.dispatchStatus(status);
    });

    this.startFirestoreListener(generation);

    return () => {
      if (generation === this.generation) this.stopListening();
    };
  }

  private async startFirestoreListener(generation: number) {
    if (!this.isListening || generation !== this.generation || this.unsubscribeFirestore) return;

    if (firebaseService.isQuotaExceeded()) {
      this.dispatchStatus('offline');
      return;
    }

    // Robust connectivity check
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      console.warn('[FirebaseSync] Offline: sync paused. Waiting for connection...');
      this.dispatchStatus('offline');
      return;
    }

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
          this.unsubscribeFirestore = null;
          if (!unsubscribe) erroredBeforeAssignment = true;

          const errMessage = error instanceof Error ? error.message : String(error);
          const isPermissionDenied =
            errMessage.includes('Missing or insufficient permissions') ||
            errMessage.includes('permission-denied') ||
            errMessage.includes('insufficient permissions');
          const isQuotaExceeded =
            firebaseService.isQuotaExceeded() ||
            errMessage.includes('resource-exhausted') ||
            errMessage.toLowerCase().includes('quota exceeded');

          if (isPermissionDenied || isQuotaExceeded) {
            console.warn(
              isQuotaExceeded
                ? '[FirebaseSync] Firestore quota exceeded: operating with local persistent storage.'
                : '[FirebaseSync] Firestore permission restriction: operating with local persistent storage.'
            );
            this.clearReconnectTimer();
            this.dispatchStatus('offline');
            return;
          }

          console.warn('[FirebaseSync] Firestore stream closed:', errMessage);
          this.scheduleReconnect(generation);
        }
      );
      if (erroredBeforeAssignment) {
        unsubscribe?.();
      } else {
        this.unsubscribeFirestore = unsubscribe;
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      const isPermissionDenied =
        errMessage.includes('Missing or insufficient permissions') ||
        errMessage.includes('permission-denied') ||
        errMessage.includes('insufficient permissions');
      const isQuotaExceeded =
        firebaseService.isQuotaExceeded() ||
        errMessage.includes('resource-exhausted') ||
        errMessage.toLowerCase().includes('quota exceeded');
      if (isPermissionDenied || isQuotaExceeded) {
        this.clearReconnectTimer();
        this.dispatchStatus('offline');
        return;
      }
      console.warn('[FirebaseSync] Could not start Firestore stream:', error);
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

  private scheduleReconnect(generation: number) {
    if (!this.isListening || generation !== this.generation || this.reconnectTimer || firebaseService.isQuotaExceeded()) return;
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
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.unsubscribeFirestore?.();
    this.unsubscribeFirestore = null;
    this.unsubscribeStatus?.();
    this.unsubscribeStatus = null;
  }

  public async resync(): Promise<AppState | null> {
    if (firebaseService.isQuotaExceeded()) return null;
    return this.reconcile(this.generation);
  }

  private async reconcile(generation: number): Promise<AppState | null> {
    if (firebaseService.isQuotaExceeded()) return null;
    const remote = await firebaseService.fetchFreshRemoteState() || await firebaseService.fetchRemoteState({ includeEmpty: true });
    if (!remote || !this.isListening || generation !== this.generation) return null;
    const filtered = storageService.filterOutDeleted(remote);
    storageService.saveState(filtered);
    this.dispatchState(filtered, 'remote_firestore');
    return filtered;
  }
}

export const syncManager = FirebaseSyncManager.getInstance();
