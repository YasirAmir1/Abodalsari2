import { getApps, initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  getDocsFromServer,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { AppState } from './storageService';
import type { Agent, Invoice, Subscriber } from '../types';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

export const db = (() => {
  try {
    return initializeFirestore(
      app,
      { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) },
      databaseId
    );
  } catch {
    return getFirestore(app, databaseId);
  }
})();

export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const tenantConfig = firebaseConfig as typeof firebaseConfig & { tenantId?: string };
const configuredTenantId = tenantConfig.tenantId?.trim();
export const TENANT_ID = (configuredTenantId || firebaseConfig.projectId || 'default')
  .replace(/[^a-zA-Z0-9_-]/g, '_');
const shouldMigrateLegacyState = !configuredTenantId;

const TENANT_METADATA_REF = doc(db, 'tenants', TENANT_ID, 'metadata', 'state');
const LEGACY_STATE_REF = doc(db, 'app_state', 'global_state');

type CoreStateKey = 'subscribers' | 'agents' | 'invoices' | 'pendingRequests';
type CoreRecord = { id: string; [key: string]: unknown };
const CORE_COLLECTIONS: Array<{ stateKey: CoreStateKey; collectionName: string }> = [
  { stateKey: 'subscribers', collectionName: 'subscribers' },
  { stateKey: 'agents', collectionName: 'agents' },
  { stateKey: 'pendingRequests', collectionName: 'requests' },
  { stateKey: 'invoices', collectionName: 'sales' }
];

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

const broadcastChannel: BroadcastChannel | null = (() => {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      return new BroadcastChannel(`alsari_realtime_sync_v2_${TENANT_ID}`);
    }
  } catch {}
  return null;
})();

let currentSyncStatus: SyncStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'syncing';
let remoteStreamReady = false;
let activeRemoteSubscriptions = 0;
let tenantHasRemoteData = false;
let lastSavedPayload = '';
let remoteState: AppState | null = null;
let saveQueue: Promise<void> = Promise.resolve();
let resolveInitialReady: ((state: AppState | null) => void) | null = null;
let initialReadyPromise: Promise<AppState | null>;
function resetInitialReadyPromise() {
  initialReadyPromise = new Promise<AppState | null>((resolve) => {
    resolveInitialReady = resolve;
  });
}
resetInitialReadyPromise();
const statusListeners = new Set<(status: SyncStatus) => void>();

function updateSyncStatus(status: SyncStatus) {
  if (currentSyncStatus === status) return;
  currentSyncStatus = status;
  statusListeners.forEach((listener) => {
    try { listener(status); } catch {}
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateSyncStatus(remoteStreamReady ? 'connected' : 'syncing');
  });
  window.addEventListener('offline', () => updateSyncStatus('offline'));
}

function emptyState(): AppState {
  return {
    subscribers: [],
    agents: [],
    products: [],
    pricing: [],
    invoices: [],
    codes: [],
    users: [],
    pendingRequests: [],
    lastUpdatedTimestamp: 0
  };
}

function sanitize<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry)) as T;
  }
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (entry !== undefined && typeof entry !== 'function') clean[key] = sanitize(entry);
    });
    return clean as T;
  }
  return value;
}

function recordId(record: CoreRecord): string {
  return String(record.id || '').trim();
}

function recordsFor(state: AppState, key: CoreStateKey): CoreRecord[] {
  return ((state[key] || []) as unknown as CoreRecord[]).filter((record) => recordId(record));
}

function recordsFromSnapshot(snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }): CoreRecord[] {
  return snapshot.docs.map((item) => {
    const data = item.data();
    return { ...data, id: String(data.id || item.id) };
  }) as CoreRecord[];
}

function normalizeLegacyState(value: unknown): AppState | null {
  try {
    const raw = value as { payload?: string; state?: AppState };
    const parsed = typeof raw?.payload === 'string'
      ? JSON.parse(raw.payload) as Partial<AppState>
      : raw?.state as Partial<AppState> | undefined;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      ...emptyState(),
      ...parsed,
      subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers : [],
      agents: Array.isArray(parsed.agents) ? parsed.agents : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      pricing: Array.isArray(parsed.pricing) ? parsed.pricing : [],
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      codes: Array.isArray(parsed.codes) ? parsed.codes : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      pendingRequests: Array.isArray(parsed.pendingRequests) ? parsed.pendingRequests : [],
      lastUpdatedTimestamp: parsed.lastUpdatedTimestamp || Date.now()
    };
  } catch (error) {
    console.error('Could not parse legacy Firestore state:', error);
    return null;
  }
}

