import {
  INITIAL_AGENTS,
  INITIAL_CODES,
  INITIAL_INVOICES,
  INITIAL_PRICING,
  INITIAL_PRODUCTS,
  INITIAL_SUBSCRIBERS,
  INITIAL_USERS
} from '../data/mockData';
import {
  Agent,
  DeviceCode,
  Invoice,
  PendingRenewalRequest,
  PricingRow,
  Product,
  Subscriber,
  SystemUser
} from '../types';

export interface AppState {
  subscribers: Subscriber[];
  agents: Agent[];
  products: Product[];
  pricing: PricingRow[];
  invoices: Invoice[];
  codes: DeviceCode[];
  users: SystemUser[];
  pendingRequests: PendingRenewalRequest[];
  deletedSubscriberIds?: string[];
  deletedInvoiceIds?: string[];
  lastUpdatedTimestamp?: number;
  lastBackupDate?: string;
}

const STORAGE_KEY = 'alsari_broadcasting_v1';
const DELETED_SUBS_KEY = 'alsari_deleted_subscribers_v1';
const DELETED_INVOICES_KEY = 'alsari_deleted_invoices_v1';
const ALL_CLEARED_KEY = 'alsari_all_subscribers_cleared_v1';

export const storageService = {
  isAllSubscribersCleared(): boolean {
    try {
      return localStorage.getItem(ALL_CLEARED_KEY) === 'true';
    } catch {
      return false;
    }
  },

  setAllSubscribersCleared(cleared: boolean) {
    try {
      if (cleared) {
        localStorage.setItem(ALL_CLEARED_KEY, 'true');
      } else {
        localStorage.removeItem(ALL_CLEARED_KEY);
      }
    } catch {}
  },

  getDeletedSubscriberIds(): Set<string> {
    try {
      const data = localStorage.getItem(DELETED_SUBS_KEY);
      if (data) {
        return new Set(JSON.parse(data));
      }
    } catch {}
    return new Set<string>();
  },

  addDeletedSubscriberId(idOrDeviceId: string) {
    if (!idOrDeviceId) return;
    try {
      const set = this.getDeletedSubscriberIds();
      set.add(idOrDeviceId);
      localStorage.setItem(DELETED_SUBS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  },

  removeDeletedSubscriberId(idOrDeviceId: string) {
    if (!idOrDeviceId) return;
    try {
      const set = this.getDeletedSubscriberIds();
      if (set.has(idOrDeviceId)) {
        set.delete(idOrDeviceId);
        localStorage.setItem(DELETED_SUBS_KEY, JSON.stringify(Array.from(set)));
      }
    } catch {}
  },

  markAllSubscribersAsDeleted(subscribers: Subscriber[]) {
    try {
      const set = this.getDeletedSubscriberIds();
      subscribers.forEach((s) => {
        if (s.id) set.add(s.id);
        if (s.deviceId) set.add(s.deviceId);
      });
      localStorage.setItem(DELETED_SUBS_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  },

  getDeletedInvoiceIds(): Set<string> {
    try {
      const data = localStorage.getItem(DELETED_INVOICES_KEY);
      if (data) {
        return new Set(JSON.parse(data));
      }
    } catch {}
    return new Set<string>();
  },

  addDeletedInvoiceId(id: string) {
    if (!id) return;
    try {
      const set = this.getDeletedInvoiceIds();
      set.add(id);
      localStorage.setItem(DELETED_INVOICES_KEY, JSON.stringify(Array.from(set)));
    } catch {}
  },

  filterOutDeleted(state: AppState): AppState {
    // This flag only protects a device's local cache immediately after
    // "delete all". It must not hide new server records on other sessions.
    if (this.isAllSubscribersCleared() && (state.subscribers || []).length > 0) {
      this.setAllSubscribersCleared(false);
    }

    const deletedSet = this.getDeletedSubscriberIds();
    const deletedInvoicesSet = new Set([
      ...this.getDeletedInvoiceIds(),
      ...(state.deletedInvoiceIds || [])
    ]);

    const filteredSubs = (state.subscribers || []).filter(
      (s) => !deletedSet.has(s.id) && (!s.deviceId || !deletedSet.has(s.deviceId))
    );

    const filteredInvoices = (state.invoices || []).filter(
      (inv) => !deletedInvoicesSet.has(inv.id) && !deletedSet.has(inv.subscriberId) && (!inv.deviceId || !deletedSet.has(inv.deviceId))
    );

    const filteredRequests = (state.pendingRequests || []).filter(
      (req) => !deletedSet.has(req.subscriberId) && (!req.deviceId || !deletedSet.has(req.deviceId))
    );

    return {
      ...state,
      subscribers: filteredSubs,
      invoices: filteredInvoices,
      deletedInvoiceIds: Array.from(deletedInvoicesSet),
      pendingRequests: filteredRequests
    };
  },

  cascadeDeleteAllSubscribers(state: AppState): AppState {
    this.setAllSubscribersCleared(true);

    // Record all deleted IDs so they won't get revived by old snapshots
    const deletedSet = this.getDeletedSubscriberIds();
    (state.subscribers || []).forEach((s) => {
      deletedSet.add(s.id);
      if (s.deviceId) deletedSet.add(s.deviceId);
    });
    try {
      localStorage.setItem(DELETED_SUBS_KEY, JSON.stringify(Array.from(deletedSet)));
    } catch {}

    // Reset agent counters
    const updatedAgents = (state.agents || []).map((ag) => ({
      ...ag,
      devicesCount: 0,
      activeSubscriptions: 0,
      inactiveSubscriptions: 0,
      totalDebt: 0,
      totalSales: 0,
      hasDebt: false
    }));

    // Reset device codes
    const updatedCodes = (state.codes || []).map((c) => ({
      ...c,
      status: 'available' as const,
      assignedToSubscriber: undefined
    }));

    // Clear invoices tied to subscribers
    const remainingInvoices = (state.invoices || []).filter((inv) => !inv.subscriberId);

    const newState: AppState = {
      ...state,
      subscribers: [],
      pendingRequests: [],
      invoices: remainingInvoices,
      agents: updatedAgents,
      codes: updatedCodes,
      lastUpdatedTimestamp: Date.now()
    };

    this.saveState(newState);
    return newState;
  },

  loadState(): AppState {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: AppState = JSON.parse(data);
        return {
          ...parsed,
          subscribers: Array.isArray(parsed.subscribers) ? parsed.subscribers : [],
          agents: Array.isArray(parsed.agents) && parsed.agents.length > 0 ? parsed.agents : INITIAL_AGENTS,
          pricing: Array.isArray(parsed.pricing) && parsed.pricing.length > 0 ? parsed.pricing : INITIAL_PRICING,
          products: Array.isArray(parsed.products) && parsed.products.length > 0 ? parsed.products : INITIAL_PRODUCTS,
          invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
          codes: Array.isArray(parsed.codes) && parsed.codes.length > 0 ? parsed.codes : INITIAL_CODES,
          users: Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : INITIAL_USERS,
          pendingRequests: Array.isArray(parsed.pendingRequests) ? parsed.pendingRequests : [],
          lastBackupDate: parsed.lastBackupDate || new Date().toISOString(),
          lastUpdatedTimestamp: parsed.lastUpdatedTimestamp || Date.now()
        };
      }
    } catch (e) {
      console.error('Failed to read localStorage state:', e);
    }

    return {
      subscribers: INITIAL_SUBSCRIBERS,
      agents: INITIAL_AGENTS,
      products: INITIAL_PRODUCTS,
      pricing: INITIAL_PRICING,
      invoices: INITIAL_INVOICES,
      codes: INITIAL_CODES,
      users: INITIAL_USERS,
      pendingRequests: [],
      lastUpdatedTimestamp: Date.now()
    };
  },

  async migrateLocalStorageIfNeeded(): Promise<boolean> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: AppState = JSON.parse(data);
        const { firebaseService } = await import('./firebaseService');
        await firebaseService.saveRemoteState(parsed, true, false);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(DELETED_SUBS_KEY);
        localStorage.removeItem(DELETED_INVOICES_KEY);
        localStorage.removeItem(ALL_CLEARED_KEY);
        console.log('Successfully migrated localStorage data to Firestore and cleared localStorage.');
        return true;
      }
    } catch (err) {
      console.error('Failed to migrate localStorage data to Firestore:', err);
    }
    return false;
  },

  saveState(state: AppState) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to cache state to localStorage:', e);
    }
  },

  createWhatsAppLink(phone: string, message: string): string {
    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('07')) {
      cleanPhone = '964' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7')) {
      cleanPhone = '964' + cleanPhone;
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  }
};
