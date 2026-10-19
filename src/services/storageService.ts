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
  lastUpdatedTimestamp?: number;
}

const STORAGE_KEY = 'alsari_broadcasting_v1';
const DELETED_SUBS_KEY = 'alsari_deleted_subscribers_v1';
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

  filterOutDeleted(state: AppState): AppState {
    if (this.isAllSubscribersCleared()) {
      return {
        ...state,
        subscribers: [],
        pendingRequests: [],
        agents: (state.agents || []).map((ag) => ({
          ...ag,
          devicesCount: 0,
          activeSubscriptions: 0,
          inactiveSubscriptions: 0,
          totalDebt: 0,
          totalSales: 0,
          hasDebt: false
        }))
      };
    }

    const deletedSet = this.getDeletedSubscriberIds();
    if (deletedSet.size === 0) return state;

    const filteredSubs = (state.subscribers || []).filter(
      (s) => !deletedSet.has(s.id) && !deletedSet.has(s.deviceId)
    );

    const filteredInvoices = (state.invoices || []).filter(
      (inv) => !deletedSet.has(inv.subscriberId) && !deletedSet.has(inv.deviceId)
    );

    const filteredRequests = (state.pendingRequests || []).filter(
      (req) => !deletedSet.has(req.subscriberId) && !deletedSet.has(req.deviceId)
    );

    return {
      ...state,
      subscribers: filteredSubs,
      invoices: filteredInvoices,
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
    const isCleared = this.isAllSubscribersCleared();
    const deletedSet = this.getDeletedSubscriberIds();

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: AppState = JSON.parse(data);
        if (parsed.subscribers && Array.isArray(parsed.subscribers)) {
          parsed.subscribers = isCleared
            ? []
            : parsed.subscribers
                .filter((s) => !deletedSet.has(s.id) && !deletedSet.has(s.deviceId))
                .map((s) => {
                  const raw = (s.deviceId || '').trim();
                  const clean = raw ? (raw.startsWith('00') ? raw : `00${raw}`) : `00123456`;
                  return { ...s, deviceId: clean };
                });
        }
        if (parsed.invoices && Array.isArray(parsed.invoices)) {
          parsed.invoices = parsed.invoices.filter(
            (inv) => !deletedSet.has(inv.subscriberId) && !deletedSet.has(inv.deviceId)
          );
        }
        if (parsed.pendingRequests && Array.isArray(parsed.pendingRequests)) {
          parsed.pendingRequests = parsed.pendingRequests.filter(
            (req) => !deletedSet.has(req.subscriberId) && !deletedSet.has(req.deviceId)
          );
        }
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
          securityAlerts: Array.isArray(parsed.securityAlerts) ? parsed.securityAlerts : INITIAL_SECURITY_ALERTS,
          lastBackupDate: parsed.lastBackupDate || new Date().toISOString(),
          lastUpdatedTimestamp: parsed.lastUpdatedTimestamp || Date.now()
        };
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }

    const initialFilteredSubs = isCleared
      ? []
      : INITIAL_SUBSCRIBERS.filter(
          (s) => !deletedSet.has(s.id) && !deletedSet.has(s.deviceId)
        );

    return {
      subscribers: initialFilteredSubs,
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

  saveState(state: AppState) {
    try {
      const toSave: AppState = {
        ...state,
        lastUpdatedTimestamp: state.lastUpdatedTimestamp || Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
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