function metadataFor(state: AppState, migrationComplete = false) {
  return sanitize({
    tenantId: TENANT_ID,
    schemaVersion: 2,
    migrationComplete,
    products: state.products || [],
    pricing: state.pricing || [],
    codes: state.codes || [],
    users: state.users || [],
    deletedSubscriberIds: state.deletedSubscriberIds || [],
    deletedInvoiceIds: state.deletedInvoiceIds || [],
    lastUpdatedTimestamp: state.lastUpdatedTimestamp || Date.now()
  });
}

function metadataToState(metadata: Record<string, unknown>, base: AppState): AppState {
  return {
    ...base,
    products: Array.isArray(metadata.products) ? metadata.products as AppState['products'] : base.products,
    pricing: Array.isArray(metadata.pricing) ? metadata.pricing as AppState['pricing'] : base.pricing,
    codes: Array.isArray(metadata.codes) ? metadata.codes as AppState['codes'] : base.codes,
    users: Array.isArray(metadata.users) ? metadata.users as AppState['users'] : base.users,
    deletedSubscriberIds: Array.isArray(metadata.deletedSubscriberIds)
      ? metadata.deletedSubscriberIds as string[]
      : base.deletedSubscriberIds,
    deletedInvoiceIds: Array.isArray(metadata.deletedInvoiceIds)
      ? metadata.deletedInvoiceIds as string[]
      : base.deletedInvoiceIds,
    lastUpdatedTimestamp: typeof metadata.lastUpdatedTimestamp === 'number'
      ? metadata.lastUpdatedTimestamp
      : base.lastUpdatedTimestamp
  };
}

function metadataChanges(previous: AppState, next: AppState): Record<string, unknown> {
  const previousMetadata = metadataFor(previous, true);
  const nextMetadata = metadataFor(next, true);
  const changes: Record<string, unknown> = {
    tenantId: TENANT_ID,
    schemaVersion: 2,
    migrationComplete: true,
    lastUpdatedTimestamp: nextMetadata.lastUpdatedTimestamp
  };

  (['products', 'pricing', 'codes', 'users'] as const).forEach((key) => {
    if (JSON.stringify(sanitize(previousMetadata[key])) !== JSON.stringify(sanitize(nextMetadata[key]))) {
      changes[key] = nextMetadata[key];
    }
  });

  (['deletedSubscriberIds', 'deletedInvoiceIds'] as const).forEach((key) => {
    const previousIds = new Set(previous[key] || []);
    const addedIds = (next[key] || []).filter((id) => !previousIds.has(id));
    if (addedIds.length > 0) changes[key] = arrayUnion(...addedIds);
  });

  return changes;
}

function applyDesiredChanges(baseState: AppState, desiredState: AppState): AppState {
  const merged: AppState = { ...baseState };
  CORE_COLLECTIONS.forEach(({ stateKey }) => {
    const before = new Map(recordsFor(baseState, stateKey).map((record) => [recordId(record), record]));
    const after = new Map(recordsFor(desiredState, stateKey).map((record) => [recordId(record), record]));
    const combined = new Map(before);
    before.forEach((_record, id) => {
      if (!after.has(id)) combined.delete(id);
    });
    after.forEach((record, id) => {
      const previous = before.get(id);
      if (!previous || JSON.stringify(sanitize(previous)) !== JSON.stringify(sanitize(record))) {
        combined.set(id, sanitize(record));
      }
    });
    (merged as unknown as Record<CoreStateKey, CoreRecord[]>)[stateKey] = Array.from(combined.values());
  });

  return {
    ...merged,
    products: JSON.stringify(sanitize(baseState.products)) === JSON.stringify(sanitize(desiredState.products))
      ? baseState.products
      : desiredState.products,
    pricing: JSON.stringify(sanitize(baseState.pricing)) === JSON.stringify(sanitize(desiredState.pricing))
      ? baseState.pricing
      : desiredState.pricing,
    codes: JSON.stringify(sanitize(baseState.codes)) === JSON.stringify(sanitize(desiredState.codes))
      ? baseState.codes
      : desiredState.codes,
    users: JSON.stringify(sanitize(baseState.users)) === JSON.stringify(sanitize(desiredState.users))
      ? baseState.users
      : desiredState.users,
    deletedSubscriberIds: Array.from(new Set([
      ...(baseState.deletedSubscriberIds || []),
      ...(desiredState.deletedSubscriberIds || [])
    ])),
    deletedInvoiceIds: Array.from(new Set([
      ...(baseState.deletedInvoiceIds || []),
      ...(desiredState.deletedInvoiceIds || [])
    ])),
    lastUpdatedTimestamp: desiredState.lastUpdatedTimestamp || Date.now()
  };
}

