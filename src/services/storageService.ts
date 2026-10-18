import {
  INITIAL_AGENTS,
  INITIAL_CODES,
  INITIAL_INVOICES,
  INITIAL_PRICING,
  INITIAL_PRODUCTS,
  INITIAL_SECURITY_ALERTS,
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
  SecurityAlert,
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
  securityAlerts: SecurityAlert[];
  lastBackupDate: string;
  deletedSubscriberIds?: string[];
  lastUpdatedTimestamp?: number;
}

const STORAGE_KEY = 'alsari_broadcasting_v1';
const DELETED_SUBS_KEY = 'alsari_deleted_subscribers_v1';

export const storageService = {
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

  loadState(): AppState {
    const deletedSet = this.getDeletedSubscriberIds();

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed: AppState = JSON.parse(data);
        if (parsed.subscribers && Array.isArray(parsed.subscribers)) {
          parsed.subscribers = parsed.subscribers
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
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }

    const initialFilteredSubs = INITIAL_SUBSCRIBERS.filter(
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
      securityAlerts: INITIAL_SECURITY_ALERTS,
      lastBackupDate: new Date().toISOString(),
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

  exportBackupJson(state: AppState) {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `alsari_broadcasting_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  async importBackupJson(file: File): Promise<AppState> {
    const deletedSet = this.getDeletedSubscriberIds();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (parsed && Array.isArray(parsed.subscribers)) {
            parsed.subscribers = parsed.subscribers
              .filter((s: Subscriber) => !deletedSet.has(s.id) && !deletedSet.has(s.deviceId))
              .map((s: Subscriber) => {
                const raw = (s.deviceId || '').trim();
                const clean = raw ? (raw.startsWith('00') ? raw : `00${raw}`) : `00123456`;
                return { ...s, deviceId: clean };
              });
            resolve(parsed);
          } else {
            reject(new Error('ملف النسخة الاحتياطية غير صالح'));
          }
        } catch {
          reject(new Error('تعذر قراءة ملف JSON'));
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
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
