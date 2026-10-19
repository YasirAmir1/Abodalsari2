import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  enableNetwork,
  disableNetwork
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppState } from './storageService';

// ─── Firebase Initialization ────────────────────────────────────────────────
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Use memory cache to prevent stale pending-write replays on reload
const db = (() => {
  try {
    return initializeFirestore(
      app,
      { localCache: memoryLocalCache() },
      firebaseConfig.firestoreDatabaseId || '(default)'
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
  }
})();

// Single global Firestore document that holds the entire app state as a JSON payload
const STATE_DOC_REF = doc(db, 'app_state', 'global_state');

// ─── Quota Guard ─────────────────────────────────────────────────────────────
// NOTE: We no longer mark quota exceeded unconditionally on startup.
// Quota is only marked when Firestore itself returns a resource-exhausted error.
const QUOTA_STORAGE_KEY = 'alsari_fs_quota_exceeded_day_v2';

function getTodayStr(): string {
  try {
    return new Date().toISOString().split('T')[0];
  } catch {
    return '1970-01-01';
  }
}

export function markDailyQuotaExceeded() {
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, getTodayStr());
  } catch {}
}

export function clearDailyQuota() {
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {}
}

function isDailyQuotaExceeded(): boolean {
  try {
    const val = localStorage.getItem(QUOTA_STORAGE_KEY);
    return val === getTodayStr();
  } catch {}
  return false;
}

// ─── Write Deduplication ─────────────────────────────────────────────────────
// Tracks the last payload WE wrote so the snapshot listener ignores our own echoes
let lastWrittenPayload = '';

// ─── Reconnect support ───────────────────────────────────────────────────────
let networkEnabled = true;

async function ensureNetworkEnabled() {
  if (!networkEnabled) {
    try {
      await enableNetwork(db);
      networkEnabled = true;
    } catch {}
  }
}

// ─── Connection state helpers ────────────────────────────────────────────────
let activeUnsubscribe: (() => void) | null = null;

export const firebaseService = {
  isQuotaExceeded(): boolean {
    return isDailyQuotaExceeded();
  },

  /** One-shot fetch of the remote state (used for manual refresh) */
  async fetchRemoteState(): Promise<AppState | null> {
    if (isDailyQuotaExceeded()) return null;
    try {
      await ensureNetworkEnabled();
      const snap = await getDoc(STATE_DOC_REF);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.payload) {
          // Do NOT update lastWrittenPayload here.
          // lastWrittenPayload must only reflect payloads WE wrote via setDoc.
          // If we set it here, the onSnapshot listener would forever ignore
          // any future remote state that happens to equal this fetched snapshot.
          return JSON.parse(data.payload) as AppState;
        }
      }
    } catch (e: any) {
      if (isQuotaError(e)) markDailyQuotaExceeded();
      else console.warn('[Firebase] fetchRemoteState error:', e?.message);
    }
    return null;
  },

  /**
   * Persist the full app state to Firestore.
   * Skips write if quota exceeded or payload unchanged (no-op guard).
   */
  async saveRemoteState(state: AppState): Promise<void> {
    if (isDailyQuotaExceeded()) return;
    try {
      await ensureNetworkEnabled();
      const payload = JSON.stringify(state);
      if (payload === lastWrittenPayload) return; // identical — skip

      lastWrittenPayload = payload;
      await setDoc(
        STATE_DOC_REF,
        { payload, updatedAt: new Date().toISOString() },
        { merge: true }
      );
    } catch (e: any) {
      if (isQuotaError(e)) {
        markDailyQuotaExceeded();
      } else {
        // Reset so next attempt is not skipped
        lastWrittenPayload = '';
        console.warn('[Firebase] saveRemoteState error:', e?.message);
      }
    }
  },

  /**
   * Real-time listener.
   * - Fires immediately with server state on subscribe.
   * - Fires again whenever another device writes a new state.
   * - Ignores echoes of our own writes (via lastWrittenPayload).
   * - Handles reconnections: onSnapshot re-establishes itself automatically.
   *
   * @param callback Called with the parsed AppState whenever a remote change arrives.
   * @returns Unsubscribe function — call it on component unmount.
   */
  subscribeToRemoteState(callback: (state: AppState) => void): () => void {
    // Clean up any previous listener
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }

    if (isDailyQuotaExceeded()) return () => {};

    try {
      const unsubscribe = onSnapshot(
        STATE_DOC_REF,
        // includeMetadataChanges: false → only fire on confirmed server commits
        { includeMetadataChanges: false },
        (snap) => {
          // Skip writes that are still pending (locally optimistic)
          if (snap.metadata.hasPendingWrites) return;

          if (!snap.exists()) return;

          const data = snap.data();
          if (!data || !data.payload) return;

          const incomingPayload: string = data.payload;

          // If this payload is exactly what WE just wrote, ignore it —
          // it's our own write echoing back from Firestore.
          if (incomingPayload === lastWrittenPayload) return;

          // This is a genuine remote change from another device.
          // Update lastWrittenPayload so future self-writes still deduplicate.
          lastWrittenPayload = incomingPayload;

          try {
            const parsed = JSON.parse(incomingPayload) as AppState;
            callback(parsed);
          } catch (parseErr) {
            console.warn('[Firebase] Failed to parse remote payload:', parseErr);
          }
        },
        (error) => {
          if (isQuotaError(error)) {
            markDailyQuotaExceeded();
            if (activeUnsubscribe) {
              activeUnsubscribe();
              activeUnsubscribe = null;
            }
          } else if (isNetworkError(error)) {
            // Firestore SDK handles reconnection automatically;
            // just log and let it self-heal
            console.warn('[Firebase] Network error in listener — will auto-reconnect:', error.message);
            networkEnabled = false;
          } else {
            console.warn('[Firebase] Snapshot listener error:', error.message);
          }
        }
      );

      activeUnsubscribe = unsubscribe;
      return unsubscribe;
    } catch (e: any) {
      console.warn('[Firebase] Failed to attach snapshot listener:', e?.message);
      return () => {};
    }
  },

  /** Explicitly detach the active real-time listener */
  unsubscribeAll() {
    if (activeUnsubscribe) {
      activeUnsubscribe();
      activeUnsubscribe = null;
    }
  }
};

// ─── Error Classification Helpers ────────────────────────────────────────────
function isQuotaError(e: any): boolean {
  return (
    e?.code === 'resource-exhausted' ||
    e?.message?.includes('Quota exceeded') ||
    e?.message?.includes('resource-exhausted')
  );
}

function isNetworkError(e: any): boolean {
  return (
    e?.code === 'unavailable' ||
    e?.message?.includes('Failed to get document') ||
    e?.message?.includes('offline') ||
    e?.message?.includes('network')
  );
}