function stateFromRemoteTables(
  tables: Record<CoreStateKey, CoreRecord[]>,
  metadata: Record<string, unknown>
): AppState {
  const base = metadataToState(metadata, emptyState());
  return {
    ...base,
    subscribers: tables.subscribers as unknown as AppState['subscribers'],
    agents: tables.agents as unknown as AppState['agents'],
    invoices: tables.invoices as unknown as AppState['invoices'],
    pendingRequests: tables.pendingRequests as unknown as AppState['pendingRequests']
  };
}

type WriteOperation =
  | { type: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown>; merge?: boolean }
  | { type: 'delete'; ref: ReturnType<typeof doc> };

async function commitOperations(operations: WriteOperation[], metadata: Record<string, unknown>, atomic = false) {
  const allOperations: WriteOperation[] = [
    ...operations,
    { type: 'set', ref: TENANT_METADATA_REF, data: { ...metadata, updatedAt: serverTimestamp() }, merge: true }
  ];
  if (atomic && allOperations.length > 500) {
    throw new Error('Atomic Firestore update exceeds the 500-write batch limit.');
  }
  const batchLimit = atomic ? 500 : 450;
  for (let offset = 0; offset < allOperations.length; offset += batchLimit) {
    const batch = writeBatch(db);
    allOperations.slice(offset, offset + batchLimit).forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      else if (operation.merge) batch.set(operation.ref, operation.data, { merge: true });
      else batch.set(operation.ref, operation.data);
    });
    try {
      await batch.commit();
    } catch (batchErr) {
      handleFirestoreError(batchErr, OperationType.WRITE, `tenants/${TENANT_ID}`);
    }
  }
}

function fullStateOperations(state: AppState): WriteOperation[] {
  const operations: WriteOperation[] = [];
  CORE_COLLECTIONS.forEach(({ stateKey, collectionName }) => {
    const collectionRef = collection(db, 'tenants', TENANT_ID, collectionName);
    recordsFor(state, stateKey).forEach((record) => {
      operations.push({
        type: 'set',
        ref: doc(collectionRef, encodeURIComponent(recordId(record))),
        data: { ...sanitize(record), tenantId: TENANT_ID }
      });
    });
  });
  return operations;
}

