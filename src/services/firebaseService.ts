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
  setDoc,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { AppState } from './storageService';
import type { Agent, Invoice, Subscriber } from '../types';
import { INITIAL_AGENTS } from '../data/mockData';

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
    agents: (tables.agents && tables.agents.length > 0) ? (tables.agents as unknown as AppState['agents']) : INITIAL_AGENTS,
    invoices: tables.invoices as unknown as AppState['invoices'],
    pendingRequests: tables.pendingRequests as unknown as AppState['pendingRequests']
  };
}

type WriteOperation =
  | { type: 'set'; ref: ReturnType<typeof doc>; data: Record<string, unknown>; merge?: boolean }
  | { type: 'delete'; ref: ReturnType<typeof doc> };

async function commitOperations(operations: WriteOperation[], metadata: Record<string, unknown>, _atomic = false) {
  const allOperations: WriteOperation[] = [
    ...operations,
    { type: 'set', ref: TENANT_METADATA_REF, data: { ...metadata, updatedAt: serverTimestamp() }, merge: true }
  ];
  // Break into safe chunks under Firestore's 500 write limit
  const batchLimit = 350;
  for (let offset = 0; offset < allOperations.length; offset += batchLimit) {
    const chunk = allOperations.slice(offset, offset + batchLimit);
    const batch = writeBatch(db);
    chunk.forEach((operation) => {
      if (operation.type === 'delete') batch.delete(operation.ref);
      else if (operation.merge) batch.set(operation.ref, operation.data, { merge: true });
      else batch.set(operation.ref, operation.data);
    });
    try {
      await batch.commit();
    } catch (batchErr) {
      console.warn('Batch commit failed, falling back to direct individual document writes:', batchErr);
      // Fallback: commit individually so individual documents (like sales) succeed even if one fails
      for (const op of chunk) {
        try {
          if (op.type === 'delete') {
            await deleteDoc(op.ref);
          } else {
            await setDoc(op.ref, op.data, { merge: true });
          }
        } catch {}
      }
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
        ref: doc(collectionRef, recordId(record)),
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
      if (!after.has(id)) operations.push({ type: 'delete', ref: doc(collectionRef, id) });
    });
    after.forEach((record, id) => {
      if (JSON.stringify(sanitize(before.get(id))) !== JSON.stringify(sanitize(record))) {
        operations.push({
          type: 'set',
          ref: doc(collectionRef, id),
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

      // Explicitly call getDocs on all Firestore collections for immediate, fresh state
      const [salesSnap, subsSnap, agentsSnap, reqsSnap, usersSnap, metaSnap, legacySnap] = await Promise.all([
        getDocs(collection(db, 'tenants', TENANT_ID, 'sales')).catch((e) => {
          console.warn('getDocs sales warning:', e);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'tenants', TENANT_ID, 'subscribers')).catch((e) => {
          console.warn('getDocs subscribers warning:', e);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'tenants', TENANT_ID, 'agents')).catch((e) => {
          console.warn('getDocs agents warning:', e);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'tenants', TENANT_ID, 'requests')).catch((e) => {
          console.warn('getDocs requests warning:', e);
          return { docs: [] } as any;
        }),
        getDocs(collection(db, 'tenants', TENANT_ID, 'users')).catch(() => ({ docs: [] } as any)),
        getDoc(TENANT_METADATA_REF).catch(() => null),
        getDoc(LEGACY_STATE_REF).catch(() => null)
      ]);

      const metadata = metaSnap && metaSnap.exists?.() ? metaSnap.data() as Record<string, unknown> : {};
      const legacy = legacySnap && legacySnap.exists?.() ? normalizeLegacyState(legacySnap.data()) : null;

      let salesRecords = recordsFromSnapshot(salesSnap);
      let subsRecords = recordsFromSnapshot(subsSnap);
      let agentsRecords = recordsFromSnapshot(agentsSnap);
      let reqsRecords = recordsFromSnapshot(reqsSnap);
      let usersRecords = recordsFromSnapshot(usersSnap);

      // If sales collection was empty, check legacy state
      if (salesRecords.length === 0 && legacy?.invoices && legacy.invoices.length > 0) {
        salesRecords = legacy.invoices as unknown as CoreRecord[];
      }
      // If subscribers collection was empty, check legacy state
      if (subsRecords.length === 0 && legacy?.subscribers && legacy.subscribers.length > 0) {
        subsRecords = legacy.subscribers as unknown as CoreRecord[];
      }
      // If agents collection was empty, check legacy state
      if (agentsRecords.length === 0 && legacy?.agents && legacy.agents.length > 0) {
        agentsRecords = legacy.agents as unknown as CoreRecord[];
      }

      // Merge users: from users subcollection, metadata, and legacy
      let mergedUsers: any[] = Array.isArray(metadata.users) ? metadata.users : [];
      if (usersRecords.length > 0) {
        const userMap = new Map<string, any>();
        mergedUsers.forEach(u => userMap.set(String(u.id || u.username), u));
        usersRecords.forEach(u => userMap.set(String(u.id || u.username), u));
        mergedUsers = Array.from(userMap.values());
      }
      if (mergedUsers.length === 0 && legacy?.users && legacy.users.length > 0) {
        mergedUsers = legacy.users;
      }
      if (mergedUsers.length > 0) {
        metadata.users = mergedUsers;
      }

      const tables: Record<CoreStateKey, CoreRecord[]> = {
        subscribers: subsRecords,
        agents: agentsRecords,
        invoices: salesRecords,
        pendingRequests: reqsRecords
      };

      const builtState = stateFromRemoteTables(tables, metadata);
      const hasData = salesRecords.length > 0 || subsRecords.length > 0 || agentsRecords.length > 0 || (metaSnap && metaSnap.exists?.()) || Boolean(legacy);

      if (hasData) {
        remoteState = sanitize(builtState);
        tenantHasRemoteData = true;
        remoteStreamReady = true;
        updateSyncStatus('connected');
        return sanitize(builtState);
      }

      return remoteState ? sanitize(remoteState) : null;
    } catch (err) {
      console.warn('fetchFreshRemoteState error:', err);
      return remoteState ? sanitize(remoteState) : null;
    }
  },

  async fetchRemoteState(options: { includeEmpty?: boolean } = {}): Promise<AppState | null> {
    const fresh = await this.fetchFreshRemoteState();
    if (fresh) return fresh;
    if (remoteStreamReady && (tenantHasRemoteData || options.includeEmpty)) {
      return sanitize(remoteState || emptyState());
    }
    return null;
  },

  async saveRemoteState(state: AppState, _immediate = false, atomic = false): Promise<void> {
    this.broadcastLocalChange(state);
    const requestedState = sanitize(state);
    const requestedPayload = JSON.stringify(requestedState);
    if (requestedPayload === lastSavedPayload && JSON.stringify(sanitize(remoteState)) === lastSavedPayload) return;

    const saveTask = saveQueue.then(async () => {
      remoteStreamReady = true;

      const baseState = remoteState || emptyState();
      const nextTimestamp = requestedState.lastUpdatedTimestamp || Date.now();
      const nextState: AppState = { ...requestedState, lastUpdatedTimestamp: nextTimestamp };
      const operations = diffOperations(baseState, nextState);
      updateSyncStatus('syncing');
      await commitOperations(operations, metadataChanges(baseState, nextState), atomic);

      // Directly ensure invoices are persisted in sales subcollection
      try {
        if (Array.isArray(nextState.invoices) && nextState.invoices.length > 0) {
          const salesBatch = writeBatch(db);
          let count = 0;
          for (const inv of nextState.invoices) {
            if (inv && inv.id) {
              const invRef = doc(collection(db, 'tenants', TENANT_ID, 'sales'), inv.id);
              salesBatch.set(invRef, { ...sanitize(inv), tenantId: TENANT_ID }, { merge: true });
              count++;
              if (count >= 300) break;
            }
          }
          await salesBatch.commit().catch(() => {});
        }
      } catch {}

      // Double-persist to single-document legacy state for bulletproof cross-client access
      try {
        await setDoc(LEGACY_STATE_REF, {
          payload: JSON.stringify(nextState),
          lastUpdatedTimestamp: nextTimestamp,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      } catch {}

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
      const subDocRef = doc(collection(db, 'tenants', TENANT_ID, 'subscribers'), subscriber.id);
      const reqDocRef = doc(collection(db, 'tenants', TENANT_ID, 'requests'), requestId);
      const invDocRef = doc(collection(db, 'tenants', TENANT_ID, 'sales'), invoice.id);
      const agentDocRef = doc(collection(db, 'tenants', TENANT_ID, 'agents'), agent.id);
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
      const invRef = doc(collection(db, 'tenants', TENANT_ID, 'sales'), id);
      await commitOperations([{ type: 'delete', ref: invRef }], {});
    } catch (e) {
      console.error('Failed to delete remote invoice:', e);
      throw e; // Propagate error so UI can show toast/alert
    }
  },

  async deleteSubscriber(id: string): Promise<void> {
    try {
      const subRef = doc(collection(db, 'tenants', TENANT_ID, 'subscribers'), id);
      await commitOperations([{ type: 'delete', ref: subRef }], {});
    } catch (e) {
      console.error('Failed to delete remote subscriber:', e);
      throw e;
    }
  },
  subscribeToRemoteState(
    callback: (state: AppState, source?: 'remote_firestore' | 'local_broadcast') => void,
    onServerReady?: () => void,
    onSyncError?: (error: unknown) => void
  ): () => void {
    activeRemoteSubscriptions += 1;
    const unsubscriptions: Array<() => void> = [];

    // Internal state buffer initialized from currently known remoteState or emptyState
    const syncedTables: Record<CoreStateKey, CoreRecord[]> = {
      subscribers: remoteState?.subscribers as any || [],
      agents: (remoteState?.agents && remoteState.agents.length > 0) ? (remoteState.agents as any) : (INITIAL_AGENTS as any),
      invoices: remoteState?.invoices as any || [],
      pendingRequests: remoteState?.pendingRequests as any || []
    };
    let syncedMetadata: Record<string, unknown> = metadataFor(remoteState || emptyState(), true);
    let isInitialReadyDispatched = false;

    const dispatchSyncedState = (source: 'remote_firestore' | 'local_broadcast' = 'remote_firestore') => {
      const currentState = stateFromRemoteTables(syncedTables, syncedMetadata);
      remoteState = sanitize(currentState);
      tenantHasRemoteData = true;
      remoteStreamReady = true;
      updateSyncStatus('connected');
      if (!isInitialReadyDispatched) {
        isInitialReadyDispatched = true;
        resolveInitialReady?.(remoteState);
        onServerReady?.();
      }
      callback(remoteState, source);
    };

    // 1. Real-time onSnapshot listener for 'sales' (invoices) - immediate multi-device sync
    try {
      const salesRef = collection(db, 'tenants', TENANT_ID, 'sales');
      const unsubSales = onSnapshot(salesRef, (snapshot) => {
        const records = recordsFromSnapshot(snapshot);
        syncedTables.invoices = records;
        dispatchSyncedState();
      }, (err) => {
        console.warn('Realtime sales onSnapshot listener notice:', err);
      });
      unsubscriptions.push(unsubSales);
    } catch (e) {
      console.warn('Could not register sales onSnapshot:', e);
    }

    // 2. Real-time onSnapshot listener for 'subscribers'
    try {
      const subsRef = collection(db, 'tenants', TENANT_ID, 'subscribers');
      const unsubSubs = onSnapshot(subsRef, (snapshot) => {
        const records = recordsFromSnapshot(snapshot);
        syncedTables.subscribers = records;
        dispatchSyncedState();
      }, (err) => {
        console.warn('Realtime subscribers onSnapshot listener notice:', err);
      });
      unsubscriptions.push(unsubSubs);
    } catch (e) {
      console.warn('Could not register subscribers onSnapshot:', e);
    }

    // 3. Real-time onSnapshot listener for 'agents'
    try {
      const agentsRef = collection(db, 'tenants', TENANT_ID, 'agents');
      const unsubAgents = onSnapshot(agentsRef, (snapshot) => {
        const records = recordsFromSnapshot(snapshot);
        syncedTables.agents = records;
        dispatchSyncedState();
      }, (err) => {
        console.warn('Realtime agents onSnapshot listener notice:', err);
      });
      unsubscriptions.push(unsubAgents);
    } catch (e) {
      console.warn('Could not register agents onSnapshot:', e);
    }

    // 4. Real-time onSnapshot listener for 'requests'
    try {
      const reqsRef = collection(db, 'tenants', TENANT_ID, 'requests');
      const unsubReqs = onSnapshot(reqsRef, (snapshot) => {
        const records = recordsFromSnapshot(snapshot);
        syncedTables.pendingRequests = records;
        dispatchSyncedState();
      }, (err) => {
        console.warn('Realtime requests onSnapshot listener notice:', err);
      });
      unsubscriptions.push(unsubReqs);
    } catch (e) {
      console.warn('Could not register requests onSnapshot:', e);
    }

    // 5. Real-time onSnapshot listener for tenant metadata (users, products, pricing, codes)
    try {
      const unsubMeta = onSnapshot(TENANT_METADATA_REF, (snapshot) => {
        if (snapshot.exists()) {
          syncedMetadata = { ...syncedMetadata, ...snapshot.data() };
          dispatchSyncedState();
        }
      }, (err) => {
        console.warn('Realtime metadata onSnapshot listener notice:', err);
      });
      unsubscriptions.push(unsubMeta);
    } catch (e) {
      console.warn('Could not register metadata onSnapshot:', e);
    }

    // 6. Real-time onSnapshot listener for users collection
    try {
      const usersRef = collection(db, 'tenants', TENANT_ID, 'users');
      const unsubUsers = onSnapshot(usersRef, (snapshot) => {
        if (!snapshot.empty) {
          const userRecords = recordsFromSnapshot(snapshot);
          syncedMetadata.users = userRecords;
          dispatchSyncedState();
        }
      }, () => {});
      unsubscriptions.push(unsubUsers);
    } catch {}

    // 7. Real-time onSnapshot listener for legacy state doc (app_state/global_state)
    try {
      const unsubLegacy = onSnapshot(LEGACY_STATE_REF, (snapshot) => {
        if (snapshot.exists()) {
          const legacy = normalizeLegacyState(snapshot.data());
          if (legacy) {
            let changed = false;
            if (syncedTables.invoices.length === 0 && legacy.invoices && legacy.invoices.length > 0) {
              syncedTables.invoices = legacy.invoices as any;
              changed = true;
            }
            if (syncedTables.subscribers.length === 0 && legacy.subscribers && legacy.subscribers.length > 0) {
              syncedTables.subscribers = legacy.subscribers as any;
              changed = true;
            }
            if (syncedTables.agents.length === 0 && legacy.agents && legacy.agents.length > 0) {
              syncedTables.agents = legacy.agents as any;
              changed = true;
            }
            if (changed) dispatchSyncedState();
          }
        }
      }, () => {});
      unsubscriptions.push(unsubLegacy);
    } catch {}

    // 8. Same-browser broadcast channel listener
    unsubscriptions.push(this.subscribeToLocalBroadcast((state) => {
      callback(state, 'local_broadcast');
    }));

    // Trigger initial ready callback if we already have data
    setTimeout(() => {
      if (!isInitialReadyDispatched && remoteState) {
        dispatchSyncedState();
      }
    }, 400);

    return () => {
      unsubscriptions.forEach((u) => { try { u(); } catch {} });
      activeRemoteSubscriptions = Math.max(0, activeRemoteSubscriptions - 1);
    };
  }
};

/**
 * Global update and synchronization function using Firestore onSnapshot
 * to sync users, sales, subscribers, and agents in real time between all devices.
 */
export function setupGlobalFirestoreSync(
  onUpdate: (state: AppState) => void,
  onServerReady?: () => void,
  onSyncError?: (error: unknown) => void
): () => void {
  return firebaseService.subscribeToRemoteState(onUpdate, onServerReady, onSyncError);
}

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
