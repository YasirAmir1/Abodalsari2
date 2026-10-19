import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppState, storageService } from './storageService';

// Initialize Firebase App safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with in-memory cache to prevent old pending writes from persisting and retrying
export const db = (() => {
  try {
    return initializeFirestore(app, { localCache: memoryLocalCache() }, firebaseConfig.firestoreDatabaseId || '(default)');
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
  }
})();

export const STATE_DOC_REF = doc(db, 'app_state', 'global_state');

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

// Multi-Tab & Cross-Session Instant Sync Channel
const broadcastChannel: BroadcastChannel | null = (() => {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      return new BroadcastChannel('alsari_realtime_sync_v1');
    }
  } catch {}
  return null;
})();

let lastSavedPayload = '';
let currentSyncStatus: SyncStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'connected';
const statusListeners = new Set<(status: SyncStatus) => void>();

function updateSyncStatus(newStatus: SyncStatus) {
  if (currentSyncStatus !== newStatus) {
    currentSyncStatus = newStatus;
    statusListeners.forEach((listener) => {
      try { listener(newStatus); } catch {}
    });
  }
}

// Window online/offline event handlers for automatic reconnection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateSyncStatus('connected');
  });
  window.addEventListener('offline', () => {
    updateSyncStatus('offline');
  });
}

export const firebaseService = {
  isQuotaExceeded(): boolean {
    return false;
  },

  getSyncStatus(): SyncStatus {
    return currentSyncStatus;
  },

  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
    statusListeners.add(callback);
    callback(currentSyncStatus);
    return () => {
      statusListeners.delete(callback);
    };
  },

  broadcastLocalChange(state: AppState) {
    try {
      if (broadcastChannel) {
        broadcastChannel.postMessage({
          type: 'APP_STATE_UPDATED',
          payload: state,
          timestamp: Date.now()
        });
      }
    } catch {}
  },

  subscribeToLocalBroadcast(callback: (state: AppState) => void): () => void {
    if (!broadcastChannel) return () => {};
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'APP_STATE_UPDATED' && event.data.payload) {
        callback(event.data.payload as AppState);
      }
    };
    broadcastChannel.addEventListener('message', handler);
    return () => {
      broadcastChannel.removeEventListener('message', handler);
    };
  },

  async fetchRemoteState(): Promise<AppState | null> {
    try {
      updateSyncStatus('syncing');
      const snap = await getDoc(STATE_DOC_REF);
      updateSyncStatus('connected');
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.payload) {
          lastSavedPayload = data.payload;
          return JSON.parse(data.payload) as AppState;
        }
      }
    } catch (e: any) {
      console.warn('Error fetching remote state:', e);
      updateSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
    }
    return null;
  },

  async saveRemoteState(state: AppState, immediate = false): Promise<void> {
    // Notify all local tabs/sessions immediately (< 50ms)
    this.broadcastLocalChange(state);

    try {
      const payload = JSON.stringify(state);
      if (payload === lastSavedPayload) {
        return;
      }

      updateSyncStatus('syncing');
      lastSavedPayload = payload;
      await setDoc(STATE_DOC_REF, {
        payload,
        updatedAt: new Date().toISOString(),
        lastUpdatedTimestamp: state.lastUpdatedTimestamp || Date.now()
      }, { merge: true });
      updateSyncStatus('connected');
    } catch (e: any) {
      console.warn('Error saving state to Firestore:', e);
      updateSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
    }
  },

  subscribeToRemoteState(callback: (state: AppState) => void): () => void {
    try {
      const unsubscribeFirestore = onSnapshot(
        STATE_DOC_REF,
        { includeMetadataChanges: false },
        (snap) => {
          updateSyncStatus('connected');
          if (snap.metadata.hasPendingWrites) {
            return;
          }
          if (snap.exists()) {
            const data = snap.data();
            if (data && data.payload) {
              if (data.payload === lastSavedPayload) {
                return;
              }
              try {
                const parsed = JSON.parse(data.payload) as AppState;
                lastSavedPayload = data.payload;
                callback(parsed);
              } catch (parseErr) {
                console.error('Failed to parse remote payload', parseErr);
              }
            }
          }
        },
        (error) => {
          console.warn('Firestore snapshot error:', error);
          updateSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
        }
      );

      // Also listen to local broadcast for instantaneous multi-tab sync
      const unsubscribeBroadcast = this.subscribeToLocalBroadcast(callback);

      return () => {
        unsubscribeFirestore();
        unsubscribeBroadcast();
      };
    } catch {
      return this.subscribeToLocalBroadcast(callback);
    }
  }
};