function diffOperations(previous: AppState, next: AppState): WriteOperation[] {
  const operations: WriteOperation[] = [];
  CORE_COLLECTIONS.forEach(({ stateKey, collectionName }) => {
    const collectionRef = collection(db, 'tenants', TENANT_ID, collectionName);
    const before = new Map(recordsFor(previous, stateKey).map((record) => [recordId(record), record]));
    const after = new Map(recordsFor(next, stateKey).map((record) => [recordId(record), record]));

    before.forEach((_record, id) => {
      if (!after.has(id)) operations.push({ type: 'delete', ref: doc(collectionRef, encodeURIComponent(id)) });
    });
    after.forEach((record, id) => {
      if (JSON.stringify(sanitize(before.get(id))) !== JSON.stringify(sanitize(record))) {
        operations.push({
          type: 'set',
          ref: doc(collectionRef, encodeURIComponent(id)),
          data: { ...sanitize(record), tenantId: TENANT_ID }
        });
      }
    });
  });
  return operations;
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
    return () => statusListeners.delete(callback);
  },

  broadcastLocalChange(state: AppState) {
    try {
      broadcastChannel?.postMessage({
        type: 'APP_STATE_UPDATED',
        tenantId: TENANT_ID,
        payload: state,
        timestamp: Date.now()
      });
    } catch {}
  },

  subscribeToLocalBroadcast(callback: (state: AppState) => void): () => void {
    if (!broadcastChannel) return () => {};
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'APP_STATE_UPDATED' && event.data.tenantId === TENANT_ID && event.data.payload) {
        callback(event.data.payload as AppState);
      }
    };
    broadcastChannel.addEventListener('message', handler);
    return () => broadcastChannel.removeEventListener('message', handler);
  },

  async fetchFreshRemoteState(): Promise<AppState | null> {
    try {
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (isOffline) {
        return remoteState ? sanitize(remoteState) : null;
      }

      let metaSnap: any = null;
      try {
        metaSnap = await getDocFromServer(TENANT_METADATA_REF);
      } catch {
        try {
          metaSnap = await getDoc(TENANT_METADATA_REF);
        } catch {}
      }

      const collectionSnaps = await Promise.all(
        CORE_COLLECTIONS.map(async ({ collectionName }) => {
          const colRef = collection(db, 'tenants', TENANT_ID, collectionName);
          try {
            return await getDocsFromServer(colRef);
          } catch {
            try {
              return await getDocs(colRef);
            } catch {
              return { docs: [] };
            }
          }
        })
      );

      const metadata = metaSnap && metaSnap.exists?.() ? metaSnap.data() as Record<string, unknown> : {};
      const tables: Record<CoreStateKey, CoreRecord[]> = {
        subscribers: [],
        agents: [],
        invoices: [],
        pendingRequests: []
      };

      CORE_COLLECTIONS.forEach(({ stateKey }, index) => {
        const snap = collectionSnaps[index];
        if (snap && Array.isArray(snap.docs)) {
          tables[stateKey] = snap.docs.map((item: any) => {
            const data = item.data();
            return { ...data, id: String(data.id || item.id) };
          }) as CoreRecord[];
        }
      });

      const state = stateFromRemoteTables(tables, metadata);
      const hasData = (metaSnap && metaSnap.exists?.()) || CORE_COLLECTIONS.some(({ stateKey }) => tables[stateKey].length > 0);
      if (hasData) {
        remoteState = sanitize(state);
        tenantHasRemoteData = true;
      }
      return hasData ? sanitize(state) : (remoteState ? sanitize(remoteState) : null);
    } catch {
      return remoteState ? sanitize(remoteState) : null;
    }
  },

  async fetchRemoteState(options: { includeEmpty?: boolean } = {}): Promise<AppState | null> {
    if (activeRemoteSubscriptions > 0) {
      if (!remoteStreamReady) {
        updateSyncStatus('syncing');
        await Promise.race([
          initialReadyPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000))
        ]);
      }
      // An empty tenant is a valid result for the manual refresh action, while
      // login retains its existing fallback to local credentials and data.
      if (!remoteStreamReady || (!tenantHasRemoteData && !options.includeEmpty)) return null;
      return sanitize(remoteState || emptyState());
    }

    // Login happens before the authenticated app session starts its long-lived
    // listener. Use a temporary snapshot stream to fetch the current tenant
    // state, then release all listeners immediately.
    return new Promise<AppState | null>((resolve) => {
      let settled = false;
      let unsubscribe: (() => void) | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const finish = (state: AppState | null) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        unsubscribe?.();
        resolve(state ? sanitize(state) : null);
      };
      timeout = setTimeout(() => finish(null), 15000);

      unsubscribe = this.subscribeToRemoteState(
        (state, source) => {
          if (source === 'remote_firestore') finish(state);
        },
        () => finish(
          remoteStreamReady && (tenantHasRemoteData || options.includeEmpty)
            ? remoteState || emptyState()
            : null
        ),
        () => finish(null)
      );
    });
  },

  async saveRemoteState(state: AppState, _immediate = false, atomic = false): Promise<void> {
    this.broadcastLocalChange(state);
    const requestedState = sanitize(state);
    const requestedPayload = JSON.stringify(requestedState);
    if (requestedPayload === lastSavedPayload && JSON.stringify(sanitize(remoteState)) === lastSavedPayload) return;

    const saveTask = saveQueue.then(async () => {
      if (!remoteStreamReady) {
        await Promise.race([
          initialReadyPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
        ]);
      }
      remoteStreamReady = true;

      const baseState = remoteState || emptyState();
      const nextTimestamp = requestedState.lastUpdatedTimestamp || Date.now();
      const nextState: AppState = { ...requestedState, lastUpdatedTimestamp: nextTimestamp };
      const operations = diffOperations(baseState, nextState);
      updateSyncStatus('syncing');
      await commitOperations(operations, metadataChanges(baseState, nextState), atomic);

      remoteState = applyDesiredChanges(baseState, nextState);
      tenantHasRemoteData = true;
      lastSavedPayload = JSON.stringify(sanitize(remoteState));
      updateSyncStatus('connected');
    });
    saveQueue = saveTask.catch(() => {});
    return saveTask;
  },

  async executeApprovalTransaction({
    subscriber,
    invoice,
    agent,
    requestId,
    nextFullState
  }: {
    subscriber: Subscriber;
    invoice: Invoice;
    agent: Agent;
    requestId: string;
    nextFullState: AppState;
  }): Promise<void> {
    this.broadcastLocalChange(nextFullState);
    const requestedState = sanitize(nextFullState);
    const nextTimestamp = requestedState.lastUpdatedTimestamp || Date.now();
    const nextState: AppState = { ...requestedState, lastUpdatedTimestamp: nextTimestamp };

    const saveTask = saveQueue.then(async () => {
      updateSyncStatus('syncing');
      const subDocRef = doc(collection(db, 'tenants', TENANT_ID, 'subscribers'), encodeURIComponent(subscriber.id));
      const reqDocRef = doc(collection(db, 'tenants', TENANT_ID, 'requests'), encodeURIComponent(requestId));
      const invDocRef = doc(collection(db, 'tenants', TENANT_ID, 'sales'), encodeURIComponent(invoice.id));
      const agentDocRef = doc(collection(db, 'tenants', TENANT_ID, 'agents'), encodeURIComponent(agent.id));
      const metaDocRef = TENANT_METADATA_REF;
      const resolvedRequest = nextState.pendingRequests.find((request) => request.id === requestId);
      const resolvedRequestData = {
        ...(resolvedRequest || { id: requestId }),
        status: 'approved',
        tenantId: TENANT_ID
      };

      try {
        await runTransaction(db, async (transaction) => {
          transaction.set(subDocRef, { ...sanitize(subscriber), tenantId: TENANT_ID }, { merge: true });
          transaction.set(reqDocRef, sanitize(resolvedRequestData), { merge: true });
          transaction.set(invDocRef, { ...sanitize(invoice), tenantId: TENANT_ID });
          transaction.set(agentDocRef, { ...sanitize(agent), tenantId: TENANT_ID }, { merge: true });
          transaction.set(metaDocRef, { ...metadataChanges(remoteState || emptyState(), nextState), updatedAt: serverTimestamp() }, { merge: true });
        });
      } catch (txError) {
        console.warn('Firestore runTransaction fallback to batch write:', txError);
        const batch = writeBatch(db);
        batch.set(subDocRef, { ...sanitize(subscriber), tenantId: TENANT_ID }, { merge: true });
        batch.set(reqDocRef, sanitize(resolvedRequestData), { merge: true });
        batch.set(invDocRef, { ...sanitize(invoice), tenantId: TENANT_ID });
        batch.set(agentDocRef, { ...sanitize(agent), tenantId: TENANT_ID }, { merge: true });
        batch.set(metaDocRef, { ...metadataChanges(remoteState || emptyState(), nextState), updatedAt: serverTimestamp() }, { merge: true });
        await batch.commit();
      }

      remoteState = nextState;
      tenantHasRemoteData = true;
      lastSavedPayload = JSON.stringify(sanitize(remoteState));
      updateSyncStatus('connected');
    });

    saveQueue = saveTask.catch(() => {});
    return saveTask;
  },

  async deleteInvoice(id: string): Promise<void> {
    try {
      const invRef = doc(collection(db, 'tenants', TENANT_ID, 'sales'), encodeURIComponent(id));
      await deleteDoc(invRef);
    } catch (e) {
      console.error('Failed to delete remote invoice:', e);
    }
  },

  async deleteSubscriber(id: string): Promise<void> {
    try {
      const subRef = doc(collection(db, 'tenants', TENANT_ID, 'subscribers'), encodeURIComponent(id));
      await deleteDoc(subRef);
    } catch (e) {
      console.error('Failed to delete remote subscriber:', e);
    }
  },
  subscribeToRemoteState(
    callback: (state: AppState, source?: 'remote_firestore' | 'local_broadcast') => void,
    onServerReady?: () => void,
    onSyncError?: (error: unknown) => void
  ): () => void {
    activeRemoteSubscriptions += 1;
    const unsubscriptions: Array<() => void> = [];
    const remoteTables: Record<CoreStateKey, CoreRecord[]> = {
      subscribers: [],
      agents: [],
      invoices: [],
      pendingRequests: []
    };
    const loadedTables = new Set<CoreStateKey>();
    let metadata: Record<string, unknown> = {};
    let metadataExists = false;
    let metadataLoaded = false;
    let legacyLoaded = !shouldMigrateLegacyState;
    let legacyState: AppState | null = null;
    let legacyUnsubscribe: (() => void) | null = null;
    let initialReady = false;
    let migrationStarted = false;
    let stopped = false;

    const unsubscribeAll = () => {
      if (stopped) return;
      stopped = true;
      unsubscriptions.splice(0).forEach((unsubscribe) => {
        try { unsubscribe(); } catch {}
      });
      activeRemoteSubscriptions = Math.max(0, activeRemoteSubscriptions - 1);
      if (activeRemoteSubscriptions === 0) {
        remoteStreamReady = false;
        resetInitialReadyPromise();
        updateSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'syncing');
      }
    };

    const notify = (nextState: AppState) => {
      const cleanState = sanitize(nextState);
      remoteState = cleanState;
      tenantHasRemoteData = metadataExists || CORE_COLLECTIONS.some(({ stateKey }) => remoteTables[stateKey].length > 0);
      callback(cleanState, 'remote_firestore');
    };

    const finishInitialLoad = (state: AppState | null) => {
      if (stopped || initialReady) return;
      initialReady = true;
      remoteStreamReady = true;
      if (state) {
        remoteState = sanitize(state);
        tenantHasRemoteData = true;
        callback(remoteState, 'remote_firestore');
      } else {
        remoteState = emptyState();
        tenantHasRemoteData = false;
      }
      resolveInitialReady?.(tenantHasRemoteData ? remoteState : null);
      resolveInitialReady = null;
      if (!stopped) {
        updateSyncStatus('connected');
        onServerReady?.();
      }
    };

    const maybeFinishInitialLoad = () => {
      if (stopped || initialReady || migrationStarted) return;
      if (loadedTables.size !== CORE_COLLECTIONS.length || !metadataLoaded || !legacyLoaded) return;

      const state = stateFromRemoteTables(remoteTables, metadata);
      const hasTenantData = metadataExists || CORE_COLLECTIONS.some(({ stateKey }) => remoteTables[stateKey].length > 0);
      const metadataMigrationComplete = metadata.migrationComplete === true;

      if (shouldMigrateLegacyState && legacyState && !hasTenantData && !metadataMigrationComplete) {
        migrationStarted = true;
        updateSyncStatus('syncing');
        const operations = fullStateOperations(legacyState);
        void commitOperations(operations, metadataFor(legacyState, true)).then(() => {
          CORE_COLLECTIONS.forEach(({ stateKey }) => {
            remoteTables[stateKey] = recordsFor(legacyState!, stateKey);
          });
          metadata = metadataFor(legacyState!, true);
          metadataExists = true;
          finishInitialLoad(legacyState);
        }).catch((error) => {
          migrationStarted = false;
          updateSyncStatus('error');
          onSyncError?.(error);
          unsubscribeAll();
        });
        return;
      }

      finishInitialLoad(hasTenantData ? state : null);
    };

    try {
      CORE_COLLECTIONS.forEach(({ stateKey, collectionName }) => {
        const collectionRef = collection(db, 'tenants', TENANT_ID, collectionName);
        const unsubscribe = onSnapshot(collectionRef, { includeMetadataChanges: true }, (snapshot) => {
          remoteTables[stateKey] = recordsFromSnapshot(snapshot);
          if (snapshot.metadata.fromCache) {
            updateSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'syncing');
            if (initialReady) notify(stateFromRemoteTables(remoteTables, metadata));
            return;
          }
          if (snapshot.metadata.hasPendingWrites) return;
          loadedTables.add(stateKey);
          if (!initialReady) {
            maybeFinishInitialLoad();
            return;
          }
          updateSyncStatus('connected');
          notify(stateFromRemoteTables(remoteTables, metadata));
        }, (error) => {
          const errMessage = error instanceof Error ? error.message : String(error);
          const isRestricted = typeof navigator !== 'undefined' && !navigator.onLine
            || errMessage.includes('permission') || errMessage.includes('unavailable') || errMessage.includes('Missing or insufficient permissions');
          if (isRestricted) {
            updateSyncStatus('offline');
            return;
          }
          updateSyncStatus('error');
          let handledError: unknown = error;
          try {
            handleFirestoreError(error, OperationType.GET, `tenants/${TENANT_ID}/${collectionName}`);
          } catch (formatted) {
            handledError = formatted;
          }
          onSyncError?.(handledError);
          unsubscribeAll();
        });
        unsubscriptions.push(unsubscribe);
      });

      unsubscriptions.push(onSnapshot(TENANT_METADATA_REF, { includeMetadataChanges: true }, (snapshot) => {
        if (snapshot.metadata.fromCache) {
          updateSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'syncing');
          return;
        }
        if (snapshot.metadata.hasPendingWrites) return;
        metadata = snapshot.exists() ? snapshot.data() as Record<string, unknown> : {};
        metadataExists = snapshot.exists();
        metadataLoaded = true;
        if (!initialReady) {
          maybeFinishInitialLoad();
          return;
        }
        updateSyncStatus('connected');
        notify(stateFromRemoteTables(remoteTables, metadata));
      }, (error) => {
        const errMessage = error instanceof Error ? error.message : String(error);
        const isRestricted = typeof navigator !== 'undefined' && !navigator.onLine
          || errMessage.includes('permission') || errMessage.includes('unavailable') || errMessage.includes('Missing or insufficient permissions');
        if (isRestricted) {
          metadataLoaded = true;
          maybeFinishInitialLoad();
          return;
        }
        updateSyncStatus('error');
        let handledError: unknown = error;
        try {
          handleFirestoreError(error, OperationType.GET, `tenants/${TENANT_ID}/metadata/state`);
        } catch (formatted) {
          handledError = formatted;
        }
        onSyncError?.(handledError);
        unsubscribeAll();
      }));

      if (shouldMigrateLegacyState) {
        const stopLegacyListener = onSnapshot(LEGACY_STATE_REF, { includeMetadataChanges: true }, (snapshot) => {
          if (snapshot.metadata.fromCache) return;
          if (snapshot.metadata.hasPendingWrites) return;
          legacyState = snapshot.exists() ? normalizeLegacyState(snapshot.data()) : null;
          legacyLoaded = true;
          legacyUnsubscribe?.();
          legacyUnsubscribe = null;
          maybeFinishInitialLoad();
        }, (error) => {
          const errMessage = error instanceof Error ? error.message : String(error);
          const isRestricted = typeof navigator !== 'undefined' && !navigator.onLine
            || errMessage.includes('permission') || errMessage.includes('unavailable') || errMessage.includes('Missing or insufficient permissions');
          if (isRestricted) {
            legacyLoaded = true;
            maybeFinishInitialLoad();
            return;
          }
          updateSyncStatus('error');
          let handledError: unknown = error;
          try {
            handleFirestoreError(error, OperationType.GET, 'app_state/global_state');
          } catch (formatted) {
            handledError = formatted;
          }
          onSyncError?.(handledError);
          unsubscribeAll();
        });
        legacyUnsubscribe = stopLegacyListener;
        unsubscriptions.push(stopLegacyListener);
      }

      unsubscriptions.push(this.subscribeToLocalBroadcast((state) => {
        callback(state, 'local_broadcast');
      }));
    } catch (error) {
      const isRestricted = typeof navigator !== 'undefined' && !navigator.onLine
        || (error instanceof Error && (error.message.includes('permission') || error.message.includes('unavailable')));
      updateSyncStatus(isRestricted ? 'offline' : 'error');
      let handledError: unknown = error;
      try {
        handleFirestoreError(error, OperationType.GET, `tenants/${TENANT_ID}`);
      } catch (formatted) {
        handledError = formatted;
      }
      onSyncError?.(handledError);
      unsubscribeAll();
    }

    return unsubscribeAll;
  }
};

export async function signInWithGoogle(): Promise<{ success: boolean; email?: string | null; error?: string }> {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return { success: true, email: result.user.email };
  } catch (error) {
    console.warn('Google sign-in canceled or failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('Sign out failed:', error);
  }
}
