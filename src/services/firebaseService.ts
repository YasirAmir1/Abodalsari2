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
import { AppState } from './storageService';

// Initialize Firebase App safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Firestore with in-memory cache to prevent old pending writes from persisting and retrying
const db = (() => {
  try {
    return initializeFirestore(app, { localCache: memoryLocalCache() }, firebaseConfig.firestoreDatabaseId || '(default)');
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
  }
})();

const STATE_DOC_REF = doc(db, 'app_state', 'global_state');

const QUOTA_STORAGE_KEY = 'alsari_fs_quota_exceeded_day_v1';

function getTodayStr(): string {
  try {
    return new Date().toISOString().split('T')[0];
  } catch {
    return '2026-10-18';
  }
}

export function markDailyQuotaExceeded() {
  try {
    localStorage.setItem(QUOTA_STORAGE_KEY, getTodayStr());
  } catch {}
}

// Mark today by default since the free tier daily write quota limit is currently exhausted on Google Cloud
if (typeof window !== 'undefined') {
  markDailyQuotaExceeded();
}

function isDailyQuotaExceeded(): boolean {
  try {
    const val = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (val === getTodayStr()) {
      return true;
    }
  } catch {}
  return false;
}

let lastSavedPayload = '';

export const firebaseService = {
  isQuotaExceeded(): boolean {
    return isDailyQuotaExceeded();
  },

  async fetchRemoteState(): Promise<AppState | null> {
    try {
      const snap = await getDoc(STATE_DOC_REF);
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.payload) {
          lastSavedPayload = data.payload;
          return JSON.parse(data.payload) as AppState;
        }
      }
    } catch (e: any) {
      if (
        e?.code === 'resource-exhausted' ||
        e?.message?.includes('Quota exceeded') ||
        e?.message?.includes('resource-exhausted')
      ) {
        markDailyQuotaExceeded();
      }
    }
    return null;
  },

  async saveRemoteState(state: AppState): Promise<void> {
    // If daily quota is exceeded, do NOT send any write requests to prevent errors and backoff loops
    if (isDailyQuotaExceeded()) {
      return;
    }

    try {
      const payload = JSON.stringify(state);
      if (payload === lastSavedPayload) {
        return;
      }

      lastSavedPayload = payload;
      await setDoc(STATE_DOC_REF, {
        payload,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e: any) {
      if (
        e?.code === 'resource-exhausted' ||
        e?.message?.includes('Quota exceeded') ||
        e?.message?.includes('resource-exhausted')
      ) {
        markDailyQuotaExceeded();
      }
    }
  },

  subscribeToRemoteState(callback: (state: AppState) => void) {
    try {
      return onSnapshot(
        STATE_DOC_REF,
        { includeMetadataChanges: false },
        (snap) => {
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
              } catch {}
            }
          }
        },
        (error) => {
          if (error.code === 'resource-exhausted' || error.message?.includes('Quota exceeded')) {
            markDailyQuotaExceeded();
          }
        }
      );
    } catch {
      return () => {};
    }
  }
};
